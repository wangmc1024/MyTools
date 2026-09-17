/* ============================================================
 *  ChatOCR Pro — OCR 工作台核心逻辑
 *  功能：图片/文档上传 → OCR 识别（DeepSeek-OCR / PaddleOCR-VL）
 *  架构：纯前端，零构建，CDN 按需加载 PDF.js / Mammoth.js
 * ========================================================== */

/* ---------- 通用工具 ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, ms=1800) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'), ms);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/* ---------- 全局状态 ---------- */
const ocrState = {
  selectedModel: null,
  pendingImage: null,        // { dataUrl, name, size, mime }
  pendingDocument: null,     // { name, size, type, file }
  inputMode: 'image',        // 'image' | 'document'
  isGenerating: false,
  abortController: null,
  cameraStream: null,
  currentFacing: 'environment',
  rawResultText: '',         // 原始识别结果文本
  formattedResultText: '',   // 格式化结果文本
  isFormatting: false,       // 是否正在生成格式化结果
  activeResultView: 'raw',   // 'raw' | 'formatted'
};

/* ---------- 文档类型注册表（单一事实源） ---------- */
/**
 * @typedef {Object} DocumentType
 * @property {string} id - 类型标识
 * @property {string[]} extensions - 扩展名列表（含点号）
 * @property {string[]} mimeTypes - MIME 类型列表
 * @property {number} maxSize - 大小上限（字节）
 * @property {number} [maxPages] - 页数上限（仅 PDF）
 * @property {'pdfjs'|'mammoth'|'plaintext'|'doc-fallback'} parser - 解析器标识
 * @property {string} icon - 预览图标 emoji
 * @property {string} label - 类型标签
 */
const DOCUMENT_TYPES = Object.freeze([
  {
    id: 'pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxSize: 20 * 1024 * 1024,
    maxPages: 20,
    parser: 'pdfjs',
    icon: '📄',
    label: 'PDF',
  },
  {
    id: 'docx',
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 20 * 1024 * 1024,
    parser: 'mammoth',
    icon: '📝',
    label: 'Word',
  },
  {
    id: 'doc',
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
    maxSize: 20 * 1024 * 1024,
    parser: 'mammoth',
    icon: '📝',
    label: 'Word',
  },
  {
    id: 'txt',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    maxSize: 5 * 1024 * 1024,
    parser: 'plaintext',
    icon: '📃',
    label: 'TXT',
  },
  {
    id: 'md',
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown'],
    maxSize: 5 * 1024 * 1024,
    parser: 'plaintext',
    icon: '📑',
    label: 'Markdown',
  },
]);

/**
 * 按文件扩展名查找文档类型
 * @param {File} file
 * @returns {DocumentType|undefined}
 */
function findDocumentType(file) {
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return undefined;
  const ext = file.name.slice(dot).toLowerCase();
  return DOCUMENT_TYPES.find(t => t.extensions.includes(ext));
}

/* ---------- CDN 动态加载器 ---------- */
const _scriptCache = new Map();

/**
 * 动态加载 CDN 脚本，按需引入解析库
 * @param {string} url - CDN URL
 * @param {string} globalVar - 加载后的全局变量名
 * @returns {Promise<void>}
 */
function loadScript(url, globalVar) {
  if (window[globalVar]) return Promise.resolve();
  if (_scriptCache.has(url)) return _scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('文档解析组件加载失败'));
    document.head.appendChild(script);
  });
  _scriptCache.set(url, p);
  return p;
}

/* ---------- API Key ---------- */
function apiKey() {
  const el = $('#siliconflowKey');
  return el ? el.value.trim() : '';
}

/* ---------- 状态栏 ---------- */
function setRibbon(html, active=false, idle=false) {
  const r = $('#ribbonChips');
  if (r) r.innerHTML = html;
  const ribbon = $('.ribbon');
  if (ribbon) {
    ribbon.classList.toggle('active', active);
    ribbon.classList.toggle('idle', idle);
  }
}

function setTaskStatus(label, sub) {
  const html = `<span class="rchip active-task"><span class="rdot"></span>${esc(label)}${sub ? ' · ' + esc(sub) : ''}</span>`;
  setRibbon(html, true, false);
}

/* ---------- 主题切换 ---------- */
function bindThemeToggle() {
  const btn = $('#portalThemeToggle');
  const icon = $('#portalThemeIcon');
  if (!btn || !icon) return;
  const saved = localStorage.getItem('ocr-theme') || 'light';
  document.documentElement.dataset.theme = saved;
  icon.textContent = saved === 'light' ? '☀️' : '🌙';
  btn.onclick = () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    icon.textContent = next === 'light' ? '☀️' : '🌙';
    localStorage.setItem('ocr-theme', next);
  };
}

/* ---------- 模型列表渲染 ---------- */
function renderOcrModelList() {
  const wrap = $('#ocrModelList');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const p of Object.values(PROVIDERS)) {
    for (const m of p.models) {
      const card = document.createElement('div');
      card.className = 'mcard' + (ocrState.selectedModel === m.id ? ' selected' : '');
      card.dataset.modelId = m.id;
      const tags = (m.caps || []).slice(0, 5).map(c =>
        `<span class="ctag">${esc((CAP_LABELS[c] || c))}</span>`).join('');
      card.innerHTML = `
        <div class="mrow1">
          <span class="mlabel">${esc(m.label)}</span>
          <span class="mprov">${esc(p.label)}</span>
        </div>
        <div class="mrow2">${esc(m.blurb)}</div>
        <div class="mtags">${tags}</div>
      `;
      card.onclick = () => {
        ocrState.selectedModel = m.id;
        renderOcrModelList();
        savePrefs();
      };
      wrap.appendChild(card);
    }
  }
}

