import { DEFAULT_PUBLIC_LYRICS_BASE_URL } from '../../src/lib/public-lyrics-base-url.mjs';
import { parseStrictJson } from '../../src/lib/strict-json.mjs';

const PUBLIC_LYRICS_SOURCE_ENV = 'NEXT_PUBLIC_LYRICS_BASE_URL';
const PUBLIC_LYRICS_INDEX_FILENAME = 'index.json';
const IPV4_LOOPBACK_FIRST_OCTET = 127;
const IPV4_MAX_OCTET = 255;
const PUBLIC_LYRICS_SCHEMA_VERSION_V1 = 1;
const PUBLIC_LYRICS_SCHEMA_VERSION_V2 = 2;
export const PUBLIC_LYRICS_SCHEMA_VERSION = 3;
const MIN_PUBLIC_LYRICS_ENTITY_ID = 1;
const MAX_PUBLIC_LYRICS_INDEX_ENTRIES = 100_000;
const MAX_PUBLIC_LYRICS_TITLE_LENGTH = 64 * 1024;
const MAX_PUBLIC_LYRICS_SOURCE_URL_LENGTH = 2048;
const MAX_PUBLIC_LYRICS_DATE_TIME_LENGTH = 64;
const MAX_PUBLIC_LYRICS_ARTIFACT_BYTES = 4 * 1024 * 1024;
const INITIAL_PUBLIC_LYRICS_BUFFER_BYTES = 1024;
const PUBLIC_LYRICS_BUFFER_GROWTH_FACTOR = 2;
const DEFAULT_BUILD_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_BUILD_FETCH_RETRIES = 2;
const MAX_BUILD_FETCH_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_BUILD_FETCH_RETRIES = 10;
const RETRY_ATTEMPT_OFFSET = 1;
const BUILD_FETCH_RETRY_DELAY_MS = 250;
const MAX_FINAL_ERROR_DETAIL_CHARS = 160;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_SERVER_ERROR_MAX = 599;
const NON_RETRYABLE_BUILD_FETCH_ERROR_MESSAGES = new Set([
    'Invalid public lyrics index',
    'Invalid public lyrics JSON',
    'Invalid public lyrics content length',
    'Invalid public lyrics response body',
    'Public lyrics index is too large',
    'Public lyrics index response is not stream-readable',
]);

function isLoopbackHostname(hostname) {
    const normalized = hostname.toLowerCase();
    if (normalized === 'localhost' || normalized === '[::1]') return true;

    const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    const octets = match.slice(1).map(Number);
    return octets[0] === IPV4_LOOPBACK_FIRST_OCTET && octets.every(octet => octet >= 0 && octet <= IPV4_MAX_OCTET);
}

