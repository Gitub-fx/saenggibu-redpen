// 개인정보 가리기: 점검 결과 화면과 내려받는 파일에 개인정보가 드러나지 않게 한다.
// 원문은 브라우저 메모리에만 있고, 화면에는 가린 글만 보여 준다.

const DOT = '●';
const fill = (s) => s.replace(/[^\s\-.()]/g, DOT);

const RULES = [
  { id: '주민등록번호', re: /\b\d{6}\s?-\s?[1-8]\d{6}\b/g, mask: (m) => m.slice(0, 7).replace(/\s/g, '') + DOT.repeat(7) },
  { id: '전화번호', re: /\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, mask: (m) => m.replace(/(\d{3,4})([-.\s]?\d{4})$/, (x, a, b) => DOT.repeat(a.length) + b) },
  { id: '이메일', re: /[\w.+-]+@[\w-]+\.[\w.]+/g, mask: (m) => DOT.repeat(m.indexOf('@')) + m.slice(m.indexOf('@')) },
];

// 이름표 뒤의 값: "성명 홍길동", "주소: 충청북도 …", "보호자 홍판서"
const LABELS = [
  { id: '성명', re: /(?<=^|\s|[|(])((?:학생\s*)?성\s*명|보\s*호\s*자(?:\s*성\s*명)?|[부모]\s*성\s*명)(\s*[:：]?\s*)([가-힣]{2,5})(?=[\s,)|]|$)/gm },
  { id: '성명', re: /(?<=^|\s{2}|[|(])(이\s*름)(\s*[:：]?\s*)([가-힣]{2,5})(?=[\s,)|]|$)/gm },
  // 쪽 아래 머리글처럼 구분자(/ :)가 분명한 경우: "이름 / 김하늘", "성명 : 김하늘"
  { id: '성명', re: /(이\s*름|성\s*명)(\s*[:：/]\s*)([가-힣]{2,5}|[가-힣]0{1,3})(?=[\s,)|/]|$)/gm },
  { id: '주소', re: /(?<=^|\s{2}|[|(])(주\s*소)(\s*[:：]?\s*)([^\n]{4,80})/gm },
];

/**
 * @param {string} text
 * @param {string[]} names 선생님이 입력한 학생 이름(선택)
 * @returns {{ text: string, hits: { id: string, count: number }[] }}
 */
export function maskPersonal(text, names = []) {
  const count = {};
  const bump = (id) => { count[id] = (count[id] || 0) + 1; };
  let out = text;
  for (const r of RULES) out = out.replace(r.re, (m) => { bump(r.id); return r.mask(m); });
  for (const l of LABELS) {
    out = out.replace(l.re, (m, label, sep, value) => {
      if (/^(학년|학교|반|번호|과목|영역|활동|상황)$/.test(value)) return m;
      bump(l.id);
      return label + sep + fill(value);
    });
  }
  for (const n of names.map((s) => s.trim()).filter((s) => s.length >= 2)) {
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, (m) => { bump('입력한 이름'); return m[0] + DOT.repeat(m.length - 1); });
  }
  return { text: out, hits: Object.entries(count).map(([id, c]) => ({ id, count: c })) };
}
