"""기재요령 [참고자료 5] 시도교육청·교육지원청 직속(소속)기관 현황(Markdown 변환본)에서
기관명 목록을 뽑아 JSON으로 저장한다.

사용법: python3 tools/extract_orgs.py <참고자료5.md> data/allowed_orgs.json
"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding='utf-8').read()
names = set()
office = None
by_office = {}
for line in text.splitlines():
    m = re.match(r'^##\s+(\S+교육청)\s*$', line)
    if m:
        office = m.group(1)
        by_office.setdefault(office, set()).add(office)
        continue
    if office is None:
        continue
    line = re.sub(r'<[^>]+>', ',', line)
    for part in re.split(r'[,|]', line):
        n = re.sub(r'\(\d+\)개|[\s\\*]', '', part)
        if len(n) >= 4 and re.search(r'(교육청|교육지원청|원|관|센터|회관|본부|학교|도서관|연구소|학원|캠프|수련원|교육원|과학관|미술관|박물관|체육관|진흥원)$', n) and not re.search(r'(교육지원청명|소속기관|직속기관|없음)', n):
            by_office[office].add(n)
            names.add(n)
moe = ['교육부', '대한민국학술원', '국사편찬위원회', '국립국제교육원', '국립특수교육원', '교원소청심사위원회', '중앙교육연수원']
data = {
    '설명': '교육관련기관(교육부 및 소속기관, 시도교육청 및 직속기관, 교육지원청 및 소속기관) — 기관명 입력 가능',
    '근거': '2026 학교생활기록부 기재요령 II. 기재 시 유의사항 3-타-1), [참고자료 5] (2026.03. 기준)',
    '교육부_및_소속기관': moe,
    '시도교육청별': {k: sorted(v) for k, v in sorted(by_office.items())},
}
json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(by_office), 'offices,', len(names), 'names')
