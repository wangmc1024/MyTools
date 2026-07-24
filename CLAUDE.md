# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a collection of personal productivity tools — standalone HTML apps and Tampermonkey browser scripts. There is no build system, package manager, or test framework. Everything runs directly in the browser.

- **Portal downloads**: All file download links use Gitee raw URLs (`https://gitee.com/wangmc1024/MyTools/raw/main/...`). GitHub repo is mirrored at Gitee.

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Dashboard — category tabs, search, D3-powered animated SVG canvas |
| `downloads.html` | Download center — tool cards + repo directory tree (tab switcher) |
| `article-reader/index.html` | English/Chinese article reader with TTS, translation, word lookup |
| `reader-concrete/index.html` | Lighter-weight English learning reader |
| `assets/js/tools.js` | Shared utilities: theme toggle, toast, Gitee URL helpers, download handler |
| `assets/js/download.js` | Downloads page logic — loads tools.json + repo-tree.json |
| `assets/data/tools.json` | Tool registry — single source of truth for tool cards |
| `assets/data/repo-tree.json` | Repo directory tree for download center's explorer tab |

## Adding New Tools

### Web App
1. Create folder (e.g., `mytool/index.html`)
2. Sync theme toggle with portal via `window.toggleTheme()`
3. Register in `assets/data/tools.json` with `url` set, `downloadUrl: null`
4. Mirror structure in `assets/data/repo-tree.json`
5. Test: `python3 -m http.server 8080`, visit `http://localhost:8080/mytool/index.html`

### Tampermonkey Script
1. Add to `assets/data/tools.json`: set `downloadUrl` (Gitee raw URL), set `type`/`fileType`, `url: null`
2. Mirror in `assets/data/repo-tree.json`

### JSON Entry Fields
- Required: `name`, `icon` (emoji), `type`, `category`, `description`, `status` ("online"), `updatedAt` ("YYYY-MM-DD")
- Optional: `version`, `fileType`

## Development Notes

- All HTML files are self-contained (HTML + CSS + JS inline). No external deps beyond CDN libraries.
- Tampermonkey scripts use `// ==UserScript==` blocks with `@match` for target domains.
- Two HTML readers share CSS custom properties in `:root` for dark/light themes.
- Git history shows iterative direct edits; changes are typically straight to HTML/JS.
