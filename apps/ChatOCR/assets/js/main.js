/* ============================================================
 *  ChatOCR Pro — Core (聚焦 OCR 核心目的)
 *  修复: 欢迎消息渲染/多模态消息构建/加载状态/API参数
 * ========================================================== */

/* ---------- 通用工具 ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg, ms=1500) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'), ms);
}

function confirmAsync(msg, onOk) {
  const existing = $('.confirm-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.className = 'confirm-bar';
  bar.innerHTML = `<span>${esc(msg)}</span><div class="confirm-bar-actions"><button class="confirm-bar-btn cancel">取消</button><button class="confirm-bar-btn ok">确认</button></div>`;
  document.body.appendChild(bar);
  const close = () => { bar.remove(); clearTimeout(confirmAsync._t); };
  bar.querySelector('.cancel').onclick = close;
  bar.querySelector('.ok').onclick = () => { close(); onOk(); };
  confirmAsync._t = setTimeout(close, 8000);
}

function scrollToBottom(ms=60) {
  setTimeout(()=> {
    const el = document.querySelector('.stream-wrapper');
    if (el) el.scrollTo({ top: el.scrollHeight, behavior:'smooth' });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior:'smooth' });
  }, ms);
}

/* ---------- 全局状态 ---------- */
const state = {
  messages: [],
  selectedModel: null,
  smartRouter: true,
  routerMode: 'ai',
  pendingImages: [],
  isGenerating: false,
  currentTask: null,
  abortController: null,
};

/* ---------- 任务状态管理 ---------- */
function setTaskStatus(taskName, detail, progress) {
  state.currentTask = { name: taskName, detail, progress };
  const ribbon = document.querySelector('.ribbon');
  if (ribbon) {
    ribbon.classList.add('active');
    ribbon.classList.remove('idle');
  }
  const r = $('#ribbonChips');
  const p = $('#ribbonProgress');
  if (r) {
    const spinner = '<span class="spinner"></span>';
    r.innerHTML = `<span class="rchip active-task">${spinner}${esc(taskName)}</span>`
      + (detail ? `<span class="rchip secondary">${esc(detail)}</span>` : '');
  }
  if (p && progress != null) {
    p.textContent = progress + '%';
  } else if (p) {
    p.textContent = '';
  }
}
function clearTaskStatus() {
  state.currentTask = null;
  const ribbon = document.querySelector('.ribbon');
  if (ribbon) {
    ribbon.classList.remove('active');
    ribbon.classList.add('idle');
  }
  setRibbon('OCR 就绪', state.smartRouter
    ? (state.routerMode === 'ai' ? '🤖 AI智能路由已启用' : '🔤 关键词匹配路由已启用')
    : '已选手动模型');
}
function setRibbon(chips, status, icon) {
  if (state.currentTask) return;
  const r = $('#ribbonChips'); const p = $('#ribbonProgress'); if (!r) return;
  r.innerHTML = `<span class="rchip"><span class="rdot"></span>${icon || ''}${esc(status||'待机中')}</span>`
    + (chips ? `<span class="rchip secondary">${esc(chips)}</span>` : '');
  if (p) p.textContent = '';
}

/* ---------- API Key 读取 ---------- */
function apiKey(providerId) {
  const p = PROVIDERS[providerId]; if (!p) return '';
  const el = document.getElementById(p.keyEl);
  return el ? el.value.trim() : '';
}

/* ---------- 主题切换 ---------- */
function bindThemeToggle() {
  const btn = $('#portalThemeToggle');
  const icon = $('#portalThemeIcon');
  if (!btn) return;
  const apply = (th) => {
    document.documentElement.setAttribute('data-theme', th);
    if (icon) icon.textContent = th === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('portal-theme', th);
  };
  const saved = localStorage.getItem('portal-theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  apply(saved);
  btn.onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    apply(cur === 'dark' ? 'light' : 'dark');
  };
}

