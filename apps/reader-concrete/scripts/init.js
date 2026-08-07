// ============================================================
//  STATE
// ============================================================
const BUILTIN_COUNT = ARTICLES.length;
try {
  const saved = JSON.parse(localStorage.getItem('customArticles') || '[]');
  if (Array.isArray(saved)) {
    saved.forEach(a => ARTICLES.push(a));
  }
} catch(e) { console.log('Failed to load custom articles:', e); }

function saveCustomArticles() {
  const custom = ARTICLES.slice(BUILTIN_COUNT);
  if (!saveToLS('customArticles', JSON.stringify(custom))) {
    console.log('Failed to save custom articles: localStorage may be full');
  }
}

let currentArticle = 0;
let theme = localStorage.getItem('theme') || 'dark';
let speechRate = parseFloat(localStorage.getItem('speechRate')) || 0.95;

// ============================================================
//  THEME
// ============================================================
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '🌙' : '☀';
}
applyTheme();

// ============================================================
//  SPEED CONTROL
// ============================================================
const speedSlider = document.getElementById('speedSlider');
const speedValueEl = document.getElementById('speedValue');
speedSlider.value = speechRate;
speedValueEl.textContent = speechRate.toFixed(2) + 'x';

speedSlider.addEventListener('input', function() {
  speechRate = parseFloat(this.value);
  speedValueEl.textContent = speechRate.toFixed(2) + 'x';
  localStorage.setItem('speechRate', speechRate);
  // Revoke old Blob URLs and clear TTS audio cache since rate changed
  ttsAudioCache.forEach(function(url) { URL.revokeObjectURL(url); });
  ttsAudioCache.clear();
  ttsCacheKeys.length = 0;
});

document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  applyTheme();
});

// ============================================================
//  PROGRESS BAR
// ============================================================
function updateProgress() {
  var scrollTop = window.scrollY;
  var docHeight = document.documentElement.scrollHeight - window.innerHeight;
  var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  document.getElementById('progressBar').style.width = progress + '%';
}
var progressRAF = null;
window.addEventListener('scroll', function() {
  if (progressRAF) return;
  progressRAF = requestAnimationFrame(function() {
    progressRAF = null;
    updateProgress();
  });
}, { passive: true });

// ============================================================
//  INIT
// ============================================================
renderTabs();
renderArticles();
updateProgress();

// Sync portal navbar theme toggle with page theme
(function() {
  var portalThemeBtn = document.getElementById('portalThemeToggle');
  var portalThemeIcon = document.getElementById('portalThemeIcon');
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  if (portalThemeIcon) portalThemeIcon.textContent = current === 'dark' ? '🌙' : '☀';
  if (portalThemeBtn) {
    portalThemeBtn.addEventListener('click', function() {
      current = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', current); } catch(e) {}
      applyTheme();
      if (portalThemeIcon) portalThemeIcon.textContent = current === 'dark' ? '🌙' : '☀';
    });
  }
})();

// ============================================================
//  SCROLL-HIDE: only portalNavbar hides on scroll, header stays visible
// ============================================================
(function() {
  var navbar = document.getElementById('portalNavbar');
  var THRESHOLD = 100;
  var lastScrollY = 0;

  function updateNavVisibility() {
    var scrollY = window.scrollY;
    if (scrollY > THRESHOLD) {
      if (navbar) navbar.style.transform = 'translateY(-100%)';
    } else {
      if (navbar) navbar.style.transform = '';
    }
    lastScrollY = scrollY;
  }

  window.addEventListener('scroll', function() {
    requestAnimationFrame(updateNavVisibility);
  }, { passive: true });
})();
