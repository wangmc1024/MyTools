/**
 * ui.js — DOM rendering layer. Message bubbles, the signature routing ribbon,
 * markdown, media cards, lightbox, toast, typewriter, modals.
 */

/* ---------- Markdown ---------- */
export function renderMarkdown(text) {
  if (!text) return '';
  try {
    if (window.marked) {
      const md = window.marked;
      md.setOptions?.({ breaks: true, gfm: true });
      return md.parse(text);
    }
  } catch {}
  return escapeHtml(text).replace(/\n/g, '<br>');
}

export function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

/* ---------- Toast (reuse repo global if present) ---------- */
export function toast(msg, type = 'info') {
  if (window.showToast) return window.showToast(msg, type);
  console.log('[toast]', type, msg);
}

/* ---------- Routing ribbon — the signature element ---------- */
// Phases: 'idle' | 'thinking' | tool-name active | 'running' | 'done' | 'error'
export function makeRibbon(el) {
  const labelEl = el.querySelector('.ribbon-label');
  const chipsEl = el.querySelector('.ribbon-chips') || el;
  const progressEl = el.querySelector('.ribbon-progress');

  function clearChips() {
    [...chipsEl.querySelectorAll('.chip, .chip-arrow')].forEach(c => c.remove());
    if (progressEl) progressEl.textContent = '';
  }

  function chip(text, state = '', withArrow = false) {
    if (withArrow) {
      const a = document.createElement('span');
      a.className = 'chip-arrow';
      a.innerHTML = '&rarr;';
      chipsEl.appendChild(a);
    }
    const c = document.createElement('span');
    c.className = 'chip' + (state ? ' is-' + state : '');
    c.innerHTML = `<span class="dot"></span><span>${escapeHtml(text)}</span>`;
    chipsEl.appendChild(c);
    return c;
  }

  return {
    idle() {
      el.classList.add('idle');
      clearChips();
      if (labelEl) labelEl.style.display = '';
      el.setAttribute('aria-live', 'off');
    },
    thinking() {
      el.classList.remove('idle');
      clearChips();
      if (labelEl) labelEl.style.display = 'none';
      chip('路由判定中…', 'active');
      el.setAttribute('aria-live', 'polite');
    },
    /** Show the chosen tool + target model, animating them in. */
    route(toolName, modelName) {
      clearChips();
      if (labelEl) labelEl.style.display = 'none';
      chip(prettyTool(toolName), 'active');
      const c2 = chip(modelName ? shortModel(modelName) : '执行中', '', true);
      c2.classList.add('is-active');
      el.setAttribute('aria-live', 'polite');
    },
    done(toolName, modelName, note) {
      clearChips();
      if (labelEl) labelEl.style.display = 'none';
      chip(prettyTool(toolName), 'done');
      chip(modelName ? shortModel(modelName) : '完成', 'done', true);
      if (note) {
        const c3 = chip(note, 'done', true);
      }
    },
    error(msg) {
      el.classList.remove('idle');
      clearChips();
      if (labelEl) labelEl.style.display = 'none';
      chip(msg || '失败', 'error');
    },
    progress(pct, text) {
      if (progressEl) progressEl.textContent = text || (pct != null ? pct + '%' : '');
    },
    el,
  };
}

function prettyTool(t) {
  return ({
    ocr_recognize: 'OCR 识别',
    chat_about_content: '内容问答',
    generate_image: '生成图片',
    generate_video: '生成视频',
    web_search: '联网搜索',
  })[t] || t;
}
function shortModel(m) {
  return m.split('/').pop();
}

/* ---------- Message rendering ---------- */
/**
 * Append a message row. renderable: { kind, text?, imageUrls?, videoUrl?, refs?, reasoning?, meta? }
 * role: 'user' | 'ai'
 */
