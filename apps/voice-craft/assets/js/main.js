let selectedFile = null;
let currentInputMethod = 'text'; // 'text' or 'file'
let currentMode = 'tts'; // 'tts' or 'transcription'
let selectedAudioFile = null;
let transcriptionToken = null;
let currentLanguage = 'en'; // 默认语言
const API_BASE_URL = 'https://edge-tts-voice-magic.wangmc1024.workers.dev';

// TTS 端点列表（按优先级排序，页面初始化时依次探测，找到第一个可用的）
const TTS_ENDPOINTS = [
    'https://edge-tts-voice-magic.wangmc1024.workers.dev/v1/audio/speech',
    'https://tts.wangwangit.com/v1/audio/speech',
];

// 健康检查后确定的可用 TTS URL（null 表示尚未探测）
let workingTTSUrl = null;

// 探测单个 TTS 端点是否可达（发送最小 POST 请求，短超时）
async function probeTTSEndpoint(url, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: '.', voice: 'en-US-JennyNeural', speed: 1, pitch: '0', style: 'general' }),
            signal: controller.signal
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

// 页面初始化时按顺序探测所有 TTS 端点，找到第一个可用的
async function initializeTTSHealthCheck() {
    const statusEl = document.getElementById('ttsServiceStatus');
    if (statusEl) {
        statusEl.textContent = '⏳';
        statusEl.title = '正在检测 TTS 服务...';
    }

    for (let i = 0; i < TTS_ENDPOINTS.length; i++) {
        const url = TTS_ENDPOINTS[i];
        const ok = await probeTTSEndpoint(url);
        if (ok) {
            workingTTSUrl = url;
            console.log(`[TTS Health] ✅ 端点 ${i + 1} 可用: ${url}`);
            if (statusEl) {
                statusEl.textContent = '🟢';
                statusEl.title = `TTS 服务就绪 (端点 ${i + 1}/${TTS_ENDPOINTS.length})`;
            }
            return;
        }
        console.warn(`[TTS Health] ❌ 端点 ${i + 1} 不可用: ${url}`);
    }

    // 全部不可用，降级使用第一个
    workingTTSUrl = TTS_ENDPOINTS[0];
    console.warn('[TTS Health] ⚠️ 所有端点均不可达，降级使用第一个端点');
    if (statusEl) {
        statusEl.textContent = '🔴';
        statusEl.title = 'TTS 服务不可用，将尝试降级连接';
    }
}
const edgeVoiceCatalog = {
    'cn-mandarin': [
        { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声·温柔）' },
        { value: 'zh-CN-YunxiNeural', label: '云希（男声·清朗）' },
        { value: 'zh-CN-YunyangNeural', label: '云扬（男声·阳光）' },
        { value: 'zh-CN-XiaoyiNeural', label: '晓伊（女声·甜美）' },
        { value: 'zh-CN-YunjianNeural', label: '云健（男声·稳重）' },
        { value: 'zh-CN-XiaochenNeural', label: '晓辰（女声·知性）' },
        { value: 'zh-CN-XiaohanNeural', label: '晓涵（女声·优雅）' },
        { value: 'zh-CN-XiaomengNeural', label: '晓梦（女声·梦幻）' },
        { value: 'zh-CN-XiaomoNeural', label: '晓墨（女声·文艺）' },
        { value: 'zh-CN-XiaoqiuNeural', label: '晓秋（女声·成熟）' },
        { value: 'zh-CN-XiaoruiNeural', label: '晓睿（女声·智慧）' },
        { value: 'zh-CN-XiaoshuangNeural', label: '晓双（女声·活泼）' },
        { value: 'zh-CN-XiaoxuanNeural', label: '晓萱（女声·清新）' },
        { value: 'zh-CN-XiaoyanNeural', label: '晓颜（女声·柔美）' },
        { value: 'zh-CN-XiaoyouNeural', label: '晓悠（女声·悠扬）' },
        { value: 'zh-CN-XiaozhenNeural', label: '晓甄（女声·端庄）' },
        { value: 'zh-CN-YunfengNeural', label: '云枫（男声·磁性）' },
        { value: 'zh-CN-YunhaoNeural', label: '云皓（男声·豪迈）' },
        { value: 'zh-CN-YunxiaNeural', label: '云夏（男声·热情）' },
        { value: 'zh-CN-YunyeNeural', label: '云野（男声·野性）' },
        { value: 'zh-CN-YunzeNeural', label: '云泽（男声·深沉）' }
    ],
    'cn-cantonese': [
        { value: 'zh-HK-HiuGaaiNeural', label: '曉佳（女声·温柔）' },
        { value: 'zh-HK-WanLungNeural', label: '运龙（男声·稳定）' },
        { value: 'zh-HK-HiuMaanNeural', label: '小曼（女声·自然）' }
    ],
    'cn-taiwanese': [
        { value: 'zh-TW-HsiaoChenNeural', label: '小陈（女声·自然）' },
        { value: 'zh-TW-YunJheNeural', label: '云哲（男声·稳重）' },
        { value: 'zh-TW-HsiaoYuNeural', label: '小雨（女声·清晰）' }
    ],
    'us-english': [
        { value: 'en-US-AriaNeural', label: 'Aria（女声）' },
        { value: 'en-US-GuyNeural', label: 'Guy（男声）' },
        { value: 'en-US-JennyNeural', label: 'Jenny（女声）' }
    ],
    'uk-english': [
        { value: 'en-GB-SoniaNeural', label: 'Sonia（女声）' },
        { value: 'en-GB-RyanNeural', label: 'Ryan（男声）' }
    ],
    'ja-japanese': [
        { value: 'ja-JP-NanamiNeural', label: '七海（女声）' },
        { value: 'ja-JP-KeitaNeural', label: '邦太（男声）' }
    ],
    'ko-korean': [
        { value: 'ko-KR-SunHiNeural', label: '孙希（女声）' },
        { value: 'ko-KR-InJoonNeural', label: '인준（男声）' }
    ],
    'fr-french': [
        { value: 'fr-FR-DeniseNeural', label: 'Denise（女声）' },
        { value: 'fr-FR-HenriNeural', label: 'Henri（男声）' }
    ],
    'de-german': [
        { value: 'de-DE-KatjaNeural', label: 'Katja（女声）' },
        { value: 'de-DE-ConradNeural', label: 'Conrad（男声）' }
    ],
    'es-spanish': [
        { value: 'es-ES-ElviraNeural', label: 'Elvira（女声）' },
        { value: 'es-ES-AlvaroNeural', label: 'Alvaro（男声）' }
    ]
};

function getDefaultVoiceLocale() {
    const savedLocale = localStorage.getItem('voicecraft-voice-locale');
    if (savedLocale && edgeVoiceCatalog[savedLocale]) {
        return savedLocale;
    }

    if (currentLanguage === 'zh') {
        return 'cn-mandarin';
    }

    return 'us-english';
}

function renderVoiceOptions(locale = getDefaultVoiceLocale()) {
    const voiceSelect = document.getElementById('voice');
    const voiceLocaleSelect = document.getElementById('voiceLocale');
    const voiceGroup = edgeVoiceCatalog[locale] || edgeVoiceCatalog['cn-mandarin'];

    voiceLocaleSelect.value = locale;
    voiceSelect.innerHTML = voiceGroup
        .map(voice => `<option value="${voice.value}">${voice.label}</option>`)
        .join('');

    const savedVoice = localStorage.getItem('voicecraft-voice');
    if (savedVoice && voiceGroup.some(voice => voice.value === savedVoice)) {
        voiceSelect.value = savedVoice;
    } else {
        voiceSelect.value = voiceGroup[0].value;
    }

    localStorage.setItem('voicecraft-voice-locale', locale);
}

async function requestWithTimeout(url, options = {}, timeoutMs = 120000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请稍后再试');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// TTS 请求带 fallback 机制：优先使用健康检查发现的可用 URL，失败时自动重试其他端点
async function ttsRequestWithFallback(options, timeoutMs = 120000) {
    const primaryUrl = workingTTSUrl || TTS_ENDPOINTS[0];
    const fallbackUrls = TTS_ENDPOINTS.filter(u => u !== primaryUrl);
    const urls = [primaryUrl, ...fallbackUrls];
    let lastError = null;

    for (let i = 0; i < urls.length; i++) {
        try {
            const response = await requestWithTimeout(urls[i], options, timeoutMs);
            if (!response.ok) {
                const contentType = response.headers.get('content-type') || '';
                let errorMessage = '生成失败';
                try {
                    if (contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.error?.message || errorData.message || errorMessage;
                    } else {
                        const errorText = await response.text();
                        errorMessage = errorText || errorMessage;
                    }
                } catch {}
                throw new Error(errorMessage);
            }
            return response;
        } catch (e) {
            lastError = e;
            if (i === 0) {
                console.warn('主 TTS 服务请求失败，切换到备用服务...', e.message);
            }
        }
    }

    throw lastError || new Error('所有 TTS 服务均不可用');
}

// 国际化翻译数据
const translations = {
    en: {
        'page.title': 'VoiceCraft - AI-Powered Voice Processing Platform',
        'page.description': 'VoiceCraft is an AI-powered platform that converts text to speech and speech to text with 20+ voice options, lightning fast processing, completely free to use.',
        'page.keywords': 'text to speech,AI voice synthesis,online TTS,voice generator,free voice tools,speech to text,voice transcription',
        'lang.current': 'English',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI-Powered Voice Processing Platform',
        'header.feature1': '20+ Voice Options',
        'header.feature2': 'Lightning Fast',
        'header.feature3': 'Completely Free',
        'header.feature4': 'Download Support',
        'mode.tts': 'Text to Speech',
        'mode.transcription': 'Speech to Text',
        'stt.modelLabel': 'Transcription Model',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤）',
        'stt.model.teleasr': 'TeleSpeechASR（60种方言）',
        'stt.title': 'Speech to Text',
        'stt.upload': 'Upload Audio File',
        'stt.start': 'Start Transcription',
        'stt.resultLabel': 'Transcription Result',
        'stt.placeholder': 'Transcription result will be shown here...'
    },
    zh: {
        'page.title': 'VoiceCraft - AI驱动的语音处理平台',
        'page.description': 'VoiceCraft是一个AI驱动的平台，支持文字转语音和语音转文字，拥有20+种语音选项，闪电般的处理速度，完全免费使用。',
        'page.keywords': '文字转语音,AI语音合成,在线TTS,语音生成器,免费语音工具,语音转文字,语音转录',
        'lang.current': '中文',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI驱动的语音处理平台',
        'header.feature1': '20+种语音选项',
        'header.feature2': '闪电般快速',
        'header.feature3': '完全免费',
        'header.feature4': '支持下载',
        'mode.tts': '文字转语音',
        'mode.transcription': '语音转文字',
        'stt.modelLabel': '转录模型选择',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤多国语言）',
        'stt.model.teleasr': 'TeleSpeechASR（60种中文方言）',
        'stt.title': '语音转文字（STT）',
        'stt.upload': '上传音频文件',
        'stt.start': '开始语音转录',
        'stt.resultLabel': '转录结果',
        'stt.placeholder': '转录结果将在这里显示...'
    },
    ja: {
        'page.title': 'VoiceCraft - AI音声処理プラットフォーム',
        'page.description': 'VoiceCraftはAI駆動のプラットフォーム、テキスト読み上げと音声テキスト変換に対応。20以上の音声オプション、高速処理、完全無料でご利用いただけます。',
        'page.keywords': 'テキスト読み上げ,AI音声合成,オンラインTTS,音声ジェネレーター,無料音声ツール,音声テキスト変換,音声転写',
        'lang.current': '日本語',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI音声処理プラットフォーム',
        'header.feature1': '20以上の音声オプション',
        'header.feature2': '高速処理',
        'header.feature3': '完全無料',
        'header.feature4': 'ダウンロード対応',
        'mode.tts': 'テキスト読み上げ',
        'mode.transcription': '音声テキスト変換',
        'stt.modelLabel': 'トランスクリプションモデル',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韓英広東語）',
        'stt.model.teleasr': 'TeleSpeechASR（60種類の方言）',
        'stt.title': '音声テキスト変換（STT）',
        'stt.upload': 'オーディオファイルをアップロード',
        'stt.start': 'トランスクリプション開始',
        'stt.resultLabel': 'トランスクリプション結果',
        'stt.placeholder': 'トランスクリプション結果はここに表示されます...'
    },
    ko: {
        'page.title': 'VoiceCraft - AI 음성 처리 플랫폼',
        'page.description': 'VoiceCraft는 AI 기반 플랫폼으로 텍스트 음성 변환과 음성 텍스트 변환을 지원합니다. 20개 이상의 음성 옵션, 빠른 처리 속도, 완전 무료로 이용하실 수 있습니다.',
        'page.keywords': '텍스트 음성 변환,AI 음성 합성,온라인 TTS,음성 생성기,무료 음성 도구,음성 텍스트 변환,음성 전사',
        'lang.current': '한국어',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI 음성 처리 플랫폼',
        'header.feature1': '20개 이상의 음성 옵션',
        'header.feature2': '빠른 처리',
        'header.feature3': '완전 무료',
        'header.feature4': '다운로드 지원',
        'mode.tts': '텍스트 음성 변환',
        'mode.transcription': '음성 텍스트 변환',
        'stt.modelLabel': '트랜스크립션 모델',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韓영 광둥어）',
        'stt.model.teleasr': 'TeleSpeechASR（60종 방언）',
        'stt.title': '음성 텍스트 변환（STT）',
        'stt.upload': '오디오 파일 업로드',
        'stt.start': '트랜스크립션 시작',
        'stt.resultLabel': '트랜스크립션 결과',
        'stt.placeholder': '트랜스크립션 결과가 여기에 표시됩니다...'
    },
    es: {
        'page.title': 'VoiceCraft - Plataforma de Procesamiento de Voz con IA',
        'page.description': 'VoiceCraft es una plataforma impulsada por IA que convierte texto a voz y voz a texto con más de 20 opciones de voz, procesamiento ultrarrápido, completamente gratis.',
        'page.keywords': 'texto a voz,síntesis de voz IA,TTS en línea,generador de voz,herramientas de voz gratis,voz a texto,transcripción de voz',
        'lang.current': 'Español',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'Plataforma de Procesamiento de Voz con IA',
        'header.feature1': 'Más de 20 Opciones de Voz',
        'header.feature2': 'Ultrarrápido',
        'header.feature3': 'Completamente Gratis',
        'header.feature4': 'Soporte de Descarga',
        'mode.tts': 'Texto a Voz',
        'mode.transcription': 'Voz a Texto',
        'stt.modelLabel': 'Modelo de Transcripción',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤）',
        'stt.model.teleasr': 'TeleSpeechASR（60 dialectos）',
        'stt.title': 'Voz a Texto (STT)',
        'stt.upload': 'Subir archivo de audio',
        'stt.start': 'Iniciar transcripción',
        'stt.resultLabel': 'Resultado de la transcripción',
        'stt.placeholder': 'El resultado aparecerá aquí...'
    },
    fr: {
        'page.title': 'VoiceCraft - Plateforme de Traitement Vocal IA',
        'page.description': 'VoiceCraft est une plateforme alimentée par IA qui convertit le texte en parole et la parole en texte avec plus de 20 options vocales, traitement ultra-rapide, entièrement gratuit.',
        'page.keywords': 'texte vers parole,synthèse vocale IA,TTS en ligne,générateur vocal,outils vocaux gratuits,parole vers texte,transcription vocale',
        'lang.current': 'Français',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'Plateforme de Traitement Vocal IA',
        'header.feature1': 'Plus de 20 Options Vocales',
        'header.feature2': 'Ultra-rapide',
        'header.feature3': 'Entièrement Gratuit',
        'header.feature4': 'Support de Téléchargement',
        'mode.tts': 'Texte vers Parole',
        'mode.transcription': 'Parole vers Texte',
        'stt.modelLabel': 'Modèle de Transcription',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤）',
        'stt.model.teleasr': 'TeleSpeechASR（60 dialectes）',
        'stt.title': 'Parole vers Texte (STT)',
        'stt.upload': 'Télécharger l\'audio',
        'stt.start': 'Démarrer la transcription',
        'stt.resultLabel': 'Résultat de transcription',
        'stt.placeholder': 'Le résultat apparaîtra ici...'
    },
    de: {
        'page.title': 'VoiceCraft - KI-gestützte Sprachverarbeitungsplattform',
        'page.description': 'VoiceCraft ist eine KI-gestützte Plattform, die Text in Sprache und Sprache in Text umwandelt, mit über 20 Sprachoptionen, blitzschneller Verarbeitung, völlig kostenlos.',
        'page.keywords': 'Text zu Sprache,KI-Sprachsynthese,Online-TTS,Sprachgenerator,kostenlose Sprachtools,Sprache zu Text,Sprachtranskription',
        'lang.current': 'Deutsch',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'KI-gestützte Sprachverarbeitungsplattform',
        'header.feature1': 'Über 20 Sprachoptionen',
        'header.feature2': 'Blitzschnell',
        'header.feature3': 'Völlig Kostenlos',
        'header.feature4': 'Download-Unterstützung',
        'mode.tts': 'Text zu Sprache',
        'mode.transcription': 'Sprache zu Text',
        'stt.modelLabel': 'Transkriptionsmodell',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤）',
        'stt.model.teleasr': 'TeleSpeechASR（60 Dialekte）',
        'stt.title': 'Sprache zu Text (STT)',
        'stt.upload': 'Audiodatei hochladen',
        'stt.start': 'Transkription starten',
        'stt.resultLabel': 'Transkriptionsergebnis',
        'stt.placeholder': 'Das Ergebnis wird hier angezeigt...'
    },
    ru: {
        'page.title': 'VoiceCraft - ИИ-платформа обработки голоса',
        'page.description': 'VoiceCraft - это платформа на базе ИИ, которая преобразует текст в речь и речь в текст с более чем 20 голосовыми опциями, молниеносной обработкой, совершенно бесплатно.',
        'page.keywords': 'текст в речь,ИИ синтез речи,онлайн TTS,генератор голоса,бесплатные голосовые инструменты,речь в текст,транскрипция речи',
        'lang.current': 'Русский',
        'lang.en': 'English',
        'lang.zh': '中文',
        'lang.ja': '日本語',
        'lang.ko': '한국어',
        'lang.es': 'Español',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.ru': 'Русский',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'ИИ-платформа обработки голоса',
        'header.feature1': 'Более 20 голосовых опций',
        'header.feature2': 'Молниеносно',
        'header.feature3': 'Совершенно Бесплатно',
        'header.feature4': 'Поддержка Загрузки',
        'mode.tts': 'Текст в Речь',
        'mode.transcription': 'Речь в Текст',
        'stt.modelLabel': 'Модель Транскрипции',
        'stt.model.sensevoice': 'SenseVoiceSmall（中日韩英粤）',
        'stt.model.teleasr': 'TeleSpeechASR（60 диалектов）',
        'stt.title': 'Речь в Текст (STT)',
        'stt.upload': 'Загрузить аудиофайл',
        'stt.start': 'Начать транскрипцию',
        'stt.resultLabel': 'Результат транскрипции',
        'stt.placeholder': 'Результат появится здесь...'
    }
};

// 国际化功能
function detectLanguage() {
    // 检测浏览器语言
    const browserLang = navigator.language || navigator.userLanguage;
    const shortLang = browserLang.split('-')[0];

    // 检查是否支持该语言
    if (translations[shortLang]) {
        return shortLang;
    }

    // 默认返回中文
    return 'zh';
}

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('voicecraft-language', lang);

    // 更新页面语言属性
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;

    // 应用翻译
    applyTranslations();

    // 更新语言切换器
    updateLanguageSwitcher();
}

function applyTranslations() {
    const langData = translations[currentLanguage];

    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (langData[key]) {
            element.textContent = langData[key];
        }
    });

    // 更新 meta 标签
    document.querySelectorAll('[data-i18n-content]').forEach(element => {
        const key = element.getAttribute('data-i18n-content');
        if (langData[key]) {
            element.setAttribute('content', langData[key]);
        }
    });

    // 更新页面标题
    if (langData['page.title']) {
        document.title = langData['page.title'];
    }
}

