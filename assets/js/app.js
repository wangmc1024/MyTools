/**
 * MyTools Portal — Dashboard Logic
 * Fetches tools.json, renders cards by section, handles search/filter/theme/panels
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
  let treeCounter = 0;

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

  /* ---------- Render download list (used by "工具列表" tab) ---------- */
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

  /* ---------- Render apps grid (Web应用 section) ---------- */
  function renderApps() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;

    const apps = toolsData.filter((t) => t.url && !t.downloadUrl);

    if (apps.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = apps.map((app) => `
      <a class="app-card" href="${escapeHtml(app.url)}">
        <div class="app-card-icon">${escapeHtml(app.icon)}</div>
        <div class="app-card-info">
          <div class="app-card-name">${escapeHtml(app.name)}</div>
          <div class="app-card-desc">${escapeHtml(app.description)}</div>
        </div>
        <span class="app-card-arrow">→</span>
      </a>
    `).join('');
  }

  /* ---------- Search (applies to scripts/tools section only) ---------- */
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderScripts();
    });
  }

  /* ---------- Category tabs ---------- */
  function renderCategories() {
    const container = document.getElementById('categoryTabs');
    if (!container) return;

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
      renderScripts();
    });
  }

  /* ---------- Render script/tool cards ---------- */
  function renderScripts() {
    const grid = document.getElementById('toolsGrid');
    const emptyEl = document.getElementById('scriptsEmptyState');
    if (!grid || !emptyEl) return;

    const filtered = filterScripts();

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      grid.innerHTML = filtered.map((tool) => buildScriptCard(tool)).join('');

      grid.querySelectorAll('.btn-open').forEach((btn) => {
        btn.addEventListener('click', () => { window.location.href = btn.dataset.url; });
      });
      grid.querySelectorAll('.btn-download').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          handleDownload(btn.dataset.url);
        });
      });
    }
  }

  function filterScripts() {
    // Filter out Web Apps (those that only have url, no downloadUrl)
    return toolsData.filter((tool) => tool.downloadUrl && tool.type);
  }

  function buildScriptCard(tool) {
    const statusIcon = tool.status === 'online' ? '🟢' : '🔴';
    const hasUrl = !!tool.url;
    const hasDownload = !!tool.downloadUrl;

    let actionsHtml = '';
    if (hasUrl && hasDownload) {
      actionsHtml = `
        <a href="${escapeHtml(tool.url)}" class="btn btn-primary btn-open" data-url="${escapeHtml(tool.url)}">打开</a>
        <a href="javascript:void(0)" class="btn btn-secondary btn-download" data-url="${escapeHtml(tool.downloadUrl)}">下载</a>
      `;
    } else if (hasDownload) {
      actionsHtml = `
        <a href="javascript:void(0)" class="btn btn-primary btn-download" data-url="${escapeHtml(tool.downloadUrl)}">下载安装</a>
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

  /* ---------- Unified download handler (text→simple, binary→fetch+Blob) ---------- */
  function handleDownload(url) {
    if (!url) return;
    const rawUrl = giteeToRaw(url);
    if (!rawUrl) return;

    const fileName = rawUrl.split('/').pop() || 'download';
    const ext = fileName.split('.').pop().toLowerCase();
    // Text files: direct <a download> is fine
    const textExts = ['js', 'html', 'css', 'json', 'md', 'txt', 'yml', 'yaml', 'xml', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf'];
    if (textExts.includes(ext)) {
      _downloadSimple(rawUrl, fileName);
      return;
    }
    // Binary / unknown type: fetch + Blob
    _downloadFetch(rawUrl, fileName);
  }

  function _downloadSimple(url, fileName) {
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function _downloadFetch(url, fileName) {
    showToast('正在下载: ' + fileName, 'info');
    fetch(url)
      .then(function(res) { return res.blob(); })
      .then(function(blob) {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 1000);
      })
      .catch(function() {
        showToast('下载失败', 'error');
      });
  }

  /* ---------- Directory tree rendering ---------- */
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
        arrow.className = 'dir-arrow';
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
          ul.style.display = 'none'; // all directories collapsed by default
          ul.id = 'tree-' + btoa(node.name + (++treeCounter)).replace(/[^a-zA-Z0-9]/g, '');

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

        // Click to download via enhanced handler
        link.addEventListener('click', (e) => {
          e.preventDefault();
          handleDownload(blobUrl);
        });

        container.appendChild(li);
      }
    });
  }

  function renderDirectoryTree() {
    const container = document.getElementById('downloadTreeView');
    if (!container || !repoTreeData) return;

    try {
      const treeData = JSON.parse(JSON.stringify(repoTreeData));

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

      // Render apps section
      renderApps();

      // Render scripts/tools section
      renderCategories();
      renderScripts();

      // Render downloads list (tab view)
      renderDownloads();
    } catch (e) {
      const appGrid = document.getElementById('appGrid');
      if (appGrid) appGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>' +
        escapeHtml(e.message) + '</p></div>';
      const dlList = document.getElementById('downloadListView');
      if (dlList) dlList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>' +
        escapeHtml(e.message) + '</p></div>';
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

  /* ---------- Expose to global ---------- */
  window.toggleTheme = toggleTheme;
  window.showToast = showToast;
  window.handleDownload = handleDownload;

  /* ---------- Boot ---------- */
  init();
})();
