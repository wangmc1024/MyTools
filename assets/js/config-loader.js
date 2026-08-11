/**
 * Global API Configuration Loader
 *
 * Loads assets/data/api-config.json at page load and exposes all values
 * as global variables (var) so apps can reference them in their config.js.
 *
 * Apps that had hardcoded keys/constants should declare:
 *   var SILICON_FLOW_API_KEY;        // will be overwritten by configLoader
 *   var SILICON_FLOW_API_URL;
 *   // ...etc
 * Then replace with the values from api-config.json after this script loads.
 *
 * Loading order in each app's HTML must be:
 *   1. config-loader.js  (this file)
 *   2. app-specific config.js / translation.js etc.
 */
(function () {
    'use strict';

    var _cached = null;

    function _resolvePath() {
        // From any app's index.html, go up two levels to project root
        return '../../assets/data/api-config.json';
    }

    window.configLoader = {
        get: function () { return _cached; },
        reload: function () { _cached = null; return this.load(); },
        load: function () {
            if (_cached) return Promise.resolve(_cached);
            return fetch(_resolvePath())
                .then(function (r) {
                    if (!r.ok) throw new Error('Failed to load api-config.json (HTTP ' + r.status + ')');
                    return r.json();
                })
                .then(function (data) {
                    _cached = data;
                    _applyToGlobals(data);
                    return data;
                })
                .catch(function (e) {
                    console.error('[configLoader] Error:', e.message);
                    _cached = {};
                    return _cached;
                });
        }
    };

    function _applyToGlobals(config) {
        // Silicon Flow general
        if (config.silicon_flow) {
            if (typeof config.silicon_flow.api_key !== 'undefined') window.SILICON_FLOW_API_KEY = config.silicon_flow.api_key;
            if (typeof config.silicon_flow.api_url !== 'undefined') window.SILICON_FLOW_API_URL = config.silicon_flow.api_url;
            if (typeof config.silicon_flow.model !== 'undefined') window.SILICON_FLOW_MODEL = config.silicon_flow.model;
        }
        // Silicon Flow STT
        if (config.silicon_flow_stt) {
            if (typeof config.silicon_flow_stt.default_api_key !== 'undefined') window.SILICON_FLOW_STT_API_KEY = config.silicon_flow_stt.default_api_key;
            if (typeof config.silicon_flow_stt.base_url !== 'undefined') window.SILICON_FLOW_STT_API_URL = config.silicon_flow_stt.base_url;
        }
        // Edge TTS
        if (config.edge_tts) {
            if (typeof config.edge_tts.url !== 'undefined') window.TTS_API_URL = config.edge_tts.url;
            if (typeof config.edge_tts.fallback_url !== 'undefined') window.TTS_API_URL_FALLBACK = config.edge_tts.fallback_url;
            // Build TTS_API_URLS array from url + fallback_url
            var urls = [];
            if (config.edge_tts.url) urls.push(config.edge_tts.url);
            if (config.edge_tts.fallback_url) urls.push(config.edge_tts.fallback_url);
            if (urls.length > 0) window.TTS_API_URLS = urls;
        }
        // Cloudflare Worker
        if (config.cloudflare_worker) {
            if (typeof config.cloudflare_worker.url !== 'undefined') window.CLOUDFLARE_WORKER_URL = config.cloudflare_worker.url;
        }
        // DeepLX worker (used by article-reader and reader-concrete)
        if (config.deeplx_worker) {
            if (typeof config.deeplx_worker.url !== 'undefined') window.CLOUDFLARE_WORKER_URL = config.deeplx_worker.url;
        }
        // Timeout
        if (typeof config.edge_tts_timeout !== 'undefined') window.EDGE_TTS_TIMEOUT = config.edge_tts_timeout;
    }

    // Auto-load on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { configLoader.load(); });
    } else {
        configLoader.load();
    }
})();