function updateLanguageSwitcher() {
    const langFlags = {
        'en': '🇺🇸',
        'zh': '🇨🇳',
        'ja': '🇯🇵',
        'ko': '🇰🇷',
        'es': '🇪🇸',
        'fr': '🇫🇷',
        'de': '🇩🇪',
        'ru': '🇷🇺'
    };

    const langData = translations[currentLanguage];
    document.getElementById('currentLangFlag').textContent = langFlags[currentLanguage];
    document.getElementById('currentLangName').textContent = langData['lang.current'];

    // 更新选中状态
    document.querySelectorAll('.language-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-lang') === currentLanguage) {
            option.classList.add('active');
        }
    });
}

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 初始化国际化
    initializeI18n();

    // 初始化其他功能
    initializeInputMethodTabs();
    initializeFileUpload();
    initializeModeSwitcher();
    initializeAudioUpload();
    initializeTokenConfig();
    initializeLanguageSwitcher();
    initializeSTTModelSelector();
    initializeVoiceLocaleSelector();

    // 启动 TTS 端点健康检查（异步，不阻塞页面交互）
    initializeTTSHealthCheck();
});

function initializeVoiceLocaleSelector() {
    const voiceLocaleSelect = document.getElementById('voiceLocale');
    const voiceSelect = document.getElementById('voice');

    if (!voiceLocaleSelect || !voiceSelect) {
        return;
    }

    renderVoiceOptions(getDefaultVoiceLocale());

    voiceLocaleSelect.addEventListener('change', function() {
        renderVoiceOptions(this.value);
    });

    voiceSelect.addEventListener('change', function() {
        localStorage.setItem('voicecraft-voice', this.value);
    });
}

