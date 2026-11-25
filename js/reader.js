// 파일 읽기: PDF(pdf.js), HWP·HWPX(kordoc 브라우저 묶음)
// 파일은 선생님 브라우저 메모리 안에서만 읽고, 어디로도 보내지 않는다.

const VENDOR = new URL('../vendor/', import.meta.url);

export class ReadError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function detectKind(name, bytes) {
  const head = new Uint8Array(bytes.slice(0, 8));
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'; // %PDF
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return 'hwp'; // OLE2
  if (head[0] === 0x50 && head[1] === 0x4b) return ext === 'hwpx' ? 'hwpx' : 'zip';
  if (['pdf', 'hwp', 'hwpx'].includes(ext)) return ext;
  return 'unknown';
}

/** PDF → 줄 단위 텍스트 (같은 높이의 글자를 한 줄로 모음) */
async function readPdf(bytes) {
  const pdfjs = await import(new URL('pdfjs/pdf.min.mjs', VENDOR).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', VENDOR).href;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new ReadError('password', '암호가 걸린 PDF입니다. 암호를 푼 파일로 다시 넣어 주세요.');
    throw new ReadError('broken', 'PDF 파일을 열 수 없습니다. 파일이 손상되었는지 확인해 주세요.');
  }
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str, w: it.width || 0 });
    }
    const lines = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      let line = '', lastEnd = null;
      for (const it of items) {
        if (lastEnd !== null && it.x - lastEnd > 12) line += '  ';
        else if (lastEnd !== null && it.x - lastEnd > 1.5 && !line.endsWith(' ')) line += ' ';
        line += it.s;
        lastEnd = it.x + it.w;
      }
      return line.trimEnd();
    });
    pages.push(lines.join('\n'));
  }
  const text = pages.join('\n');
  if (text.replace(/\s/g, '').length < 20 * doc.numPages) {
    throw new ReadError('no-text', '글자 정보가 없는 PDF입니다(스캔본 등). 나이스에서 PDF로 다시 저장해 주세요.');
  }
  return { text, pageCount: doc.numPages };
}

/** kordoc 마크다운 → 점검용 평문 (표 칸은 줄로) */
function markdownToPlain(md) {
  return md
    .replace(/<\/(td|th)>/gi, '  ')
    .replace(/<\/tr>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, '')
    .replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, '')
    .replace(/[ \t]*\|[ \t]*/g, '  ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\([~*_|#\-.()[\]])/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readHwp(bytes) {
  const K = await import(new URL('kordoc-browser.mjs', VENDOR).href);
  let r;
  try {
    r = await K.parse(bytes);
  } catch (e) {
    throw new ReadError('broken', '한글 파일을 열 수 없습니다. 파일이 손상되었는지 확인해 주세요.');
  }
  if (!r || !r.success) {
    const msg = (r && r.error) || '';
    if (/암호|password|encrypt|DRM/i.test(msg)) throw new ReadError('password', '암호나 보안(DRM)이 걸린 한글 파일입니다. 보안을 푼 파일로 다시 넣어 주세요.');
    throw new ReadError('broken', '한글 파일을 읽지 못했습니다. 한글에서 다시 저장한 뒤 넣어 주세요.');
  }
  return { text: markdownToPlain(r.markdown || ''), markdown: r.markdown || '', pageCount: r.pageCount || null };
}

/**
 * @param {File} file
 * @returns {Promise<{ name: string, kind: string, text: string, pageCount: number|null }>}
 */
export async function readFile(file) {
  const MAX = 30 * 1024 * 1024;
  if (file.size > MAX) throw new ReadError('too-big', '파일이 30MB보다 큽니다. 학급 단위로 나눠 출력해 주세요.');
  const bytes = await file.arrayBuffer();
  const kind = detectKind(file.name, bytes);
  if (kind === 'pdf') return { name: file.name, kind, ...(await readPdf(bytes)) };
  if (kind === 'hwp' || kind === 'hwpx') return { name: file.name, kind, ...(await readHwp(bytes)) };
  throw new ReadError('unsupported', 'PDF, 한글(.hwp, .hwpx) 파일만 점검할 수 있습니다.');
}
