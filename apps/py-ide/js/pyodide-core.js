/**
 * Pyodide Core Module v314.0.3
 * ---------------------------------------------------------------
 * Centralised wrapper for Pyodide loading, initialisation and execution.
 *
 * Key migration changes from v0.27.1:
 *   - Pyodide now ships as Python 3.14 (version number = major Python version)
 *   - stdout / stderr are configured at load time via the loadPyodide() config
 *     object instead of assigning .stdout/.stderr on the instance after loading.
 *   - The Python-side JsWriter redirect is no longer needed because the
 *     emscripten-level C stdout/stderr pipes are already connected through the
 *     config callbacks.
 *   - CDN URLs moved to use the new version-numbered release path.
 *
 * Public API (attached to window.pyodideCore):
 *   - initPyodide(stdoutCb, stderrCb)      Initialise & return the pyodide instance.
 *   - runPythonAsync(code)                  Execute Python code asynchronously.
 *   - loadPkgsFromImports(code, msgCb)      Load packages declared in imports.
 *   - getPyodideInstance()                  Return the loaded instance or null.
 *   - isReady                               Boolean flag — is Pyodide ready?
 */

/* ========================================================================
 * 1. Mirror-chain constants
 * ======================================================================== */

/*Base directory that contains all full-distribution assets (index.mjs,
 pyodide.js, packages.json, standard-library wheels, etc.).*/
var PYODIDE_BASE = 'https://cdn.jsdmirror.com/pyodide/v314.0.3/full/';

// Fallback chain for the UMD entry point (pyodide.js).
// In v314 this file exposes `loadPyodide` on both `globalThis` and as an ES
// module export.  We use it as a plain <script> so `globalThis.loadPyodide`
// is available immediately after load succeeds.
var _PYO_CHAIN = [
    'https://cdn.jsdmirror.com/pyodide/v314.0.3/full/pyodide.js',
    'https://cdn.jsdmirror.cn/pyodide/v314.0.3/full/pyodide.js',
    'https://jsdelivr.aby.pub/pyodide/v314.0.3/full/pyodide.js',
    'https://jsd.cdn.zzko.cn/pyodide/v314.0.3/full/pyodide.js',
    'https://jsd.onmicrosoft.cn/pyodide/v314.0.3/full/pyodide.js',
    'https://gcore.jsdelivr.net/pyodide/v314.0.3/full/pyodide.js',
];

/* ========================================================================
 * 2. Internal state
 * ======================================================================== */

var _instance   = null;   // pyodide runtime instance
var _ready      = false;  // true once loadPyodide() resolves
var _loading    = null;   // Promise<PyodideInstance> while booting
var _stdoutCb   = null;   // callback supplied by caller to initPyodide()
var _stderrCb   = null;

/* ========================================================================
 * 3. Script loader with mirror fallback
 * ------------------------------------------------------------------------
 * Dynamically injects <script> tags one by one until one succeeds.
 * The base URL is inferred from whichever mirror loaded first.
 * ======================================================================== */

function _loadScriptFallback(urls, onLoaded, onError) {
    var idx = 0;

    function tryNext() {
        if (idx >= urls.length) {
            // All mirrors failed — signal error but do NOT crash the page.
            if (onError) onError(new Error('All Pyodide CDN mirrors failed'));
            return;
        }
        var s = document.createElement('script');
        s.src = urls[idx];
        s.async = true;

        s.onload = function () {
            // Derive the base URL from the successful mirror.
            var mirror = urls[idx].replace('/pyodide.js', '/');
            if (onLoaded) onLoaded(mirror);
            document.body.removeChild(s);
        };

        s.onerror = function () {
            s.remove();
            idx++;
            tryNext();
        };

        document.head.appendChild(s);
    }

    tryNext();
}

/* ========================================================================
 * 4. Core public API
 * ======================================================================== */

