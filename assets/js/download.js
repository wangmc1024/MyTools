/**
 * MyTools Portal — Download Panel Logic
 * Renders and manages the download center content.
 * Expects esc() and handleDownload() to be available globally (from tools.js / main script).
 */
(function () {
  'use strict';

  /* ---- TOOLS DATA (synchronized with index.html) ---- */
  const TOOLS_DATA = [
    { name: "Article Reader", icon: "📚", type: "Web Tool", category: "阅读", description: "英语文章阅读、翻译、TTS朗读工具。支持导入 Markdown 文章，逐句翻译，单词悬停释义，云端/系统双引擎朗读。", status: "online", url: "./article-reader/index.html", version: null, updatedAt: "2026-07-23" },
    { name: "English Learning Reader", icon: "📖", type: "Web Tool", category: "学习", description: "交互式英语学习阅读器，提供文章阅读与学习辅助功能。", status: "online", url: "./reader-concrete/index.html", version: null, updatedAt: "2026-07-23" },
    { name: "DeepSeek 问答一键导出 MD", icon: "📝", type: "浏览器脚本", category: "效率工具", description: "Tampermonkey 用户脚本，一键导出 DeepSeek 对话内容为 Markdown 格式。自动清理代码块工具栏，提取公式。", status: "online", downloadUrl: "https://gitee.com/wangmc1024/MyTools/raw/main/tempermonkeyScript/DeepSeek%E9%97%AE%E7%AD%94%E4%B8%80%E9%94%AE%E5%AF%BC%E5%87%BAmd.js", fileType: "Userscript", version: "v6.6", updatedAt: "2026-06-10" },
    { name: "评教一键勾选", icon: "✅", type: "浏览器脚本", category: "效率工具", description: "南工大评教 Tampermonkey 脚本。右上角按钮，点击即一键全选'完全赞同'，支持动态内容监听。", status: "online", downloadUrl: "https://gitee.com/wangmc1024/MyTools/raw/main/tempermonkeyScript/%E8%AF%84%E6%95%99%E4%B8%80%E9%94%AE%E5%8B%BE%E9%80%89.js", fileType: "Userscript", version: "v6.0", updatedAt: "2026-06-10" }
  ];

  /* ---- Render download list ---- */
  window.renderDownloads = function () {
    const list = document.getElementById('downloadList');
    if (!list) return;

    const dl = TOOLS_DATA.filter(t => t.downloadUrl);
    if (!dl.length) {
      list.innerHTML = '<div class="text-center text-[var(--text-muted)] py-16">暂无可用下载资源</div>';
      return;
    }

    list.innerHTML = dl.map(t => `
      <div class="rounded-xl p-5 flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border)] transition hover:border-primary hover:bg-[var(--bg-card-hover)]" data-url="${esc(t.downloadUrl)}">
        <span class="text-2xl w-11 h-11 flex items-center justify-center rounded-xl bg-primary/10 shrink-0">${esc(t.icon)}</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-[var(--text)] truncate">${esc(t.name)}</div>
          <div class="text-xs text-[var(--text-muted)] mt-0.5">${t.version ? esc(t.version) + ' · ' : ''}${esc(t.fileType || '')}</div>
          <div class="text-xs text-[var(--text-muted)] mt-0.5 truncate">${esc(t.description)}</div>
        </div>
        <button class="shrink-0 px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primaryLight transition cursor-pointer dl-btn">下载安装</button>
      </div>
    `).join('');

    // Wire download buttons (data-URL approach, XSS-safe)
    list.querySelectorAll('.dl-btn').forEach(btn => {
      const row = btn.closest('[data-url]');
      if (row) btn.addEventListener('click', () => window.handleDownload(row.dataset.url));
    });
  };
})();
