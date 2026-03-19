/**
 * Translation utilities for Japanese -> Chinese translations
 * Translation data is stored as static JSON files in /public/data/translations/
 * 
 * IndexedDB caching: Translation data is persisted in IndexedDB and keyed by
 * a version hash derived from the masterdata version. On version change,
 * stale translation cache entries are automatically invalidated.
 */

import { getTranslationCache, setTranslationCache, isIndexedDBAvailable } from "./masterdata-cache";
import { MASTERDATA_VERSION_KEY } from "./fetch";

// Base URL for all translation data
export const TRANSLATION_BASE_URL = "https://translation.exmeaning.com/translation";
export interface TranslationMap {
    [key: string]: string;
}

// Full translation data structure
export interface TranslationData {
    cards: {
        prefix: TranslationMap;      // Card prefix/title translations
        skillName: TranslationMap;   // Skill name translations
    };
    events: {
        name: TranslationMap;        // Event name translations
    };
    music: {
        title: TranslationMap;       // Song title translations
        artist: TranslationMap;      // Lyricist/composer/arranger names
        vocalCaption: TranslationMap; // Vocal version caption translations
    };
    virtualLive: {
        name: TranslationMap;        // Virtual live name translations
    };
    mysekai: {
        fixtureName: TranslationMap; // Fixture name translations
        flavorText: TranslationMap;  // Fixture flavor text translations
        genre: TranslationMap;       // Genre name translations
        subGenre: TranslationMap;    // Sub-genre name translations
        tag: TranslationMap;         // Tag name translations
        material: TranslationMap;    // Material name translations
    };
    gacha: {
        name: TranslationMap;        // Gacha name translations
    };
    sticker: {
        name: TranslationMap;        // Sticker name translations
    };
    comic: {
        title: TranslationMap;       // Comic title translations
    };
    characters: {
        hobby: TranslationMap;
        specialSkill: TranslationMap;
        favoriteFood: TranslationMap;
        hatedFood: TranslationMap;
        weak: TranslationMap;
        introduction: TranslationMap;
    };
    units: {
        unitName: TranslationMap;
        profileSentence: TranslationMap;
    };
    costumes: {
        name: TranslationMap;        // Costume name translations
        colorName: TranslationMap;   // Color variant name translations
        designer: TranslationMap;    // Designer name translations
    };
}

// Default empty translation data
const emptyTranslationData: TranslationData = {
    cards: { prefix: {}, skillName: {} },
    events: { name: {} },
    music: { title: {}, artist: {}, vocalCaption: {} },
    virtualLive: { name: {} },
    mysekai: { fixtureName: {}, flavorText: {}, genre: {}, subGenre: {}, tag: {}, material: {} },
    gacha: { name: {} },
    sticker: { name: {} },
    comic: { title: {} },
    characters: { hobby: {}, specialSkill: {}, favoriteFood: {}, hatedFood: {}, weak: {}, introduction: {} },
    units: { unitName: {}, profileSentence: {} },
    costumes: { name: {}, colorName: {}, designer: {} },
};

// Cache for loaded translations (in-memory, per session)
let translationCache: TranslationData | null = null;
let loadingPromise: Promise<TranslationData> | null = null;

// IndexedDB cache key for the combined translation bundle
const TRANSLATION_IDB_KEY = "translations-bundle";

// Translation cache TTL: 30 minutes (faster propagation for proofreading updates)
const TRANSLATION_CACHE_TTL = 30 * 60 * 1000;

// Key for storing translation cache timestamp in localStorage
const TRANSLATION_CACHE_TIME_KEY = "translation-cache-time";

// Key for forcing translation cache-bust when proofreading updates occur
const TRANSLATION_DATA_VERSION_KEY = "translation-data-version";

/**
 * Get the current translation version hash.
 * Uses masterdata version from localStorage as the invalidation key.
 * Falls back to a static string if no version is available.
 */
function getTranslationVersionHash(): string {
    if (typeof window === "undefined") return "build";
    const masterVersion = localStorage.getItem(MASTERDATA_VERSION_KEY) || "unknown";
    const translationVersion = localStorage.getItem(TRANSLATION_DATA_VERSION_KEY) || "0";
    return `${masterVersion}:${translationVersion}`;
}

function getTranslationDataVersion(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(TRANSLATION_DATA_VERSION_KEY) || "";
}

/**
 * Check if translation cache has expired (TTL-based)
 */
function isTranslationCacheStale(): boolean {
    if (typeof window === "undefined") return true;
    const cachedTime = localStorage.getItem(TRANSLATION_CACHE_TIME_KEY);
    if (!cachedTime) return true;
    return Date.now() - Number(cachedTime) > TRANSLATION_CACHE_TTL;
}

/**
 * Fetch all translation files from network.
 * Translation data is served from the MoeSekai-Hub static deployment.
 */
