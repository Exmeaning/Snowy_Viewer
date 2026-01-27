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
const MASTER_BUILD_URL = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master";

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
    const shouldNoCache = noCache || shouldBypassCache();
    const fetchOptions: RequestInit = shouldNoCache ? { cache: "no-store" } : {};
    const cacheBuster = shouldNoCache && !isBuildTime() ? `?_t=${Date.now()}` : "";

    // Build-time: use GitHub raw (no fallback needed)
    if (isBuildTime()) {
        const url = `${MASTER_BUILD_URL}/${path}`;
        console.log(`[Build] Fetching ${path} from GitHub raw...`);
        const response = await fetchWithCompression(url, fetchOptions);
        if (!response.ok) {
            throw new Error(`Failed to fetch master data: ${path} from ${MASTER_BUILD_URL}`);
        }
        return response.json();
    }

    // Runtime: try primary server first, then fallback
    const primaryUrl = `${getMasterBaseUrl()}/${path}${cacheBuster}`;
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
    const fallbackUrl = `${getFallbackMasterBaseUrl()}/${path}${cacheBuster}`;
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