/**
 * Initialise Pyodide.
 *
 * @param {Function} stdoutCb  Called with every stdout line.
 * @param {Function} stderrCb  Called with every stderr line.
 * @returns {Promise<object>}   The pyodide runtime instance.
 *
 * Migration notes (v0.27 → v314):
 *   • stdout/stderr are now passed IN the loadPyodide() config object
 *     rather than assigned as `.stdout` / `.stderr` properties afterwards.
 *   • The old Python-side `JsWriter` class + `from pyodide.ffi import JsProxy`
 *     block has been removed entirely — emscripten's C-level pipes already
 *     carry print() output through the config callbacks.
 */
async function initPyodide(stdoutCb, stderrCb) {
    _stdoutCb = stdoutCb || function () {};
    _stderrCb = stderrCb || function () {};

    if (_ready && _instance) return _instance;
    if (_loading) return _loading;

    // --- Step 1: ensure loadPyodide global is available -------------------
    if (typeof globalThis.loadPyodide === 'function') {
        // Already loaded (e.g. the HTML preloads pyodide.js before this script
        // runs). Skip the mirror chain and go straight to initialisation.
        // No need to update PYODIDE_BASE -- it already has the correct default.
    } else {
        await new Promise(function (resolve, reject) {
            _loadScriptFallback(
                _PYO_CHAIN,
                function (base) { PYODIDE_BASE = base; resolve(); },
                reject
            );
        });

        // Sanity check — did any mirror actually expose loadPyodide?
        if (typeof globalThis.loadPyodide !== 'function') {
            throw new Error('loadPyodide not found after mirror fallback exhausted');
        }
    }

    // --- Step 2: load the runtime -----------------------------------------
    // Migration: in v314 stdout/stderr MUST be in the config object.
    // Passing them as instance properties AFTER loading is ignored.
    _loading = (async function () {
        var inst = await globalThis.loadPyodide({
            indexURL: PYODIDE_BASE,
            stdout: _stdoutCb,
            stderr: _stderrCb,
        });

        _instance  = inst;
        _ready     = true;
        _loading   = null;
        return inst;
    })();

    return _loading;
}

/**
 * Run Python code asynchronously.
 *
 * @param {string} code
 * @returns {Promise<*>} Result value (converted to JS object).
 */
async function runPythonAsync(code) {
    if (!_ready || !_instance) {
        throw new Error('Pyodide not initialised — call initPyodide() first');
    }
    return _instance.runPythonAsync(code);
}

/**
 * Load micropackages declared in a code string's import statements,
 * then return (without executing the code).
 *
 * @param {string}   code
 * @param {Function} [messageCallback]  Called per package-load log message.
 * @returns {Promise<void>}
 */
async function loadPkgsFromImports(code, messageCallback) {
    if (!_ready || !_instance) {
        throw new Error('Pyodide not initialised — call initPyodide() first');
    }
    return _instance.loadPackagesFromImports(code, {
        messageCallback: messageCallback || function () {},
    });
}

/**
 * @returns {object|null}  The current pyodide instance, or null if not yet loaded.
 */
function getPyodideInstance() {
    return _instance;
}

/* ========================================================================
 * 5. Attach to global scope — matches the existing `window.pyodideCore`
 *    pattern used elsewhere in the application.
 * ======================================================================== */

window.pyodideCore = {
    initPyodide:        initPyodide,
    runPythonAsync:     runPythonAsync,
    loadPkgsFromImports:loadPkgsFromImports,
    getPyodideInstance: getPyodideInstance,
    get isReady()      { return _ready; },
};

/* ========================================================================
 * 6. Kick off the CDN probe silently so that by the time initPyodide() is
 *    called the script is likely already cached.
 *
 *    This mirrors the old inline behaviour (deferred until DOM ready) but
 *    is now encapsulated inside the core module itself.
 * ======================================================================== */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        // Pre-warm: start loading the first mirror immediately.
        _loadScriptFallback(
            _PYO_CHAIN,
            function (base) { PYODIDE_BASE = base; },
            null  // ignore failures during pre-warm
        );
    });
} else {
    // DOM already ready
    _loadScriptFallback(
        _PYO_CHAIN,
        function (base) { PYODIDE_BASE = base; },
        null
    );
}