/* ---------- 图片输入处理 ---------- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsDataURL(file);
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter(f => /^image\//.test(f.type));
  if (files.length === 0) {
    toast('请选择图片文件');
    return;
  }
  const f = files[0];
  if (f.size > 20 * 1024 * 1024) {
    toast('图片过大，请压缩到 20MB 以下');
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(f);
    ocrState.pendingImage = { dataUrl, name: f.name, size: f.size, mime: f.type };
    renderFilePreview();
    toast('图片已加载');
  } catch (e) {
    toast('图片读取失败，请重试');
  }
}

function renderFilePreview() {
  const wrap = $('#filePreviewWrap');
  if (!wrap) return;
  if (!ocrState.pendingImage) { wrap.innerHTML = ''; return; }
  const img = ocrState.pendingImage;
  wrap.innerHTML = `
    <div class="preview-row">
      <img src="${esc(img.dataUrl)}" alt="预览" />
      <div class="preview-info">
        <span class="preview-name">${esc(img.name)}</span>
        <span class="preview-meta">${formatSize(img.size)} · ${esc(img.mime)}</span>
      </div>
      <button class="preview-remove" title="移除">×</button>
    </div>
  `;
  wrap.querySelector('.preview-remove').onclick = () => {
    ocrState.pendingImage = null;
    renderFilePreview();
  };
  wrap.querySelector('img').onclick = () => openLightbox(img.dataUrl);
}

function openLightbox(src) {
  const wrap = $('#lightboxWrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="lightbox-mask"><img class="lightbox-img" src="${esc(src)}" /></div>`;
  wrap.classList.add('active');
  wrap.querySelector('.lightbox-mask').onclick = () => {
    wrap.classList.remove('active');
    wrap.innerHTML = '';
  };
}

/* ---------- 输入模式切换 ---------- */
function switchInputMode(mode) {
  if (mode === ocrState.inputMode) return;
  ocrState.inputMode = mode;
  const imgSec = $('#imageInputSection');
  const docSec = $('#documentInputSection');
  if (imgSec) imgSec.style.display = mode === 'image' ? '' : 'none';
  if (docSec) docSec.style.display = mode === 'document' ? '' : 'none';
  $$('.input-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // 空状态文案切换
  const empty = $('#ocrEmpty');
  if (empty) {
    const h3 = empty.querySelector('h3');
    const p = empty.querySelector('p');
    if (mode === 'document') {
      if (h3) h3.textContent = '上传文档开始 OCR 识别';
      if (p) p.textContent = '支持 PDF / Word / TXT / Markdown。选择左侧 OCR 模型，点击"开始识别"。';
    } else {
      if (h3) h3.textContent = '上传图片开始 OCR 识别';
      if (p) p.textContent = '支持拍照、拖拽、点击上传。选择左侧 OCR 模型，点击"开始识别"。';
    }
  }
  savePrefs();
}

/* ---------- 文档上传与预览 ---------- */
async function handleDocumentFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  const f = files[0];
  const t = findDocumentType(f);
  if (!t) {
    toast('暂不支持该文件格式，支持 PDF / Word / TXT / Markdown');
    return;
  }
  if (f.size > t.maxSize) {
    const limit = t.maxSize >= 20 * 1024 * 1024 ? '20MB' : '5MB';
    toast(`文件过大，请压缩到 ${limit} 以下`);
    return;
  }
  ocrState.pendingDocument = { name: f.name, size: f.size, type: t, file: f };
  renderDocumentPreview();
  toast('文档已加载');
}

function renderDocumentPreview() {
  const wrap = $('#documentPreviewWrap');
  if (!wrap) return;
  if (!ocrState.pendingDocument) { wrap.innerHTML = ''; return; }
  const doc = ocrState.pendingDocument;
  wrap.innerHTML = `
    <div class="doc-preview-row">
      <span class="doc-preview-icon">${doc.type.icon}</span>
      <div class="doc-preview-info">
        <span class="doc-preview-name">${esc(doc.name)}</span>
        <span class="doc-preview-meta">${formatSize(doc.size)}<span class="doc-type-badge">${esc(doc.type.label)}</span></span>
      </div>
      <button class="doc-preview-remove" title="移除">×</button>
    </div>
  `;
  wrap.querySelector('.doc-preview-remove').onclick = () => {
    ocrState.pendingDocument = null;
    renderDocumentPreview();
  };
}

/* ---------- 文档内容提取器 ---------- */
/**
 * @returns {Promise<{textContent: string|null, imageContents: Array<{dataUrl:string,mime:string,page:number}>|null}>}
 */
async function parsePlainText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ textContent: r.result, imageContents: null });
    r.onerror = () => reject(new Error('文件读取失败'));
    r.readAsText(file);
  });
}

