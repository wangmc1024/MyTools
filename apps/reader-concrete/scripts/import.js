// ============================================================
//  IMPORT ARTICLE
// ============================================================
const importModal = document.getElementById('importModal');
const importTitle = document.getElementById('importTitle');
const importText = document.getElementById('importText');
const importConfirm = document.getElementById('importConfirm');
const importCancel = document.getElementById('importCancel');
const importBtn = document.getElementById('importBtn');

function openImportModal() {
  importModal.classList.add('show');
  setTimeout(() => importTitle.focus(), 100);
}
function closeImportModal() {
  importModal.classList.remove('show');
  importTitle.value = '';
  importText.value = '';
}

importBtn.addEventListener('click', openImportModal);
importCancel.addEventListener('click', closeImportModal);
importModal.addEventListener('click', (e) => {
  if (e.target === importModal) closeImportModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && importModal.classList.contains('show')) {
    closeImportModal();
  }
});

function parseArticleText(title, rawText) {
  // Split into paragraphs by double newline
  const rawParas = rawText.trim().split(/\n\s*\n/).filter(p => p.trim());
  if (rawParas.length === 0) return null;

  const paragraphs = [];

  rawParas.forEach(rawPara => {
    // Normalize whitespace within paragraph
    const para = rawPara.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!para) return;

    // Extract bold words: **word** → <b>word</b>
    const boldWords = [];
    let processed = para.replace(/\*\*([^*]+)\*\*/g, (match, word) => {
      boldWords.push(word);
      return '<b>' + word + '</b>';
    });

    // Split into sentences: split after . ! ? followed by space or end
    // But keep abbreviations like "U.S." together
    const sentenceRegex = /[^.!?]+[.!?]+(?:["'”’)\]]+)?(?:\s|$)/g;
    let sentences = processed.match(sentenceRegex);

    // Fallback: if regex fails, treat whole paragraph as one sentence
    if (!sentences || sentences.length === 0) {
      sentences = [processed];
    }

    // Clean up sentences
    sentences = sentences.map(s => s.trim()).filter(s => s.length > 0);

    // If the last piece doesn't end with punctuation, add it as a sentence
    const lastMatch = processed.match(sentenceRegex);
    if (lastMatch) {
      const matchedText = lastMatch.join('');
      const remaining = processed.substring(matchedText.length).trim();
      if (remaining) sentences.push(remaining);
    }

    const sentObjs = sentences.map(sentEn => {
      // Extract bold words from this sentence
      const sentBold = [];
      const cleanEn = sentEn.replace(/<b>([^<]+)<\/b>/g, (match, word) => {
        sentBold.push(word);
        return match;
      });
      return { en: sentEn, boldWords: sentBold };
    });

    if (sentObjs.length > 0) {
      paragraphs.push({ sentences: sentObjs });
    }
  });

  if (paragraphs.length === 0) return null;

  return {
    title: title.trim() || 'Untitled Article',
    paragraphs: paragraphs
  };
}

function importArticle() {
  const title = importTitle.value.trim();
  const text = importText.value.trim();

  if (!text) {
    importText.focus();
    importText.style.borderColor = '#e74c3c';
    setTimeout(() => { importText.style.borderColor = ''; }, 1500);
    return;
  }

  importConfirm.disabled = true;
  importConfirm.textContent = 'Importing...';

  setTimeout(() => {
    const article = parseArticleText(title, text);
    if (!article) {
      importConfirm.disabled = false;
      importConfirm.textContent = 'Import Article';
      importText.focus();
      return;
    }

    // Add to ARTICLES array
    ARTICLES.push(article);
    saveCustomArticles();

    // Re-render tabs and lazy-render the new article
    const newIndex = ARTICLES.length - 1;
    renderTabs();
    mainContainer.innerHTML = '';
    renderedArticles.clear();
    currentArticle = newIndex;
    renderSingleArticle(currentArticle);
    switchArticle(newIndex);

    // Reset modal
    closeImportModal();
    importConfirm.disabled = false;
    importConfirm.textContent = 'Import Article';
  }, 100);
}

importConfirm.addEventListener('click', importArticle);

// Allow Ctrl+Enter to import from textarea
importText.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    importArticle();
  }
});

function deleteArticle(index) {
  if (index < BUILTIN_COUNT) return;
  if (!confirm('Remove this article? This cannot be undone.')) return;

  stopSpeech();
  ARTICLES.splice(index, 1);
  saveCustomArticles();

  // Adjust current article index
  if (currentArticle >= ARTICLES.length) {
    currentArticle = ARTICLES.length - 1;
  } else if (currentArticle > index) {
    currentArticle--;
  }

  renderTabs();
  renderArticles();
  switchArticle(currentArticle);
}
