// ============================================================
//  TRANSLATION (Silicon Flow API primary, Cloudflare Worker fallback)
// ============================================================
// Config values populated by config-loader.js from api-config.json
const SILICON_FLOW_API_KEY = window.SILICON_FLOW_API_KEY || '';
const SILICON_FLOW_API_URL = window.SILICON_FLOW_API_URL || '';
const SILICON_FLOW_MODEL = window.SILICON_FLOW_MODEL || 'tencent/Hunyuan-MT-7B';
const CLOUDFLARE_WORKER_URL = window.CLOUDFLARE_WORKER_URL || '';

function buildTranslationPrompt(text) {
  return 'Translate the following English text into natural Simplified Chinese. Only output the translation, nothing else:\n\n' + text;
}

async function translateWithModel(url, key, model, text) {
  const prompt = buildTranslationPrompt(text.substring(0, 1500));
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
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
  }, 15000);
  if (!resp.ok) throw new Error('API error: HTTP ' + resp.status);
  const data = await resp.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  throw new Error('Unexpected response format');
}

async function translateTextFallback(text) {
  // 1st: Silicon Flow API (Hunyuan-MT-7B)
  try {
    const result = await translateWithModel(SILICON_FLOW_API_URL, SILICON_FLOW_API_KEY, SILICON_FLOW_MODEL, text);
    if (isValidTranslation(result)) return result;
  } catch(e) { console.log('Silicon Flow API error:', e.message); }

  // 2nd: Cloudflare Worker fallback
  try {
    const resp = await fetchWithTimeout(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 1500), source: 'en', target: 'zh' })
    }, 10000);
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.translation || data.text)) {
        return data.translation || data.text;
      }
    }
  } catch(e) { console.log('Cloudflare Worker error:', e.message); }

  return null;
}

async function translateWordFallback(word) {
  // 1st: Silicon Flow API
  try {
    const prompt = buildTranslationPrompt(word);
    const resp = await fetchWithTimeout(SILICON_FLOW_API_URL, {
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
    }, 10000);
    if (resp.ok) {
      const data = await resp.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const result = data.choices[0].message.content.trim();
        if (isValidTranslation(result)) return result;
      }
    }
  } catch(e) { console.log('Silicon Flow word API error:', e.message); }

  // 2nd: Cloudflare Worker fallback
  try {
    const resp = await fetchWithTimeout(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word, source: 'en', target: 'zh' })
    }, 8000);
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.translation || data.text)) {
        const result = data.translation || data.text;
        if (isValidTranslation(result)) return result;
      }
    }
  } catch(e) { console.log('Cloudflare word worker error:', e.message); }

  return null;
}

const translationCache = {};
const wordCache = {};

async function translateText(text) {
  const cacheKey = text.trim().substring(0, 200);
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  const lsKey = 'tr_' + cacheKey.replace(/[^a-zA-Z0-9]/g, function(c) { return c.charCodeAt(0).toString(16); }).substring(0, 50);
  const cached = lookupCache(translationCache, cacheKey, lsKey);
  if (cached) return cached;

  const result = await translateTextFallback(text);
  if (result && isValidTranslation(result)) {
    translationCache[cacheKey] = result;
    saveToLS(lsKey, result);
    return result;
  }

  return '翻译失败: 请检查网络连接';
}

async function translateWord(word) {
  const lowerWord = word.toLowerCase();
  if (wordCache[lowerWord]) return wordCache[lowerWord];

  const lsKey = 'wd_' + lowerWord;
  const cached = lookupCache(wordCache, lowerWord, lsKey);
  if (cached) return cached;

  const result = await translateWordFallback(word);
  if (result && isValidTranslation(result)) {
    wordCache[lowerWord] = result;
    saveToLS(lsKey, result);
    return result;
  }

  return '无译文';
}

// ============================================================
//  TRANSLATION TOGGLE
// ============================================================
function toggleTranslation(btn) {
  const card = btn.closest('.sentence-card');
  const zhArea = card.querySelector('.sentence-zh');
  const zhInner = card.querySelector('.sentence-zh-inner');
  const isShown = card.classList.contains('show-translation');

  if (isShown) {
    card.classList.remove('show-translation');
    btn.innerHTML = '<span>💬</span> 译';
  } else {
    card.classList.add('show-translation');
    btn.innerHTML = '<span>👁</span> 译';

    // Fetch translation if not already loaded and not currently loading
    if (!zhInner.dataset.loaded && !zhInner.dataset.loading) {
      zhInner.dataset.loading = 'true';
      const sentEn = card.querySelector('.sentence-en');
      const fullText = sentEn.textContent.replace(/💬|译|👁|🔈/gu, '').trim();
      translateText(fullText).then(trans => {
        zhInner.innerHTML = '<span>' + escapeHtml(trans) + '</span>';
        zhInner.dataset.loading = '';
        if (isValidTranslation(trans)) {
          zhInner.dataset.loaded = 'true';
        }
      }).catch(function() {
        zhInner.innerHTML = '<span style="color:#c0392b">翻译出错</span>';
        zhInner.dataset.loading = '';
      });
    }
  }
}

function toggleAllTranslations(articleIndex, btn) {
  const section = document.querySelectorAll('.article-section')[articleIndex];
  if (!section) return;
  const cards = section.querySelectorAll('.sentence-card');
  const anyHidden = Array.from(cards).some(function(c) { return !c.classList.contains('show-translation'); });

  if (anyHidden) {
    // Show all translations: expand UI first, then fetch translations sequentially
    var cardsToFetch = [];
    cards.forEach(function(card) {
      if (!card.classList.contains('show-translation')) {
        card.classList.add('show-translation');
        var toggle = card.querySelector('.translate-toggle');
        if (toggle) toggle.innerHTML = '<span>👁</span> 译';
        var zhInner = card.querySelector('.sentence-zh-inner');
        if (zhInner && !zhInner.dataset.loaded) {
          var sentEn = card.querySelector('.sentence-en');
          var fullText = sentEn.textContent.replace(/💬|译|👁|🔈/gu, '').trim();
          cardsToFetch.push({ zhInner: zhInner, text: fullText });
        }
      }
    });
    btn.innerHTML = '<span>👁</span> Hide All Translations';

    // Fetch translations sequentially with 300ms delay to avoid rate limiting
    if (cardsToFetch.length > 0) {
      (async function fetchSequentially() {
        for (var i = 0; i < cardsToFetch.length; i++) {
          var item = cardsToFetch[i];
          try {
            var trans = await translateText(item.text);
            item.zhInner.innerHTML = '<span>' + escapeHtml(trans) + '</span>';
            if (isValidTranslation(trans)) {
              item.zhInner.dataset.loaded = 'true';
            }
          } catch(e) {
            item.zhInner.innerHTML = '<span style="color:#c0392b">翻译出错</span>';
          }
          // Small delay between requests to avoid rate limiting
          if (i < cardsToFetch.length - 1) {
            await new Promise(function(r) { setTimeout(r, 300); });
          }
        }
      })();
    }
  } else {
    // Hide all translations
    cards.forEach(function(card) {
      if (card.classList.contains('show-translation')) {
        card.classList.remove('show-translation');
        var toggle = card.querySelector('.translate-toggle');
        if (toggle) toggle.innerHTML = '<span>💬</span> 译';
      }
    });
    btn.innerHTML = '<span>💬</span> Show All Translations';
  }
}
