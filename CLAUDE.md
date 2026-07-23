# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a collection of personal productivity tools — standalone HTML apps and Tampermonkey browser scripts. There is no build system, package manager, or test framework. Everything runs directly in the browser.

## Project Structure

- **`ArticleReader.html`** — Single-file article reader app with dark theme, styled cards, and responsive layout. Chinese-language content reader.
- **`reader_concrete.html`** — "English Learning Reader" — single-file interactive article reader for English learning, same design system as ArticleReader.html (shared CSS variables, card styles, responsive patterns).
- **`tempermonkeyScript/`** — Tampermonkey userscripts (download links via Gitee raw):
  - `DeepSeek问答一键导出md.js` — Exports DeepSeek chat conversations to Markdown. Strips code-block toolbars, extracts KaTeX/MathJax formulas, supports clipboard copy and file download.
  - `评教一键勾选.js` — Nanjing Tech University course evaluation auto-checker. Creates a floating button that selects "strongly agree" for all evaluation items on the university's teaching evaluation page.
- **Portal downloads**: All file download links use Gitee raw URLs (`https://gitee.com/wangmc1024/MyTools/raw/main/...`). GitHub repo is mirrored at Gitee.
- **`mermaid/demo.txt`** — Mermaid flowchart diagram definition with a comprehensive color-coded class style library for business/tech diagrams. Not executable; reference material.

## Development Notes

- All HTML files are self-contained single files (HTML + CSS + JS inline). No external dependencies beyond CDN-loaded libraries.
- Tampermonkey scripts use standard Userscript metadata blocks (`// ==UserScript==`) and target specific domains via `@match`.
- The two HTML readers share a common visual design language (CSS custom properties in `:root`). Changes to shared styles should be reflected in both if needed.
- Git history shows iterative updates to these files; changes are typically direct edits to the HTML/JS source.
