# 생기부 빨간펜

학년말에 나이스에서 출력한 학교생활기록부(PDF)를 넣으면, 2026 학교생활기록부 기재요령에 따라 기재 금지어·일자 표기·글자수·AI 흔적 등을 점검해 주는 선생님용 웹앱입니다.

- 학생부 파일은 브라우저 안에서만 읽고 점검합니다. 서버로 보내거나 저장하지 않습니다.
- 2026-2 「AI 에이전트 개발」 기말과제로 개발 중입니다.
- 배포 주소: https://gitub-fx.github.io/saenggibu-redpen/

## 폴더
- `screenshots/` 고치기 전/후 화면
- `PROMPTS.md` AI에게 한 요청 기록
- `CHECKLIST.md` 고친 항목 정리

## 점검 엔진
- `js/engine.js`: 규칙표(`data/rules.json`)로 문장을 점검하는 엔진. 브라우저 안에서만 동작
- 시험: `node tests/rules.test.mjs`, `node tests/engine.test.mjs`

## 파일 점검 (PDF · 한글)
- 나이스 출력 PDF, 한글(.hwp, .hwpx) 파일을 넣으면 브라우저 안에서 글자를 꺼내 영역별로 점검
- 주민등록번호·성명·주소·연락처·이메일은 자동으로 가려서 화면에 보여 줌 (`js/mask.js`)
- 가상 학생 샘플: `samples/가상학생_학생부_샘플.pdf`, `samples/가상학생_학생부_샘플.hwpx` (실제 학생 아님)
- 사용한 오픈소스: `THIRD_PARTY_NOTICES.md`