// 初始化输入方式切换
function initializeInputMethodTabs() {
    const textInputTab = document.getElementById('textInputTab');
    const fileUploadTab = document.getElementById('fileUploadTab');
    const textInputArea = document.getElementById('textInputArea');
    const fileUploadArea = document.getElementById('fileUploadArea');

    textInputTab.addEventListener('click', function() {
        currentInputMethod = 'text';
        textInputTab.classList.add('active');
        fileUploadTab.classList.remove('active');
        textInputArea.style.display = 'block';
        fileUploadArea.style.display = 'none';
        document.getElementById('text').required = true;
    });

    fileUploadTab.addEventListener('click', function() {
        currentInputMethod = 'file';
        fileUploadTab.classList.add('active');
        textInputTab.classList.remove('active');
        textInputArea.style.display = 'none';
        fileUploadArea.style.display = 'block';
        document.getElementById('text').required = false;
    });
}

// 初始化文件上传功能
function initializeFileUpload() {
    const fileDropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileRemoveBtn = document.getElementById('fileRemoveBtn');

    // 点击上传区域
    fileDropZone.addEventListener('click', function() {
        fileInput.click();
    });

    // 文件选择
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // 拖拽功能
    fileDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        fileDropZone.classList.add('dragover');
    });

    fileDropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
    });

    fileDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        fileDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    });

    // 移除文件
    fileRemoveBtn.addEventListener('click', function() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        fileDropZone.style.display = 'block';
    });
}

