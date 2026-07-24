---
name: sync-toolkit
description: 将新增/变更的工具文件自动注册到项目配置
---

# sync-toolkit: 工具注册同步 Skill

## 任务

将新增或变更的工具文件自动同步到项目的注册配置中，包括工具卡片、目录树和门户导航。

## 步骤

### 1. 扫描变更

- `git diff HEAD~1 --name-status` 获取最近提交的新增/修改文件
- 如没有 git diff（首次使用），用 `find apps/ tempermonkeyScript/ -type f` 扫描全部

### 2. 发现未注册的文件

读取 `assets/data/tools.json`，收集已有的 `url` 和 `downloadUrl` 值。
对比扫描到的文件列表，找出未注册的条目。

### 3. 对每个未注册文件分类处理

#### Web Tool (`apps/*/index.html`)

1. **提取元信息：**
   - 从 HTML `<title>` 标签提取工具名（如有）
   - 无 `<title>` 则从目录名转换（kebab-case/slug → Title Case）
   - **icon**：按关键词匹配优先，其次 fallback 默认值 🔧：
     - 包含 "TTS" / "语音" / "speech" / "voice" → 🎙️
     - 包含 "阅读" / "reader" / "read" / "book" / "学习" / "learn" → 📖
     - 包含 "翻译" / "translate" → 🌐
     - 包含 "图表" / "chart" / "graph" / "可视化" / "visual" → 📊
     - 包含 "下载" / "download" → ⬇️
     - 包含 "图片" / "image" / "photo" / "图" → 🖼️
     - 包含 "音乐" / "audio" / "music" / "播放" / "player" → 🎵
     - 包含 "笔记" / "note" / "写作" / "write" → ✏️
     - 包含 "编辑" / "editor" / "代码" / "code" → 💻
     - 包含 "AI" / "智能" / "llm" / "chat" / "对话" → 🤖
     - 包含 "工具" / "tool" / "generator" / "生成" → 🛠️
     - 无匹配 → 🔧
   - **version**：从 `<meta name="version">` 或文件名提取 `v\d+\.\d+` 模式
   - **description**：主动提取，不空填 — 优先级：
     1. `<meta name="description" content="...">` 的静态 content
     2. i18n 翻译块中的 `page.description` 中文版本（含中文关键词如 "支持"、"拥有"、"平台"、"功能" 的句子）
     3. `<h1>` + `<p class="subtitle">` 组合
     4. 最终 fallback 空字符串（用户后续补充）

2. **检查是否需要注入门户导航：**
   - 搜索文件中是否存在 `id="portalNavbar"`
   - 如不存在，在 `<body>` 后第一个内容元素之前注入导航栏 HTML（见下方模板）

3. **注入门户导航栏（如缺少的）：**

   > ⚠️ 路径注意：web 应用位于 `apps/` 子目录下，返回首页需穿过两层目录
   > （app名 → apps → root），使用 `../../index.html`。旧结构下（文件直接放 root）
   > 用的是 `../index.html`，迁移到 apps/ 后需要修正。

```html
<div id="portalNavbar" style="position:sticky;top:0;z-index:9999;background:var(--bg-secondary);border-bottom:1px solid var(--border);display:flex;align-items:center;height:40px;padding:0 16px;font-size:13px;color:var(--text-muted);gap:8px;">
  <a href="../../index.html" style="color:var(--accent-light);text-decoration:none;font-weight:700;display:flex;align-items:center;gap:4px;">← MyTools</a>
  <span style="color:var(--border-hover);">|</span>
  <span style="font-weight:500;color:var(--text-primary);" id="toolTitle">[工具名]</span>
  <div style="flex:1;"></div>
  <button id="portalThemeToggle" style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:4px;transition:all 0.2s;" title="切换主题"><span id="portalThemeIcon"></span></button>
</div>
```

**⚠️ 与其他 Web 应用保持一致：**
- nav 栏 HTML 结构与 [article-reader](apps/article-reader/index.html)、[reader-concrete](apps/reader-concrete/index.html) 完全一致
- 工具名使用 `id="toolTitle"` 而非硬编码
- 如果页面内有 `position: fixed` 的元素（如语言切换器），确保 `top` 值 ≥ 48px（nav 栏高度 40px + 8px 间距），避免视觉重叠

**CSS 变量注入（导航栏必需）：**

> ⚠️ 旧的导航栏模板引用了 `var(--bg-secondary)`、`var(--accent-light)` 等变量，
> 如果目标应用已有自己的 `:root` 变量体系，**不能只改导航栏 inline style**，必须同步在 `:root`
> 中补充这些共享变量，否则导航栏颜色会 fallback。

在 `:root` 末尾追加：
```css
/* Portal navbar variables — shared with other Web Tools */
--bg-secondary: #111827;
--accent-light: #818cf8;
--border-hover: rgba(255,255,255,0.28);
--bg-card: rgba(255,255,255,0.14);
```

并在 `:root` 之后添加 dark/light 适配：
```css
[data-theme="light"] {
  --bg-secondary: #f8fafc;
  --accent-light: #2563eb;
  --border-hover: rgba(0,0,0,0.12);
  --bg-card: #ffffff;
}
```

4. **注入后，需确保 HTML 中有相应的主题切换脚本：**
   - 参考现有应用的 inline 主题切换代码实现（tools.js 不直接引入，保持一致的 inline 方案）
   - 在 `</body>` 前添加：
