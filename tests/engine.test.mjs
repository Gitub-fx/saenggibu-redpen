// 점검 엔진 시험: node tests/engine.test.mjs
import fs from 'fs';
import { createChecker, neisBytes, similarity, areasFor } from '../js/engine.js';

const rules = JSON.parse(fs.readFileSync(new URL('../data/rules.json', import.meta.url), 'utf8'));
const orgs = JSON.parse(fs.readFileSync(new URL('../data/allowed_orgs.json', import.meta.url), 'utf8'));
const { check } = createChecker(rules, orgs);

let fail = 0;
const ids = (r) => r.findings.map((f) => f.ruleId);
function expect(name, cond, detail = '') {
  if (!cond) fail++;
  console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : detail);
}

// 바이트
expect('바이트: 한글 3', neisBytes('가나') === 6);
expect('바이트: 영문·숫자 1, 엔터 1', neisBytes('AI 1\n') === 5);

// 기재 금지
let r = check('교내 토론대회에서 최우수상을 받음.', { area: '창체_자율자치' });
expect('대회 → 금지', ids(r).includes('contest'), ids(r));
r = check('대회의실에서 학급회의를 진행함.', { area: '창체_자율자치' });
expect('대회의실은 통과', !ids(r).includes('contest'), ids(r));
r = check('TOEIC 900점을 취득함.', { area: '행특' });
expect('TOEIC → 금지, 영문 중복 경고 없음', ids(r).includes('lang-test') && !ids(r).includes('english'), ids(r));
r = check('충청북도자연과학교육원에서 실시한 탐구 활동에 참여함.', { area: '창체_진로' });
expect('교육관련기관은 통과', !ids(r).includes('organization'), ids(r));
r = check('한국과학창의재단에서 주최한 캠프에 참여함.', { area: '창체_진로' });
expect('재단은 확인', ids(r).includes('organization'), ids(r));
r = check('충주성모학교 축제에서 사회를 맡음.', { area: '행특', school: { names: ['충주성모학교'] } });
expect('학교 맞춤: 학교명', ids(r).includes('school-name'), ids(r));

// AI 흔적
r = check('위 학생은 **리더십**이 뛰어나며 친구들을 잘 도와주었다.', { area: '행특' });
expect('AI: 학생 지칭', ids(r).includes('ai-refer'), ids(r));
expect('AI: ** 기호', ids(r).includes('ai-markdown'), ids(r));
expect('AI: ~다. 종결', ids(r).includes('ai-ending'), ids(r));
r = check('친구의 어려움을 먼저 살피고 도움을 줌. 맡은 일을 끝까지 책임지는 태도가 돋보임.', { area: '행특' });
expect('명사형 종결 문장은 통과', r.findings.length === 0, JSON.stringify(r.findings));

// 일자·영문·특수문자
r = check('학교폭력예방교육(2026.03.04~2026.07.08)에 참여함.', { area: '창체_자율자치' });
expect('일자: 물결표·온점 누락', r.findings.filter((f) => f.ruleId === 'date-format').length >= 2, ids(r));
r = check('학급회의(월1회), 학교폭력예방활동(2026.03.04.-2026.07.08./5회), 민주시민교육(2026.09.10.)', { area: '창체_자율자치' });
expect('올바른 일자는 통과', !ids(r).includes('date-format'), ids(r));
r = check('SNS와 AI를 활용해 PPT로 발표함.', { area: '세특_과목별' });
expect('허용 영문은 통과', !ids(r).includes('english'), ids(r));
r = check('Python으로 프로그램을 만듦.', { area: '세특_과목별' });
expect('허용 목록 밖 영문은 확인', ids(r).includes('english'), ids(r));
r = check('① 수업 태도가 성실함.', { area: '세특_과목별' });
expect('특수문자 ①', ids(r).includes('special-char'), ids(r));

// 출결
r = check('부모님 병간호(3일), 가족 여행', { area: '출결_특기사항' });
expect('출결: 일수 없는 사유만 잡음', r.findings.filter((f) => f.ruleId === 'attend-days').length === 1, JSON.stringify(r.findings));
r = check('개근', { area: '출결_특기사항' });
expect('출결: 개근 통과', r.findings.length === 0, ids(r));

