import type { UiLocale } from "@/lib/i18n";
import { TRANSLATION_BASE_URL } from "@/lib/translations";

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
    version: 1;
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
    version: 1;
    musicId: number;
    revision: number;
    updatedAt: string;
    attribution: string;
    lines: ILyricsLine[];
}

export class LyricsLoadError extends Error {
    constructor(message: string, public readonly status?: number) {
        super(message);
        this.name = "LyricsLoadError";
    }
}

export function isLyricsUnavailableError(error: unknown): error is LyricsLoadError {
    return error instanceof LyricsLoadError && error.status === 404;
}

interface CachedLyricsDocument {
    document: ILyricsDocument;
    cachedAt: number;
}

const DEFAULT_LYRICS_BASE_URL = `${TRANSLATION_BASE_URL}/lyrics`;
const LYRICS_DETAIL_CACHE_LIMIT = 24;
const LYRICS_INDEX_CACHE_TTL = 60 * 1000;
const LYRICS_DETAIL_CACHE_TTL = 60 * 1000;
const LYRICS_FETCH_TIMEOUT_MS = 10 * 1000;
const MAX_LYRICS_ARTIFACT_BYTES = 4 << 20;
const LOOPBACK_LYRICS_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const detailCache = new Map<string, CachedLyricsDocument>();
const detailRequests = new Map<string, Promise<ILyricsDocument>>();
let indexCache: ILyricsIndex | null = null;
let indexCachedAt = 0;
let indexRequest: Promise<ILyricsIndex> | null = null;

export function getLyricsTargetLocale(locale: UiLocale): LyricsTargetLocale | null {
    if (locale === "zh-CN" || locale === "en-US") return locale;
    return null;
}

