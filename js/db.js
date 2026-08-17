const DB_NAME = "glide";
const DB_VERSION = 1;
const STORE = "swims";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

const PENDING_KEY = "glidePendingBackup";

function markDirty() {
  const wasClean = localStorage.getItem(PENDING_KEY) !== "true";
  localStorage.setItem(PENDING_KEY, "true");
  if (wasClean) window.dispatchEvent(new Event("swimdata-dirty"));
}

const SwimStore = {
  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
      req.onerror = () => reject(req.error);
    });
  },
  async put(swim) {
    const result = await withStore("readwrite", (store) => store.put(swim));
    markDirty();
    return result;
  },
  async remove(id) {
    const result = await withStore("readwrite", (store) => store.delete(id));
    markDirty();
    return result;
  },
};
