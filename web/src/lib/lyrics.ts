import type { UiLocale } from "@/lib/i18n";

const LYRICS_SCHEMA_VERSION = 1;
const HTTP_NOT_FOUND = 404;
const IPV4_LOOPBACK_FIRST_OCTET = 127;
const IPV4_MAX_OCTET = 255;

export type LyricsTargetLocale = "zh-CN" | "en-US";

export interface ILyricsIndexEntry {
    musicId: number;
    revision: number;
    updatedAt: string;
    title: {
        "ja-JP": string;
        "zh-CN"?: string;
        "en-US"?: string;
    };
}

export interface ILyricsIndex {
    version: typeof LYRICS_SCHEMA_VERSION;
    songs: ILyricsIndexEntry[];
}

export interface ILyricsSegment {
    text: string;
    performerIds: number[];
}

export interface ILyricsLine {
    id: string;
    order: number;
    japanese: string;
    "zh-CN": string;
    "en-US": string;
    stanzaBreakBefore?: boolean;
    segments: ILyricsSegment[];
}

export interface ILyricsDocument {
    version: typeof LYRICS_SCHEMA_VERSION;
    musicId: number;
    revision: number;
    updatedAt: string;
    attribution: string;
    lines: ILyricsLine[];
}

export class LyricsLoadError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly retryable = false,
    ) {
        super(message);
        this.name = "LyricsLoadError";
    }
}

export function isLyricsUnavailableError(error: unknown): error is LyricsLoadError {
    return error instanceof LyricsLoadError && error.status === HTTP_NOT_FOUND;
}

interface CachedLyricsDocument {
    document: ILyricsDocument;
    cachedAt: number;
}

const LYRICS_INDEX_FILENAME = "index.json";
const LYRICS_DOCUMENT_FILENAME_PREFIX = "music_";
const MIN_LYRICS_ENTITY_ID = 1;
const MIN_LYRICS_LINE_ORDER = 0;
const MAX_LYRICS_INDEX_ENTRIES = 100_000;
const MAX_LYRICS_LINES = 5000;
const MAX_LYRICS_SEGMENTS_PER_LINE = 100;
const MAX_LYRICS_TITLE_LENGTH = 64 * 1024;
const MAX_LYRICS_TEXT_LENGTH = 16 * 1024;
const MAX_LYRICS_SOURCE_URL_LENGTH = 2048;
const MAX_LYRICS_ATTRIBUTION_LENGTH = 16 * 1024;
const MAX_LYRICS_DATE_TIME_LENGTH = 64;
const MAX_LYRICS_LINE_ID_LENGTH = 128;
const INITIAL_LYRICS_BUFFER_BYTES = 1024;
const LYRICS_BUFFER_GROWTH_FACTOR = 2;
const LYRICS_DETAIL_CACHE_LIMIT = 24;
const LYRICS_SOURCE_CHANGE_RETRY_LIMIT = MIN_LYRICS_ENTITY_ID;
const LYRICS_FETCH_RETRY_LIMIT = 2;
const LYRICS_FETCH_RETRY_DELAY_MS = 250;
const LYRICS_CACHE_TTL_MS = 60 * 1000;
const LYRICS_FETCH_TIMEOUT_MS = 10 * 1000;
const MAX_LYRICS_ARTIFACT_BYTES = 4 * 1024 * 1024;
const detailCache = new Map<string, CachedLyricsDocument>();
const detailRequests = new Map<string, Promise<ILyricsDocument>>();
let indexCache: ILyricsIndex | null = null;
let indexCacheSourceUrl = "";
let indexCachedAt = 0;
let indexRequest: Promise<ILyricsIndex> | null = null;
let indexRequestSourceUrl = "";

export function getLyricsTargetLocale(locale: UiLocale): LyricsTargetLocale | null {
    if (locale === "zh-CN" || locale === "en-US") return locale;
    return null;
}

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    if (normalized === "localhost" || normalized === "[::1]") return true;

    const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;
    const octets = match.slice(1).map(Number);
    return octets[0] === IPV4_LOOPBACK_FIRST_OCTET && octets.every((octet) => octet >= 0 && octet <= IPV4_MAX_OCTET);
}

