// ============================================================
//  THEME
// ============================================================

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  var portalThemeIcon = document.getElementById('portalThemeIcon');
  if (portalThemeIcon) portalThemeIcon.textContent = theme === 'dark' ? '☾' : '☀️';
}
applyTheme();

// Sync portal navbar theme toggle with page theme
(function() {
  var portalThemeBtn = document.getElementById('portalThemeToggle');
  if (portalThemeBtn) {
    portalThemeBtn.addEventListener('click', function() {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('portal-theme', theme); } catch(e) {}
      applyTheme();
    });
  }
})();