/* ---------- 模型渲染 ---------- */
function renderModelList() {
  const wrap = $('#modelList'); if (!wrap) return;
  const all = Object.values(PROVIDERS).flatMap(p =>
    p.models.map(m => ({ ...m, providerId: p.id, providerLabel: p.label })));
  all.sort((a,b)=> (b.caps?.includes('ocr')?1:0) - (a.caps?.includes('ocr')?1:0));
  wrap.innerHTML = all.map(m => {
    const selected = state.selectedModel === m.id ? 'selected' : '';
    const caps = (m.caps||[]).map(c=>`<span class="ctag">${CAP_LABELS[c]||c}</span>`).join('');
    return `<div class="mcard ${selected}" data-id="${esc(m.id)}" title="${esc(m.blurb)}">
      <div class="mrow1"><span class="mlabel">${esc(m.label)}</span><span class="mprov">${esc(m.providerLabel)}</span></div>
      <div class="mrow2">${esc(m.blurb)}</div>
      <div class="mtags">${caps}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.mcard').forEach(c => {
    c.onclick = () => {
      const wasSelected = state.selectedModel === c.dataset.id;
      if (wasSelected) {
        state.selectedModel = null;
        state.smartRouter = true;
        const rt = $('#routerToggle');
        if (rt) rt.checked = true;
        renderModelList();
        setRibbon('智能路由已启用', '按意图自动匹配模型');
        toast('已切换回智能路由模式');
        savePrefs();
      } else {
        state.selectedModel = c.dataset.id;
        state.smartRouter = false;
        const rt2 = $('#routerToggle');
        if (rt2) rt2.checked = false;
        renderModelList();
        const found = findModel(state.selectedModel);
        setRibbon(`手动 · ${esc(found?.model.label||'OCR模型')}`, '已选择模型');
        toast(`已选择: ${esc(found?.model.label||'模型')}`);
        savePrefs();
      }
    };
  });
}



/* ---------- 路由方案1：关键词匹配（保留） ---------- */
function routeIntentKeyword(text, hasImage) {
  const t = String(text||'').toLowerCase();
  if (hasImage) return { tool:'ocr_recognize', reason:'包含图片', method:'keyword' };
  if (/(ocr|识别|提取|文字|内容|表格|公式|手写|票据|发票|扫|读|文档|pdf|截图|图片)/.test(t) && !hasImage)
    return { tool:'chat_about_content', reason:'OCR上下文问答', method:'keyword' };
  if (/(生成|画|画一|做个|出个|设计|图像|图片|绘画)/.test(t))
    return { tool:'generate_image', reason:'文生图关键词', method:'keyword' };
  if (/(生成|做个|创建|短片|动画|视频)/.test(t))
    return { tool:'generate_video', reason:'视频生成关键词', method:'keyword' };
  if (/(翻译|译成|译为|翻成|translate|译|中译|英译|日译|韩译)/.test(t))
    return { tool:'translate', reason:'翻译关键词', method:'keyword' };
  if (/(搜索|查一下|最新|新闻|现在|今天|联网)/.test(t))
    return { tool:'web_search', reason:'联网搜索关键词', method:'keyword' };
  return { tool:'chat_about_content', reason:'常规问答', method:'keyword' };
}

/* ---------- 路由方案2：AI 小模型路由 (glm-4.7-flash) ---------- */
async function routeIntentAI(text, hasImage) {
  if (hasImage) return { tool:'ocr_recognize', reason:'包含图片', method:'ai' };
  if (!text || !text.trim()) return { tool:'chat_about_content', reason:'空输入', method:'ai' };

  const key = apiKey('zhipu');
  if (!key) {
    console.warn('智谱 Key 未填写，降级为关键词匹配');
    const kw = routeIntentKeyword(text, false);
    kw.method = 'keyword(fallback)';
    return kw;
  }

  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'glm-4.7-flash',
        messages: [
          { role:'system',
            content: '你是一个路由助手。分析用户输入，判断意图并返回JSON。\n\n'
              + '意图类型：\n'
              + '- ocr_recognize: 用户上传了图片/PDF需要OCR识别文字\n'
              + '- chat_about_content: 普通对话、问答、文档内容讨论、总结\n'
              + '- translate: 翻译任务，将文本从一种语言翻译为另一种语言\n'
              + '- generate_image: 要求生成/画图/设计/创建图像\n'
              + '- generate_video: 要求生成/制作/创建视频\n'
              + '- web_search: 需要联网搜索最新信息、新闻、实时数据\n\n'
              + '只返回JSON：{"tool":"<意图>","reason":"<简短理由(中文)>"}\n'
              + '不要返回其他内容。' },
          { role:'user', content: text.slice(0, 500) }
        ],
        temperature: 0,
        max_tokens: 128,
        stream: false,
      }),
    });

    if (!resp.ok) throw new Error(`Router HTTP ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (ROUTE_DEFAULTS[parsed.tool]) {
        return { tool: parsed.tool, reason: parsed.reason || 'AI路由判断', method:'ai' };
      }
    }
    throw new Error('Invalid router response: ' + content.slice(0, 100));
  } catch (e) {
    console.warn('AI路由失败，降级为关键词匹配:', e.message);
    const kw = routeIntentKeyword(text, false);
    kw.method = 'keyword(fallback)';
    return kw;
  }
}

/* ---------- 路由调度器 ---------- */
async function routeIntent(text, hasImage) {
  if (state.routerMode === 'keyword') {
    return routeIntentKeyword(text, hasImage);
  }
  return await routeIntentAI(text, hasImage);
}
function resolveModelFor(tool) {
  const mid = ROUTE_DEFAULTS[tool];
  if (findModel(mid)) return mid;
  return 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';
}