// 处理文件选择
function handleFileSelect(file) {
    // 验证文件类型
    if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) {
        alert('请选择txt格式的文本文件');
        return;
    }

    // 验证文件大小
    if (file.size > 500 * 1024) {
        alert('文件大小不能超过500KB');
        return;
    }

    selectedFile = file;

    // 显示文件信息
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('fileDropZone').style.display = 'none';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatErrorMessage(err, context) {
    // 根据错误类型返回可读的错误信息
    const code = err.name || '';
    const message = (err.message || '').toLowerCase();

    if (code === 'AbortError' || message.includes('abort') || message.includes('timeout')) {
        return context === 'tts' ? '语音生成超时，请缩短文本或稍后再试' : '语音转录超时，请稍后再试';
    }
    if (message.includes('networkerror') || message.includes('network')) {
        return '网络连接失败，请检查您的网络设置后重试';
    }
    if (message.includes('failed') || message.includes('fetch')) {
        return '请求失败，可能是跨域(CORS)限制或服务器不可达，请稍后重试';
    }
    if (message.includes('too many')) {
        return '文本过长导致请求次数过多，请缩短文本内容或分段处理';
    }
    if (message.includes('频率限制') || message.includes('429') || message.includes('rate limit')) {
        return '请求过于频繁，请稍后再试';
    }
    if (message.includes('分块数量') || message.includes('chunk')) {
        return '请求分块数量超过限制，请缩短输入内容';
    }
    if (context === 'tts') {
        return '语音生成失败: ' + (err.message || '未知错误');
    } else {
        return '语音转录失败: ' + (err.message || '未知错误');
    }
}

