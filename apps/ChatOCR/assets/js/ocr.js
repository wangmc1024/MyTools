/**
 * ocr.js — OCR engine: image/PDF → multimodal message, model selection.
 */

import { chatCompletion } from './api.js';
import { findModel, defaultOcrModelFor } from './config.js';

const FORMAT_PROMPTS = {
  markdown: '精准识别图片中的所有文字，保留原始排版与层级结构，输出为标准 Markdown 格式（含标题、列表、表格、代码块）。只输出识别结果，不要任何解释。',
  plain: '提取图片中的纯文本内容，按阅读顺序输出，不要任何格式、标记或多余说明。',
  table: '提取图片中的所有表格，转换为 Markdown 表格格式，确保数据准确对齐。若有多个表格依次输出。只输出表格，不要解释。',
  describe: '详细描述这张图片的内容，包括布局、文字、图表、配色与整体结构。',
  translate: '识别图片中的所有中文文字并翻译为英文，保留原有格式与排版。只输出译文。',
};

export function buildVisionContent(image, instruction) {
  return [
    { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'high' } },
    { type: 'text', text: instruction },
  ];
}

/**
 * Recognize text in an image. Returns { text, provider, model, format }.
 * @param {object} opts
 *   image: { mimeType, base64 }
 *   format: 'markdown'|'plain'|'table'|'describe'|'translate'
 *   model: model id (optional; defaults picked per format)
 *   signal: AbortSignal
 */
export async function recognize({ image, format = 'markdown', model, signal } = {}) {
  if (!image || !image.base64) throw new Error('未提供图片');
  const modelId = model || defaultOcrModelFor(format);
  const found = findModel(modelId);
  if (!found) throw new Error(`未知模型: ${modelId}`);
  const { provider } = found;

  const instruction = FORMAT_PROMPTS[format] || FORMAT_PROMPTS.markdown;
  const messages = [{ role: 'user', content: buildVisionContent(image, instruction) }];

  const r = await chatCompletion({
    provider: provider.id,
    model: modelId,
    messages,
    temperature: 0.1,
    max_tokens: 4096,
    signal,
  });

  // glm-4.7 reasoning trap: content empty but reasoning present
  let text = r.content;
  if (!text && r.reasoning_content) {
    // retry with larger budget
    const r2 = await chatCompletion({
      provider: provider.id, model: modelId, messages,
      temperature: 0.1, max_tokens: 8192, signal,
    });
    text = r2.content || r2.reasoning_content;
  }
  if (!text) text = '（未识别到内容）';

  return { text, provider: provider.id, model: modelId, format, reasoning: r.reasoning_content || '' };
}

/**
 * Render image-bearing PDFs to PNG via pdfjs-dist (CDN), then OCR page-by-page.
 * Robust path — decoupled from whether providers accept application/pdf data URLs natively.
 * @returns async generator yielding { page, text } per page; caller can show progress.
 */
export async function* recognizePdf({ dataU8, format = 'markdown', model, maxPages, signal }) {
  // Lazy-load pdfjs from CDN
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: dataU8 }).promise;
  const n = Math.min(doc.numPages, maxPages || doc.numPages);

  for (let i = 1; i <= n; i++) {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const r = await recognize({ image: { mimeType: 'image/png', base64 }, format, model, signal });
    yield { page: i, total: n, text: r.text };
  }
}

let _pdfjsPromise = null;
function loadPdfjs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.js';
    s.onload = () => {
      const pdfjs = window.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.js';
      resolve(pdfjs);
    };
    s.onerror = () => reject(new Error('PDF.js 加载失败，请检查网络'));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}