/* ---------- 附件（图片/PDF）---------- */
function fileToDataUrl(file) {
  return new Promise((rs, rj) => {
    const fr = new FileReader();
    fr.onload = () => rs({ name:file.name, mime:file.type||'application/octet-stream',
                           dataUrl:fr.result, size:file.size });
    fr.onerror = rj;
    fr.readAsDataURL(file);
  });
}
function renderAttachChips() {
  const wrap = $('#attachChips'); if (!wrap) return;
  if (!state.pendingImages.length) { wrap.innerHTML=''; return; }
  wrap.innerHTML = state.pendingImages.map((a,i) =>
    `<div class="chip">
      <span class="chip-name">${esc(a.name)} <em>${(a.size/1024).toFixed(0)} KB</em></span>
      <button class="chip-x" data-i="${i}" title="移除">×</button>
    </div>`).join('');
  wrap.querySelectorAll('.chip-x').forEach(b => b.onclick = () => {
    state.pendingImages.splice(+b.dataset.i, 1);
    renderAttachChips(); renderFilePreview();
  });
}
function renderFilePreview() {
  const wrap = $('#filePreviewWrap'); if (!wrap) return;
  if (!state.pendingImages.length) { wrap.innerHTML=''; return; }
  wrap.innerHTML = state.pendingImages.map(a => {
    if (a.mime.startsWith('image/'))
      return `<img class="preview-thumb" src="${a.dataUrl}" alt="${esc(a.name)}" onclick="openLightbox('${a.dataUrl.replace(/'/g,"\\'")}')">`;
    return `<div class="preview-thumb pdf">📄<span>${esc(a.name)}</span></div>`;
  }).join('');
}
async function handleFiles(fileList) {
  const files = [...fileList].filter(f => /(image\/|application\/pdf)/.test(f.type));
  if (!files.length) { toast('请选择图片或PDF文件'); return; }
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) { toast(`文件过大跳过: ${f.name}`); continue; }
    try { state.pendingImages.push(await fileToDataUrl(f)); }
    catch { toast('读取文件失败'); }
  }
  renderAttachChips(); renderFilePreview(); scrollToBottom(60);
  const ci = $('#composerInput');
  if (ci) ci.focus();
}

/* ---------- 消息渲染 ---------- */
function renderMessages() {
  const stream = $('#stream'); const hero = $('#hero'); const welcome = $('#welcomeMsg');
  if (!stream) return;

  if (!state.messages.length) {
    if (hero) hero.style.display = '';
    if (welcome) welcome.style.display = '';
    stream.querySelectorAll('.msg:not(#welcomeMsg)').forEach(n => n.remove());
    return;
  }
  if (hero) hero.style.display = 'none';
  if (welcome) welcome.style.display = 'none';
  stream.querySelectorAll('.msg:not(#welcomeMsg)').forEach(n => n.remove());
  for (const m of state.messages) stream.appendChild(buildMsgEl(m));
  scrollToBottom(30);
}
function buildMsgEl(m) {
  const el = document.createElement('section');
  el.className = `msg ${m.role}`; el.dataset.msgId = m.id;
  const isAi = m.role === 'ai';
  const intent = m.intent ? `<div class="intent-chip">🪄 ${esc(m.intent)}</div>` : '';
  const modelTag = m.model ? `<div class="model-tag">${esc(findModel(m.model)?.model.label||m.model)}</div>` : '';
  const attach = (m.attachments||[]).map(a => {
    if (a.mime?.startsWith('image/'))
      return `<img class="msg-img" src="${a.dataUrl}" onclick="openLightbox('${a.dataUrl.replace(/'/g,"\\'")}')">`;
    if (a.mime === 'application/pdf')
      return `<div class="msg-pdf">📄 ${esc(a.name||'PDF')} <em>${(a.size/1024).toFixed(0)} KB</em></div>`;
    return '';
  }).join('');
  const thinking = m._thinking ? '<div class="thinking"><span></span><span></span><span></span></div>' : '';
  const atc = isAi && !m._thinking ? `
    <div class="ai-actions">
      <button class="icon-btn xxs" title="复制回答" data-act="copy">📋</button>
      <button class="icon-btn xxs" title="引用" data-act="quote">↩️</button>
      <button class="icon-btn xxs" title="重新生成" data-act="regen">🔁</button>
      <button class="icon-btn xxs danger" title="删除" data-act="del">🗑️</button>
    </div>` : '';
  el.innerHTML = `
    <div class="avatar">${isAi?'🤖':'👤'}</div>
    <div class="bubble">
      ${intent}${modelTag}
      ${attach}
      <div class="mdx">${thinking || (isAi ? renderMarkdown(m.content||'') : esc(m.content||''))}</div>
      ${atc}
    </div>`;
  if (isAi) {
    el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a==='copy') { copyText(m.content||''); toast('已复制回答'); }
      if (a==='quote') { const ci = $('#composerInput'); if (ci) { ci.value = `> ${(m.content||'').slice(0,200).replace(/\n/g,'\n> ')}\n\n`; ci.focus(); } }
      if (a==='regen') { regenerate(m.id); }
      if (a==='del') { state.messages = state.messages.filter(x=>x.id!==m.id); savePrefs(); renderMessages(); }
    });
  }
  return el;
}

/* ---------- 极简 Markdown ---------- */
function renderMarkdown(s) {
  let t = esc(s || '');
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m,lang,code) =>
    `<pre><code class="lang-${esc(lang)}">${code}</code></pre>`);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|\n)(#{1,6})\s+(.+)/g, (_m, nl, hs, txt) => {
    const lv = hs.length;
    return `${nl}<h${lv}>${txt}</h${lv}>`;
  });
  t = t.replace(/(^|\n)\s*[-*]\s+(.+)/g, '$1<li>$2</li>');
  t = t.replace(/(?:<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  t = t.replace(/(^|\n)\s*(\d+)\.\s+(.+)/g, '$1<li value="$2">$3</li>');
  t = t.replace(/(?:<li value="\d+">.*<\/li>\n?)+/g, m => `<ol>${m}</ol>`);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

/* ---------- 复制 ---------- */
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta); return true;
  }
}