function parsePublicLyricsBaseUrl(value) {
    try {
        const raw = String(value || '');
        if (raw.length > MAX_PUBLIC_LYRICS_SOURCE_URL_LENGTH) return null;
        if (raw.trim() !== raw || raw.includes('?') || raw.includes('#')) return null;
        const url = new URL(raw);
        if (url.origin === 'null' || !url.hostname) return null;
        if (
            (url.protocol !== 'http:' && url.protocol !== 'https:')
            || url.username
            || url.password
            || url.search
            || url.hash
        ) {
            return null;
        }
        if (url.protocol === 'http:' && (process.env.NODE_ENV === 'production' || !isLoopbackHostname(url.hostname))) return null;

        const pathname = url.pathname.replace(/\/+$/, '');
        if (!pathname) return null;
        url.pathname = pathname;
        return url.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
}

function isObject(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, keys) {
    const allowed = new Set(keys);
    return Object.keys(value).every(key => allowed.has(key));
}

function isDateTime(value) {
    return typeof value === 'string'
        && value.length <= MAX_PUBLIC_LYRICS_DATE_TIME_LENGTH
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function isTitle(value) {
    return isObject(value)
        && hasOnlyKeys(value, ['ja-JP', 'zh-CN', 'en-US'])
        && typeof value['ja-JP'] === 'string'
        && value['ja-JP'].length > 0
        && value['ja-JP'].length <= MAX_PUBLIC_LYRICS_TITLE_LENGTH
        && (value['zh-CN'] === undefined || (typeof value['zh-CN'] === 'string' && value['zh-CN'].length <= MAX_PUBLIC_LYRICS_TITLE_LENGTH))
        && (value['en-US'] === undefined || (typeof value['en-US'] === 'string' && value['en-US'].length <= MAX_PUBLIC_LYRICS_TITLE_LENGTH));
}

function isAvailableVersions(value) {
    return Array.isArray(value) && (
        value.length === 1 && (value[0] === 'full' || value[0] === 'game')
        || value.length === 2 && value[0] === 'full' && value[1] === 'game'
    );
}

function isAvailabilityState(value) {
    return value === 'complete' || value === 'game_only' || value === 'satisfied_no_lyrics'
        || value === 'ambiguous' || value === 'missing' || value === 'incomplete' || value === 'failed';
}

export function hasPublicLyricsDetail(song) {
    return song?.state === undefined || song.state === 'complete' || song.state === 'game_only';
}

export function validatePublicLyricsIndex(value) {
    if (
        !isObject(value)
        || !hasOnlyKeys(value, ['version', 'songs'])
        || (value.version !== PUBLIC_LYRICS_SCHEMA_VERSION_V1
            && value.version !== PUBLIC_LYRICS_SCHEMA_VERSION_V2
            && value.version !== PUBLIC_LYRICS_SCHEMA_VERSION)
        || !Array.isArray(value.songs)
        || value.songs.length > MAX_PUBLIC_LYRICS_INDEX_ENTRIES
        || value.version === PUBLIC_LYRICS_SCHEMA_VERSION && value.songs.length === 0
    ) {
        throw new Error('Invalid public lyrics index');
    }

    const musicIds = new Set();
    let previousMusicId = 0;
    for (const song of value.songs) {
        const entryKeys = value.version === PUBLIC_LYRICS_SCHEMA_VERSION_V1
            ? ['musicId', 'revision', 'updatedAt', 'title']
            : ['musicId', 'revision', 'updatedAt', 'state', 'title', 'availableVersions', 'noLyricsReason'];
        const commonValid = isObject(song)
            && hasOnlyKeys(song, entryKeys)
            && Number.isSafeInteger(song.musicId)
            && song.musicId >= MIN_PUBLIC_LYRICS_ENTITY_ID
            && Number.isSafeInteger(song.revision)
            && song.revision >= MIN_PUBLIC_LYRICS_ENTITY_ID
            && isDateTime(song.updatedAt)
            && isTitle(song.title);
        let unionValid = false;
        if (commonValid && value.version === PUBLIC_LYRICS_SCHEMA_VERSION_V1) {
            unionValid = song.state === undefined && song.availableVersions === undefined && song.noLyricsReason === undefined;
        } else if (commonValid && isAvailabilityState(song.state)) {
            if (song.state === 'complete') {
                unionValid = isAvailableVersions(song.availableVersions)
                    && song.availableVersions[0] === 'full'
                    && song.noLyricsReason === undefined;
            } else if (song.state === 'game_only') {
                unionValid = Array.isArray(song.availableVersions)
                    && song.availableVersions.length === 1
                    && song.availableVersions[0] === 'game'
                    && song.noLyricsReason === undefined;
            } else if (song.state === 'satisfied_no_lyrics') {
                unionValid = song.availableVersions === undefined && song.noLyricsReason === 'catalog_instrumental';
            } else {
                unionValid = song.availableVersions === undefined && song.noLyricsReason === undefined;
            }
        }
        if (!commonValid || !unionValid || musicIds.has(song.musicId) || song.musicId <= previousMusicId) {
            throw new Error('Invalid public lyrics index');
        }
        musicIds.add(song.musicId);
        previousMusicId = song.musicId;
    }
    return value;
}

export function getConfiguredPublicLyricsIndexUrl() {
    const raw = String(process.env[PUBLIC_LYRICS_SOURCE_ENV] || DEFAULT_PUBLIC_LYRICS_BASE_URL);

    const configuredBaseUrl = parsePublicLyricsBaseUrl(raw);
    if (!configuredBaseUrl) {
        throw new Error(`Invalid ${PUBLIC_LYRICS_SOURCE_ENV}: expected a credential-free HTTPS directory or a loopback HTTP directory`);
    }
    return `${configuredBaseUrl}/${PUBLIC_LYRICS_INDEX_FILENAME}`;
}

export function validateConfiguredPublicLyricsSource() {
    return getConfiguredPublicLyricsIndexUrl();
}

async function readJsonLimited(response) {
    const contentLengthHeader = response.headers?.get?.('content-length');
    if (contentLengthHeader !== null && contentLengthHeader !== undefined) {
        if (!/^\d+$/.test(contentLengthHeader)) {
            throw new Error('Invalid public lyrics content length');
        }
        const contentLength = Number(contentLengthHeader);
        if (!Number.isSafeInteger(contentLength)) {
            throw new Error('Invalid public lyrics content length');
        }
        if (contentLength > MAX_PUBLIC_LYRICS_ARTIFACT_BYTES) {
            throw new Error('Public lyrics index is too large');
        }
    }

    if (typeof response.body?.getReader !== 'function') {
        throw new Error('Public lyrics index response is not stream-readable');
    }

    let reader;
    try {
        reader = response.body.getReader();
    } catch {
        throw new Error('Invalid public lyrics response body');
    }
    if (!reader || typeof reader.read !== 'function' || typeof reader.cancel !== 'function') {
        throw new Error('Invalid public lyrics response body');
    }
    const cancelReader = async () => {
        try {
            await reader.cancel();
        } catch {
            // Cancellation is best-effort cleanup. Preserve the deterministic body error.
        }
    };
    if (contentLengthHeader === '0') {
        await cancelReader();
        throw new Error('Invalid public lyrics JSON');
    }
    let bytes = new Uint8Array();
    let total = 0;
    while (true) {
        const result = await reader.read();
        if (!isObject(result)) {
            await cancelReader();
            throw new Error('Invalid public lyrics response body');
        }
        let done;
        try {
            done = result.done;
        } catch {
            await cancelReader();
            throw new Error('Invalid public lyrics response body');
        }
        if (typeof done !== 'boolean') {
            await cancelReader();
            throw new Error('Invalid public lyrics response body');
        }
        if (done) break;
        let value;
        try {
            value = result.value;
        } catch {
            await cancelReader();
            throw new Error('Invalid public lyrics response body');
        }
        if (!(value instanceof Uint8Array)) {
            await cancelReader();
            throw new Error('Invalid public lyrics response body');
        }
        const nextTotal = total + value.byteLength;
        if (nextTotal > MAX_PUBLIC_LYRICS_ARTIFACT_BYTES) {
            await cancelReader();
            throw new Error('Public lyrics index is too large');
        }
        if (bytes.length < nextTotal) {
            const expanded = new Uint8Array(Math.min(
                MAX_PUBLIC_LYRICS_ARTIFACT_BYTES,
                Math.max(nextTotal, bytes.length * PUBLIC_LYRICS_BUFFER_GROWTH_FACTOR, INITIAL_PUBLIC_LYRICS_BUFFER_BYTES),
            ));
            expanded.set(bytes.subarray(0, total));
            bytes = expanded;
        }
        bytes.set(value, total);
        total = nextTotal;
    }

    if (total === 0) throw new Error('Invalid public lyrics JSON');
    try {
        return parseStrictJson(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, total)));
    } catch {
        throw new Error('Invalid public lyrics JSON');
    }
}

