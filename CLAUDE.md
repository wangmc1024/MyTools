# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a collection of personal productivity tools — standalone HTML apps and Tampermonkey browser scripts. There is no build system, package manager, or test framework. Everything runs directly in the browser.

## Project Structure
- **Portal downloads**: All file download links use Gitee raw URLs (`https://gitee.com/wangmc1024/MyTools/raw/main/...`). GitHub repo is mirrored at Gitee.


## Development Notes

- All HTML files are self-contained single files (HTML + CSS + JS inline). No external dependencies beyond CDN-loaded libraries.
- Tampermonkey scripts use standard Userscript metadata blocks (`// ==UserScript==`) and target specific domains via `@match`.
- The two HTML readers share a common visual design language (CSS custom properties in `:root`). Changes to shared styles should be reflected in both if needed.
- Git history shows iterative updates to these files; changes are typically direct edits to the HTML/JS source.