// 임원
r = check('1학기 학급 반장으로 활동하며 학급회의를 이끎.', { area: '창체_자율자치', grade: 1 });
expect('임원: 재임 기간 누락', ids(r).includes('officer-term'), ids(r));
r = check('전교 학생자치회 부회장(2026.03.01.-2027.02.28.)으로 활동함.', { area: '창체_자율자치', grade: 2 });
expect('임원: 바른 재임 기간 통과', !ids(r).some((x) => x.startsWith('officer')), ids(r));
r = check('학생자치회 회장(2026.03.01.-2026.07.31.)으로 활동함.', { area: '창체_자율자치', grade: 1 });
expect('임원: 1·2학년 학년말 확인', ids(r).includes('officer-term-end'), ids(r));

// 글자수
r = check('가'.repeat(301), { area: '행특' });
expect('행특 300자 초과', ids(r).includes('length') && r.maxBytes === 900, ids(r));
r = check('가'.repeat(300), { area: '행특' });
expect('행특 300자는 통과', !ids(r).includes('length'), ids(r));

// 줄바꿈으로 끊긴 문장 (표 칸·스캔본)
r = check('실망하지 않고 끝까지 최선을 다\n함. 친구와 협력함.', { area: '행특' });
expect('줄이 바뀐 문장은 이어서 봄', !ids(r).includes('ai-ending'), JSON.stringify(r.findings));
r = check('실험에 적극적으로 참여하였\n다.', { area: '행특' });
expect('줄이 바뀌어도 ~다. 종결은 잡음', ids(r).includes('ai-ending'), ids(r));
// 스캔본 모드
r = check('현장체험학습(2026.05.20)에 참여함. **', { area: '창체_자율자치', ocr: true });
expect('스캔본: 온점 누락·서식 기호는 빼기', !ids(r).includes('ai-markdown') && !r.findings.some((f) => /온점/.test(f.메시지)), JSON.stringify(r.findings));
r = check('교내 토론대회에 참여함. 봉사(2026.03.04~2026.07.08.)', { area: '창체_자율자치', ocr: true });
expect('스캔본: 금지는 그대로, 형식은 확인으로', r.findings.find((f) => f.ruleId === 'contest').심각도 === '금지' && r.findings.find((f) => f.ruleId === 'date-format').심각도 === '확인', JSON.stringify(r.findings.map((f) => [f.ruleId, f.심각도])));

r = check('2022.09.02. - 2022.09.30. (학교)가상학교 에너지감시단 활동', { area: '' });
expect('나이스 봉사 표의 기간(띄어쓰기)은 통과', !ids(r).includes('date-format'), JSON.stringify(r.findings));
r = check('봉사활동(2026.03.04. - 2026.07.08.)에 참여함.', { area: '창체_자율자치' });
expect('괄호 안 기간 띄어쓰기는 잡음', ids(r).includes('date-format'), ids(r));

// 초등학교
const elem = areasFor(rules, '초등학교');
expect('초등: 행특 글자수 제한 없음', elem.find((a) => a.id === '행특').maxBytes === null);
expect('초등: 출결 특기사항 500자', elem.find((a) => a.id === '출결_특기사항').maxChars === 500);
expect('초등: 자율·자치·동아리 통합 이름', /통합/.test(elem.find((a) => a.id === '창체_자율자치').label));
r = check('가'.repeat(400), { level: '초등학교', area: '행특' });
expect('초등 행특 400자도 통과', !ids(r).includes('length'), ids(r));
r = check('YBM 영어 인증에 응시함.', { level: '초등학교', area: '행특' });
expect('초등: YBM 금지', ids(r).includes('lang-test'), ids(r));
r = check('학급 반장(2026.03.02.-2026.07.24.)으로 활동함.', { level: '초등학교', area: '창체_자율자치', grade: 5 });
expect('초등 5학년 임원: 학년말 확인', ids(r).includes('officer-term-end'), ids(r));
r = check('학급 반장(2026.03.02.-2027.01.08.)으로 활동함.', { level: '초등학교', area: '창체_자율자치', grade: 6 });
expect('초등 6학년(마지막 학년)은 졸업일까지', !ids(r).includes('officer-term-end'), ids(r));

// 유사도
const a = '실험 보고서를 작성하며 변인 통제의 중요성을 이해하고 결과를 그래프로 정리하여 발표함.';
const b = '실험 보고서를 작성하며 변인 통제의 중요성을 이해하고 결과를 표로 정리하여 발표함.';
expect('유사도: 거의 같은 세특 0.7 이상', similarity(a, b) >= 0.7, similarity(a, b));
expect('유사도: 다른 세특 0.3 미만', similarity(a, '시를 낭송하며 운율과 정서를 표현하는 방법을 익힘.') < 0.3);

console.log(fail ? `${fail} FAIL` : 'ALL PASS');
process.exit(fail ? 1 : 0);
