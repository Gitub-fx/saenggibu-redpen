import fs from 'fs';
const R = JSON.parse(fs.readFileSync(new URL("../data/rules.json", import.meta.url), 'utf8'));
const cases = [
  ['교내 토론대회에서 최우수상을 받음.', 'contest', true],
  ['대회의실에서 학급회의를 진행함.', 'contest', false],
  ['TOEIC 900점을 취득함.', 'lang-test', true],
  ['서울대학교 교수의 특강을 듣고 진로를 탐색함.', 'university', true],
  ['대학 진학을 목표로 꾸준히 노력함.', 'university', false],
  ['아버지가 의사인 영향으로 의료에 관심을 가짐.', 'parents', true],
  ['어머니와 함께 텃밭을 가꾸며 책임감을 기름.', 'parents', false],
  ['한국과학창의재단에서 주최한 캠프에 참여함.', 'organization', true],
  ['충청북도자연과학교육원에서 실시한 탐구 활동에 참여함.', 'organization', true],
  ['김철수 강사의 진로 특강을 듣고 소감을 발표함.', 'lecturer', true],
  ['장학금을 받음.', 'scholarship', true],
  ['상표를 출원함.', 'patent', true],
];
let fail = 0;
for (const [s, id, expect] of cases) {
  const r = R.기재금지.find(x => x.id === id);
  let hit = false;
  if (r.패턴) hit = r.패턴.some(p => s.includes(p));
  if (!hit && r.정규식) hit = new RegExp(r.정규식, 'u').test(s);
  const ok = hit === expect; if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', id, expect, '|', s);
}
const ai = R.AI흔적.비명사형종결.정규식;
for (const [s, e] of [['탐구 활동에 적극적으로 참여하였다.', true], ['리더십이 뛰어남.', false], ['문제를 해결할 수 있다.', true], ['성실함이 돋보임.', false]]) {
  const h = new RegExp(ai, 'u').test(s); if (h !== e) fail++; console.log(h === e ? 'OK  ' : 'FAIL', 'ending', e, '|', s);
}
for (const [s, n] of [['학교폭력예방활동(2026.03.04.-2026.07.08./5회)', 0], ['봉사(2026.03.04~2026.07.08)', 2], ['(2026.3.4.)', 1], ['(2026.03.04. - 2026.07.08.)', 1], ['2026-03-04', 1], ['회장(2026.03.01.--2027.02.28.)', 1]]) {
  const hits = R.일자표기.오류정규식.filter(x => new RegExp(x.정규식, 'u').test(s)).map(x => x.메시지);
  const ok = n === 0 ? hits.length === 0 : hits.length >= 1; if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', 'date', n, '|', s, hits);
}
console.log(fail ? `${fail} FAIL` : "ALL PASS"); process.exit(fail ? 1 : 0);
