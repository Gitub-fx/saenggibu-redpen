// 나이스 학교생활기록부 출력물(HWP·HWPX → kordoc 마크다운)의 표를 칸 단위로 읽어,
// 점검할 칸(과목별 세특, 창체 영역별 특기사항, 출결 특기사항, 행특 등)을 꺼낸다.
// 2026-11 실제 나이스 출력 한글 파일(전공과)의 표 구조를 보고 만들었다.

/** HTML 표 하나 → 2차원 격자 (rowspan·colspan을 펼치되, 같은 칸은 같은 객체를 가리킴) */
export function tableToGrid(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi)].map((c) => ({
      text: cellText(c[3]),
      rowspan: Number((c[2].match(/rowspan="?(\d+)/i) || [])[1] || 1),
      colspan: Number((c[2].match(/colspan="?(\d+)/i) || [])[1] || 1),
      header: c[1].toLowerCase() === 'th',
    }))
  );
  const grid = [];
  rows.forEach((cells, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    for (const cell of cells) {
      while (grid[r][c]) c++;
      for (let dr = 0; dr < cell.rowspan; dr++) {
        for (let dc = 0; dc < cell.colspan; dc++) {
          grid[r + dr] = grid[r + dr] || [];
          grid[r + dr][c + dc] = cell;
        }
      }
      c += cell.colspan;
    }
  });
  return grid.slice(0, rows.length);
}

/** GFM 파이프 표 → 격자 */
function pipeToGrid(block) {
  return block
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !/^\s*\|?\s*:?-{3,}/.test(l))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((t) => ({ text: cellText(t), rowspan: 1, colspan: 1 })));
}

export function cellText(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\\([~*_|#\-.()[\]])/g, '$1')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const SECTION_DEFS = [
  { key: '인적사항', re: /^인\s*적\s*(·\s*학\s*적\s*)?사\s*항/ },
  { key: '학적사항', re: /^학\s*적\s*사\s*항/ },
  { key: '출결상황', re: /^출\s*결\s*상\s*황/ },
  { key: '수상경력', re: /^수\s*상\s*경\s*력/ },
  { key: '직업평가상황', re: /^직\s*업\s*평\s*가/ },
  { key: '현장실습 현황', re: /^취\s*업\s*박\s*람\s*회|^현\s*장\s*실\s*습/ },
  { key: '자격증 및 인증 취득상황', re: /^자\s*격\s*증/ },
  { key: '학교폭력 조치상황', re: /^학\s*교\s*폭\s*력/ },
  { key: '진로지도상황', re: /^진\s*로\s*지\s*도/ },
  { key: '창의적 체험활동상황', re: /^창\s*의\s*적\s*체\s*험/ },
  { key: '일상생활 활동상황', re: /^일\s*상\s*생\s*활/ },
  { key: '교과학습발달상황', re: /^교\s*과\s*학\s*습/ },
  { key: '자유학기활동상황', re: /^자\s*유\s*학\s*기/ },
  { key: '독서활동상황', re: /^독\s*서\s*활\s*동/ },
  { key: '행동특성 및 종합의견', re: /^행\s*동\s*특\s*성/ },
];

/** 마크다운을 "N. 제목" 줄로 영역 나누기 (각 영역의 표 목록 포함) */
export function splitRecord(md) {
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const m = l.replace(/^#{1,6}\s*/, '').match(/^\s*(\d{1,2})\s*[.)]\s*(.{2,30})$/);
    if (!m) return;
    const def = SECTION_DEFS.find((d) => d.re.test(m[2].trim()));
    if (def) heads.push({ line: i, no: Number(m[1]), key: def.key, title: m[2].trim() });
  });
  return heads.map((h, i) => {
    const body = lines.slice(h.line + 1, i + 1 < heads.length ? heads[i + 1].line : lines.length).join('\n');
    const grids = [];
    for (const t of body.matchAll(/<table[\s\S]*?<\/table>/gi)) grids.push(tableToGrid(t[0]));
    const pipe = body.replace(/<table[\s\S]*?<\/table>/gi, '').match(/(^\s*\|.*\|\s*$\n?)+/gm);
    (pipe || []).forEach((b) => grids.push(pipeToGrid(b)));
    const loose = body.replace(/<table[\s\S]*?<\/table>/gi, '').replace(/(^\s*\|.*\|\s*$\n?)+/gm, '').trim();
    return { ...h, body, grids, loose };
  });
}

const uniqCells = (cells) => [...new Set(cells.filter(Boolean))];

/** 머리줄(th 또는 첫 줄들)에서 글자가 들어간 열 번호 찾기 */
function findCol(grid, re, maxHeaderRows = 3) {
  for (let r = 0; r < Math.min(maxHeaderRows, grid.length); r++) {
    const row = grid[r] || [];
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c] && re.test(row[c].text.replace(/\s/g, ''))) return { row: r, col: c };
    }
  }
  return null;
}