async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let numPages = pdf.numPages;
  if (numPages > 20) {
    toast('文档页数较多，仅处理前 20 页');
    numPages = 20;
  }
  let textContent = '';
  const imageContents = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    const pageText = text.items.map(item => item.str).join(' ');
    if (pageText.trim().length > 0) {
      textContent += `\n--- 第${i}页 ---\n${pageText}`;
    } else {
      // 扫描页：渲染为图像
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      imageContents.push({ dataUrl, mime: 'image/png', page: i });
    }
  }
  return { textContent: textContent.trim() || null, imageContents: imageContents.length ? imageContents : null };
}

async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return { textContent: result.value, imageContents: null };
}

async function extractDocumentContent(doc) {
  const parser = doc.type.parser;
  let extracted;
  try {
    if (parser === 'plaintext') {
      extracted = await parsePlainText(doc.file);
    } else if (parser === 'mammoth') {
      await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js', 'mammoth');
      extracted = await parseDocx(doc.file);
      // .doc 文件解析结果可能为空，提示用户
      if (doc.type.id === 'doc' && (!extracted.textContent || !extracted.textContent.trim())) {
        throw new Error('旧版 .doc 格式解析失败，建议转换为 .docx 后重试');
      }
    } else if (parser === 'pdfjs') {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'pdfjsLib');
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
      extracted = await parsePdf(doc.file);
    } else {
      throw new Error('不支持的文档类型');
    }
  } catch (e) {
    if (e.message === '文档解析组件加载失败') throw e;
    if (e.message.includes('旧版 .doc')) throw e;
    if (e.message.includes('PDF') || doc.type.id === 'pdf') throw new Error('PDF 解析失败，请检查文件是否损坏或加密');
    if (doc.type.id === 'docx') throw new Error('Word 文档解析失败，请检查文件是否损坏');
    if (doc.type.id === 'doc') throw new Error('旧版 .doc 格式解析失败，建议转换为 .docx 后重试');
    throw e;
  }
  // 内容非空校验
  const hasText = extracted.textContent && extracted.textContent.trim().length > 0;
  const hasImages = extracted.imageContents && extracted.imageContents.length > 0;
  if (!hasText && !hasImages) {
    throw new Error('文档内容为空，请检查文件');
  }
  return extracted;
}

/* ---------- 识别请求构建 ---------- */
function buildSystemPrompt(modelId) {
  const keepFormat = $('#optKeepFormat')?.checked;
  const tableMd = $('#optTableMd')?.checked;
  const formulaLatex = $('#optFormulaLatex')?.checked;
  const parts = [];
  if (modelId === 'deepseek-ai/DeepSeek-OCR') {
    parts.push('你是一个专业的 OCR 识别助手，使用 DeepSeek-OCR 模型。');
  } else if (modelId === 'PaddlePaddle/PaddleOCR-VL-1.5') {
    parts.push('你是一个专业的 OCR 识别助手，使用 PaddleOCR-VL 模型。');
  } else {
    parts.push('你是一个专业的 OCR 识别助手。');
  }
  parts.push('请完整识别并提取输入中的所有文字内容。');
  if (keepFormat) parts.push('保留原文的段落、换行与格式结构。');
  if (tableMd) parts.push('表格请输出为 Markdown 表格格式。');
  if (formulaLatex) parts.push('数学公式请输出为 LaTeX 格式。');
  return parts.join(' ');
}

function buildOcrMessages(image, modelId, customPrompt) {
  const systemPrompt = buildSystemPrompt(modelId);
  const content = [
    { type: 'image_url', image_url: { url: image.dataUrl, detail: 'high' } },
  ];
  const prompt = customPrompt?.trim() || getDefaultImagePrompt(modelId);
  content.push({ type: 'text', text: prompt });
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
}

function getDefaultImagePrompt(modelId) {
  if (modelId === 'deepseek-ai/DeepSeek-OCR') {
    return '<image>\nConvert the document to markdown.';
  }
  return '请完整识别图片中的所有文字，保留格式';
}

function getDefaultDocumentPrompt(modelId) {
  if (modelId === 'deepseek-ai/DeepSeek-OCR') {
    return '请完整识别并提取以下文档内容中的所有文字，保留原文格式与结构。';
  }
  if (modelId === 'PaddlePaddle/PaddleOCR-VL-1.5') {
    return '请完整识别以下文档中的所有文字，不要遗漏任何内容，保留格式。';
  }
  return '请完整识别文档中的所有文字内容，保留原文格式。';
}

function buildDocumentOcrMessages(extracted, modelId, customPrompt) {
  const systemPrompt = buildSystemPrompt(modelId);
  const content = [];
  // 仅发送图像内容给 OCR 视觉模型（文本内容已直接展示，不送入视觉模型）
  if (extracted.imageContents && extracted.imageContents.length > 0) {
    for (const img of extracted.imageContents) {
      content.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'high' } });
    }
  }
  const prompt = customPrompt?.trim() || getDefaultDocumentPrompt(modelId);
  content.push({ type: 'text', text: prompt });
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
}

