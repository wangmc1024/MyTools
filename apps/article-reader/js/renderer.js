// ============================================================
//  RENDER TABS
// ============================================================

var tabsWrapper = document.getElementById('tabsWrapper');
var tabsBar = document.getElementById('tabsBar');

function renderTabs() {
  tabsWrapper.innerHTML = '';
  if (ARTICLES.length === 0) {
    tabsBar.style.display = 'none';
    return;
  }
  tabsBar.style.display = 'block';

  ARTICLES.forEach(function(article, i) {
    var btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === currentArticle ? ' active' : '');
    var langLabel = article.lang === 'zh' ? 'ZH' : 'EN';
    var html = '<span class="tab-num">' + (i + 1) + '</span>' +
               '<span class="tab-lang">' + langLabel + '</span>' +
               '<span class="tab-text">' + escapeHtml(article.title) + '</span>' +
               '<button class="tab-delete" onclick="event.stopPropagation(); hideArticle(' + i + ')" title="Hide from tabs">✕</button>';
    btn.innerHTML = html;
    btn.addEventListener('click', function() { switchArticle(i); });
    tabsWrapper.appendChild(btn);
  });
}

// ============================================================
//  RENDER ARTICLE
// ============================================================

var mainContainer = document.getElementById('mainContainer');
var emptyState = document.getElementById('emptyState');

function switchArticle(index) {
  currentArticle = index;
  if (ARTICLES[index]) {
    currentArticleLang = ARTICLES[index].lang || 'en';
    // Update voice selection for the new article's language
    populateVoices(currentArticleLang);
  }

  var sections = document.querySelectorAll('.article-section');
  var tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(function(b, i) { b.classList.toggle('active', i === index); });
  sections.forEach(function(s, i) { s.classList.toggle('active', i === index); });

  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateProgress();
}