function isHeaderRow(grid, r, hit) {
  const headCell = (grid[hit.row] || [])[hit.col];
  const row = grid[r] || [];
  if (r <= hit.row || row[hit.col] === headCell) return true; // rowspan으로 이어진 머리칸
  return row.some((c) => c && c.header && r < 3);
}

const AREA_BY_NAME = [
  [/자율|자치/, '창체_자율자치'],
  [/동아리/, '창체_동아리'],
  [/진로/, '창체_진로'],
  [/봉사/, '봉사_활동내용'],
];

/**
 * 점검할 칸 꺼내기
 * @returns {{ section: string, label: string, area: string, text: string, meta: object }[]}
 */
export function extractItems(sections) {
  const items = [];
  const push = (section, label, area, text, meta = {}) => {
    const t = (text || '').trim();
    if (t && !/^[‧·.\-\s]*$/.test(t)) items.push({ section, label, area, text: t, meta });
  };

  for (const s of sections) {
    if (s.key === '인적사항' || s.key === '학적사항') {
      const all = s.grids.flatMap((g) => g.map((row) => row.map((c) => (c ? c.text : ''))));
      all.forEach((row) => {
        const i = row.findIndex((t) => /^특기사항$/.test(t.replace(/\s/g, '')));
        if (i !== -1) push(s.key, '특기사항', '인적학적_특기사항', row.slice(i + 1).join(' '));
      });
      const m = s.loose.match(/특기사항\s*\n?([\s\S]*)$/);
      if (m) push(s.key, '특기사항', '인적학적_특기사항', m[1]);
      continue;
    }
    for (const g of s.grids) {
      if (s.key === '출결상황') {
        const hit = findCol(g, /^특기사항$/);
        const gita = (() => { // '결석일수' 아래 첫 '기타' 열
          const top = findCol(g, /^결석/);
          if (!top) return null;
          const sub = g[top.row + 1] || [];
          for (let c = top.col; c < sub.length; c++) if (sub[c] && /^기타$/.test(sub[c].text)) return c;
          return null;
        })();
        if (!hit) continue;
        g.forEach((row, r) => {
          if (isHeaderRow(g, r, hit) || !row[hit.col]) return;
          const grade = row[0] ? row[0].text : '';
          const n = gita != null && row[gita] ? Number(row[gita].text.replace(/[^\d]/g, '')) || 0 : null;
          push(s.key, `${grade}학년 출결 특기사항`, '출결_특기사항', row[hit.col].text, { 기타결석: n, 학년: grade });
        });
        continue;
      }
      if (s.key === '교과학습발달상황') {
        const hit = findCol(g, /세부능력및특기사항|특기사항/);
        if (!hit) continue;
        const seen = new Set();
        g.forEach((row, r) => {
          if (isHeaderRow(g, r, hit)) return;
          const cell = row[hit.col];
          if (!cell || seen.has(cell)) return;
          seen.add(cell);
          const lead = uniqCells(row.slice(0, hit.col)).map((c) => c.text.replace(/\n/g, ''));
          const term = lead[0] || '';
          const subject = lead[lead.length - 1] || '';
          if (subject === cell.text) return;
          push(s.key, `${term.replace(/^(\d)\((\d)학기\)$/, '$1학년 $2학기')} ${subject}`.trim(), '세특_과목별', cell.text, { 과목: subject, 학기: term });
        });
        continue;
      }
      if (s.key === '창의적 체험활동상황') {
        const hit = findCol(g, /^특기사항$/);
        const areaCol = findCol(g, /^영역$/);
        if (!hit) continue;
        const seen = new Set();
        g.forEach((row, r) => {
          if (isHeaderRow(g, r, hit)) return;
          const cell = row[hit.col];
          if (!cell || seen.has(cell)) return;
          seen.add(cell);
          const name = areaCol && row[areaCol.col] ? row[areaCol.col].text : '';
          const area = (AREA_BY_NAME.find(([re]) => re.test(name)) || [, ''])[1];
          const grade = row[0] ? row[0].text : '';
          push(s.key, `${grade}학년 ${name}`.trim(), area, cell.text, { 영역: name, 학년: grade });
        });
        continue;
      }
      if (s.key === '행동특성 및 종합의견' || s.key === '진로지도상황' || s.key === '일상생활 활동상황' || s.key === '독서활동상황') {
        const hit = findCol(g, /행동특성및종합의견|^특기사항$|활동상황|독서활동/) || { row: 0, col: (g[0] || []).length - 1 };
        const seen = new Set();
        const area = { '행동특성 및 종합의견': '행특', '일상생활 활동상황': '일상생활활동', '독서활동상황': '독서_공통' }[s.key] || '';
        g.forEach((row, r) => {
          if (isHeaderRow(g, r, hit)) return;
          const cell = row[hit.col];
          if (!cell || seen.has(cell) || /^\d$/.test(cell.text)) return;
          seen.add(cell);
          const grade = row[0] && row[0] !== cell ? row[0].text : '';
          push(s.key, `${grade ? grade + '학년 ' : ''}${s.key === '진로지도상황' ? '진로지도 특기사항' : s.key}`, area, cell.text, { 학년: grade });
        });
        continue;
      }
    }
    if (!['출결상황', '교과학습발달상황', '창의적 체험활동상황', '행동특성 및 종합의견', '진로지도상황', '일상생활 활동상황', '독서활동상황'].includes(s.key)) {
      // 그 밖의 영역(현장실습, 직업평가, 수상, 자격증 등)은 표 전체 글을 한 덩어리로 일반 점검
      const flat = s.grids.map((g) => uniqCells(g.flat()).filter((c) => !c.header).map((c) => c.text).join('\n')).join('\n');
      push(s.key, s.key, s.key === '수상경력' ? '수상명' : s.key === '자격증 및 인증 취득상황' ? '자격증_명칭' : '', [flat, s.loose].join('\n'));
    }
  }
  return items;
}