// 表单提交处理
document.getElementById('ttsForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const voice = document.getElementById('voice').value;
    const speed = document.getElementById('speed').value;
    const pitch = document.getElementById('pitch').value;
    const style = document.getElementById('style').value;
    const volume = 0;

    const generateBtn = document.getElementById('generateBtn');
    const resultContainer = document.getElementById('result');
    const loading = document.getElementById('loading');
    const success = document.getElementById('success');
    const error = document.getElementById('error');

    // 验证输入
    if (currentInputMethod === 'text') {
        const text = document.getElementById('text').value;
        if (!text.trim()) {
            alert('请输入要转换的文本内容');
            return;
        }
    } else if (currentInputMethod === 'file') {
        if (!selectedFile) {
            alert('请选择要上传的txt文件');
            return;
        }
    }

    // 重置状态
    resultContainer.style.display = 'block';
    loading.style.display = 'block';
    success.style.display = 'none';
    error.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = '生成中...';

    try {
        let response;
        let textLength = 0;

        // 更新加载提示
        const loadingText = document.getElementById('loadingText');
        const progressInfo = document.getElementById('progressInfo');

        if (currentInputMethod === 'text') {
            // 手动输入文本
            const text = document.getElementById('text').value;
            textLength = text.length;

            // 根据文本长度显示不同的提示
            if (textLength > 3000) {
                loadingText.textContent = '正在处理长文本，请耐心等待...';
                progressInfo.textContent = '文本长度: ' + textLength + ' 字符，预计需要 ' + (Math.ceil(textLength / 1500) * 2) + ' 秒';
            } else {
                loadingText.textContent = '正在生成语音，请稍候...';
                progressInfo.textContent = '文本长度: ' + textLength + ' 字符';
            }

            response = await ttsRequestWithFallback({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: text,
                    voice: voice,
                    speed: parseFloat(speed),
                    volume: volume,
                    pitch: pitch,
                    style: style
                })
            });
        } else {
            // 文件上传
            loadingText.textContent = '正在处理上传的文件...';
            progressInfo.textContent = '文件: ' + selectedFile.name + ' (' + formatFileSize(selectedFile.size) + ')';

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('voice', voice);
            formData.append('speed', speed);
            formData.append('volume', volume);
            formData.append('pitch', pitch);
            formData.append('style', style);

            response = await ttsRequestWithFallback({
                method: 'POST',
                body: formData
            });
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // 显示音频播放器
        const audioPlayer = document.getElementById('audioPlayer');
        const downloadBtn = document.getElementById('downloadBtn');

        audioPlayer.src = audioUrl;
        downloadBtn.href = audioUrl;

        loading.style.display = 'none';
        success.style.display = 'block';

    } catch (err) {
        loading.style.display = 'none';
        error.style.display = 'block';
        error.textContent = formatErrorMessage(err, 'tts');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>🎙️</span><span>开始生成语音</span>';
    }
});

// 初始化模式切换器
function initializeModeSwitcher() {
    const ttsMode = document.getElementById('ttsMode');
    const transcriptionMode = document.getElementById('transcriptionMode');
    const mainContent = document.querySelector('.main-content');
    const transcriptionContainer = document.getElementById('transcriptionContainer');

    ttsMode.addEventListener('click', function() {
        switchMode('tts');
    });

    transcriptionMode.addEventListener('click', function() {
        switchMode('transcription');
    });
}

// 切换功能模式
function switchMode(mode) {
    const ttsMode = document.getElementById('ttsMode');
    const transcriptionMode = document.getElementById('transcriptionMode');
    const mainContent = document.querySelector('.main-content');
    const transcriptionContainer = document.getElementById('transcriptionContainer');
    currentMode = mode;

    if (!transcriptionContainer || !mainContent) {
        console.warn('[switchMode] one or both containers not found, skipping');
        return;
    }

    if (mode === 'tts') {
        // 切换到TTS模式
        ttsMode?.classList.add('active');
        transcriptionMode?.classList.remove('active');
        mainContent.style.display = 'block';
        transcriptionContainer.style.display = 'none';
    } else {
        // 切换到语音转录模式
        transcriptionMode?.classList.add('active');
        ttsMode?.classList.remove('active');
        mainContent.style.display = 'none';
        // 强制重排以确保 display:block 立即生效
        void transcriptionContainer.offsetHeight;
        transcriptionContainer.style.display = 'block';
    }
}

// 初始化音频上传功能
function initializeAudioUpload() {
    const audioDropZone = document.getElementById('audioDropZone');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioFileInfo = document.getElementById('audioFileInfo');
    const audioFileRemoveBtn = document.getElementById('audioFileRemoveBtn');

    // 点击上传区域
    audioDropZone.addEventListener('click', function() {
        audioFileInput.click();
    });

    // 文件选择
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleAudioFileSelect(file);
        }
    });

    // 拖拽功能
    audioDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        audioDropZone.classList.add('dragover');
    });

    audioDropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        audioDropZone.classList.remove('dragover');
    });

    audioDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        audioDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleAudioFileSelect(file);
        }
    });

    // 移除文件
    audioFileRemoveBtn.addEventListener('click', function() {
        selectedAudioFile = null;
        audioFileInput.value = '';
        audioFileInfo.style.display = 'none';
        audioDropZone.style.display = 'block';
    });
}

// 处理音频文件选择
function handleAudioFileSelect(file) {
    // 验证文件类型
    const allowedTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac',
        'audio/ogg', 'audio/webm', 'audio/amr', 'audio/3gpp'
    ];

    const isValidType = allowedTypes.some(type =>
        file.type.includes(type) ||
        file.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i)
    );

    if (!isValidType) {
        alert('请选择音频格式的文件（mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp）');
        return;
    }

    // 验证文件大小（限制为10MB）
    if (file.size > 10 * 1024 * 1024) {
        alert('音频文件大小不能超过10MB');
        return;
    }

    selectedAudioFile = file;

    // 显示文件信息
    document.getElementById('audioFileName').textContent = file.name;
    document.getElementById('audioFileSize').textContent = formatFileSize(file.size);
    document.getElementById('audioFileInfo').style.display = 'flex';
    document.getElementById('audioDropZone').style.display = 'none';
}

// 初始化Token配置
function initializeTokenConfig() {
    const tokenRadios = document.querySelectorAll('input[name="tokenOption"]');
    const tokenInput = document.getElementById('tokenInput');

    tokenRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'custom') {
                tokenInput.style.display = 'block';
                tokenInput.required = true;
            } else {
                tokenInput.style.display = 'none';
                tokenInput.required = false;
                tokenInput.value = '';
            }
        });
    });
}

