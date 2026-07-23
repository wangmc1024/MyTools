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
  let repoTreeData = null;

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

  /* ---------- Download view tabs ---------- */
  function initDownloadTabs() {
    const container = document.querySelector('.download-tabs');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const tab = e.target.closest('.download-tab');
      if (!tab) return;

      container.querySelectorAll('.download-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const view = tab.dataset.view;
      document.getElementById('downloadTreeView').style.display = view === 'tree' ? 'block' : 'none';
      document.getElementById('downloadListView').style.display = view === 'list' ? 'block' : 'none';
    });
  }

  /* ---------- Render download list (legacy panel, used by "工具列表" tab) ---------- */
  function renderDownloads() {
    const listEl = document.getElementById('downloadListView');
    if (!listEl) return;
    const downloadables = toolsData.filter((t) => t.downloadUrl);

    if (downloadables.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无可用下载资源</p></div>';
      return;
    }

    listEl.innerHTML = `<div class="download-list">${downloadables.map((tool) => `
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
    `).join('')}</div>`;
  }

  /* ---------- Render directory tree (new download center) ---------- */
  function getFileIcon(name) {
    if (name.endsWith('.html')) return '🌐';
    if (name.endsWith('.css')) return '🎨';
    if (name.endsWith('.js')) return '📜';
    if (name.endsWith('.json')) return '⚙️';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return '🔧';
    if (name.endsWith('.md')) return '📄';
    if (name.endsWith('.txt')) return '📝';
    return '📄';
  }

  function renderTree(nodes, container) {
    nodes.forEach((node) => {
      if (node.type === 'dir') {
        const li = document.createElement('li');
        li.className = 'dir-item';

        const hasChildren = node.children && node.children.length > 0;

        const arrow = document.createElement('span');
        arrow.className = 'dir-arrow open';
        arrow.textContent = '▶';

        const link = document.createElement('a');
        link.className = 'dir-link';
        link.href = 'javascript:void(0)';

        const icon = document.createElement('span');
        icon.className = 'dir-icon';
        icon.textContent = '📁';

        const label = document.createElement('span');
        label.className = 'filename';
        label.textContent = node.name;

        link.appendChild(arrow);
        link.appendChild(icon);
        link.appendChild(label);
        li.appendChild(link);

        if (hasChildren) {
          const ul = document.createElement('ul');
          ul.style.display = 'block'; // expanded by default
          ul.id = 'tree-' + btoa(node.name).replace(/=/g, '');

          renderTree(node.children, ul);
          li.appendChild(ul);

          // Toggle expand/collapse
          link.addEventListener('click', () => {
            const isOpen = ul.style.display === 'block';
            ul.style.display = isOpen ? 'none' : 'block';
            arrow.classList.toggle('open', !isOpen);
          });
        }

        container.appendChild(li);
      } else {
        const li = document.createElement('li');
        li.className = 'file-item';

        const link = document.createElement('a');
        link.className = 'file-link';
        const path = node._path || node.name;
        const rawUrl = buildGiteeRawUrl(path);
        const blobUrl = buildGiteeBlobUrl(path);
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener';

        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = getFileIcon(node.name);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'filename';
        nameSpan.textContent = node.name;

        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = node.size || '';

        link.appendChild(icon);
        link.appendChild(nameSpan);
        link.appendChild(size);
        li.appendChild(link);

        // Click to download raw file
        link.addEventListener('click', (e) => {
          e.preventDefault();
          window.open(rawUrl, '_blank');
        });

        container.appendChild(li);
      }
    });
  }

  function renderDirectoryTree() {
    const container = document.getElementById('downloadTreeView');
    if (!container || !repoTreeData) return;

    try {
      // Clone to avoid mutating original data
      const treeData = JSON.parse(JSON.stringify(repoTreeData));

      // Attach relative paths for URL building
      function attachPaths(nodes, prefix) {
        nodes.forEach((n) => {
          if (n.type === 'dir' && n.children) {
            n.children.forEach((c) => {
              c._path = prefix ? `${prefix}/${c.name}` : c.name;
            });
            attachPaths(n.children, prefix ? `${prefix}/${n.name}` : n.name);
          }
        });
      }
      attachPaths(treeData, '');

      const rootUl = document.createElement('ul');
      rootUl.className = 'directory-tree';
      renderTree(treeData, rootUl);
      container.appendChild(rootUl);
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>' +
        escapeHtml(e.message) + '</p></div>';
    }
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
      const dlList = document.getElementById('downloadListView');
      if (dlList) dlList.innerHTML = grid.innerHTML;
    }

    // Load repo tree data
    try {
      const treeResp = await fetch('assets/data/repo-tree.json');
      if (treeResp.ok) {
        repoTreeData = await treeResp.json();
        renderDirectoryTree();
      }
    } catch (e) {
      console.warn('Failed to load repo tree:', e.message);
    }

    // Init download tabs
    initDownloadTabs();
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
