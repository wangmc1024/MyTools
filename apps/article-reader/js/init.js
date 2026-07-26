// ============================================================
//  INIT — Entry point
// ============================================================

async function init() {
  try {
    await initDB();

    // Load all articles from IndexedDB
    var articles = await dbGetAll('articles');
    articles.sort(function(a, b) { return (a.id || 0) - (b.id || 0); });
    allArticles = articles;

    // Sync visible articles
    syncVisibleArticles();

    // Render
    renderTabs();
    renderArticles();

    if (ARTICLES.length > 0) {
      switchArticle(0);
    }

    updateProgress();

    // Probe TTS endpoints on page load so we pick the best one upfront (non-blocking)
    probeTTSEndpoints();

  } catch(e) {
    console.error('Init error:', e);
    showToast('Failed to initialize: ' + (e.message || 'Unknown error'), 'error');
  }
}

init();