// ============================================================
//  RENDER TABS
// ============================================================
const tabsWrapper = document.getElementById('tabsWrapper');

function renderTabs() {
  tabsWrapper.innerHTML = '';
  ARTICLES.forEach((article, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (i === currentArticle ? ' active' : '');
    let html = '<span class="tab-num">' + (i+1) + '</span><span class="tab-text">' + escapeHtml(article.title) + '</span>';
    // Add delete button for custom articles
    if (i >= BUILTIN_COUNT) {
      html += '<button class="tab-delete" onclick="event.stopPropagation(); deleteArticle(' + i + ')" title="Remove this article">&#10005;</button>';
    }
    btn.innerHTML = html;
    btn.addEventListener('click', () => switchArticle(i));
    tabsWrapper.appendChild(btn);
  });
}

// ============================================================
//  RENDER ARTICLE
// ============================================================
const mainContainer = document.getElementById('mainContainer');
const renderedArticles = new Set(); // Track which articles have been rendered

function switchArticle(index) {
  stopSpeech();
  // Lazy-render: render target article on demand if not yet rendered
  if (!renderedArticles.has(index)) {
    renderSingleArticle(index);
  }
  currentArticle = index;
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.article-section').forEach((s, i) => {
    s.classList.toggle('active', i === index);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateProgress();
}

function renderSingleArticle(ai) {
  if (renderedArticles.has(ai)) return;
  renderedArticles.add(ai);
  var article = ARTICLES[ai];
  var section = document.createElement('div');
  section.className = 'article-section' + (ai === currentArticle ? ' active' : '');

  var totalSentences = 0;
  var totalBold = new Set();
  article.paragraphs.forEach(function(p) {
    totalSentences += p.sentences.length;
    p.sentences.forEach(function(s) { s.boldWords.forEach(function(w) { totalBold.add(w); }); });
  });

  section.innerHTML = `
    <h1 class="article-title">${escapeHtml(article.title)}</h1>
    <div class="article-meta">
      <span>📖 ${totalSentences} sentences</span>
      <span>📝 ${totalBold.size} vocabulary words</span>
      <span>📄 ${article.paragraphs.length} paragraphs</span>
    </div>
    <div class="toolbar">
      <button class="tool-btn" onclick="toggleAllTranslations(${ai}, this)">
        <span>👁</span> Show All Translations
      </button>
      <button class="tool-btn" onclick="speakArticle(${ai}, this)">
        <span>🔊</span> Read Article
      </button>
    </div>
    <div class="article-body" id="articleBody_${ai}"></div>
    <div class="article-nav" id="articleNav_${ai}"></div>
  `;

  mainContainer.appendChild(section);

  var body = section.querySelector('.article-body');
  article.paragraphs.forEach(function(para, pi) {
    var paraDiv = document.createElement('div');
    paraDiv.className = 'paragraph';

    para.sentences.forEach(function(sent, si) {
      var card = document.createElement('div');
      card.className = 'sentence-card';
      card.dataset.article = ai;
      card.dataset.para = pi;
      card.dataset.sentence = si;

      var sentHtml = buildSentenceHtml(sent.en, sent.boldWords);

      card.innerHTML = `
        <div class="sentence-en">
          ${sentHtml}
          <button class="translate-toggle" onclick="toggleTranslation(this)">
            <span>💬</span> 译
          </button>
          <button class="speaker-btn" onclick="speakSentence(this)" title="Read this sentence">
            <span class="speaker-icon">🔈</span>
            <span class="cloud-badge" title="Cloud TTS"></span>
          </button>
        </div>
        <div class="sentence-zh">
          <div class="sentence-zh-inner">
            <span class="sentence-zh-loading">Loading translation...</span>
          </div>
        </div>
      `;

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

  navDiv.innerHTML = `
    <button class="nav-btn nav-prev" ${hasPrev ? '' : 'disabled'} ${hasPrev ? 'onclick="switchArticle(' + (ai - 1) + ')"' : ''}>
      <span class="nav-arrow">←</span>
      <span class="nav-info">
        <span class="nav-label">Previous</span>
        <span class="nav-title">${hasPrev ? escapeHtml(prevTitle) : '—'}</span>
      </span>
    </button>
    <button class="nav-btn nav-next" ${hasNext ? '' : 'disabled'} ${hasNext ? 'onclick="switchArticle(' + (ai + 1) + ')"' : ''}>
      <span class="nav-info">
        <span class="nav-label">Next</span>
        <span class="nav-title">${hasNext ? escapeHtml(nextTitle) : '—'}</span>
      </span>
      <span class="nav-arrow">→</span>
    </button>
  `;
}

function renderArticles() {
  // Only render the active article (lazy rendering for others)
  mainContainer.innerHTML = '';
  renderedArticles.clear();
  renderSingleArticle(currentArticle);
}
