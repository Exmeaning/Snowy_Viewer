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

/**
 * Fetch master data from appropriate source based on environment
 * - Build-time (SSG): Uses GitHub raw for large file stability (>3MB files)
 * - Runtime (Client): Uses sekaimaster.exmeaning.com
 * @param path - Path relative to master directory (e.g., "gachas.json", "cards.json")
 */
export async function fetchMasterData<T>(path: string): Promise<T> {
    const baseUrl = isBuildTime() ? MASTER_BUILD_URL : MASTER_BASE_URL;
    const url = `${baseUrl}/${path}`;

    // Log which source is being used during build
    if (isBuildTime()) {
        console.log(`[Build] Fetching ${path} from GitHub raw...`);
    }

    const response = await fetchWithCompression(url);
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
