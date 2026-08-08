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
var pendingProgressiveFetch = null; // tracks current progressive fetch lifecycle

// Track mouse position to detect if mouse is near the tooltip area
var lastMouseX = -1;
var lastMouseY = -1;
var mouseNearTooltip = false;

document.addEventListener('mouseover', function(e) {
  var wordEl = e.target.closest('.word');
  if (!wordEl) return;

  var word = wordEl.dataset.word;
  if (!word) return;

  currentHoveredWord = word;
  tooltipTranslation.innerHTML = '<span class="tooltip-loading">加载中...</span>';
  tooltip.style.display = 'block';

  // Cancel any previous progressive fetch for this word
  if (pendingProgressiveFetch) {
    pendingProgressiveFetch.aborted = true;
    pendingProgressiveFetch = null;
  }

  // Position tooltip
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
    startProgressiveFetch(word);
  }, 100);
});

/**
 * Progressive fetch: launch all APIs in parallel, update UI each time any API returns.
 * Priority: Baidu translation appears first (slowest? no — Baidu is fast!), then
 * dictionary data (phonetics, audio, definitions) fills in when ready.
 */
function startProgressiveFetch(word) {
  var fetchHandle = { aborted: false, controller: new AbortController() };
  pendingProgressiveFetch = fetchHandle;

  // Show initial loading state
  tooltipTranslation.innerHTML = '<span class="tooltip-loading">加载中...</span>';

  // Use the progressive version that calls back on each response
  fetchWordDictionaryProgressive(
    word,
    function(result) {
      if (fetchHandle.aborted || currentHoveredWord !== word) return;
      if (result) {
        tooltipTranslation.innerHTML = formatWordDictionaryHTML(result);
      }
    },
    fetchHandle.controller.signal
  ).catch(function(e) {
    if (fetchHandle.aborted || currentHoveredWord !== word) return;
    console.log('Progressive fetch error:', e.message);
    // Fallback: try translateWord if all APIs failed
    translateWord(word).then(function(trans) {
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
  });
}

document.addEventListener('mouseout', function(e) {
  var wordEl = e.target.closest('.word');
  if (!wordEl) return;

  // Clear any pending hide timeout when moving between words
  if (hideTimeout) clearTimeout(hideTimeout);

  // Short delay: if mouse moves to another .word or into the tooltip area, keep it visible
  hideTimeout = setTimeout(function() {
    // Check if mouse is now over the tooltip or another word using position-based detection
    var overTooltip = mouseNearTooltip;
    var overWord = e.relatedTarget && e.relatedTarget.closest('.word');
    if (!overTooltip && !overWord) {
      tooltip.style.display = 'none';
      currentHoveredWord = null;
      mouseNearTooltip = false;
      // Abort any pending progressive fetch
      if (pendingProgressiveFetch) {
        pendingProgressiveFetch.aborted = true;
        pendingProgressiveFetch = null;
      }
    }
    hideTimeout = null;
  }, 150);
});

// Track mouse position to detect proximity to tooltip
// Since tooltip has pointer-events: none, we can't use mouseenter/mouseleave on it directly.
// Instead, we use mousemove to check if the cursor is near the tooltip bounding box.
document.addEventListener('mousemove', function(e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  var overTooltip = false;
  var overWord = e.target.closest('.word');

  // Check if mouse is near the tooltip area
  if (tooltip.style.display === 'block') {
    var tRect = tooltip.getBoundingClientRect();
    var margin = 20; // pixels of tolerance around tooltip
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

// Click on page outside word/tooltip to hide
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