function readConfiguredInteger(name, fallback, minimum, maximum) {
    const raw = String(process.env[name] || '').trim();
    if (!/^\d+$/.test(raw)) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function getHttpStatus(error) {
    if (!(error instanceof Error)) return null;
    const match = error.message.match(/^HTTP (\d{3})$/);
    return match ? Number(match[1]) : null;
}

function isRetryableAttemptError(error) {
    if (!(error instanceof Error)) return true;
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
    if (NON_RETRYABLE_BUILD_FETCH_ERROR_MESSAGES.has(error.message)) return false;

    const status = getHttpStatus(error);
    if (status !== null) {
        return status === HTTP_REQUEST_TIMEOUT
            || status === HTTP_TOO_MANY_REQUESTS
            || (status >= HTTP_SERVER_ERROR_MIN && status <= HTTP_SERVER_ERROR_MAX);
    }
    return true;
}

function sanitizeAttemptError(error) {
    if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'request timed out';
        if (NON_RETRYABLE_BUILD_FETCH_ERROR_MESSAGES.has(error.message) || getHttpStatus(error) !== null) {
            return error.message;
        }
    }
    return 'transport failure';
}

function sanitizeFinalErrorDetails(details) {
    const summary = [...new Set(details)].join('; ');
    return summary.length > MAX_FINAL_ERROR_DETAIL_CHARS
        ? `${summary.slice(0, MAX_FINAL_ERROR_DETAIL_CHARS)}...`
        : summary;
}

async function delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchPublicLyricsIndex() {
    const indexUrl = getConfiguredPublicLyricsIndexUrl();
    const timeoutMs = readConfiguredInteger('BUILD_FETCH_TIMEOUT_MS', DEFAULT_BUILD_FETCH_TIMEOUT_MS, 1, MAX_BUILD_FETCH_TIMEOUT_MS);
    const retries = readConfiguredInteger('BUILD_FETCH_RETRIES', DEFAULT_BUILD_FETCH_RETRIES, 0, MAX_BUILD_FETCH_RETRIES);
    const errors = [];
    const totalAttempts = retries + RETRY_ATTEMPT_OFFSET;

    for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
        try {
            const response = await fetch(indexUrl, {
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return validatePublicLyricsIndex(await readJsonLimited(response));
        } catch (error) {
            const detail = sanitizeAttemptError(error);
            if (!errors.includes(detail)) errors.push(detail);
            const completedAttempts = attempt + RETRY_ATTEMPT_OFFSET;
            if (!isRetryableAttemptError(error) || completedAttempts >= totalAttempts) break;
            await delay(BUILD_FETCH_RETRY_DELAY_MS * completedAttempts);
        }
    }

    const details = sanitizeFinalErrorDetails(errors);
    throw new Error(`Failed to fetch public lyrics index${details ? `: ${details}` : ''}`);
}
