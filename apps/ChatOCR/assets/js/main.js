/**
 * main.js — Entry point. Wires composer, file drop, intents, settings modal,
 * export menu, clear. Bootstraps welcome state + ribbon.
 */
import { initTheme } from './theme.js';
import { PROVIDERS, getKey, setKey, bindSettings, getPrefs, setPrefs, DEFAULTS, modelsWithCap, CAP } from './config.js';
import { attachRibbon } from './ui-wrapper.js';
import * as chat from './chat.js';
import { toast } from './ui.js';

let dom = {};

function init() {
  dom = {
    stream: document.getElementById('stream'),
    composer: document.getElementById('composer'),
    textarea: document.getElementById('composerInput'),
    sendBtn: document.getElementById('sendBtn'),
    fileBtn: document.getElementById('fileBtn'),
    fileInput: document.getElementById('fileInput'),
    attachRow: document.getElementById('attachRow'),
    intents: document.getElementById('intents'),
    ribbon: document.getElementById('ribbon'),
    formatSegs: document.querySelectorAll('.format-seg'),
    ocrModelSel: document.getElementById('ocrModelSel'),
    settingsBtn: document.getElementById('settingsBtn'),
    clearBtn: document.getElementById('clearBtn'),
    exportBtn: document.getElementById('exportBtn'),
    galleryLink: document.getElementById('galleryLink'),
  };

  initTheme();
  const ribbon = attachRibbon(dom.ribbon);
  chat.setRibbon(ribbon);

  initComposer();
  initFileUpload();
  initIntents();
  initFormatSegs();
  initModelSelect();
  initSettings();
  initExport();
  initClear();

  if (window.location.protocol === 'file:') showFileWarn();

  // welcome
  renderWelcome();
}

function showFileWarn() {
  const w = document.createElement('div');
  w.className = 'file-warn';
  w.innerHTML = '⚠️ 当前以 file:// 打开，ES 模块无法加载。请用本地 HTTP 访问，例如在仓库根目录运行 <code>python3 -m http.server</code> 后访问 <code>http://localhost:8000/apps/ChatOCR/</code>';
  document.querySelector('.app')?.prepend(w);
}

function renderWelcome() {
  const row = document.createElement('div');
  row.className = 'msg ai';
  row.innerHTML = `
    <div class="avatar">C</div>
    <div class="msg-inner">
      <div class="bubble">
        <div class="md">
          <p>你好。上传图片我来<strong>OCR 识别</strong>，或直接告诉我你想做什么 —— 系统会自动选择最合适的引擎：</p>
          <ul>
            <li>📎 丢一张发票/文档/截图 → 识别文字、表格、转 Markdown</li>
            <li>💬 识别完直接追问「总额多少？」「概括一下」</li>
            <li>🎨 说「画一张…」→ 生成图片</li>
            <li>🎬 说「做个…视频」→ 生成视频</li>
            <li>🔍 问需要联网的问题 → 联网搜索</li>
          </ul>
          <p style="color:var(--text-faint);font-size:13px">路由栏会实时显示当前选用的工具与模型。</p>
        </div>
      </div>
    </div>`;
  dom.stream.appendChild(row);
}

/* ---------- Composer ---------- */
function initComposer() {
  dom.sendBtn.addEventListener('click', handleSend);
  dom.textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  dom.textarea.addEventListener('input', () => {
    dom.textarea.style.height = 'auto';
    dom.textarea.style.height = Math.min(160, dom.textarea.scrollHeight) + 'px';
  });
}

async function handleSend() {
  const text = dom.textarea.value;
  dom.textarea.value = '';
  dom.textarea.style.height = 'auto';
  await chat.send(text, { container: dom.stream });
}

/* ---------- File upload ---------- */
function initFileUpload() {
  dom.fileBtn.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  // drag-drop on composer
  const drop = dom.composer;
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.style.borderColor = 'var(--accent)';
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.style.borderColor = '';
  }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
}