function parseLyricsBaseUrl(value: string): URL | null {
    try {
        if (value.length > MAX_LYRICS_SOURCE_URL_LENGTH) return null;
        if (value.trim() !== value || value.includes("?") || value.includes("#")) return null;
        const url = new URL(value);
        if (url.origin === "null" || !url.hostname) return null;
        if (
            (url.protocol !== "http:" && url.protocol !== "https:")
            || url.username
            || url.password
            || url.search
            || url.hash
        ) {
            return null;
        }
        if (url.protocol === "http:" && (process.env.NODE_ENV === "production" || !isLoopbackHostname(url.hostname))) {
            return null;
        }

        const pathname = url.pathname.replace(/\/+$/, "");
        if (!pathname) return null;
        url.pathname = pathname;
        return url;
    } catch {
        return null;
    }
}

export function getLyricsBaseUrl(): string {
    // Keep this direct property access: Next.js statically replaces NEXT_PUBLIC_* references
    // in client bundles, while computed environment lookups are not guaranteed to be inlined.
    const raw = process.env.NEXT_PUBLIC_LYRICS_BASE_URL || "";
    if (!raw) throw new LyricsLoadError("Lyrics base URL is not configured");

    const configured = parseLyricsBaseUrl(raw);
    if (!configured) throw new LyricsLoadError("Invalid configured lyrics base URL");
    return configured.toString().replace(/\/$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    const allowed = new Set(keys);
    return Object.keys(value).every((key) => allowed.has(key));
}

function isDateTime(value: unknown): value is string {
    return typeof value === "string"
        && value.length <= MAX_LYRICS_DATE_TIME_LENGTH
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function isTitle(value: unknown): value is ILyricsIndexEntry["title"] {
    if (!isObject(value) || !hasOnlyKeys(value, ["ja-JP", "zh-CN", "en-US"])) return false;
    return typeof value["ja-JP"] === "string"
        && value["ja-JP"].length > 0
        && value["ja-JP"].length <= MAX_LYRICS_TITLE_LENGTH
        && (value["zh-CN"] === undefined || (typeof value["zh-CN"] === "string" && value["zh-CN"].length > 0 && value["zh-CN"].length <= MAX_LYRICS_TITLE_LENGTH))
        && (value["en-US"] === undefined || (typeof value["en-US"] === "string" && value["en-US"].length > 0 && value["en-US"].length <= MAX_LYRICS_TITLE_LENGTH));
}

function isIndexEntry(value: unknown): value is ILyricsIndexEntry {
    if (!isObject(value) || !hasOnlyKeys(value, ["musicId", "revision", "updatedAt", "title"])) return false;
    return Number.isSafeInteger(value.musicId) && Number(value.musicId) >= MIN_LYRICS_ENTITY_ID
        && Number.isSafeInteger(value.revision) && Number(value.revision) >= MIN_LYRICS_ENTITY_ID
        && isDateTime(value.updatedAt)
        && isTitle(value.title);
}

function validateIndex(value: unknown): ILyricsIndex {
    if (
        !isObject(value)
        || !hasOnlyKeys(value, ["version", "songs"])
        || value.version !== LYRICS_SCHEMA_VERSION
        || !Array.isArray(value.songs)
        || value.songs.length > MAX_LYRICS_INDEX_ENTRIES
    ) {
        throw new LyricsLoadError("Invalid lyrics index");
    }

    const musicIds = new Set<number>();
    let previousMusicId = 0;
    for (const song of value.songs) {
        if (!isIndexEntry(song) || musicIds.has(song.musicId) || song.musicId <= previousMusicId) {
            throw new LyricsLoadError("Invalid lyrics index");
        }
        musicIds.add(song.musicId);
        previousMusicId = song.musicId;
    }
    return value as unknown as ILyricsIndex;
}

function isSegment(value: unknown): value is ILyricsSegment {
    if (
        !isObject(value)
        || !hasOnlyKeys(value, ["text", "performerIds"])
        || typeof value.text !== "string"
        || value.text.length > MAX_LYRICS_TEXT_LENGTH
        || !Array.isArray(value.performerIds)
    ) {
        return false;
    }
    const performerIds = value.performerIds;
    return performerIds.length > 0
        && new Set(performerIds).size === performerIds.length
        && performerIds.every((id) => Number.isSafeInteger(id) && Number(id) >= MIN_LYRICS_ENTITY_ID);
}

function isLine(value: unknown): value is ILyricsLine {
    if (!isObject(value) || !hasOnlyKeys(value, ["id", "order", "japanese", "zh-CN", "en-US", "stanzaBreakBefore", "segments"])) {
        return false;
    }
    return typeof value.id === "string" && value.id.length > 0 && value.id.length <= MAX_LYRICS_LINE_ID_LENGTH
        && Number.isSafeInteger(value.order) && Number(value.order) >= MIN_LYRICS_LINE_ORDER
        && typeof value.japanese === "string" && value.japanese.length > 0 && value.japanese.length <= MAX_LYRICS_TEXT_LENGTH
        && typeof value["zh-CN"] === "string" && value["zh-CN"].length > 0 && value["zh-CN"].length <= MAX_LYRICS_TEXT_LENGTH
        && typeof value["en-US"] === "string" && value["en-US"].length > 0 && value["en-US"].length <= MAX_LYRICS_TEXT_LENGTH
        && (value.stanzaBreakBefore === undefined || typeof value.stanzaBreakBefore === "boolean")
        && Array.isArray(value.segments)
        && value.segments.length > 0
        && value.segments.length <= MAX_LYRICS_SEGMENTS_PER_LINE
        && value.segments.every(isSegment);
}

function validateDocument(value: unknown, publication: ILyricsIndexEntry): ILyricsDocument {
    if (
        !isObject(value)
        || !hasOnlyKeys(value, ["version", "musicId", "revision", "updatedAt", "attribution", "lines"])
        || value.version !== LYRICS_SCHEMA_VERSION
        || value.musicId !== publication.musicId
        || value.revision !== publication.revision
        || !isDateTime(value.updatedAt)
        || value.updatedAt !== publication.updatedAt
        || typeof value.attribution !== "string"
        || value.attribution.trim().length === 0
        || value.attribution.length > MAX_LYRICS_ATTRIBUTION_LENGTH
        || !Array.isArray(value.lines)
        || value.lines.length === 0
        || value.lines.length > MAX_LYRICS_LINES
    ) {
        throw new LyricsLoadError("Invalid lyrics document");
    }
    const lineIds = new Set<string>();
    let previousOrder = -1;
    for (const line of value.lines) {
        if (!isLine(line) || lineIds.has(line.id) || line.order <= previousOrder) {
            throw new LyricsLoadError("Invalid lyrics document");
        }
        lineIds.add(line.id);
        previousOrder = line.order;
    }
    return value as unknown as ILyricsDocument;
}

async function readJsonLimited(response: Response): Promise<unknown> {
    const contentLengthHeader = response.headers?.get("content-length");
    if (contentLengthHeader !== null && contentLengthHeader !== undefined) {
        if (!/^\d+$/.test(contentLengthHeader)) {
            throw new LyricsLoadError("Invalid lyrics artifact content length");
        }
        const contentLength = Number(contentLengthHeader);
        if (!Number.isSafeInteger(contentLength)) {
            throw new LyricsLoadError("Invalid lyrics artifact content length");
        }
        if (contentLength > MAX_LYRICS_ARTIFACT_BYTES) {
            throw new LyricsLoadError("Lyrics artifact is too large");
        }
    }

    if (!response.body?.getReader) {
        throw new LyricsLoadError("Lyrics artifact response is not stream-readable");
    }

    const reader = response.body.getReader();
    if (contentLengthHeader === "0") {
        await reader.cancel();
        throw new LyricsLoadError("Invalid lyrics JSON");
    }
    let bytes = new Uint8Array();
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) {
            await reader.cancel();
            throw new LyricsLoadError("Invalid lyrics artifact body");
        }
        const nextTotal = total + value.byteLength;
        if (nextTotal > MAX_LYRICS_ARTIFACT_BYTES) {
            await reader.cancel();
            throw new LyricsLoadError("Lyrics artifact is too large");
        }
        if (bytes.length < nextTotal) {
            const expanded = new Uint8Array(Math.min(
                MAX_LYRICS_ARTIFACT_BYTES,
                Math.max(nextTotal, bytes.length * LYRICS_BUFFER_GROWTH_FACTOR, INITIAL_LYRICS_BUFFER_BYTES),
            ));
            expanded.set(bytes.subarray(0, total));
            bytes = expanded;
        }
        bytes.set(value, total);
        total = nextTotal;
    }

    if (total === 0) throw new LyricsLoadError("Invalid lyrics JSON");
    try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, total)));
    } catch {
        throw new LyricsLoadError("Invalid lyrics JSON");
    }
}

