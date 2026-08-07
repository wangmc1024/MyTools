// ============================================================
//  EDGE-TTS CLOUD ENGINE (via Edge-TTS API)
//  Fallback chain: wangmc worker → wangwangit → system TTS
// ============================================================
const TTS_API_URLS = [
  'https://edge-tts-voice-magic.wangmc1024.workers.dev/v1/audio/speech',
  'https://tts.wangwangit.com/v1/audio/speech'
];
let _activeTtsUrl = null; // set by probeTTSEndpoints() on init

// Lightweight probe: minimal POST request, 5s timeout
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

// Run on page load — probe all TTS endpoints, pick the first available
async function probeTTSEndpoints() {
  setEngineStatus('connecting', 'Probing TTS...');
  for (var i = 0; i < TTS_API_URLS.length; i++) {
    var url = TTS_API_URLS[i];
    try {
      var ok = await probeTtsEndpoint(url);
      if (ok) {
        _activeTtsUrl = url;
        edgeTTSAvailable = true;
        setEngineStatus('cloud', 'Cloud TTS ✓');
        console.log('[TTS] Selected endpoint ' + (i + 1) + ': ' + url);
        return;
      }
    } catch(e) {
      console.warn('[TTS] Endpoint ' + (i + 1) + ' failed:', e.message);
    }
  }
  _activeTtsUrl = TTS_API_URLS[0];
  edgeTTSAvailable = false;
  setEngineStatus('system', 'System TTS');
  console.log('[TTS] All cloud endpoints failed, using System TTS');
}
let EDGE_TTS_VOICE = localStorage.getItem('ttsVoice') || 'en-US-JennyNeural';
const EDGE_TTS_TIMEOUT = 15000;

// Audio cache (in-memory, keyed by text+voice+rate, limited size)
const TTS_CACHE_MAX = 50;
const ttsAudioCache = new Map();
const ttsCacheKeys = [];  // LRU tracking for eviction
let edgeTTSAvailable = null; // null=unknown, true/false
let currentAudioEl = null;

// Voice selector
var voiceSelect = document.getElementById('voiceSelect');
voiceSelect.value = EDGE_TTS_VOICE;
voiceSelect.addEventListener('change', function() {
  EDGE_TTS_VOICE = this.value;
  localStorage.setItem('ttsVoice', EDGE_TTS_VOICE);
  // Revoke old Blob URLs before clearing cache
  ttsAudioCache.forEach(function(url) { URL.revokeObjectURL(url); });
  ttsAudioCache.clear();
  ttsCacheKeys.length = 0;
});

async function edgeTTSSynthesize(text, opts) {
  opts = opts || {};
  var voice = opts.voice || EDGE_TTS_VOICE;
  var rate = opts.rate || speechRate;
  var timeout = opts.timeout || EDGE_TTS_TIMEOUT;

  var cacheKey = voice + '|' + rate + '|' + text.trim();
  if (ttsAudioCache.has(cacheKey)) {
    var idx = ttsCacheKeys.indexOf(cacheKey);
    if (idx > -1) { ttsCacheKeys.splice(idx, 1); ttsCacheKeys.push(cacheKey); }
    return ttsAudioCache.get(cacheKey);
  }

  var lastError = null;
  // Use the probed active URL first, then fallback to other endpoints
  var urls = _activeTtsUrl ? [_activeTtsUrl] : [];
  for (var u = 0; u < TTS_API_URLS.length; u++) {
    if (TTS_API_URLS[u] !== _activeTtsUrl) urls.push(TTS_API_URLS[u]);
  }
  for (var u = 0; u < urls.length; u++) {
    try {
      var response = await fetchWithTimeout(urls[u], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          voice: voice,
          speed: rate,
          pitch: '0',
          style: 'general'
        })
      }, timeout);

      if (!response.ok) {
        var errText = await response.text().catch(function() { return 'HTTP ' + response.status; });
        throw new Error('TTS API error: ' + response.status + ' ' + errText);
      }

      var blob = await response.blob();
      if (blob.size === 0) throw new Error('TTS API returned empty audio');

      var url = URL.createObjectURL(blob);
      if (ttsCacheKeys.length >= TTS_CACHE_MAX) {
        var oldestKey = ttsCacheKeys.shift();
        var oldUrl = ttsAudioCache.get(oldestKey);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        ttsAudioCache.delete(oldestKey);
      }
      ttsAudioCache.set(cacheKey, url);
      ttsCacheKeys.push(cacheKey);
      return url;
    } catch(e) {
      lastError = e;
      console.log('TTS URL ' + (u + 1) + ' failed:', e.message);
    }
  }
  throw lastError || new Error('All TTS APIs failed');
}