function handleFile(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
  if (!allowed.includes(file.type)) { toast('仅支持 PNG/JPG/WEBP/GIF/PDF', 'error'); return; }
  if (file.size > 12 * 1024 * 1024) { toast('文件过大（>12MB），请压缩后上传', 'error'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const base64 = dataUrl.split(',')[1];
    chat.setPendingImage({ mimeType: file.type, base64, dataUrl, name: file.name });
    renderAttach(file, dataUrl);
  };
  reader.readAsDataURL(file);
  dom.fileInput.value = '';
}

function renderAttach(file, dataUrl) {
  dom.attachRow.innerHTML = '';
  const chip = document.createElement('div');
  chip.className = 'attach-chip';
  const preview = file.type.startsWith('image/')
    ? `<img src="${dataUrl}">`
    : `<span style="display:inline-flex;width:28px;height:28px;border-radius:6px;background:var(--bg-secondary);align-items:center;justify-content:center;font-size:13px">📄</span>`;
  chip.innerHTML = `${preview}<span class="nm">${file.name}</span><span class="rm" title="移除">✕</span>`;
  chip.querySelector('.rm').addEventListener('click', () => {
    chat.clearPendingImage();
    dom.attachRow.innerHTML = '';
  });
  dom.attachRow.appendChild(chip);
}

/* ---------- Intent chips ---------- */
function initIntents() {
  dom.intents.addEventListener('click', (e) => {
    const b = e.target.closest('.intent');
    if (!b) return;
    dom.textarea.value = b.dataset.prompt || '';
    dom.textarea.focus();
    dom.textarea.dispatchEvent(new Event('input'));
  });
}

/* ---------- OCR format + model selectors ---------- */
function initFormatSegs() {
  const prefs = getPrefs();
  dom.formatSegs.forEach(s => {
    if (s.dataset.format === (prefs.ocrFormat || DEFAULTS.ocrFormat)) s.classList.add('active');
    s.addEventListener('click', () => {
      dom.formatSegs.forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      setPrefs({ ocrFormat: s.dataset.format });
      // also update the OCR model default to match format
      const m = defaultOcrForFormat(s.dataset.format);
      if (m) { setPrefs({ ocrModel: m }); syncModelSel(m); }
    });
  });
}

function initModelSelect() {
  const prefs = getPrefs();
  const ocrModels = modelsWithCap(CAP.OCR).concat(modelsWithCap(CAP.VISION));
  // dedupe by id
  const seen = new Set(); const list = [];
  for (const x of ocrModels) { if (!seen.has(x.model.id)) { seen.add(x.model.id); list.push(x); } }
  dom.ocrModelSel.innerHTML = list.map(x =>
    `<option value="${x.model.id}">${x.provider.label} · ${x.model.label}</option>`).join('');
  const cur = prefs.ocrModel || DEFAULTS.ocrModel;
  dom.ocrModelSel.value = list.some(x => x.model.id === cur) ? cur : list[0]?.model.id;
  setPrefs({ ocrModel: dom.ocrModelSel.value });
  dom.ocrModelSel.addEventListener('change', () => setPrefs({ ocrModel: dom.ocrModelSel.value }));
}

function syncModelSel(id) {
  if ([...dom.ocrModelSel.options].some(o => o.value === id)) {
    dom.ocrModelSel.value = id;
    setPrefs({ ocrModel: id });
  }
}

function defaultOcrForFormat(fmt) {
  switch (fmt) {
    case 'plain': return 'PaddlePaddle/PaddleOCR-VL-1.5';
    case 'describe': return 'THUDM/GLM-Z1-9B-0414';
    default: return 'deepseek-ai/DeepSeek-OCR';
  }
}

/* ---------- Settings modal ---------- */
function initSettings() {
  dom.settingsBtn.addEventListener('click', openSettings);
}

function openSettings() {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `
    <div class="modal-head"><h3>设置</h3><button class="x">✕</button></div>
    <div class="modal-body">
      ${Object.values(PROVIDERS).map(p => `
        <div class="field">
          <label>${p.label} API Key</label>
          <div class="kv-row">
            <input type="password" data-provider="${p.id}" style="flex:1;margin-right:8px">
            <button class="pw-toggle" type="button">显示</button>
          </div>
          <div class="hint">${p.baseUrl}</div>
        </div>
      `).join('')}
      <div class="field">
        <label>生成图片模型</label>
        <select id="setImgModel">
          ${modelsWithCap(CAP.IMAGE).map(x => `<option value="${x.model.id}">${x.model.label} — ${x.model.blurb}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>图片尺寸</label>
        <select id="setImgSize">
          <option value="1K">1K</option>
          <option value="2K">2K</option>
          <option value="3K">3K</option>
          <option value="4K">4K</option>
        </select>
      </div>
    </div>`;
  mask.appendChild(m);
  document.body.appendChild(mask);

  mask.querySelector('.x').addEventListener('click', () => mask.remove());
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });

  bindSettings(m);
  // populate pw toggles
  m.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '显示' : '隐藏';
    });
  });
  // populate + bind image model/size
  const prefs = getPrefs();
  const imgSel = m.querySelector('#setImgModel');
  imgSel.value = prefs.imageModel || DEFAULTS.imageModel;
  imgSel.addEventListener('change', () => setPrefs({ imageModel: imgSel.value }));
  const sizeSel = m.querySelector('#setImgSize');
  sizeSel.value = prefs.imageSize || DEFAULTS.imageSize;
  sizeSel.addEventListener('change', () => setPrefs({ imageSize: sizeSel.value }));
}

/* ---------- Export ---------- */
function initExport() {
  let open = false;
  const menu = document.createElement('div');
  menu.className = 'menu-pop';
  menu.style.display = 'none';
  menu.innerHTML = `
    <button class="menu-item" data-fmt="md">📝 Markdown (.md)</button>
    <button class="menu-item" data-fmt="txt">📄 纯文本 (.txt)</button>
    <button class="menu-item" data-fmt="html">🌐 网页 (.html)</button>`;
  dom.exportBtn.parentElement.style.position = 'relative';
  dom.exportBtn.parentElement.appendChild(menu);

  dom.exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    menu.style.display = open ? 'block' : 'none';
  });
  document.addEventListener('click', () => { open = false; menu.style.display = 'none'; });
  menu.querySelectorAll('.menu-item').forEach(b => {
    b.addEventListener('click', () => {
      download(chat.exportConversation(b.dataset.fmt), b.dataset.fmt);
      open = false; menu.style.display = 'none';
    });
  });
}

function download(content, fmt) {
  const map = { md: ['text/markdown', '.md'], txt: ['text/plain', '.txt'], html: ['text/html', '.html'] };
  const [mime, ext] = map[fmt] || map.md;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `chatorcr_${Date.now()}${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出', 'success');
}

/* ---------- Clear ---------- */
function initClear() {
  dom.clearBtn.addEventListener('click', () => {
    if (!confirm('清空所有对话记录？')) return;
    chat.clear();
    dom.stream.innerHTML = '';
    renderWelcome();
    document.querySelector('.ribbon') && attachRibbon(document.getElementById('ribbon'));
    toast('已清空', 'info');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
