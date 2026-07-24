---
name: sync-toolkit
description: 将新增/变更的工具文件自动注册到项目配置
---

# sync-toolkit: 工具注册同步 Skill

## 任务

扫描未注册的工具文件 → 自动更新 `tools.json`、`repo-tree.json`，注入门户导航栏并清理 stale 条目。

## 步骤

### 1. 扫描 & 发现

- 优先 `git diff HEAD~1 --name-status` 获取变更；无 diff 则扫描全部 `apps/` `tempermonkeyScript/`
- 读取 `tools.json` 已有 `url`/`downloadUrl`，对比找出未注册的文件

### 2. Web Tool (`apps/*/index.html`) 处理

**提取元信息：**
- **name**: `<title>` 标签 > 目录名（转 Title Case）
- **icon**: 关键词匹配 → 🔧 默认（语音🎙️、阅读📖、翻译🌐、图表📊、下载⬇️、图片🖼️、音乐🎵、笔记✏️、编辑💻、AI🤖、工具🛠️）
- **version**: `<meta name="version">` 或文件名 `v\d+\.\d+`
- **description**: `<meta description>` > i18n `page.description` > `<h1>+<p class="subtitle">` > ""

**注入门户导航栏**（缺 `id="portalNavbar"` 时��：
参考 `apps/article-reader/index.html` 的现有方案，在 `:root` 补充共享 CSS 变量（`--bg-secondary`, `--accent-light`, `--border-hover`, `--bg-card`）+ light/dark 适配 + 主题切换 inline script。导航链接用 `../../index.html`（两层穿透）。

### 3. 浏览器脚本 (`tempermonkeyScript/*.js`) 处理

- **name**: 去 `.js` 后缀 → Title Case
- **icon**: 导出📤、下载⬇️、登录🔑、评教✅、抓取🕷️、广告🚫、翻译🌐 → 🎬
- **category**: `"效率工具"`（固定，不要新增分类）
- **description**: `// @description` 注释 > 从文件名推断 > ""

### 4. 更新配置

- **tools.json**: 追加新条目，必填 `name/icon/type/category/description/status: "online"/updatedAt`，2-space indent
- **repo-tree.json**: 增量合并（web tool → `apps/children`，脚本 → `tempermonkeyScript/children`），有则跳过，新则追加

### 5. 清理 repo-tree.json

遍历所有 `path` 字段，校验磁盘文件是否存在，移除失效节点和空父目录。

> ⚠️ pre-commit hook 也做同样检查，但此处应主动清理避免残留。

### 6. 输出报告

格式：
```
sync-toolkit 完成!
新增: N 个（列详细路径）
清理: M 个 stale 条目
更新文件: tools.json, repo-tree.json, [可选 CLAUDE.md]
```

## 约束

- **不自动 commit** — 写入后请用户 review
- **description 优先提取** — 不空填，无法提取时才留空
- **分类只有「学习」和「效率工具」** — 不要创建新分类
- **repo-tree 清理注意路径前缀**: 用 `os.path.relpath()` 对比，只 `startswith('./')` 去前缀，不要 `normpath`/`lstrip` 吞掉隐藏目录
