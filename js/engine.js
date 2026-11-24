// 생기부 빨간펜 점검 엔진
// 브라우저와 Node 양쪽에서 쓰는 순수 함수 모음. 규칙은 data/rules.json, 허용 기관은 data/allowed_orgs.json.
// 입력 문장은 이 함수 안에서만 다루며 어디로도 보내지 않는다.

export const SEVERITY_ORDER = { 금지: 0, 형식: 1, 확인: 2 };

/** 나이스 기준 바이트 수: 한글 등 3, 영문·숫자·기호 1, 엔터 1 */
export function neisBytes(text) {
  let b = 0;
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    b += ch.charCodeAt(0) > 127 ? 3 : 1;
  }
  return b;
}

/** 영역 목록 (학교급별) — 이름, 최대 글자수 */
export function areasFor(rules, level) {
  const t = rules.최대글자수;
  const merged = { ...t.공통, ...(level === '중학교' ? t.중학교 : t.고등학교) };
  const labels = {
    창체_자율자치: '창체 · 자율·자치활동',
    창체_동아리: '창체 · 동아리활동',
    창체_진로: '창체 · 진로활동',
    세특_과목별: '과목별 세부능력 및 특기사항',
    세특_개인별: '개인별 세부능력 및 특기사항',
    행특: '행동특성 및 종합의견',
    출결_특기사항: '출결상황 특기사항',
    일상생활활동: '일상생활 활동상황',
    독서_공통: '독서활동 · 공통',
    독서_과목별: '독서활동 · 과목별',
    봉사_활동내용: '봉사활동 · 활동내용',
    인적학적_특기사항: '인적·학적사항 특기사항',
    자유학기_진로탐색: '자유학기 · 진로탐색활동',
    자유학기_주제선택: '자유학기 · 주제선택활동',
    자유학기_예술체육: '자유학기 · 예술·체육활동',
    자유학기_동아리: '자유학기 · 동아리활동',
  };
  return Object.keys(labels)
    .filter((k) => merged[k])
    .map((k) => ({ id: k, label: labels[k], maxChars: merged[k], maxBytes: merged[k] * 3 }));
}

function allMatches(re, text) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const g = new RegExp(re.source, flags);
  const out = [];
  let m;
  while ((m = g.exec(text)) !== null) {
    if (m[0] === '') { g.lastIndex++; continue; }
    out.push({ start: m.index, end: m.index + m[0].length, match: m[0] });
  }
  return out;
}

function literalMatches(words, text) {
  const out = [];
  for (const w of words) {
    let i = text.indexOf(w);
    while (i !== -1) {
      out.push({ start: i, end: i + w.length, match: w });
      i = text.indexOf(w, i + w.length);
    }
  }
  return out;
}

/** 문장 단위로 쪼개면서 원문 위치를 함께 돌려준다 */
export function sentences(text) {
  const out = [];
  const re = /[^.!?\n]+[.!?]*|\n/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = m[0];
    if (s === '\n' || !s.trim()) continue;
    const lead = s.length - s.trimStart().length;
    out.push({ text: s.trim(), start: m.index + lead, end: m.index + lead + s.trim().length });
  }
  return out;
}

function buildOrgAllow(orgs) {
  const set = new Set(orgs.교육부_및_소속기관);
  for (const list of Object.values(orgs.시도교육청별)) list.forEach((n) => set.add(n));
  return set;
}

function isAllowedOrg(name, allowSet) {
  if (allowSet.has(name)) return true;
  if (/교육(지원)?청$/.test(name)) return true;
  for (const a of allowSet) {
    if (a.length >= 4 && (name.endsWith(a) || a.endsWith(name))) return true;
  }
  return false;
}

/**
 * 점검기 만들기
 * @param {object} rules data/rules.json
 * @param {object} orgs data/allowed_orgs.json
 */
