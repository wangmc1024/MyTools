// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

function isValidTranslation(text) {
  if (!text || typeof text !== 'string' || text.length < 1) return false;
  var lower = text.toLowerCase();
  for (var i = 0; i < TRANSLATION_ERROR_MARKERS.length; i++) {
    if (lower.includes(TRANSLATION_ERROR_MARKERS[i].toLowerCase())) return false;
  }
  return true;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(message, type) {
  type = type || 'info';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

function setEngineStatus(engine, label) {
  var badge = document.getElementById('ttsEngineBadge');
  var lbl = document.getElementById('engineLabel');
  badge.setAttribute('data-engine', engine);
  lbl.textContent = label;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getLangPair(lang) {
  if (lang === 'zh') {
    return {
      deeplx: { source: 'ZH', target: 'EN' },
      mymemory: 'zh-CN|en',
    };
  }
  return {
    deeplx: { source: 'EN', target: 'ZH' },
    mymemory: 'en|zh-CN',
  };
}
