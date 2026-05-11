/**
 * Voice URL Finder - Handles part_voice URL resolution with fallback logic
 * Based on sekaibest's voiceFinder implementation
 */

import { getAssetBaseUrl } from "./assets";
import type { AssetSourceType } from "@/contexts/ThemeContext";

/**
 * Voice URL cache to avoid redundant HEAD requests
 * Key format: `${region}-${voiceId}`
 * Value: resolved URL or null if not found
 */
type VoiceUrlCache = Record<string, string | null>;

/**
 * Check if a URL exists by making a HEAD request
 * Returns the URL if it exists, null otherwise
 * Note: Some servers may not support HEAD requests properly,
 * so we also accept 405 (Method Not Allowed) as a sign the file exists
 */
async function checkUrlExists(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, { method: "HEAD" });
        // Accept both 200 OK and 405 Method Not Allowed (file exists but HEAD not supported)
        if (response.ok || response.status === 405) {
            return url;
        }
        return null;
    } catch (error) {
        // Network error or CORS issue - assume file might exist
        console.warn(`[VoiceFinder] HEAD request failed for ${url}, will try anyway:`, error);
        return url; // Return URL anyway, let the audio player handle the error
    }
}

/**
 * Fix/verify voice URL with caching
 * @param cache - Voice URL cache object
 * @param voiceId - Voice ID for cache key
 * @param voiceUrl - Relative voice URL path (without base URL)
 * @param source - Asset source type
 * @returns Full URL if exists, null if not found
 */
export async function fixVoiceUrl(
    cache: VoiceUrlCache,
    voiceId: string,
    voiceUrl: string,
    source: AssetSourceType
): Promise<string | null> {
    // Check cache first
    const cacheKey = `${source}-${voiceId}`;
    if (cacheKey in cache) {
        return cache[cacheKey];
    }

    // Build full URL and check if it exists
    const fullUrl = `${getAssetBaseUrl(source)}/${voiceUrl}`;
    const result = await checkUrlExists(fullUrl);

    // Cache the result
    cache[cacheKey] = result;

    return result;
}

/**
 * Get part voice URL with fallback logic
 * Implements the same logic as sekaibest's getTalkVoiceUrl for partvoice handling
 * 
 * @param cache - Voice URL cache
 * @param scenarioId - Scenario ID
 * @param voiceId - Voice ID (should start with "partvoice")
 * @param source - Asset source
 * @param chara2dAssetName - Character 2D asset name (e.g., "01ichika")
 * @param chara2dUnit - Character 2D unit (e.g., "light_sound")
 * @returns Voice URL or empty string if not found
 */
export async function getPartVoiceUrl(
    cache: VoiceUrlCache,
    scenarioId: string,
    voiceId: string,
    source: AssetSourceType,
    chara2dAssetName: string,
    chara2dUnit: string
): Promise<string> {
    const chara = `${chara2dAssetName}_${chara2dUnit}`;
    const baseUrl = getAssetBaseUrl(source);

    // Strategy 1: For v2_* or clb* characters
    // Path: sound/scenario/voice/part_voice_{chara}/{voiceId}.mp3
    if (chara.startsWith("v2_") || chara.startsWith("clb")) {
        const partVoiceUrl = `sound/scenario/voice/part_voice_${chara}/${voiceId}.mp3`;
        const fixedUrl = await fixVoiceUrl(cache, voiceId, partVoiceUrl, source);
        if (fixedUrl) {
            console.log(`[VoiceFinder] Found part voice (v2/clb): ${fixedUrl}`);
            return fixedUrl;
        }
        // If verification failed, still return the URL (let audio player handle it)
        console.log(`[VoiceFinder] Verification failed but returning URL anyway: ${baseUrl}/${partVoiceUrl}`);
        return `${baseUrl}/${partVoiceUrl}`;
    } else {
        // Strategy 2: For other characters, try two paths in order
        
        // Try: sound/scenario/part_voice/{chara}/{voiceId}.mp3
        const partVoiceUrl1 = `sound/scenario/part_voice/${chara}/${voiceId}.mp3`;
        const fixedUrl1 = await fixVoiceUrl(cache, voiceId, partVoiceUrl1, source);
        if (fixedUrl1) {
            console.log(`[VoiceFinder] Found part voice (path 1): ${fixedUrl1}`);
            return fixedUrl1;
        }

        // Try: sound/scenario/voice/part_voice_{chara}/{voiceId}.mp3
        const partVoiceUrl2 = `sound/scenario/voice/part_voice_${chara}/${voiceId}.mp3`;
        const fixedUrl2 = await fixVoiceUrl(cache, voiceId, partVoiceUrl2, source);
        if (fixedUrl2) {
            console.log(`[VoiceFinder] Found part voice (path 2): ${fixedUrl2}`);
            return fixedUrl2;
        }
        
        // If all verifications failed, return the first path (most common)
        console.log(`[VoiceFinder] All verifications failed, returning first path: ${baseUrl}/${partVoiceUrl1}`);
        return `${baseUrl}/${partVoiceUrl1}`;
    }
}

/**
 * Get standard voice URL with verification
 * @param cache - Voice URL cache
 * @param voiceUrl - Relative voice URL path
 * @param voiceId - Voice ID for cache key
 * @param source - Asset source
 * @returns Full URL if exists, null if not found
 */
export async function getStandardVoiceUrl(
    cache: VoiceUrlCache,
    voiceUrl: string,
    voiceId: string,
    source: AssetSourceType
): Promise<string | null> {
    return await fixVoiceUrl(cache, voiceId, voiceUrl, source);
}