/* ---------- Markdown 渲染（极简） ---------- */
function renderMarkdown(text) {
  let html = esc(text);
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) =>
    `<pre><code>${code}</code></pre>`);
  // 表格
  html = html.replace(/^\|(.+)\|\n\|([-:\s|]+)\|\n((?:\|.+\|\n?)+)/gm, (m, head, sep, body) => {
    const hCells = head.split('|').map(c => c.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map(row =>
      row.split('|').map(c => c.trim()).filter(Boolean));
    let table = '<table><thead><tr>' + hCells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
    for (const r of rows) {
      table += '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // 粗体/斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 列表
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // 换行
  html = html.replace(/\n/g, '<br>');
  // 清理多余 br
  html = html.replace(/<br><(h\d|ul|pre|table)/g, '<$1');
  html = html.replace(/<\/(h\d|ul|pre|table)><br>/g, '</$1>');
  return html;
}

/* ---------- 结果展示 ---------- */
function showResult(text, modelId, chars, timeMs) {
  const empty = $('#ocrEmpty');
  const result = $('#ocrResult');
  if (empty) empty.style.display = 'none';
  if (result) result.style.display = '';
  const rm = $('#resultModel');
  const rt = $('#resultTime');
  const rc = $('#resultChars');
  const rText = $('#resultText');
  if (rm) rm.textContent = modelId || '';
  if (rt) rt.textContent = timeMs ? `${(timeMs / 1000).toFixed(1)}s` : '';
  if (rc) rc.textContent = chars ? `${chars} 字符` : '';
  if (rText) rText.innerHTML = renderMarkdown(text);
  rText?.scrollTo?.({ top: 0 });

  // 保存原始结果，重置格式化状态
  ocrState.rawResultText = text;
  ocrState.formattedResultText = '';
  ocrState.activeResultView = 'raw';
  // 切回原始结果 Tab
  switchResultView('raw');
  // 重置格式化占位
  const fmtPlaceholder = $('#formattedPlaceholder');
  const fmtText = $('#resultTextFormatted');
  if (fmtPlaceholder) fmtPlaceholder.style.display = '';
  if (fmtText) { fmtText.style.display = 'none'; fmtText.innerHTML = ''; }

  // 识别完成后自动触发格式化（多模型并发）
  if (text && text.trim()) {
    generateFormattedResult();
  }
}

function showError(msg) {
  const empty = $('#ocrEmpty');
  const result = $('#ocrResult');
  if (empty) empty.style.display = 'none';
  if (result) result.style.display = '';
  const rText = $('#resultText');
  if (rText) rText.innerHTML = `<p style="color:var(--danger);">❌ ${esc(msg)}</p>`;
}

/* ---------- 结果视图 Tab 切换 ---------- */
function switchResultView(view) {
  ocrState.activeResultView = view;
  $$('.result-view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  const rawPanel = $('#resultViewRaw');
  const fmtPanel = $('#resultViewFormatted');
  if (rawPanel) rawPanel.classList.toggle('active', view === 'raw');
  if (fmtPanel) fmtPanel.classList.toggle('active', view === 'formatted');
}

/* ---------- 格式化结果生成（多模型并发，先返回先展示） ---------- */
// 三个对话模型配置：硅基流动 DeepSeek-R1 / 智谱 GLM-4.7 / Agnes 2.5
const FORMAT_MODELS = [
  {
    name: 'DeepSeek-R1',
    model: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    // 硅基流动使用用户输入的 API Key
    getKey: () => apiKey(),
  },
  {
    name: 'GLM-4.7',
    model: 'glm-4.7-flash',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    getKey: () => '19344c09a7c047a69ae0ee36cd75c4f3.wOrnR0cm2GL2kiCD',
  },
  {
    name: 'Agnes-2.5',
    model: 'agnes-2.5-flash',
    endpoint: 'https://apihub.agnes-ai.com/v1/chat/completions',
    getKey: () => 'sk-4kbOHFeka595sDHrStt0641WniyyxMrYCg4fm1bXXSnxJcqG',
  },
];

const FORMAT_MAX_ATTEMPTS = 5;

// 单模型流式请求，返回 { promise, abort }
// promise resolve 时附带 model 标识；流式 chunk 通过 onChunk 回调实时推送
function streamFormatRequest(cfg, systemPrompt, userText, onChunk, signal) {
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 8000,
    top_p: 1,
  };

  return fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.getKey()}`,
    },
    body: JSON.stringify(body),
    signal,
  }).then(async resp => {
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let errMsg = `HTTP ${resp.status}`;
      try { const j = JSON.parse(errText); errMsg = j.message || j.error?.message || errMsg; } catch {}
      throw new Error(`[${cfg.name}] ${errMsg}`);
    }
    let resultText = '';
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            resultText += delta;
            onChunk(resultText, cfg.name);
          }
        } catch {}
      }
    }
    if (!resultText.trim()) throw new Error(`[${cfg.name}] 返回空内容`);
    return { text: resultText, modelName: cfg.name };
  });
}

async function generateFormattedResult() {
  if (ocrState.isFormatting) return;
  const rawText = ocrState.rawResultText;
  if (!rawText || !rawText.trim()) {
    toast('暂无识别结果可格式化');
    return;
  }

  ocrState.isFormatting = true;
  const btn = $('#generateFormatBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 正在格式化…'; }
  const fmtPlaceholder = $('#formattedPlaceholder');
  const fmtText = $('#resultTextFormatted');
  if (fmtPlaceholder) fmtPlaceholder.style.display = 'none';
  if (fmtText) { fmtText.style.display = ''; fmtText.innerHTML = '<p style="color:var(--text-faint);">⏳ 三模型并发请求中，谁先返回谁展示…</p>'; }

  setTaskStatus('✨ 正在格式化', '多模型并发');

  const systemPrompt = '你是一个文档格式整理助手。请将用户提供的 OCR 识别原始文本整理为结构清晰、格式规范的 Markdown 文档。要求：\n1. 修正明显的 OCR 识别错误（错别字、乱码、断词）\n2. 识别并整理标题层级（#、##、###）\n3. 表格输出为 Markdown 表格格式\n4. 列表使用 Markdown 列表格式\n5. 保留原文的段落结构和逻辑顺序\n6. 数学公式输出为 LaTeX 格式（$...$ 或 $...$）\n7. 直接输出整理后的 Markdown，不要添加额外说明';

  let lastError = null;
  let success = false;

  for (let attempt = 1; attempt <= FORMAT_MAX_ATTEMPTS; attempt++) {
    if (fmtText) fmtText.innerHTML = `<p style="color:var(--text-faint);">⏳ 第 ${attempt}/${FORMAT_MAX_ATTEMPTS} 次尝试：三模型并发请求中…</p>`;

    // 每个模型独立的 AbortController，便于胜出后 abort 其他
    const controllers = FORMAT_MODELS.map(() => new AbortController());
    // 用于标记是否已有模型胜出
    let winnerIdx = -1;
    let resultText = '';
    let winnerName = '';

    const onChunk = (text, name) => {
      // 第一个产生内容的模型胜出，abort 其他模型
      if (winnerIdx === -1) {
        winnerIdx = FORMAT_MODELS.findIndex(m => m.name === name);
        winnerName = name;
        controllers.forEach((c, i) => {
          if (i !== winnerIdx) {
            try { c.abort(); } catch {}
          }
        });
      }
      resultText = text;
      if (fmtText) fmtText.innerHTML = renderMarkdown(resultText);
      const progress = $('#ribbonProgress');
      if (progress) progress.textContent = `[${winnerName}] ${resultText.length} 字符`;
    };

    const promises = FORMAT_MODELS.map((cfg, i) =>
      streamFormatRequest(cfg, systemPrompt, rawText, onChunk, controllers[i].signal)
        .then(res => ({ ...res, idx: i }))
        .catch(err => {
          if (err.name === 'AbortError') return null; // 被胜出者 abort，正常
          lastError = err;
          return null;
        })
    );

    // 等所有请求结束（胜出的返回结果，失败的返回 null）
    const results = await Promise.all(promises);
    const winner = results.find(r => r && r.text);

    if (winner && winner.text.trim()) {
      ocrState.formattedResultText = winner.text;
      if (fmtText) fmtText.innerHTML = renderMarkdown(winner.text);
      setRibbon(`<span class="rchip"><span class="rdot"></span>格式化完成 · ${winner.modelName || winnerName}</span>`, false, true);
      toast(`✨ 格式化结果已生成（${winner.modelName || winnerName}），点击「格式化结果」Tab 查看`, 3500);
      success = true;
      break;
    }

    // 本轮全部失败，继续重试
    if (attempt < FORMAT_MAX_ATTEMPTS) {
      if (fmtText) fmtText.innerHTML = `<p style="color:var(--warning);">⚠️ 第 ${attempt} 次尝试全部失败，1.5s 后重试…</p>`;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!success) {
    if (fmtText) fmtText.innerHTML = `<p style="color:var(--danger);">❌ 格式化失败（已重试 ${FORMAT_MAX_ATTEMPTS} 次）：${esc(lastError?.message || '所有模型均无响应')}</p>`;
    setRibbon('<span class="rchip"><span class="rdot"></span>格式化失败</span>', false, true);
  }

  ocrState.isFormatting = false;
  if (btn) { btn.disabled = false; btn.textContent = '✨ 重新生成'; }
  const progress = $('#ribbonProgress');
  if (progress) progress.textContent = '';
}

/* ---------- 识别执行 ---------- */
async function runOcr() {
  if (ocrState.isGenerating) {
    // 停止生成
    if (ocrState.abortController) ocrState.abortController.abort();
    return;
  }

  const modelId = ocrState.selectedModel || 'deepseek-ai/DeepSeek-OCR';
  const customPrompt = $('#customPrompt')?.value || '';
  const useStream = $('#optStream')?.checked ?? true;

  // 模式分支：构建 messages
  let messages;
  let directTextResult = null;  // 文档纯文本可直接展示，无需送入 OCR 视觉模型
  if (ocrState.inputMode === 'document') {
    if (!ocrState.pendingDocument) {
      toast('请先上传文档');
      return;
    }
    if (!apiKey()) {
      toast('请填写硅基流动 API Key');
      return;
    }
    setTaskStatus('📄 正在解析文档', ocrState.pendingDocument.type.label);
    let extracted;
    try {
      extracted = await extractDocumentContent(ocrState.pendingDocument);
    } catch (e) {
      showError(e.message || '文档解析失败');
      setRibbon('<span class="rchip"><span class="rdot"></span>解析失败</span>', false, true);
      return;
    }

    const hasText = extracted.textContent && extracted.textContent.trim().length > 0;
    const hasImages = extracted.imageContents && extracted.imageContents.length > 0;

    // 纯文本内容（TXT/MD/DOCX/PDF文本层）：直接展示，无需送入 OCR 视觉模型
    if (hasText && !hasImages) {
      const elapsed = 0;
      const text = extracted.textContent;
      showResult(text, modelId + ' · 文档提取', text.length, elapsed);
      setRibbon(`<span class="rchip"><span class="rdot"></span>文档提取完成 · ${text.length} 字符</span>`, false, true);
      toast('文档内容已提取');
      return;
    }

    // 混合内容：文本部分直接保留，图像部分送入 OCR 识别后合并
    if (hasText && hasImages) {
      directTextResult = extracted.textContent + '\n\n--- 以下为扫描页 OCR 识别结果 ---\n\n';
    }

    setTaskStatus('🔍 正在识别', ocrState.pendingDocument.type.label);
    messages = buildDocumentOcrMessages(extracted, modelId, customPrompt);
  } else {
    if (!ocrState.pendingImage) {
      toast('请先上传或拍照获取图片');
      return;
    }
    if (!apiKey()) {
      toast('请填写硅基流动 API Key');
      return;
    }
    setTaskStatus('🔍 正在识别', modelId.split('/').pop());
    messages = buildOcrMessages(ocrState.pendingImage, modelId, customPrompt);
  }

  // 构建请求体
  const modelInfo = findModel(modelId);
  const params = modelInfo?.model?.params || {};
  const body = {
    model: modelId,
    messages,
    stream: useStream,
    temperature: params.temperature ?? 0,
    max_tokens: params.max_tokens ?? 6000,
    top_p: params.top_p ?? 1,
  };

  // 发送请求
  ocrState.isGenerating = true;
  ocrState.abortController = new AbortController();
  const runBtn = $('#runOcrBtn');
  if (runBtn) {
    runBtn.classList.add('stop');
    runBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg> 停止';
  }
  const resultWrapper = $('#resultWrapper');
  resultWrapper?.classList.add('streaming');

  const startTime = Date.now();
  const timeoutId = setTimeout(() => ocrState.abortController.abort(), 120000);

  try {
    const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey()}`,
      },
      body: JSON.stringify(body),
      signal: ocrState.abortController.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      let errMsg = `HTTP ${resp.status}`;
      try { const j = JSON.parse(errText); errMsg = j.message || j.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    let resultText = '';
    const rText = $('#resultText');
    const empty = $('#ocrEmpty');
    const result = $('#ocrResult');
    if (empty) empty.style.display = 'none';
    if (result) result.style.display = '';
    if (rText) rText.innerHTML = '';

    if (useStream && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              resultText += delta;
              if (rText) rText.innerHTML = renderMarkdown(resultText);
              const progress = $('#ribbonProgress');
              if (progress) progress.textContent = `${resultText.length} 字符`;
            }
          } catch {}
        }
      }
    } else {
      const json = await resp.json();
      resultText = json.choices?.[0]?.message?.content || '';
    }

    const elapsed = Date.now() - startTime;
    // 混合内容：将文档文本前缀与 OCR 识别结果合并
    const finalText = directTextResult ? (directTextResult + resultText) : resultText;
    showResult(finalText, modelId, finalText.length, elapsed);
    setRibbon(`<span class="rchip"><span class="rdot"></span>识别完成 · ${(elapsed/1000).toFixed(1)}s</span>`, false, true);
  } catch (e) {
    if (e.name === 'AbortError') {
      showError('识别超时或已取消，请稍后再试');
      setRibbon('<span class="rchip"><span class="rdot"></span>已取消</span>', false, true);
    } else {
      showError(`识别失败：${e.message || '未知错误'}`);
      setRibbon('<span class="rchip"><span class="rdot"></span>识别失败</span>', false, true);
    }
  } finally {
    clearTimeout(timeoutId);
    ocrState.isGenerating = false;
    ocrState.abortController = null;
    if (runBtn) {
      runBtn.classList.remove('stop');
      runBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg> 开始识别';
    }
    resultWrapper?.classList.remove('streaming');
    const progress = $('#ribbonProgress');
    if (progress) progress.textContent = '';
  }
}

