// ============================================================
//  THEME
// ============================================================

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  var themeIcon = document.getElementById('themeIcon');
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☾' : '☀️';
}
applyTheme();

var themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', function() {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', theme); } catch(e) {}
    applyTheme();
  });
}

// Sync portal navbar theme toggle with page theme
(function() {
  var portalThemeBtn = document.getElementById('portalThemeToggle');
  var portalThemeIcon = document.getElementById('portalThemeIcon');
  function updatePortalIcon() {
    if (portalThemeIcon) portalThemeIcon.textContent = theme === 'dark' ? '☾' : '☀️';
  }
  updatePortalIcon();
  if (portalThemeBtn) {
    portalThemeBtn.addEventListener('click', function() {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', theme); } catch(e) {}
      applyTheme();
      updatePortalIcon();
    });
  }
})();