// 处理语音转录表单提交
document.getElementById('transcriptionForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const transcribeBtn = document.getElementById('transcribeBtn');
    const transcriptionResult = document.getElementById('transcriptionResult');
    const transcriptionLoading = document.getElementById('transcriptionLoading');
    const transcriptionSuccess = document.getElementById('transcriptionSuccess');
    const transcriptionError = document.getElementById('transcriptionError');

    // 验证音频文件
    if (!selectedAudioFile) {
        alert('请选择要转录的音频文件');
        return;
    }

    // 获取Token配置
    const tokenOption = document.querySelector('input[name="tokenOption"]:checked').value;
    const customToken = document.getElementById('tokenInput').value;

    if (tokenOption === 'custom' && !customToken.trim()) {
        alert('请输入自定义Token');
        return;
    }

    // 重置状态
    transcriptionResult.style.display = 'block';
    transcriptionLoading.style.display = 'block';
    transcriptionSuccess.style.display = 'none';
    transcriptionError.style.display = 'none';
    transcribeBtn.disabled = true;
    transcribeBtn.textContent = '转录中...';

    // 更新加载提示
    const loadingText = document.getElementById('transcriptionLoadingText');
    const progressInfo = document.getElementById('transcriptionProgressInfo');
    loadingText.textContent = '正在转录音频，请稍候...';
    progressInfo.textContent = '文件: ' + selectedAudioFile.name + ' (' + formatFileSize(selectedAudioFile.size) + ')';

    try {
        // 构建FormData
        const formData = new FormData();
        formData.append('file', selectedAudioFile);

        // 【新增】传递模型选择（默认 TeleAI/TeleSpeechASR）
        const sttModelSelect = document.getElementById('sttModelSelect');
        if (sttModelSelect) {
            formData.append('model', sttModelSelect.value);
        }

        // 准备请求头
        const headers = {};
        if (tokenOption === 'custom' && customToken.trim()) {
            headers['Authorization'] = `Bearer ${customToken.trim()}`;
        }

        const response = await requestWithTimeout(`https://api.siliconflow.cn/v1/audio/transcriptions`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            let errorMessage = '转录失败';
            const contentType = response.headers.get('content-type') || '';

            try {
                if (contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error?.message || errorData.message || errorMessage;
                } else {
                    const errorText = await response.text();
                    errorMessage = errorText || errorMessage;
                }
            } catch {
                errorMessage = '转录失败';
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        // 显示转录结果
        document.getElementById('transcriptionText').value = result.text || '';
        transcriptionLoading.style.display = 'none';
        transcriptionSuccess.style.display = 'block';

    } catch (err) {
        transcriptionLoading.style.display = 'none';
        transcriptionError.style.display = 'block';
        transcriptionError.textContent = formatErrorMessage(err, 'transcription');
    } finally {
        transcribeBtn.disabled = false;
        transcribeBtn.innerHTML = '<span>🎧</span><span>开始语音转录</span>';
    }
});

// 复制转录结果
document.getElementById('copyTranscriptionBtn').addEventListener('click', function() {
    const transcriptionText = document.getElementById('transcriptionText');
    transcriptionText.select();
    document.execCommand('copy');

    // 临时改变按钮文本
    const originalText = this.innerHTML;
    this.innerHTML = '<span>✅</span><span>已复制</span>';
    setTimeout(() => {
        this.innerHTML = originalText;
    }, 2000);
});

// 编辑转录结果
document.getElementById('editTranscriptionBtn').addEventListener('click', function() {
    const transcriptionText = document.getElementById('transcriptionText');
    const isReadonly = transcriptionText.readOnly;

    if (isReadonly) {
        transcriptionText.readOnly = false;
        transcriptionText.focus();
        this.innerHTML = '<span>💾</span><span>保存编辑</span>';
    } else {
        transcriptionText.readOnly = true;
        this.innerHTML = '<span>✏️</span><span>编辑文本</span>';
    }
});

// 转为语音功能
document.getElementById('useForTtsBtn').addEventListener('click', function() {
    const transcriptionText = document.getElementById('transcriptionText').value;

    if (!transcriptionText.trim()) {
        alert('转录结果为空，无法转换为语音');
        return;
    }

    // 切换到TTS模式
    switchMode('tts');

    // 将转录文本填入TTS文本框
    document.getElementById('text').value = transcriptionText;

    // 滚动到TTS区域
    document.querySelector('.main-content').scrollIntoView({ behavior: 'smooth' });
});

// 初始化国际化
function initializeI18n() {
    // 检查本地存储中的语言设置
    const savedLang = localStorage.getItem('voicecraft-language');

    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
    } else {
        // 自动检测浏览器语言
        currentLanguage = detectLanguage();
    }

    // 应用语言设置
    setLanguage(currentLanguage);
}

// 初始化语言切换器
function initializeLanguageSwitcher() {
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');

    // 切换下拉菜单显示/隐藏
    languageBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        languageDropdown.classList.toggle('show');
    });

    // 点击页面其他地方时隐藏下拉菜单
    document.addEventListener('click', function() {
        languageDropdown.classList.remove('show');
    });

    // 语言选择
    document.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', function() {
            const selectedLang = this.getAttribute('data-lang');
            setLanguage(selectedLang);
            languageDropdown.classList.remove('show');
        });
    });
}

// ============================================================
// STT 模型提示 & 对比表
// ============================================================

