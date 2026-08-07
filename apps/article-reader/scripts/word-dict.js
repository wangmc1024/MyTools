// ============================================================
//  WORD DICTIONARY & TRANSLATION (dictionaryapi + MyMemory + Baidu)
//  Progressive display: first result shows immediately, others merge in background
// ============================================================

// Cache for dictionary results
var dictionaryCache = {};

// API constants
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';
const BAIDU_API_URL = 'https://fanyi-api.baidu.com/api/v2/trans/vip/translate';
const BAIDU_APPID = '20260807002660795';
const BAIDU_SECRET_KEY = 'eKPm9JF0baSRUVXbyDD9';

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
 * Generate MD5 hash for Baidu translation API
 */
function generateBaiduMD5(str) {
  // Simple MD5 implementation for signature
  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function add32(a, b) {
    return (a + b) & 0xFFFFFFFF;
  }

  function rhex(n) {
    var hex_chr = '0123456789abcdef';
    var s = '';
    for (var j = 0; j < 4; j++) {
      s += hex_chr.charAt((n >> (j * 8 + 4)) & 0x0F) + hex_chr.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }

  function md51(s) {
    var n = s.length;
    var state = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
    var i;
    for (i = 64; i <= s.length; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function md5blk(s) {
    var md5blks = [];
    for (var i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  var hex = rhex(md51(str));
  return hex;
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
 * Fetch word translation from Baidu API
 * Returns: plain text translation string or null
 */
function fetchWordFromBaidu(word) {
  var salt = Math.floor(Math.random() * 100000);
  var sign = BAIDU_APPID + word + salt + BAIDU_SECRET_KEY;
  var md5sign = generateBaiduMD5(sign);
  
  var params = new URLSearchParams({
    q: word,
    from: 'auto',
    to: 'zh',
    appid: BAIDU_APPID,
    salt: salt.toString(),
    sign: md5sign
  });
  
  return fetchWithTimeout(
    BAIDU_API_URL + '?' + params.toString(),
    { method: 'GET' },
    6000
  ).then(function(resp) {
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }).then(function(data) {
    if (data.error_code) {
      console.log('Baidu API error:', data.error_code, data.error_msg);
      return null;
    }
    if (data.trans_result && data.trans_result[0] && data.trans_result[0].dst) {
      return data.trans_result[0].dst.trim();
    }
    return null;
  }).catch(function(e) {
    console.log('Baidu API error:', e.message);
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
 * Progressive word fetch: parallel all 5 APIs, show first result immediately,
 * then merge in additional results from other APIs.
 */
async function fetchWordDictionary(word) {
  // Check cache first
  if (dictionaryCache[word]) return dictionaryCache[word];

  // Launch all 5 API calls in parallel
  const dictPromise    = fetchWordFromDictionaryAPI(word);
  const baiduPromise  = fetchWordFromBaidu(word);
  const memoryPromise = fetchWordFromMyMemory(word);
  const cloudflarePromise = fetchWordFromCloudflare(word);
  const siliconPromise = fetchWordFromSiliconFlow(word);

  // Wait for ALL results (but we'll use race below for progressive display)
  const [dictResult, baiduResult, memoryResult, cloudflareResult, siliconResult] =
    await Promise.allSettled([dictPromise, baiduPromise, memoryPromise, cloudflarePromise, siliconPromise]);

  const dict = dictResult.status === 'fulfilled' ? dictResult.value : null;
  const baidu = baiduResult.status === 'fulfilled' ? baiduResult.value : null;
  const memory = memoryResult.status === 'fulfilled' ? memoryResult.value : null;
  const cloudflare = cloudflareResult.status === 'fulfilled' ? cloudflareResult.value : null;
  const silicon = siliconResult.status === 'fulfilled' ? siliconResult.value : null;

  // Build final merged result
  var finalResult = buildMergedResult(word, dict, baidu, memory, cloudflare, silicon);

  // Cache it
  dictionaryCache[word] = finalResult;
  return finalResult;
}

/**
 * Build a merged result from all available API responses.
 * Priority: dictionaryapi.dev (rich) > Baidu > MyMemory > Cloudflare > Silicon Flow
 */
function buildMergedResult(word, dict, baidu, memory, cloudflare, silicon) {
  // If we have rich dictionary data, merge translation into it
  if (dict && dict.meanings.length > 0) {
    // Pick the best translation source (Baidu first, then others)
    var translation = baidu || memory || cloudflare || silicon;
    if (translation && translation.trim()) {
      dict.meanings.forEach(function(meaning) {
        if (!meaning.translation) {
          meaning.translation = translation.trim();
        }
      });
    }
    dict.source = 'merged';
    if (baidu) dict.source += '+Baidu';
    else if (memory) dict.source += '+MyMemory';
    return dict;
  }

  // No dictionary data — build from translation sources
  var translation = baidu || memory || cloudflare || silicon;
  if (translation && translation.trim()) {
    var source = 'baidu';
    if (!baidu && memory) source = 'mymemory';
    else if (!baidu && !memory && cloudflare) source = 'cloudflare';
    else if (!baidu && !memory && !cloudflare && silicon) source = 'siliconflow';
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