async function fetchAllTranslations(): Promise<TranslationData> {
    const baseUrl = TRANSLATION_BASE_URL;
    const version = getTranslationDataVersion();
    const query = version ? `?v=${encodeURIComponent(version)}` : "";

    const [cards, events, music, virtualLive, mysekai, gacha, sticker, comic, characters, units, costumes] = await Promise.all([
        fetchTranslationFile<TranslationData["cards"]>(`${baseUrl}/cards.json${query}`),
        fetchTranslationFile<TranslationData["events"]>(`${baseUrl}/events.json${query}`),
        fetchTranslationFile<TranslationData["music"]>(`${baseUrl}/music.json${query}`),
        fetchTranslationFile<TranslationData["virtualLive"]>(`${baseUrl}/virtualLive.json${query}`),
        fetchTranslationFile<TranslationData["mysekai"]>(`${baseUrl}/mysekai.json${query}`),
        fetchTranslationFile<TranslationData["gacha"]>(`${baseUrl}/gacha.json${query}`),
        fetchTranslationFile<TranslationData["sticker"]>(`${baseUrl}/sticker.json${query}`),
        fetchTranslationFile<TranslationData["comic"]>(`${baseUrl}/comic.json${query}`),
        fetchTranslationFile<TranslationData["characters"]>(`${baseUrl}/characters.json${query}`),
        fetchTranslationFile<TranslationData["units"]>(`${baseUrl}/units.json${query}`),
        fetchTranslationFile<TranslationData["costumes"]>(`${baseUrl}/costumes.json${query}`),
    ]);

    return {
        cards: cards ?? emptyTranslationData.cards,
        events: events ?? emptyTranslationData.events,
        music: music ?? emptyTranslationData.music,
        virtualLive: virtualLive ?? emptyTranslationData.virtualLive,
        mysekai: mysekai ?? emptyTranslationData.mysekai,
        gacha: gacha ?? emptyTranslationData.gacha,
        sticker: sticker ?? emptyTranslationData.sticker,
        comic: comic ?? emptyTranslationData.comic,
        characters: characters ?? emptyTranslationData.characters,
        units: units ?? emptyTranslationData.units,
        costumes: costumes ?? emptyTranslationData.costumes,
    };
}

/**
 * Background revalidation: fetch fresh translations and update cache if changed.
 * Runs silently without blocking the UI.
 */
function backgroundRevalidateTranslations(versionHash: string): void {
    fetchAllTranslations()
        .then((fresh) => {
            // Update in-memory cache
            translationCache = fresh;
            // Update IndexedDB cache
            if (isIndexedDBAvailable()) {
                setTranslationCache(TRANSLATION_IDB_KEY, fresh, versionHash).catch(() => { });
            }
            // Update timestamp
            localStorage.setItem(TRANSLATION_CACHE_TIME_KEY, Date.now().toString());
        })
        .catch(() => {
            // Silent fail — stale data is better than no data
        });
}

/**
 * Load all translation data from JSON files
 * Returns cached data if already loaded (memory → IndexedDB → network)
 * Uses stale-while-revalidate: returns cached data immediately, refreshes in background if stale.
 */
export async function loadTranslations(): Promise<TranslationData> {
    // 1. Return in-memory cache if available
    if (translationCache) {
        // If cache is stale, trigger background revalidation
        if (isTranslationCacheStale()) {
            backgroundRevalidateTranslations(getTranslationVersionHash());
        }
        return translationCache;
    }

    // If already loading, wait for that promise
    if (loadingPromise) {
        return loadingPromise;
    }

    // Start loading
    loadingPromise = (async (): Promise<TranslationData> => {
        const versionHash = getTranslationVersionHash();

        // 2. Try IndexedDB cache
        if (isIndexedDBAvailable()) {
            try {
                const cached = await getTranslationCache<TranslationData>(TRANSLATION_IDB_KEY, versionHash);
                if (cached) {
                    translationCache = cached;
                    // If stale, revalidate in background (stale-while-revalidate)
                    if (isTranslationCacheStale()) {
                        backgroundRevalidateTranslations(versionHash);
                    }
                    return cached;
                }
            } catch {
                // IndexedDB read failed, fall through to network
            }
        }

        // 3. Fetch from network (cache miss)
        try {
            const result = await fetchAllTranslations();
            translationCache = result;

            // 4. Write to IndexedDB (async, non-blocking)
            if (isIndexedDBAvailable()) {
                setTranslationCache(TRANSLATION_IDB_KEY, result, versionHash).catch(() => { });
            }
            // Update timestamp
            if (typeof window !== "undefined") {
                localStorage.setItem(TRANSLATION_CACHE_TIME_KEY, Date.now().toString());
            }

            return result;
        } catch (error) {
            console.error("Failed to load translations:", error);
            return emptyTranslationData;
        }
    })();

    return loadingPromise;
}

/**
 * Fetch a single translation file, returns null if not found
 */
async function fetchTranslationFile<T>(url: string): Promise<T | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Translation file not found is normal during development
            console.debug(`Translation file not found: ${url}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.debug(`Failed to fetch translation file: ${url}`, error);
        return null;
    }
}

/**
 * Get translation for a text, with fallback to original
 * @param map Translation map to look up
 * @param key Original Japanese text
 * @param fallback Fallback text if translation not found (defaults to key)
 * @returns Translated text or fallback
 */
export function getTranslation(map: TranslationMap | undefined, key: string, fallback?: string): string {
    if (!map || !key) return fallback ?? key;
    return map[key] ?? fallback ?? key;
}

/**
 * Check if a translation exists
 */
export function hasTranslation(map: TranslationMap | undefined, key: string): boolean {
    if (!map || !key) return false;
    return key in map;
}

/**
 * Clear the translation cache (useful for testing or forced refresh)
 * Clears both in-memory and IndexedDB caches.
 */
export function clearTranslationCache(): void {
    translationCache = null;
    loadingPromise = null;
    // Also clear IndexedDB translation cache
    if (isIndexedDBAvailable()) {
        import("./masterdata-cache").then(m => m.clearTranslationCache()).catch(() => { });
    }
}

/**
 * Mark translations as updated by proofreading actions.
 * This bumps a local version key to force cache-busting query params
 * and clears current caches so subsequent page loads fetch fresh files.
 */
export function markTranslationsUpdated(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TRANSLATION_DATA_VERSION_KEY, Date.now().toString());
    localStorage.removeItem(TRANSLATION_CACHE_TIME_KEY);
    clearTranslationCache();
}
