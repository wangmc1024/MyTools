// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeout);
  return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(function() {
    clearTimeout(timer);
  });
}

function saveToLS(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch(e) {
    return false;
  }
}

function lookupCache(cache, key, lsKey) {
  if (cache[key]) return cache[key];
  try {
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      cache[key] = stored;
      return stored;
    }
  } catch(e) { /* ignore */ }
  return null;
}

// Translation result validation — prevents error messages from being cached
const TRANSLATION_ERROR_MARKERS = [
  '翻译失败', '无译文', '请检查网络',
  'timeout', 'service unavailable', 'internal error', 'bad gateway',
  'too many requests', 'access denied', '429',
  'cloudflare', 'worker error', '502', '503', '504', '524'
];

function isValidTranslation(text) {
  if (!text || typeof text !== 'string' || text.length < 1) return false;
  const lower = text.toLowerCase();
  // Error messages are usually short and contain known markers
  for (const marker of TRANSLATION_ERROR_MARKERS) {
    if (lower.includes(marker)) return false;
  }
  return true;
}

// ============================================================
//  ARTICLE RENDERING HELPERS
// ============================================================
function buildSentenceHtml(text, boldWords) {
  // text may contain <b>word</b> tags from parsing
  // We need to split into words, each wrapped in a span
  // But preserve <b> tags

  // First, replace <b>...</b> with markers
  let processed = text;
  const boldSet = new Set(boldWords.map(w => w.toLowerCase()));

  // Split by <b> tags
  const parts = processed.split(/(<b>[^<]+<\/b>)/g);

  let html = '';
  parts.forEach(part => {
    const boldMatch = part.match(/^<b>([^<]+)<\/b>$/);
    if (boldMatch) {
      // This is a bold word - wrap each word
      const word = boldMatch[1];
      html += wrapWord(word, true);
    } else {
      // Regular text - split into words
      const tokens = part.split(/(\s+)/);
      tokens.forEach(token => {
        if (/^\s+$/.test(token)) {
          html += token;
        } else if (token) {
          html += wrapWord(token, false);
        }
      });
    }
  });

  return html;
}

function wrapWord(token, isBold) {
  // Clean the word for lookup (remove punctuation)
  const cleanWord = token.replace(/[^a-zA-Z'-]/g, '');
  if (!cleanWord) return escapeHtml(token);

  const cls = 'word' + (isBold ? ' bold-word' : '');
  return '<span class="' + cls + '" data-word="' + escapeAttr(cleanWord.toLowerCase()) + '" data-full="' + escapeAttr(token) + '">' + escapeHtml(token) + '</span>';
}
