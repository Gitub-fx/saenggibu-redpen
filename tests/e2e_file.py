# 파일 점검 화면 시험 (Playwright): python3 -m http.server 8765 실행 후
# python3 tests/e2e_file.py sample  또는  python3 tests/e2e_file.py samples/가상학생_학생부_샘플.hwpx
import asyncio, sys
from playwright.async_api import async_playwright
async def m(path, shot):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1280,'height':900}); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)[:300])); pg.on('console',lambda m: errs.append(m.text[:200]) if m.type=='error' else None)
        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(800)
        if path in ('sample','samplePdf','sampleClass'): await pg.click('#'+path)
        else: await pg.set_input_files('#file', path)
        await pg.wait_for_function("document.querySelector('#fileResult h3') || document.querySelector('#fileResult .bad')", timeout=400000)
        print(await pg.inner_text('#fileResult'))
        print('errors', errs)
        if shot: await pg.locator('#filecheck').screenshot(path=shot)
        await b.close()
asyncio.run(m(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else None))
