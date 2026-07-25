/* ===========================================================
 * PyIDE -- browser-based Python IDE
 * Powered by Pyodide (WebAssembly runtime in browser)
 *
 * Loaded after CodeMirror 5 globals and pyodide-core.js.
 * Expects: window.pyodideCore (from pyodide-core.js)
 *          CodeMirror, CodeMirror.keyMap, etc. (from CDN scripts)
 * =========================================================== */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Clean a JS string before sending it to Pyodide.
 *
 * Problem: JS stores strings as UTF-16. Emoji / CJK-extra chars >U+FFFF
 * are stored as surrogate pairs (e.g. 👋 for 👋).
 * When Pyodide bridges JS→Python the surrogate pair is fine if **complete**.
 * But orphaned / broken surrogates (\udxxx alone or mismatched halves) cause
 * an EncodingError when Pyodide tries to convert the string to UTF-8 — which
 * then aborts ast.parse(), giving a misleading error.
 *
 * This function walks the string's UTF-16 code units and replaces any
 * orphaned surrogate with the replacement character (�).
 * If it encounters a **complete** surrogate pair it is left intact so normal
 * emoji / supplementary-plane chars work correctly.
 */
function cleanStringForPython(str) {
    if (!str || typeof str !== 'string') return '';
    var result = [];
    for (var i = 0; i < str.length; ) {
        var cp = str.charCodeAt(i);
        // High surrogate (D800–DBFF): expect a following low surrogate
        if (cp >= 0xD800 && cp <= 0xDBFF) {
            var next = str.charCodeAt(i + 1);
            // Valid surrogate pair?
            if (next >= 0xDC00 && next <= 0xDFFF) {
                // Yes — append the combined character (JS will handle it fine)
                result.push(str.charAt(i));
                result.push(str.charAt(i + 1));
                i += 2;
            } else {
                // Orphaned high surrogate — replace
                result.push('�'); // replacement char
                i += 1;
            }
        }
        // Low surrogate without preceding high → orphaned
        else if (cp >= 0xDC00 && cp <= 0xDFFF) {
            result.push('�');
            i += 1;
        }
        // Normal character
        else {
            result.push(str.charAt(i));
            i += 1;
        }
    }
    return result.join('');
}

function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }); } catch(e) { return dateStr; }
}

function showToastApp(msg, type) {
    var t = document.getElementById('_appToast');
    if (!t) {
        t = document.createElement('div'); t.id = '_appToast'; t.className = 'app-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'app-toast' + (type ? ' ' + type : '');
    requestAnimationFrame(function() { t.classList.add('show'); });
    clearTimeout(t._t);
    t._t = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ---------------------------------------------------------------------------
// theme sync (shared with portal)
// ---------------------------------------------------------------------------
(function() {
    var el = document.getElementById('toolTitle');
    if (el) { try { el.textContent = document.title.replace(/\s*[-\u2013\u2014]\s*.*/, '').trim() || 'PyIDE'; } catch(e) {} }
    function getTheme() { try { return localStorage.getItem('portal-theme') || 'light'; } catch(e) { return 'light'; } }
    function setTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem('portal-theme', t); } catch(e) {}
        var ic = document.getElementById('portalThemeIcon');
        if (ic) ic.textContent = t === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
    }
    window.toggleTheme = function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); };
    window.getTheme = getTheme;
    window.setTheme = setTheme;
    var btn = document.getElementById('portalThemeToggle');
    if (btn) { btn.addEventListener('click', function() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }); }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { setTheme(getTheme()); }); } else { setTheme(getTheme()); }
})();