function callerAbortReason(signal: AbortSignal): unknown {
    if (signal.reason !== undefined) return signal.reason;
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    return error;
}

function sanitizeCallerError(error: unknown): unknown {
    if (error instanceof LyricsLoadError || error instanceof Error && error.name === "AbortError") return error;
    return new LyricsLoadError("Lyrics artifact request failed");
}

function waitForCaller<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return request.catch((error) => {
        throw sanitizeCallerError(error);
    });
    if (signal.aborted) return Promise.reject(callerAbortReason(signal));
    const callerSignal = signal;

    return new Promise<T>((resolve, reject) => {
        function cleanup() {
            callerSignal.removeEventListener("abort", abort);
        }
        function abort() {
            cleanup();
            reject(callerAbortReason(callerSignal));
        }
        callerSignal.addEventListener("abort", abort, { once: true });
        request.then(
            (value) => { cleanup(); resolve(value); },
            (error) => { cleanup(); reject(sanitizeCallerError(error)); },
        );
        if (callerSignal.aborted) abort();
    });
}

function waitForRetry(delay: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchPublishedJsonOnce(url: string): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, LYRICS_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
            const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            throw new LyricsLoadError(`Lyrics artifact request failed (${response.status})`, response.status, retryable);
        }
        return await readJsonLimited(response);
    } catch (error) {
        if (timedOut) throw new LyricsLoadError("Lyrics artifact request timed out", undefined, true);
        if (error instanceof LyricsLoadError) throw error;
        throw new LyricsLoadError("Lyrics artifact request failed", undefined, true);
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchPublishedJson(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await fetchPublishedJsonOnce(url);
        } catch (error) {
            if (!(error instanceof LyricsLoadError) || !error.retryable || attempt >= LYRICS_FETCH_RETRY_LIMIT) {
                throw error;
            }
            await waitForRetry(LYRICS_FETCH_RETRY_DELAY_MS * (attempt + MIN_LYRICS_ENTITY_ID));
        }
    }
}

