// 나이스 출력물 칸 단위 분리 시험: node tests/record.test.mjs
// tests/fixtures/neis_hwp_가상.md 는 실제 나이스 한글 출력물(kordoc 변환)과 같은 표 구조로 만든 가상 자료
import fs from 'fs';
import { splitRecord, extractItems, recordChecks, tableToGrid } from '../js/record.js';
import { similarity } from '../js/engine.js';
import { maskPersonal } from '../js/mask.js';

let fail = 0;
const t = (name, cond, d = '') => { if (!cond) fail++; console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : d); };
const md = fs.readFileSync(new URL('./fixtures/neis_hwp_가상.md', import.meta.url), 'utf8');

const g = tableToGrid('<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>');
t('rowspan 펼치기', g[1][0] === g[0][0] && g[1][1].text === 'C');

const secs = splitRecord(md);
t('영역 7개 찾기', secs.map((s) => s.key).join(',') === '인적사항,학적사항,출결상황,진로지도상황,교과학습발달상황,창의적 체험활동상황,행동특성 및 종합의견', secs.map((s) => s.key));
const items = extractItems(secs);
const labels = items.map((i) => i.label);
t('세특 4칸', items.filter((i) => i.area === '세특_과목별').length === 4, labels);
t('세특 이름: 1학년 2학기 목공예', labels.includes('1학년 2학기 목공예'), labels);
t('창체 영역 구분', items.some((i) => i.area === '창체_자율자치') && items.some((i) => i.area === '창체_동아리'), labels);
t('진로지도 머리줄 제외', items.filter((i) => i.section === '진로지도상황').length === 1, labels);
const att = items.find((i) => i.area === '출결_특기사항');
t('출결: 기타결석 3', att && att.meta.기타결석 === 3, JSON.stringify(att));
t('행특 1칸', items.filter((i) => i.area === '행특').length === 1);

const rec = recordChecks(items, similarity);
const ids = rec.map((r) => r.ruleId);
t('학기 간 동일 세특', rec.some((r) => r.ruleId === 'dup-semester' && items[r.item].label === '1학년 2학기 목공예'), ids);
t('학년도와 맞지 않는 날짜(2019)', rec.some((r) => r.ruleId === 'year-mismatch' && r.match === '2019.12.20.'), ids);
t('문장 반복', ids.includes('dup-sentence'), ids);
t('기타결석 3일 ≠ 특기사항 1일', ids.includes('attend-sum'), ids);

const m = maskPersonal(md);
t('쪽 아래 "이름 / 가상인" 가리기', !/이름 \/ 가상인/.test(m.text), m.text.split('\n').slice(-1)[0]);
console.log(fail ? `${fail} FAIL` : 'ALL PASS'); process.exit(fail ? 1 : 0);
