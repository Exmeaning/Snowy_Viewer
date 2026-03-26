/**
 * Fetch utilities with compression header support
 * Ensures requests include Accept-Encoding: gzip, deflate, br, zstd
 * 
 * Runtime (Client): Uses selected master server (jp or cn)
 * 
 * IndexedDB caching: Runtime masterdata is cached in IndexedDB with version-aware
 * invalidation. Cache is transparent to all callers of fetchMasterData().
 */

import { getMasterDataCache, setMasterDataCache, isIndexedDBAvailable } from "./masterdata-cache";

// Server source type
export type ServerSourceType = "jp" | "cn";

// Server domain configurations (primary)
const SERVER_DOMAINS: Record<ServerSourceType, string> = {
    jp: "sekaimaster.exmeaning.com",
    cn: "sekaimaster-cn.exmeaning.com",
};

// Fallback server domains (used when primary fails, e.g., ISP blocking)
const FALLBACK_DOMAINS: Record<ServerSourceType, string> = {
    jp: "sk.exmeaning.com",
    cn: "sk-cn.exmeaning.com",
};

/**
 * Get current server from localStorage (client-side only)
 */
function getCurrentServer(): ServerSourceType {
    if (typeof window === "undefined") return "jp";
    const saved = localStorage.getItem("server-source");
    if (saved === "jp" || saved === "cn") return saved;

    return "jp";
}

/**
 * Get current master data version from localStorage
 * Used to ensure we fetch data matching the currently active version (cache persistence)
 */
function getLocalVersion(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(MASTERDATA_VERSION_KEY);
}

/**
 * Get master base URL for runtime (respects server selection)
 */
function getMasterBaseUrl(): string {
    return `https://${SERVER_DOMAINS[getCurrentServer()]}/master`;
}

/**
 * Get fallback master base URL for runtime (respects server selection)
 * Used when primary server fails (e.g., ISP blocking)
 */
function getFallbackMasterBaseUrl(): string {
    return `https://${FALLBACK_DOMAINS[getCurrentServer()]}/master`;
}

/**
 * Get version URL for runtime (respects server selection)
 */
function getVersionUrl(): string {
    return `https://${SERVER_DOMAINS[getCurrentServer()]}/versions/current_version.json`;
}

/**
 * Get fallback version URL for runtime (respects server selection)
 * Used when primary server fails (e.g., ISP blocking)
 */
function getFallbackVersionUrl(): string {
    return `https://${FALLBACK_DOMAINS[getCurrentServer()]}/versions/current_version.json`;
}



// Version info type
export interface VersionInfo {
    dataVersion: string;
    assetVersion: string;
    appVersion: string;
    assetHash: string;
    appHash: string;
}

/**
 * Fetch wrapper (compression is handled automatically by the browser)
 */
export async function fetchWithCompression(
    url: string,
    options?: RequestInit
): Promise<Response> {
    return fetch(url, options);
}

// Session storage key for cache bypass flag
const CACHE_BYPASS_KEY = "masterdata-cache-bypass";

/**
 * Set the cache bypass flag (call when _refresh param is detected)
 * This must be called BEFORE cleaning the URL param
 */
export function setCacheBypassFlag(): void {
    if (typeof window !== "undefined") {
        sessionStorage.setItem(CACHE_BYPASS_KEY, 'true');
    }
}

/**
 * Check if we should bypass cache
 * Uses sessionStorage flag that was set by MasterDataContext
 */
function shouldBypassCache(): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(CACHE_BYPASS_KEY) === 'true';
}

/**
 * Clear the cache bypass flag (call after all data is loaded)
 */
export function clearCacheBypassFlag(): void {
    if (typeof window !== "undefined") {
        sessionStorage.removeItem(CACHE_BYPASS_KEY);
    }
}

/**
 * Fetch master data from the runtime server
 * Uses sekaimaster.exmeaning.com with fallback to sk.exmeaning.com
 * @param path - Path relative to master directory (e.g., "gachas.json", "cards.json")
 * @param noCache - If true, bypass browser cache by adding timestamp
 */