export function appendMessage(container, role, renderable, { onUseForFollowUp } = {}) {
  const row = document.createElement('div');
  row.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = role === 'user' ? '你' : 'C';
  row.appendChild(av);

  const inner = document.createElement('div');
  inner.className = 'msg-inner';

  // user attachment preview
  if (role === 'user' && renderable?.attachmentUrl) {
    const img = document.createElement('img');
    img.className = 'msg-image';
    img.src = renderable.attachmentUrl;
    inner.appendChild(img);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const kind = renderable?.kind || 'text';

  if (renderable?.reasoning) {
    const r = document.createElement('div');
    r.className = 'reasoning';
    r.textContent = renderable.reasoning.slice(0, 600) + (renderable.reasoning.length > 600 ? '…' : '');
    bubble.appendChild(r);
  }

  if (kind === 'image' && renderable.imageUrls?.length) {
    const grid = document.createElement('div');
    grid.className = 'media-grid';
    for (const u of renderable.imageUrls) {
      const card = document.createElement('div');
      card.className = 'media-card';
      const img = document.createElement('img');
      img.src = u; img.alt = renderable.revised_prompt || '生成图片';
      img.loading = 'lazy';
      card.appendChild(img);
      card.addEventListener('click', () => openLightbox(u, 'image'));
      grid.appendChild(card);
    }
    bubble.appendChild(grid);
    if (renderable.revised_prompt) {
      const p = document.createElement('div');
      p.style.cssText = 'font-size:12px;color:var(--text-faint);margin-top:8px';
      p.textContent = '提示词增强: ' + renderable.revised_prompt;
      bubble.appendChild(p);
    }
  } else if (kind === 'video' && renderable.videoUrl) {
    const v = document.createElement('video');
    v.className = 'video-el';
    v.src = renderable.videoUrl;
    v.controls = true;
    v.playsInline = true;
    bubble.appendChild(v);
  } else {
    // text / ocr / web
    const body = document.createElement('div');
    body.className = 'md';
    body.innerHTML = renderMarkdown(renderable?.text || renderable?.content || '');
    bubble.appendChild(body);

    if (kind === 'web' && renderable.refs?.length) {
      bubble.appendChild(renderRefs(renderable.refs));
    }
    if (kind === 'ocr' && onUseForFollowUp) {
      const hint = document.createElement('button');
      hint.className = 'intent';
      hint.style.cssText = 'margin-top:10px;font-size:12px';
      hint.textContent = '✓ 已存入上下文 · 可继续追问';
      hint.disabled = true;
      hint.style.cursor = 'default';
      hint.style.opacity = '0.8';
      bubble.appendChild(hint);
    }
  }

  inner.appendChild(bubble);

  if (renderable?.meta) {
    const m = document.createElement('div');
    m.className = 'msg-meta';
    m.textContent = renderable.meta;
    inner.appendChild(m);
  }

  row.appendChild(inner);
  container.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return row;
}

function renderRefs(refs) {
  const wrap = document.createElement('div');
  wrap.className = 'refs';
  wrap.innerHTML = '<div class="refs-title">来源</div>';
  refs.slice(0, 8).forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'ref-item';
    const idx = `<span class="ref-idx">[${i + 1}]</span>`;
    const link = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title || r.url)}</a>` : escapeHtml(r.title || '');
    const snip = r.snippet ? ` <span style="color:var(--text-faint)">— ${escapeHtml(r.snippet.slice(0, 80))}</span>` : '';
    item.innerHTML = `${idx} ${link}${snip}`;
    wrap.appendChild(item);
  });
  return wrap;
}

/** Thinking placeholder row. Returns { row, body } to update later. */
export function appendThinking(container, role = 'ai') {
  const row = document.createElement('div');
  row.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = role === 'user' ? '你' : 'C';
  const inner = document.createElement('div');
  inner.className = 'msg-inner';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';
  inner.appendChild(bubble);
  row.appendChild(av);
  row.appendChild(inner);
  container.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return { row, bubble };
}

/* ---------- Lightbox ---------- */
export function openLightbox(src, type = 'image') {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<span class="lb-close">&times;</span>';
  if (type === 'video') {
    const v = document.createElement('video');
    v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
    lb.appendChild(v);
  } else {
    const img = document.createElement('img');
    img.src = src; lb.appendChild(img);
  }
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.classList.contains('lb-close')) lb.remove();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(lb);
}

/* ---------- Typewriter ---------- */
export async function typewriter(targetEl, text, { speed } = {}) {
  const total = text.length;
  const step = Math.max(2, Math.floor(total / 120)); // chunk size
  const delay = speed || Math.max(8, Math.floor(2400 / Math.max(1, total)));
  targetEl.innerHTML = '';
  for (let i = 0; i <= total; i += step) {
    targetEl.innerHTML = renderMarkdown(text.slice(0, i));
    targetEl.closest('.stream')?.lastElementChild?.scrollIntoView({ block: 'end' });
    await new Promise(r => setTimeout(r, delay));
  }
  targetEl.innerHTML = renderMarkdown(text);
}
