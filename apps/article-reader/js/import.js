// ============================================================
//  IMPORT ARTICLE — Modal, File Import
// ============================================================

var importModal = document.getElementById('importModal');
var importTitle = document.getElementById('importTitle');
var importText = document.getElementById('importText');
var importConfirm = document.getElementById('importConfirm');
var importCancel = document.getElementById('importCancel');
var importBtn = document.getElementById('importBtn');
var fileInput = document.getElementById('fileInput');
var fileNameEl = document.getElementById('fileName');

function openImportModal() {
  importModal.classList.add('show');
  setTimeout(function() { if (importTitle) importTitle.focus(); }, 100);
}

function closeImportModal() {
  importModal.classList.remove('show');
  importTitle.value = '';
  importText.value = '';
  fileNameEl.textContent = 'No file selected';
}

importBtn.addEventListener('click', openImportModal);
importCancel.addEventListener('click', closeImportModal);
importModal.addEventListener('click', function(e) {
  if (e.target === importModal) closeImportModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (importModal.classList.contains('show')) closeImportModal();
    var libDrawer = document.getElementById('libraryDrawer');
    if (libDrawer && libDrawer.classList.contains('show')) closeLibrary();
  }
});

// File import
fileInput.addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;

  fileNameEl.textContent = file.name;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var content = ev.target.result;

    // Try to extract title from markdown heading
    var title = file.name.replace(/\.[^.]+$/, '');
    var lines = content.split('\n');
    var firstLine = (lines[0] || '').trim();
    if (firstLine.startsWith('# ')) {
      title = firstLine.substring(2).trim();
      content = lines.slice(1).join('\n');
    } else if (firstLine.startsWith('## ')) {
      title = firstLine.substring(3).trim();
      content = lines.slice(1).join('\n');
    }

    importTitle.value = title;
    importText.value = content;
  };
  reader.onerror = function() {
    showToast('Failed to read file', 'error');
  };
  reader.readAsText(file);
  // Reset file input so same file can be re-selected
  fileInput.value = '';
});

async function importArticle() {
  var title = importTitle.value.trim();
  var text = importText.value.trim();

  if (!text) {
    importText.focus();
    importText.style.borderColor = '#e74c3c';
    setTimeout(function() { importText.style.borderColor = ''; }, 1500);
    return;
  }

  importConfirm.disabled = true;
  importConfirm.textContent = 'Importing...';

  // Use setTimeout to allow UI update
  setTimeout(async function() {
    var article = parseArticleText(title, text);
    if (!article) {
      importConfirm.disabled = false;
      importConfirm.textContent = 'Import Article';
      importText.focus();
      showToast('Failed to parse article', 'error');
      return;
    }

    try {
      // Save to IndexedDB
      var id = await dbAdd('articles', article);
      article.id = id;

      // Add to allArticles and visibleArticleIds
      allArticles.push(article);
      visibleArticleIds.add(id);
      saveVisibleArticleIds();
      syncVisibleArticles();

      // Re-render
      renderTabs();
      renderArticles();

      // Switch to the new article
      var newIndex = ARTICLES.length - 1;
      switchArticle(newIndex);

      // Reset modal
      closeImportModal();
      importConfirm.disabled = false;
      importConfirm.textContent = 'Import Article';
      showToast('Article imported successfully', 'success');
    } catch(e) {
      console.error('Import error:', e);
      importConfirm.disabled = false;
      importConfirm.textContent = 'Import Article';
      showToast('Failed to save article: ' + (e.message || 'Unknown error'), 'error');
    }
  }, 100);
}

importConfirm.addEventListener('click', importArticle);

// Ctrl+Enter to import
importText.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    importArticle();
  }
});

// ============================================================
//  VISIBLE ARTICLES MANAGEMENT
// ============================================================

function saveVisibleArticleIds() {
  try {
    localStorage.setItem('visibleArticleIds', JSON.stringify(Array.from(visibleArticleIds)));
    hasSavedVisibleArticleIds = true;
  } catch(e) {}
}

function syncVisibleArticles() {
  // An empty set is a valid state: the user may have hidden every tab.
  if (!hasSavedVisibleArticleIds && allArticles.length > 0) {
    allArticles.forEach(function(a) { visibleArticleIds.add(a.id); });
    saveVisibleArticleIds();
  }
  var articleIds = new Set(allArticles.map(function(article) { return article.id; }));
  var removedStaleId = false;
  visibleArticleIds.forEach(function(articleId) {
    if (!articleIds.has(articleId)) {
      visibleArticleIds.delete(articleId);
      removedStaleId = true;
    }
  });
  if (removedStaleId) saveVisibleArticleIds();
  // Filter to visible only
  ARTICLES = allArticles.filter(function(a) { return visibleArticleIds.has(a.id); });
}

function renderVisibleArticles(preferredArticleId) {
  syncVisibleArticles();
  var preferredIndex = preferredArticleId === undefined
    ? -1
    : ARTICLES.findIndex(function(article) { return article.id === preferredArticleId; });
  currentArticle = preferredIndex >= 0
    ? preferredIndex
    : Math.min(currentArticle, Math.max(0, ARTICLES.length - 1));

  renderTabs();
  renderArticles();
  if (ARTICLES.length > 0) {
    switchArticle(currentArticle);
  } else {
    emptyState.style.display = 'block';
    tabsBar.style.display = 'none';
  }
}

