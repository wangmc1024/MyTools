// ============================================================
//  WORD DICTIONARY & TRANSLATION (dictionaryapi + MyMemory)
//  Progressive display: first result shows immediately, others merge in background
// ============================================================

// Cache for dictionary results
var dictionaryCache = {};

// API constants
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';

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
 * Progressive word fetch: parallel all 4 APIs, show first result immediately,
 * then merge in additional results from other APIs.
 */
async function fetchWordDictionary(word) {
  // Check cache first
  if (dictionaryCache[word]) return dictionaryCache[word];

  // Launch all 4 API calls in parallel
  const dictPromise     = fetchWordFromDictionaryAPI(word);
  const memoryPromise   = fetchWordFromMyMemory(word);
  const cloudflarePromise = fetchWordFromCloudflare(word);
  const siliconPromise  = fetchWordFromSiliconFlow(word);

  // Wait for ALL results
  const [dictResult, memoryResult, cloudflareResult, siliconResult] =
    await Promise.allSettled([dictPromise, memoryPromise, cloudflarePromise, siliconPromise]);

  const dict = dictResult.status === 'fulfilled' ? dictResult.value : null;
  const memory = memoryResult.status === 'fulfilled' ? memoryResult.value : null;
  const cloudflare = cloudflareResult.status === 'fulfilled' ? cloudflareResult.value : null;
  const silicon = siliconResult.status === 'fulfilled' ? siliconResult.value : null;

  // Build final merged result
  var finalResult = buildMergedResult(word, dict, memory, cloudflare, silicon);

  // Cache it
  dictionaryCache[word] = finalResult;
  return finalResult;
}

/**
 * Build a merged result from all available API responses.
 * Priority: dictionaryapi.dev (rich) > MyMemory > Cloudflare > Silicon Flow
 */
function buildMergedResult(word, dict, memory, cloudflare, silicon) {
  // If we have rich dictionary data, merge translation into it
  if (dict && dict.meanings.length > 0) {
    var translation = memory || cloudflare || silicon;
    if (translation && translation.trim()) {
      dict.meanings.forEach(function(meaning) {
        if (!meaning.translation) {
          meaning.translation = translation.trim();
        }
      });
    }
    dict.source = 'merged';
    return dict;
  }

  // No dictionary data — build from translation sources
  var translation = memory || cloudflare || silicon;
  if (translation && translation.trim()) {
    var source = 'mymemory';
    if (cloudflare && !memory) source = 'cloudflare';
    if (silicon && !memory && !cloudflare) source = 'siliconflow';
    return {
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
  }

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
  if (result.source === 'mymemory') sourceText = 'MyMemory';
  else if (result.source === 'cloudflare') sourceText = 'DeepLX';
  else if (result.source === 'siliconflow') sourceText = 'SiliconFlow';
  else if (result.source === 'merged') sourceText = 'Merged';
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