/* ---------- Lightbox ---------- */
window.openLightbox = function(src) {
  const w = $('#lightboxWrap'); if (!w) return;
  w.classList.add('active');
  w.innerHTML = `<div class="lightbox-mask"><img src="${esc(src)}" class="lightbox-img"></div>`;
  w.onclick = () => { w.innerHTML=''; w.onclick=null; w.classList.remove('active'); };
};

/* ---------- 停止生成 ---------- */
function stopGeneration() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.isGenerating = false;
  clearTaskStatus();
  const sb = $('#sendBtn');
  if (sb) {
    sb.disabled = false;
    sb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sb.classList.remove('stop-btn');
  }
  const thinking = state.messages.find(m => m._thinking);
  if (thinking) {
    thinking._thinking = false;
    thinking.content = thinking.content ? thinking.content + '\n\n*[已停止]*' : '*[已停止]*';
    renderMessages();
  }
  setRibbon('已停止', '用户手动停止');
}

/* ---------- 发送主流程 ---------- */
async function send() {
  if (state.isGenerating) {
    stopGeneration();
    return;
  }
  const inputEl = $('#composerInput');
  if (!inputEl) return;
  const txt = inputEl.value.trim();
  const hasImg = !!state.pendingImages.length;
  if (!txt && !hasImg) { toast('请上传图片或输入文字'); return; }

  state.isGenerating = true;
  const sb = $('#sendBtn');
  if (sb) {
    sb.disabled = false;
    sb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>';
    sb.classList.add('stop-btn');
  }

  setTaskStatus('🧠 分析意图', state.smartRouter ? 'AI智能路由分析中…' : '使用已选模型');
  const intent = await routeIntent(txt, hasImg);
  let modelId = state.smartRouter
    ? resolveModelFor(intent.tool)
    : (state.selectedModel || resolveModelFor(intent.tool));
  const found = findModel(modelId);
  if (!found) { toast('未找到模型'); state.isGenerating = false; clearTaskStatus(); const sb0 = $('#sendBtn'); if (sb0) sb0.disabled = false; return; }

  const attachments = state.pendingImages.slice();
  const userMsg = {
    id: crypto.randomUUID?.() || 'u'+Date.now(),
    role: 'user', content: txt, ts: Date.now(),
    attachments: attachments.length ? attachments : undefined,
  };
  state.messages.push(userMsg);
  state.pendingImages = []; renderAttachChips(); renderFilePreview();
  inputEl.value = ''; inputEl.style.height='auto';
  requestAnimationFrame(() => renderMessages());

  try {
    if (intent.tool === 'generate_image') {
      await runImageGen(userMsg, modelId);
    } else if (intent.tool === 'generate_video') {
      await runVideoGen(userMsg, modelId);
    } else {
      await runChat(userMsg, modelId, intent);
    }
  } catch (e) {
    console.error('send error:', e);
    clearTaskStatus();
    const errMsg = e.message || String(e);
    if (!state.messages.some(m => m._thinking)) {
      appendAI(`❌ 请求出错：${errMsg}`, modelId, intent.tool);
    } else {
      const thinking = state.messages.find(m => m._thinking);
      if (thinking) { thinking._thinking = false; thinking.content = `❌ 请求出错：${errMsg}`; }
      renderMessages();
    }
    setRibbon('请求失败', 'Error');
  }
  state.isGenerating = false;
  state.abortController = null;
  const sb2 = $('#sendBtn');
  if (sb2) {
    sb2.disabled = false;
    sb2.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sb2.classList.remove('stop-btn');
  }
}