/** 기록 전체를 보는 점검: 학년도와 맞지 않는 날짜, 같은 과목 학기 간 동일 세특, 칸 안 문장 반복, 출결 일수 */
export function recordChecks(items, similarity) {
  const out = [];
  // 1) 날짜 연도
  const years = [];
  items.forEach((it) => { for (const m of it.text.matchAll(/(\d{4})\.\d{2}\.\d{2}\./g)) years.push(Number(m[1])); });
  if (years.length >= 3) {
    const freq = {};
    years.forEach((y) => (freq[y] = (freq[y] || 0) + 1));
    const mode = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
    items.forEach((it, idx) => {
      for (const m of it.text.matchAll(/(\d{4})\.\d{2}\.\d{2}\./g)) {
        const y = Number(m[1]);
        if (y !== mode && y !== mode + 1 && y !== mode - 1) {
          out.push({ item: idx, start: m.index, end: m.index + m[0].length, match: m[0], ruleId: 'year-mismatch', 항목: '학년도와 맞지 않는 날짜', 심각도: '확인', 메시지: `이 기록의 날짜는 대부분 ${mode}년인데 ${y}년 날짜가 있습니다. 연도를 잘못 입력했는지 확인하세요`, 근거: '기록 안 날짜 비교' });
        }
      }
    });
  }
  // 2) 같은 과목의 학기 간 세특 동일·유사
  const subj = items.map((it, i) => ({ it, i })).filter((x) => x.it.area === '세특_과목별');
  for (let a = 0; a < subj.length; a++) {
    for (let b = a + 1; b < subj.length; b++) {
      const A = subj[a].it, B = subj[b].it;
      const sameName = A.meta.과목.replace(/\s/g, '') === B.meta.과목.replace(/\s/g, '');
      const sim = similarity(A.text, B.text);
      if (sim >= 0.95 || (sameName && sim >= 0.7)) {
        out.push({ item: subj[b].i, start: 0, end: 0, match: '', ruleId: 'dup-semester', 항목: sim >= 0.95 ? '세특 동일 기재' : '세특 유사 기재', 심각도: '확인', 메시지: `“${A.label}” 세특과 ${Math.round(sim * 100)}% 같습니다. 학기별 성장과 변화가 드러나게 써야 합니다`, 근거: '기재요령 교과학습발달상황, 2026 학생부 현장점검 결과 분석②' });
      }
    }
  }
  // 3) 한 칸 안의 문장 반복 (서술형 칸만)
  items.forEach((it, idx) => {
    if (!it.area || /수상명|자격증/.test(it.area)) { if (it.section !== '진로지도상황') return; }
    const sents = it.text.split(/(?<=[.。])\s+|\n/).map((x) => x.trim()).filter((x) => x.length >= 15);
    const seen = new Map();
    let pos = 0;
    for (const s of sents) {
      const at = it.text.indexOf(s, pos);
      pos = at + s.length;
      if (seen.has(s)) {
        out.push({ item: idx, start: at, end: at + s.length, match: s, ruleId: 'dup-sentence', 항목: '같은 문장 반복', 심각도: '확인', 메시지: '같은 칸 안에 똑같은 문장이 두 번 들어 있습니다. 복사·붙여넣기 실수인지 확인하세요', 근거: '기록 안 문장 비교' });
      } else seen.set(s, at);
    }
  });
  // 4) 출결: 기타결석 일수와 특기사항 일수 합
  items.forEach((it, idx) => {
    if (it.area !== '출결_특기사항' || it.meta.기타결석 == null) return;
    const sum = [...it.text.matchAll(/\((\d+)일\)/g)].reduce((s, m) => s + Number(m[1]), 0);
    const n = it.meta.기타결석;
    if (n > 0 && sum !== n && !/출석\s*인정/.test(it.text)) {
      out.push({ item: idx, start: 0, end: 0, match: '', ruleId: 'attend-sum', 항목: '기타결석 일수 불일치', 심각도: '형식', 메시지: `출결 표의 기타결석은 ${n}일인데 특기사항에 적힌 일수 합은 ${sum}일입니다`, 근거: '2026 학생부 현장점검 오류 사례(출결)' });
    }
  });
  return out;
}
