/**
 * Fetch utilities with compression header support
 * Ensures requests include Accept-Encoding: gzip, deflate, br, zstd
 * 
 * Build-time (SSG): Uses GitHub raw for large file stability
 * Runtime (Client): Uses sekaimaster.exmeaning.com
 */

// Runtime URL (for client-side fetching)
const MASTER_BASE_URL = "https://sekaimaster.exmeaning.com/master";
// Build-time URL (for static generation - more stable for large files >3MB)
const MASTER_BUILD_URL = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master";
const VERSION_URL = "https://sekaimaster.exmeaning.com/versions/current_version.json";

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
 * - Runtime (Client): Uses sekaimaster.exmeaning.com
 * @param path - Path relative to master directory (e.g., "gachas.json", "cards.json")
 * @param noCache - If true, bypass browser cache by adding timestamp
 */
export async function fetchMasterData<T>(path: string, noCache: boolean = false): Promise<T> {
    const baseUrl = isBuildTime() ? MASTER_BUILD_URL : MASTER_BASE_URL;
    let url = `${baseUrl}/${path}`;

    // Auto-detect if we need to bypass cache (after version sync refresh)
    const shouldNoCache = noCache || shouldBypassCache();

    // Add cache buster for client-side no-cache requests
    if (shouldNoCache && !isBuildTime()) {
        url += `?_t=${Date.now()}`;
    }

    // Log which source is being used during build
    if (isBuildTime()) {
        console.log(`[Build] Fetching ${path} from GitHub raw...`);
    }

    const fetchOptions: RequestInit = shouldNoCache ? { cache: "no-store" } : {};
    const response = await fetchWithCompression(url, fetchOptions);
    if (!response.ok) {
        throw new Error(`Failed to fetch master data: ${path} from ${baseUrl}`);
    }
    return response.json();
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
 * Fetch current version info
 */
export async function fetchVersionInfo(): Promise<VersionInfo> {
    const response = await fetchWithCompression(VERSION_URL);
    if (!response.ok) {
        throw new Error("Failed to fetch version info");
    }
    return response.json();
}

/**
 * Fetch current version info with no cache (bypasses browser cache entirely)
 * Used for version comparisons to detect data updates
 */
export async function fetchVersionInfoNoCache(): Promise<VersionInfo> {
    // Add timestamp to URL to bypass CDN and browser cache
    const noCacheUrl = `${VERSION_URL}?_t=${Date.now()}`;
    // Use simple fetch without custom headers to avoid CORS preflight issues
    const response = await fetch(noCacheUrl, {
        cache: "no-store",
    });
    if (!response.ok) {
        throw new Error("Failed to fetch version info (no-cache)");
    }
    return response.json();
}

// Local storage key for cached version
export const MASTERDATA_VERSION_KEY = "masterdata-version";
