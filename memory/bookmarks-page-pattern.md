---
name: bookmarks-page-pattern
description: 收藏夹页面实现模式 — JSON驱动卡片网格、自定义iconUrl方案、导航栏标准化
metadata:
  type: project
---

# 收藏夹页面 (bookmarks.html) 实现模式

## 页面结构
- `bookmarks.html` — 收藏夹页面，卡片网格展示收藏网站
- `bookmarks/bookmarks.json` — 数据源，新增条目只需编辑此 JSON

## 数据字段
每个条目字段：`name`, `icon`(emoji, 必填), `url`(必填), `category`, `description`, `iconUrl`(可选, 自定义图片链接), `addedAt`

## 图标方案
- **不依赖任何外部 favicon API**（避免跨域/网络问题）
- 优先使用 `iconUrl` 字段（用户直接提供图片链接）
- `iconUrl` 加载失败时回退到 `icon` emoji
- `.bm-icon` 容器：浅色圆角背景(`bg-secondary`) + border + overflow hidden，`img` 尺寸 26px

## 导航栏结构（标准化）
- 左侧：项目 Logo SVG + "Gizmo Galaxy" 名称（`index.html` 中的星球 SVG），点击跳转首页
- 右侧：`nav-links` 容器内放「返回首页」链接 + 主题切换按钮，并排右对齐
- 移动端：`navToggle` 汉堡按钮，链接收纳到下拉菜单
- 与 `index.html` / `downloads.html` / `devlog/index.html` 结构一致

## 功能特性
- 分类标签筛选（自动从 JSON 提取 category）
- 实时搜索（匹配 name / description / url）
- 响应式网格布局（`auto-fill, minmax(300px, 1fr)`，移动端单列）
- 复用项目 Design Tokens (`tokens.css`) + `portal-nav.css`

## 为什么不用 Favicon API
- Google Favicon API 在国内不稳定
- 其他第三方 API（favicon.im, ico.scdn.io 等）存在 CORS 或可用性问题
- 方案改为让用户在 JSON 中提供 `iconUrl`，最可靠

## 相关记忆
- [[Design Tokens Implementation]] — tokens.css 令牌体系
- [[DevLog Timeline System]] — 开发日志条目格式
