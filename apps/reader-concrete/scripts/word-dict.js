// ============================================================
//  WORD DICTIONARY & TRANSLATION (dictionaryapi + MyMemory + Baidu Worker)
//  Progressive display: first result shows immediately, others merge in background
// ============================================================

// Cache for dictionary results (in-memory)
var dictionaryCache = {};

// localStorage key for persistent dictionary cache
const DICTIONARY_CACHE_LS_KEY = 'word_dictionary_cache_v1';

// Maximum entries in persistent cache (to prevent localStorage quota issues)
const MAX_CACHE_ENTRIES = 500;

// Load dictionary cache from localStorage on startup
function loadDictionaryCacheFromLS() {
  try {
    var stored = localStorage.getItem(DICTIONARY_CACHE_LS_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      // Validate structure and merge into memory cache
      for (var word in parsed) {
        if (parsed.hasOwnProperty(word) && parsed[word] && parsed[word].word) {
          dictionaryCache[word] = parsed[word];
        }
      }
      console.log('[WordDict] Loaded', Object.keys(dictionaryCache).length, 'entries from localStorage');
    }
  } catch (e) {
    console.warn('[WordDict] Failed to load cache from localStorage:', e.message);
    // If corrupted, clear it
    try { localStorage.removeItem(DICTIONARY_CACHE_LS_KEY); } catch (_) {}
  }
}

// Save dictionary cache to localStorage (with LRU eviction)
function saveDictionaryCacheToLS() {
  try {
    var entries = Object.keys(dictionaryCache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      // Simple LRU: keep the most recently added (last MAX_CACHE_ENTRIES)
      var toKeep = entries.slice(-MAX_CACHE_ENTRIES);
      var newCache = {};
      toKeep.forEach(function(k) { newCache[k] = dictionaryCache[k]; });
      dictionaryCache = newCache;
    }
    localStorage.setItem(DICTIONARY_CACHE_LS_KEY, JSON.stringify(dictionaryCache));
  } catch (e) {
    console.warn('[WordDict] Failed to save cache to localStorage:', e.message);
    // If quota exceeded, try to clear old entries and retry
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      try {
        var entries = Object.keys(dictionaryCache);
        var toKeep = entries.slice(-Math.floor(MAX_CACHE_ENTRIES / 2));
        var newCache = {};
        toKeep.forEach(function(k) { newCache[k] = dictionaryCache[k]; });
        dictionaryCache = newCache;
        localStorage.setItem(DICTIONARY_CACHE_LS_KEY, JSON.stringify(dictionaryCache));
      } catch (_) {
        // Give up
      }
    }
  }
}

// Initialize: load cache from localStorage
loadDictionaryCacheFromLS();

// API constants
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';
const BAIDU_WORKER_URL = 'https://baidu-translate.wangmc1024.workers.dev';
// NOTE: Baidu direct API is removed in favor of worker (no keys, no 302s)
// const BAIDU_API_URL = 'https://fanyi-api.baidu.com/api/v2/trans/vip/translate';
// const BAIDU_APPID = '20260807002660795';
// const BAIDU_SECRET_KEY = 'eKPm9JF0baSRUVXbyDD9';

/**
 * Fetch word dictionary from dictionaryapi.dev
 * Returns: { word, phonetic_us, phonetic_uk, audio_us, audio_uk, meanings: [{pos, definition, example, example_trans}] }
 */
function fetchWordFromDictionaryAPI(word) {
  return fetchWithTimeout(
    DICTIONARY_API_URL + encodeURIComponent(word.toLowerCase()),
    { method: 'GET' },
    6000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (!Array.isArray(data) || data.length === 0) throw new Error('No entries found');
    var entry = data[0];
    var result = {
      source: 'dictionary',
      word: entry.word || word,
      phonetic_us: null,
      phonetic_uk: null,
      audio_us: null,
      audio_uk: null,
      meanings: []
    };

    // Phonetics
    if (entry.phonetics) {
      entry.phonetics.forEach(function(p) {
        if (p.text && !result.phonetic_us) result.phonetic_us = p.text;
        if (p.text && p.tag === 'UK' && !result.phonetic_uk) result.phonetic_uk = p.text;
        if (p.audio && p.tag === 'US' && !result.audio_us) result.audio_us = p.audio;
        if (p.audio && p.tag === 'UK' && !result.audio_uk) result.audio_uk = p.audio;
      });
    }
    // Fallback: text-only phonetics
    if (!result.phonetic_us && entry.phonetic) result.phonetic_us = entry.phonetic;

    // Meanings
    if (entry.meanings) {
      entry.meanings.forEach(function(m) {
        if (!m.definitions || m.definitions.length === 0) return;
        var def = m.definitions[0];
        var meaning = {
          pos: m.partOfSpeech || '',
          definition: def.definition || '',
          example: def.example || null,
          example_trans: null,
          translation: null
        };
        result.meanings.push(meaning);
      });
    }

    if (result.meanings.length === 0) throw new Error('No meanings found');
    return result;
  }).catch(function(e) {
    console.log('DictionaryAPI error:', e.message);
    return null;
  });
}

