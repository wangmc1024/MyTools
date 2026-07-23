/**
 * MyTools Portal — Dashboard Logic
 * Fetches tools.json, renders cards, handles search/filter/theme/panels
 */

(function () {
  'use strict';

  let toolsData = [];
  let activeCategory = 'all';
  let searchQuery = '';

  const CATEGORIES = ['全部', 'Web Tool', '浏览器脚本', '效率工具', '阅读', '学习'];

  /* ---------- Load theme on start ---------- */
  setTheme(getTheme());

  /* ---------- Panel switching (Tools / Download) ---------- */
  const navTools = document.getElementById('navTools');
  const navDownload = document.getElementById('navDownload');
  const panelTools = document.getElementById('panelTools');
  const panelDownload = document.getElementById('panelDownload');

  function showPanel(name) {
    if (name === 'download') {
      panelTools.style.display = 'none';
      panelDownload.style.display = 'block';
      navTools.classList.remove('active');
      navDownload.classList.add('active');
    } else {
      panelTools.style.display = 'block';
      panelDownload.style.display = 'none';
      navTools.classList.add('active');
      navDownload.classList.remove('active');
    }
  }

  navTools.addEventListener('click', (e) => { e.preventDefault(); showPanel('tools'); });
  navDownload.addEventListener('click', (e) => { e.preventDefault(); showPanel('download'); });

  /* ---------- Render download list ---------- */
  function renderDownloads() {
    const listEl = document.getElementById('downloadList');
    const downloadables = toolsData.filter((t) => t.downloadUrl);

    if (downloadables.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无可用下载资源</p></div>';
      return;
    }

    listEl.innerHTML = downloadables.map((tool) => `
      <div class="download-item">
        <div class="download-item-icon">${escapeHtml(tool.icon)}</div>
        <div class="download-item-info">
          <div class="download-item-name">${escapeHtml(tool.name)}</div>
          <div class="download-item-meta">
            ${tool.version ? `<span>${escapeHtml(tool.version)}</span>` : ''}
            ${tool.fileType ? `<span>${escapeHtml(tool.fileType)}</span>` : ''}
            ${tool.updatedAt ? `<span>更新于 ${escapeHtml(formatDate(tool.updatedAt))}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${escapeHtml(tool.description)}</div>
        </div>
        <a href="${escapeHtml(tool.downloadUrl)}" class="btn btn-primary" target="_blank" rel="noopener">下载安装</a>
      </div>
    `).join('');
  }

  /* ---------- Fetch + render ---------- */
  async function init() {
    try {
      const resp = await fetch('assets/data/tools.json');
      if (!resp.ok) throw new Error('Failed to load tools.json');
      toolsData = await resp.json();
      renderCategories();
      renderTools();
      renderDownloads();
    } catch (e) {
      const grid = document.getElementById('toolsGrid');
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>' +
        escapeHtml(e.message) + '</p></div>';
      document.getElementById('downloadList').innerHTML = grid.innerHTML;
    }
  }

  /* ---------- Category tabs ---------- */
  function renderCategories() {
    const container = document.getElementById('categoryTabs');
    container.innerHTML = CATEGORIES.map((cat) => {
      const active = cat === '全部' ? '' : `data-category="${escapeHtml(cat)}"`;
      return `<button class="category-tab${cat === '全部' ? ' active' : ''}" ${active}>${escapeHtml(cat)}</button>`;
    }).join('');

    container.addEventListener('click', (e) => {
      const tab = e.target.closest('.category-tab');
      if (!tab) return;

      container.querySelectorAll('.category-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.category || 'all';
      renderTools();
    });
  }

  /* ---------- Search ---------- */
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTools();
  });

  /* ---------- Render tool cards ---------- */
  function renderTools() {
    const grid = document.getElementById('toolsGrid');
    const filtered = filterTools();

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>没有找到匹配的工具</p></div>';
      return;
    }

    grid.innerHTML = filtered.map((tool) => buildCard(tool)).join('');

    grid.querySelectorAll('.btn-open').forEach((btn) => {
      btn.addEventListener('click', () => { window.location.href = btn.dataset.url; });
    });
    grid.querySelectorAll('.btn-download').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); window.open(btn.dataset.url, '_blank'); });
    });
  }

  function filterTools() {
    return toolsData.filter((tool) => {
      if (activeCategory !== 'all') {
        const matchesType = tool.type === activeCategory;
        const matchesCat = tool.category === activeCategory;
        if (!matchesType && !matchesCat) return false;
      }
      if (searchQuery) {
        const haystack = `${tool.name} ${tool.description} ${tool.type} ${tool.category}`.toLowerCase();
        return haystack.includes(searchQuery);
      }
      return true;
    });
  }

  function buildCard(tool) {
    const statusIcon = tool.status === 'online' ? '🟢' : '🔴';
    const hasUrl = !!tool.url;
    const hasDownload = !!tool.downloadUrl;

    let actionsHtml = '';
    if (hasUrl && hasDownload) {
      actionsHtml = `
        <a href="${escapeHtml(tool.url)}" class="btn btn-primary btn-open" data-url="${escapeHtml(tool.url)}">打开工具</a>
        <a href="${escapeHtml(tool.downloadUrl)}" class="btn btn-secondary btn-download" data-url="${escapeHtml(tool.downloadUrl)}" target="_blank">下载</a>
      `;
    } else if (hasUrl) {
      actionsHtml = `
        <a href="${escapeHtml(tool.url)}" class="btn btn-primary btn-open" data-url="${escapeHtml(tool.url)}">打开工具</a>
      `;
    } else if (hasDownload) {
      actionsHtml = `
        <a href="${escapeHtml(tool.downloadUrl)}" class="btn btn-primary btn-download" data-url="${escapeHtml(tool.downloadUrl)}" target="_blank">下载安装</a>
      `;
    }

    return `
      <div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-icon">${escapeHtml(tool.icon)}</div>
          <div class="tool-card-info">
            <div class="tool-card-name">${escapeHtml(tool.name)}</div>
            <div class="tool-card-type">${escapeHtml(tool.type)}${tool.version ? ' · ' + escapeHtml(tool.version) : ''}</div>
          </div>
          <div class="tool-card-status">${statusIcon} ${escapeHtml(tool.status)}</div>
        </div>
        <div class="tool-card-desc">${escapeHtml(tool.description)}</div>
        <div class="tool-card-actions">${actionsHtml}</div>
      </div>
    `;
  }

  /* ---------- Expose to global ---------- */
  window.toggleTheme = toggleTheme;
  window.showToast = showToast;

  /* ---------- Boot ---------- */
  init();
})();
