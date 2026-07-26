(function() {
  var toolTitle = document.getElementById('toolTitle');
  if (toolTitle) { try { toolTitle.textContent = document.title.replace(/VoiceCraft\s*[-–—].*/, '').trim() || 'VoiceCraft'; } catch(e) {} }
  function getTheme() { try { return localStorage.getItem('portal-theme') || 'light'; } catch(e) { return 'light'; } }
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('portal-theme', t); } catch(e) {}; var ic = document.getElementById('portalThemeIcon'); if (ic) ic.textContent = t === 'dark' ? '☾' : '☀️'; }
  window.toggleTheme = function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); };
  window.getTheme = getTheme;
  window.setTheme = setTheme;
  var btn = document.getElementById('portalThemeToggle');
  var icon = document.getElementById('portalThemeIcon');
  if (btn && icon) { btn.addEventListener('click', function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTheme(getTheme()); }); } else { setTheme(getTheme()); }
})();
