// ============================================================
//  INDEXEDDB STORAGE LAYER
// ============================================================
var db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = function() { reject(request.error); };
    request.onblocked = function() { reject(new Error('IndexedDB upgrade is blocked by another tab')); };
    request.onsuccess = function() {
      db = request.result;
      db.onversionchange = function() { db.close(); };
      resolve(db);
    };
    request.onupgradeneeded = function(event) {
      var database = event.target.result;
      if (!database.objectStoreNames.contains('articles')) {
        database.createObjectStore('articles', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('translations')) {
        database.createObjectStore('translations', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('wordTranslations')) {
        database.createObjectStore('wordTranslations', { keyPath: 'key' });
      }
    };
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('IndexedDB is not initialized')); return; }
    var tx = db.transaction(store, 'readonly');
    var req = tx.objectStore(store).getAll();
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
    tx.onerror = function() { reject(tx.error || new Error('IndexedDB read failed')); };
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('IndexedDB is not initialized')); return; }
    var tx = db.transaction(store, 'readonly');
    var req = tx.objectStore(store).get(key);
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
    tx.onerror = function() { reject(tx.error || new Error('IndexedDB read failed')); };
  });
}

function dbPut(store, value) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('IndexedDB is not initialized')); return; }
    var tx = db.transaction(store, 'readwrite');
    var req = tx.objectStore(store).put(value);
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
    tx.onerror = function() { reject(tx.error || new Error('IndexedDB write failed')); };
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('IndexedDB is not initialized')); return; }
    var tx = db.transaction(store, 'readwrite');
    var req = tx.objectStore(store).delete(key);
    req.onsuccess = function() { resolve(); };
    req.onerror = function() { reject(req.error); };
    tx.onerror = function() { reject(tx.error || new Error('IndexedDB delete failed')); };
  });
}

function dbAdd(store, value) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('IndexedDB is not initialized')); return; }
    var tx = db.transaction(store, 'readwrite');
    var req = tx.objectStore(store).add(value);
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
    tx.onerror = function() { reject(tx.error || new Error('IndexedDB write failed')); };
  });
}