/* ---------- 聊天/多模态（SSE 流式）---------- */
async function runChat(userMsg, modelId, intent) {
  const { provider, model } = findModel(modelId);
  const key = apiKey(provider.id);
  if (!key) {
    toast(`${provider.label} Key 未填写，请在左侧 API Keys 中填写`);
    throw new Error(`Missing API Key: ${provider.label}`);
  }

  const isOCR = intent.tool === 'ocr_recognize';
  const isOcrModel = modelId.includes('OCR') || modelId.includes('PaddleOCR');
  const isReasoning = (model.caps||[]).some(c => c === 'reasoning');
  const taskName = isOCR ? '🔍 OCR文字识别' : '💬 AI对话生成';
  setTaskStatus(taskName, `${provider.label} · ${model.label}`);

  const hasAttachment = (userMsg.attachments?.length > 0);
  const needVision = hasAttachment || (model.caps||[]).some(c=>['ocr','vision'].includes(c));
  const msgs = buildChatMessages(needVision, isOcrModel);

  const hasStream = true;
  const modelParams = model.params || {};
  const body = {
    model: modelId,
    messages: msgs,
    stream: hasStream,
    temperature: modelParams.temperature ?? (isOCR ? 0 : 0.2),
    max_tokens: modelParams.max_tokens ?? (isOCR ? 16384 : 4096),
  };

  if (modelParams.top_p != null) body.top_p = modelParams.top_p;

  if (isReasoning && modelParams.thinking_budget != null) {
    body.thinking_budget = modelParams.thinking_budget;
  }

  const aiId = 'a'+Date.now();
  const aiMsg = { id:aiId, role:'ai', content:'', ts:Date.now(), model:modelId, intent:intent.tool, provider:provider.id, _thinking:true };
  state.messages.push(aiMsg);
  renderMessages();
  scrollToBottom(0);

  const controller = new AbortController();
  state.abortController = controller;
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let resp;
  try {
    resp = await fetch(provider.baseUrl + provider.endpoints.chat, {
      method:'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    state.abortController = null;
    if (e.name === 'AbortError') throw new Error('请求超时（120秒），请重试');
    throw new Error(`网络错误：${e.message}`);
  }
  clearTimeout(timeoutId);
  state.abortController = null;

  if (!resp.ok) {
    const errText = await resp.text().catch(()=>'');
    let errDetail = errText;
    try { errDetail = JSON.parse(errText).error?.message || errText.slice(0,300); } catch {}
    throw new Error(`HTTP ${resp.status}: ${errDetail}`);
  }

  if (!hasStream) {
    const d = await resp.json();
    const c = d.choices?.[0]?.message?.content ?? '';
    aiMsg._thinking = false;
    aiMsg.content = c;
    renderMessages();
    setRibbon(c.length+' 字', `${provider.label} · ${model.label} · 完成 ✅`);
    clearTaskStatus();
    savePrefs();
    return;
  }

  const reader = resp.body.getReader(); const dec = new TextDecoder('utf-8');
  let buf='', full='', first=true, chunkCount=0;
  const msgEl = document.querySelector(`.msg[data-msg-id="${aiId}"]`);
  const mdxEl = msgEl?.querySelector('.mdx');
  if (msgEl) msgEl.classList.add('streaming');

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {stream:true});
    const lines = buf.split(/\r?\n/); buf = lines.pop()||'';
    for (const ln of lines) {
      if (!ln.startsWith('data:')) continue;
      const piece = ln.slice(5).trim();
      if (piece === '[DONE]') continue;
      try {
        const j = JSON.parse(piece);
        const c = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? '';
        if (!c) continue;
        full += c;
        chunkCount++;
        if (first) {
          aiMsg._thinking = false;
          if (mdxEl) mdxEl.innerHTML = '';
          setTaskStatus(taskName, `${provider.label} · ${model.label} · 输出中…`);
          first = false;
        }
        aiMsg.content = full;
        if (mdxEl && chunkCount % 3 === 0) {
          mdxEl.innerHTML = renderMarkdown(full);
        }
        scrollToBottom(0);
      } catch {}
    }
  }
  aiMsg._thinking = false;
  if (msgEl) msgEl.classList.remove('streaming');
  if (mdxEl) mdxEl.innerHTML = renderMarkdown(full);
  clearTaskStatus();
  setRibbon(full.length+' 字', `${provider.label} · ${model.label} · 完成 ✅`);
  savePrefs();
}

function buildChatMessages(needVision, isOcrModel) {
  const recent = state.messages.filter(m => m.role !== 'tool').slice(-12);
  const msgs = [];

  if (isOcrModel && needVision) {
    msgs.push({ role:'system', content: '你是一个OCR文字识别助手。请准确识别图片中的所有文字内容，保留原文格式。' });

    const lastUser = recent.filter(m => m.role === 'user').slice(-1);
    for (const m of lastUser) {
      const msgAtts = m.attachments || [];
      if (msgAtts.length > 0) {
        const parts = [{ type:'text', text: m.content||'请识别图片中的文字' }];
        for (const a of msgAtts) {
          if (a.mime?.startsWith('image/'))
            parts.push({ type:'image_url', image_url: { url: a.dataUrl, detail: 'high' } });
        }
        msgs.push({ role:'user', content: parts });
      } else {
        msgs.push({ role:'user', content: m.content || '请识别图片中的文字' });
      }
    }
    return msgs;
  }

  const isOCR = needVision && recent.some(m => (m.attachments||[]).length > 0);
  msgs.push({ role:'system', content: isOCR
    ? '你是专业的OCR文字识别助手。请准确识别图片/PDF中的所有文字内容。\n'
      + '规则：\n'
      + '1. 保留原文的段落结构、换行和缩进\n'
      + '2. 表格内容输出为Markdown表格格式\n'
      + '3. 数学公式输出为LaTeX格式（用$$包裹）\n'
      + '4. 不要添加任何解释、评论或开头语\n'
      + '5. 只输出识别到的文字内容，保持原文语言'
    : '你是 ChatOCR Pro 助手，擅长：\n'
      + '1. 识别图片/PDF中的文字、表格、公式、手写；\n'
      + '2. 对识别结果问答、翻译、整理；\n'
      + '3. 对话简洁专业，保留原文结构。' });

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const isLast = i === recent.length - 1;
    const msgAtts = (isLast ? m.attachments : null) || [];

    if (needVision && msgAtts.length > 0) {
      const parts = [{ type:'text', text: m.content||'请识别图片中的文字' }];
      for (const a of msgAtts) {
        if (a.mime?.startsWith('image/'))
          parts.push({ type:'image_url', image_url: { url: a.dataUrl, detail: 'high' } });
      }
      msgs.push({ role:'user', content: parts });
    } else {
      const textContent = m.content || '';
      if (m.role === 'user' && m.attachments?.length > 0 && !isLast) {
        msgs.push({ role:'user', content: textContent + '\n[已上传图片]' });
      } else {
        msgs.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: textContent });
      }
    }
  }
  return msgs;
}