// ---------------------------------------------------------------------------
// examples data
// ---------------------------------------------------------------------------
var EXAMPLES = [
    {
        name: "\u4f60\u597d\uff0c\u4e16\u754c", icon: "\u{1f44b}", code:
            '# \u4f60\u597d\uff0c\u4e16\u754c\uff01\n' +
            'print("\u6b22\u8fce\u4f7f\u7528 PyIDE\uff01")\n' +
            'print("\u8fd9\u662f\u5728\u6d4f\u89c8\u5668\u4e2d\u8fd0\u884c\u7684 Python \u4ee3\u7801")\n' +
            '\n' +
            'print("\\n\u4e3a\u4ec0\u4e48\u8fd9\u4e48\u68d2\uff1a")\n' +
            'print("\u2705 \u65e0\u9700\u5b89\u88c5\u2014\u2014\u76f4\u63a5\u5728\u6d4f\u89c8\u5668\u4e2d\u8fd0\u884c")\n' +
            'print("\u2705 \u4fdd\u62a4\u9690\u79c1\u2014\u2014\u4ee3\u7801\u5728\u672c\u5730\u6267\u884c")\n' +
            'print("\u2705 \u5373\u6253\u5373\u8fd0\u2014\u2014\u6539\u52a8\u4ee3\u7801\u5373\u53ef\u770b\u5230\u7ed3\u679c")'
    },
    {
        name: "\u83f2\u6ce2\u90a3\u5951\u6570\u5217", icon: "\u{1f522}", code:
            '# \u83f2\u6ce2\u90a3\u5951\u6570\u5217\n' +
            'def fibonacci(n):\n' +
            '    """\u8fd4\u56de\u524d n \u4e2a\u83f2\u6ce2\u90a3\u5951\u6570"""\n' +
            '    seq = [0, 1]\n' +
            '    for i in range(2, n):\n' +
            '        seq.append(seq[-1] + seq[-2])\n' +
            '    return seq[:n]\n' +
            '\n' +
            'result = fibonacci(15)\n' +
            'print("\u524d 15 \u4e2a\u83f2\u6ce2\u90a3\u5951\u6570\uff1a")\n' +
            'print(result)\n' +
            'print("\\u603b\u548c =", sum(result))'
    },
    {
        name: "\u6570\u5b66\u8fd0\u7b97", icon: "\u269b\ufe0f", code:
            '# \u6570\u5b66\u8fd0\u7b97\u793a\u4f8b\n' +
            'import math\n' +
            'import random\n' +
            '\n' +
            '# \u968f\u673a\u6570\n' +
            'random.seed(42)\n' +
            'nums = [random.randint(1, 100) for _ in range(20)]\n' +
            'print("\u968f\u673a\u6570\u7ec4\uff1a", nums)\n' +
            'print("\u6700\u5927\u503c\uff1a", max(nums))\n' +
            'print("\u6700\u5c0f\u503c\uff1a", min(nums))\n' +
            'print("\u5e73\u5747\u503c\uff1a", sum(nums) / len(nums))\n' +
            '\n' +
            '# \u6570\u5b66\u51fd\u6570\n' +
            'print("\\n\u6570\u5b66\u51fd\u6570\uff1a")\n' +
            'print("pi =", math.pi)\n' +
            'print("sqrt(2) =", math.sqrt(2))\n' +
            'print("sin(45\\u00b0) =", math.sin(math.radians(45)))\n' +
            'print("factorial(10) =", math.factorial(10))'
    },
    {
        name: "\u5b57\u7b26\u7edf\u8ba1\u5668", icon: "\u{1f4cb}", code:
            '# \u6587\u672c\u5206\u6790\u5668\n' +
            'text = """Python is a great programming language.\n' +
            'It is widely used in data science, web development,\n' +
            'artificial intelligence, and automation.\n' +
            'Many developers love Python for its simplicity."""\n' +
            '\n' +
            'words = text.split()\n' +
            'print("\u603b\u5b57\u6570:", len(text))\n' +
            'print("\u5355\u8bcd\u6570:", len(words))\n' +
            'print("\u884c\u6570:", len(text.splitlines()))\n' +
            '\n' +
            '# \u5355\u8bcd\u9891\u7387\n' +
            'freq = {}\n' +
            'for w in words:\n' +
            '    w = w.lower().strip(".,!?;:")\n' +
            '    freq[w] = freq.get(w, 0) + 1\n' +
            '\n' +
            'print("\\n\u5355\u8bcd\u9891\u7387\uff08\u524d 8\uff09:")\n' +
            'for word, count in sorted(freq.items(), key=lambda x:-x[1])[:8]:\n' +
            '    bar = "\u2588" * count\n' +
            '    print(f"  {word:<12} {count:>2}  {bar}")'
    },
    {
        name: "\u5217\u8868\u63a8\u5bfc\u5f0f", icon: "\u{1f4dd}", code:
            '# \u5217\u8868\u63a8\u5bfc\u5f0f\u793a\u4f8b\n' +
            '# \u5076\u6570\u5e73\u65b9\n' +
            'even_squares = [x**2 for x in range(20) if x % 2 == 0]\n' +
            'print("\u5076\u6570\u5e73\u65b9:", even_squares)\n' +
            '\n' +
            '# \u5b57\u7b26\u957f\u5ea6\u5217\u8868\n' +
            'words = ["Python", "JavaScript", "Rust", "Go", "TypeScript"]\n' +
            'lengths = [len(w) for w in words]\n' +
            'print("\\u5b57\u7b26\u957f\u5ea6:", lengths)\n' +
            '\n' +
            '# \u5b57\u5178\u63a8\u5bfc\u5f0f\n' +
            'squares = {x: x**2 for x in range(1, 11)}\n' +
            'print("\\u5e73\u65b9\u8868:\\n", squares)\n' +
            '\n' +
            '# \u5d4c\u5957\u5217\u8868\u63a8\u5bfc\u5f0f\n' +
            'matrix = [[i*j for j in range(1,6)] for i in range(1,6)]\n' +
            'print("\\u4e58\u6cd5\u8868\uff1a")\n' +
            'for row in matrix:\n' +
            '    print("  ".join(f"{v:4d}" for v in row))'
    },
    {
        name: "\u7b80\u6613\u8ba1\u7b97\u5668", icon: "\u{1f9d0}", code:
            '# \u7b80\u6613\u8ba1\u7b97\u5668\n' +
            'def calculator(a, b, op):\n' +
            '    """\u7b80\u5355\u7684\u56db\u5219\u8fd0\u7b97\u8ba1\u7b97\u5668"""\n' +
            '    ops = {\n' +
            '        "+": lambda x, y: x + y,\n' +
            '        "-": lambda x, y: x - y,\n' +
            '        "*": lambda x, y: x * y,\n' +
            '        "/": lambda x, y: x / y if y != 0 else "\\u9519\u8bef\uff1a\u9664\u6570\u4e0d\u80fd\u4e3a 0",\n' +
            '        "**": lambda x, y: x ** y,\n' +
            '        "//": lambda x, y: x // y if y != 0 else "\\u9519\u8bef\uff1a\u9664\u6570\u4e0d\u80fd\u4e3a 0",\n' +
            '        "%": lambda x, y: x % y if y != 0 else "\\u9519\u8bef\uff1a\u9664\u6570\u4e0d\u80fd\u4e3a 0",\n' +
            '    }\n' +
            '    if op not in ops:\n' +
            '        return f"\u65e0\u6548\u8fd0\u7b97\u7b26\uff1a{op}"\n' +
            '    result = ops[op](a, b)\n' +
            '    return f"{a} {op} {b} = {result}"\n' +
            '\n' +
            'print("\\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510")\n' +
            'print("\\u2502    \u7b80\u6613\u8ba1\u7b97\u5668     \\u2502")\n' +
            'print("\\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518")\n' +
            '\n' +
            'operations = [("+", 5, 3), ("-", 10, 7), ("*", 6, 7), ("/", 10, 3),\n' +
            '              ("**", 2, 10), ("//", 17, 5), ("%", 17, 5)]\n' +
            'for op, a, b in operations:\n' +
            '    print(calculator(a, b, op))'
    },
    {
        name: "ASCII \u827a\u672f", icon: "\u{1f3a8}", code:
            '# ASCII \u827a\u672f\u56fe\u6848\n' +
            'shapes = {\n' +
            '    "\\u25a0": ["\\u25a0" * 5] * 5,\n' +
            '    "\\u25cf": ["  " + "\\u25cf" * 5 + "  "],\n' +
            '}\n' +
            '\n' +
            '# \u591a\u8fb9\u5f62\u8868\n' +
            'def polygon(side, length):\n' +
            '    symbols = ["\\u25b3", "\\u25ad", "\\u25b2", "\\u25b8", "\\u25c0", "\\u25c6"]\n' +
            '    s = symbols[(side - 3) % len(symbols)] if side >= 3 else "\\u25aa"\n' +
            '    for _ in range(length):\n' +
            '        print((s + " ") * side)\n' +
            '\n' +
            'print("\\n\u591a\u8fb9\u5f62\u8868\uff1a")\n' +
            'for s in range(3, 8):\n' +
            '    print(f"  {s}-\\u8fb9\\u5f62:", end=" ")\n' +
            '    symbols = ["\\u25b3", "\\u25ad", "\\u25b2", "\\u25b8", "\\u25c0", "\\u25c6"]\n' +
            '    print(symbols[(s - 3) % len(symbols)])\n' +
            '\n' +
            '# \u6253\u5370\u8272\u5f69\u5468\u671f\n' +
            'colors = ["\\u001b[31m", "\\u001b[33m", "\\u001b[32m", "\\u001b[34m", "\\u001b[35m"]\n' +
            'msg = "Hello PyIDE!"\n' +
            'colored = "".join(colors[i % len(colors)] + c for i, c in enumerate(msg))\n' +
            'print(colored + "\\u001b[0m")'
    },
    {
        name: "\u6570\u636e\u53ef\u89c6\u5316", icon: "\u{1f4ca}", code:
            '# \u7b80\u6613\u6570\u636e\u53ef\u89c6\u5316\n' +
            'import math\n' +
            '\n' +
            '# \u6761\u5f62\u56fe\n' +
            'data = {\n' +
            '    "Python": 85,\n' +
            '    "JavaScript": 92,\n' +
            '    "Rust": 78,\n' +
            '    "Go": 70,\n' +
            '    "TypeScript": 88,\n' +
            '    "R": 65,\n' +
            '}\n' +
            '\n' +
            'max_val = max(data.values())\n' +
            'bar_char = "\u2588"\n' +
            '\n' +
            'print("=" * 40)\n' +
            'print("     \u7f16\u7a0b\u8bed\u8a00\u71b5\u95e8\u5ea6\\u0007")\n' +
            'print("=" * 40)\n' +
            'for name, val in sorted(data.items(), key=lambda x: -x[1]):\n' +
            '    bar_len = int(val / max_val * 20)\n' +
            '    bar = bar_char * bar_len\n' +
            '    print(f"  {name:<12} |{bar} {val}")\n' +
            'print("=" * 40)\n' +
            '\n' +
            '# \u6b63\u5f26\u6ce2\u56fe\u5f62\n' +
            'print("\\n\\n  \u6b63\u5f26\u6ce2\u56fe\u5f62\uff1a")\n' +
            'for y in range(-10, 11, -2):\n' +
            '    line = ""\n' +
            '    for x in range(-30, 31):\n' +
            '        expected = int(math.sin(x / 5) * 10)\n' +
            '        line += "\\u2588" if abs(y - expected) <= 2 else " "\n' +
            '    print(f"  {y:+2d}|{line}|")\n' +
            'print("   +-" + "-" * 60)'
    },
    {
        name: "\u9762\u5411\u5bf9\u8c61\u7f16\u7a0b", icon: "\u{1f9e8}", code:
            '# \u9762\u5411\u5bf9\u8c61\u7f16\u7a0b\u793a\u4f8b\n' +
            'class Animal:\n' +
            '    """\u52a8\u7269\u57fa\u7c7b"""\n' +
            '    def __init__(self, name, sound):\n' +
            '        self.name = name\n' +
            '        self.sound = sound\n' +
            '    def speak(self):\n' +
            '        return f"{self.name}\\u00a0\\u8bf4\uff1a{self.sound}!"\n' +
            '\n' +
            'class Dog(Animal):\n' +
            '    def __init__(self, name, breed):\n' +
            '        super().__init__(name, "\\u55b1\u55b1")\n' +
            '        self.breed = breed\n' +
            '    def fetch(self, item):\n' +
            '        return f"{self.name}\\u00a0\u8dd1\u53bb\u628a {item} \\u53eb\u56de\u6765!"\n' +
            '\n' +
            'class Cat(Animal):\n' +
            '    def __init__(self, name):\n' +
            '        super().__init__(name, "\\u55e4\u55e4")\n' +
            '    def pounce(self):\n' +
            '        return f"{self.name}\\u00a0\u6f5c\u4f0f\u5e76\u731b\u6263!"\n' +
            '\n' +
            '# \u521b\u5efa\u52a8\u7269\u5708\n' +
            'animals = [\n' +
            '    Dog("\\u5927\u9ed1", "\\u91d1\u6bdb\u7267\u72ac"),\n' +
            '    Cat("\\u5c0f\u523a"),\n' +
            '    Dog("\\u5c0f\u767d", "\\u9a6c\u5170"),\n' +
            '    Cat("\\u82b1\u82b1"),\n' +
            ']\n' +
            '\n' +
            'print("\\u263a\\ufe0f  \u52a8\u7269\u5708\u65e5\u8bb0\\u0007")\n' +
            'print("-" * 30)\n' +
            'for a in animals:\n' +
            '    print(a.speak())\n' +
            '    if isinstance(a, Dog):\n' +
            '        print("  ", a.fetch("\\u85cf\u574f"))\n' +
            '    elif isinstance(a, Cat):\n' +
            '        print("  ", a.pounce())\n' +
            'print("-" * 30)\n' +
            'print(f"\u603b\u5171 {len(animals)} \u53ea\u52a8\u7269")'
    }
];

