/* ============================================================
 *  ChatOCR Pro — Config (模型 & Provider 配置)
 *  修复 siliconKey → siliconflowKey ID 不匹配 Bug
 * ========================================================== */

const PROVIDERS = Object.freeze({
  siliconflow: {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    endpoints: { chat: '/chat/completions' },
    keyEl: 'siliconflowKey',   // 修复：与HTML保持一致
    models: [
      { id: 'deepseek-ai/DeepSeek-OCR',            label: 'DeepSeek-OCR',        blurb: 'OCR专精 · 3B · 文档/表格/公式/手写/PDF', caps: ['ocr','vision','document','table','formula','pdf','scan','extract'], params: { temperature: 0, max_tokens: 4096, top_p: 1 } },
      { id: 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B', label: 'DeepSeek-R1-8B',   blurb: '推理达人 · 8B · 思维链文档问答/总结/分析', caps: ['chat','reasoning','docs','analysis','summary','math'], params: { temperature: 0, max_tokens: 8192, thinking_budget: 4096 } },
      { id: 'PaddlePaddle/PaddleOCR-VL-1.5',       label: 'PaddleOCR-VL',       blurb: '百度飞桨 · 0.9B超轻量 · 中文手写/票据/印章', caps: ['ocr','vision','handwriting','invoice','chinese','lightweight','document'], params: { temperature: 0, max_tokens: 16384, top_p: 1 } },
      { id: 'tencent/Hunyuan-MT-7B',               label: 'Hunyuan-MT-7B',      blurb: '腾讯混元翻译 · 7B · 33语种/5种民汉方言互译', caps: ['translation','multilingual','dialect','language','chat'], params: { temperature: 0.1, max_tokens: 8192 } },
      { id: 'THUDM/GLM-Z1-9B-0414',                label: 'GLM-Z1-9B',          blurb: '智谱推理 · 9B · 速度比R1快8倍 · MIT开源', caps: ['chat','reasoning','fast','opensource','mit'], params: { temperature: 0, max_tokens: 8192, thinking_budget: 4096 } },
    ]
  },
  zhipu: {
    id: 'zhipu',
    label: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    endpoints: { chat: '/chat/completions' },
    keyEl: 'zhipuKey',
    models: [
      { id: 'glm-4.7-flash',    label: 'glm-4.7-flash',  blurb: '✨ 免费 · MoE(30B/3B) · 路由/搜索/轻量编码', caps: ['router','websearch','chat','coding','free','fast','lightweight'], params: { temperature: 0.2, max_tokens: 4096 } },
    ]
  },
  agnes: {
    id: 'agnes',
    label: 'Agnes AI',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    endpoints: { chat: '/chat/completions', images: '/images/generations', videos: '/videos', poll: '/agnesapi' },
    keyEl: 'agnesKey',
    models: [
      { id: 'agnes-2.0-flash',        label: 'agnes-2.0-flash',        blurb: 'Flash快速 · 工具调用/函数 · 低延迟',        caps: ['chat','tools','router','fast','function','lightweight'] },
      { id: 'agnes-image-2.1-flash',  label: 'agnes-image-2.1-flash',  blurb: '文生图 · 高密度高质量 · 1024x1024',          caps: ['image','highquality','creative','design','art'] },
      { id: 'agnes-image-2.0-flash',  label: 'agnes-image-2.0-flash',  blurb: '文生图 · 快速出图 · 低延迟',                 caps: ['image','fast','creative','design','art'] },
      { id: 'agnes-video-v2.0',       label: 'agnes-video-v2.0',       blurb: '视频生成 · 异步任务 · 提交后轮询获取',       caps: ['video','async','animation','clip'] },
    ]
  }
});

// 工具 → 默认目标模型映射
const ROUTE_DEFAULTS = {
  ocr_recognize:       'deepseek-ai/DeepSeek-OCR',
  chat_about_content:  'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
  generate_image:      'agnes-image-2.1-flash',
  generate_video:      'agnes-video-v2.0',
  web_search:          'glm-4.7-flash',
  translate:           'tencent/Hunyuan-MT-7B',
};

const CAP_LABELS = {
  ocr:'OCR', vision:'视觉', chat:'对话', reasoning:'推理',
  router:'路由', websearch:'联网', image:'画图', video:'视频',
  translation:'翻译', tools:'工具', coding:'编码',
  document:'文档', table:'表格', formula:'公式', handwriting:'手写',
  invoice:'票据', docs:'文档问答', multilingual:'多语言',
  fast:'快速', free:'免费', agent:'Agent', longcontext:'长上下文',
  hirez:'高分辨率', highquality:'高质量', async:'异步',
  analysis:'分析', summary:'总结', math:'数学',
  pdf:'PDF', scan:'扫描', extract:'提取',
  chinese:'中文', lightweight:'轻量', dialect:'方言',
  language:'语言', opensource:'开源', mit:'MIT',
  multimodal:'多模态', function:'函数', creative:'创作',
  design:'设计', art:'艺术', animation:'动画', clip:'短片',
};

// 查找模型 (返回 {provider, model})
function findModel(modelId) {
  for (const p of Object.values(PROVIDERS)) {
    const m = p.models.find(x => x.id === modelId);
    if (m) return { provider: p, model: m };
  }
  return null;
}