export function createChecker(rules, orgs) {
  const allowOrgs = buildOrgAllow(orgs);
  const allowEnglish = new Set(rules.영문.허용.map((w) => w.toLowerCase()));

  /**
   * @param {string} text 점검할 문장
   * @param {object} opt { level: '고등학교'|'중학교', area: 영역 id, grade: 1|2|3, school: { names: [] } }
   * @returns {{ findings: object[], bytes: number, maxBytes: number|null }}
   */
  function check(text, opt = {}) {
    const { level = '고등학교', area = '', grade = 1, school = {} } = opt;
    const findings = [];
    const add = (f) => findings.push(f);

    // 1) 기재 금지 사항
    for (const r of rules.기재금지) {
      if (r.예외영역 && r.예외영역.includes(area)) continue;
      let hits = [];
      if (r.패턴) hits = hits.concat(literalMatches(r.패턴, text));
      if (r.정규식) hits = hits.concat(allMatches(new RegExp(r.정규식, 'u'), text));
      if (r.학교맞춤) hits = hits.concat(literalMatches((school.names || []).filter(Boolean), text));
      for (const h of hits) {
        if (r.id === 'organization' && isAllowedOrg(h.match, allowOrgs)) continue;
        add({ ...h, ruleId: r.id, 항목: r.항목, 심각도: r.심각도, 메시지: r.설명, 근거: r.근거 });
      }
    }

    // 2) AI 흔적
    const ai = rules.AI흔적;
    for (const h of literalMatches(ai.학생지칭.패턴, text)) {
      add({ ...h, ruleId: 'ai-refer', 항목: '학생 지칭 표현', 심각도: ai.학생지칭.심각도, 메시지: ai.학생지칭.설명, 근거: ai.근거 });
    }
    const markHits = literalMatches(ai.서식기호.패턴, text).concat(allMatches(new RegExp(ai.서식기호.정규식, 'mu'), text));
    for (const h of markHits) {
      add({ ...h, ruleId: 'ai-markdown', 항목: 'AI 서식 기호', 심각도: ai.서식기호.심각도, 메시지: ai.서식기호.설명, 근거: ai.근거 });
    }
    const endRe = new RegExp(ai.비명사형종결.정규식, 'u');
    for (const s of sentences(text)) {
      if (endRe.test(s.text)) {
        add({ start: s.start, end: s.end, match: s.text, ruleId: 'ai-ending', 항목: '명사형이 아닌 종결', 심각도: ai.비명사형종결.심각도, 메시지: ai.비명사형종결.설명, 근거: ai.비명사형종결.근거 });
      }
    }

    // 3) 특수문자·번호
    for (const h of allMatches(new RegExp(rules.특수문자.정규식, 'mu'), text)) {
      add({ ...h, ruleId: 'special-char', 항목: '특수문자·번호', 심각도: rules.특수문자.심각도, 메시지: rules.특수문자.설명, 근거: rules.특수문자.근거 });
    }

    // 4) 영문
    const covered = (s, e) => findings.some((f) => f.start <= s && e <= f.end);
    for (const h of allMatches(/[A-Za-z][A-Za-z0-9+#]*/u, text)) {
      if (allowEnglish.has(h.match.toLowerCase()) || covered(h.start, h.end)) continue;
      add({ ...h, ruleId: 'english', 항목: '영문 사용', 심각도: rules.영문.심각도, 메시지: rules.영문.설명, 근거: rules.영문.근거 });
    }

    // 5) 일자 표기
    for (const d of rules.일자표기.오류정규식) {
      for (const h of allMatches(new RegExp(d.정규식, 'u'), text)) {
        add({ ...h, ruleId: 'date-format', 항목: '일자 표기', 심각도: rules.일자표기.심각도, 메시지: d.메시지, 근거: rules.일자표기.근거 });
      }
    }

    // 6) 출결 특기사항
    if (area === '출결_특기사항') {
      const a = rules.출결;
      const dayRe = new RegExp(a.기타결석.일수정규식, 'u');
      let pos = 0;
      for (const seg of text.split(/[,，\n]/)) {
        const start = text.indexOf(seg, pos);
        pos = start + seg.length;
        const t = seg.trim();
        if (!t || /개근/.test(t)) continue;
        if (/출석\s*인정/.test(t)) {
          add({ start, end: start + seg.length, match: seg, ruleId: 'attend-recognized', 항목: '출석인정결석 사유', 심각도: a.출석인정결석.심각도, 메시지: a.출석인정결석.설명, 근거: a.근거 });
        } else if (!dayRe.test(t)) {
          add({ start, end: start + seg.length, match: seg, ruleId: 'attend-days', 항목: '결석 일수 표기', 심각도: a.기타결석.심각도, 메시지: a.기타결석.설명, 근거: a.근거 });
        }
      }
      for (const h of literalMatches(a.질병명.패턴, text)) {
        add({ ...h, ruleId: 'attend-disease', 항목: '질병명', 심각도: a.질병명.심각도, 메시지: a.질병명.설명, 근거: a.근거 });
      }
    }

    // 7) 임원 재임 기간
    if (area === '창체_자율자치') {
      const o = rules.임원;
      const termRe = new RegExp(o.재임기간정규식, 'u');
      for (const raw of allMatches(new RegExp(o.임원정규식, 'u'), text)) {
        const lead = raw.match.length - raw.match.trimStart().length;
        const h = { start: raw.start + lead, end: raw.end, match: raw.match.trimStart() };
        const after = text.slice(h.end, h.end + 40);
        const m = after.match(termRe);
        if (!m) {
          add({ ...h, ruleId: 'officer-term', 항목: '임원 재임 기간', 심각도: o.심각도, 메시지: o.설명, 근거: o.근거 });
        } else if (grade !== 3 && !m[0].includes(o.학년말)) {
          add({ start: h.start, end: h.end + after.indexOf(m[0]) + m[0].length, match: h.match + m[0], ruleId: 'officer-term-end', 항목: '임원 재임 기간 끝', 심각도: '확인', 메시지: `1·2학년 임원의 재임 기간은 학년말(${o.학년말})까지 씁니다`, 근거: o.근거 });
        }
      }
    }

    // 8) 글자수
    const bytes = neisBytes(text);
    const areaInfo = areasFor(rules, level).find((x) => x.id === area);
    const maxBytes = areaInfo ? areaInfo.maxBytes : null;
    if (maxBytes && bytes > maxBytes) {
      add({ start: 0, end: 0, match: '', ruleId: 'length', 항목: '글자수 초과', 심각도: '형식', 메시지: `${areaInfo.label}은(는) 최대 ${areaInfo.maxChars}자(${maxBytes}바이트)입니다. 지금 ${bytes}바이트로 ${bytes - maxBytes}바이트 넘습니다`, 근거: rules.최대글자수.근거 });
    }

    // 중복 제거 + 정렬
    const seen = new Set();
    const uniq = findings.filter((f) => {
      const k = `${f.ruleId}:${f.start}:${f.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    uniq.sort((a, b) => a.start - b.start || SEVERITY_ORDER[a.심각도] - SEVERITY_ORDER[b.심각도]);
    return { findings: uniq, bytes, maxBytes };
  }

  return { check, areas: (level) => areasFor(rules, level) };
}

/** 두 글의 유사도(문자 3-gram 자카드). 세특 동일·유사 기재 점검용 */
export function similarity(a, b) {
  const grams = (s) => {
    const t = s.replace(/\s+/g, '');
    const g = new Set();
    for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3));
    return g;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