// ---------------------------------------------------------------------------
// welcome code
// ---------------------------------------------------------------------------
var WELCOME_CODE = [
    '# =============================================',
    '#  PyIDE — \u6d4f\u89c8\u5668\u5185 Python \u96c6\u6210\u5f00\u53d1\u73af\u5883',
    '#  Powered by Pyodide (WebAssembly)',
    '# =============================================',
    '',
    'print("\\u2728 \u6b22\u8fce\u4f7f\u7528 PyIDE\uff01")',
    'print("")',
    'print("\ud83d\udccb \u5feb\u6377\u6307\u5357:")',
    'print("  \u25b6\ufe0f   Ctrl+Enter  \u2014 \u8fd0\u884c\u4ee3\u7801")',
    'print("  +      \u65b0\u589e\u6587\u4ef6\u6807\u7b7e")',
    'print("  \ud83d\udcdd   \u70b9\u51fb\u5de5\u5177\u680f\u300c\u793a\u4f8b\u300d\u83b7\u53d6\u793a\u4f8b\u7a0b\u5e8f")',
    'print("  >>>    \u5728\u4e0b\u65b9\u63a7\u5236\u53f0\u8f93\u5165\u4ee3\u7801")',
    '',
    'print("")',
    'print("\ud83d\udcda \u53ef\u7528\u6a21\u5757:")',
    'print("  math, random, json, csv, datetime,", end="")',
    'print(" collections, functools, itertools")',
    'print("  numpy, pandas, matplotlib (\\u4f9d\u8d56)")',
    'print("")',
    'print("\\u2728 \u5f00\u59cb\u7f16\u7801\u5427\uff01")'
].join('\n');

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------
var pyodideReady  = false;
var pyodideInst   = null;
var pyPromise     = null;
var layoutMode    = 'right'; // 'right' or 'bottom'
var activeFileId  = null;
// files: [{id, name, content}] — content holds saved editor text when switched away
var files         = [];
var fileCounter   = 0;
var running       = false;

