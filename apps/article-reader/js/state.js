// ============================================================
//  STATE — Variables & localStorage restoration
// ============================================================

// Article lists
var allArticles = [];        // All articles from IndexedDB
var ARTICLES = [];           // Only visible articles (subset of allArticles)
var visibleArticleIds = new Set();  // IDs of articles shown as tabs
var hasSavedVisibleArticleIds = false;

// Current view state
var currentArticle = 0;
var currentArticleLang = 'en';
var theme = 'dark';
var speechRate = 0.95;
var edgeTTSAvailable = null;
var EDGE_TTS_VOICE = '';
var lastUsedVoice = Object.assign({}, DEFAULT_LAST_USED_VOICE);

// Caches
var translationCache = {};
var wordCache = {};
var ttsAudioCache = new Map();

// System TTS
var selectedVoice = null;
var currentUtterances = [];
var currentSpeakerBtn = null;
var currentCard = null;
var currentArticleBtn = null;
var currentAudioEl = null;

// Load preferences from localStorage
try { theme = localStorage.getItem('theme') || 'dark'; } catch(e) {}
try { speechRate = parseFloat(localStorage.getItem('speechRate')) || 0.95; } catch(e) {}
try {
  var savedVisibleRaw = localStorage.getItem('visibleArticleIds');
  if (savedVisibleRaw !== null) {
    var savedVisible = JSON.parse(savedVisibleRaw);
    if (Array.isArray(savedVisible)) {
      visibleArticleIds = new Set(savedVisible);
      hasSavedVisibleArticleIds = true;
    }
  }
} catch(e) {}
try {
  var _saved = localStorage.getItem('lastUsedVoice');
  if (_saved) { var obj = JSON.parse(_saved); lastUsedVoice = Object.assign(lastUsedVoice, obj); }
} catch(e) {}
