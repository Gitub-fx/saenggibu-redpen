// 학생부 출력물을 영역별로 나눈다.
// 나이스 학교생활기록부 출력물은 "1. 인적·학적사항", "2. 출결상황" … 같은 번호 붙은 제목으로 영역이 나뉜다.
// 실제 나이스 출력 샘플을 받은 뒤 학생별 분리와 표 칸 단위 분리를 보강한다.

export const SECTIONS = [
  { key: '인적·학적사항', re: /인\s*적\s*[·ㆍ.]?\s*학\s*적\s*사\s*항/, area: '인적학적_특기사항' },
  { key: '출결상황', re: /출\s*결\s*상\s*황/, area: '' },
  { key: '수상경력', re: /수\s*상\s*경\s*력/, area: '수상명' },
  { key: '자격증 및 인증 취득상황', re: /자\s*격\s*증\s*및\s*인\s*증/, area: '자격증_명칭' },
  { key: '학교폭력 조치상황', re: /학\s*교\s*폭\s*력\s*조\s*치/, area: '' },
  { key: '창의적 체험활동상황', re: /창\s*의\s*적\s*체\s*험\s*활\s*동/, area: '창체_자율자치' },
  { key: '일상생활 활동상황', re: /일\s*상\s*생\s*활\s*활\s*동/, area: '일상생활활동' },
  { key: '교과학습발달상황', re: /교\s*과\s*학\s*습\s*발\s*달/, area: '' },
  { key: '자유학기활동상황', re: /자\s*유\s*학\s*기\s*활\s*동/, area: '' },
  { key: '독서활동상황', re: /독\s*서\s*활\s*동\s*상\s*황/, area: '' },
  { key: '행동특성 및 종합의견', re: /행\s*동\s*특\s*성\s*및\s*종\s*합\s*의\s*견/, area: '행특' },
];

const HEADING = /^\s*(\d{1,2})\s*[.)]\s*(.{2,30})$/;

/**
 * @param {string} text
 * @returns {{ key: string, area: string, start: number, text: string }[]}
 */
export function splitSections(text) {
  const lines = text.split('\n');
  const marks = [];
  let offset = 0;
  for (const line of lines) {
    const m = line.match(HEADING);
    if (m) {
      const sec = SECTIONS.find((s) => s.re.test(m[2]));
      if (sec && !marks.some((x) => x.key === sec.key && offset - x.start < 40)) {
        marks.push({ key: sec.key, area: sec.area, start: offset });
      }
    }
    offset += line.length + 1;
  }
  if (!marks.length) return [{ key: '전체', area: '', start: 0, text }];
  const out = [];
  if (marks[0].start > 0 && text.slice(0, marks[0].start).trim()) {
    out.push({ key: '머리말', area: '', start: 0, text: text.slice(0, marks[0].start) });
  }
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    out.push({ ...m, text: text.slice(m.start, end) });
  });
  return out;
}