// ---------------------------------------------------------------------------
// CodeMirror editor (single global instance, content saved per-file)
// ---------------------------------------------------------------------------
var editor = null;

/** Create the single CodeMirror editor instance. */
function initEditor(code) {
    editor = CodeMirror(document.getElementById('editor'), {
        mode: 'python',
        theme: 'material-darker',
        lineNumbers: true,
        styleActiveLine: true,
        autoCloseBrackets: true,
        autoCloseTags: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true,
        extraKeys: {
            'Ctrl-Enter':   runCode,
            'Cmd-Enter':    runCode,
            'Ctrl-/':       'toggleComment',
            'Cmd-/':        'toggleComment',
            'Ctrl-Shift-/': 'toggleComment'
        }
    });
    editor.setValue(code || WELCOME_CODE);
    restyleEditorFromInstance(editor);
    return editor;
}

/** Restyle the current editor based on data-theme attribute. */
function restyleEditor() {
    if (editor) {
        restyleEditorFromInstance(editor);
    }
}

/** Apply theme to any CodeMirror instance. */
function restyleEditorFromInstance(cm) {
    var isDark = !document.documentElement.getAttribute('data-theme') ||
                 document.documentElement.getAttribute('data-theme') !== 'light';
    cm.setOption('theme', isDark ? 'material-darker' : 'default');
}

