/**
 * MyTools Portal — Download Panel Logic
 */
(function () {
  'use strict';

  var TOOLS_DATA = [];
  var REPO_TREE = null;

  /* load data sources */
  Promise.all([
    fetch('assets/data/tools.json').then(function (r) { return r.json(); }),
    fetch('assets/data/repo-tree.json').then(function (r) { return r.json(); })
  ]).then(function (data) {
    TOOLS_DATA = data[0];
    REPO_TREE = data[1];
    window.renderDownloads();
    window.renderRepoTree();
  }).catch(function () {
    console.error('Failed to load download data');
  });

  /* render download list from tools.json */
  window.renderDownloads = function () {
    var list = document.getElementById('downloadList');
    if (!list) return;
    var dl = TOOLS_DATA.filter(function (t) { return t.downloadUrl; });
    if (!dl.length) {
      list.innerHTML = '<div class="text-center text-[var(--text-muted)] py-16">暂无可用下载资源</div>';
      return;
    }
    var html = dl.map(function (t) {
      var meta = [];
      if (t.version) meta.push(t.version);
      if (t.fileType) meta.push(t.fileType);
      return '<div class="dl-card" data-path="' + esc(t.downloadUrl) + '">' +
        '<div class="dl-icon">' + esc(t.icon) + '</div>' +
        '<div class="dl-info">' +
          '<h3>' + esc(t.name) + '</h3>' +
          '<p>' + meta.join(' · ') + '</p>' +
        '</div>' +
        '<button class="dl-btn" onclick="event.stopPropagation(); handleDownload(\'' + escapeAttr(t.downloadUrl) + '\')">下载安装</button>' +
      '</div>';
    }).join('');
    list.innerHTML = html;
  };

  function escapeAttr(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  /* preview overlay refs */
  var pvOverlay, pvTitleEl, pvBodyEl, pvToolbarEl, pvPathEl, pvCopyBtnEl, pvDlBtnEl;
  var pvRawText = '';
  var pvPath = '';

  var pvInitialized = false;

  function initPv() {
    if (pvInitialized) return;
    pvOverlay = document.getElementById('previewOverlay');
    pvTitleEl = document.getElementById('pvTitle');
    pvBodyEl = document.getElementById('pvBody');
    pvToolbarEl = document.getElementById('pvToolbar');
    pvPathEl = document.getElementById('pvPath');
    pvCopyBtnEl = document.getElementById('pvCopyBtn');
    pvDlBtnEl = document.getElementById('pvDownloadBtn');
    document.getElementById('pvClose').addEventListener('click', closePv);
    pvOverlay.addEventListener('click', function (e) { if (e.target === pvOverlay) closePv(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePv(); });
    pvCopyBtnEl.addEventListener('click', copyContent);
    pvDlBtnEl.addEventListener('click', function () { closePv(); handleDownload(pvPath); });
    pvInitialized = true;
  }

  function openPv(path, name) {
    initPv();
    pvPath = path;
    pvTitleEl.textContent = name || path;
    pvBodyEl.innerHTML = '<div class="preview-loading">正在加载文件内容…</div>';
    pvToolbarEl.style.display = 'none';
    pvRawText = '';
    pvOverlay.classList.add('open');
    loadContent(path, function (err, text) {
      if (err) {
        pvBodyEl.innerHTML = '<div class="preview-empty">无法加载文件内容</div>';
        return;
      }
      pvRawText = text;
      pvBodyEl.innerHTML = '<pre><code>' + esc(text) + '</code></pre>';
      pvPathEl.textContent = path;
      pvToolbarEl.style.display = 'flex';
    });
  }

  function loadContent(path, cb) {
    if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
      // absolute URL — try gitee raw first, then proxy
      var raw = window.giteeToRaw(path);
      if (raw) {
        fetch(raw).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(cb).catch(function () {
            fetch('https://download.wangmc1024.workers.dev/?target=' + encodeURIComponent(raw))
              .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
              .then(cb).catch(function (e) { cb(e.message); });
          });
      } else {
        cb('无效链接');
      }
    } else {
      // relative/local path — fetch directly first, fallback to gitee
      fetch(path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(cb).catch(function () {
          var raw = window.giteeToRaw(path);
          if (raw) {
            fetch(raw).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
              .then(cb).catch(function () {
                fetch('https://download.wangmc1024.workers.dev/?target=' + encodeURIComponent(raw))
                  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
                  .then(cb).catch(function (e) { cb(e.message); });
              });
          } else {
            cb('无法获取文件');
          }
        });
    }
  }

  function copyContent() {
    if (!pvRawText) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pvRawText).then(flashBtn).catch(doFallback);
    } else { doFallback(); }
  }

  function doFallback() {
    var ta = document.createElement('textarea');
    ta.value = pvRawText;
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    flashBtn();
  }

  function flashBtn() {
    var orig = pvCopyBtnEl.textContent;
    pvCopyBtnEl.textContent = '已复制 ✓';
    pvCopyBtnEl.classList.add('copied');
    setTimeout(function () { pvCopyBtnEl.textContent = orig; pvCopyBtnEl.classList.remove('copied'); }, 1500);
  }

  function closePv() {
    pvOverlay.classList.remove('open');
    pvBodyEl.innerHTML = '<div class="preview-loading">正在加载文件内容…</div>';
    pvToolbarEl.style.display = 'none';
    pvRawText = ''; pvPath = '';
  }

  window.closePv = closePv;

  /* render repo tree from repo-tree.json */
  window.renderRepoTree = function () {
    var container = document.getElementById('repoTree');
    if (!container || !REPO_TREE) return;

    function buildTree(items, depth) {
      var html = '', pad = 16 + depth * 24;
      items.forEach(function (item) {
        if (item.type === 'dir' && item.children) {
          var id = 'tree-' + Math.random().toString(36).slice(2);
          var count = 0;
          (function walk(nodes) { nodes.forEach(function (c) { count++; if (c.children) walk(c.children); }); })(item.children);
          html += '<div class="repo-row folder" data-target="' + id + '" style="padding-left:' + pad + 'px">' +
            '<span class="tree-arrow">›</span>' +
            '<span>' + (item.icon || '📁') + '</span>' +
            '<span class="flex-1 font-medium">' + esc(item.name) + '</span>' +
            '<span class="count">' + count + ' 项</span>' +
          '</div><div class="tree-body" id="' + id + '">';
          html += buildTree(item.children, depth + 1) + '</div>';
        } else {
          html += '<div class="repo-row file" data-path="' + esc(item.path) + '" data-name="' + esc(item.name) + '" style="padding-left:' + pad + 'px">' +
            '<span class="tree-arrow" style="visibility:hidden">›</span>' +
            '<span>' + (item.icon || '📄') + '</span>' +
            '<span class="flex-1" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(item.name) + '</span>' +
            '<button class="repo-dl-btn" title="下载 ' + esc(item.name) + '">下载</button>' +
          '</div>';
        }
      });
      return html;
    }

    container.innerHTML = buildTree(REPO_TREE, 0);

    container.addEventListener('click', function (e) {
      var folder = e.target.closest('.repo-row.folder');
      if (folder) {
        var body = document.getElementById(folder.dataset.target);
        var arrow = folder.querySelector('.tree-arrow');
        var open = body.classList.contains('open');
        body.classList.toggle('open', !open);
        arrow.classList.toggle('open', !open);
        return;
      }
      if (e.target.classList.contains('repo-dl-btn')) return;
      var file = e.target.closest('.repo-row.file');
      if (file && file.dataset.path) openPv(file.dataset.path, file.dataset.name);
    });

    container.querySelectorAll('.repo-dl-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var row = btn.closest('.repo-row.file');
        if (row && row.dataset.path) handleDownload(row.dataset.path);
      });
    });
  };
})();