/* ---------- 结果操作 ---------- */
function getCurrentResultText() {
  // 根据当前激活的视图返回对应文本
  if (ocrState.activeResultView === 'formatted' && ocrState.formattedResultText) {
    return ocrState.formattedResultText;
  }
  return ocrState.rawResultText || '';
}

function copyResult() {
  const text = getCurrentResultText();
  if (!text) { toast('暂无结果可复制'); return; }
  navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板')).catch(() => toast('复制失败'));
}

function downloadResult() {
  const text = getCurrentResultText();
  if (!text) { toast('暂无结果可下载'); return; }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-result-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('已下载');
}

function clearResult() {
  const empty = $('#ocrEmpty');
  const result = $('#ocrResult');
  if (empty) empty.style.display = '';
  if (result) result.style.display = 'none';
  const rText = $('#resultText');
  if (rText) rText.innerHTML = '';
  const fmtText = $('#resultTextFormatted');
  if (fmtText) { fmtText.innerHTML = ''; fmtText.style.display = 'none'; }
  const fmtPlaceholder = $('#formattedPlaceholder');
  if (fmtPlaceholder) fmtPlaceholder.style.display = '';
  ocrState.rawResultText = '';
  ocrState.formattedResultText = '';
  ocrState.activeResultView = 'raw';
  switchResultView('raw');
  setRibbon('<span class="rchip"><span class="rdot"></span>OCR 就绪</span>', false, true);
}

