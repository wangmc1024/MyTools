# CLAUDE.md

## 项目概述

个人生产力工具集 — 纯浏览器运行，无需构建工具。

- **下载源**: Gitee raw (`https://gitee.com/wangmc1024/MyTools/raw/main/...`)
- **GitHub 镜像**: 自动同步到 Gitee

## 项目结构

```
MyTools/
├── index.html              # 门户 - Canvas 星图 + 标签筛选
├── downloads.html          # 下载中心
├── apps/                   # Web 应用文件夹 (各含 index.html)
├── tempermonkeyScript/     # Tampermonkey 浏览器脚本 (.js)
└── assets/
    ├── js/tools.js         # 共享工具（主题、下载、Toast）
    ├── js/download.js      # downloads.html 逻辑
    ├── data/tools.json     # 【核心】工具注册表（单一事实源）
    └── data/repo-tree.json # 下载中心目录树
```

## 添加新工具

### Web 应用
1. 在 `apps/` 创建文件夹 `mytool/index.html`
2. 导航栏返回首页链接用 `../../index.html`（两层穿透：app → apps → root）
3. 导航栏需补充共享 CSS 变量：`--bg-secondary`、`--accent-light`、`--border-hover`、`--bg-card`
4. 引入主题同步代码（参考现有应用的 inline 方案）
5. 在 `assets/data/tools.json` 注册（设置 `url: "./apps/mytool/index.html"`，`downloadUrl: null`）
6. 在 `assets/data/repo-tree.json` 中 `apps` 目录下追加目录节点

### Tampermonkey 脚本
1. 放入 `tempermonkeyScript/`
2. 在 `assets/data/tools.json` 注册（设置 `downloadUrl`，`url: null`）
3. 在 `repo-tree.json` 的 `tempermonkeyScript` 节点下追加文件

### JSON 字段
- **必填**: `name`, `icon` (emoji), `type`, `category`, `description`, `status` ("online"), `updatedAt` ("YYYY-MM-DD")
- **可选**: `version`, `fileType`

**注意**: `type`/`category` 自动生成分页标签 — 无需手动改 HTML！

### repo-tree.json 维护规则
- **新增**文件时追加对应节点（含 `path` 字段）
- **删除**文件后必须同步清理失效条目
- 子目录为空时移除整层节点
- 使用 `sync-toolkit` skill 可自动完成同步与清理
- 预提交 hook (`.git-hooks/pre-commit.sh` → `.git/hooks/pre-commit`) 会在每次 commit 前自动检测并清理 stale 条目，无需手动干预

## downloads.html 仓库目录交互规则

- 点击文件行（非"下载"按钮） → 弹出预览面板，以浅色背景展示文件源码（`white-space: pre-wrap` 自动换行）
- 预览面板工具栏显示文件路径 + "复制"按钮（支持 clipboard API + `execCommand` fallback），复制成功后按钮闪烁绿色反馈（1.5s 后恢复）
- 点击右侧"下载"按钮 → 直接触发 `handleDownload()` 下载流程
- 关闭预览：点击 ✕ / 遮罩层 / 按 Esc
- 文件内容加载优先级：本地 fetch → Gitee raw URL → Cloudflare worker 代理

## Skills

### `/sync-toolkit`
扫描未注册的工具文件 → 自动更新 `tools.json`、`repo-tree.json`，注入门户导航栏并清理 stale 条目。

### `/git-sync`
自动执行 `git add/commit/push` 流程，含提交信息自动生成。
