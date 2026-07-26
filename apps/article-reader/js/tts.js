// ============================================================
//  EDGE-TTS CLOUD ENGINE
// ============================================================

/** Which active TTS endpoint to use (updated by probing on init) */
var _activeTtsUrl = TTS_API_URL;

async function edgeTTSSynthesize(text, opts) {
  opts = opts || {};
  var voice = opts.voice || EDGE_TTS_VOICE;
  var rate = opts.rate || speechRate;
  var timeout = opts.timeout || EDGE_TTS_TIMEOUT;

  var cacheKey = voice + '|' + rate + '|' + text.trim();
  if (ttsAudioCache.has(cacheKey)) return ttsAudioCache.get(cacheKey);

  // Use the probed active URL; try fallbacks if set
  var urls = [_activeTtsUrl];
  if (_activeTtsUrl !== TTS_API_URL) urls.push(TTS_API_URL);       // if _active is fallback, also try primary
  if (_activeTtsUrl !== TTS_API_URL_FALLBACK) urls.push(TTS_API_URL_FALLBACK);
  urls = urls.filter(function(u, i, a) { return a.indexOf(u) === i; }); // dedupe

  var lastError = null;

  for (var i = 0; i < urls.length; i++) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, timeout);

    try {
      var response = await fetch(urls[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          voice: voice,
          speed: rate,
          pitch: '0',
          style: 'general'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        var errText = await response.text().catch(function() { return 'HTTP ' + response.status; });
        throw new Error('TTS API error: ' + response.status + ' ' + errText);
      }

      var blob = await response.blob();
      if (blob.size === 0) throw new Error('TTS API returned empty audio');

      var url = URL.createObjectURL(blob);
      ttsAudioCache.set(cacheKey, url);
      evictOldestTTSCache();
      return url;
    } catch(e) {
      clearTimeout(timeoutId);
      lastError = e;
    }
  }

  throw lastError;
}

// ============================================================
//  TTS ENDPOINT PROBE — run on init to pick the best endpoint
// ============================================================

function probeTtsEndpoint(url) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: '.', voice: 'en-US-JennyNeural', speed: 1, pitch: '0', style: 'general' }),
    signal: AbortSignal.timeout(5000)
  }).then(function(r) {
    return r.ok;
  });
}

async function probeTTSEndpoints() {
  var endpoints = [
    { name: 'Edge-TTS-1', url: TTS_API_URL },
    { name: 'Edge-TTS-2', url: TTS_API_URL_FALLBACK }
  ];

  setEngineStatus('connecting', 'Probing TTS...');

  for (var i = 0; i < endpoints.length; i++) {
    var ep = endpoints[i];
    console.log('[TTS] Probing:', ep.name, ep.url);
    try {
      var ok = await probeTtsEndpoint(ep.url);
      if (ok) {
        _activeTtsUrl = ep.url;
        edgeTTSAvailable = true;
        setEngineStatus('cloud', 'Cloud TTS ✓');
        console.log('[TTS] Selected:', ep.name);
        return;
      }
      console.warn('[TTS] Failed:', ep.name, 'HTTP error');
    } catch(e) {
      console.warn('[TTS] Failed:', ep.name, e.message);
    }
  }

  // All cloud endpoints failed
  edgeTTSAvailable = false;
  setEngineStatus('system', 'System TTS');
  console.log('[TTS] All cloud endpoints failed, falling back to System TTS');
}

// ============================================================
//  SYSTEM TTS (Fallback)
// ============================================================