function parseLyricsBaseUrl(value: string): URL | null {
    try {
        const url = new URL(value);
        if (
            (url.protocol !== "http:" && url.protocol !== "https:")
            || url.username
            || url.password
            || url.search
            || url.hash
        ) {
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
    const configured = parseLyricsBaseUrl(process.env.NEXT_PUBLIC_LYRICS_BASE_URL || "");
    if (!configured) return DEFAULT_LYRICS_BASE_URL;

    if (configured.protocol === "https:") return configured.toString().replace(/\/$/, "");
    if (process.env.NODE_ENV !== "production" && LOOPBACK_LYRICS_HOSTS.has(configured.hostname)) {
        return configured.toString().replace(/\/$/, "");
    }
    return DEFAULT_LYRICS_BASE_URL;
}

function lyricsArtifactUrl(filename: string): string {
    return `${getLyricsBaseUrl()}/${filename}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    const allowed = new Set(keys);
    return Object.keys(value).every((key) => allowed.has(key));
}

function isDateTime(value: unknown): value is string {
    return typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function isTitle(value: unknown): value is ILyricsIndexEntry["title"] {
    if (!isObject(value) || !hasOnlyKeys(value, ["ja-JP", "zh-CN", "en-US"])) return false;
    return typeof value["ja-JP"] === "string"
        && (value["zh-CN"] === undefined || typeof value["zh-CN"] === "string")
        && (value["en-US"] === undefined || typeof value["en-US"] === "string");
}

function isIndexEntry(value: unknown): value is ILyricsIndexEntry {
    if (!isObject(value) || !hasOnlyKeys(value, ["musicId", "revision", "updatedAt", "title"])) return false;
    return Number.isInteger(value.musicId) && Number(value.musicId) > 0
        && Number.isInteger(value.revision) && Number(value.revision) > 0
        && isDateTime(value.updatedAt)
        && isTitle(value.title);
}

function validateIndex(value: unknown): ILyricsIndex {
    if (!isObject(value) || !hasOnlyKeys(value, ["version", "songs"]) || value.version !== 1 || !Array.isArray(value.songs)) {
        throw new LyricsLoadError("Invalid lyrics index");
    }
    const songs = value.songs;
    const musicIds = new Set(songs.map((song) => isObject(song) ? song.musicId : undefined));
    if (musicIds.size !== songs.length || !songs.every(isIndexEntry)) {
        throw new LyricsLoadError("Invalid lyrics index");
    }
    return value as unknown as ILyricsIndex;
}

function isSegment(value: unknown): value is ILyricsSegment {
    if (!isObject(value) || !hasOnlyKeys(value, ["text", "performerIds"]) || typeof value.text !== "string" || !Array.isArray(value.performerIds)) {
        return false;
    }
    const performerIds = value.performerIds;
    return performerIds.length > 0
        && new Set(performerIds).size === performerIds.length
        && performerIds.every((id) => Number.isInteger(id) && id > 0);
}

function isLine(value: unknown): value is ILyricsLine {
    if (!isObject(value) || !hasOnlyKeys(value, ["id", "order", "japanese", "zh-CN", "en-US", "stanzaBreakBefore", "segments"])) {
        return false;
    }
    return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128
        && Number.isInteger(value.order) && Number(value.order) >= 0
        && typeof value.japanese === "string" && value.japanese.length > 0
        && typeof value["zh-CN"] === "string" && value["zh-CN"].length > 0
        && typeof value["en-US"] === "string" && value["en-US"].length > 0
        && (value.stanzaBreakBefore === undefined || typeof value.stanzaBreakBefore === "boolean")
        && Array.isArray(value.segments) && value.segments.length > 0 && value.segments.every(isSegment);
}

function validateDocument(value: unknown, publication: ILyricsIndexEntry): ILyricsDocument {
    if (
        !isObject(value)
        || !hasOnlyKeys(value, ["version", "musicId", "revision", "updatedAt", "attribution", "lines"])
        || value.version !== 1
        || value.musicId !== publication.musicId
        || value.revision !== publication.revision
        || !isDateTime(value.updatedAt)
        || typeof value.attribution !== "string"
        || value.attribution.trim().length === 0
        || !Array.isArray(value.lines)
        || value.lines.length === 0
    ) {
        throw new LyricsLoadError("Invalid lyrics document");
    }
    const lineIds = new Set(value.lines.map((line) => isObject(line) ? line.id : undefined));
    if (lineIds.size !== value.lines.length || !value.lines.every(isLine)) {
        throw new LyricsLoadError("Invalid lyrics document");
    }
    return value as unknown as ILyricsDocument;
}

async function readJsonLimited(response: Response): Promise<unknown> {
    const contentLength = Number(response.headers?.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_LYRICS_ARTIFACT_BYTES) {
        throw new LyricsLoadError("Lyrics artifact is too large");
    }

    if (!response.body?.getReader) {
        const value = await response.json();
        if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_LYRICS_ARTIFACT_BYTES) {
            throw new LyricsLoadError("Lyrics artifact is too large");
        }
        return value;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_LYRICS_ARTIFACT_BYTES) {
            await reader.cancel();
            throw new LyricsLoadError("Lyrics artifact is too large");
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
        throw new LyricsLoadError("Invalid lyrics JSON");
    }
}

async function fetchPublishedJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, LYRICS_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
            throw new LyricsLoadError(`Lyrics artifact request failed (${response.status})`, response.status);
        }
        return await readJsonLimited(response);
    } catch (error) {
        if (timedOut) throw new LyricsLoadError("Lyrics artifact request timed out");
        throw error;
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortFromCaller);
    }
}

export async function fetchLyricsIndex(signal?: AbortSignal): Promise<ILyricsIndex> {
    const cacheAge = Date.now() - indexCachedAt;
    if (indexCache && cacheAge >= 0 && cacheAge < LYRICS_INDEX_CACHE_TTL) return indexCache;
    if (indexRequest) return indexRequest;

    indexRequest = fetchPublishedJson(lyricsArtifactUrl("index.json"), signal)
        .then(validateIndex)
        .then((index) => {
            indexCache = index;
            indexCachedAt = Date.now();
            return index;
        })
        .finally(() => {
            indexRequest = null;
        });
    return indexRequest;
}

export async function getPublishedLyricsIndexEntry(musicId: number): Promise<ILyricsIndexEntry | null> {
    if (!Number.isInteger(musicId) || musicId <= 0) return null;
    const index = await fetchLyricsIndex();
    return index.songs.find((song) => song.musicId === musicId) ?? null;
}

export async function fetchLyricsDocument(musicId: number, signal?: AbortSignal): Promise<ILyricsDocument> {
    if (!Number.isInteger(musicId) || musicId <= 0) {
        throw new LyricsLoadError("Invalid lyrics music ID");
    }
    const publication = await getPublishedLyricsIndexEntry(musicId);
    if (!publication) throw new LyricsLoadError("Lyrics are not published", 404);

    const cacheKey = `${musicId}:${publication.revision}`;
    const cached = detailCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < LYRICS_DETAIL_CACHE_TTL) {
        detailCache.delete(cacheKey);
        detailCache.set(cacheKey, cached);
        return cached.document;
    }

    const inflight = detailRequests.get(cacheKey);
    if (inflight) return inflight;

    const request = fetchPublishedJson(lyricsArtifactUrl(`music_${musicId}.json`), signal)
        .then((value) => validateDocument(value, publication))
        .then((document) => {
            for (const key of detailCache.keys()) {
                if (key.startsWith(`${musicId}:`) && key !== cacheKey) detailCache.delete(key);
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
        .finally(() => {
            detailRequests.delete(cacheKey);
        });
    detailRequests.set(cacheKey, request);
    return request;
}

export function clearLyricsCache(): void {
    indexCache = null;
    indexCachedAt = 0;
    indexRequest = null;
    detailCache.clear();
    detailRequests.clear();
}
