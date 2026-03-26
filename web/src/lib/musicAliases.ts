/**
 * Music Alias Data Fetching
 *
 * Fetches music aliases from haruki's community-driven alias database.
 * Source: https://moe.exmeaning.com/data/music_alias/music_aliases.json
 *
 * Note: Aliases are user-submitted and maintained by the haruki project,
 * independent of Moesekai.
 */

import { fetchWithCompression } from "./fetch";

// API endpoint for music aliases
const MUSIC_ALIASES_URL = "https://moe.exmeaning.com/data/music_alias/music_aliases.json";

/**
 * Single music alias entry from the alias database
 */
export interface MusicAliasEntry {
    music_id: number;
    title: string;
    aliases: string[];
}

/**
 * Full alias data structure
 */
export interface MusicAliasData {
    generated_at: string;
    source: {
        musics: string;
        alias_api: string;
    };
    musics: MusicAliasEntry[];
}

// Module-level cache for aliases (Map<musicId, aliases[]>)
let cachedAliasesMap: Map<number, string[]> | null = null;

/**
 * Fetch music aliases from the CDN
 * Results are cached in memory for the session
 *
 * @returns Map of musicId -> aliases array
 */
export async function fetchMusicAliases(): Promise<Map<number, string[]>> {
    // Return cached data if available
    if (cachedAliasesMap) {
        return cachedAliasesMap;
    }

    try {
        const response = await fetchWithCompression(MUSIC_ALIASES_URL);
        if (!response.ok) {
            console.warn(`[MusicAliases] Failed to fetch: HTTP ${response.status}`);
            return new Map();
        }

        const data: MusicAliasData = await response.json();

        // Build the map
        const map = new Map<number, string[]>();
        for (const entry of data.musics) {
            map.set(entry.music_id, entry.aliases);
        }

        // Cache the result
        cachedAliasesMap = map;
        console.log(`[MusicAliases] Loaded ${map.size} music aliases`);

        return map;
    } catch (error) {
        console.warn("[MusicAliases] Error fetching aliases:", error);
        return new Map();
    }
}

/**
 * Get aliases for a specific music ID
 * Returns empty array if not found
 */
export function getMusicAliases(musicId: number, aliasesMap: Map<number, string[]>): string[] {
    return aliasesMap.get(musicId) || [];
}

/**
 * Check if a query matches any alias for a music
 */
export function matchesAlias(
    musicId: number,
    query: string,
    aliasesMap: Map<number, string[]>
): boolean {
    const aliases = aliasesMap.get(musicId);
    if (!aliases) return false;

    const lowerQuery = query.toLowerCase();
    return aliases.some(alias => alias.toLowerCase().includes(lowerQuery));
}
