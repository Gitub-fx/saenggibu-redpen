// 스캔한 PDF(글자 정보가 없는 이미지 PDF)를 브라우저 안에서 글자 인식(OCR)한다.
// tesseract.js(한국어 학습 데이터)를 vendor/tesseract 에서 불러오며, 이미지는 밖으로 보내지 않는다.

const BASE = new URL('../vendor/tesseract/', import.meta.url);

let workerPromise = null;
async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const T = await import(new URL('tesseract.esm.min.js', BASE).href);
      const createWorker = T.createWorker || (T.default && T.default.createWorker);
      return createWorker('kor', 1, {
        workerPath: new URL('worker.min.js', BASE).href,
        corePath: new URL('core/', BASE).href,
        langPath: new URL('lang/', BASE).href,
        gzip: true,
        workerBlobURL: false,
        logger: (m) => onProgress && onProgress({ stage: m.status, progress: m.progress }),
      });
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

/**
 * pdf.js 문서의 각 쪽을 그림으로 그려 글자 인식
 * @param {object} doc pdf.js PDFDocumentProxy
 * @param {(p: {page: number, total: number}) => void} onPage
 * @returns {Promise<string[]>} 쪽별 글
 */
export async function ocrPdf(doc, onPage) {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    if (onPage) onPage({ page: p, total: doc.numPages });
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 200 / 72 }); // 약 200dpi
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = await worker.recognize(canvas);
    pages.push(cleanOcr(data.text));
    canvas.width = canvas.height = 0;
  }
  return pages;
}

/** 글자 인식 결과 다듬기: 글자 사이 낀 공백, 표 테두리가 글자로 잡힌 것 */
export function cleanOcr(t) {
  return t
    .replace(/[|¦]/g, ' ')
    .replace(/^[\s'"‘’`.,:;_\-~]+(?=\S)/gm, '')
    .replace(/[ \t]{2,}/g, '  ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}