// ---------------------------------------------------------------------------
// File (tab) management
// ---------------------------------------------------------------------------
// All files share a single CodeMirror instance. Content is saved/restored
// in file.content when switching tabs.
function createFile(name, code) {
    var id = ++fileCounter;
    var fname = name || ('untitled-' + id);
    // Blank file when no code provided
    if (code === undefined) code = '';
    var tab  = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = id;
    tab.innerHTML = '<span class="tab-name">' + escapeHtml(fname) + '</span>' +
                    '<span class="tab-close" title="\u5173\u95ed">\u00d7</span>';
    tab.querySelector('.tab-name').addEventListener('click', (function(fid, tEl) {
        return function() { switchFile(fid); };
    })(id, tab));
    tab.querySelector('.tab-close').addEventListener('click', (function(fid, tEl) {
        return function(e) { e.stopPropagation(); closeFile(fid); };
    })(id, tab));
    tab.addEventListener('click', function() { if (this.dataset.id != activeFileId) switchFile(id); });

    var addBtn = document.getElementById('addTabBtn');
    document.getElementById('tabBar').insertBefore(tab, addBtn);

    // Store initial code; switchFile will create the CM instance
    files.push({id: id, name: fname, content: code, tabEl: tab});
    switchFile(id);
    return id;
}

function switchFile(id) {
    if (!id) return;
    var old = getFile(activeFileId);
    if (old && editor) {
        // Save current editor content before switching away
        try { old.content = editor.getValue(); } catch(e) {}
    }
    activeFileId = id;
    var f = getFile(id);
    if (!f) return;

    // Use stored content or fall back to welcome code
    var codeToLoad = (f.content !== undefined && f.content !== null) ? f.content : WELCOME_CODE;

    // Create editor lazily (first time only)
    if (!editor) {
        initEditor(codeToLoad);
        f.content = null;  // no longer needed — editor has the content
    } else {
        editor.setValue(codeToLoad);
    }
    editor.refresh();
    editor.focus();

    // Update tab active state
    document.querySelectorAll('.tab').forEach(function(t) {
        t.classList.toggle('active', parseInt(t.dataset.id) === id);
    });
}

