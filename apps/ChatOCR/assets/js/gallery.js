/**
 * gallery.js — Gallery page logic. Reads localStorage media store,
 * renders masonry-ish grid of images + videos. Filter, lightbox, delete.
 */
import { initTheme } from './theme.js';
import { loadMedia, deleteMedia, loadVideoTasks, deleteVideoTask } from './media.js';
import { openLightbox, escapeHtml, toast } from './ui.js';

let filter = 'all';

function init() {
  initTheme();
  bindFilters();
  render();
}

function bindFilters() {
  document.querySelectorAll('.filter-bar .seg').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar .seg').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      render();
    });
  });
}

function render() {
  const grid = document.getElementById('galleryGrid');
  const media = loadMedia();
  const tasks = loadVideoTasks().filter(t => t.status !== 'succeeded');

  const shown = media.filter(m => filter === 'all' || m.type === filter);

  if (!shown.length && !tasks.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="em-icon">🖼️</div>
        <h3>还没有生成的作品</h3>
        <p>回到工作台生成图片或视频，它们会出现在这里。<br>
        <a href="./index.html">← 返回工作台</a></p>
      </div>`;
    return;
  }

  let html = '';
  for (const m of shown) {
    const isVid = m.type === 'video';
    const thumb = m.thumb || m.url;
    const date = new Date(m.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    html += `
      <div class="g-card" data-id="${m.id}">
        <div class="g-media" data-src="${escapeHtml(m.url)}" data-type="${m.type}">
          ${isVid
            ? `<video class="g-vid" src="${escapeHtml(m.url)}" muted preload="metadata"></video>`
            : `<img class="g-img" src="${escapeHtml(thumb)}" alt="${escapeHtml(m.prompt)}" loading="lazy">`}
        </div>
        <div class="g-info">
          <div class="g-prompt">${escapeHtml(m.prompt || '(无提示词)')}</div>
          <div class="g-foot">
            <span class="g-meta">${isVid ? '🎬' : '🖼️'} ${shortModel(m.model)} · ${date}</span>
            <button class="g-del" data-id="${m.id}" title="删除">🗑</button>
          </div>
        </div>
      </div>`;
  }

  // pending video tasks
  for (const t of tasks) {
    const date = new Date(t.ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    html += `
      <div class="g-card" data-task="${t.video_id}">
        <div class="g-media" style="display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;background:var(--bg-secondary);color:var(--text-faint);font-size:12px">
          ⏳ 生成中…
        </div>
        <div class="g-info">
          <div class="g-prompt">${escapeHtml(t.prompt || '')}</div>
          <div class="g-foot">
            <span class="g-meta">🎬 ${t.status} · ${date}</span>
            <button class="g-del" data-task="${t.video_id}" title="清除任务">✕</button>
          </div>
        </div>
      </div>`;
  }

  grid.innerHTML = html;

  // bind clicks
  grid.querySelectorAll('.g-media').forEach(el => {
    el.addEventListener('click', () => {
      const src = el.dataset.src;
      const type = el.dataset.type;
      if (src) openLightbox(src, type);
    });
  });
  grid.querySelectorAll('.g-del[data-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMedia(btn.dataset.id);
      toast('已删除', 'success');
      render();
    });
  });
  grid.querySelectorAll('.g-del[data-task]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteVideoTask(btn.dataset.task);
      render();
    });
  });
}

function shortModel(m) { return (m || '').split('/').pop(); }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