function patchAI(msgId, content) {
  const m = state.messages.find(x => x.id === msgId); if (!m) return;
  m.content = content;
  const el = document.querySelector(`.msg[data-msg-id="${msgId}"]`);
  if (!el) return;
  const mdx = el.querySelector('.mdx');
  if (mdx) {
    mdx.innerHTML = renderMarkdown(content);
  }
  scrollToBottom(0);
}

function appendAI(content, modelId, intent) {
  const aiMsg = { id:'a'+Date.now(), role:'ai', content, ts:Date.now(), model:modelId, intent };
  state.messages.push(aiMsg); renderMessages(); savePrefs();
}

/* ---------- 文生图 ---------- */
async function runImageGen(userMsg, modelId) {
  const found = findModel(modelId); if (!found) throw new Error('模型未找到');
  const key = apiKey(found.provider.id);
  if (!key) { toast(`${found.provider.label} Key 未填写`); throw new Error('Missing API Key'); }
  setTaskStatus('🎨 图像生成', `${found.provider.label} · ${found.model.label}`);
  const resp = await fetch(found.provider.baseUrl + found.provider.endpoints.images, {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model:modelId, prompt: userMsg.content, n:1, size:'1024x1024', response_format:'url' })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(()=>'');
    throw new Error(`HTTP ${resp.status}: ${errText.slice(0,200)}`);
  }
  const d = await resp.json();
  const url = d.data?.[0]?.url || d.data?.[0]?.b64_json
    ? 'data:image/png;base64,'+d.data[0].b64_json : '';
  if (!url) throw new Error('无图像返回');
  appendAI(`\n![生成图像](${url})\n\n> ${esc(userMsg.content)}`, modelId, 'generate_image');
  clearTaskStatus();
  setRibbon('完成', '图像生成 ✅');
}

/* ---------- 视频生成（异步）---------- */
async function runVideoGen(userMsg, modelId) {
  const found = findModel(modelId); if (!found) throw new Error('模型未找到');
  const key = apiKey(found.provider.id);
  if (!key) { toast(`${found.provider.label} Key 未填写`); throw new Error('Missing API Key'); }
  setTaskStatus('🎬 视频生成', `${found.provider.label} · 提交任务中…`);
  const resp = await fetch(found.provider.baseUrl + found.provider.endpoints.videos, {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model:modelId, prompt: userMsg.content })
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(()=>'');
    throw new Error(`HTTP ${resp.status}: ${errText.slice(0,200)}`);
  }
  const d = await resp.json();
  const taskId = d.id || d.taskId;
  appendAI(`视频任务已提交，ID: \`${taskId}\`\n\n可稍后到 Agnes 平台查看结果。`, modelId, 'generate_video');
  clearTaskStatus();
  setRibbon('已提交', `视频任务 ${taskId}`);
}

/* ---------- 重新生成 ---------- */
function regenerate(aiMsgId) {
  const idx = state.messages.findIndex(m => m.id === aiMsgId);
  if (idx <= 0) return;
  const prevUser = state.messages[idx-1];
  if (prevUser?.role !== 'user') return;
  state.messages = state.messages.slice(0, idx);
  savePrefs(); renderMessages();
  if (prevUser.attachments) state.pendingImages = prevUser.attachments.slice();
  renderAttachChips(); renderFilePreview();
  const ri = $('#composerInput');
  if (ri) { ri.value = prevUser.content || ''; autoGrow(ri); }
  send();
}