function renderArticles() {
  // Remove all article sections but keep empty state
  var sections = mainContainer.querySelectorAll('.article-section');
  sections.forEach(function(s) { s.remove(); });

  if (ARTICLES.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  ARTICLES.forEach(function(article, ai) {
    var section = document.createElement('div');
    section.className = 'article-section' + (ai === currentArticle ? ' active' : '');

    var totalSentences = 0;
    var totalBold = new Set();
    article.paragraphs.forEach(function(p) {
      totalSentences += p.sentences.length;
      p.sentences.forEach(function(s) {
        s.boldWords.forEach(function(w) { totalBold.add(w); });
      });
    });

    var langBadge = article.lang === 'zh' ? 'Chinese' : 'English';

    section.innerHTML =
      '<h1 class="article-title">' + escapeHtml(article.title) + '</h1>' +
      '<div class="article-meta">' +
        '<span>' + langBadge + '</span>' +
        '<span>' + totalSentences + ' sentences</span>' +
        '<span>' + totalBold.size + ' vocabulary words</span>' +
        '<span>' + article.paragraphs.length + ' paragraphs</span>' +
      '</div>' +
      '<div class="toolbar">' +
        '<button class="tool-btn" onclick="toggleAllTranslations(' + ai + ', this)">' +
          '<span>👁</span> Show All Translations' +
        '</button>' +
        '<button class="tool-btn" onclick="speakArticle(' + ai + ', this)">' +
          '<span>🔊</span> Read Article' +
        '</button>' +
      '</div>' +
      '<div class="article-body" id="articleBody_' + ai + '"></div>' +
      '<div class="article-nav" id="articleNav_' + ai + '"></div>';

    mainContainer.appendChild(section);

    var body = section.querySelector('.article-body');
    article.paragraphs.forEach(function(para, pi) {
      var paraDiv = document.createElement('div');
      paraDiv.className = 'paragraph';
      // Apply paragraph type styling
      if (para.type === 'heading') {
        paraDiv.className += ' paragraph-heading paragraph-heading-l' + (para.level || 1);
      } else if (para.type === 'quote') {
        paraDiv.className += ' paragraph-quote';
      }

      para.sentences.forEach(function(sent, si) {
        var card = document.createElement('div');
        card.className = 'sentence-card';
        card.dataset.article = ai;
        card.dataset.para = pi;
        card.dataset.sentence = si;

        var sentHtml = buildSentenceHtml(sent.en, sent.boldWords, article.lang);

        card.innerHTML =
          '<div class="sentence-en">' +
            '<span class="sentence-text">' + sentHtml + '</span>' +
            '<button class="translate-toggle" onclick="toggleTranslation(this)">' +
              '<span>💬</span> 译' +
            '</button>' +
            '<button class="speaker-btn" onclick="speakSentence(this)" title="Read this sentence">' +
              '<span class="speaker-icon">🔈</span>' +
              '<span class="cloud-badge" title="Cloud TTS"></span>' +
            '</button>' +
          '</div>' +
          '<div class="sentence-zh">' +
            '<div class="sentence-zh-inner">' +
              '<span class="sentence-zh-loading">Loading translation...</span>' +
            '</div>' +
          '</div>';

        paraDiv.appendChild(card);
      });

      body.appendChild(paraDiv);
    });

    // Add prev/next navigation
    var navDiv = section.querySelector('#articleNav_' + ai);
    var hasPrev = ai > 0;
    var hasNext = ai < ARTICLES.length - 1;
    var prevTitle = hasPrev ? ARTICLES[ai - 1].title : '';
    var nextTitle = hasNext ? ARTICLES[ai + 1].title : '';

    navDiv.innerHTML =
      '<button class="nav-btn nav-prev" ' + (hasPrev ? '' : 'disabled') + ' ' + (hasPrev ? 'onclick="switchArticle(' + (ai - 1) + ')"' : '') + '>' +
        '<span class="nav-arrow">←</span>' +
        '<span class="nav-info">' +
          '<span class="nav-label">Previous</span>' +
          '<span class="nav-title">' + (hasPrev ? escapeHtml(prevTitle) : '—') + '</span>' +
        '</span>' +
      '</button>' +
      '<button class="nav-btn nav-next" ' + (hasNext ? '' : 'disabled') + ' ' + (hasNext ? 'onclick="switchArticle(' + (ai + 1) + ')"' : '') + '>' +
        '<span class="nav-info">' +
          '<span class="nav-label">Next</span>' +
          '<span class="nav-title">' + (hasNext ? escapeHtml(nextTitle) : '—') + '</span>' +
        '</span>' +
        '<span class="nav-arrow">→</span>' +
      '</button>';
  });
}

function buildSentenceHtml(text, boldWords, lang) {
  var parts = text.split(/(<b>[^<]+<\/b>)/g);
  var html = '';
  parts.forEach(function(part) {
    var boldMatch = part.match(/^<b>([^<]+)<\/b>$/);
    if (boldMatch) {
      html += wrapWord(boldMatch[1], true, lang);
    } else {
      // Split by whitespace and wrap each token (works for both en/zh)
      var tokens = part.split(/(\s+)/);
      tokens.forEach(function(token) {
        if (/^\s+$/.test(token)) {
          html += token;
        } else if (token) {
          html += wrapWord(token, false, lang);
        }
      });
    }
  });
  return html;
}

function wrapWord(token, isBold, lang) {
  if (lang === 'zh') {
    // For Chinese, use the whole token as the lookup key
    var cleanWord = token.replace(/[^一-鿿㐀-䶿a-zA-Z]/g, '');
    if (!cleanWord) return escapeHtml(token);
    var cls = 'word' + (isBold ? ' bold-word' : '');
    return '<span class="' + cls + '" data-word="' + escapeAttr(cleanWord) + '" data-full="' + escapeAttr(token) + '">' + escapeHtml(token) + '</span>';
  }
  // For English
  var cleanWord = token.replace(/[^a-zA-Z'-]/g, '');
  if (!cleanWord) return escapeHtml(token);
  var cls = 'word' + (isBold ? ' bold-word' : '');
  return '<span class="' + cls + '" data-word="' + escapeAttr(cleanWord.toLowerCase()) + '" data-full="' + escapeAttr(token) + '">' + escapeHtml(token) + '</span>';
}

// ============================================================
//  TRANSLATION TOGGLE
// ============================================================

function toggleTranslation(btn) {
  var card = btn.closest('.sentence-card');
  var zhArea = card.querySelector('.sentence-zh');
  var zhInner = card.querySelector('.sentence-zh-inner');
  var isShown = card.classList.contains('show-translation');
  var article = ARTICLES[parseInt(card.dataset.article)];
  var lang = article ? article.lang : currentArticleLang;

  if (isShown) {
    card.classList.remove('show-translation');
    btn.innerHTML = '<span>💬</span> 译';
  } else {
    card.classList.add('show-translation');
    btn.innerHTML = '<span>👁</span> 译';

    if (!zhInner.dataset.loaded) {
      if (zhInner.dataset.loading) return;
      zhInner.dataset.loading = 'true';
      var sentText = card.querySelector('.sentence-text');
      var fullText = sentText.textContent.trim();
      zhInner.innerHTML = '<span class="sentence-zh-loading">Loading translation...</span>';
      translateText(fullText, lang).then(function(trans) {
        zhInner.innerHTML = '<span>' + escapeHtml(trans) + '</span>';
        if (isValidTranslation(trans)) {
          zhInner.dataset.loaded = 'true';
        }
        delete zhInner.dataset.loading;
      }).catch(function(error) {
        zhInner.innerHTML = '<span class="translation-error">Translation failed: ' + escapeHtml(error.message || String(error)) + '</span>';
        delete zhInner.dataset.loading;
      });
    }
  }
}

function toggleAllTranslations(articleIndex, btn) {
  var sections = document.querySelectorAll('.article-section');
  var section = sections[articleIndex];
  if (!section) return;
  var cards = section.querySelectorAll('.sentence-card');
  var anyHidden = Array.from(cards).some(function(c) { return !c.classList.contains('show-translation'); });

  cards.forEach(function(card) {
    var toggle = card.querySelector('.translate-toggle');
    if (anyHidden && !card.classList.contains('show-translation')) {
      toggleTranslation(toggle);
    } else if (!anyHidden && card.classList.contains('show-translation')) {
      toggleTranslation(toggle);
    }
  });

  btn.innerHTML = anyHidden
    ? '<span>👁</span> Hide All Translations'
    : '<span>💬</span> Show All Translations';
}