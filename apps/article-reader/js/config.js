// ============================================================
//  CONFIGURATION — Constants, API keys, URLs, voice lists
// ============================================================

// IndexedDB
var DB_NAME = 'ArticleReader';
var DB_VERSION = 2;

// Silicon Flow Translation API (primary) — populated by config-loader.js from api-config.json
var SILICON_FLOW_API_KEY = typeof window.SILICON_FLOW_API_KEY !== 'undefined' ? window.SILICON_FLOW_API_KEY : '';
var SILICON_FLOW_API_URL = typeof window.SILICON_FLOW_API_URL !== 'undefined' ? window.SILICON_FLOW_API_URL : '';
var SILICON_FLOW_MODEL = typeof window.SILICON_FLOW_MODEL !== 'undefined' ? window.SILICON_FLOW_MODEL : 'tencent/Hunyuan-MT-7B';

// Cloudflare Worker fallback
var CLOUDFLARE_WORKER_URL = typeof window.CLOUDFLARE_WORKER_URL !== 'undefined' ? window.CLOUDFLARE_WORKER_URL : '';

// Edge-TTS Cloud Engine (primary / fallback) — populated by config-loader.js
var TTS_API_URL = typeof window.TTS_API_URL !== 'undefined' ? window.TTS_API_URL : '';
var TTS_API_URL_FALLBACK = typeof window.TTS_API_URL_FALLBACK !== 'undefined' ? window.TTS_API_URL_FALLBACK : '';
var EDGE_TTS_TIMEOUT = typeof window.EDGE_TTS_TIMEOUT !== 'undefined' ? window.EDGE_TTS_TIMEOUT : 15000;

// Translation result validation
var TRANSLATION_ERROR_MARKERS = [
  '翻译失败', '无译文', '请检查网络',
  'timeout', 'service unavailable', 'internal error', 'bad gateway',
  'too many requests', 'access denied', '429',
  'cloudflare', 'worker error', '502', '503', '524'
];

// Cache limits
var MAX_CACHE_ENTRIES = 50;

// Voices configuration
var VOICES = {
  en: [
    { id: 'en-US-JennyNeural', name: 'Jenny (US)' },
    { id: 'en-US-GuyNeural', name: 'Guy (US)' },
    { id: 'en-US-AriaNeural', name: 'Aria (US)' },
    { id: 'en-US-DavisNeural', name: 'Davis (US)' },
    { id: 'en-US-EmmaNeural', name: 'Emma (US)' },
    { id: 'en-US-BrianNeural', name: 'Brian (US)' },
    { id: 'en-US-AmberNeural', name: 'Amber (US)' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)' },
    { id: 'en-GB-RyanNeural', name: 'Ryan (UK)' },
    { id: 'en-AU-NatashaNeural', name: 'Natasha (AU)' }
  ],
  zh: [
    // Mandarin - Female (13)
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女·温柔)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女·甜美)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女·知性)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaohanNeural', name: '晓涵 (女·优雅)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaomengNeural', name: '晓梦 (女·梦幻)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaomoNeural', name: '晓墨 (女·文艺)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoqiuNeural', name: '晓秋 (女·成熟)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoruiNeural', name: '晓睿 (女·智慧)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoshuangNeural', name: '晓双 (女·活泼)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoxuanNeural', name: '晓萱 (女·清新)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoyanNeural', name: '晓颜 (女·柔美)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaoyouNeural', name: '晓悠 (女·悠扬)', group: '普通话 Mandarin' },
    { id: 'zh-CN-XiaozhenNeural', name: '晓甄 (女·端庄)', group: '普通话 Mandarin' },
    // Mandarin - Male (8)
    { id: 'zh-CN-YunxiNeural', name: '云希 (男·清朗)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunyangNeural', name: '云扬 (男·阳光)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunjianNeural', name: '云健 (男·稳重)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunfengNeural', name: '云枫 (男·磁性)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunhaoNeural', name: '云皓 (男·豪迈)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunxiaNeural', name: '云夏 (男·热情)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunyeNeural', name: '云野 (男·野性)', group: '普通话 Mandarin' },
    { id: 'zh-CN-YunzeNeural', name: '云泽 (男·深沉)', group: '普通话 Mandarin' },
    // Cantonese (2)
    { id: 'zh-HK-HiuMaanNeural', name: '曉明 (女·粵語)', group: '粵語 Cantonese' },
    { id: 'zh-HK-WanLungNeural', name: '雲龍 (男·粵語)', group: '粵語 Cantonese' },
    // Taiwanese (2)
    { id: 'zh-TW-HsiaoChenNeural', name: '曉臻 (女·台灣)', group: '台灣話 Taiwanese' },
    { id: 'zh-TW-HsiaoYuNeural', name: '曉雨 (女·台灣)', group: '台灣話 Taiwanese' }
  ]
};

// Last used voice defaults
var DEFAULT_LAST_USED_VOICE = { en: 'en-US-JennyNeural', zh: 'zh-CN-XiaoxiaoNeural' };