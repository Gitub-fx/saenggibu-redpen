// 쪽 머리글·바닥글 지우기 시험: node tests/reader.test.mjs
import { stripPageFurniture } from '../js/reader.js';
let fail = 0;
const t = (name, cond, d = '') => { if (!cond) fail++; console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : d); };
const page = ['5. 교과학습발달상황', '국어  글을 읽고 중심 생각을 찾을 수 있음.', '가상학교  2026년11월26일  2 / 10  반 1 번호 4 성명 가●●', '출력 가상학교 2026.11.26 15:16:13 ***.**.***.**'].join('\n');
const out = stripPageFurniture(page);
t('본문은 남김', out.includes('중심 생각을 찾을 수 있음'), out);
t('출력일·쪽 번호 줄 지움', !out.includes('2 / 10'), out);
t('출력 시각 기록 지움', !out.includes('15:16:13'), out);
t('활동 일자는 남김', stripPageFurniture('현장체험학습(2026.10.27.)에 참여함.').includes('2026.10.27.'));
console.log(fail ? `${fail} FAIL` : 'ALL PASS'); process.exit(fail ? 1 : 0);
