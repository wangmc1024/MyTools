// ============================================================
//  WORD HOVER TOOLTIP (Progressive Display)
//  Fix: pointer-events: none on tooltip container allows
//  audio buttons to remain clickable after mouse release
// ============================================================
var tooltip = document.getElementById('wordTooltip');
var tooltipWord = document.getElementById('tooltipWord');
var tooltipTranslation = document.getElementById('tooltipTranslation');
var hoverTimeout = null;
var currentHoveredWord = null;
var wordFetchTimeout = null;
var hideTimeout = null;
var pendingProgressiveFetch = null;

// Track mouse position to detect if mouse is near the tooltip area
var lastMouseX = -1;
var lastMouseY = -1;
var mouseNearTooltip = false;

document.addEventListener('mouseover', function(e) {
  var wordEl = e.target.closest('.word');
  if (!wordEl) return;

  var word = wordEl.dataset.word;
  if (!word) return;

  // Get article language
  var card = wordEl.closest('.sentence-card');
  var lang = currentArticleLang;
  if (card) {
    var article = ARTICLES[parseInt(card.dataset.article)];
    if (article) lang = article.lang;
  }

  currentHoveredWord = word;
  tooltipTranslation.innerHTML = '<span class="tooltip-loading">加载中...</span>';
  tooltip.style.display = 'block';

  // Cancel any previous progressive fetch for this word
  if (pendingProgressiveFetch) {
    pendingProgressiveFetch.aborted = true;
    pendingProgressiveFetch = null;
  }

  var rect = wordEl.getBoundingClientRect();
  var top = rect.bottom + 8;
  var left = rect.left;
  setTimeout(function() {
    var tRect = tooltip.getBoundingClientRect();
    if (left + tRect.width > window.innerWidth - 16) {
      left = window.innerWidth - tRect.width - 16;
    }
    if (top + tRect.height > window.innerHeight - 16) {
      top = rect.top - tRect.height - 8;
    }
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }, 0);

  // Debounce fetch: wait 100ms before fetching to avoid rapid-fire requests
  if (wordFetchTimeout) clearTimeout(wordFetchTimeout);
  wordFetchTimeout = setTimeout(function() {
    startProgressiveFetch(word, lang);
  }, 100);
});

/**
 * Progressive fetch: show first result immediately, then merge others.
 */
function startProgressiveFetch(word, lang) {
  var fetchHandle = { aborted: false };
  pendingProgressiveFetch = fetchHandle;

  fetchWordDictionary(word).then(function(result) {
    if (fetchHandle.aborted || currentHoveredWord !== word) return;
    if (result) {
      tooltipTranslation.innerHTML = formatWordDictionaryHTML(result);
    } else {
      // Fallback: try translateWord if all APIs failed
      translateWord(word, lang).then(function(trans) {
        if (!fetchHandle.aborted && currentHoveredWord === word) {
          tooltipTranslation.innerHTML =
            '<div class="dict-word">' + escapeHtml(word) + '</div>' +
            '<div class="dict-def">' + escapeHtml(trans) + '</div>';
        }
      }).catch(function() {
        if (!fetchHandle.aborted && currentHoveredWord === word) {
          tooltipTranslation.innerHTML = '<span class="tooltip-loading">暂无释义</span>';
        }
      });
    }
    pendingProgressiveFetch = null;
  }).catch(function(e) {
    console.log('Progressive fetch error:', e.message);
    if (!fetchHandle.aborted && currentHoveredWord === word) {
      tooltipTranslation.innerHTML = '<span class="tooltip-loading">暂无释义</span>';
    }
    pendingProgressiveFetch = null;
  });
}

document.addEventListener('mouseout', function(e) {
  var wordEl = e.target.closest('.word');
  if (!wordEl) return;

  if (hideTimeout) clearTimeout(hideTimeout);

  hideTimeout = setTimeout(function() {
    var overTooltip = mouseNearTooltip;
    var overWord = e.relatedTarget && e.relatedTarget.closest('.word');
    if (!overTooltip && !overWord) {
      tooltip.style.display = 'none';
      currentHoveredWord = null;
      mouseNearTooltip = false;
      if (pendingProgressiveFetch) {
        pendingProgressiveFetch.aborted = true;
        pendingProgressiveFetch = null;
      }
    }
    hideTimeout = null;
  }, 150);
});

document.addEventListener('mousemove', function(e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  var overTooltip = false;
  var overWord = e.target.closest('.word');

  if (tooltip.style.display === 'block') {
    var tRect = tooltip.getBoundingClientRect();
    var margin = 20;
    overTooltip = (
      e.clientX >= tRect.left - margin &&
      e.clientX <= tRect.right + margin &&
      e.clientY >= tRect.top - margin &&
      e.clientY <= tRect.bottom + margin
    );
  }

  if (overTooltip || overWord) {
    mouseNearTooltip = overTooltip;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  } else {
    mouseNearTooltip = false;
  }
});

document.addEventListener('click', function(e) {
  var overWord = e.target.closest('.word');
  var overTooltip = e.target.closest('#wordTooltip');
  if (!overWord && !overTooltip) {
    tooltip.style.display = 'none';
    currentHoveredWord = null;
    mouseNearTooltip = false;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    if (pendingProgressiveFetch) {
      pendingProgressiveFetch.aborted = true;
      pendingProgressiveFetch = null;
    }
  }
});