/* ---------- 导入/导出/清空 ---------- */
function exportSession() {
  if (!state.messages.length) { toast('无会话可导出'); return; }
  const blob = new Blob([JSON.stringify({
    version:1, ts:Date.now(), messages:state.messages,
    selectedModel:state.selectedModel, smartRouter:state.smartRouter,
    routerMode: state.routerMode,
  }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chatocr-session-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  toast('已导出会话');
}
function importSession(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!Array.isArray(d.messages)) throw new Error('格式错误');
      state.messages = d.messages;
      state.selectedModel = d.selectedModel || null;
      state.smartRouter = d.smartRouter ?? true;
      state.routerMode = d.routerMode || 'ai';
      const rt3 = $('#routerToggle');
      if (rt3) rt3.checked = state.smartRouter;
      updateRouterModeUI();
      renderModelList(); renderMessages(); savePrefs();
      toast(`已导入 ${d.messages.length} 条消息`);
    } catch { toast('导入失败：文件格式不正确'); }
  };
  fr.onerror = () => toast('读取文件失败');
  fr.readAsText(file);
}
function clearAllMessages() {
  if (!state.messages.length) return;
  confirmAsync('确认清空上下文对话？之前的对话记录将被清除，但模型选择与 Key 配置保留。', () => {
    state.messages = []; state.pendingImages = [];
    state.currentTask = null;
    state.abortController = null;
    renderAttachChips(); renderFilePreview();
    savePrefs(); renderMessages();
    clearTaskStatus();
    toast('已清空上下文');
  });
}
function newConversation() {
  const doIt = () => {
    state.messages = []; state.pendingImages = [];
    state.selectedModel = null;
    state.smartRouter = true;
    state.currentTask = null;
    state.abortController = null;
    const rt = $('#routerToggle'); if (rt) rt.checked = true;
    renderAttachChips(); renderFilePreview();
    renderModelList(); renderMessages(); savePrefs();
    clearTaskStatus();
    setRibbon('新对话', '🪄 智能路由已启用');
    toast('🆕 已开启新对话');
  };
  if (state.messages.length) {
    confirmAsync('开启新对话将清空当前所有对话记录，是否继续？', doIt);
  } else {
    doIt();
  }
}
function copyAllAnswers() {
  const s = state.messages.filter(m=>m.role==='ai').map(m=>m.content).filter(Boolean).join('\n\n---\n\n');
  if (!s) { toast('暂无可复制的回答'); return; }
  copyText(s); toast('已复制全部回答');
}

/* ---------- 偏好 ---------- */
function savePrefs() {
  setTimeout(() => {
    localStorage.setItem('ocr:msgs', JSON.stringify(state.messages));
    localStorage.setItem('ocr:prefs', JSON.stringify({
      smartRouter: state.smartRouter, selectedModel: state.selectedModel,
      routerMode: state.routerMode,
    }));
    Object.values(PROVIDERS).forEach(p => {
      const v = document.getElementById(p.keyEl)?.value || '';
      localStorage.setItem('key:'+p.id, v);
    });
  }, 0);
}
function loadPrefs() {
  try { state.messages = JSON.parse(localStorage.getItem('ocr:msgs')||'[]'); } catch { state.messages = []; }
  try {
    const pr = JSON.parse(localStorage.getItem('ocr:prefs')||'{}');
    state.smartRouter = pr.smartRouter ?? true;
    state.selectedModel = pr.selectedModel || null;
    state.routerMode = pr.routerMode || 'ai';
  } catch {}
  const sf = localStorage.getItem('key:siliconflow'); if (sf) { const el = $('#siliconflowKey'); if (el) el.value = sf; }
  const zp = localStorage.getItem('key:zhipu');      if (zp) { const el = $('#zhipuKey'); if (el) el.value = zp; }
  const ag = localStorage.getItem('key:agnes');      if (ag) { const el = $('#agnesKey'); if (el) el.value = ag; }
}

/* ---------- 自动增长 Textarea ---------- */
function autoGrow(ta) {
  if (!ta) return;
  if (ta._userResized) return;
  ta.style.height = 'auto';
  const newH = Math.min(ta.scrollHeight, 320);
  ta.style.height = newH + 'px';
  ta._lastAutoHeight = newH;
}

/* ---------- 欢迎消息 & Hero 互动绑定 ---------- */
function bindWelcomeInteractions() {
  const wm = $('#welcomeMsg');
  if (wm) {
    wm.querySelectorAll('li[data-action]').forEach(li => {
      li.style.cursor = 'pointer';
      li.style.transition = 'background .15s, transform .15s';
      li.style.padding = '4px 10px 4px 8px';
      li.style.borderRadius = '7px';
      li.style.marginBottom = '2px';
      li.onmouseenter = () => { li.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; li.style.transform = 'translateX(2px)'; };
      li.onmouseleave = () => { li.style.background = 'transparent'; li.style.transform = 'translateX(0)'; };
      li.onclick = () => handleWelcomeAction(li.dataset.action, li.dataset.template);
    });
  }
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.style.cursor = 'pointer';
    brand.title = '回到顶部';
    brand.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const ribbon = document.querySelector('.ribbon');
  if (ribbon) {
    ribbon.style.cursor = 'pointer';
    ribbon.title = '点击切换：手动选模型 / 智能路由';
    ribbon.onclick = () => {
      const t = $('#routerToggle'); if (!t) return;
      t.checked = !t.checked; t.dispatchEvent(new Event('change'));
      const modeLabel = state.smartRouter
        ? (state.routerMode === 'ai' ? '🤖 AI路由' : '🔤 关键词')
        : '✋ 手动模式';
      toast(state.smartRouter ? `${modeLabel} 已开启` : '✋ 已切换为手动模式');
    };
  }
}

function handleWelcomeAction(action, template) {
  const input = $('#composerInput');
  if (!input) return;
  switch(action) {
    case 'upload-focus':
      document.getElementById('fileInput')?.click();
      break;
    case 'prompt-template':
      if (template) input.value = template + ' ';
      input.focus(); autoGrow(input);
      scrollToBottom();
      break;
    case 'focus-input':
      input.focus(); autoGrow(input);
      scrollToBottom();
      break;
    case 'export':
      exportSession();
      break;
  }
}