/** STT 模型描述（按语言） */
const MODEL_HINTS = {
    en: {
        describe: `TeleSpeechASR: Mandarin + English + 60 Chinese dialects (Sichuan, Min, Shanghainese, Hakka, Cantonese, etc.), no need to specify language manually. Optimized for phone recordings, government hotlines, multi-speaker meetings, noisy daily speech.<br><em>Does NOT support Japanese or Korean.</em>`,
        sensevoice: `SenseVoiceSmall: Mandarin, English, Cantonese, <strong>Japanese, Korean</strong>. Best for multilingual / foreign-language mixed audio.<br><em>No dialect support.</em>`,
        compareBtn: '📊 View Comparison',
    },
    zh: {
        describe: `TeleSpeechASR：普通话 + 英语 + 60 种国内方言（四川话、闽南话、上海话、客家话、粤语等），无需手动指定语种；对电话录音、政务热线、多人会议、日常口语嘈杂场景深度优化。<br><em>不支持日语、韩语。</em>`,
        sensevoice: `SenseVoiceSmall：普通话、英语、粤语、<strong>日语、韩语</strong>。适合外语混读、日韩语音频。<br><em>不支持方言。</em>`,
        compareBtn: '📊 查看对比表',
    },
    ja: {
        describe: `TeleSpeechASR: 標準語・英語・中国方言60種類。言語手動指定不要。電話録音・多話者会議・雑音環境に最適。<br><em>日本語・韓国語は<strong>非対応</strong>。</em>`,
        sensevoice: `SenseVoiceSmall: 標準語・英語・広東語・<strong>日本語・韓国語</strong>。多言語・外国語混在音声向け。<br><em>方言は非対応。</em>`,
        compareBtn: '📊 比較表を表示',
    },
    ko: {
        describe: `TeleSpeechASR: 표준어·영어+중국 방언 60종. 언어 수동 지정 불필요. 전화 녹음·다화자 회의·잡음 환경 최적화.<br><em>일어·한국어는 미지원.</em>`,
        sensevoice: `SenseVoiceSmall: 표준어·영어·광둥어·<strong>일어·한국어</strong>. 다국어·외국어 혼성 음성용.<br><em>방언 미지원.</em>`,
        compareBtn: '📊 비교표 보기',
    },
    es: {
        describe: `TeleSpeechASR: Mandarín + inglés + 60 dialectos chinos. Sin necesidad de especificar idioma manualmente. Optimizado para grabaciones telefónicas, reuniones multipersona y entornos ruidosos.<br><em>No soporta japonés ni coreano.</em>`,
        sensevoice: `SenseVoiceSmall: Mandarín, inglés, cantonés, <strong>japonés, coreano</strong>. Ideal para audio multilingüe.<br><em>No soporta dialectos.</em>`,
        compareBtn: '📊 Ver comparación',
    },
    fr: {
        describe: `TeleSpeechASR : Mandarin + anglais + 60 dialectes chinois. Pas besoin de spécifier la langue. Optimisé pour enregistrements téléphoniques, réunions multipersonnes et environnements bruyants.<br><em>Pas de support japonais ou coréen.</em>`,
        sensevoice: `SenseVoiceSmall : Mandarin, anglais, cantonais, <strong>japonais, coréen</strong>. Idéal pour audio multilingue.<br><em>Pas de support dialectal.</em>`,
        compareBtn: '📊 Voir le tableau',
    },
    de: {
        describe: `TeleSpeechASR: Mandarin + Englisch + 60 chinesische Dialekte. Keine manuelle Sprachangabe nötig. Optimiert für Telefonaufnahmen, Meetings und laute Umgebungen.<br><em>Kein Japanisch- oder Koreanisch-Support.</em>`,
        sensevoice: `SenseVoiceSmall: Mandarin, Englisch, Kantonesisch, <strong>Japanisch, Koreanisch</strong>. Ideal für mehrsprachiges Audio.<br><em>Kein Dialekt-Support.</em>`,
        compareBtn: '📊 Vergleich anzeigen',
    },
    ru: {
        describe: `TeleSpeechASR: Мандарин + английский + 60 китайских диалектов. Не нужно вручную указывать язык. Оптимизирован для телефонных записей, встреч и шумной речи.<br><em>Не поддерживает японский и корейский.</em>`,
        sensevoice: `SenseVoiceSmall: Мандарин, английский, кантонский, <strong>японский, корейский</strong>. Для многоязычного аудио.<br><em>Не поддерживает диалекты.</em>`,
        compareBtn: '📊 Сравнение',
    },
};

let sttCompareOpen = false;

/** 切换对比表显示 */
function toggleSTTCompare() {
    const panel = document.getElementById('modelComparePanel');
    const btn = document.getElementById('toggleCompareBtn');
    sttCompareOpen = !sttCompareOpen;
    if (panel && btn) {
        panel.style.display = sttCompareOpen ? 'block' : 'none';
        btn.textContent = sttCompareOpen ? '❌ 收起对比表' : translations[currentLanguage]['stt.compareBtn'] || MODEL_HINTS[currentLanguage]?.compareBtn || '📊 查看对比表';
    }
}

// Make toggleSTTCompare accessible globally (called from HTML onclick)
if (typeof window !== 'undefined') {
    window.toggleSTTCompare = toggleSTTCompare;
}

/** 根据选中的模型更新描述文字 */
function updateModelHint() {
    const select = document.getElementById('sttModelSelect');
    const hintTextEl = document.getElementById('modelHintText');
    if (!select || !hintTextEl) return;

    const code = select.value;
    const hint = MODEL_HINTS[currentLanguage];

    if (code === 'FunAudioLLM/SenseVoiceSmall') {
        hintTextEl.innerHTML = hint?.sensevoice || MODEL_HINTS.en.sensevoice;
    } else {
        hintTextEl.innerHTML = hint?.describe || MODEL_HINTS.en.describe;
    }
}

// 初始化 STT 模型选择器
function initializeSTTModelSelector() {
    const select = document.getElementById('sttModelSelect');
    if (select) {
        select.addEventListener('change', updateModelHint);
    }

    // 初始渲染
    updateModelHint();
}

// ============================================================
// 录音功能实现
// ============================================================

// 录音相关的全局变量
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

// 初始化录音功能
function initializeRecording() {
    // 初始化音频上传和录音的tab切换
    const uploadAudioTab = document.getElementById('uploadAudioTab');
    const recordAudioTab = document.getElementById('recordAudioTab');
    const uploadAudioArea = document.getElementById('uploadAudioArea');
    const recordAudioArea = document.getElementById('recordAudioArea');

    if (uploadAudioTab && recordAudioTab && uploadAudioArea && recordAudioArea) {
        // 上传文件tab点击
        uploadAudioTab.addEventListener('click', function() {
            this.classList.add('active');
            recordAudioTab.classList.remove('active');
            uploadAudioArea.style.display = 'block';
            recordAudioArea.style.display = 'none';
            // 停止当前录音（如果有）
            stopRecording();
        });

        // 录音tab点击
        recordAudioTab.addEventListener('click', function() {
            this.classList.add('active');
            uploadAudioTab.classList.remove('active');
            uploadAudioArea.style.display = 'none';
            recordAudioArea.style.display = 'block';
        });
    }

    // 初始化录音按钮
    const recordStartBtn = document.getElementById('recordStartBtn');
    const recordStopBtn = document.getElementById('recordStopBtn');

    if (recordStartBtn) {
        recordStartBtn.addEventListener('click', startRecording);
    }

    if (recordStopBtn) {
        recordStopBtn.addEventListener('click', stopRecording);
    }

    // 初始化音频可视化canvas
    initializeAudioVisualizer();
}

