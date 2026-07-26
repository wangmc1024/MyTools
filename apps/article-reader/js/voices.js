// ============================================================
//  SPEED CONTROL & VOICE SELECT
// ============================================================

var speedSlider = document.getElementById('speedSlider');
var speedValueEl = document.getElementById('speedValue');
speedSlider.value = speechRate;
speedValueEl.textContent = speechRate.toFixed(2) + 'x';

speedSlider.addEventListener('input', function() {
  speechRate = parseFloat(this.value);
  speedValueEl.textContent = speechRate.toFixed(2) + 'x';
  try { localStorage.setItem('speechRate', speechRate); } catch(e) {}
  clearTTSCache();
});

// ============================================================
//  VOICE SELECT
// ============================================================

var voiceSelect = document.getElementById('voiceSelect');

function populateVoices(lang) {
  voiceSelect.innerHTML = '';
  var voices = VOICES[lang] || VOICES.en;

  // Check if voices have group field (for optgroup rendering)
  var hasGroups = false;
  for (var i = 0; i < voices.length; i++) {
    if (voices[i].group) { hasGroups = true; break; }
  }

  if (hasGroups) {
    // Group voices using optgroup
    var groupMap = {};
    var groupOrder = [];
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (!groupMap[v.group]) {
        groupMap[v.group] = [];
        groupOrder.push(v.group);
      }
      groupMap[v.group].push(v);
    }
    for (var g = 0; g < groupOrder.length; g++) {
      var optgroup = document.createElement('optgroup');
      optgroup.label = groupOrder[g];
      var items = groupMap[groupOrder[g]];
      for (var j = 0; j < items.length; j++) {
        var opt = document.createElement('option');
        opt.value = items[j].id;
        opt.textContent = items[j].name;
        optgroup.appendChild(opt);
      }
      voiceSelect.appendChild(optgroup);
    }
  } else {
    // Flat list for English
    for (var i = 0; i < voices.length; i++) {
      var opt = document.createElement('option');
      opt.value = voices[i].id;
      opt.textContent = voices[i].name;
      voiceSelect.appendChild(opt);
    }
  }

  // Set to last used voice for this language (with fallback to first voice)
  var voiceIds = voices.map(function(v) { return v.id; });
  var saved = lastUsedVoice[lang];
  EDGE_TTS_VOICE = (saved && voiceIds.indexOf(saved) >= 0) ? saved : voices[0].id;
  voiceSelect.value = EDGE_TTS_VOICE;
}

voiceSelect.addEventListener('change', function() {
  EDGE_TTS_VOICE = this.value;
  lastUsedVoice[currentArticleLang] = EDGE_TTS_VOICE;
  try { localStorage.setItem('lastUsedVoice', JSON.stringify(lastUsedVoice)); } catch(e) {}
  clearTTSCache();
});

// Initialize with English voices
populateVoices('en');