function closeFile(id) {
    if (files.length <= 1) { showToastApp('\u6700\u540e\u4e00\u4e2a\u6587\u4ef6\u65e0\u6cd5\u5173\u95ed', 'error'); return; }
    var idx = -1;
    files.forEach(function(f, i) { if (f.id === id) idx = i; });
    if (idx === -1) return;

    // Remove tab DOM element
    var tabEl = files[idx].tabEl;
    if (tabEl && tabEl.parentNode) {
        tabEl.parentNode.removeChild(tabEl);
    }
    // Detach editor if this file's tab is currently showing
    if (id === activeFileId && editor) {
        editor.toTextArea();
        editor = null;
    }
    files.splice(idx, 1);

    if (activeFileId === id) {
        switchFile(files[0].id);
    }
}

function getFile(id) { return files.find(function(f){ return f.id === id; }); }

/** Get the CodeMirror editor instance (null when switching between tabs). */
function getActiveEditor() { return editor; }

/** Get code string from the active editor. */
function getActiveEditorValue() { return editor ? editor.getValue() : ''; }

// ---------------------------------------------------------------------------
// Output console
// ---------------------------------------------------------------------------
var outputLines = []; // accumulate for copy

function appendOutput(text, type) {
    type = type || 'stdout';
    outputLines.push({text: text, type: type});

    var placeholder = document.getElementById('outputPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    var box = document.getElementById('outputContent');
    var line = document.createElement('div');
    line.className = 'output-line ' + type;
    line.textContent = text;
    box.appendChild(line);

    // Auto scroll
    box.scrollTop = box.scrollHeight;
}

function clearOutput() {
    outputLines = [];
    var box = document.getElementById('outputContent');
    var ph = document.getElementById('outputPlaceholder');

    // Remove all child lines, preserve placeholder element
    while (box.firstChild) {
        box.removeChild(box.firstChild);
    }
    if (ph) {
        ph.style.display = 'flex';
    }
    box.appendChild(ph);
}

function copyOutput() {
    var txt = outputLines.map(function(l){ return l.text; }).join('\n');
    if (!txt.trim()) { showToastApp('\u8f93\u51fa\u4e3a\u7a7a', 'info'); return; }
    navigator.clipboard.writeText(txt).then(function() {
        showToastApp('\u00a0\u590d\u5236\u6210\u529f', 'success');
    }).catch(function() {
        // fallback
        var ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        showToastApp('\u590d\u5236\u6210\u529f', 'success');
    });
}

// ---------------------------------------------------------------------------
// Run code via Pyodide
// ---------------------------------------------------------------------------
async function ensurePyodide() {
    if (pyodideReady) return pyodideInst;
    if (pyPromise) return pyPromise;

    setLoadingStatus(true, '\u4e0b\u8f7d\u5f15\u64ce...');
    updateLoadingText('\u6b63\u5728\u4e0b\u8f7d Pyodide \u5f15\u64ce...', '\u9996\u6b21\u4e0b\u8f7d\u7ea6 10-20 MB\uff0c\u8bf7\u8010\u5fc3\u7b49\u5f85');

    try {
        // Phase indicator: show download progress via status badge
        setLoadingStatus(true, '\u4e0b\u8f7d\u4e2d...');

        // [v314] stdout/stderr via config callbacks instead of instance properties
        // v0.27: set pyodideInst.stdout = fn, pyodideInst.stderr = fn after load
        // v314: pass callbacks to initPyodide config; emscripten pipes connect automatically
        await pyodideCore.initPyodide(
            function(text) { appendOutput(text, 'stdout'); },
            function(text) { appendOutput(text, 'stderr'); }
        );
        // [v314] Get the pyodide instance after init; no need to store pyPromise
        pyodideInst = pyodideCore.getPyodideInstance();

        // [v314] Python-side JsWriter redirect NO LONGER NEEDED.
        // In v0.27 we ran Python code to replace sys.stdout/sys.stderr with a
        // JsWriter bridge calling window._appendPyOutput.  With v314's
        // initPyodide(config={stdout, stderr}), emscripten-level C stdout/stderr
        // pipes are already connected through those config callbacks, so the
        // entire runPythonAsync setup block and the window._appendPyOutput bridge
        // are removed.

        pyodideReady = true;
        setReadyStatus();

        return pyodideInst;

    } catch(err) {
        setErrorStatus('\u52a0\u8f7d\u5931\u8d25: ' + err.message);
        throw err;
    }
}

// [v314] window._appendPyOutput bridge REMOVED -- no longer needed since
// v0.27 used it as the target of a Python-side JsWriter(sys.stdout).
// The emscripten pipe goes straight through initPyodide config callbacks.

function setLoadingStatus(loading, text) {
    var badge = document.getElementById('statusBadge');
    var stxt  = document.getElementById('statusText');
    badge.className = 'status-badge' + (loading ? ' loading' : '');
    stxt.textContent = text;
}

function setReadyStatus() {
    var badge = document.getElementById('statusBadge');
    var stxt  = document.getElementById('statusText');
    badge.className = 'status-badge ready';
    stxt.textContent = 'Pyodide \u5c31\u7eea';
}

function setErrorStatus(text) {
    var badge = document.getElementById('statusBadge');
    var stxt  = document.getElementById('statusText');
    badge.className = 'status-badge error';
    stxt.textContent = text;
}

async function runCode() {
    if (running) return;
    if (!pyodideReady) {
        showToastApp('\u6b63\u5728\u52a0\u8f7d Pyodide\uff0c\u8bf7\u7a0d\u5019...', 'info');
        return;
    }

    var code = cleanStringForPython(getActiveEditorValue());
    if (!code.trim()) {
        showToastApp('\u4ee3\u7801\u4e3a\u7a7a\uff0c\u8bf7\u8f93\u5165\u5185\u5bb9', 'info');
        return;
    }

    // Clear previous output for fresh run
    clearOutput();
    appendOutput('# \u279c \u8fd0\u884c\u5f00\u59cb \u2014\u2014 ' + new Date().toLocaleTimeString('zh-CN'), 'info');

    running = true;
    var runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;
    runBtn.classList.add('running');
    runBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;"></span><span class="btn-label">\u8fd0\u884c\u4e2d...</span>';

    try {
        // [v314] loadPackagesFromImports and runPythonAsync via pyodideCore
        // v0.27: await pyodideInst.loadPackagesFromImports(...); await pyodideInst.runPythonAsync(...)
        await pyodideCore.loadPkgsFromImports(code, {
            messageCallback: function(msg) {
                appendOutput('[\u52a0\u8f7d] ' + msg, 'info');
            }
        });
        await pyodideCore.runPythonAsync(code);
        appendOutput('# \u2705 \u6267\u884c\u5b8c\u6210 \u2014\u2014 ' + new Date().toLocaleTimeString('zh-CN'), 'success');
    } catch(err) {
        appendOutput(String(err), 'stderr');
    } finally {
        running = false;
        runBtn.disabled = false;
        runBtn.classList.remove('running');
        runBtn.innerHTML = '<span>&#x25b6;</span><span class="btn-label">\u8fd0\u884c</span>';
    }
}

// ---------------------------------------------------------------------------
// Console input (interactive REPL)
// ---------------------------------------------------------------------------
async function handleConsoleInput() {
    var inputEl = document.getElementById('consoleInput');
    var expr = inputEl.value.trim();
    if (!expr) return;
    inputEl.value = '';

    appendOutput('> ' + expr, 'info');

    if (!pyodideReady) {
        appendOutput('\u26a0\ufe0f Pyodide \u8fd8\u672a\u5c31\u7eea\uff0c\u8bf7\u7a0d\u5019...', 'stderr');
        return;
    }

    try {
        // [v314] runPythonAsync via pyodideCore; returns JS-friendly values
        var cleanedExpr = cleanStringForPython(expr);
        // v314: runPythonAsync returns JS-friendly values
        var result = await pyodideCore.runPythonAsync(cleanedExpr);
        if (result !== undefined && result !== null) {
            appendOutput(String(result), 'stdout');
        }
    } catch(err) {
        appendOutput(String(err), 'stderr');
    }
}

// ---------------------------------------------------------------------------
// Layout toggle
// ---------------------------------------------------------------------------
function toggleLayout() {
    var main = document.getElementById('mainSplit');
    var icon = document.getElementById('layoutIcon');
    var lbl  = document.getElementById('layoutLabel');

    if (layoutMode === 'right') {
        layoutMode = 'bottom';
        main.className = 'main-layout bottom-split';
        icon.textContent = '\u25b3';
        lbl.textContent  = '\u4e0b\u65b9\u8f93\u51fa';
    } else {
        layoutMode = 'right';
        main.className = 'main-layout split-view';
        icon.textContent = '\u2b05';
        lbl.textContent  = '\u53f3\u4fa7\u8f93\u51fa';
    }
    // Force refresh editor size
    setTimeout(function() { if (editor) editor.refresh(); }, 100);
}

// ---------------------------------------------------------------------------
// Examples menu
// ---------------------------------------------------------------------------
function buildExamplesMenu() {
    var menu = document.getElementById('examplesMenu');
    EXAMPLES.forEach(function(ex) {
        var item = document.createElement('div');
        item.className = 'example-item';
        item.innerHTML = '<span class="example-icon">' + ex.icon + '</span><span>' + escapeHtml(ex.name) + '</span>';
        item.addEventListener('click', function() {
            createFile(ex.name, ex.code);
            menu.classList.remove('show');
        });
        menu.appendChild(item);
    });
}

// ---------------------------------------------------------------------------
// Loading indicators
// ---------------------------------------------------------------------------
function updateLoadingText(main, detail) {
    var mt = document.getElementById('loadingText');
    var dt = document.getElementById('loadingDetail');
    if (mt) mt.textContent = main || mt.textContent;
    if (dt) dt.textContent = detail || dt.textContent;
}

function hideLoading() {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
    setTimeout(function() {
        var o = document.getElementById('loadingOverlay');
        if (o) o.style.display = 'none';
    }, 500);
}

// ---------------------------------------------------------------------------
// Initialization -- show UI immediately, load Pyodide in background
// ---------------------------------------------------------------------------
async function init() {
    // 1. Show UI IMMEDIATELY (no waiting for Pyodide)
    hideLoading();
    document.getElementById('appContainer').style.display = '';

    // 2. Build UI components (all cheap DOM operations)
    buildExamplesMenu();

    // Event bindings
    document.getElementById('runBtn').addEventListener('click', runCode);
    document.getElementById('clearOutputBtn').addEventListener('click', clearOutput);
    document.getElementById('clearOutputSmallBtn').addEventListener('click', clearOutput);
    document.getElementById('copyOutputBtn').addEventListener('click', copyOutput);
    document.getElementById('copyOutputSmallBtn').addEventListener('click', copyOutput);
    document.getElementById('layoutBtn').addEventListener('click', toggleLayout);
    document.getElementById('addTabBtn').addEventListener('click', function() {
        createFile();
    });

    // Examples dropdown toggle
    var exBtn = document.getElementById('examplesBtn');
    var exMenu = document.getElementById('examplesMenu');
    exBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        exMenu.classList.toggle('show');
    });
    document.addEventListener('click', function() { exMenu.classList.remove('show'); });

    // Console input
    document.getElementById('consoleInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConsoleInput();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+T: new file
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            createFile();
        }
        // Ctrl+S: save/download current file
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadCurrentFile();
        }
        // Ctrl+L: clear output
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            clearOutput();
        }
    });

    // 3. Create welcome tab and switch editor into DOM
    var welcomeId = createFile('welcome.py', WELCOME_CODE);
    switchFile(welcomeId);

    // 4. Fire Pyodide loading in background (non-blocking)
    startPyodideBoot();
}

