// ============================================================
//  TRANSLATION (Silicon Flow API primary, Cloudflare Worker fallback)
// ============================================================

function createTranslationRecord(key, text, lang, value) {
  return { key: key, source: text, lang: lang, value: value, updatedAt: Date.now() };
}

async function saveTranslation(store, key, text, lang, value) {
  if (!isValidTranslation(value)) return false;
  try { await dbPut(store, createTranslationRecord(key, text, lang, value)); return true; }
  catch (e) { console.warn('Failed to cache translation:', e); return false; }
}

async function readCachedTranslation(store, key, text, lang, cache) {
  try {
    var stored = await dbGet(store, key);
    if (stored && isValidTranslation(stored.value)) {
      cache[key] = stored.value;
      if (stored.source !== text || stored.lang !== lang) { saveTranslation(store, key, text, lang, stored.value); }
      return stored.value;
    }
    if (stored) await dbDelete(store, key);
  } catch (e) { console.warn('Failed to read translation cache:', e); }
  return null;
}

function cleanCache(cache) {
  var keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    keys.slice(0, keys.length - MAX_CACHE_ENTRIES).forEach(function(key) { delete cache[key]; });
  }
}

function buildTranslationPrompt(text, lang) {
  if (lang === 'zh') {
    return 'Translate the following Chinese text into natural English. Only output the translation, nothing else:\n\n' + text;
  }
  return 'Translate the following English text into natural Simplified Chinese. Only output the translation, nothing else:\n\n' + text;
}

async function translateWithModel(apiUrl, apiKey, model, text, lang) {
  var prompt = buildTranslationPrompt(text.substring(0, 1500), lang);
  var resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are a professional translator. Translate accurately and naturally. Only output the translation.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2048,
      temperature: 0.3,
      top_p: 0.9
    })
  });
  if (!resp.ok) throw new Error('API error: HTTP ' + resp.status);
  var data = await resp.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  throw new Error('Unexpected response format');
}

async function translateTextWithFallback(text, lang) {
  var pair = getLangPair(lang);
  var sourceCode = lang === 'zh' ? 'zh' : 'en';
  var targetCode = lang === 'zh' ? 'en' : 'zh';

  // 1st: Silicon Flow API (Hunyuan-MT-7B)
  try {
    var result = await translateWithModel(SILICON_FLOW_API_URL, SILICON_FLOW_API_KEY, SILICON_FLOW_MODEL, text, lang);
    if (isValidTranslation(result)) return result;
  } catch(e) {
    console.log('Silicon Flow API error:', e);
  }

  // 2nd: Cloudflare Worker fallback
  try {
    var resp = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 1500), source: sourceCode, target: targetCode })
    });
    if (resp.ok) {
      var data = await resp.json();
      if (data && (data.translation || data.text)) {
        return data.translation || data.text;
      }
    }
  } catch(e) {
    console.log('Cloudflare Worker error:', e);
  }

  return null;
}

async function translateWordWithFallback(word, lang) {
  var sourceCode = lang === 'zh' ? 'zh' : 'en';
  var targetCode = lang === 'zh' ? 'en' : 'zh';

  // 1st: Silicon Flow API
  try {
    var prompt = buildTranslationPrompt(word, lang);
    var resp = await fetch(SILICON_FLOW_API_URL, {
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
          { role: 'user', content: prompt }
        ],
        max_tokens: 128,
        temperature: 0.3,
        top_p: 0.9
      })
    });
    if (resp.ok) {
      var data = await resp.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        var result = data.choices[0].message.content.trim();
        if (isValidTranslation(result)) return result;
      }
    }
  } catch(e) {
    console.log('Silicon Flow word API error:', e);
  }

  // 2nd: Cloudflare Worker fallback
  try {
    var resp = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word, source: sourceCode, target: targetCode })
    });
    if (resp.ok) {
      var data = await resp.json();
      if (data && (data.translation || data.text)) {
        var result = data.translation || data.text;
        if (isValidTranslation(result)) return result;
      }
    }
  } catch(e) {
    console.log('Cloudflare word worker error:', e);
  }

  return null;
}

async function translateText(text, lang) {
  lang = lang || currentArticleLang;
  var cacheKey = lang + '|' + text.trim();

  // Check memory cache
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  // Check IndexedDB
  var cachedTranslation = await readCachedTranslation('translations', cacheKey, text, lang, translationCache);
  if (cachedTranslation) return cachedTranslation;

  // Attempt online translation
  var result = await translateTextWithFallback(text, lang);
  if (result && isValidTranslation(result)) {
    translationCache[cacheKey] = result;
    saveTranslation('translations', cacheKey, text, lang, result);
    cleanCache(translationCache);
    return result;
  }

  return '翻译失败';
}

async function translateWord(word, lang) {
  lang = lang || currentArticleLang;
  var cacheKey = lang + '|' + (lang === 'zh' ? word : word.toLowerCase());

  if (wordCache[cacheKey]) return wordCache[cacheKey];

  var cachedWord = await readCachedTranslation('wordTranslations', cacheKey, word, lang, wordCache);
  if (cachedWord) return cachedWord;

  var result = await translateWordWithFallback(word, lang);
  if (result && isValidTranslation(result)) {
    wordCache[cacheKey] = result;
    saveTranslation('wordTranslations', cacheKey, word, lang, result);
    cleanCache(wordCache);
    return result;
  }

  return '无译文';
}