function loadVoices() {
  var voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  // Reset and select voice based on current article language
  selectedVoice = null;
  var langPrefix = currentArticleLang === 'zh' ? 'zh' : 'en';
  var priorities = [
    function(v) { return /natural/i.test(v.name) && new RegExp(langPrefix, 'i').test(v.lang); },
    function(v) { return /aria|jenny|guy|xiaoxiao|yunxi|tingting|meijia/i.test(v.name); },
    function(v) { return /google/i.test(v.name) && new RegExp(langPrefix, 'i').test(v.lang); },
    function(v) { return new RegExp(langPrefix, 'i').test(v.lang); }
  ];
  for (var i = 0; i < priorities.length; i++) {
    var found = voices.find(priorities[i]);
    if (found) { selectedVoice = found; break; }
  }
  if (!selectedVoice) selectedVoice = voices[0];
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function splitIntoChunks(text) {
  var segments = text.split(/([,.;:!?。！？；，、])/);
  var chunks = [];
  for (var i = 0; i < segments.length; i += 2) {
    var chunk = segments[i] || '';
    if (segments[i + 1]) chunk += segments[i + 1];
    chunk = chunk.trim();
    if (chunk) chunks.push(chunk);
  }
  if (chunks.length === 0) chunks.push(text);
  return chunks;
}

function getPauseMs(lastChar) {
  if (lastChar === '.' || lastChar === '。') return 120;
  if (lastChar === '!' || lastChar === '?' || lastChar === '！' || lastChar === '？') return 150;
  if (lastChar === ';' || lastChar === ':' || lastChar === '；' || lastChar === '：') return 90;
  if (lastChar === ',' || lastChar === '，' || lastChar === '、') return 80;
  return 50;
}

function speakSentenceSystem(btn, card, fullText) {
  card.setAttribute('data-engine', 'system');
  var chunks = splitIntoChunks(fullText);
  var chunkIdx = 0;
  var lang = currentArticleLang === 'zh' ? 'zh-CN' : 'en-US';

  function speakNext() {
    if (chunkIdx >= chunks.length) {
      cleanupSpeech();
      return;
    }
    var chunk = chunks[chunkIdx];
    var utter = new SpeechSynthesisUtterance(chunk);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = lang;
    utter.rate = speechRate;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    var pauseMs = getPauseMs(chunk[chunk.length - 1]);

    utter.onend = function() {
      chunkIdx++;
      if (chunkIdx < chunks.length) {
        setTimeout(speakNext, pauseMs);
      } else {
        cleanupSpeech();
      }
    };
    utter.onerror = function() { cleanupSpeech(); };
    currentUtterances.push(utter);
    window.speechSynthesis.speak(utter);
  }
  speakNext();
}

function cleanupSpeech() {
  if (currentSpeakerBtn) currentSpeakerBtn.classList.remove('playing', 'loading');
  if (currentCard) currentCard.classList.remove('reading');
  currentUtterances = [];
  currentSpeakerBtn = null;
  currentCard = null;
  document.getElementById('stopAudio').style.display = 'none';
}

// ============================================================
//  UNIFIED SPEAK (Cloud-first, System-fallback)
// ============================================================

function speakSentence(btn) {
  stopSpeech();
  var card = btn.closest('.sentence-card');
  var sentText = card.querySelector('.sentence-text');
  var fullText = sentText.textContent.trim();

  // Reload voices for current language
  loadVoices();

  currentSpeakerBtn = btn;
  currentCard = card;

  btn.classList.add('playing');
  card.classList.add('reading');
  document.getElementById('stopAudio').style.display = 'inline-flex';

  if (edgeTTSAvailable === true) {
    speakSentenceCloud(btn, card, fullText);
  } else if (edgeTTSAvailable === null) {
    btn.classList.add('loading');
    speakSentenceCloud(btn, card, fullText);
  } else {
    speakSentenceSystem(btn, card, fullText);
  }
}

async function speakSentenceCloud(btn, card, fullText) {
  card.setAttribute('data-engine', 'cloud');
  btn.setAttribute('data-engine', 'cloud');
  btn.classList.add('loading');

  try {
    var audioUrl = await edgeTTSSynthesize(fullText, { rate: speechRate });
    edgeTTSAvailable = true;
    setEngineStatus('cloud', 'Cloud TTS');
    btn.classList.remove('loading');

    if (currentSpeakerBtn !== btn) return;

    var audio = new Audio(audioUrl);
    currentAudioEl = audio;
    audio.onended = function() {
      cleanupSpeech();
      currentAudioEl = null;
    };
    audio.onerror = function() {
      cleanupSpeech();
      btn.classList.add('playing');
      card.classList.add('reading');
      document.getElementById('stopAudio').style.display = 'inline-flex';
      currentSpeakerBtn = btn;
      currentCard = card;
      speakSentenceSystem(btn, card, fullText);
    };
    await audio.play();
  } catch(e) {
    setEngineStatus('system', 'System TTS');
    btn.classList.remove('loading');
    if (currentSpeakerBtn !== btn) return;
    speakSentenceSystem(btn, card, fullText);
  }
}

function speakArticle(articleIndex, btn) {
  stopSpeech();
  var sections = document.querySelectorAll('.article-section');
  var section = sections[articleIndex];
  if (!section) return;
  var cards = section.querySelectorAll('.sentence-card');

  // Reload voices for current language
  loadVoices();

  currentArticleBtn = btn;
  var cardIdx = 0;
  var stopAudioBtn = document.getElementById('stopAudio');
  stopAudioBtn.style.display = 'inline-flex';
  btn.innerHTML = '<span>⏳</span> Reading...';

  function readNextCard() {
    if (cardIdx >= cards.length) {
      btn.innerHTML = '<span>🔊</span> Read Article';
      stopAudioBtn.style.display = 'none';
      currentArticleBtn = null;
      return;
    }

    var card = cards[cardIdx];
    var speaker = card.querySelector('.speaker-btn');
    var sentText = card.querySelector('.sentence-text');
    var fullText = sentText.textContent.trim();

    card.classList.add('reading');
    speaker.classList.add('playing');
    currentCard = card;
    currentSpeakerBtn = speaker;

    function onDone() {
      card.classList.remove('reading');
      speaker.classList.remove('playing');
      cardIdx++;
      setTimeout(readNextCard, 150);
    }

    if (edgeTTSAvailable === true) {
      readCardCloud(card, speaker, fullText, onDone);
    } else if (edgeTTSAvailable === null) {
      speaker.classList.add('loading');
      readCardCloud(card, speaker, fullText, onDone);
    } else {
      readCardSystem(card, speaker, fullText, onDone);
    }
  }

  readNextCard();
}

async function readCardCloud(card, speaker, fullText, onDone) {
  card.setAttribute('data-engine', 'cloud');
  speaker.setAttribute('data-engine', 'cloud');
  speaker.classList.add('loading');

  try {
    var audioUrl = await edgeTTSSynthesize(fullText, { rate: speechRate });
    edgeTTSAvailable = true;
    setEngineStatus('cloud', 'Cloud TTS');
    speaker.classList.remove('loading');

    var audio = new Audio(audioUrl);
    currentAudioEl = audio;
    audio.onended = onDone;
    audio.onerror = function() {
      speaker.classList.remove('loading');
      readCardSystem(card, speaker, fullText, onDone);
    };
    await audio.play();
  } catch(e) {
    setEngineStatus('system', 'System TTS');
    speaker.classList.remove('loading');
    readCardSystem(card, speaker, fullText, onDone);
  }
}

function readCardSystem(card, speaker, fullText, onDone) {
  card.setAttribute('data-engine', 'system');
  speaker.setAttribute('data-engine', 'system');
  var chunks = splitIntoChunks(fullText);
  var chunkIdx = 0;
  var lang = currentArticleLang === 'zh' ? 'zh-CN' : 'en-US';

  function speakNext() {
    if (chunkIdx >= chunks.length) {
      onDone();
      return;
    }
    var chunk = chunks[chunkIdx];
    var utter = new SpeechSynthesisUtterance(chunk);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = lang;
    utter.rate = speechRate;
    utter.pitch = 1.0;
    var pauseMs = getPauseMs(chunk[chunk.length - 1]);

    utter.onend = function() {
      chunkIdx++;
      if (chunkIdx < chunks.length) {
        setTimeout(speakNext, pauseMs);
      } else {
        onDone();
      }
    };
    utter.onerror = function() { onDone(); };
    currentUtterances.push(utter);
    window.speechSynthesis.speak(utter);
  }
  speakNext();
}

function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentUtterances = [];

  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl.currentTime = 0;
    currentAudioEl = null;
  }

  document.querySelectorAll('.speaker-btn.playing, .speaker-btn.loading').forEach(function(b) {
    b.classList.remove('playing', 'loading');
  });
  document.querySelectorAll('.sentence-card.reading').forEach(function(c) {
    c.classList.remove('reading');
  });

  currentSpeakerBtn = null;
  currentCard = null;

  if (currentArticleBtn) {
    currentArticleBtn.innerHTML = '<span>🔊</span> Read Article';
    currentArticleBtn = null;
  }

  document.getElementById('stopAudio').style.display = 'none';
}

document.getElementById('stopAudio').addEventListener('click', stopSpeech);

// ============================================================
//  CACHE MANAGEMENT
// ============================================================

function evictOldestTTSCache() {
  if (ttsAudioCache.size <= MAX_CACHE_ENTRIES) return;
  var keysToDelete = [];
  var count = ttsAudioCache.size - MAX_CACHE_ENTRIES;
  var iter = ttsAudioCache.keys();
  for (var i = 0; i < count; i++) {
    keysToDelete.push(iter.next().value);
  }
  keysToDelete.forEach(function(key) {
    var url = ttsAudioCache.get(key);
    if (url && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url); } catch(e) {}
    }
    ttsAudioCache.delete(key);
  });
}

function clearTTSCache() {
  ttsAudioCache.forEach(function(url) {
    if (url && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url); } catch(e) {}
    }
  });
  ttsAudioCache.clear();
}