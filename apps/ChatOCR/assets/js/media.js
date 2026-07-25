/**
 * media.js — Image generation + video generation (async polling lifecycle) + localStorage media store.
 */

import { generateImage, createVideo, pollVideo } from './api.js';

const MEDIA_KEY = 'chatorcr:media';        // array of {id, type:'image'|'video', url, thumb?, prompt, model, ts}
const VIDEO_TASKS_KEY = 'chatorcr:videotasks'; // array of {video_id, prompt, model, ts, status}
const MEDIA_CAP = 60;                       // max stored items

/* ---------- Image generation ---------- */

/**
 * Generate an image. Returns { kind:'image', imageUrls, revised_prompt }.
 * Handles both url and b64_json returns.
 */
export async function generateImageResult({ prompt, model = 'agnes-image-2.1-flash', size = '1K', ratio, signal } = {}) {
  if (!prompt) throw new Error('空提示词');
  const r = await generateImage({ model, prompt, size, ratio, signal });

  const urls = [];
  if (r.url) urls.push(r.url);
  if (r.b64_json) urls.push(`data:image/png;base64,${r.b64_json}`);

  if (!urls.length) throw new Error('图像生成未返回结果');

  // Store. For b64, make a tiny thumbnail; for url, store the url directly.
  for (const u of urls) {
    const thumb = u.startsWith('data:') ? await makeThumb(u, 200) : u;
    storeMedia({ type: 'image', url: u, thumb, prompt, model, ts: Date.now() });
  }

  return { kind: 'image', imageUrls: urls, revised_prompt: r.revised_prompt };
}

/* ---------- Video generation ---------- */

/**
 * Generate a video. Creates a task then polls. onProgress({progress, elapsedSec, status}) per tick.
 * Returns { kind:'video', videoUrl, poster? }.
 * num_frames must be <= 441 and follow 8n+1 (we snap to nearest valid).
 */
export async function generateVideoResult({ prompt, model = 'agnes-video-v2.0', frames = 121, fps = 24,
  height = 720, width = 1280, signal, onProgress } = {}) {
  if (!prompt) throw new Error('空提示词');

  // Snap num_frames to nearest 8n+1 <= 441.
  let nf = Math.min(441, Math.max(9, snap8n1(frames)));
  const { video_id } = await createVideo({ model, prompt, height, width, num_frames: nf, frame_rate: fps, signal });

  // Persist task so it can be resumed across nav/reopen.
  pushVideoTask({ video_id, prompt, model, ts: Date.now(), status: 'processing' });

  const r = await pollVideo(video_id, {
    signal,
    onPoll: ({ status, progress, elapsedSec, url }) => {
      if (onProgress) onProgress({ status, progress, elapsedSec, url });
    },
  });

  if (r.status === 'timeout') {
    updateVideoTask(video_id, { status: 'timeout' });
    const err = new Error('视频仍在生成中，任务 ID 已保存，可在画廊页复检');
    err.code = 'VIDEO_TIMEOUT';
    err.video_id = video_id;
    throw err;
  }

  if (!r.url) {
    throw new Error('视频生成完成但未返回地址');
  }

  updateVideoTask(video_id, { status: 'succeeded', url: r.url });
  storeMedia({ type: 'video', url: r.url, thumb: null, prompt, model, ts: Date.now() });
  return { kind: 'video', videoUrl: r.url };
}

function snap8n1(n) {
  // nearest k where k = 8m+1
  const k = Math.round((n - 1) / 8);
  return 8 * k + 1;
}

/* ---------- localStorage media store ---------- */

export function loadMedia() {
  try { return JSON.parse(localStorage.getItem(MEDIA_KEY) || '[]'); } catch { return []; }
}

export function storeMedia(item) {
  const all = loadMedia();
  item.id = item.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  all.unshift(item);
  if (all.length > MEDIA_CAP) all.length = MEDIA_CAP;
  try { localStorage.setItem(MEDIA_KEY, JSON.stringify(all)); } catch {
    // quota — drop oldest half (usually large b64 thumbs) and retry
    all.splice(Math.floor(all.length / 2));
    try { localStorage.setItem(MEDIA_KEY, JSON.stringify(all)); } catch {}
  }
  return item;
}

export function deleteMedia(id) {
  const all = loadMedia().filter(m => m.id !== id);
  try { localStorage.setItem(MEDIA_KEY, JSON.stringify(all)); } catch {}
}

export function loadVideoTasks() {
  try { return JSON.parse(localStorage.getItem(VIDEO_TASKS_KEY) || '[]'); } catch { return []; }
}
function pushVideoTask(t) {
  const all = loadVideoTasks();
  all.unshift(t);
  if (all.length > 40) all.length = 40;
  try { localStorage.setItem(VIDEO_TASKS_KEY, JSON.stringify(all)); } catch {}
}
function updateVideoTask(videoId, patch) {
  const all = loadVideoTasks();
  const t = all.find(x => x.video_id === videoId);
  if (t) Object.assign(t, patch, { updated: Date.now() });
  try { localStorage.setItem(VIDEO_TASKS_KEY, JSON.stringify(all)); } catch {}
}
export function deleteVideoTask(videoId) {
  const all = loadVideoTasks().filter(t => t.video_id !== videoId);
  try { localStorage.setItem(VIDEO_TASKS_KEY, JSON.stringify(all)); } catch {}
}

/** Downscale a data URL image to a max-px square-ish thumbnail (base64 JPEG). */
function makeThumb(dataUrl, max) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      try { resolve(c.toDataURL('image/jpeg', 0.7)); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
