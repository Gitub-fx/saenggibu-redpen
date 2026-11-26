# 함께 쓰는 오픈소스

| 이름 | 쓰는 곳 | 라이선스 |
|---|---|---|
| [pdf.js](https://github.com/mozilla/pdf.js) 4.10.38 | `vendor/pdfjs/` PDF 글자 읽기 | Apache-2.0 |
| [kordoc](https://www.npmjs.com/package/kordoc) 4.22.13 | `vendor/kordoc-browser.mjs` 한글(HWP·HWPX) 읽기 | MIT |
| [cfb](https://github.com/SheetJS/js-cfb) | kordoc 묶음 안 (HWP 컨테이너) | Apache-2.0 |
| [JSZip](https://github.com/Stuk/jszip) | kordoc 묶음 안 (HWPX 압축) | MIT |
| [@xmldom/xmldom](https://github.com/xmldom/xmldom) | kordoc 묶음 안 (HWPX XML) | MIT |
| [fflate](https://github.com/101arrowz/fflate) | kordoc 묶음 안 (압축 해제) | MIT |
| [buffer](https://github.com/feross/buffer) | kordoc 묶음 안 | MIT |

`vendor/kordoc-browser.mjs`는 `tools/build-kordoc/`에서 `npm install && npm run build`로 다시 만들 수 있습니다. Node 전용 기능(zlib, fs 등)을 브라우저용으로 바꿔 끼우고, HWPX 압축 해제(jszip nodeStream)를 브라우저 방식으로 고쳐 묶었습니다.
| [tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1, tesseract.js-core 5.1.1 | `vendor/tesseract/` 스캔한 PDF 글자 인식 | Apache-2.0 |
| [tessdata 한국어 학습 데이터](https://github.com/tesseract-ocr/tessdata) (4.0.0_best_int) | `vendor/tesseract/lang/kor.traineddata.gz` | Apache-2.0 |