// --- Engine status indicator ---
function setEngineStatus(engine, label) {
  var badge = document.getElementById('ttsEngineBadge');
  var lbl = document.getElementById('engineLabel');
  badge.setAttribute('data-engine', engine);
  lbl.textContent = label;
}

var _ttsDetectPending = false;

async function detectEdgeTTS(updateBadge) {
  // Already probed on init; just return cached result
  if (edgeTTSAvailable !== null) {
    if (updateBadge) setEngineStatus(edgeTTSAvailable ? 'cloud' : 'system', edgeTTSAvailable ? 'Cloud TTS' : 'System TTS');
    return edgeTTSAvailable;
  }
  // Guard against parallel calls — only one detection at a time
  if (_ttsDetectPending) return null;
  _ttsDetectPending = true;
  try {
    // Fallback: probe hasn't finished yet, run a quick single check
    if (!navigator.onLine) {
      edgeTTSAvailable = false;
    } else {
      try {
        await edgeTTSSynthesize('Hello.', { timeout: 8000 });
        edgeTTSAvailable = true;
      } catch(e) {
        edgeTTSAvailable = false;
      }
    }
    if (updateBadge) setEngineStatus(edgeTTSAvailable ? 'cloud' : 'system', edgeTTSAvailable ? 'Cloud TTS' : 'System TTS');
    return edgeTTSAvailable;
  } finally {
    _ttsDetectPending = false;
  }
}

// Start probing on page load (async, non-blocking)
probeTTSEndpoints();

// ============================================================
//  SYSTEM TTS (Fallback Engine)
// ============================================================
let selectedVoice = null;
let voicesLoaded = false;
let currentUtterances = [];
let currentSpeakerBtn = null;
let currentCard = null;
let currentArticleBtn = null;

function loadVoices() {
  var voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesLoaded = true;
  var priorities = [
    function(v) { return /natural/i.test(v.name) && /en[-_]US/i.test(v.lang); },
    function(v) { return /natural/i.test(v.name) && /en/i.test(v.lang); },
    function(v) { return /aria|jenny|guy|premier/i.test(v.name); },
    function(v) { return /google.*us.*english/i.test(v.name); },
    function(v) { return /google.*english/i.test(v.name); },
    function(v) { return /microsoft.*aerial|jenny|aria|guy|sonia/i.test(v.name); },
    function(v) { return /en[-_]US/i.test(v.lang) && /female/i.test(v.name); },
    function(v) { return /en[-_]US/i.test(v.lang); },
    function(v) { return /en/i.test(v.lang); }
  ];
  for (var i = 0; i < priorities.length; i++) {
    var found = voices.find(priorities[i]);
    if (found) { selectedVoice = found; break; }
  }
}
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function splitIntoChunks(text) {
  var segments = text.split(/([,.;:!?—])/);
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
  if (lastChar === '.') return 120;
  if (lastChar === '!' || lastChar === '?') return 150;
  if (lastChar === ';' || lastChar === ':') return 90;
  if (lastChar === '—') return 80;
  if (lastChar === ',') return 80;
  return 50;
}

