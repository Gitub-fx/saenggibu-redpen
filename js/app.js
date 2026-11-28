// 화면 동작: 문장 점검, 파일 점검, 결과 그리기
import { createChecker, neisBytes, similarity } from './engine.js';
import { readFile, ReadError } from './reader.js';
import { analyzeDocument } from './analyze.js';

const $ = (id) => document.getElementById(id);
let checker;

async function load() {
  try {
    const [rules, orgs] = await Promise.all([
      fetch('./data/rules.json').then((r) => r.json()),
      fetch('./data/allowed_orgs.json').then((r) => r.json()),
    ]);
    checker = createChecker(rules, orgs);
    fillAreas();
  } catch (e) {
    $('result').innerHTML = '<p class="bad">규칙을 불러오지 못했습니다. 새로고침 해 주세요.</p>';
  }
}

function fillAreas() {
  const areas = checker.areas($('level').value);
  $('area').innerHTML = areas.map((a) => `<option value="${a.id}" data-max="${a.maxBytes || ''}">${a.label} (${a.maxChars ? a.maxChars + '자' : '글자수 제한 없음'})</option>`).join('');
  fillGrades('grade', $('level').value);
  updateCounter();
}

function fillGrades(id, level) {
  const n = level === '초등학교' ? 6 : 3, sel = $(id), cur = sel.value;
  sel.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${i + 1}학년</option>`).join('');
  if (Number(cur) <= n) sel.value = cur;
}

function updateCounter() {
  const opt = $('area').selectedOptions[0];
  const max = opt && opt.dataset.max ? Number(opt.dataset.max) : 0;
  const b = neisBytes($('input').value);
  $('counter').textContent = max ? `${b} / ${max} byte` : `${b} byte (글자수 제한 없음)`;
  $('counter').className = 'counter' + (max && b > max ? ' over' : '');
}

function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function highlight(text, findings) {
  const marks = findings.filter((f) => f.end > f.start).sort((a, b) => a.start - b.start);
  let out = '', pos = 0;
  for (const f of marks) {
    if (f.start < pos) continue;
    out += esc(text.slice(pos, f.start)) + `<mark class="${f.심각도}" title="${esc(f.항목)}">${esc(text.slice(f.start, f.end))}</mark>`;
    pos = f.end;
  }
  return out + esc(text.slice(pos));
}

function run() {
  if (!checker) return;
  const text = $('input').value;
  if (!text.trim()) { $('result').innerHTML = '<p class="note">점검할 문장을 입력칸에 붙여넣은 뒤 다시 눌러 주세요.</p>'; $('input').focus(); return; }
  const { findings, bytes, maxBytes } = checker.check(text, {
    level: $('level').value, area: $('area').value, grade: Number($('grade').value),
  });
  const count = (s) => findings.filter((f) => f.심각도 === s).length;
  let html = `<h3>점검 결과</h3><p>금지 ${count('금지')}건 · 형식 ${count('형식')}건 · 확인 ${count('확인')}건 · ${maxBytes ? `${bytes}/${maxBytes} byte` : `${bytes} byte (글자수 제한 없음)`}</p>`;
  if (!findings.length) html += '<p class="ok">교정할 곳을 찾지 못했습니다. 내용이 사실과 맞는지, 학생의 특성이 드러나는지는 직접 확인해 주세요.</p>';
  html += `<div class="marked">${highlight(text, findings)}</div><ul>`;
  for (const f of findings) {
    html += `<li><b class="${f.심각도}">[${f.심각도}] ${esc(f.항목)}</b>${f.match ? ` — “${esc(f.match)}”` : ''}<br><small>${esc(f.메시지)} (근거: ${esc(f.근거 || '')})</small></li>`;
  }
  $('result').innerHTML = html + '</ul>';
}

$('level').addEventListener('change', fillAreas);
$('fileLevel').addEventListener('change', () => fillGrades('fileGrade', $('fileLevel').value));
$('area').addEventListener('change', updateCounter);
$('input').addEventListener('input', updateCounter);
$('run').addEventListener('click', run);
$('speller').addEventListener('click', async () => {
  const text = $('input').value.trim();
  if (!text) { $('spellerNote').textContent = '먼저 검사할 문장을 입력해 주세요.'; return; }
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch (e) { /* 복사 권한이 없으면 안내만 */ }
  window.open('https://nara-speller.co.kr/speller/', '_blank', 'noopener');
  $('spellerNote').textContent = copied
    ? '문장을 복사했습니다. 새로 열린 바른한글 창의 입력칸에 붙여넣기(Ctrl+V) 후 [검사하기]를 누르세요.'
    : '복사하지 못했습니다. 입력칸의 문장을 직접 복사(Ctrl+A, Ctrl+C)해 바른한글 창에 붙여넣어 주세요.';
});
// ---- 파일 점검 ----
const fileOut = $('fileResult');
function renderFindings(text, findings) {
  let html = `<div class="marked">${highlight(text, findings)}</div><ul>`;
  for (const f of findings) {
    html += `<li><b class="${f.심각도}">[${f.심각도}] ${esc(f.항목)}</b>${f.match ? ` — “${esc(f.match.slice(0, 60))}”` : ''}<br><small>${esc(f.메시지)} (근거: ${esc(f.근거 || '')})</small></li>`;
  }
  return html + '</ul>';
}
async function checkFile(file) {
  if (!checker) { fileOut.innerHTML = '<p class="bad">규칙을 아직 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>'; return; }
  fileOut.innerHTML = `<p>“${esc(file.name)}” 읽는 중…</p>`;
  let doc;
  try {
    doc = await readFile(file, {
      allowOcr: true,
      onPage: ({ page, total }) => { fileOut.innerHTML = `<p>스캔한 PDF라서 글자를 인식하는 중… (${page}/${total}쪽)<br><small>한 쪽에 몇 초씩 걸립니다. 파일은 이 컴퓨터 안에서만 처리합니다.</small></p>`; },
    });
  } catch (e) {
    const msg = e instanceof ReadError ? e.message : '파일을 읽는 중 문제가 생겼습니다. 다시 시도해 주세요.';
    fileOut.innerHTML = `<p class="bad">${esc(msg)}</p>`; return;
  }
  const names = $('names').value.split(',').map((x) => x.trim()).filter(Boolean);
  const result = analyzeDocument(doc, checker, { level: $('fileLevel').value, grade: Number($('fileGrade').value), names });
  renderResult(result);
}

function renderUnits(units) {
  let html = '', current = '';
  for (const u of units) {
    if (u.section !== current && u.label !== u.section) { html += `<h4 class="sec-title">${esc(u.section)}</h4>`; current = u.section; }
    const c = (s) => u.findings.filter((f) => f.심각도 === s).length;
    const bytes = u.maxBytes ? ` · ${u.bytes}/${u.maxBytes} byte` : '';
    html += `<details class="sec" ${u.findings.length ? 'open' : ''}><summary><b>${esc(u.label)}</b> — 금지 ${c('금지')} · 형식 ${c('형식')} · 확인 ${c('확인')}${bytes}</summary>${renderFindings(u.text, u.findings)}</details>`;
  }
  return html;
}

function renderResult(r) {
  const T = r.total;
  const hidden = r.hidden.map((h) => `${h.id} ${h.count}건`).join(', ') || '없음';
  let html = `<h3>“${esc(r.name)}” 점검 결과</h3>
    ${r.ocr ? '<p class="warn">스캔한 PDF라서 글자 인식(OCR)으로 읽었습니다. 인식 오류(예: 실천→실친)가 섞일 수 있으니, 표시된 곳은 원본과 대조해 주세요. 가장 정확한 점검은 나이스에서 PDF·한글로 저장한 파일로 할 수 있습니다.</p>' : ''}
    <p>${r.kind.toUpperCase()}${r.ocr ? '(스캔·글자 인식)' : ''}${r.pageCount ? ` · ${r.pageCount}쪽` : ''} · 학생 ${r.students.length}명 · 금지 ${T.금지}건 · 형식 ${T.형식}건 · 확인 ${T.확인}건</p>
    <p class="note">${r.mode === 'record' ? '표의 칸(과목별 세특, 창체 영역, 출결 특기사항, 행특 등)마다 따로 점검했습니다. ' : ''}가린 개인정보: ${esc(hidden)}</p>`;
  if (r.students.length > 1) {
    html += '<table class="summary"><thead><tr><th>학생</th><th>금지</th><th>형식</th><th>확인</th><th></th></tr></thead><tbody>';
    r.students.forEach((st, i) => {
      html += `<tr><td>${esc(st.label)}</td><td class="n 금지">${st.total.금지}</td><td class="n 형식">${st.total.형식}</td><td class="n 확인">${st.total.확인}</td><td><a href="#st-${i}">보기</a></td></tr>`;
    });
    html += '</tbody></table>';
    r.students.forEach((st, i) => {
      html += `<details class="student" id="st-${i}"><summary><b>${esc(st.label)}</b> — 금지 ${st.total.금지} · 형식 ${st.total.형식} · 확인 ${st.total.확인}</summary>${renderUnits(st.units)}</details>`;
    });
  } else {
    html += renderUnits(r.students[0].units);
  }
  fileOut.innerHTML = html;
  fileOut.querySelectorAll('.summary a').forEach((a) => a.addEventListener('click', (e) => {
    const d = document.querySelector(a.getAttribute('href'));
    if (d) d.open = true;
  }));
}

$('file').addEventListener('change', (e) => { if (e.target.files[0]) checkFile(e.target.files[0]); });
const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) checkFile(f); });
async function loadSample(name) {
  try {
    const blob = await fetch('./samples/' + encodeURIComponent(name)).then((r) => { if (!r.ok) throw new Error(); return r.blob(); });
    checkFile(new File([blob], name));
  } catch (e) { fileOut.innerHTML = '<p class="bad">샘플 파일을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>'; }
}
$('sample').addEventListener('click', () => loadSample('가상학생_전공과_학생부.hwpx'));
$('samplePdf').addEventListener('click', () => loadSample('가상학생_학생부_샘플.pdf'));
$('sampleClass').addEventListener('click', () => loadSample('가상_반전체_학생부.hwpx'));

// 탭: 파일 점검 / 문장 점검
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next); next.focus();
  });
});

load();
  
