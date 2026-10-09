// ==UserScript==
// @name         南工大教务 学业情况导出CSV【调试版】
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  解析 ul.treeview 学业树 → CSV；非模态弹窗预览+下载，增加控制台调试
// @author       You
// @match        https://jwgl.njtech.edu.cn/xsxy/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("[学分导出脚本] 脚本加载完成 ✅");

    // ---------- 数据提取：遍历 ul.treeview 树 ----------
    function extractTree() {
        console.log("[提取] 开始执行extractTree");
        const root = document.querySelector('ul.treeview');
        if (!root) {
            console.error("[提取失败] 找不到 ul.treeview 元素！");
            return [];
        }
        console.log("[提取] 成功找到ul.treeview", root);
        const rows = [];

        function walk(items, level, parentName) {
            Array.from(items).forEach(li => {
                const p = li.querySelector(':scope > div.title > p.title1');
                if (!p) return;
                let name = (p.childNodes[0]?.textContent || p.innerText || '').trim();
                name = name.split(/\s*要求学分/)[0].split(/\r?\n/)[0].trim();

                const req = p.getAttribute('yqzdxf');
                const got = p.getAttribute('yxxf');
                const pass = p.getAttribute('sftg');
                const reqNum = parseFloat(req) || 0;
                const gotNum = parseFloat(got) || 0;
                const lack = (req && got) ? (reqNum - gotNum).toFixed(1) : '';

                let rel = '';
                const zt = p.querySelector('span.zt1');
                if(zt) rel = zt.textContent.trim();

                let total = '', passed = '';
                const zms = p.querySelector('font[name="zms"]');
                const yxmc = p.querySelector('font[name="yxmc"]');
                if (zms) total = zms.textContent.trim();
                if (yxmc) passed = yxmc.textContent.trim();

                rows.push({
                    level: level,
                    parent: parentName,
                    name: name,
                    rel: rel,
                    requireCredit: req || '',
                    gotCredit: got || '',
                    lackCredit: lack,
                    status: pass === '1' ? '已达标' : (pass === '0' ? '未达标' : ''),
                    totalCourses: total,
                    passedCourses: passed
                });

                const subUl = li.querySelector(':scope > ul');
                if (subUl) walk(subUl.children, level + 1, name);
            });
        }

        const topLis = root.children;
        walk(topLis, 1, '');
        console.log(`[提取] 共抓取到 ${rows.length} 条数据`, rows);
        return rows;
    }

    // ---------- 转CSV ----------
    function toCSV(arr) {
        const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const header = ['层级', '父模块', '模块名称', '关系', '要求学分', '已获学分', '未获学分', '状态', '共几门', '通过几门'];
        const lines = [header.map(esc).join(',')];
        arr.forEach(r => {
            lines.push([r.level, r.parent, r.name, r.rel, r.requireCredit, r.gotCredit, r.lackCredit, r.status, r.totalCourses, r.passedCourses].map(esc).join(','));
        });
        return '\ufeff' + lines.join('\n');
    }

    // ---------- 非模态弹窗 ----------
    function showModal(csvStr, rows) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:60px;right:20px;width:560px;height:520px;background:#fff;border:2px solid #409eff;border-radius:8px;z-index:999999;display:flex;flex-direction:column;box-shadow:0 3px 14px rgba(0,0,0,.2);';
        const bar = document.createElement('div');
        bar.style.cssText = 'padding:10px 14px;background:#409eff;color:#fff;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;';
        bar.innerHTML = `<span>学业数据预览（非模态，可拖拽，共 ${rows.length} 行）</span>`;
        const close = document.createElement('button');
        close.textContent = '关闭';
        close.style.cssText = 'border:none;background:#fff;color:#409eff;padding:2px 10px;border-radius:4px;cursor:pointer';
        close.onclick = () => wrap.remove();
        bar.appendChild(close);

        const ta = document.createElement('textarea');
        ta.style.cssText = 'flex:1;margin:10px;resize:none;white-space:pre;font-family:Consolas,monospace;font-size:12px;';
        ta.value = rows.map((r)=>
            `${r.level}级${r.rel?'·'+r.rel:''} | ${r.name} | 要求${r.requireCredit||'-'} | 已获${r.gotCredit||'-'} | 未获${r.lackCredit||'-'} | ${r.status}`
        ).join('\n');

        const dl = document.createElement('button');
        dl.textContent = '下载CSV文件';
        dl.style.cssText = 'margin:0 10px 10px;padding:7px;border:none;background:#409eff;color:#fff;border-radius:4px;cursor:pointer;font-size:14px';
        dl.onclick = () => {
            const blob = new Blob([csvStr], {type:'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '南工大学业学分_' + new Date().toISOString().slice(0,10) + '.csv';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        };

        wrap.appendChild(bar); wrap.appendChild(ta); wrap.appendChild(dl);
        document.body.appendChild(wrap);

        //拖拽
        let dragging=false, sx, sy, ox, oy;
        bar.onmousedown = e => {
            dragging=true;
            sx=e.clientX; sy=e.clientY;
            ox=wrap.offsetLeft; oy=wrap.offsetTop;
            document.onmousemove = ev=>{
                if(!dragging)return;
                wrap.style.left=(ox+ev.clientX-sx)+'px';
                wrap.style.top=(oy+ev.clientY-sy)+'px';
                wrap.style.right='auto';
            };
            document.onmouseup=()=>{dragging=false;document.onmousemove=null;};
        };
    }

    // ---------- 注入按钮 ----------
    function addBtn() {
        if (document.querySelector('#njtech-export-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'njtech-export-btn';
        btn.textContent = '导出学业学分CSV';
        btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999998;padding:7px 14px;background:#409eff;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15);';
        btn.onclick = () => {
            try{
                console.log("[按钮点击事件触发]");
                const rows = extractTree();
                if (!rows.length) {
                    alert('未解析到数据，请检查页面是否加载完成，是否展开学业树！');
                    return;
                }
                const csv = toCSV(rows);
                showModal(csv, rows);
            }catch(err){
                console.error("[按钮执行报错]",err);
                alert(`脚本执行异常：${err.message}`);
            }
        };
        document.body.appendChild(btn);
        console.log("[按钮注入成功 ✅]");
    }

    // 持续检测页面，等待body加载后注入按钮
    const t = setInterval(() => {
        if (document.body) {
            addBtn();
            clearInterval(t);
        }
    }, 500);

})();
