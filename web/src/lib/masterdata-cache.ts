/**
 * IndexedDB cache layer for masterdata and translations.
 * Provides persistent browser-side caching with version-aware invalidation.
 * Zero dependencies — uses native IndexedDB API with Promise wrappers.
 */

const DB_NAME = "snowy-cache";
const DB_VERSION = 1;

// Store names
const STORE_MASTERDATA = "masterdata";
const STORE_TRANSLATIONS = "translations";

// Cache entry structure
interface CacheEntry<T = unknown> {
    path: string;       // key: file path (e.g. "cards.json")
    data: T;            // the JSON payload
    version: string;    // masterdata version when cached
    cachedAt: number;   // timestamp
}

interface TranslationCacheEntry<T = unknown> {
    path: string;       // key: file path (e.g. "/data/translations/cards.json")
    data: T;
    hash: string;       // simple hash for invalidation
    cachedAt: number;
}

// Singleton DB promise
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open (or create) the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_MASTERDATA)) {
                db.createObjectStore(STORE_MASTERDATA, { keyPath: "path" });
            }
            if (!db.objectStoreNames.contains(STORE_TRANSLATIONS)) {
                db.createObjectStore(STORE_TRANSLATIONS, { keyPath: "path" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            console.warn("[Cache] Failed to open IndexedDB:", request.error);
            dbPromise = null; // Allow retry on next call
            reject(request.error);
        };
    });

    return dbPromise;
}

/**
 * Generic IDB get helper
 */
async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Generic IDB put helper
 */
async function idbPut<T>(storeName: string, value: T): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

/**
 * Clear all entries in a store
 */
async function idbClear(storeName: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ==================== MasterData Cache ====================

/**
 * Get cached masterdata if version matches
 */
export async function getMasterDataCache<T>(path: string, version: string): Promise<T | null> {
    try {
        const entry = await idbGet<CacheEntry<T>>(STORE_MASTERDATA, path);
        if (entry && entry.version === version) {
            return entry.data;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Save masterdata to cache
 */
export async function setMasterDataCache<T>(path: string, data: T, version: string): Promise<void> {
    try {
        const entry: CacheEntry<T> = {
            path,
            data,
            version,
            cachedAt: Date.now(),
        };
        await idbPut(STORE_MASTERDATA, entry);
    } catch (e) {
        console.warn("[Cache] Failed to write masterdata cache:", path, e);
    }
}

/**
 * Clear all masterdata cache (used on force refresh or version change)
 */
export async function clearMasterDataCache(): Promise<void> {
    try {
        await idbClear(STORE_MASTERDATA);
        console.log("[Cache] MasterData cache cleared");
    } catch (e) {
        console.warn("[Cache] Failed to clear masterdata cache:", e);
    }
}

// ==================== Translation Cache ====================

/**
 * Get cached translation data
 * @param path - translation file path
 * @param hash - current hash for validation (use version or build hash)
 */
export async function getTranslationCache<T>(path: string, hash: string): Promise<T | null> {
    try {
        const entry = await idbGet<TranslationCacheEntry<T>>(STORE_TRANSLATIONS, path);
        if (entry && entry.hash === hash) {
            return entry.data;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Save translation data to cache
 */
export async function setTranslationCache<T>(path: string, data: T, hash: string): Promise<void> {
    try {
        const entry: TranslationCacheEntry<T> = {
            path,
            data,
            hash,
            cachedAt: Date.now(),
        };
        await idbPut(STORE_TRANSLATIONS, entry);
    } catch (e) {
        console.warn("[Cache] Failed to write translation cache:", path, e);
    }
}

/**
 * Clear all translation cache
 */
export async function clearTranslationCache(): Promise<void> {
    try {
        await idbClear(STORE_TRANSLATIONS);
        console.log("[Cache] Translation cache cleared");
    } catch (e) {
        console.warn("[Cache] Failed to clear translation cache:", e);
    }
}

// ==================== Full Cache Clear ====================

/**
 * Clear everything (masterdata + translations)
 */
export async function clearAllCache(): Promise<void> {
    await Promise.all([
        clearMasterDataCache(),
        clearTranslationCache(),
    ]);
}

/**
 * Check if IndexedDB is available in this environment
 */
export function isIndexedDBAvailable(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}