function speakSentenceSystem(btn, card, fullText) {
  card.setAttribute('data-engine', 'system');
  var chunks = splitIntoChunks(fullText);
  var chunkIdx = 0;

  function speakNext() {
    if (chunkIdx >= chunks.length) {
      cleanupSpeech();
      return;
    }
    var chunk = chunks[chunkIdx];
    var utter = new SpeechSynthesisUtterance(chunk);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = 'en-US';
    utter.rate = speechRate;
    utter.pitch = 1.0 + (Math.sin(chunkIdx * 1.3) * 0.03);
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
  var sentEn = card.querySelector('.sentence-en');
  var fullText = sentEn.textContent.replace(/💬|译|👁|🔈/gu, '').trim();

  currentSpeakerBtn = btn;
  currentCard = card;

  btn.classList.add('playing');
  card.classList.add('reading');
  document.getElementById('stopAudio').style.display = 'inline-flex';

  if (edgeTTSAvailable === true) {
    speakSentenceCloud(btn, card, fullText);
  } else if (edgeTTSAvailable === null) {
    btn.classList.add('loading');
    detectEdgeTTS(true).then(function(available) {
      btn.classList.remove('loading');
      if (currentSpeakerBtn !== btn) return;
      if (available) {
        speakSentenceCloud(btn, card, fullText);
      } else {
        speakSentenceSystem(btn, card, fullText);
      }
    });
  } else {
    speakSentenceSystem(btn, card, fullText);
  }
}

async function speakSentenceCloud(btn, card, fullText) {
  card.setAttribute('data-engine', 'cloud');
  btn.setAttribute('data-engine', 'cloud');
  btn.classList.add('loading');

  try {
    var audioUrl = await edgeTTSSynthesize(fullText, { rate: speechRate, pitch: 1.0 });
    btn.classList.remove('loading');

    if (currentSpeakerBtn !== btn) return;

    var audio = new Audio(audioUrl);
    currentAudioEl = audio;
    audio.onended = function() {
      cleanupSpeech();
      currentAudioEl = null;
    };
    audio.onerror = function() {
      console.log('Cloud audio playback failed, falling back');
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
    console.log('Edge TTS failed, falling back:', e.message);
    btn.classList.remove('loading');
    if (currentSpeakerBtn !== btn) return;
    speakSentenceSystem(btn, card, fullText);
  }
}

function speakArticle(articleIndex, btn) {
  stopSpeech();
  var section = document.querySelectorAll('.article-section')[articleIndex];
  if (!section) return;
  var cards = section.querySelectorAll('.sentence-card');

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
    var sentEn = card.querySelector('.sentence-en');
    var fullText = sentEn.textContent.replace(/💬|译|👁|🔈/gu, '').trim();

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
      detectEdgeTTS(true).then(function(available) {
        speaker.classList.remove('loading');
        if (available) {
          readCardCloud(card, speaker, fullText, onDone);
        } else {
          readCardSystem(card, speaker, fullText, onDone);
        }
      });
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
    var audioUrl = await edgeTTSSynthesize(fullText, { rate: speechRate, pitch: 1.0 });
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
    speaker.classList.remove('loading');
    readCardSystem(card, speaker, fullText, onDone);
  }
}

function readCardSystem(card, speaker, fullText, onDone) {
  card.setAttribute('data-engine', 'system');
  speaker.setAttribute('data-engine', 'system');
  var chunks = splitIntoChunks(fullText);
  var chunkIdx = 0;

  function speakNext() {
    if (chunkIdx >= chunks.length) {
      onDone();
      return;
    }
    var chunk = chunks[chunkIdx];
    var utter = new SpeechSynthesisUtterance(chunk);
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = 'en-US';
    utter.rate = speechRate;
    utter.pitch = 1.0 + (Math.sin(chunkIdx * 1.3) * 0.03);
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
  // Stop system TTS
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentUtterances = [];

  // Stop cloud audio
  if (currentAudioEl) {
    currentAudioEl.pause();
    currentAudioEl.currentTime = 0;
    currentAudioEl = null;
  }

  // Cleanup UI
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
