/**
 * Fetch utilities with compression header support
 * Ensures requests include Accept-Encoding: gzip, deflate, br, zstd
 * 
 * Build-time (SSG): Uses GitHub raw for large file stability
 * Runtime (Client): Uses selected master server (jp or cn)
 */

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

// Build-time URL (for static generation - more stable for large files >3MB)
const MASTER_BUILD_URL = "https://raw.githubusercontent.com/Exmeaning/haruki-sekai-master/main/master";
// const MASTER_BUILD_URL = "https://sekaimaster.exmeaning.com/master";

// CN Build-time URL (for SSG - generates pages for CN-only content)
const MASTER_BUILD_URL_CN = "https://raw.githubusercontent.com/Exmeaning/haruki-sekai-sc-master/main/master";

/**
 * Detect if we're in a build/SSG context (server-side, no window)
 */
function isBuildTime(): boolean {
    return typeof window === "undefined";
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
 * Fetch with explicit compression headers
 */
export async function fetchWithCompression(
    url: string,
    options?: RequestInit
): Promise<Response> {
    const headers = new Headers(options?.headers);
    if (!headers.has("Accept-Encoding")) {
        headers.set("Accept-Encoding", "gzip, deflate, br, zstd");
    }
    return fetch(url, { ...options, headers });
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
 * Fetch master data from appropriate source based on environment
 * - Build-time (SSG): Uses GitHub raw for large file stability (>3MB files)
 * - Runtime (Client): Uses sekaimaster.exmeaning.com with fallback to sk.exmeaning.com
 * @param path - Path relative to master directory (e.g., "gachas.json", "cards.json")
 * @param noCache - If true, bypass browser cache by adding timestamp
 */
export async function fetchMasterData<T>(path: string, noCache: boolean = false): Promise<T> {
    // Auto-detect if we need to bypass cache (after version sync refresh)
    // Auto-detect if we need to bypass cache (after version sync refresh)
    const shouldNoCache = noCache || shouldBypassCache();
    const fetchOptions: RequestInit = shouldNoCache ? { cache: "no-store" } : {};

    // Determine query parameters
    const params = new URLSearchParams();

    // 1. Version param (persistence enforcement)
    // If we have a stored version, append it. This ensures that after a "Force Refresh"
    // (which updates the stored version), subsequent normal loads use the NEW version's URL.
    const localVersion = getLocalVersion();
    if (localVersion) {
        params.append("v", localVersion);
    }

    // 2. Cache buster (bypass enforcement)
    if (shouldNoCache && !isBuildTime()) {
        params.append("_t", Date.now().toString());
    }

    const queryString = params.toString() ? `?${params.toString()}` : "";

    // Build-time: use GitHub raw (no fallback needed)
    if (isBuildTime()) {
        const url = `${MASTER_BUILD_URL}/${path}`;
        // Only log once per path to avoid spamming build logs
        if (!(global as any).__fetchedPaths) (global as any).__fetchedPaths = new Set();
        if (!(global as any).__fetchedPaths.has(path)) {
            console.log(`[Build] Fetching ${path} from GitHub raw...`);
            (global as any).__fetchedPaths.add(path);
        }

        try {
            const response = await fetchWithCompression(url, fetchOptions);
            if (!response.ok) {
                // If main master fails, try CN master (for cn-specific assets)
                const cnUrl = `${MASTER_BUILD_URL_CN}/${path}`;
                if (!(global as any).__fetchedPaths.has(path + "_cn")) {
                    console.log(`[Build] Fetching ${path} from CN GitHub raw...`);
                    (global as any).__fetchedPaths.add(path + "_cn");
                }
                const cnResponse = await fetchWithCompression(cnUrl, fetchOptions);
                if (cnResponse.ok) return cnResponse.json();

                throw new Error(`Failed to fetch master data: ${path}`);
            }
            return response.json();
        } catch (e) {
            throw e;
        }
    }

    // Runtime: try primary server first, then fallback
    const primaryUrl = `${getMasterBaseUrl()}/${path}${queryString}`;
    try {
        const response = await fetchWithCompression(primaryUrl, fetchOptions);
        if (response.ok) {
            return response.json();
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
    return fallbackResponse.json();
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
            return response.json();
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
    return fallbackResponse.json();
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
            return response.json();
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
    return fallbackResponse.json();
}

// Local storage key for cached version
export const MASTERDATA_VERSION_KEY = "masterdata-version";

/**
 * Fetch master data from the CN build source (GitHub raw)
 * Used at build time (SSG) to get CN-only content IDs
 * @param path - Path relative to master directory (e.g., "cards.json")
 */
export async function fetchCnBuildMasterData<T>(path: string): Promise<T> {
    const url = `${MASTER_BUILD_URL_CN}/${path}`;
    console.log(`[Build-CN] Fetching ${path} from CN GitHub raw...`);
    const response = await fetchWithCompression(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch CN master data: ${path} from ${MASTER_BUILD_URL_CN}`);
    }
    return response.json();
}

/**
 * Merge unique IDs from JP and CN master data at build time.
 * Fetches both JP and CN data, extracts IDs, and returns a deduplicated union.
 * CN fetch failures are silently ignored (CN may not have all files).
 * @param path - Master data file path (e.g., "cards.json")
 * @param idExtractor - Function to extract IDs from the data
 */
export async function fetchMergedBuildIds<T>(
    path: string,
    idExtractor: (data: T) => string[]
): Promise<string[]> {
    // Fetch JP data (required)
    const jpData = await fetchMasterData<T>(path);
    const jpIds = idExtractor(jpData);
    const idSet = new Set(jpIds);

    // Fetch CN data (optional - may not exist)
    try {
        const cnData = await fetchCnBuildMasterData<T>(path);
        const cnIds = idExtractor(cnData);
        for (const id of cnIds) {
            idSet.add(id);
        }
        console.log(`[Build] Merged ${path}: JP=${jpIds.length}, CN=${cnIds.length}, Total=${idSet.size}`);
    } catch (e) {
        console.warn(`[Build] CN data not available for ${path}, using JP only.`, e);
    }

    return Array.from(idSet);
}
