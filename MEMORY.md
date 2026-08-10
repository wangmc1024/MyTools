# MEMORY.md
- [API Configuration Centralized Management](assets/data/api-config.json) — 集中管理所有API密钥和端点

## API Configuration Centralized Management

### Configuration File Location
**`assets/data/api-config.json`** - Centralized management for all API keys, URLs, and endpoints

### How to Use

Load configuration in browser:

```javascript
// 1. Fetch config
async function getApiConfig() {
  const response = await fetch('./assets/data/api-config.json');
  return await response.json();
}

// 2. Use config
const config = await getApiConfig();

// 3. Access values
const SILICON_FLOW_API_KEY = config.silicon_flow.api_key;
const SILICON_FLOW_API_URL = config.silicon_flow.api_url;
const SILICON_FLOW_MODEL = config.silicon_flow.model;
```

### Configuration Structure

```json
{
  "silicon_flow": {
    "api_key": "your-api-key",
    "api_url": "API endpoint URL",
    "model": "default model name"
  },
  "cloudflare_worker": {
    "url": "Cloudflare Worker proxy URL"
  },
  "edge_tts": {
    "url": "Edge TTS service URL",
    "fallback_url": "Fallback TTS URL"
  },
  "dictionary_api": {
    "url": "Dictionary API URL"
  },
  "mymemory_api": {
    "url": "MyMemory translation API URL"
  },
  "baidu_worker": {
    "url": "Baidu Translate Cloudflare Worker URL"
  },
  "silicon_flow_stt": {
    "api_key": "Silicon Flow STT API key",
    "base_url": "STT service URL"
  }
}
```

### Currently Integrated Modules

| Application | File | APIs Used |
|-------------|------|----------|
| Article Reader | js/config.js | Silicon Flow Translation API |
| Article Reader | js/translation.js | Silicon Flow Translation API |
| Article Reader | scripts/word-dict.js | DictionaryAPI, MyMemory, Baidu Worker |
| English Learning Reader | scripts/translation.js | Silicon Flow Translation API |
| English Learning Reader | scripts/word-dict.js | Silicon Flow Word API, Cloudflare Worker |
| Talk2GeoGebra | app.js | Dynamic AI Model API (configure in settings) |
| VoiceCraft | assets/js/main.js | Edge TTS |
| VoiceCraft (Worker) | assets/js/cloudflare-worker-stt.js | Silicon Flow STT |

### Notes

- ChatOCR has its own independent API key management (via settings UI)
- All modules call `loadApiConfig()` on DOMContentLoaded to load centralized config
- Fallback values are preserved for backward compatibility
- API keys are no longer hardcoded in source files