export async function fetchMasterData<T>(path: string, noCache: boolean = false): Promise<T> {
    // Auto-detect if we need to bypass cache (after version sync refresh)
    const shouldNoCache = noCache || shouldBypassCache();
    const fetchOptions: RequestInit = shouldNoCache ? { cache: "no-store" } : {};

    // Determine query parameters
    const params = new URLSearchParams();

    // 1. Version param (persistence enforcement)
    const localVersion = getLocalVersion();
    if (localVersion) {
        params.append("v", localVersion);
    }

    // 2. Cache buster (bypass enforcement)
    if (shouldNoCache) {
        params.append("_t", Date.now().toString());
    }

    const queryString = params.toString() ? `?${params.toString()}` : "";

    // ===== IndexedDB Cache Layer =====
    if (isIndexedDBAvailable() && localVersion) {
        // Try reading from IndexedDB (skip if force-refreshing)
        if (!shouldNoCache) {
            try {
                const cached = await getMasterDataCache<T>(path, localVersion);
                if (cached !== null) {
                    return cached;
                }
            } catch {
                // IndexedDB read failed, fall through to network
            }
        }
    }

    // Runtime: try primary server first, then fallback
    const primaryUrl = `${getMasterBaseUrl()}/${path}${queryString}`;
    try {
        const response = await fetchWithCompression(primaryUrl, fetchOptions);
        if (response.ok) {
            const data: T = await response.json();
            // Write to IndexedDB cache (async, non-blocking)
            if (isIndexedDBAvailable() && localVersion) {
                setMasterDataCache(path, data, localVersion).catch(() => { });
            }
            return data;
        }
        // Primary failed with non-ok status, try fallback
        console.warn(`[MasterData] Primary server failed for ${path}, trying fallback...`);
    } catch (error) {
        // Primary failed with network error (e.g., ISP blocking), try fallback
        console.warn(`[MasterData] Primary server unreachable for ${path}, trying fallback...`, error);
    }

    // Try fallback server
    const fallbackUrl = `${getFallbackMasterBaseUrl()}/${path}${queryString}`;
    const fallbackResponse = await fetchWithCompression(fallbackUrl, fetchOptions);
    if (!fallbackResponse.ok) {
        throw new Error(`Failed to fetch master data: ${path} (both primary and fallback servers failed)`);
    }
    console.log(`[MasterData] Successfully fetched ${path} from fallback server`);
    const fallbackData: T = await fallbackResponse.json();

    // Write to IndexedDB cache (async, non-blocking)
    if (isIndexedDBAvailable() && localVersion) {
        setMasterDataCache(path, fallbackData, localVersion).catch(() => { });
    }

    return fallbackData;
}

/**
 * Fetch multiple master data files in parallel
 * @param paths - Array of paths relative to master directory
 */
export async function fetchMultipleMasterData<T extends unknown[]>(
    paths: string[]
): Promise<T> {
    const results = await Promise.all(
        paths.map((path) => fetchMasterData(path))
    );
    return results as T;
}

/**
 * Fetch current version info with fallback support
 */
export async function fetchVersionInfo(): Promise<VersionInfo> {
    // Try primary server first
    try {
        const response = await fetchWithCompression(getVersionUrl());
        if (response.ok) {
            return await response.json();
        }
        console.warn(`[VersionInfo] Primary server failed, trying fallback...`);
    } catch (error) {
        console.warn(`[VersionInfo] Primary server unreachable, trying fallback...`, error);
    }

    // Try fallback server
    const fallbackResponse = await fetchWithCompression(getFallbackVersionUrl());
    if (!fallbackResponse.ok) {
        throw new Error("Failed to fetch version info (both primary and fallback servers failed)");
    }
    console.log(`[VersionInfo] Successfully fetched from fallback server`);
    return await fallbackResponse.json();
}