function hideArticle(index) {
  var article = ARTICLES[index];
  if (!article) return;

  stopSpeech();
  var activeArticle = ARTICLES[currentArticle];
  var preferredArticle = activeArticle && activeArticle.id !== article.id
    ? activeArticle
    : (ARTICLES[index + 1] || ARTICLES[index - 1]);
  visibleArticleIds.delete(article.id);
  saveVisibleArticleIds();
  renderVisibleArticles(preferredArticle && preferredArticle.id);

  showToast('Article hidden from tabs', 'info');
}

function showArticle(articleId) {
  visibleArticleIds.add(articleId);
  saveVisibleArticleIds();
  renderVisibleArticles(articleId);
}

// ============================================================
//  LIBRARY PANEL
// ============================================================

function openLibrary() {
  renderLibrary();
  document.getElementById('libraryOverlay').classList.add('show');
  document.getElementById('libraryDrawer').classList.add('show');
}

function closeLibrary() {
  document.getElementById('libraryOverlay').classList.remove('show');
  document.getElementById('libraryDrawer').classList.remove('show');
}

document.getElementById('libraryBtn').addEventListener('click', openLibrary);
document.getElementById('libraryCloseBtn').addEventListener('click', closeLibrary);
document.getElementById('libraryOverlay').addEventListener('click', closeLibrary);

async function getIndexedDBSize() {
  var totalSize = 0;
  try {
    var articles = await dbGetAll('articles');
    articles.forEach(function(a) {
      totalSize += new Blob([JSON.stringify(a)]).size;
    });
    var translations = await dbGetAll('translations');
    translations.forEach(function(t) {
      totalSize += new Blob([JSON.stringify(t)]).size;
    });
    var words = await dbGetAll('wordTranslations');
    words.forEach(function(w) {
      totalSize += new Blob([JSON.stringify(w)]).size;
    });
  } catch(e) {}
  return totalSize;
}

async function renderLibrary() {
  var body = document.getElementById('libraryBody');
  var footer = document.getElementById('libraryFooter');
  body.innerHTML = '';

  if (allArticles.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">No articles in library.<br>Import an article to get started.</div>';
    footer.innerHTML = '';
    return;
  }

  // Sort by creation date (newest first)
  var sorted = allArticles.slice().sort(function(a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  sorted.forEach(function(article) {
    var isVisible = visibleArticleIds.has(article.id);
    var totalSentences = 0;
    article.paragraphs.forEach(function(p) { totalSentences += p.sentences.length; });
    var langBadge = article.lang === 'zh' ? 'ZH' : 'EN';
    var dateStr = article.createdAt ? new Date(article.createdAt).toLocaleDateString() : '';

    var item = document.createElement('div');
    item.className = 'library-item' + (isVisible ? '' : ' hidden-article');
    item.innerHTML =
      '<div class="library-item-header">' +
        '<span class="library-item-title">' + escapeHtml(article.title) + '</span>' +
        '<span class="library-item-lang">' + langBadge + '</span>' +
      '</div>' +
      '<div class="library-item-meta">' +
        totalSentences + ' sentences' +
        (dateStr ? ' · ' + dateStr : '') +
      '</div>' +
      '<div class="library-item-actions">' +
        (isVisible
          ? '<button class="lib-btn" onclick="hideArticleById(' + article.id + ')">Hide from tabs</button>'
          : '<button class="lib-btn lib-btn-show" onclick="showArticleById(' + article.id + ')">Show in tabs</button>'
        ) +
        '<button class="lib-btn lib-btn-delete" onclick="deleteArticleById(' + article.id + ')">Delete</button>' +
      '</div>';
    body.appendChild(item);
  });

  // Show storage size
  var size = await getIndexedDBSize();
  footer.innerHTML =
    '<span>' + allArticles.length + ' articles' + (allArticles.length !== ARTICLES.length ? ' (' + ARTICLES.length + ' shown)' : '') + '</span>' +
    '<span>Storage: ' + formatBytes(size) + '</span>';
}

function hideArticleById(articleId) {
  var activeArticle = ARTICLES[currentArticle];
  var articleIndex = ARTICLES.findIndex(function(article) { return article.id === articleId; });
  var preferredArticle = activeArticle && activeArticle.id !== articleId
    ? activeArticle
    : (ARTICLES[articleIndex + 1] || ARTICLES[articleIndex - 1]);
  visibleArticleIds.delete(articleId);
  saveVisibleArticleIds();
  renderVisibleArticles(preferredArticle && preferredArticle.id);
  renderLibrary();
}

function showArticleById(articleId) {
  showArticle(articleId);
  renderLibrary();
}

async function deleteArticleById(articleId) {
  if (!confirm('Permanently delete this article? This cannot be undone.')) return;

  stopSpeech();
  var activeArticle = ARTICLES[currentArticle];
  var articleIndex = ARTICLES.findIndex(function(article) { return article.id === articleId; });
  var preferredArticle = activeArticle && activeArticle.id !== articleId
    ? activeArticle
    : (ARTICLES[articleIndex + 1] || ARTICLES[articleIndex - 1]);

  try {
    await dbDelete('articles', articleId);
  } catch(e) {
    console.error('Delete error:', e);
    showToast('Failed to delete article: ' + (e.message || 'Unknown error'), 'error');
    return;
  }

  // Remove from allArticles
  allArticles = allArticles.filter(function(a) { return a.id !== articleId; });
  // Remove from visible
  visibleArticleIds.delete(articleId);
  saveVisibleArticleIds();
  renderVisibleArticles(preferredArticle && preferredArticle.id);

  renderLibrary();
  showToast('Article permanently deleted', 'info');
}