/* ---------- 偏好存储 ---------- */
function savePrefs() {
  try {
    localStorage.setItem('ocr-page:prefs', JSON.stringify({
      selectedModel: ocrState.selectedModel,
      inputMode: ocrState.inputMode,
    }));
  } catch {}
}

function loadPrefs() {
  try {
    const pr = JSON.parse(localStorage.getItem('ocr-page:prefs') || '{}');
    if (pr.selectedModel) ocrState.selectedModel = pr.selectedModel;
    if (pr.inputMode === 'document') {
      switchInputMode('document');
    }
  } catch {}
  // API Key
  const savedKey = localStorage.getItem('key:siliconflow');
  if (savedKey) {
    const el = $('#siliconflowKey');
    if (el && !el.value) el.value = savedKey;
  }
}

function bindKeySave() {
  const el = $('#siliconflowKey');
  if (!el) return;
  el.addEventListener('change', () => {
    try { localStorage.setItem('key:siliconflow', el.value); } catch {}
  });
}

/* ---------- 内部 Tab 切换 ---------- */
function bindInnerTabs() {
  $$('.inner-tab').forEach(tab => {
    tab.onclick = () => {
      const target = tab.dataset.innerTab;
      $$('.inner-tab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.inner-panel').forEach(p => p.classList.toggle('active', p.id === `${target}Panel`));
    };
  });
}

