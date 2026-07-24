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
  const icon = document.getElementById('themeIcon') || document.getElementById('themeToggleIcon');
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
  Object.assign(toast.style, {
    padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
    color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', opacity: '0',
    transform: 'translateY(20px)', transition: 'all 0.3s ease',
    background: type === 'info' ? '#635bff' : type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#635bff'
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

/**
 * Convert a Gitee blob/browse URL to a raw URL.
 * Replaces only the FIRST /blob/ → /raw/ (not global).
 * Also handles enterprise *.gitee.com and existing raw URLs.
 * Strips anchors, preserves query parameters.
 * Returns null for non-Gitee or invalid URLs.
 */
function giteeToRaw(url) {
  if (!url || typeof url !== 'string') return null;
  var u = url.trim();

  // Must be a gitee URL (strip anchor/query before checking)
  var bareUrl = u.split('#')[0].split('?')[0];
  if (!/\/\/.*gitee\.com\//.test(bareUrl)) return null;

  // Strip anchor and query
  u = u.split('#')[0].split('?')[0];

  // Replace only first /blob/ → /raw/ (handles browse paths and explicit blob paths)
  var idx = u.indexOf('/blob/');
  if (idx !== -1) {
    u = u.substring(0, idx) + '/raw/' + u.substring(idx + 6);
  }
  // Also handle enterprise /-/blob/ → /-/raw/
  idx = u.indexOf('/-/blob/');
  if (idx !== -1) {
    u = u.substring(0, idx) + '/-/raw/' + u.substring(idx + 8);
  }
  // Handle /browse/ → /raw/.../main (for repo root browse links)
  idx = u.indexOf('/browse');
  if (idx !== -1) {
    var after = u.substring(idx + 7); // skip /browse
    // Insert /raw/main after the path segment before /browse
    u = u.substring(0, idx) + '/raw/main' + after;
  }

  return u || null;
}

/* ---------- Download helpers ---------- */

/** Proxy base URL — handles Gitee downloads */
var PROXY_BASE = 'https://download.wangmc1024.workers.dev/?target=';

/**
 * Lightweight HEAD probe to check if the proxy is alive.
 * Returns Promise<boolean>. ~zero bandwidth (~few hundred bytes).
 */
function probeProxy(rawUrl) {
  var proxyUrl = PROXY_BASE + encodeURIComponent(rawUrl);
  return fetch(proxyUrl, { method: 'HEAD', mode: 'cors', cache: 'no-cache' })
    .then(function(r) { return r.ok && r.status >= 200 && r.status < 400; })
    .catch(function() { return false; });
}

/**
 * Legacy download wrapper: direct fetch→blob fallback to open-in-tab.
 * Supports both Gitee URLs and local relative paths.
 */
function handleDownload(url) {
  if (!url) return;

  var rawUrl = giteeToRaw(url);
  if (rawUrl && rawUrl.indexOf('http') === 0) {
    // It's an external Gitee URL
    showToast('正在下载...', 'info');
    fetch(rawUrl)
      .then(function(res) { return res.blob(); })
      .then(function(blob) {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = decodeURIComponent(rawUrl.split('/').pop() || 'download');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 1000);
      })
      .catch(function() {
        showToast('下载失败，已为您打开源文件，请右键页面选择「另存为」保存', 'info');
        window.open(rawUrl, '_blank');
      });
  } else if (url) {
    // Relative/local path — fetch directly
    showToast('正在下载...', 'info');
    fetch(url)
      .then(function(res) { return res.blob(); })
      .then(function(blob) {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = decodeURIComponent(url.split('/').pop() || 'download');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 1000);
      })
      .catch(function() {
        showToast('下载失败，请手动获取该文件', 'info');
      });
  }
}

/**
 * Proxy-aware download with HEAD probe + graceful degradation.
 * Intended for cases where proxy bandwidth conservation matters.
 * If Cloudflare worker proxy is alive, downloads through it.
 * If proxy fails, opens raw URL directly (zero CF traffic).
 *
 * @param {string} originUrl - The original Gitee URL (blob/browse/raw)
 */
function downloadByGiteeProxy(originUrl) {
  if (!originUrl) {
    showToast('无效的文件链接', 'error');
    return;
  }

  // Convert to raw URL
  var rawUrl = giteeToRaw(originUrl);
  if (!rawUrl) {
    showToast('无法解析文件链接，请检查原始地址', 'error');
    return;
  }

  var proxyUrl = PROXY_BASE + encodeURIComponent(rawUrl);

  // Probe proxy availability via lightweight HEAD request
  probeProxy(rawUrl).then(function(proxied) {
    if (proxied) {
      // Proxy is alive — download through it
      showToast('正在通过代理下载...', 'info');
      var a = document.createElement('a');
      a.href = proxyUrl;
      a.download = '';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Proxy failed — degrade gracefully
      showToast('下载代理暂不可用，已为您打开源文件，请右键页面选择「另存为」保存', 'info');
      // Open raw URL in new tab so user can Save As
      window.open(rawUrl, '_blank');
    }
  }).catch(function() {
    // Unexpected error — degrade gracefully
    showToast('下载代理暂不可用，已为您打开源文件，请右键页面选择「另存为」保存', 'info');
    window.open(rawUrl, '_blank');
  });
}

window.esc = escapeHtml; // alias for compatibility with inline scripts
window.showToast = showToast;
window.handleDownload = handleDownload;
window.downloadByGiteeProxy = downloadByGiteeProxy;
window.giteeToRaw = giteeToRaw;
window.toggleTheme = toggleTheme;
window.getTheme = getTheme;
window.setTheme = setTheme;

// Auto-initialize theme when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTheme(getTheme()); });
} else {
  setTheme(getTheme());
}