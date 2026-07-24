/**
 * MyTools Portal — Download Panel Logic
 * Loads data from assets/data/tools.json and assets/data/repo-tree.json.
 */
(function () {
  'use strict';

  var TOOLS_DATA = [];
  var REPO_TREE = null;

  /* ================================================================
     Load data sources on init
     ================================================================ */
  Promise.all([
    fetch('assets/data/tools.json').then(r => r.json()),
    fetch('assets/data/repo-tree.json').then(r => r.json())
  ]).then(function (data) {
    TOOLS_DATA = data[0];
    REPO_TREE = data[1];
    window.renderDownloads();
    window.renderRepoTree();
  }).catch(function () {
    console.error('Failed to load download data');
  });

  /* ================================================================
     Render download list — filtered from tools.json
     Only items with a downloadUrl are shown as downloadable.
     Uses the same download flow as repo tree via handleDownload.
     ================================================================ */
  window.renderDownloads = function () {
    var list = document.getElementById('downloadList');
    if (!list) return;
    var dl = TOOLS_DATA.filter(function (t) { return t.downloadUrl; });
    if (!dl.length) {
      list.innerHTML = '<div class="text-center text-[var(--text-muted)] py-16">暂无可用下载资源</div>';
      return;
    }
    list.innerHTML = dl.map(function (t) {
      var meta = [];
      if (t.version) meta.push(t.version);
      if (t.fileType) meta.push(t.fileType);
      return '<div class="dl-card" data-path="' + esc(t.downloadUrl) + '">' +
        '<div class="dl-icon">' + esc(t.icon) + '</div>' +
        '<div class="dl-info">' +
          '<h3>' + esc(t.name) + '</h3>' +
          '<p>' + meta.join(' · ') + '</p>' +
        '</div>' +
        '<button class="dl-btn">下载安装</button>' +
      '</div>';
    }).join('');
    list.querySelectorAll('.dl-btn').forEach(function (btn) {
      var card = btn.closest('.dl-card');
      if (card) btn.addEventListener('click', function () {
        window.handleDownload(card.dataset.path);
      });
    });
  };

  /* ================================================================
     Render repo tree — recursive from repo-tree.json
     Each folder node has `children`; each file node has `path`.
     All collapsed by default. Click to toggle or download.
     ================================================================ */
  window.renderRepoTree = function () {
    var container = document.getElementById('repoTree');
    if (!container || !REPO_TREE) return;

    function buildTree(items, depth) {
      var html = '';
      var pad = 16 + depth * 24;
      items.forEach(function (item) {
        if (item.type === 'dir' && item.children) {
          var id = 'tree-' + Math.random().toString(36).slice(2);
          var count = countDescendants(item);
          html += '<div class="repo-row folder" data-target="' + id + '" style="padding-left:' + pad + 'px">' +
            '<span class="tree-arrow">›</span>' +
            '<span class="text-sm">' + (item.icon || '📁') + '</span>' +
            '<span class="flex-1 font-medium">' + esc(item.name) + '</span>' +
            '<span class="count">' + count + ' 项</span>' +
          '</div><div class="tree-body" id="' + id + '">';
          html += buildTree(item.children, depth + 1);
          html += '</div>';
        } else {
          html += '<div class="repo-row file" data-path="' + esc(item.path) + '" style="padding-left:' + pad + 'px">' +
            '<span class="tree-arrow" style="visibility:hidden">›</span>' +
            '<span class="text-sm">' + (item.icon || '📄') + '</span>' +
            '<span class="flex-1">' + esc(item.name) + '</span>' +
          '</div>';
        }
      });
      return html;
    }

    function countDescendants(node) {
      if (!node.children || !node.children.length) return 0;
      var n = 0;
      node.children.forEach(function (c) { n++; if (c.children) n += countDescendants(c); });
      return n;
    }

    container.innerHTML = buildTree(REPO_TREE, 0);

    container.addEventListener('click', function (e) {
      var folder = e.target.closest('.repo-row.folder');
      if (folder) {
        var targetId = folder.dataset.target;
        var body = document.getElementById(targetId);
        var arrow = folder.querySelector('.tree-arrow');
        var isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        arrow.classList.toggle('open', !isOpen);
        return;
      }
      var file = e.target.closest('.repo-row.file');
      if (file && file.dataset.path) {
        window.handleDownload(file.dataset.path);
      }
    });
  };
})();