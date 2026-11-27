// 학생별 분리·학생 간 동일 기재 시험: node tests/analyze.test.mjs
import fs from 'fs';
import { analyzeDocument, splitStudents, studentNumber } from '../js/analyze.js';
import { createChecker } from '../js/engine.js';
const rules = JSON.parse(fs.readFileSync(new URL('../data/rules.json', import.meta.url), 'utf8'));
const orgs = JSON.parse(fs.readFileSync(new URL('../data/allowed_orgs.json', import.meta.url), 'utf8'));
const checker = createChecker(rules, orgs);
let fail = 0;
const t = (name, cond, d = '') => { if (!cond) fail++; console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : d); };

const md = fs.readFileSync(new URL('./fixtures/neis_hwp_반전체_가상.md', import.meta.url), 'utf8');
const chunks = splitStudents(md);
t('3명으로 나누기', chunks.length === 3, chunks.length);
t('번호 읽기', chunks.map(studentNumber).join(',') === '5,6,7', chunks.map(studentNumber));

const r = analyzeDocument({ name: '반전체.hwpx', kind: 'hwpx', markdown: md, text: '' }, checker, { names: [] });
t('칸 단위 모드', r.mode === 'record', r.mode);
t('학생 이름표', r.students.map((s) => s.label).join(',') === '5번 학생,6번 학생,7번 학생', r.students.map((s) => s.label));
const dup = r.students[1].units.find((u) => u.label === '1학년 1학기 목공예').findings.find((f) => f.ruleId === 'dup-student');
t('6번 목공예 = 5번 목공예 (학생 간 동일)', dup && /5번 학생/.test(dup.메시지), JSON.stringify(dup));
const s3 = r.students[2].units.find((u) => u.label === '1학년 1학기 목공예');
t('7번 목공예는 다름', !s3.findings.some((f) => f.ruleId === 'dup-student'), JSON.stringify(s3.findings));
const att6 = r.students[1].units.find((u) => u.area === '출결_특기사항');
t('6번 출결 3일=3일 통과', !att6.findings.some((f) => f.ruleId === 'attend-sum'), JSON.stringify(att6.findings));
const att5 = r.students[0].units.find((u) => u.area === '출결_특기사항');
t('5번 출결 3일≠1일', att5.findings.some((f) => f.ruleId === 'attend-sum'));
const json = JSON.stringify(r);
t('결과에 이름이 없음', !/가상인|나상인|다상인/.test(json));

// 한 학생 PDF(섹션 모드)
const one = analyzeDocument({ name: 'a.pdf', kind: 'pdf', text: '1. 인적·학적사항\n성명 김가상\n6. 창의적 체험활동상황\n교내 토론대회에 참여함.', rawText: '' }, checker, {});
t('한 학생 PDF', one.students.length === 1 && one.mode === 'sections' && one.total.금지 === 1, JSON.stringify(one.total));
console.log(fail ? `${fail} FAIL` : 'ALL PASS'); process.exit(fail ? 1 : 0);