/**
 * Fetch word translation from MyMemory API
 * Returns: plain text translation string or null
 */
function fetchWordFromMyMemory(word) {
  return fetchWithTimeout(
    MYMEMORY_API_URL + '?q=' + encodeURIComponent(word) + '&langpair=en|zh',
    { method: 'GET' },
    6000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (data.responseStatus === '200' && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText.trim();
    }
    return null;
  }).catch(function(e) {
    console.log('MyMemory API error:', e.message);
    return null;
  });
}

/**
 * Fetch word translation from Baidu Worker
 * Returns: plain text translation string or null
 */
function fetchWordFromBaidu(word) {
  // Use the worker endpoint: https://baidu-translate.wangmc1024.workers.dev
  var formData = new URLSearchParams();
  formData.append('q', word);
  formData.append('from', 'auto');
  formData.append('to', 'zh');

  return fetchWithTimeout(
    'https://baidu-translate.wangmc1024.workers.dev',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    },
    6000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    // Worker returns format: { success: true, data: { from: 'en', to: 'zh', trans_result: [{ src: 'hello', dst: '你好' }] } }
    if (data && data.success && data.data && data.data.trans_result && data.data.trans_result[0] && data.data.trans_result[0].dst) {
      return data.data.trans_result[0].dst.trim();
    }
    return null;
  }).catch(function(e) {
    console.log('Baidu Worker error:', e.message);
    return null;
  });
}

/**
 * Fetch word translation from Silicon Flow API (final fallback)
 */
function fetchWordFromSiliconFlow(word) {
  return fetchWithTimeout(
    SILICON_FLOW_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SILICON_FLOW_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: SILICON_FLOW_MODEL,
        messages: [
          { role: 'system', content: 'You are a professional translator. Translate this single word accurately. Only output the translation, nothing else.' },
          { role: 'user', content: 'Translate the following English text into natural Simplified Chinese. Only output the translation, nothing else:\n\n' + word }
        ],
        max_tokens: 128,
        temperature: 0.3,
        top_p: 0.9
      })
    },
    10000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (data.choices && data.choices[0] && data.choices[0].message) {
      var result = data.choices[0].message.content.trim();
      if (result && result !== word && result.indexOf('ERROR') === -1) {
        return result;
      }
    }
    return null;
  }).catch(function(e) {
    console.log('Silicon Flow API error:', e.message);
    return null;
  });
}

/**
 * Fetch word translation from Cloudflare Worker
 */
function fetchWordFromCloudflare(word) {
  return fetchWithTimeout(
    CLOUDFLARE_WORKER_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word, source: 'en', target: 'zh' })
    },
    8000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (data && (data.translation || data.text)) {
      return data.translation || data.text;
    }
    return null;
  }).catch(function(e) {
    console.log('Cloudflare Worker error:', e.message);
    return null;
  });
}

/**
 * Progressive word fetch: launches all 5 APIs in parallel,
 * calls onUpdate(result) each time any API returns,
 * so the UI updates incrementally (translation first, then dictionary details).
 *
 * @param {string} word - the word to look up
 * @param {function} onUpdate - called with merged result every time data arrives
 * @param {AbortSignal} [signal] - to cancel on word change / mouseout
 * @returns {Promise} resolves when all APIs have settled
 */
