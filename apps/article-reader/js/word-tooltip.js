// ============================================================
//  WORD HOVER TOOLTIP
// ============================================================

var tooltip = document.getElementById('wordTooltip');
var tooltipWord = document.getElementById('tooltipWord');
var tooltipTranslation = document.getElementById('tooltipTranslation');
var hoverTimeout = null;
var currentHoveredWord = null;

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
  tooltipWord.textContent = word;
  tooltipTranslation.innerHTML = '<span class="tooltip-loading">Loading...</span>';
  tooltip.style.display = 'block';

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

  translateWord(word, lang).then(function(trans) {
    if (currentHoveredWord === word) {
      tooltipTranslation.textContent = trans;
    }
  });
});

document.addEventListener('mouseout', function(e) {
  var wordEl = e.target.closest('.word');
  if (!wordEl) return;
  hoverTimeout = setTimeout(function() {
    tooltip.style.display = 'none';
    currentHoveredWord = null;
  }, 200);
});

document.addEventListener('mousemove', function(e) {
  if (e.target.closest('#wordTooltip') || e.target.closest('.word')) {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  }
});
