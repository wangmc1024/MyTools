/**
 * api.js — HTTP layer. Every network call goes through here.
 * Handles Bearer auth, JSON bodies, glm-4.7 reasoning trap,
 * Zhipu 1305 rate-limit backoff, video polling lifecycle.
 */

import { PROVIDERS, getKey, endpointUrl } from './config.js';

/** Sleep helper. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Build Authorization header value. */
function authHeader(providerId) {
  return 'Bearer ' + getKey(providerId);
}

/**
 * Normalized API error.
 */
export class ApiError extends Error {
  constructor(message, { provider, status, code, retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.provider = provider;
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function readError(res, providerId) {
  let body = null;
  try { body = await res.json(); } catch {}
  const msg = body?.error?.message || body?.message || `请求失败 (${res.status})`;
  const code = body?.error?.code != null ? String(body.error.code) : (body?.code != null ? String(body.code) : undefined);
  // Zhipu 1305 = overload, retryable
  const retryable = (code === '1305');
  return new ApiError(msg, { provider: providerId, status: res.status, code, retryable });
}

/**
 * Chat completion. Returns { content, reasoning_content, tool_calls } from choices[0].message.
 * One automatic backoff-retry on Zhipu 1305 before throwing.
 */
export async function chatCompletion({ provider: providerId, model, messages, tools, tool_choice,
  temperature = 0.2, max_tokens = 4096, signal } = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new ApiError(`未知 provider: ${providerId}`, { provider: providerId });

  const url = endpointUrl(provider, 'chat');
  const body = { model, messages, max_tokens, temperature, stream: false };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const doFetch = () => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader(providerId) },
    body: JSON.stringify(body),
    signal,
  });

  let res;
  try {
    res = await doFetch();
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(`网络错误: ${e.message}`, { provider: providerId, retryable: true });
  }

  if (!res.ok) {
    const err = await readError(res, providerId);
    if (err.retryable) {
      await sleep(1500);
      try { res = await doFetch(); }
      catch (e) { if (e.name === 'AbortError') throw e; throw new ApiError(`网络错误: ${e.message}`, { provider: providerId, retryable: true }); }
      if (!res.ok) throw await readError(res, providerId);
    } else {
      throw err;
    }
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  return {
    content: msg.content || '',
    reasoning_content: msg.reasoning_content || '',
    tool_calls: msg.tool_calls || null,
    raw: data,
  };
}

/**
 * Generate an image. Returns { url?, b64_json?, revised_prompt? }.
 */
export async function generateImage({ model, prompt, size = '1K', ratio, signal } = {}) {
  const provider = PROVIDERS.agnes;
  const url = endpointUrl(provider, 'images');
  const body = { model, prompt, size };
  if (ratio) body.ratio = ratio;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader('agnes') },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(`网络错误: ${e.message}`, { provider: 'agnes', retryable: true });
  }
  if (!res.ok) throw await readError(res, 'agnes');

  const data = await res.json();
  const item = data?.data?.[0] || {};
  return {
    url: item.url || null,
    b64_json: item.b64_json || null,
    revised_prompt: item.revised_prompt || null,
  };
}

/**
 * Create a video task. Returns { video_id }.
 * num_frames must be <= 441 and follow 8n+1.
 */
export async function createVideo({ model, prompt, height = 720, width = 1280, num_frames = 121, frame_rate = 24, signal } = {}) {
  const provider = PROVIDERS.agnes;
  const url = endpointUrl(provider, 'videos');
  const body = { model, prompt, height, width, num_frames, frame_rate };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader('agnes') },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(`网络错误: ${e.message}`, { provider: 'agnes', retryable: true });
  }
  if (!res.ok) throw await readError(res, 'agnes');

  const data = await res.json();
  const videoId = data.video_id || data.id;
  if (!videoId) throw new ApiError('视频任务未返回 video_id', { provider: 'agnes' });
  return { video_id: videoId, raw: data };
}

/**
 * Defensive extraction of a video URL + status from a poll response.
 * The real success shape is verified once at build time; we cover common field names.
 */
function parseVideoResult(data) {
  const status = String(data.status || data.state || 'processing').toLowerCase();

  const url =
    data.video_url || data.url || data.output || data.output_url ||
    data.result?.video_url || data.result?.url || data.result?.output ||
    (Array.isArray(data.videos) && data.videos[0]?.url) ||
    (Array.isArray(data.results) && data.results[0]?.url) ||
    null;

  const progress = data.progress ?? data.percent ?? null;

  return { status, url, progress: progress != null ? Number(progress) : null };
}

/**
 * Poll a video task. GET /agnesapi?video_id=<id> WITH Bearer auth.
 * Exp interval 4s × 1.4 -> cap 15s; 10-min hard cap; AbortSignal-aware.
 * onPoll({status, url, progress, elapsedSec}) called each tick.
 */
export async function pollVideo(videoId, { signal, onPoll } = {}) {
  const provider = PROVIDERS.agnes;
  const base = endpointUrl(provider, 'poll');
  const url = `${base}?video_id=${encodeURIComponent(videoId)}`;

  const MAX_MS = 10 * 60 * 1000; // 10 min hard cap
  let interval = 4000;
  const CAP_INTERVAL = 15000;
  const start = Date.now();

  const tick = async () => {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'Authorization': authHeader('agnes') },
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      // network blip — keep trying
      return { status: 'processing', url: null, progress: null, networkError: true };
    }

    if (res.status === 404) {
      throw new ApiError('视频任务不存在 (task not found)', { provider: 'agnes', status: 404 });
    }
    if (!res.ok && res.status !== 401) {
      // non-fatal: keep polling on 5xx etc.
      return { status: 'processing', url: null, progress: null };
    }

    let data = {};
    try { data = await res.json(); } catch {}

    // Check known terminal markers first.
    if (data.error && !data.status) {
      // e.g. 404 envelope handled above; other errors -> treat as failed
      const code = data.error.code;
      if (code === 404) throw new ApiError('视频任务不存在', { provider: 'agnes', status: 404 });
    }

    const parsed = parseVideoResult(data);
    return { ...parsed, raw: data };
  };

  while (true) {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const elapsed = Date.now() - start;
    if (elapsed > MAX_MS) {
      return { status: 'timeout', url: null, progress: null };
    }

    const r = await tick();
    if (onPoll) onPoll({ ...r, elapsedSec: Math.round(elapsed / 1000) });

    if (r.status === 'succeeded' || r.status === 'success' || r.status === 'completed' || r.status === 'done') {
      if (r.url) return { status: 'succeeded', url: r.url, raw: r.raw };
      // status says done but no url — keep polling a bit
    }
    if (r.status === 'failed' || r.status === 'error' || r.status === 'cancelled') {
      throw new ApiError('视频生成失败', { provider: 'agnes' });
    }

    await sleep(interval);
    interval = Math.min(CAP_INTERVAL, Math.round(interval * 1.4));
  }
}
