/**
 * router.js — Smart routing via LLM tool-calling (agnes-2.0-flash).
 * The brain. Decides which capability + model to invoke per user turn.
 *
 * Flow: route({userText, hasImage, hasOcrContext, history})
 *   -> builds router system prompt (tool catalog + OCR context summary + hasImage flag)
 *   -> api.chatCompletion(agnes, ROUTER_MODEL, tools, tool_choice:'auto', max_tokens:300)
 *   -> reads tool_calls[0].function -> emit onRoute(tool, args, targetModel)
 *   -> dispatch(tool, args, ctx) calls the matching module.
 *
 * Latency/cost: fast-path regex short-circuits obvious intents, skipping the router call.
 */

import { chatCompletion } from './api.js';
import { ROUTER_MODEL, findModel, getPrefs, DEFAULTS } from './config.js';

/** Router tool schema (the contract the router operates under). */
export const ROUTER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'ocr_recognize',
      description: '对用户附带的图片或 PDF 做文字识别。当用户上传了图片/文档且想提取文字、表格、转为 Markdown、描述图片内容时调用。',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['markdown', 'plain', 'table', 'describe'], default: 'markdown',
            description: '输出格式：markdown 保留排版、plain 纯文本、table 表格提取、describe 图像理解描述' },
        },
        required: ['format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chat_about_content',
      description: '针对已有 OCR 识别内容或对话上下文进行问答、总结、翻译、改写。当问题可由对话中已有内容回答（无需联网、无需生成图视频）时调用。',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '用户的完整问题' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: '根据文本提示词生成图片。当用户想画图、生成图片、做插画/海报/设计图时调用（含“画一张图、生成图片、画一个、做张图”等意图）。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '图像生成的详细提示词（中英皆可，尽量丰富细节）' },
          size: { type: 'string', enum: ['1K', '2K'], default: '1K' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description: '根据文本提示词生成视频。当用户想做视频、生成动画、把场景动起来时调用（含“做个视频、生成视频、动起来、动画”等意图）。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '视频生成的详细提示词' },
          frames: { type: 'number', description: '帧数，默认 121（约 5 秒@24fps），必须 <=441 且满足 8n+1' },
          fps: { type: 'number', description: '帧率，默认 24，范围 1-60' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '联网搜索获取时效性或外部信息。当问题需要最新事实、行情、新闻、今日日期、价格、不包含在图片或 OCR 内容中的外部知识时调用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索查询词' },
        },
        required: ['query'],
      },
    },
  },
];

// Map a tool name to the target executing model.
export function targetModelFor(toolName) {
  const prefs = getPrefs();
  switch (toolName) {
    case 'ocr_recognize': return prefs.ocrModel || DEFAULTS.ocrModel;
    case 'chat_about_content': return ROUTER_MODEL;          // agnes-2.0-flash
    case 'generate_image': return prefs.imageModel || DEFAULTS.imageModel;
    case 'generate_video': return DEFAULTS.videoModel;
    case 'web_search': return 'glm-4.7-flash';
    default: return ROUTER_MODEL;
  }
}

// 60s cache of identical prior router decisions.
const _cache = new Map();
function cacheKey(ctx) {
  return JSON.stringify({ t: ctx.userText, img: !!ctx.hasImage, ocr: !!ctx.hasOcrContext });
}

/**
 * Decide which tool to dispatch. Returns { tool, args, targetModel, fromFastPath }.
 * ctx: { userText, hasImage, hasOcrContext, history }
 */
export async function route(ctx) {
  // Fast-path short-circuits (skip the router call entirely for obvious intents).
  const fp = fastPath(ctx);
  if (fp) return { ...fp, fromFastPath: true };

  const ck = cacheKey(ctx);
  if (_cache.has(ck)) {
    const cached = _cache.get(ck);
    if (Date.now() - cached.ts < 60000) return { ...cached.value, fromFastPath: false };
  }

  const systemPrompt = buildRouterSystemPrompt(ctx);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: ctx.userText || (ctx.hasImage ? '请识别这张图片中的内容。' : '') },
  ];

  const r = await chatCompletion({
    provider: 'agnes',
    model: ROUTER_MODEL,
    messages,
    tools: ROUTER_TOOLS,
    tool_choice: 'auto',
    temperature: 0,
    max_tokens: 300,
    signal: ctx.signal,
  });

  let tool = null, args = {};
  if (r.tool_calls && r.tool_calls.length) {
    const call = r.tool_calls[0];
    tool = call.function.name;
    try { args = JSON.parse(call.function.arguments || '{}'); }
    catch { args = {}; }
  }

  // Fallback when no tool call.
  if (!tool) {
    if (ctx.hasImage) tool = 'ocr_recognize', args = { format: 'markdown' };
    else tool = 'chat_about_content', args = { question: ctx.userText };
  }

  const value = { tool, args, targetModel: targetModelFor(tool) };
  _cache.set(ck, { value, ts: Date.now() });
  return { ...value, fromFastPath: false };
}

