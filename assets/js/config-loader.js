/**
 * Global API Configuration Loader
 *
 * Synchronously loads assets/data/api-config.json at page load and exposes
 * all values as global variables so apps can reference them immediately.
 *
 * Loading order in each app's HTML must be:
 *   1. config-loader.js  (this file — blocks until config is loaded)
 *   2. app-specific config.js / translation.js etc.
 */
(function () {
    'use strict';

    function _resolvePath() {
        // From any app's index.html, go up two levels to project root
        return '../../assets/data/api-config.json';
    }

    function _loadSync() {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', _resolvePath(), false); // false = synchronous
            xhr.send();
            if (xhr.status >= 200 && xhr.status < 300) {
                return JSON.parse(xhr.responseText);
            }
            console.warn('[configLoader] Failed to load config (HTTP ' + xhr.status + '), using defaults');
            return {};
        } catch (e) {
            console.warn('[configLoader] Error loading config:', e.message, '— using defaults');
            return {};
        }
    }

    var config = _loadSync();

    // Apply to window globals (must run BEFORE any app script that reads these)
    // Silicon Flow general
    if (config.silicon_flow) {
        if (typeof config.silicon_flow.api_key !== 'undefined') window.SILICON_FLOW_API_KEY = config.silicon_flow.api_key;
        if (typeof config.silicon_flow.api_url !== 'undefined') window.SILICON_FLOW_API_URL = config.silicon_flow.api_url;
        if (typeof config.silicon_flow.model !== 'undefined') window.SILICON_FLOW_MODEL = config.silicon_flow.model;
    }
    // Silicon Flow STT
    if (config.silicon_flow_stt) {
        if (typeof config.silicon_flow_stt.default_api_key !== 'undefined') window.SILICON_FLOW_STT_API_KEY = config.silicon_flow_stt.default_api_key;
    }
    // Edge TTS
    if (config.edge_tts) {
        if (typeof config.edge_tts.url !== 'undefined') window.TTS_API_URL = config.edge_tts.url;
        if (typeof config.edge_tts.fallback_url !== 'undefined') window.TTS_API_URL_FALLBACK = config.edge_tts.fallback_url;
        var ttsUrls = [];
        if (config.edge_tts.url) ttsUrls.push(config.edge_tts.url);
        if (config.edge_tts.fallback_url) ttsUrls.push(config.edge_tts.fallback_url);
        if (ttsUrls.length > 0) window.TTS_API_URLS = ttsUrls;
    }
    // Cloudflare Worker
    if (config.cloudflare_worker && typeof config.cloudflare_worker.url !== 'undefined') {
        window.CLOUDFLARE_WORKER_URL = config.cloudflare_worker.url;
    }
    // DeepLX worker (used by article-reader and reader-concrete)
    if (config.deeplx_worker && typeof config.deeplx_worker.url !== 'undefined') {
        window.CLOUDFLARE_WORKER_URL = config.deeplx_worker.url;
    }
    // Timeout
    if (typeof config.edge_tts_timeout !== 'undefined') window.EDGE_TTS_TIMEOUT = config.edge_tts_timeout;

    // Also expose as configLoader object for programmatic access
    window.configLoader = {
        get: function () { return config; },
        reload: function () { config = _loadSync(); _applyAgain(config); return config; }
    };

    function _applyAgain(c) {
        if (c.silicon_flow) {
            if (typeof c.silicon_flow.api_key !== 'undefined') window.SILICON_FLOW_API_KEY = c.silicon_flow.api_key;
            if (typeof c.silicon_flow.api_url !== 'undefined') window.SILICON_FLOW_API_URL = c.silicon_flow.api_url;
            if (typeof c.silicon_flow.model !== 'undefined') window.SILICON_FLOW_MODEL = c.silicon_flow.model;
        }
        if (c.silicon_flow_stt) {
            if (typeof c.silicon_flow_stt.default_api_key !== 'undefined') window.SILICON_FLOW_STT_API_KEY = c.silicon_flow_stt.default_api_key;
        }
        if (c.edge_tts) {
            if (typeof c.edge_tts.url !== 'undefined') window.TTS_API_URL = c.edge_tts.url;
            if (typeof c.edge_tts.fallback_url !== 'undefined') window.TTS_API_URL_FALLBACK = c.edge_tts.fallback_url;
            var urls = [];
            if (c.edge_tts.url) urls.push(c.edge_tts.url);
            if (c.edge_tts.fallback_url) urls.push(c.edge_tts.fallback_url);
            if (urls.length > 0) window.TTS_API_URLS = urls;
        }
        if (c.deeplx_worker && typeof c.deeplx_worker.url !== 'undefined') window.CLOUDFLARE_WORKER_URL = c.deeplx_worker.url;
        if (c.cloudflare_worker && typeof c.cloudflare_worker.url !== 'undefined') window.CLOUDFLARE_WORKER_URL = c.cloudflare_worker.url;
        if (typeof c.edge_tts_timeout !== 'undefined') window.EDGE_TTS_TIMEOUT = c.edge_tts_timeout;
    }
})();