async function fetchWordDictionaryProgressive(word, onUpdate, signal) {
  // Check cache first — instant display
  if (dictionaryCache[word]) {
    onUpdate(dictionaryCache[word]);
    return dictionaryCache[word];
  }

  // Accumulate results as they arrive — translation APIs return strings, dictionary API returns rich objects
  var dict = null, baidu = null, memory = null, cloudflare = null, silicon = null;
  var settled = 0;
  var total = 5;
  var lastSentResult = null; // tracks what we last sent to onUpdate, to avoid duplicates

  function checkAborted() {
    return signal && signal.aborted;
  }

  function tryUpdate() {
    if (checkAborted()) return;
    var result = buildMergedResult(word, dict, baidu, memory, cloudflare, silicon);
    // Progressive rendering: show first valid result, don't replace once set.
    // Final merged result (with best translation + dictionary enrichment) is rendered
    // after all APIs settle in onOneResult().
    if (result && !lastSentResult) {
      lastSentResult = result;
      onUpdate(result);
    }
  }

  function onOneResult(value) {
    settled++;
    if (checkAborted()) return;
    // Progressive: show first result (already handled in tryUpdate above).
    // Final: when all APIs settle, build the complete merged result and render it.
    if (settled >= total) {
      var final = buildMergedResult(word, dict, baidu, memory, cloudflare, silicon);
      if (final) {
        if (lastSentResult) {
          // Replace the progressive result with the full merged result
          onUpdate(final);
        }
        dictionaryCache[word] = final;
        saveDictionaryCacheToLS();
      }
    }
  }

  // Launch all 5 in parallel — each resolves independently.
  // IMPORTANT: translation APIs (Baidu, MyMemory, Cloudflare, Silicon) return strings.
  // dictionaryapi returns a rich object or null.
  fetchWordFromDictionaryAPI(word).then(function(r) { dict = r; onOneResult(r); }).catch(function() { settled++; onOneResult(null); });
  fetchWordFromBaidu(word).then(function(r) { baidu = r; onOneResult(r); }).catch(function() { settled++; onOneResult(null); });
  fetchWordFromMyMemory(word).then(function(r) { memory = r; onOneResult(r); }).catch(function() { settled++; onOneResult(null); });
  fetchWordFromCloudflare(word).then(function(r) { cloudflare = r; onOneResult(r); }).catch(function() { settled++; onOneResult(null); });
  fetchWordFromSiliconFlow(word).then(function(r) { silicon = r; onOneResult(r); }).catch(function() { settled++; onOneResult(null); });
}

/**
 * Legacy sync wrapper — waits for all APIs (used by non-tooltip callers).
 */
async function fetchWordDictionary(word) {
  if (dictionaryCache[word]) return dictionaryCache[word];

  const [dict, baidu, memory, cloudflare, silicon] = await Promise.allSettled([
    fetchWordFromDictionaryAPI(word),
    fetchWordFromBaidu(word),
    fetchWordFromMyMemory(word),
    fetchWordFromCloudflare(word),
    fetchWordFromSiliconFlow(word)
  ]);

  var finalResult = buildMergedResult(
    word,
    dict.status === 'fulfilled' ? dict.value : null,
    baidu.status === 'fulfilled' ? baidu.value : null,
    memory.status === 'fulfilled' ? memory.value : null,
    cloudflare.status === 'fulfilled' ? cloudflare.value : null,
    silicon.status === 'fulfilled' ? silicon.value : null
  );

  dictionaryCache[word] = finalResult;
  return finalResult;
}

/**
 * Build a merged result from all available API responses.
 * Supports INCREMENTAL updates: can build from translation-only when dict is unavailable,
 * or enhance translation result when dictionary joins in later.
 *
 * Priority: dictionaryapi.dev (rich) > Silicon Flow > Baidu > MyMemory > Cloudflare
 */