// Start Pyodide background loading with progress updates
function startPyodideBoot() {
    setLoadingStatus(true, '\u521d\u59cb\u5316\u4e2d...');
    document.getElementById('runBtn').disabled = true;
    document.getElementById('runBtn').innerHTML = '<span>\u231b</span><span class="btn-label">\u7b49\u5f85 Pyodide...</span>';

    ensurePyodide().then(function() {
        document.getElementById('runBtn').disabled = false;
        document.getElementById('runBtn').innerHTML = '<span>&#x25b6;</span><span class="btn-label">\u8fd0\u884c</span>';
    }).catch(function(err) {
        setErrorStatus('\u274c \u52a0\u8f7d\u5931\u8d25');
        showToastApp('Pyodide \u52a0\u8f7d\u5931\u8d25: ' + err.message, 'error');
        // Re-enable run button so user can retry
        document.getElementById('runBtn').disabled = false;
        document.getElementById('runBtn').innerHTML = '<span>&#x25b6;</span><span class="btn-label">\u91cd\u8bd5</span>';
        document.getElementById('runBtn').addEventListener('click', function() {
            document.getElementById('runBtn').disabled = true;
            startPyodideBoot();
        }, { once: true });
    });
}

// Download current file as .py
function downloadCurrentFile() {
    var ae = getActiveEditor();
    var f = getFile(activeFileId);
    if (!ae || !f) return;
    var code = ae.getValue();
    var blob = new Blob([code], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (f.name || 'untitled') + '.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    showToastApp('\u6587\u4ef6\u5df2\u4e0b\u8f7d', 'success');
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