/* ---------- 摄像头 ---------- */
/**
 * 检测是否为移动端（用于决定是否优先调用原生相机）
 */
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 900px)').matches);
}

/**
 * 调用移动端原生相机捕获（通过 <input capture>）
 * 优点：系统原生相机 UI，方向/旋转由系统自动处理，无镜像/倒置问题
 * @returns {Promise<boolean>} 是否成功触发原生捕获
 */
function captureViaNativeCamera() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // capture 属性：'environment' 后置 / 'user' 前置
    input.setAttribute('capture', ocrState.currentFacing === 'user' ? 'user' : 'environment');

    let settled = false;
    const cleanup = () => {
      input.remove();
      window.removeEventListener('focus', onFocus);
    };
    // 用户取消时（焦点回到窗口但没选文件）
    const onFocus = () => {
      setTimeout(() => {
        if (!settled && !input.files?.length) {
          settled = true;
          cleanup();
          resolve(false);
        }
      }, 300);
    };

    input.onchange = () => {
      settled = true;
      cleanup();
      const file = input.files?.[0];
      if (!file) { resolve(false); return; }
      const reader = new FileReader();
      reader.onload = () => {
        ocrState.pendingImage = {
          dataUrl: reader.result,
          name: `camera-${Date.now()}.jpg`,
          size: file.size,
          mime: file.type || 'image/jpeg'
        };
        renderFilePreview();
        toast('已拍照');
        resolve(true);
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    };

    // 必须挂到 DOM 才能在部分浏览器触发
    input.style.display = 'none';
    document.body.appendChild(input);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/**
 * 打开 WebRTC 摄像头预览（桌面端或原生捕获不可用时使用）
 */
async function openCamera() {
  const modal = $('#cameraModal');
  const video = $('#cameraVideo');
  const select = $('#cameraSelect');
  const hint = $('#cameraHint');
  if (!modal || !video) return;

  // 移动端：直接调用系统原生相机，不显示 WebRTC 拍照模态框
  // 无论用户拍照成功还是取消，都不再回退到 WebRTC UI
  if (isMobileDevice()) {
    await captureViaNativeCamera();
    return;
  }

  modal.classList.add('active');
  hint.textContent = '正在请求摄像头权限…';

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (select) {
      select.innerHTML = videoDevices.map((d, i) =>
        `<option value="${i}">${d.label || '摄像头 ' + (i + 1)}</option>`).join('');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: ocrState.currentFacing,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    ocrState.cameraStream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});

    // 根据实际摄像头方向决定是否镜像
    // 仅前置摄像头（user）镜像以符合自拍习惯；后置（environment）保持原始方向
    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};
    const actualFacing = settings.facingMode || ocrState.currentFacing;
    video.classList.toggle('mirror', actualFacing === 'user');
    // 记入实际方向，供 captureShot 使用
    ocrState._actualFacing = actualFacing;

    hint.textContent = '';
  } catch (e) {
    hint.textContent = '无法访问摄像头：' + (e.message || '权限被拒绝');
  }
}

function closeCamera() {
  const modal = $('#cameraModal');
  if (ocrState.cameraStream) {
    ocrState.cameraStream.getTracks().forEach(t => t.stop());
    ocrState.cameraStream = null;
  }
  const video = $('#cameraVideo');
  if (video) {
    video.srcObject = null;
    video.classList.remove('mirror');
  }
  if (modal) modal.classList.remove('active');
}

/**
 * 从 video 元素捕获一帧到 canvas
 * 处理：仅前置摄像头镜像翻转；后置摄像头保持原始方向
 */
async function captureShot() {
  const video = $('#cameraVideo');
  const canvas = $('#cameraCanvas');
  if (!video || !canvas) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) { toast('视频未就绪'); return; }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 仅前置摄像头（自拍）才镜像绘制，与预览的 .mirror class 保持一致
  const isMirror = video.classList.contains('mirror');
  if (isMirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  ocrState.pendingImage = { dataUrl, name: `camera-${Date.now()}.jpg`, size: Math.round(dataUrl.length * 0.75), mime: 'image/jpeg' };
  renderFilePreview();
  closeCamera();
  toast('已拍照');
}

