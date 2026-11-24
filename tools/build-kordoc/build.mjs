import * as esbuild from 'esbuild';
import { isBuiltin } from 'node:module';
import path from 'node:path';
const stub = path.resolve('shims/stub.cjs');
const zlib = path.resolve('shims/zlib.js');
const heavy = /^(sharp|onnxruntime-node|onnxruntime-web|onnxruntime-common|canvas|@napi-rs\/canvas|pdfjs-dist|tesseract|@modelcontextprotocol|commander|playwright|puppeteer)(\/|$)/;
const plugin = {
  name: 'browserize',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (a.path === 'zlib' || a.path === 'node:zlib') return { path: zlib };
      if (a.path === 'buffer' || a.path === 'node:buffer') return { path: path.resolve('node_modules/buffer/index.js') };
      if (isBuiltin(a.path) || a.path.startsWith('node:') || heavy.test(a.path)) return { path: stub };
      return null;
    });
  },
};
const patchKordoc = {
  name: 'patch-kordoc-nodestream',
  setup(b) {
    // kordoc은 HWPX(zip) 항목을 jszip nodeStream으로 읽는데, 브라우저 jszip에는 nodeStream이 없다.
    // 같은 동작(data → end 이벤트)을 file.async('uint8array')로 흉내 낸다. 압축 해제 크기 제한 검사는 그대로 유지된다.
    b.onLoad({ filter: /kordoc[\\/]dist[\\/].*\.js$/ }, async (a) => {
      const fs = await import('node:fs');
      let src = fs.readFileSync(a.path, 'utf8');
      src = src.replaceAll('const stream = file.nodeStream("nodebuffer");',
        'const stream = (() => { const h = {}; const s = { on(ev, fn) { h[ev] = fn; return s; }, pause() {} }; file.async("uint8array").then((u) => { const b = Buffer.from(u); if (h.data) h.data(b); if (h.end) h.end(); }, (e) => { if (h.error) h.error(e); }); return s; })();');
      return { contents: src, loader: 'js', resolveDir: path.dirname(a.path) };
    });
  },
};
const r = await esbuild.build({
  entryPoints: ['entry.js'], bundle: true, format: 'esm', platform: 'browser', minify: true,
  outfile: 'out/kordoc-browser.mjs', plugins: [plugin, patchKordoc], inject: ['shims/inject.js'],
  define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' }, logLevel: 'error', metafile: true,
});
console.log(Object.entries(r.metafile.outputs).map(([k, v]) => k + ' ' + (v.bytes / 1024).toFixed(0) + 'KB').join('\n'));
