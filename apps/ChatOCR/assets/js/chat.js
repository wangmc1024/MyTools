/**
 * chat.js — Conversation state machine + OCR-content carry-through.
 * send(userText): attach pendingImage -> router.route -> router.dispatch -> render.
 * OCR carry-through: when a dispatch returns kind:'ocr', its text is stored in
 * state.ocrContext and injected into subsequent chat_about_content dispatches.
 */

import { route, targetModelFor } from './router.js';
import { recognize, recognizePdf } from './ocr.js';
import { search } from './websearch.js';
import { generateImageResult, generateVideoResult } from './media.js';
import { chatCompletion } from './api.js';
import { ROUTER_MODEL, getPrefs, DEFAULTS } from './config.js';
import { appendMessage, appendThinking, ribbon, toast, typewriter } from './ui-wrapper.js';

const state = {
  messages: [],       // {role, content, kind?, ts}
  ocrContext: null,   // last OCR'd text, carried into follow-up Q&A
  pendingImage: null, // { mimeType, base64, dataUrl, name }
  isBusy: false,
  abort: null,        // AbortController for current turn
};

export function getState() { return state; }

export function setPendingImage(img) { state.pendingImage = img; }
export function clearPendingImage() { state.pendingImage = null; }

export function setRibbon(r) { ribbon.current = r; }

export function clear() {
  if (state.abort) state.abort.abort();
  state.messages = [];
  state.ocrContext = null;
  state.pendingImage = null;
  state.isBusy = false;
}

