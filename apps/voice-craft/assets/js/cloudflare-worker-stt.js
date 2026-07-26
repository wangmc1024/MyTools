/**
 * Cloudflare Worker — VoiceCraft STT (Speech-to-Text) 代理
 * 
 * 路由: POST /v1/audio/transcriptions
 * 
 * 双模型分支:
 *   - 如果请求携带 model=FunAudioLLM/SenseVoiceSmall → 走 SenseVoiceSmall 分支
 *   - 如果请求携带 model=TeleAI/TeleSpeechASR        → 走 TeleSpeechASR 分支
 *   - 如果请求未携带 model 参数                       → 默认走 TeleSpeechASR 分支（新默认）
 * 
 * Token 优先级: 前端传入的自定义 token > 内置默认 token
 */

// ============================================================
// 配置 — 统一在此维护，不分散在代码各处
// ============================================================

const DEFAULT_API_KEY = 'sk-yfvcwuoydwyhovadqzxoycatggqamgoesfenzhexgbkvboqt';
const SILICON_FLOW_BASE_URL = 'https://api.siliconflow.cn/v1/audio/transcriptions';

// 支持的模型列表（用于校验）
const SUPPORTED_STT_MODELS = [
  'FunAudioLLM/SenseVoiceSmall', // 模型A — 原有保留：中日韩英粤多语种
  'TeleAI/TeleSpeechASR',        // 模型B — 新增扩展：60种中文方言
];

// 当请求未指定 model 时的默认模型
const DEFAULT_MODEL = 'TeleAI/TeleSpeechASR';


// ============================================================
// 帮助函数
// ============================================================

/** 从 FormData 中获取某个字段的字符串值 */
function getFormField(formData, name) {
  const val = formData.get(name);
  return typeof val === 'string' ? val : null;
}


/**
 * 构造发送给 SiliconFlow 的请求 body
 * 
 * @param {FormData} reqFormData — 前端传来的原始 FormData
 * @param {string}   apiKey      — API key（自定义或默认）
 * @param {string}   model       — 要调用的模型名称
 * @returns {RequestInit}
 */
function buildUpstreamRequest(reqFormData, apiKey, model) {
  const upstreamForm = new FormData();
  
  // 转发 audio 文件字段
  const file = reqFormData.get('file');
  if (file) {
    upstreamForm.append('file', file);
  }
  
  // SiliconFlow /v1/audio/transcriptions 支持的额外参数
  upstreamForm.append('model', model);
  
  // 尝试获取语言提示（可选，SiliconFlow 支持 language 参数）
  const lang = getFormField(reqFormData, 'language');
  if (lang) {
    upstreamForm.append('language', lang);
  }
  
  // prompt 微调（可选）
  const prompt = getFormField(reqFormData, 'prompt');
  if (prompt) {
    upstreamForm.append('prompt', prompt);
  }
  
  // format 输出格式（可选，默认 json）
  const responseFormat = getFormField(reqFormData, 'response_format');
  if (responseFormat) {
    upstreamForm.append('response_format', responseFormat);
  }

  return {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: upstreamForm,
  };
}


// ============================================================
// 核心逻辑: STT 转录代理
// ============================================================

async function handleTranscription(request) {
  // 仅接受 POST 请求
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { message: 'Only POST method is allowed.' } }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 解析前端传来的 FormData
  let reqFormData;
  try {
    reqFormData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid form data. Please upload an audio file.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- 获取音频文件 ---
  const file = reqFormData.get('file');
  if (!file) {
    return new Response(
      JSON.stringify({ error: { message: 'No audio file provided.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- 确定 API Key（优先级: 自定义 > 默认） ---
  const customToken = getFormField(reqFormData, 'token');
  const apiKey = customToken && customToken.trim() ? customToken.trim() : DEFAULT_API_KEY;

  // --- 确定模型（优先级: 前端选择 > 默认） ---
  let model = getFormField(reqFormData, 'model');
  if (!model || !SUPPORTED_STT_MODELS.includes(model)) {
    model = DEFAULT_MODEL; // 默认为 TeleAI/TeleSpeechASR
  }

  console.log(`[STT] model=${model}, file=${file.name}, size=${file.size} bytes`);

  // --- 构建上游请求 ---
  const upstreamReq = buildUpstreamRequest(reqFormData, apiKey, model);

  // --- 发送请求到 SiliconFlow ---
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(SILICON_FLOW_BASE_URL, upstreamReq);
  } catch (err) {
    console.error('[STT] upstream fetch failed:', err.message);
    return new Response(
      JSON.stringify({ error: { message: 'Failed to reach transcription service. Please check your network.' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- 透传响应 ---
  if (!upstreamResponse.ok) {
    let errMsg = 'Transcription failed';
    try {
      const errBody = await upstreamResponse.json();
      errMsg = errBody.error?.message || errBody.message || errMsg;
    } catch {
      errMsg = await upstreamResponse.text() || errMsg;
    }
    return new Response(
      JSON.stringify({ error: { message: errMsg } }),
      { status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const upstreamData = await upstreamResponse.json();

  // 返回标准 OpenAI 格式的转录结果
  const responseBody = {
    text: upstreamData.text || '',
    model: model, // 回显实际使用的模型
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}


// ============================================================
// 路由入口 (Fetch Handler)
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 预检（浏览器跨域请求需要）
    if (request.method === 'OPTIONS') {
      return handleCorsPreflight();
    }

    // ----- 路由分发 -----
    if (url.pathname.includes('/v1/audio/transcriptions')) {
      // 🔊 STT 分支 — 语音转文字
      const response = await handleTranscription(request);
      return injectCorsHeaders(response);
    }

    // ----- 未知路由 -----
    return new Response(
      JSON.stringify({ error: { message: 'Route not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },
};


// ============================================================
// CORS 工具函数
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function handleCorsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function injectCorsHeaders(response) {
  if (!response) return null;
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
}