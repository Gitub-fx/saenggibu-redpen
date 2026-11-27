// 파일 하나(한 학생 또는 반 전체)를 학생별로 나누고, 학생마다 영역·칸 단위로 점검한 결과를 만든다.
// 화면(index.html)은 이 결과를 그리기만 한다. 브라우저와 Node(시험) 양쪽에서 동작한다.

import { maskPersonal } from './mask.js';
import { splitSections } from './document.js';
import { splitRecord, extractItems, recordChecks } from './record.js';
import { similarity } from './engine.js';

const FIRST_SECTION = /^\s*(?:#{1,6}\s*)?1\s*[.)]\s*인\s*적/;

/** 학생 경계: "1. 인적…" 제목이 다시 나오는 곳 (바로 앞 "학교생활기록부" 제목 줄부터) */
export function splitStudents(text) {
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((l, i) => {
    if (!FIRST_SECTION.test(l)) return;
    let s = i;
    for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
      if (/학\s*교\s*생\s*활\s*기\s*록\s*부/.test(lines[k])) { s = k; break; }
    }
    if (!starts.length || s > starts[starts.length - 1]) starts.push(s);
  });
  if (starts.length <= 1) return [text];
  const chunks = [];
  if (starts[0] > 0) starts[0] = 0; // 첫 학생 앞의 표지는 첫 학생에 붙임
  starts.forEach((s, i) => chunks.push(lines.slice(s, i + 1 < starts.length ? starts[i + 1] : lines.length).join('\n')));
  return chunks;
}

/** 쪽 아래 머리글에서 번호 찾기: "번호 / 5", "번호 4" */
export function studentNumber(raw) {
  const m = raw.match(/번\s*호\s*[\/:：]?\s*(\d{1,2})(?!\d)/);
  return m ? Number(m[1]) : null;
}

const norm = (s) => (s || '').replace(/\s/g, '');

/**
 * @param {{ name, kind, text, markdown?, rawText?, ocr?, pageCount? }} doc readFile 결과
 * @param {{ check: Function }} checker createChecker 결과
 * @param {{ level, grade, names: string[], school?: object }} opts
 */
export function analyzeDocument(doc, checker, opts = {}) {
  const { level = '고등학교', grade = 1, names = [], school = { names: [] } } = opts;
  const useRecord = doc.markdown && /<table|\|\s*---/.test(doc.markdown);
  const source = useRecord ? doc.markdown : doc.text;
  const rawChunks = splitStudents(source);
  const hidden = {};
  const addHidden = (hits) => hits.forEach((h) => (hidden[h.id] = (hidden[h.id] || 0) + h.count));

  // 스캔·텍스트 PDF는 바닥글을 지운 글을 쓰므로, 번호는 원문 바닥글에서 차례로 모은다
  const numbersInOrder = [];
  if (!useRecord && doc.rawText) {
    for (const m of doc.rawText.matchAll(/번\s*호\s*[\/:：]?\s*(\d{1,2})(?!\d)/g)) {
      const n = Number(m[1]);
      if (numbersInOrder[numbersInOrder.length - 1] !== n) numbersInOrder.push(n);
    }
  }

  const students = rawChunks.map((chunk, si) => {
    const no = useRecord ? studentNumber(chunk) : numbersInOrder[si] ?? null;
    const label = no != null ? `${no}번 학생` : rawChunks.length > 1 ? `${si + 1}번째 학생` : '학생';
    let units = [];
    if (useRecord) {
      const items = extractItems(splitRecord(chunk)).map((it) => {
        const m = maskPersonal(it.text, names);
        addHidden(m.hits);
        return { ...it, text: m.text };
      });
      units = items.map((it) => {
        const r = checker.check(it.text, { level, grade: Number(it.meta.학년) || grade, area: it.area, school });
        return { section: it.section, label: it.label, area: it.area, meta: it.meta, text: it.text, findings: r.findings, bytes: r.bytes, maxBytes: r.maxBytes };
      });
      recordChecks(units, similarity).forEach((f) => units[f.item].findings.push(f));
    } else {
      const m = maskPersonal(chunk, names);
      addHidden(m.hits);
      units = splitSections(m.text)
        .filter((sec) => sec.key !== '머리말' && !/인적/.test(sec.key))
        .map((sec) => {
          const r = checker.check(sec.text, { level, grade, area: sec.area, school, ocr: !!doc.ocr });
          const titleEnd = sec.text.indexOf('\n') === -1 ? sec.text.length : sec.text.indexOf('\n');
          const findings = r.findings.filter((f) => f.ruleId !== 'length' && !(f.ruleId === 'special-char' && f.end <= titleEnd));
          return { section: sec.key, label: sec.key, area: sec.area, meta: {}, text: sec.text.trim(), findings, bytes: null, maxBytes: null };
        });
    }
    return { label, no, units };
  });

  // 학생 사이: 같은 과목 세특·행특이 같거나 거의 같은지
  if (students.length > 1) {
    const pool = [];
    students.forEach((st, si) => st.units.forEach((u, ui) => {
      if (u.area === '세특_과목별' || u.area === '행특') pool.push({ si, ui, u, key: u.area === '행특' ? '행특' : norm(u.meta.과목) });
    }));
    for (let a = 0; a < pool.length; a++) {
      for (let b = a + 1; b < pool.length; b++) {
        const A = pool[a], B = pool[b];
        if (A.si === B.si || A.key !== B.key) continue;
        const sim = similarity(A.u.text, B.u.text);
        if (sim < 0.7) continue;
        const pct = Math.round(sim * 100);
        const mk = (other, label) => ({ start: 0, end: 0, match: '', ruleId: 'dup-student', 항목: sim >= 0.95 ? '다른 학생과 동일 기재' : '다른 학생과 유사 기재', 심각도: '확인', 메시지: `${label}의 “${other.label}”과(와) ${pct}% 같습니다. 학생 개인의 특성이 드러나게 써야 합니다`, 근거: '기재요령 교과학습발달상황·행동특성 및 종합의견, 2026 학생부 현장점검 결과 분석②' });
        students[B.si].units[B.ui].findings.push(mk(A.u, students[A.si].label));
        students[A.si].units[A.ui].findings.push(mk(B.u, students[B.si].label));
      }
    }
  }

  const count = (fs, s) => fs.filter((f) => f.심각도 === s).length;
  for (const st of students) {
    st.units.forEach((u) => u.findings.sort((a, b) => a.start - b.start));
    const all = st.units.flatMap((u) => u.findings);
    st.total = { 금지: count(all, '금지'), 형식: count(all, '형식'), 확인: count(all, '확인') };
  }
  const total = { 금지: 0, 형식: 0, 확인: 0 };
  students.forEach((st) => Object.keys(total).forEach((k) => (total[k] += st.total[k])));
  return {
    name: doc.name, kind: doc.kind, ocr: !!doc.ocr, pageCount: doc.pageCount || null,
    mode: useRecord ? 'record' : 'sections',
    students, total,
    hidden: Object.entries(hidden).map(([id, c]) => ({ id, count: c })),
  };
}