// 初始化音频可视化
function initializeAudioVisualizer() {
    const canvas = document.getElementById('audioCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

// 开始录音
async function startRecording() {
    try {
        // 请求麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // 初始化MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        // 设置录音事件监听
        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // 显示录音预览
            const recordedAudio = document.getElementById('recordedAudio');
            const audioPreviewContainer = document.getElementById('audioPreviewContainer');

            if (recordedAudio) {
                recordedAudio.src = audioUrl;
                recordedAudio.load();
            }

            if (audioPreviewContainer) {
                audioPreviewContainer.style.display = 'block';
            }

            // 将录音数据保存到selectedAudioFile变量
            selectedAudioFile = new File([audioBlob], `recording_${new Date().getTime()}.wav`, { type: 'audio/wav' });

            // 更新UI显示
            document.getElementById('audioFileName').textContent = selectedAudioFile.name;
            document.getElementById('audioFileSize').textContent = formatFileSize(selectedAudioFile.size);
            document.getElementById('audioFileInfo').style.display = 'flex';

            // 停止音频可视化
            stopAudioVisualization();
        });

        // 初始化音频分析器
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // 开始录音
        mediaRecorder.start();
        isRecording = true;

        // 更新UI
        updateRecordingUI(true);

        // 开始录音计时器
        startRecordingTimer();

        // 开始音频可视化
        startAudioVisualization();

        console.log('录音已开始');

    } catch (error) {
        console.error('录音启动失败:', error);
        alert('无法访问麦克风，请检查权限设置: ' + error.message);
    }
}

// 停止录音
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        // 停止录音计时器
        stopRecordingTimer();

        // 停止音频可视化
        stopAudioVisualization();

        // 停止所有媒体流
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        // 更新UI
        updateRecordingUI(false);

        console.log('录音已停止');
    }
}

// 更新录音UI状态
function updateRecordingUI(isRecording) {
    const recordStartBtn = document.getElementById('recordStartBtn');
    const recordStopBtn = document.getElementById('recordStopBtn');
    const audioVisualizer = document.getElementById('audioVisualizer');
    const recordingInfo = document.getElementById('recordingInfo');
    const recordIcon = document.querySelector('.record-icon');

    if (isRecording) {
        // 录音中状态
        if (recordStartBtn) recordStartBtn.disabled = true;
        if (recordStopBtn) recordStopBtn.disabled = false;
        if (audioVisualizer) audioVisualizer.classList.add('active');
        if (recordingInfo) recordingInfo.style.display = 'flex';
        if (recordIcon) recordIcon.parentElement.parentElement.classList.add('recording');

        document.querySelector('.record-text').textContent = '录音进行中...';
    } else {
        // 停止状态
        if (recordStartBtn) recordStartBtn.disabled = false;
        if (recordStopBtn) recordStopBtn.disabled = true;
        if (audioVisualizer) audioVisualizer.classList.remove('active');
        if (recordingInfo) recordingInfo.style.display = 'flex';
        if (recordIcon) recordIcon.parentElement.parentElement.classList.remove('recording');

        document.querySelector('.record-text').textContent = '录音已完成';
        document.querySelector('.record-hint').textContent = '录音已保存，可以开始转录';
    }
}

// 开始录音计时器
function startRecordingTimer() {
    recordingSeconds = 0;
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        updateRecordingTime();
    }, 1000);
}

// 停止录音计时器
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

// 更新录音时间显示
function updateRecordingTime() {
    const minutes = Math.floor(recordingSeconds / 60);
    const seconds = recordingSeconds % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const recordingTimeEl = document.getElementById('recordingTime');
    if (recordingTimeEl) {
        recordingTimeEl.textContent = timeString;
    }
}

// 开始音频可视化
function startAudioVisualization() {
    const canvas = document.getElementById('audioCanvas');
    if (!canvas || !analyser || !dataArray) return;

    const ctx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    function draw() {
        if (!isRecording) return;

        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        // 清空画布
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        // 设置可视化样式
        const barWidth = (WIDTH / dataArray.length) * 2.5;
        let barHeight;
        let x = 0;

        // 绘制频率柱状图
        for (let i = 0; i < dataArray.length; i++) {
            barHeight = dataArray[i] * (HEIGHT / 256);

            // 创建渐变色
            const gradient = ctx.createLinearGradient(0, HEIGHT - barHeight, 0, HEIGHT);
            gradient.addColorStop(0, '#2563eb');
            gradient.addColorStop(1, '#818cf8');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    draw();
}

// 停止音频可视化
function stopAudioVisualization() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // 清空画布
    const canvas = document.getElementById('audioCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// 修改音频上传区域的显示逻辑，使其与录音功能兼容
function updateAudioUploadArea() {
    const audioFileInfo = document.getElementById('audioFileInfo');
    const audioDropZone = document.getElementById('audioDropZone');
    const uploadAudioArea = document.getElementById('uploadAudioArea');

    if (selectedAudioFile && audioFileInfo && audioDropZone) {
        // 如果选择了文件（包括录音文件），显示文件信息
        audioFileInfo.style.display = 'flex';
        audioDropZone.style.display = 'none';

        // 更新文件信息显示
        document.getElementById('audioFileName').textContent = selectedAudioFile.name;
        document.getElementById('audioFileSize').textContent = formatFileSize(selectedAudioFile.size);
    } else {
        // 如果没有选择文件，显示上传区域
        if (audioFileInfo) audioFileInfo.style.display = 'none';
        if (audioDropZone) audioDropZone.style.display = 'block';
    }
}

// 修改现有的音频上传逻辑，使其与录音功能兼容
function handleAudioFileSelect(file) {
    // 验证文件类型
    const allowedTypes = [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac',
        'audio/ogg', 'audio/webm', 'audio/amr', 'audio/3gpp'
    ];

    const isValidType = allowedTypes.some(type =>
        file.type.includes(type) ||
        file.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i)
    );

    if (!isValidType) {
        alert('请选择音频格式的文件（mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp）');
        return;
    }

    // 验证文件大小（限制为10MB）
    if (file.size > 10 * 1024 * 1024) {
        alert('音频文件大小不能超过10MB');
        return;
    }

    selectedAudioFile = file;

    // 更新UI显示
    updateAudioUploadArea();
}

// 修改现有的音频文件移除逻辑
document.getElementById('audioFileRemoveBtn').addEventListener('click', function() {
    selectedAudioFile = null;
    const audioFileInput = document.getElementById('audioFileInput');
    if (audioFileInput) audioFileInput.value = '';

    // 隐藏录音预览
    const audioPreviewContainer = document.getElementById('audioPreviewContainer');
    if (audioPreviewContainer) audioPreviewContainer.style.display = 'none';

    // 更新UI
    updateAudioUploadArea();
});

// 在页面初始化时调用录音功能初始化
document.addEventListener('DOMContentLoaded', function() {
    // ... 其他初始化代码 ...

    // 初始化录音功能
    initializeRecording();

    // 修改现有的音频上传初始化，使其与录音功能兼容
    if (typeof initializeAudioUpload === 'function') {
        // 重新初始化音频上传以应用修改后的逻辑
        initializeAudioUpload();
    }
});