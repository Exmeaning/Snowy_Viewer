export const LYRICS_ALIAS_INDEX_URL = "https://translation.exmeaning.com/files/data/search-index.json";

/**
 * Parse the shared NextTrans search index into stable music-ID aliases.
 * Malformed rows are ignored so this optional enhancement cannot break the
 * primary lyrics catalog.
 *
 * @param {unknown} value
 * @returns {Map<number, string[]>}
 */
export function buildMusicAliasesById(value) {
    const aliasesByMusicId = new Map();
    const duplicateMusicIds = new Set();
    if (!Array.isArray(value)) return aliasesByMusicId;

    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const { g, id, a } = item;
        if (
            g !== "music"
            || !Number.isSafeInteger(id)
            || id <= 0
            || !Array.isArray(a)
            || a.some((alias) => typeof alias !== "string")
            || duplicateMusicIds.has(id)
        ) continue;

        if (aliasesByMusicId.has(id)) {
            aliasesByMusicId.delete(id);
            duplicateMusicIds.add(id);
            continue;
        }
        const aliases = [...new Set(a.map((alias) => alias.trim()).filter(Boolean))];
        if (aliases.length) aliasesByMusicId.set(id, aliases);
    }
    return aliasesByMusicId;
}