/**
 * Fetch current version info with no cache (bypasses browser cache entirely)
 * Used for version comparisons to detect data updates
 * Includes fallback support for ISP blocking scenarios
 */
export async function fetchVersionInfoNoCache(): Promise<VersionInfo> {
    // Add timestamp to URL to bypass CDN and browser cache
    const cacheBuster = `?_t=${Date.now()}`;

    // Try primary server first
    try {
        const noCacheUrl = `${getVersionUrl()}${cacheBuster}`;
        // Use simple fetch without custom headers to avoid CORS preflight issues
        const response = await fetch(noCacheUrl, {
            cache: "no-store",
        });
        if (response.ok) {
            return await response.json();
        }
        console.warn(`[VersionInfo] Primary server failed (no-cache), trying fallback...`);
    } catch (error) {
        console.warn(`[VersionInfo] Primary server unreachable (no-cache), trying fallback...`, error);
    }

    // Try fallback server
    const fallbackUrl = `${getFallbackVersionUrl()}${cacheBuster}`;
    const fallbackResponse = await fetch(fallbackUrl, {
        cache: "no-store",
    });
    if (!fallbackResponse.ok) {
        throw new Error("Failed to fetch version info (no-cache) (both primary and fallback servers failed)");
    }
    console.log(`[VersionInfo] Successfully fetched (no-cache) from fallback server`);
    return await fallbackResponse.json();
}

// Local storage key for cached version
export const MASTERDATA_VERSION_KEY = "masterdata-version";

/**
 * Fetch master data for a specific game server (cn/jp/tw)
 * Unlike fetchMasterData(), this does NOT use the global localStorage server setting.
 * Used by features that need server-specific masterdata (e.g., card progress page).
 * - cn → sekaimaster-cn
 * - jp → sekaimaster (jp)
 * - tw → sekaimaster-cn (same as cn)
 *
 * NOTE: Intentionally bypasses IndexedDB cache because this targets a specific server
 * independent of the global version, so the version-keyed cache would be incorrect.
 */
export async function fetchMasterDataForServer<T>(server: "cn" | "jp" | "tw", path: string): Promise<T> {
    const masterServer: "cn" | "jp" = (server === "cn" || server === "tw") ? "cn" : "jp";
    const domain = SERVER_DOMAINS[masterServer];
    const fallbackDomain = FALLBACK_DOMAINS[masterServer];

    // Add version param to avoid stale browser/CDN cache
    const localVersion = getLocalVersion();
    const query = localVersion ? `?v=${encodeURIComponent(localVersion)}` : "";

    const primaryUrl = `https://${domain}/master/${path}${query}`;
    try {
        const response = await fetchWithCompression(primaryUrl);
        if (response.ok) return response.json();
    } catch { /* fall through */ }

    const fallbackUrl = `https://${fallbackDomain}/master/${path}${query}`;
    const fallbackResponse = await fetchWithCompression(fallbackUrl);
    if (!fallbackResponse.ok) {
        throw new Error(`Failed to fetch ${path} for server ${server}`);
    }
    return fallbackResponse.json();
}


// ==================== Manga Data Fetching ====================

export const MANGA_JSON_URL = "https://moe.exmeaning.com/mangas/mangas.json";

/**
 * Fetch official 4-panel manga list from exmeaning CDN
 * This bypasses the standard sekaimaster runtime cache but still uses basic compression
 */
export async function fetchMangaData<T>(): Promise<T> {
    const response = await fetchWithCompression(MANGA_JSON_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch manga data: HTTP ${response.status}`);
    }
    return response.json();
}

// ==================== Bilibili Data Fetching ====================

export const BILIBILI_EVENTS_JSON_URL = "https://moe.exmeaning.com/data/event_bvid/events_bilibili.json";

/**
 * Fetch Bilibili video mapping for events
 */
export async function fetchBilibiliEventsData<T>(): Promise<T> {
    const response = await fetchWithCompression(BILIBILI_EVENTS_JSON_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch Bilibili events data: HTTP ${response.status}`);
    }
    return response.json();
}
