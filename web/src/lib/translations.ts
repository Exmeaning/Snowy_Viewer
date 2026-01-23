/**
 * Translation utilities for Japanese -> Chinese translations
 * Translation data is stored as static JSON files in /public/data/translations/
 */

// Translation map type: original Japanese text -> Chinese translation
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
};

// Cache for loaded translations
let translationCache: TranslationData | null = null;
let loadingPromise: Promise<TranslationData> | null = null;

/**
 * Load all translation data from JSON files
 * Returns cached data if already loaded
 */
export async function loadTranslations(): Promise<TranslationData> {
    // Return cached data if available
    if (translationCache) {
        return translationCache;
    }

    // If already loading, wait for that promise
    if (loadingPromise) {
        return loadingPromise;
    }

    // Start loading
    loadingPromise = (async (): Promise<TranslationData> => {
        try {
            const baseUrl = "/data/translations";

            // Load all translation files in parallel
            const [cards, events, music, virtualLive, mysekai, gacha, sticker, comic, characters, units] = await Promise.all([
                fetchTranslationFile<TranslationData["cards"]>(`${baseUrl}/cards.json`),
                fetchTranslationFile<TranslationData["events"]>(`${baseUrl}/events.json`),
                fetchTranslationFile<TranslationData["music"]>(`${baseUrl}/music.json`),
                fetchTranslationFile<TranslationData["virtualLive"]>(`${baseUrl}/virtualLive.json`),
                fetchTranslationFile<TranslationData["mysekai"]>(`${baseUrl}/mysekai.json`),
                fetchTranslationFile<TranslationData["gacha"]>(`${baseUrl}/gacha.json`),
                fetchTranslationFile<TranslationData["sticker"]>(`${baseUrl}/sticker.json`),
                fetchTranslationFile<TranslationData["comic"]>(`${baseUrl}/comic.json`),
                fetchTranslationFile<TranslationData["characters"]>(`${baseUrl}/characters.json`),
                fetchTranslationFile<TranslationData["units"]>(`${baseUrl}/units.json`),
            ]);

            const result: TranslationData = {
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
            };

            translationCache = result;
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
 */
export function clearTranslationCache(): void {
    translationCache = null;
    loadingPromise = null;
}
