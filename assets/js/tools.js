/**
 * MyTools Portal — Shared Utilities
 */

/* ---------- DOM helpers ---------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/* ---------- Theme ---------- */
function getTheme() {
  try {
    return localStorage.getItem('portal-theme') || 'light';
  } catch {
    return 'light';
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('portal-theme', theme); } catch {}
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☽️' : '☀️';
}

function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/* ---------- Toast notifications ---------- */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      z-index: 10001; display: flex; flex-direction: column; gap: 8px; align-items: center;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = { info: 'var(--accent)', success: 'var(--success)', error: 'var(--danger)' };
  Object.assign(toast.style, {
    padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
    color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', opacity: '0',
    transform: 'translateY(20px)', transition: 'all 0.3s ease', background: colors[type] || colors.info
  });
  toast.textContent = message;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ---------- Gitee URL helpers ---------- */
function buildGiteeRawUrl(relativePath) {
  return `https://gitee.com/wangmc1024/MyTools/raw/main/${encodeURIComponent(relativePath)}`;
}

function buildGiteeBlobUrl(relativePath) {
  return `https://gitee.com/wangmc1024/MyTools/blob/main/${encodeURIComponent(relativePath)}`;
}

function giteeToRawUrl(url) {
  if (!url) return url;
  let raw = url.replace(/\/browse(?:\/.*)?$/, '/raw/main');
  raw = raw.replace('/-/blob/', '/-/raw/');
  raw = raw.replace('/blob/', '/raw/');
  return raw;
}
