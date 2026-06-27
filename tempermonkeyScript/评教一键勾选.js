// ==UserScript==
// @name         南工大评教 - 右上角按钮版（点我才勾选）
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  仅南工大评教页：右上角按钮，点击才一键全选完全赞同
// @author       助手
// @match        https://jwgl.njtech.edu.cn/xspjgl/xspj_cxXspjIndex.html*
// @match        https://jwgl.njtech.edu.cn/*xspj*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 页面加载后只创建按钮，不自动执行
    window.addEventListener('load', () => {
        setTimeout(createEvalButton, 1200);
    });

    // 监听动态内容，防止切换课程后按钮消失
    const observer = new MutationObserver(() => {
        setTimeout(createEvalButton, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 创建右上角按钮
    function createEvalButton() {
        // 防止重复创建
        if (document.getElementById('njtech-eval-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'njtech-eval-btn';
        btn.innerText = '一键评教';
        btn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            padding: 8px 16px;
            font-size: 14px;
            background: #1677ff;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        // 点击才执行勾选
        btn.addEventListener('click', () => {
            doAutoCheck();
        });

        document.body.appendChild(btn);
    }

    // 核心：执行勾选
    function doAutoCheck() {
        const items = document.querySelectorAll('input.radio-pjf[data-dyf="100"]');
        if (items.length === 0) {
            showToast('❌ 未找到评教选项，请刷新重试');
            return;
        }

        let count = 0;
        items.forEach(radio => {
            radio.checked = true;
            radio.dispatchEvent(new Event('click', { bubbles: true }));
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            count++;
        });

        showToast(`✅ 已勾选 ${count} 项【完全赞同】`);
    }

    // 非模态提示（3秒自动消失）
    function showToast(msg) {
        if (document.querySelector('.njtech-toast')) return;

        const toast = document.createElement('div');
        toast.className = 'njtech-toast';
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #00b42a;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 99999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

})();