function buildRouterSystemPrompt(ctx) {
  const ocrSummary = ctx.hasOcrContext && ctx.ocrContext
    ? `\n\n## 已有 OCR 识别内容（用户可能针对它提问）\n${truncate(ctx.ocrContext, 1500)}`
    : '';

  return `你是一个智能路由层，任务是判断用户本轮应该调用哪个工具。可用工具：

1. ocr_recognize — 用户上传了图片/文档且想识别文字、提取表格、转 Markdown、描述图片。
2. chat_about_content — 用户针对已有内容（OCR 结果或对话上下文）提问、总结、翻译、改写；无需联网、无需生成图/视频。
3. generate_image — 用户想画图/生成图片（“画一张…图”“生成图片”“做个插画”等）。
4. generate_video — 用户想做视频/生成动画（“做个视频”“生成视频”“动起来”等）。
5. web_search — 需要时效性/外部信息（行情、新闻、今日日期、价格、图片与 OCR 之外的知识）。

## 判定规则
- 用户本轮${ctx.hasImage ? '已附图片' : '未附图片'}。
- 若附图片且意图是“认字/提取/转格式/描述图片”→ ocr_recognize。
- 若未附图片且问题可由已有 OCR 内容或对话上下文回答 → chat_about_content。
- 若要联网获取最新/外部信息 → web_search。
- 生成类意图（画图/做视频）优先于其它。
- 只选一个工具。不要回答用户问题，只决定调哪个工具。${ocrSummary}`;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…[已截断]' : s;
}

/**
 * Fast-path: obvious intents skip the router call.
 * Returns { tool, args, targetModel } or null.
 */
function fastPath(ctx) {
  const t = (ctx.userText || '').trim();
  const hasImg = ctx.hasImage;

  // Image attached + empty text -> OCR
  if (hasImg && !t) return { tool: 'ocr_recognize', args: { format: 'markdown' }, targetModel: targetModelFor('ocr_recognize') };

  // Image attached + explicit OCR/extraction intent
  if (hasImg && /^(识别|ocr|提取|认字|转\s*markdown|转md|表格|读图|这(张|个)(图|图里|图片)|图里|看一下这)/i.test(t))
    return { tool: 'ocr_recognize', args: { format: sniffFormat(t) }, targetModel: targetModelFor('ocr_recognize') };

  // Generate image
  if (/^(画|生成|做|来)(一张|一个|个|张)?\s*(.{0,6})?(图|图片|插画|海报|设计|画)/i.test(t) ||
      /生成图片|画图|帮我画|画一个/i.test(t)) {
    return { tool: 'generate_image', args: { prompt: t }, targetModel: targetModelFor('generate_image') };
  }

  // Generate video
  if (/^(做个?|生成|来个?)\s*(.{0,6})?(视频|动画|短片|动态)/i.test(t) || /生成视频|把.{0,10}动起来/i.test(t)) {
    const fps = /(\d+)\s*fps/i.exec(t)?.[1] || 24;
    const sec = /(\d+)\s*秒/.exec(t)?.[1];
    const frames = sec ? snap8n1(sec * Number(fps)) : 121;
    return { tool: 'generate_video', args: { prompt: t, frames, fps: Number(fps) }, targetModel: targetModelFor('generate_video') };
  }

  return null;
}

function sniffFormat(t) {
  if (/markdown|md|排版/i.test(t)) return 'markdown';
  if (/表格|table/i.test(t)) return 'table';
  if (/纯文本|plain|只要文字/i.test(t)) return 'plain';
  if (/描述|理解|describe|内容/i.test(t)) return 'describe';
  return 'markdown';
}

function snap8n1(n) {
  const k = Math.round((n - 1) / 8);
  return Math.min(441, Math.max(9, 8 * k + 1));
}
