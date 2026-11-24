// 개인정보 가리기 시험: node tests/mask.test.mjs
import { maskPersonal } from '../js/mask.js';
let fail = 0;
const t = (name, cond, d = '') => { if (!cond) fail++; console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : d); };
let r = maskPersonal('성명  김하늘  주민등록번호  090315-4123456\n주소  충청북도 충주시 중앙로 123\n보호자 성명  김바다  연락처 010-1234-5678');
t('주민번호 뒷자리', r.text.includes('090315-●●●●●●●') && !r.text.includes('4123456'), r.text);
t('이름', !r.text.includes('김하늘') && !r.text.includes('김바다'), r.text);
t('주소', !r.text.includes('중앙로'), r.text);
t('전화', !r.text.includes('1234-5678'), r.text);
r = maskPersonal('학습부 부장으로 활동함. 이름 짓기 놀이에 참여함. 학급 회의에서 이름을 불러 줌.');
t('일반 문장은 그대로', r.text === '학습부 부장으로 활동함. 이름 짓기 놀이에 참여함. 학급 회의에서 이름을 불러 줌.', r.text);
r = maskPersonal('하늘이는 친구를 잘 도움.', ['하늘']);
t('입력한 이름', r.text.startsWith('하●이는'), r.text);
r = maskPersonal('2026.03.04.-2027.02.28. 학급회의(월1회)');
t('일자는 그대로', r.text === '2026.03.04.-2027.02.28. 학급회의(월1회)', r.text);
r = maskPersonal('학생정보 성명 김하늘 성별 여');
t('PDF 한 칸 띄어쓴 성명', !r.text.includes('김하늘'), r.text);
console.log(fail ? `${fail} FAIL` : 'ALL PASS'); process.exit(fail ? 1 : 0);