/** Export conversation as md/txt/html. */
export function exportConversation(format) {
  let md = '';
  for (const m of state.messages) {
    const who = m.role === 'user' ? '**我**' : '**ChatOCR**';
    const text = typeof m.content === 'string' ? m.content : '[多模态内容]';
    md += `### ${who}\n\n${text}\n\n---\n\n`;
  }
  if (format === 'txt') {
    return md.replace(/[#*`_>]/g, '').replace(/\n{3,}/g, '\n\n');
  }
  if (format === 'html') {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ChatOCR 对话</title>
<style>body{max-width:780px;margin:40px auto;padding:0 20px;font-family:system-ui,sans-serif;line-height:1.7}hr{border:none;border-top:1px solid #ddd}</style>
</head><body>${md.replace(/^### \*\*(.+?)\*\*\n\n/gm, '<h3>$1</h3>').replace(/\n\n---\n\n/g, '<hr>')}</body></html>`;
  }
  return md;
}

/**
 * The main composer entry.
 * @param {string} userText
 * @param {object} ctx { container }
 */
export async function send(userText, { container } = {}) {
  if (state.isBusy) return;
  const text = (userText || '').trim();
  const hasImage = !!state.pendingImage;

  // nothing to send
  if (!text && !hasImage) return;

  state.isBusy = true;
  state.abort = new AbortController();
  const signal = state.abort.signal;

  // Build user content for history.
  const userContent = [];
  let attachmentUrl = null;
  if (state.pendingImage) {
    userContent.push({
      type: 'image_url',
      image_url: { url: state.pendingImage.dataUrl, detail: 'high' },
    });
    attachmentUrl = state.pendingImage.dataUrl;
  }
  if (text) userContent.push({ type: 'text', text });

  state.messages.push({ role: 'user', content: userContent, ts: Date.now() });

  // Render user message.
  appendMessage(container, 'user', { kind: 'text', text: text || '[图片]', attachmentUrl });

  // Clear pending image after sending (OCR path keeps text in ocrContext).
  const sentImage = state.pendingImage;
  state.pendingImage = null;

  // Thinking placeholder + ribbon.
  ribbon.current?.idle?.();
  const think = appendThinking(container, 'ai');

  try {
    // 1. Route.
    if (!text && hasImage) {
      ribbon.current?.route?.('ocr_recognize', targetModelFor('ocr_recognize'));
    } else {
      ribbon.current?.thinking?.();
    }

    const decision = await route({ userText: text, hasImage, hasOcrContext: !!state.ocrContext,
      ocrContext: state.ocrContext, history: state.messages, signal });

    // (fast-path decisions don't go through 'thinking' — set ribbon now)
    ribbon.current?.route?.(decision.tool, decision.targetModel);

    // 2. Dispatch.
    const renderable = await dispatch(decision, { sentImage, signal, container, think });

    // 3. Update OCR carry-through.
    if (renderable.kind === 'ocr' && renderable.text) {
      state.ocrContext = renderable.text;
    }

    // 4. Record assistant message.
    state.messages.push({ role: 'assistant', content: renderable.text || '', kind: renderable.kind, ts: Date.now() });

    // 5. Render (replace thinking bubble).
    think.row.remove();
    appendMessage(container, 'ai', renderable, { onUseForFollowUp: true });
    ribbon.current?.done?.(decision.tool, decision.targetModel, decision.fromFastPath ? '快路径' : '');

    // typewriter for text-ish results
    if ((renderable.kind === 'text' || renderable.kind === 'ocr' || renderable.kind === 'web') && renderable.text) {
      // already rendered statically; typewriter optional — keep static for reliability
    }

  } catch (e) {
    if (e.name === 'AbortError') {
      think.row.remove();
      ribbon.current?.error?.('已取消');
    } else {
      think.row.remove();
      const msg = e.message || '出错了';
      appendMessage(container, 'ai', { kind: 'text', text: `❌ ${msg}` });
      ribbon.current?.error?.(e.code === 'VIDEO_TIMEOUT' ? '视频生成超时' : '失败');
      if (e.code === 'VIDEO_TIMEOUT') toast('视频仍在生成，任务 ID 已保存', 'info');
    }
    // pop the failed user message so retry is clean
    if (state.messages.length && state.messages[state.messages.length - 1].role === 'user') {
      // keep user message — user may want to re-send? We keep it but allow next send.
    }
  } finally {
    state.isBusy = false;
    state.abort = null;
  }
}

/**
 * Dispatch a route decision to the matching capability module.
 * @returns {Promise<Renderable>}
 */
async function dispatch(decision, ctx) {
  const { tool, args } = decision;
  const { sentImage, signal } = ctx;

  switch (tool) {
    case 'ocr_recognize': {
      if (!sentImage) throw new Error('未附带图片，无法识别');
      // PDF?
      if (sentImage.mimeType === 'application/pdf') {
        return await handlePdfOcr(sentImage, args, ctx);
      }
      const r = await recognize({
        image: { mimeType: sentImage.mimeType, base64: sentImage.base64 },
        format: args.format || 'markdown',
        model: decision.targetModel,
        signal,
      });
      return { kind: 'ocr', text: r.text, reasoning: r.reasoning, meta: `OCR · ${shortModel(r.model)}` };
    }

    case 'chat_about_content': {
      return await answerWithContext(args.question || '', { signal });
    }

    case 'generate_image': {
      ribbon.current?.progress?.(null, '生成中…');
      const prefs = getPrefs();
      const r = await generateImageResult({
        prompt: args.prompt,
        model: decision.targetModel,
        size: prefs.imageSize || args.size || DEFAULTS.imageSize,
        signal,
      });
      return { kind: 'image', imageUrls: r.imageUrls, revised_prompt: r.revised_prompt, meta: `生图 · ${shortModel(decision.targetModel)}` };
    }

    case 'generate_video': {
      const r = await generateVideoResult({
        prompt: args.prompt,
        model: decision.targetModel,
        frames: args.frames,
        fps: args.fps,
        signal,
        onProgress: ({ progress, elapsedSec }) => {
          const pct = progress != null ? Math.round(progress) : null;
          ribbon.current?.progress?.(pct, pct != null ? `${pct}% · ${elapsedSec}s` : `${elapsedSec}s`);
        },
      });
      return { kind: 'video', videoUrl: r.videoUrl, meta: `生视频 · ${shortModel(decision.targetModel)}` };
    }

    case 'web_search': {
      const r = await search({ query: args.query, signal });
      return { kind: 'web', text: r.text, refs: r.refs, reasoning: r.reasoning, meta: '联网搜索 · glm-4.7-flash' };
    }

    default:
      throw new Error(`未知工具: ${tool}`);
  }
}

/** chat_about_content: answer grounded on OCR context + history. */
async function answerWithContext(question, { signal }) {
  const messages = [];
  if (state.ocrContext) {
    messages.push({
      role: 'system',
      content: `以下是之前 OCR 识别的内容，回答用户问题时请优先基于它：\n\n${state.ocrContext.slice(0, 6000)}`,
    });
  }
  // Compact history (last 8 messages, text only)
  const hist = state.messages.slice(-9, -1);
  for (const m of hist) {
    let t = '';
    if (typeof m.content === 'string') t = m.content;
    else if (Array.isArray(m.content)) t = m.content.find(c => c.type === 'text')?.text || '';
    if (t) messages.push({ role: m.role, content: t });
  }
  messages.push({ role: 'user', content: question });

  const r = await chatCompletion({
    provider: 'agnes', model: ROUTER_MODEL,
    messages, temperature: 0.3, max_tokens: 4096, signal,
  });

  let text = r.content;
  if (!text && r.reasoning_content) {
    const r2 = await chatCompletion({ provider: 'agnes', model: ROUTER_MODEL, messages, temperature: 0.3, max_tokens: 8192, signal });
    text = r2.content || r2.reasoning_content;
  }
  return { kind: 'text', text: text || '（未生成回答）', reasoning: r.reasoning_content };
}

async function handlePdfOcr(sentImage, args, ctx) {
  const { signal } = ctx;
  // decode base64 -> Uint8Array
  const b64 = sentImage.base64;
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

  let combined = '';
  let firstPage = 1, total = 0;
  for await (const p of recognizePdf({ dataU8: u8, format: args.format || 'markdown', model: ctx.model, maxPages: 10, signal })) {
    if (!total) total = p.total;
    combined += `## 第 ${p.page} 页\n\n${p.text}\n\n`;
    ribbon.current?.progress?.(Math.round((p.page / p.total) * 100), `第 ${p.page}/${p.total} 页`);
  }
  return { kind: 'ocr', text: combined.trim() || '（未识别到内容）', meta: `OCR · PDF ${total} 页` };
}

function shortModel(m) { return m.split('/').pop(); }
