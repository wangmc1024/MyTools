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
├── apps/                   # Web 应用文件夹
├── tempermonkeyScript/     # 浏览器脚本
└── assets/
    ├── js/tools.js         # 共享工具（主题、下载、Toast）
    ├── js/download.js      # downloads.html 逻辑
    ├── data/tools.json     # 【核心】工具注册表（单一事实源）
    └── data/repo-tree.json # 下载中心目录树
```

## 添加新工具

### Web 应用
1. 在 `apps/` 创建文件夹 `mytool/index.html`
2. 引入主题同步（路径调整为 `../../assets/js/tools.js`）
3. 在 `assets/data/tools.json` 注册（设置 `url: "./apps/mytool/index.html"`，`downloadUrl: null`）
4. 在 `assets/data/repo-tree.json` 镜像路径
5. 测试: `python3 -m http.server 8080`

### Tampermonkey 脚本
1. 放入 `tempermonkeyScript/`
2. 在 `assets/data/tools.json` 注册（设置 `downloadUrl`，`url: null`）
3. 更新 `repo-tree.json`

### JSON 字段
- **必填**: `name`, `icon` (emoji), `type`, `category`, `description`, `status` ("online"), `updatedAt` ("YYYY-MM-DD")
- **可选**: `version`, `fileType`

**注意**: `type`/`category` 自动生成分页标签 — 无需手动改 HTML！
