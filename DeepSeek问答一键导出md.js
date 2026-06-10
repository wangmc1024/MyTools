// ==UserScript==
// @name         DeepSeek 问答一键导出MD（代码块终极净化）
// @namespace    http://tampermonkey.net/
// @version      6.6
// @description  代码块彻底剔除“复制/下载”等杂质，语言与反引号严密同行
// @author       最终修复
// @match        https://chat.deepseek.com/*
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const AI_MARKDOWN_SELECTOR = 'div.ds-markdown';
    const THINKING_SELECTOR = '[class*="thinking"], [class*="thought"], .e1675d8b';
    const DEBUG = true;
    function debugLog(...args) { if (DEBUG) console.log('[DeepSeek导出]', ...args); }

    function showToast(msg, duration = 3000) {
        const old = document.getElementById('deepseek-export-toast');
        if (old) old.remove();
        const toast = document.createElement('div');
        toast.id = 'deepseek-export-toast';
        toast.style.cssText = `
            position:fixed;top:20px;right:20px;z-index:9999999;padding:12px 24px;
            background:rgba(0,0,0,0.85);color:#fff;border-radius:8px;font-size:14px;
            font-weight:500;box-shadow:0 4px 15px rgba(0,0,0,0.2);opacity:0;
            transition:opacity .3s;pointer-events:none;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '1', 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function decodeEntities(str) {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }

    // ---------- 公式识别（保持不变） ----------
    function isFormulaElement(el) {
        if (el.classList && (el.classList.contains('katex') || el.classList.contains('katex-display'))) return true;
        if (el.tagName && el.tagName.toLowerCase() === 'mjx-container') return true;
        if (el.hasAttribute && (
            el.hasAttribute('data-tex') || el.hasAttribute('data-latex') ||
            el.hasAttribute('data-mjx-tex') || el.hasAttribute('data-formula'))) return true;
        if (el.tagName && el.tagName.toLowerCase() === 'script' && el.type && /math\/tex/.test(el.type)) return true;
        return false;
    }

    function extractFormula(el) {
        let tex = '';
        if (el.hasAttribute) {
            tex = el.getAttribute('data-tex') || el.getAttribute('data-latex') ||
                  el.getAttribute('data-mjx-tex') || el.getAttribute('data-formula') || '';
        }
        if (!tex && el.querySelector) {
            const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) tex = annotation.textContent;
        }
        if (!tex && el.querySelector) {
            const script = el.querySelector('script[type="math/tex"]') ||
                           el.querySelector('script[type="math/tex; mode=display"]');
            if (script) tex = script.textContent;
        }
        if (!tex && el.tagName && el.tagName.toLowerCase() === 'mjx-container') {
            if (el.hasAttribute('data-tex')) tex = el.getAttribute('data-tex');
            else if (el.querySelector) {
                const s = el.querySelector('script[type="math/tex"]');
                if (s) tex = s.textContent;
            }
        }
        if (!tex && el.tagName && el.tagName.toLowerCase() === 'script' && /math\/tex/.test(el.type || '')) {
            tex = el.textContent;
        }
        if (!tex) return null;
        tex = decodeEntities(tex).trim();

        let display = false;
        if (el.classList && el.classList.contains('katex-display')) display = true;
        else if (el.parentElement && el.parentElement.classList && el.parentElement.classList.contains('katex-display')) display = true;
        else if (el.tagName && el.tagName.toLowerCase() === 'mjx-container' && el.getAttribute('display') === 'true') display = true;
        else if (el.tagName && el.tagName.toLowerCase() === 'div' && (el.hasAttribute('data-tex') || el.hasAttribute('data-latex'))) display = true;
        else if (el.type && /mode=display/.test(el.type)) display = true;

        return display ? `\n$$\n${tex}\n$$\n` : `$${tex}$`;
    }

    // ---------- ★ 代码块终极净化 ★ ----------
    function extractCode(preEl) {
        const codeEl = preEl.querySelector('code');
        let rawCode = '';

        if (codeEl) {
            // 克隆代码节点，彻底移除所有工具栏（按钮、复制、下载等）
            const clone = codeEl.cloneNode(true);
            // 清除所有可能的按钮：button、role="button"、包含 copy/download/toolbar/action 类名的元素
            const junkSelectors = 'button, [role="button"], [class*="copy"], [class*="download"], [class*="toolbar"], [class*="action"]';
            clone.querySelectorAll(junkSelectors).forEach(el => el.remove());
            rawCode = clone.textContent;
        } else {
            // 后备：如果没有 code 元素，取 pre 的文本
            rawCode = preEl.textContent;
        }

        // 文本层面二次清理（去除残留的“复制”“下载”等词，仅开头部分）
        rawCode = rawCode.replace(/^(复制代码?|下载|copy|download)\s*/i, '').trim();

        // 提取语言
        let lang = '';
        if (codeEl) {
            const m = codeEl.className.match(/language-(\S+)/i);
            if (m) lang = m[1];
        }

        return { code: rawCode, lang };
    }

    // ---------- 递归转换核心 ----------
    function htmlToMarkdown(html) {
        if (!html) return '';
        const template = document.createElement('template');
        template.innerHTML = html;
        const container = template.content;

        function processNodes(nodes, indent = 0, inBlockquote = false) {
            let out = '';
            for (const node of nodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    out += node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    out += processElement(node, indent, inBlockquote);
                }
            }
            return out;
        }

        function processElement(el, indent, inBlockquote) {
            if (isFormulaElement(el)) {
                const f = extractFormula(el);
                if (f) return f;
            }

            const tag = el.tagName.toLowerCase();
            const children = el.childNodes;

            switch (tag) {
                case 'br': return '\n';
                case 'hr': return '\n---\n';
                case 'p':
                    return processNodes(children, indent, inBlockquote) + '\n\n';
                case 'div':
                    return processNodes(children, indent, inBlockquote) + '\n';
                case 'span':
                    return processNodes(children, indent, inBlockquote);
                case 'a': {
                    const href = el.getAttribute('href') || '';
                    const text = processNodes(children, indent, inBlockquote);
                    return `[${text}](${href})`;
                }
                case 'strong': case 'b':
                    return `**${processNodes(children, indent, inBlockquote)}**`;
                case 'em': case 'i':
                    return `*${processNodes(children, indent, inBlockquote)}*`;
                case 'del':
                    return `~~${processNodes(children, indent, inBlockquote)}~~`;
                case 'u':
                    return `<u>${processNodes(children, indent, inBlockquote)}</u>`;
                case 'code':
                    if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
                        return el.textContent; // 交给 pre 统一处理
                    }
                    return `\`${el.textContent}\``;
                case 'pre': {
                    const { code, lang } = extractCode(el);
                    // 语言与反引号严格同行，无多余空格
                    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
                }
                case 'blockquote': {
                    const content = processNodes(children, indent, true);
                    const lines = content.split('\n');
                    return '\n' + lines.map(line => '> ' + line).join('\n') + '\n';
                }
                case 'h1': return `# ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'h2': return `## ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'h3': return `### ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'h4': return `#### ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'h5': return `##### ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'h6': return `###### ${processNodes(children, indent, inBlockquote)}\n\n`;
                case 'ul':
                    return '\n' + processListItems(children, indent, false) + '\n';
                case 'ol':
                    return '\n' + processListItems(children, indent, true) + '\n';
                case 'li':
                    return processNodes(children, indent, inBlockquote);
                case 'table':
                    return processTable(el) + '\n';
                case 'img': {
                    const alt = el.getAttribute('alt') || '';
                    const src = el.getAttribute('src') || '';
                    return `![${alt}](${src})`;
                }
                default:
                    return processNodes(children, indent, inBlockquote);
            }
        }

        function processListItems(children, indent, ordered) {
            let md = '';
            let counter = 1;
            for (const node of children) {
                if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'li') {
                    const prefix = ordered ? `${counter}. ` : '- ';
                    const content = processNodes(node.childNodes, indent + 1, false).trim();
                    const indentedContent = content.replace(/\n/g, '\n  ' + ' '.repeat(prefix.length));
                    md += `${'  '.repeat(indent)}${prefix}${indentedContent}\n`;
                    counter++;
                }
            }
            return md;
        }

        function processTable(tableEl) {
            const rows = tableEl.querySelectorAll('tr');
            if (rows.length === 0) return '';

            function cellToMd(cell) {
                let cellMd = '';
                for (const child of cell.childNodes) {
                    cellMd += processElement(child, 0, false);
                }
                cellMd = cellMd.trim().replace(/\|/g, '\\|');
                return cellMd;
            }

            let mdTable = '';
            const firstRowCells = rows[0].querySelectorAll('th, td');
            const headers = Array.from(firstRowCells).map(cell => cellToMd(cell));

            if (headers.length > 0) {
                const hasTh = Array.from(firstRowCells).some(c => c.tagName.toLowerCase() === 'th');
                if (hasTh) {
                    mdTable += '| ' + headers.join(' | ') + ' |\n';
                    mdTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
                    for (let i = 1; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td, th');
                        const cellMds = Array.from(cells).map(cell => cellToMd(cell));
                        mdTable += '| ' + cellMds.join(' | ') + ' |\n';
                    }
                } else {
                    for (const row of rows) {
                        const cells = row.querySelectorAll('td, th');
                        const cellMds = Array.from(cells).map(cell => cellToMd(cell));
                        mdTable += '| ' + cellMds.join(' | ') + ' |\n';
                    }
                }
            } else {
                for (const row of rows) {
                    const cells = row.querySelectorAll('td, th');
                    const cellMds = Array.from(cells).map(cell => cellToMd(cell));
                    mdTable += '| ' + cellMds.join(' | ') + ' |\n';
                }
            }
            return mdTable;
        }

        let result = processNodes(container.childNodes).trim();
        result = result.replace(/\n{3,}/g, '\n\n');
        return result;
    }

    function getAllChatMd() {
        debugLog('开始抓取对话…');
        const aiAnswers = Array.from(document.querySelectorAll(AI_MARKDOWN_SELECTOR))
            .filter(ai => !ai.closest(THINKING_SELECTOR));
        debugLog(`找到 ${aiAnswers.length} 个有效AI回答`);

        if (aiAnswers.length === 0) return '';

        let md = '';
        aiAnswers.forEach((aiAnswer, idx) => {
            let userQuestion = '';
            let current = aiAnswer;
            for (let i = 0; i < 10; i++) {
                current = current.parentElement;
                if (!current) break;
                const prev = current.previousElementSibling;
                if (prev && !prev.querySelector(AI_MARKDOWN_SELECTOR)) {
                    const txt = prev.innerText.trim();
                    if (txt && txt.length > 2 && !txt.includes('复制') && !txt.includes('重新生成')) {
                        userQuestion = txt;
                        break;
                    }
                }
            }
            if (userQuestion) {
                md += `### 问题\n${userQuestion}\n\n`;
            }
            const aiMd = htmlToMarkdown(aiAnswer.innerHTML);
            if (aiMd) {
                md += `**回答：**\n${aiMd}\n\n---\n\n`;
                debugLog(`第 ${idx+1} 轮完成`);
            }
        });
        return md.trim();
    }

    function copyChatMd() {
        const res = getAllChatMd();
        if (!res) { showToast('❌ 未抓取到内容'); return; }
        GM_setClipboard(res);
        showToast(`✅ 复制成功！共 ${res.split('---').length - 1} 轮对话`);
    }

    function downChatMd() {
        const res = getAllChatMd();
        if (!res) { showToast('❌ 未抓取到内容'); return; }
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const filename = `DeepSeek对话_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.md`;
        const blob = new Blob(['\ufeff' + res], { type: 'text/markdown; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast(`✅ 下载成功！共 ${res.split('---').length - 1} 轮对话`);
    }

    function createButtons() {
        if (document.getElementById('deepseek-export-buttons')) return;
        const wrap = document.createElement('div');
        wrap.id = 'deepseek-export-buttons';
        wrap.style.cssText = `
            position:fixed;bottom:20px;right:20px;z-index:999999;display:flex;
            flex-direction:column;gap:8px;background:rgba(255,255,255,0.98);
            padding:12px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);
            backdrop-filter:blur(10px);
        `;
        const btnCopy = document.createElement('button');
        btnCopy.textContent = '📋 复制MD';
        Object.assign(btnCopy.style, {
            padding:'10px 18px', background:'#007bff', color:'#fff', border:'none',
            borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:500,
            transition:'background 0.2s'
        });
        btnCopy.onmouseenter = () => btnCopy.style.background = '#0056b3';
        btnCopy.onmouseleave = () => btnCopy.style.background = '#007bff';
        btnCopy.onclick = copyChatMd;

        const btnDown = document.createElement('button');
        btnDown.textContent = '💾 下载MD';
        Object.assign(btnDown.style, {
            padding:'10px 18px', background:'#28a745', color:'#fff', border:'none',
            borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:500,
            transition:'background 0.2s'
        });
        btnDown.onmouseenter = () => btnDown.style.background = '#218838';
        btnDown.onmouseleave = () => btnDown.style.background = '#28a745';
        btnDown.onclick = downChatMd;

        wrap.append(btnCopy, btnDown);
        document.body.appendChild(wrap);
        debugLog('按钮已创建');
    }

    function init() {
        setTimeout(createButtons, 1000);
    }
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
        }
    }, 500);

    init();
})();