export async function fetchLyricsIndex(signal?: AbortSignal): Promise<ILyricsIndex> {
    if (signal?.aborted) throw callerAbortReason(signal);

    const baseUrl = getLyricsBaseUrl();
    const cacheAge = Date.now() - indexCachedAt;
    if (indexCache && indexCacheSourceUrl === baseUrl && cacheAge >= 0 && cacheAge < LYRICS_CACHE_TTL_MS) return indexCache;
    if (indexCacheSourceUrl !== baseUrl) {
        indexCache = null;
        indexCacheSourceUrl = "";
        indexCachedAt = 0;
    }

    if (indexRequest && indexRequestSourceUrl !== baseUrl) {
        void indexRequest.catch(() => undefined);
        indexRequest = null;
        indexRequestSourceUrl = "";
    }
    if (!indexRequest) {
        const staleIndex = indexCache && indexCacheSourceUrl === baseUrl ? indexCache : null;
        const request = fetchPublishedJson(`${baseUrl}/${LYRICS_INDEX_FILENAME}`)
            .then(validateIndex)
            .then((index) => {
                indexCache = index;
                indexCacheSourceUrl = baseUrl;
                indexCachedAt = Date.now();
                return index;
            })
            .catch((error) => {
                // A validated stale index is safer than turning a transient transport/source
                // outage into a false unpublication. Validation and other contract failures
                // still fail closed. Do not refresh cachedAt: the next caller retries.
                if (staleIndex && error instanceof LyricsLoadError && error.retryable) return staleIndex;
                throw error;
            });
        indexRequest = request;
        indexRequestSourceUrl = baseUrl;
        const clearIndexRequest = () => {
            if (indexRequest === request && indexRequestSourceUrl === baseUrl) {
                indexRequest = null;
                indexRequestSourceUrl = "";
            }
        };
        void request.then(clearIndexRequest, clearIndexRequest);
    }
    const request = indexRequest;
    if (!request) throw new LyricsLoadError("Lyrics artifact request failed");
    const index = await waitForCaller(request, signal);
    if (baseUrl !== getLyricsBaseUrl()) return fetchLyricsIndex(signal);
    return index;
}

