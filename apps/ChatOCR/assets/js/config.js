/* ============================================================
 *  ChatOCR Pro — Config (模型 & Provider 配置)
 *  仅保留 OCR 相关模型
 * ========================================================== */

const PROVIDERS = Object.freeze({
  siliconflow: {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    endpoints: { chat: '/chat/completions' },
    keyEl: 'siliconflowKey',
    models: [
      { id: 'deepseek-ai/DeepSeek-OCR',            label: 'DeepSeek-OCR',        blurb: 'OCR专精 · 3B · 文档/表格/公式/手写/PDF', caps: ['ocr','vision','document','table','formula','pdf','scan','extract'], params: { temperature: 0, max_tokens: 6000, top_p: 1 } },
      { id: 'PaddlePaddle/PaddleOCR-VL-1.5',       label: 'PaddleOCR-VL',       blurb: '百度飞桨 · 0.9B超轻量 · 中文手写/票据/印章', caps: ['ocr','vision','handwriting','invoice','chinese','lightweight','document'], params: { temperature: 0, max_tokens: 8000, top_p: 1 } },
    ]
  }
});

// 工具 → 默认目标模型映射
const ROUTE_DEFAULTS = {
  ocr_recognize:       'deepseek-ai/DeepSeek-OCR',
};

const CAP_LABELS = {
  ocr:'OCR', vision:'视觉',
  document:'文档', table:'表格', formula:'公式', handwriting:'手写',
  invoice:'票据',
  pdf:'PDF', scan:'扫描', extract:'提取',
  chinese:'中文', lightweight:'轻量',
};

// 查找模型 (返回 {provider, model})
function findModel(modelId) {
  for (const p of Object.values(PROVIDERS)) {
    const m = p.models.find(x => x.id === modelId);
    if (m) return { provider: p, model: m };
  }
  return null;
}