function updateRouterModeUI() {
  const label = $('#routerModeLabel');
  if (!label) return;
  if (state.routerMode === 'ai') {
    label.innerHTML = '🤖 AI路由';
    label.title = '点击切换为关键词匹配路由';
  } else {
    label.innerHTML = '🔤 关键词';
    label.title = '点击切换为AI模型路由';
  }
}

/* ---------- init() 入口 ---------- */
function init() {
  bindThemeToggle();
  loadPrefs();
  updateRouterModeUI();
  renderModelList();
  renderMessages();
  bindWelcomeInteractions();
  clearTaskStatus();

  const rt = $('#routerToggle');
  if (rt) {
    rt.checked = state.smartRouter;
    rt.onchange = e => {
      state.smartRouter = e.target.checked;
      if (state.smartRouter) { state.selectedModel = null; renderModelList(); }
      savePrefs();
      if (!state.currentTask) {
        setRibbon(state.smartRouter
          ? (state.routerMode === 'ai' ? '🤖 AI智能路由已启用' : '🔤 关键词匹配路由已启用')
          : '智能路由已关闭',
          state.smartRouter
          ? (state.routerMode === 'ai' ? 'AI模型自动匹配' : '关键词规则匹配')
          : '请手动选择模型');
      }
    };
  }

  const rml = $('#routerModeLabel');
  if (rml) {
    rml.style.cursor = 'pointer';
    rml.onclick = e => {
      e.preventDefault();
      if (!state.smartRouter) {
        toast('请先开启智能路由');
        return;
      }
      state.routerMode = state.routerMode === 'ai' ? 'keyword' : 'ai';
      updateRouterModeUI();
      savePrefs();
      setRibbon(
        state.routerMode === 'ai' ? '🤖 AI路由已启用' : '🔤 关键词匹配已启用',
        state.routerMode === 'ai' ? 'glm-4.7-flash 智能判断意图' : '正则规则匹配意图'
      );
      toast(state.routerMode === 'ai' ? '已切换为 🤖 AI模型路由' : '已切换为 🔤 关键词匹配');
    };
  }

  const uz = $('#uploadZone'), fi = $('#fileInput');
  if (uz) {
    uz.onclick = () => fi?.click();
    uz.ondragover = e => { e.preventDefault(); uz.classList.add('dz-on'); };
    uz.ondragleave = () => uz.classList.remove('dz-on');
    uz.ondrop = e => { e.preventDefault(); uz.classList.remove('dz-on'); handleFiles(e.dataTransfer.files); };
  }
  if (fi) fi.onchange = e => handleFiles(e.target.files);

  document.ondragover = e => e.preventDefault();
  document.ondrop = e => {
    e.preventDefault();
    if (e.target.closest('#uploadZone')) return;
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const cfi = $('#composerFileInput');
  const cfb = $('#composerFileBtn');
  if (cfb) cfb.onclick = () => cfi?.click();
  if (cfi) cfi.onchange = e => handleFiles(e.target.files);

  $$('.example-card').forEach(c => {
    c.onclick = () => {
      const input = $('#composerInput');
      if (!input) return;
      input.value = c.dataset.prompt + ' ';
      if (c.dataset.requiresImage === 'true' && !state.pendingImages.length) {
        document.getElementById('fileInput')?.click();
        toast('请先上传图片，然后点击发送');
      }
      input.focus();
      autoGrow(input);
      scrollToBottom();
    };
  });

  const exBtn = $('#exportBtn');
  if (exBtn) exBtn.onclick = exportSession;
  const imBtn = $('#importBtn');
  if (imBtn) imBtn.onclick = () => $('#importFileInput')?.click();
  const importFi = $('#importFileInput');
  if (importFi) importFi.onchange = e => { const f=e.target.files[0]; if (f) importSession(f); e.target.value=''; };
  const caBtn = $('#copyAllBtn');
  if (caBtn) caBtn.onclick = copyAllAnswers;
  const clBtn = $('#clearBtn');
  if (clBtn) clBtn.onclick = clearAllMessages;
  const ncBtn = $('#newChatBtn');
  if (ncBtn) ncBtn.onclick = newConversation;

  $$('.key-input').forEach(inp => inp.onchange = savePrefs);

  const ta = $('#composerInput');
  if (ta) {
    ta.oninput = () => autoGrow(ta);
    document.addEventListener('mouseup', () => {
      const h = parseInt(ta.style.height);
      if (h && ta._lastAutoHeight != null && Math.abs(h - ta._lastAutoHeight) > 5) {
        ta._userResized = true;
      }
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.isGenerating) { e.preventDefault(); stopGeneration(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    autoGrow(ta);
  }
  const sb = $('#sendBtn');
  if (sb) sb.onclick = send;

  const heroBtn = document.querySelector('button[data-action="upload-focus"]');
  if (heroBtn) heroBtn.onclick = () => document.getElementById('fileInput')?.click();
}

document.addEventListener('DOMContentLoaded', init);