export async function getPublishedLyricsIndexEntry(musicId: number, signal?: AbortSignal): Promise<ILyricsIndexEntry | null> {
    if (!Number.isInteger(musicId) || musicId < MIN_LYRICS_ENTITY_ID) return null;
    const index = await fetchLyricsIndex(signal);
    return index.songs.find((song) => song.musicId === musicId) ?? null;
}

export async function fetchLyricsDocument(musicId: number, signal?: AbortSignal): Promise<ILyricsDocument> {
    return fetchLyricsDocumentFromCurrentSource(musicId, signal, LYRICS_SOURCE_CHANGE_RETRY_LIMIT);
}

async function fetchLyricsDocumentFromCurrentSource(
    musicId: number,
    signal: AbortSignal | undefined,
    sourceChangeRetries: number,
): Promise<ILyricsDocument> {
    if (!Number.isInteger(musicId) || musicId < MIN_LYRICS_ENTITY_ID) {
        throw new LyricsLoadError("Invalid lyrics music ID");
    }
    if (signal?.aborted) throw callerAbortReason(signal);

    const baseUrl = getLyricsBaseUrl();
    const index = await fetchLyricsIndex(signal);
    const publication = index.songs.find((song) => song.musicId === musicId) ?? null;
    if (!publication) throw new LyricsLoadError("Lyrics are not published", HTTP_NOT_FOUND);

    if (baseUrl !== getLyricsBaseUrl()) {
        if (sourceChangeRetries <= 0) throw new LyricsLoadError("Lyrics source changed during request");
        return fetchLyricsDocumentFromCurrentSource(musicId, signal, sourceChangeRetries - MIN_LYRICS_ENTITY_ID);
    }
    const cacheKey = `${baseUrl}:${musicId}:${publication.revision}`;
    const cached = detailCache.get(cacheKey);
    const cachedAge = cached ? Date.now() - cached.cachedAt : null;
    if (cached && cachedAge !== null && cachedAge >= 0 && cachedAge < LYRICS_CACHE_TTL_MS) {
        detailCache.delete(cacheKey);
        detailCache.set(cacheKey, cached);
        return cached.document;
    }

    let request = detailRequests.get(cacheKey);
    if (!request) {
        const staleDocument = cached?.document ?? null;
        const createdRequest = fetchPublishedJson(`${baseUrl}/${LYRICS_DOCUMENT_FILENAME_PREFIX}${musicId}.json`)
            .then((value) => validateDocument(value, publication))
            .then((document) => {
                for (const key of detailCache.keys()) {
                    if (key.startsWith(`${baseUrl}:${musicId}:`) && key !== cacheKey) detailCache.delete(key);
                }
                detailCache.delete(cacheKey);
                detailCache.set(cacheKey, { document, cachedAt: Date.now() });
                while (detailCache.size > LYRICS_DETAIL_CACHE_LIMIT) {
                    const oldest = detailCache.keys().next().value as string | undefined;
                    if (oldest === undefined) break;
                    detailCache.delete(oldest);
                }
                return document;
            })
            .catch((error) => {
                // The index still publishes this exact revision. Preserve its last validated
                // detail only for transient transport/source outages. Malformed replacement
                // bytes still fail closed. Keep the stale entry expired so the next call retries.
                if (staleDocument && error instanceof LyricsLoadError && error.retryable) {
                    detailCache.delete(cacheKey);
                    detailCache.set(cacheKey, cached as CachedLyricsDocument);
                    return staleDocument;
                }
                throw error;
            });
        request = createdRequest;
        detailRequests.set(cacheKey, createdRequest);
        const clearTrackedRequest = () => {
            if (detailRequests.get(cacheKey) === createdRequest) detailRequests.delete(cacheKey);
        };
        void createdRequest.then(clearTrackedRequest, clearTrackedRequest);
    }
    if (!request) throw new LyricsLoadError("Lyrics artifact request failed");
    const document = await waitForCaller(request, signal);
    if (baseUrl !== getLyricsBaseUrl()) {
        if (sourceChangeRetries <= 0) throw new LyricsLoadError("Lyrics source changed during request");
        return fetchLyricsDocumentFromCurrentSource(musicId, signal, sourceChangeRetries - MIN_LYRICS_ENTITY_ID);
    }
    return document;
}

export function clearLyricsCache(): void {
    indexCache = null;
    indexCacheSourceUrl = "";
    indexCachedAt = 0;
    indexRequest = null;
    indexRequestSourceUrl = "";
    detailCache.clear();
    detailRequests.clear();
}