```html
<script>
(function() {
  var toolTitle = document.getElementById('toolTitle');
  if (toolTitle) { try { toolTitle.textContent = document.title || 'MyTool'; } catch(e) {} }
  // Theme sync
  function getTheme() { try { return localStorage.getItem('portal-theme') || 'light'; } catch(e) { return 'light'; } }
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('portal-theme', t); } catch(e) {}; var ic = document.getElementById('portalThemeIcon'); if (ic) ic.textContent = t === 'dark' ? '🌙' : '☀️'; }
  window.toggleTheme = function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); };
  window.getTheme = getTheme;
  window.setTheme = setTheme;
  var btn = document.getElementById('portalThemeToggle');
  var icon = document.getElementById('portalThemeIcon');
  if (btn && icon) { btn.addEventListener('click', function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTheme(getTheme()); }); } else { setTheme(getTheme()); }
})();
</script>
```

#### 浏览器脚本 (`tempermonkeyScript/*.js`)

1. **提取元信息：**
   - 从文件名提取名称（去除 `.js`，转 Title Case）
   - **icon**：优先按关键词匹配，其次 fallback 🎬
     - 包含 "导出" / "export" → 📤
     - 包含 "下载" / "download" → ⬇️
     - 包含 "登录" / "login" / "自动" / "auto" → 🔑
     - 包含 "评教" / "评价" → ✅
     - 包含 "抓取" / "spider" / "爬虫" → 🕷️
     - 包含 "广告" / "ad" / "屏蔽" → 🚫
     - 包含 "翻译" / "translate" → 🌐
     - 无匹配 → 🎬
   - **category**：归类到以下分类体系：
     - Web Tool → `"学习"`（含阅读、学习、工具类）
     - 浏览器脚本 → `"效率工具"`（原"效率工具" + "AI工具"已合并）
   - version：从文件名或文件头部注释提取 `v\d+\.\d+` 模式
   - **description**：
     1. 从文件头部 `// @description` 注释提取（Tampermonkey metadata）
     2. 从文件名中的功能词推断简短描述（如 "DeepSeek问答一键导出md.js" → "DeepSeek 问答导出 Markdown"）
     3. 最终 fallback 空字符串

### 4. 更新配置文件

#### 更新 `assets/data/tools.json`

- 生成新工具卡片（JSON 格式），追加到数组末尾
- 必填字段：`name`, `icon`, `type`, `category`, `description`, `status: "online"`, `updatedAt`（今日日期 YYYY-MM-DD）
- 可选字段：`version`（如上推断）, `fileType`
- 格式化为 2-space indent 的标准 JSON 数组

#### 更新 `assets/data/repo-tree.json`

- **增量合并**，不重写整个文件
- Web Tool：在 `apps` → `children` 下创建对应目录及 `index.html` 节点
- 浏览器脚本：在 `tempermonkeyScript` → `children` 下添加 `.js` 文件节点
- 使用递归合并逻辑：先找目标父节点路径，逐个子节点比对
- 已有节点跳过，新节点追加
- 最终序列化写入，保持缩进一致

### 5. 检查并更新 CLAUDE.md

- 收集所有已注册工具的 type 和 category 值
- 与 CLAUDE.md 中「添加新工具」章节对比
- 如有新的 type/category 未被 CLAUDE.md 描述覆盖，在该章节追加说明

### 6. 清理 repo-tree.json

- **遍历** `repo-tree.json` 所有文件节点（含 `path` 字段）
- 使用 `os.path.exists()` 校验路径是否存在
- **不存在**的节点移除；同级目录无子节点时移除空父目录
- 同时移除 top-level 的纯 `name` 节点（如已删除但残留的文件）

### 7. 输出报告

向用户展示最终结果：

```
sync-toolkit 完成!

新增工具: N 个
  ✓ apps/new-tool/index.html → tools.json + 注入导航栏
  ✓ tempermonkeyScript/script.js → tools.json

清理 repo-tree: M 个失效条目已移除

更新文件:
  ✓ assets/data/tools.json（分类：阅读→学习, AI工具+效率工具合并）
  ✓ assets/data/repo-tree.json（已清理 stale 条目）
  [可选] CLAUDE.md（如有新 type/category）

请 review 变更后再 commit。
```

## 分类体系

| 类型 | 分类 | 说明 |
|------|------|------|
| Web Tool | 学习 | 阅读、学习、语言、知识类 |
| 浏览器脚本 | 效率工具 | 自动化工具、Tampermonkey 脚本 |

> ⚠️ 旧的 `AI工具` 和 `效率工具` 已合并为 `效率工具`，`阅读` 已归入 `学习`。

## 注意事项

- **不自动 git commit** — 写入操作需用户确认
- **description 优先提取** — 主动从 meta/i18n/注释中提取，仅当无法提取时留空
- **icon 关键词匹配** — 按功能关键词自动选择 emoji，比默认值更贴切
- **repo-tree 清理机制（联动 pre-commit hook）**：
  - 项目预提交 hook (`.git-hooks/pre-commit.sh` → `.git/hooks/pre-commit`) 会在每次 `git commit` 前自动扫描 `repo-tree.json` 所有 `path` 字段，校验对应文件是否仍存在于磁盘
  - 失效条目会被自动移除（含无 `path` 字段的残留顶层节点）
  - **路径匹配注意**：使用 `os.path.relpath()` 收集磁盘文件列表，与 tree 中的 `path` 做精确字符串对比；**不要**对带隐藏目录前缀的路径调用 `normpath`（会吞掉 `.`），也不要 `lstrip('./')`（会把 `.claude` 变成 `claude`），只 `startswith('./')` 去前缀即可
  - hook 脚本在清理 stale 时**不会阻止 commit**，只做告知和静默更新
- **分类体系为「学习」和「效率工具」两个**，新增工具时不要创建新分类
- 如果没有任何未注册文件，提示 "All tools are registered." 并结束
