/**
 * websearch.js — Zhipu glm-4.7-flash web_search capability wrapper.
 * max_tokens >= 4096 always (avoids the reasoning-content empty-answer trap).
 * Defensive parsing: the exact field where search results are injected was
 * masked during planning probes, so we cover several shapes + a content fallback.
 */

import { chatCompletion } from './api.js';

/**
 * Run a web search query. Returns { text, refs, reasoning }.
 * refs: [{ title, url, snippet }]
 */
export async function search({ query, signal } = {}) {
  if (!query) throw new Error('空查询');
  const tools = [{ type: 'web_search', web_search: { enable: true, search_result: true } }];
  const messages = [{ role: 'user', content: query }];

  const r = await chatCompletion({
    provider: 'zhipu',
    model: 'glm-4.7-flash',
    messages,
    tools,
    max_tokens: 8192,
    temperature: 0.3,
    signal,
  });

  // Reasoning-content trap: content empty, reasoning present -> retry larger.
  let content = r.content;
  if (!content && r.reasoning_content) {
    const r2 = await chatCompletion({
      provider: 'zhipu', model: 'glm-4.7-flash', messages, tools,
      max_tokens: 16384, temperature: 0.3, signal,
    });
    content = r2.content || r2.reasoning_content;
  }

  // Defensive extraction of structured search results.
  const refs = extractRefs(r.raw);

  // If content is still empty but refs exist, compose a summary from refs.
  if (!content && refs.length) {
    content = '根据联网搜索结果：\n\n' + refs.map((x, i) =>
      `${i + 1}. [${x.title}](${x.url})${x.snippet ? ' — ' + x.snippet : ''}`).join('\n');
  }
  if (!content) content = '（搜索未返回内容，请稍后重试）';

  return { text: content, refs, reasoning: r.reasoning_content || '' };
}

/** Pull structured refs from a Zhipu web_search response across known shapes. */
function extractRefs(raw) {
  if (!raw) return [];
  const out = [];

  // Shape 1: message.web_search array
  const pick = (obj) => {
    const msg = obj?.choices?.[0]?.message;
    if (msg?.web_search && Array.isArray(msg.web_search)) return msg.web_search;
    return null;
  };
  let arr = pick(raw);

  // Shape 2: top-level web_search
  if (!arr && Array.isArray(raw.web_search)) arr = raw.web_search;

  // Shape 3: tool_calls output with web_search
  if (!arr && Array.isArray(raw.tool_calls)) {
    const ws = raw.tool_calls.find(t => t?.function?.name === 'web_search');
    if (ws?.function) {
      try { arr = JSON.parse(ws.function.arguments)?.results; } catch {}
    }
  }

  if (arr) {
    for (const it of arr) {
      if (!it) continue;
      out.push({
        title: it.title || it.name || '',
        url: it.url || it.link || it.href || '',
        snippet: it.snippet || it.content || it.summary || '',
      });
    }
  }
  return out.filter(r => r.url || r.title);
}
