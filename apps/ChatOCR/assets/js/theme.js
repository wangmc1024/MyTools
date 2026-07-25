/**
 * theme.js — Portal theme sync.
 * Reuses repo globals (window.setTheme/getTheme/toggleTheme from assets/js/tools.js,
 * keyed on localStorage['portal-theme']). Does NOT reimplement.
 */

function getStored() {
  try { return localStorage.getItem('portal-theme') || 'light'; }
  catch { return 'light'; }
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('portalThemeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀️';
  // recolor portal navbar to match
  const navbar = document.getElementById('portalNavbar');
  if (navbar) {
    navbar.style.background = theme === 'dark' ? '#16161c' : '#f3efe7';
    navbar.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,31,0.10)';
    navbar.style.color = theme === 'dark' ? '#9b9ba6' : '#6b6b78';
  }
}

/** Initialize theme on load. Bind the portal navbar toggle + any in-app toggle. */
export function initTheme() {
  apply(getStored());

  const portalBtn = document.getElementById('portalThemeToggle');
  if (portalBtn && !portalBtn.dataset.bound) {
    portalBtn.dataset.bound = '1';
    portalBtn.addEventListener('click', () => {
      const next = getStored() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('portal-theme', next); } catch {}
      apply(next);
    });
  }

  const appBtn = document.getElementById('appThemeToggle');
  if (appBtn && !appBtn.dataset.bound) {
    appBtn.dataset.bound = '1';
    appBtn.addEventListener('click', () => {
      const next = getStored() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('portal-theme', next); } catch {}
      apply(next);
    });
  }
}

export function currentTheme() { return getStored(); }