/**
 * 切换前后摄像头
 * 注意：不关闭模态框，避免闪烁；只切换流
 */
async function switchCamera() {
  ocrState.currentFacing = ocrState.currentFacing === 'environment' ? 'user' : 'environment';
  // 移动端原生捕获模式：直接重新调用原生相机
  if (isMobileDevice() && !ocrState.cameraStream) {
    await captureViaNativeCamera();
    return;
  }
  // WebRTC 模式：只切换流，不关闭模态框
  if (ocrState.cameraStream) {
    ocrState.cameraStream.getTracks().forEach(t => t.stop());
    ocrState.cameraStream = null;
  }
  const video = $('#cameraVideo');
  const hint = $('#cameraHint');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: ocrState.currentFacing,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    ocrState.cameraStream = stream;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      const actualFacing = settings.facingMode || ocrState.currentFacing;
      video.classList.toggle('mirror', actualFacing === 'user');
      ocrState._actualFacing = actualFacing;
    }
    if (hint) hint.textContent = '';
  } catch (e) {
    if (hint) hint.textContent = '切换摄像头失败：' + (e.message || '权限被拒绝');
  }
}

/* ---------- 示例点击 ---------- */
function bindExamples() {
  $$('.ex-item').forEach(item => {
    item.onclick = () => {
      const prompt = item.dataset.prompt;
      const el = $('#customPrompt');
      if (el && prompt) el.value = prompt;
    };
  });
}

/* ---------- 初始化 ---------- */
function initOcrPage() {
  // 默认模型
  if (!ocrState.selectedModel) ocrState.selectedModel = 'deepseek-ai/DeepSeek-OCR';
  renderOcrModelList();
  loadPrefs();
  renderOcrModelList(); // 应用保存的模型选择
  bindThemeToggle();
  bindInnerTabs();
  bindKeySave();
  bindExamples();

  // 模式切换 Tab
  $$('.input-mode-tab').forEach(btn => {
    btn.onclick = () => switchInputMode(btn.dataset.mode);
  });

  // 图片上传
  const uploadBtn = $('#uploadBtn');
  const fileInput = $('#fileInput');
  if (uploadBtn && fileInput) {
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = e => {
      handleFiles(e.target.files);
      e.target.value = '';
    };
  }

  // 图片拖拽区
  const uploadZone = $('#uploadZone');
  if (uploadZone) {
    uploadZone.onclick = () => fileInput?.click();
    uploadZone.ondragover = e => { e.preventDefault(); uploadZone.classList.add('dz-on'); };
    uploadZone.ondragleave = () => uploadZone.classList.remove('dz-on');
    uploadZone.ondrop = e => {
      e.preventDefault();
      uploadZone.classList.remove('dz-on');
      handleFiles(e.dataTransfer.files);
    };
  }

  // 文档上传
  const docUploadZone = $('#documentUploadZone');
  const docFileInput = $('#documentFileInput');
  if (docUploadZone && docFileInput) {
    docUploadZone.onclick = () => docFileInput.click();
    docFileInput.onchange = e => {
      handleDocumentFiles(e.target.files);
      e.target.value = '';
    };
    docUploadZone.ondragover = e => { e.preventDefault(); docUploadZone.classList.add('dz-on'); };
    docUploadZone.ondragleave = () => docUploadZone.classList.remove('dz-on');
    docUploadZone.ondrop = e => {
      e.preventDefault();
      docUploadZone.classList.remove('dz-on');
      handleDocumentFiles(e.dataTransfer.files);
    };
  }

  // 全局拖拽（按模式分发）
  document.ondragover = e => e.preventDefault();
  document.ondrop = e => {
    if (e.target.closest('#uploadZone') || e.target.closest('#documentUploadZone')) return;
    e.preventDefault();
    if (ocrState.inputMode === 'document') {
      handleDocumentFiles(e.dataTransfer.files);
    } else {
      handleFiles(e.dataTransfer.files);
    }
  };

  // 识别按钮
  const runBtn = $('#runOcrBtn');
  if (runBtn) runBtn.onclick = runOcr;

  // 结果操作
  $('#copyResultBtn') && ($('#copyResultBtn').onclick = copyResult);
  $('#downloadResultBtn') && ($('#downloadResultBtn').onclick = downloadResult);
  $('#clearResultBtn') && ($('#clearResultBtn').onclick = clearResult);

  // 结果视图 Tab 切换
  $$('.result-view-tab').forEach(tab => {
    tab.onclick = () => switchResultView(tab.dataset.view);
  });

  // 格式化结果生成按钮
  $('#generateFormatBtn') && ($('#generateFormatBtn').onclick = generateFormattedResult);

  // 摄像头
  $('#cameraBtn') && ($('#cameraBtn').onclick = openCamera);
  $('#cameraCloseBtn') && ($('#cameraCloseBtn').onclick = closeCamera);
  $('#captureShotBtn') && ($('#captureShotBtn').onclick = captureShot);
  $('#switchCameraBtn') && ($('#switchCameraBtn').onclick = switchCamera);

  // 初始状态栏
  setRibbon('<span class="rchip"><span class="rdot"></span>OCR 就绪</span>', false, true);
}

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOcrPage);
} else {
  initOcrPage();
}
