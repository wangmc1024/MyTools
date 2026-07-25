/**
 * config.js — Central provider/model registry + key persistence.
 * Single source of truth. Every other module imports from here.
 * All endpoints/keys live here; nothing hardcodes them elsewhere.
 */

export const ROUTER_MODEL = 'agnes-2.0-flash';

// Capability flags drive all routing decisions.
export const CAP = {
  OCR: 'ocr', VISION: 'vision', CHAT: 'chat', REASONING: 'reasoning',
  WEBSEARCH: 'websearch', ROUTER: 'router', TOOLS: 'tools', IMAGE: 'image', VIDEO: 'video',
};

// Baked-in default keys (same posture as existing app code.html — pre-filled, editable).
const DEFAULT_KEYS = {
  siliconflow: 'sk-yfvcwuoydwyhovadqzxoycatggqamgoesfenzhexgbkvboqt',
  zhipu: '19344c09a7c047a69ae0ee36cd75c4f3.wOrnR0cm2GL2kiCD',
  agnes: 'sk-4kbOHFeka595sDHrStt0641WniyyxMrYCg4fm1bXXSnxJcqG',
};

export const PROVIDERS = Object.freeze({
  siliconflow: {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    endpoints: { chat: '/chat/completions' },
    defaultKey: DEFAULT_KEYS.siliconflow,
    models: [
      { id: 'deepseek-ai/DeepSeek-OCR', label: 'DeepSeek-OCR', caps: [CAP.OCR, CAP.VISION], blurb: '文档识别专精 · 3B' },
      { id: 'PaddlePaddle/PaddleOCR-VL-1.5', label: 'PaddleOCR-VL-1.5', caps: [CAP.OCR, CAP.VISION], blurb: '轻量高速 · 0.9B' },
      { id: 'THUDM/GLM-Z1-9B-0414', label: 'GLM-Z1-9B', caps: [CAP.VISION, CAP.REASONING, CAP.CHAT], blurb: '多模态理解 · 9B' },
      { id: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B', label: 'DeepSeek-R1', caps: [CAP.REASONING, CAP.CHAT], blurb: '推理增强 · 8B' },
    ],
  },
  zhipu: {
    id: 'zhipu',
    label: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    endpoints: { chat: '/chat/completions' },
    defaultKey: DEFAULT_KEYS.zhipu,
    models: [
      { id: 'glm-4.7-flash', label: 'glm-4.7-flash', caps: [CAP.CHAT, CAP.VISION, CAP.REASONING, CAP.WEBSEARCH], blurb: '免费 · 高速多模态 · 联网' },
    ],
  },
  agnes: {
    id: 'agnes',
    label: 'Agnes AI',
    baseUrl: 'https://apihub.agnes-ai.com',
    endpoints: {
      chat: '/v1/chat/completions',
      images: '/v1/images/generations',
      videos: '/v1/videos',
      poll: '/agnesapi', // GET ?video_id=
    },
    defaultKey: DEFAULT_KEYS.agnes,
    models: [
      { id: 'agnes-2.0-flash', label: 'agnes-2.0-flash', caps: [CAP.CHAT, CAP.VISION, CAP.TOOLS, CAP.ROUTER], blurb: '路由层 · 工具调用' },
      { id: 'agnes-image-2.1-flash', label: 'agnes-image-2.1-flash', caps: [CAP.IMAGE], blurb: '文生图 · 高密度' },
      { id: 'agnes-image-2.0-flash', label: 'agnes-image-2.0-flash', caps: [CAP.IMAGE], blurb: '文生图 · 快速' },
      { id: 'agnes-video-v2.0', label: 'agnes-video-v2.0', caps: [CAP.VIDEO], blurb: '视频生成 · 异步' },
    ],
  },
});

const KEY_NS = 'chatorcr:keys:';

/** Get the API key for a provider, falling back to the baked-in default. */
export function getKey(providerId) {
  try {
    const k = localStorage.getItem(KEY_NS + providerId);
    if (k && k.trim()) return k.trim();
  } catch {}
  return PROVIDERS[providerId]?.defaultKey || '';
}

export function setKey(providerId, key) {
  try { localStorage.setItem(KEY_NS + providerId, key || ''); } catch {}
}

/** Find {provider, model} by model id across the registry. */
export function findModel(modelId) {
  for (const p of Object.values(PROVIDERS)) {
    const m = p.models.find(x => x.id === modelId);
    if (m) return { provider: p, model: m };
  }
  return null;
}

/** All models that have a given capability. */
export function modelsWithCap(cap) {
  const out = [];
  for (const p of Object.values(PROVIDERS))
    for (const m of p.models)
      if (m.caps.includes(cap)) out.push({ provider: p, model: m });
  return out;
}

export function endpointUrl(provider, key) {
  return provider.baseUrl + provider.endpoints[key];
}

/** Default model id for an OCR format hint. */
export function defaultOcrModelFor(format) {
  switch (format) {
    case 'plain': return 'PaddlePaddle/PaddleOCR-VL-1.5';
    case 'describe': return 'THUDM/GLM-Z1-9B-0414';
    default: return 'deepseek-ai/DeepSeek-OCR'; // markdown / table
  }
}

// localStorage-backed user preferences (persisted as one JSON blob)
const PREFS_KEY = 'chatorcr:prefs';
export function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}
export function setPrefs(patch) {
  try {
    const cur = getPrefs();
    const next = { ...cur, ...patch };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    return next;
  } catch { return getPrefs(); }
}

/** Populate a settings form (inputs named data-provider="<id>") and persist on change. */
export function bindSettings(formEl) {
  if (!formEl) return;
  for (const id of Object.keys(PROVIDERS)) {
    const input = formEl.querySelector(`input[data-provider="${id}"]`);
    if (!input) continue;
    input.value = getKey(id);
    input.addEventListener('change', () => setKey(id, input.value.trim()));
  }
}

export const DEFAULTS = Object.freeze({
  ocrFormat: 'markdown',
  ocrModel: 'deepseek-ai/DeepSeek-OCR',
  imageModel: 'agnes-image-2.1-flash',
  imageSize: '1K',
  videoModel: 'agnes-video-v2.0',
});
