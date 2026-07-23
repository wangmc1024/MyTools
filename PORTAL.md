# MyTools Portal — Cloudflare Pages 部署指南

## 部署步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 选择 `wangmc1024/MyTools` 仓库
3. 配置构建设置：

| 设置 | 值 |
|---|---|
| Framework | None |
| Build Command | (留空) |
| Output Directory | `/` |
| Root Directory | `/` |

4. 点击 **Save and Deploy**

部署完成后，网站会在 `https://your-site.pages.dev/` 可用。

## 网站功能

- **首页 (index.html)** — 工具仪表盘，支持搜索和分类筛选
- **工具面板** — 点击"打开工具"进入包装页面（带统一导航栏）
- **下载面板** — 列出所有可下载的脚本资源，下载链接指向 Gitee raw
- **GitHub 镜像** — 项目同时托管在 GitHub 和 Gitee（gitee.com/wangmc1024/MyTools），下载链接使用 Gitee raw 加速

## 目录结构

```
/
├── index.html                  # 首页导航（工具 + 下载 两个面板）
├── ArticleReader.html          # 原始文章阅读器
├── reader_concrete.html        # 原始英语学习器
├── article-reader/index.html   # Article Reader 包装版（含统一导航栏）
├── reader-concrete/index.html  # English Learning Reader 包装版（含统一导航栏）
├── assets/
│   ├── css/style.css           # 共享设计系统
│   ├── js/app.js               # Dashboard 逻辑
│   ├── js/tools.js             # 工具函数
│   └── data/tools.json         # 工具配置（增删改这里即可）
├── tempermonkeyScript/         # Tampermonkey 脚本
├── mermaid/                    # Mermaid 参考图
└── PORTAL.md                   # 本文件
```

## 添加新工具

只需编辑 `assets/data/tools.json`，每个条目包含：

- `name` — 名称
- `icon` — emoji 图标
- `type` — 类型标签
- `category` — 分类（与首页筛选器匹配）
- `description` — 描述
- `url` — 可选，指向包装页面（如 `./article-reader/index.html`）
- `downloadUrl` — 可选，Gitee raw URL 指向脚本资源
- `version` / `updatedAt` — 可选，用于下载页展示

## 本地测试

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080/`
