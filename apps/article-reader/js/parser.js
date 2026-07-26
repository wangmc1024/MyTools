// ============================================================
//  LANGUAGE DETECTION
// ============================================================

function detectLanguage(text) {
  var cjkCount = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  var latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  return cjkCount > latinCount ? 'zh' : 'en';
}

// ============================================================
//  ARTICLE PARSING
// ============================================================

function parseArticleText(title, rawText) {
  var lang = detectLanguage(rawText);

  // Split into paragraphs by double newline
  var rawParas = rawText.trim().split(/\n\s*\n/).filter(function(p) { return p.trim(); });
  if (rawParas.length === 0) return null;

  var paragraphs = [];

  rawParas.forEach(function(rawPara) {
    var para = rawPara.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!para) return;

    // Detect paragraph type from markdown syntax
    var paraType = 'text';
    var headingLevel = 0;

    // Headings: # ## ### etc.
    var headingMatch = para.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      paraType = 'heading';
      headingLevel = headingMatch[1].length;
      para = headingMatch[2].trim();
    }

    // Blockquote: > text
    if (paraType === 'text' && /^>{1,}\s+/.test(para)) {
      paraType = 'quote';
      para = para.replace(/^>{1,}\s+/gm, '');
    }

    // List items: - text, * text, 1. text  (strip markers)
    if (paraType === 'text') {
      para = para.replace(/^[-*]\s+/gm, '').replace(/^\d+\.\s+/gm, '');
    }

    // Escape HTML first to prevent XSS
    var escaped = escapeHtml(para);

    // Strip horizontal rules: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(escaped.trim())) return;

    // Handle inline code: `code` → code (strip backticks, keep text)
    escaped = escaped.replace(/`([^`]+)`/g, '$1');

    // Handle links: [text](url) → text
    escaped = escaped.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Handle bold: **word** → <b>word</b> (must be before italic)
    var boldWords = [];
    var processed = escaped.replace(/\*\*([^*]+)\*\*/g, function(match, word) {
      boldWords.push(word);
      return '<b>' + word + '</b>';
    });

    // Handle italic: *text* → <i>text</i> (after bold, so ** is already consumed)
    processed = processed.replace(/(?<!<b>|\/>)\*([^*<>]+)\*(?!<\/b>)/g, '<i>$1</i>');

    // For headings, treat the entire text as a single sentence (no splitting)
    var sentences;
    if (paraType === 'heading') {
      sentences = [processed.trim()];
    } else if (lang === 'zh') {
      // Chinese: split by Chinese sentence-ending punctuation
      var parts = processed.split(/([。！？；])/);
      sentences = [];
      for (var i = 0; i < parts.length; i += 2) {
        var s = parts[i] || '';
        if (parts[i + 1]) s += parts[i + 1];
        if (s.trim()) sentences.push(s.trim());
      }
    } else {
      // English: split by . ! ? followed by space or end
      var sentenceRegex = /[^.!?]+[.!?]+(?:["'”’)\]]+)?(?:\s|$)/g;
      sentences = processed.match(sentenceRegex);
      if (!sentences || sentences.length === 0) {
        sentences = [processed];
      } else {
        var matchedText = sentences.join('');
        var remaining = processed.substring(matchedText.length).trim();
        if (remaining) sentences.push(remaining);
      }
    }

    // Clean up sentences
    sentences = sentences.map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });

    var sentObjs = sentences.map(function(sentHtml) {
      var sentBold = [];
      sentHtml.replace(/<b>([^<]+)<\/b>/g, function(match, word) {
        sentBold.push(word);
        return match;
      });
      return { en: sentHtml, boldWords: sentBold };
    });

    if (sentObjs.length > 0) {
      var paraObj = { sentences: sentObjs };
      if (paraType !== 'text') {
        paraObj.type = paraType;
        if (headingLevel) paraObj.level = headingLevel;
      }
      paragraphs.push(paraObj);
    }
  });

  if (paragraphs.length === 0) return null;

  return {
    title: (title || '').trim() || 'Untitled Article',
    lang: lang,
    paragraphs: paragraphs,
    createdAt: Date.now()
  };
}