function buildMergedResult(word, dict, baidu, memory, cloudflare, silicon) {
  // Silicon Flow is preferred for translation quality — overrides free APIs when available
  var translation = silicon || baidu || memory || cloudflare;
  var hasTranslation = translation && translation.trim();

  // Case 1: We have dictionary data (rich)
  if (dict && dict.meanings && dict.meanings.length > 0) {
    // Merge translation into the dictionary if available
    if (hasTranslation) {
      dict.meanings.forEach(function(meaning) {
        if (!meaning.translation) {
          meaning.translation = translation.trim();
        }
      });
    }
    dict.source = 'merged';
    if (silicon) dict.source += '+SiliconFlow';
    else if (baidu) dict.source += '+Baidu';
    else if (memory) dict.source += '+MyMemory';
    return dict;
  }

  // Case 2: We have translation but NO dictionary yet - return translation-only result
  // This allows immediate display of Chinese translation
  if (hasTranslation) {
    var source = 'siliconflow';
    if (!silicon && baidu) source = 'baidu';
    else if (!silicon && !baidu && memory) source = 'mymemory';
    else if (!silicon && !baidu && !memory && cloudflare) source = 'cloudflare';

    // Build a translation-only result (will be enhanced later when dict arrives)
    var result = {
      source: source,
      word: word,
      phonetic_us: null,
      phonetic_uk: null,
      audio_us: null,
      audio_uk: null,
      meanings: [{
        pos: 'translation',
        definition: translation.trim(),
        example: null,
        translation: translation.trim()
      }]
    };
    return result;
  }

  // No data at all
  return null;
}

/**
 * Format dictionary result for display in tooltip
 */
function formatWordDictionaryHTML(result) {
  if (!result) {
    return '<span class="tooltip-loading">暂无释义</span>';
  }

  var html = '<div class="dict-word">' + escapeHtml(result.word) + '</div>';

  // Add phonetics if available
  if (result.phonetic_us || result.phonetic_uk) {
    var phoneticParts = [];
    if (result.phonetic_us) phoneticParts.push('<span class="dict-phonetic us">' + escapeHtml(result.phonetic_us) + '</span>');
    if (result.phonetic_uk) phoneticParts.push('<span class="dict-phonetic uk">' + escapeHtml(result.phonetic_uk) + '</span>');
    if (phoneticParts.length > 0) {
      html += '<div class="dict-phonetics">' + phoneticParts.join('') + '</div>';
    }
  }

  // Add audio buttons if available
  if (result.audio_us || result.audio_uk) {
    var audioParts = [];
    if (result.audio_us) {
      audioParts.push('<button class="dict-audio-btn" onclick="playWordAudio(\'' + result.audio_us.replace(/'/g, "\\'") + '\')" title="美音发音">A</button>');
    }
    if (result.audio_uk) {
      audioParts.push('<button class="dict-audio-btn" onclick="playWordAudio(\'' + result.audio_uk.replace(/'/g, "\\'") + '\')" title="英音发音">B</button>');
    }
    if (audioParts.length > 0) {
      html += '<div class="dict-audio">' + audioParts.join('') + '</div>';
    }
  }

  // Add meanings
  html += '<div class="dict-meanings">';
  var i2;
  for (i2 = 0; i2 < result.meanings.length; i2++) {
    var meaning = result.meanings[i2];
    html += '<div class="dict-meaning">';
    html += '<span class="dict-pos">' + escapeHtml(meaning.pos) + '</span>';
    html += '<span class="dict-def">' + escapeHtml(meaning.definition) + '</span>';

    if (meaning.translation) {
      html += '<span class="dict-trans">译: ' + escapeHtml(meaning.translation) + '</span>';
    }

    if (meaning.example) {
      html += '<span class="dict-example">"' + escapeHtml(meaning.example) + '</span>';
      if (meaning.example_trans) {
        html += '<span class="dict-example-trans">' + escapeHtml(meaning.example_trans) + '</span>';
      }
    }
    html += '</div>';
  }
  html += '</div>';

  // Source indicator
  var sourceText = 'Dictionary';
  if (result.source === 'baidu') sourceText = '百度翻译';
  else if (result.source === 'mymemory') sourceText = 'MyMemory';
  else if (result.source === 'cloudflare') sourceText = 'DeepLX';
  else if (result.source === 'siliconflow') sourceText = 'SiliconFlow';
  else if (result.source.includes('merged')) sourceText = result.source.replace('merged', '词典').replace('+Baidu', ' + 百度');
  html += '<div class="dict-source">' + sourceText + '</div>';

  return html;
}

/**
 * Play pronunciation audio
 */
function playWordAudio(audioUrl) {
  if (!audioUrl) return;
  var audio = new Audio(audioUrl);
  audio.play().catch(function(e) { console.log('Audio play failed:', e); });
}
