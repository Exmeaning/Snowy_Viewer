import type { UiLocale } from "@/lib/i18n";
import { TRANSLATION_BASE_URL } from "@/lib/translations";

export type LyricsTargetLocale = "zh-CN" | "en-US";

export interface ILyricsIndexEntry {
    musicId: number;
    titles: {
        "ja-JP": string;
        "zh-CN"?: string;
        "en-US"?: string;
    };
    availableLocales: LyricsTargetLocale[];
}

export interface ILyricsIndex {
    schemaVersion: 1;
    updatedAt: string;
    items: ILyricsIndexEntry[];
}

export interface ILyricsLine {
    id: string;
    source: string;
    translations?: Partial<Record<LyricsTargetLocale, string>>;
    performerIds: number[];
}

export interface ILyricsDocument {
    schemaVersion: 1;
    musicId: number;
    sourceLocale: "ja-JP";
    updatedAt: string;
    attribution?: string;
    lines: ILyricsLine[];
}

export class LyricsLoadError extends Error {
    constructor(message: string, public readonly status?: number) {
        super(message);
        this.name = "LyricsLoadError";
    }
}

const LYRICS_DETAIL_CACHE_LIMIT = 24;
const LYRICS_INDEX_CACHE_TTL = 60 * 1000;
const detailCache = new Map<number, ILyricsDocument>();
const detailRequests = new Map<number, Promise<ILyricsDocument>>();
let indexCache: ILyricsIndex | null = null;
let indexCachedAt = 0;
let indexRequest: Promise<ILyricsIndex> | null = null;

function isLyricsTargetLocale(value: unknown): value is LyricsTargetLocale {
    return value === "zh-CN" || value === "en-US";
}

export function getLyricsTargetLocale(locale: UiLocale): LyricsTargetLocale | null {
    if (locale === "zh-CN" || locale === "en-US") return locale;
    return null;
}

function validateIndex(value: unknown): ILyricsIndex {
    const index = value as Partial<ILyricsIndex> | null;
    const musicIds = new Set(Array.isArray(index?.items) ? index.items.map((item) => item.musicId) : []);
    if (
        index?.schemaVersion !== 1
        || typeof index.updatedAt !== "string"
        || !Array.isArray(index.items)
        || musicIds.size !== index.items.length
        || !index.items.every((item) =>
            Number.isInteger(item.musicId)
            && item.musicId > 0
            && typeof item.titles?.["ja-JP"] === "string"
            && (item.titles["zh-CN"] === undefined || typeof item.titles["zh-CN"] === "string")
            && (item.titles["en-US"] === undefined || typeof item.titles["en-US"] === "string")
            && Array.isArray(item.availableLocales)
            && item.availableLocales.every(isLyricsTargetLocale)
        )
    ) {
        throw new LyricsLoadError("Invalid lyrics index");
    }
    return index as ILyricsIndex;
}

function validateDocument(value: unknown, musicId: number): ILyricsDocument {
    const document = value as Partial<ILyricsDocument> | null;
    const lineIds = new Set(Array.isArray(document?.lines) ? document.lines.map((line) => line.id) : []);
    if (
        document?.schemaVersion !== 1
        || document.musicId !== musicId
        || document.sourceLocale !== "ja-JP"
        || typeof document.updatedAt !== "string"
        || (document.attribution !== undefined && typeof document.attribution !== "string")
        || !Array.isArray(document.lines)
        || lineIds.size !== document.lines.length
        || !document.lines.every((line) =>
            typeof line.id === "string"
            && line.id.length > 0
            && typeof line.source === "string"
            && (line.translations === undefined || (
                line.translations !== null
                && typeof line.translations === "object"
                && (line.translations["zh-CN"] === undefined || typeof line.translations["zh-CN"] === "string")
                && (line.translations["en-US"] === undefined || typeof line.translations["en-US"] === "string")
            ))
            && Array.isArray(line.performerIds)
            && line.performerIds.every(Number.isInteger)
        )
    ) {
        throw new LyricsLoadError("Invalid lyrics document");
    }
    return document as ILyricsDocument;
}

async function fetchPublishedJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) {
        throw new LyricsLoadError(`Lyrics artifact request failed (${response.status})`, response.status);
    }
    return response.json();
}

export async function fetchLyricsIndex(signal?: AbortSignal): Promise<ILyricsIndex> {
    const cacheAge = Date.now() - indexCachedAt;
    if (indexCache && cacheAge >= 0 && cacheAge < LYRICS_INDEX_CACHE_TTL) return indexCache;
    if (indexRequest) return indexRequest;

    indexRequest = fetchPublishedJson(`${TRANSLATION_BASE_URL}/lyrics/index.json`, signal)
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
    return index.items.find((item) => item.musicId === musicId) ?? null;
}

export async function fetchLyricsDocument(musicId: number, signal?: AbortSignal): Promise<ILyricsDocument> {
    if (!Number.isInteger(musicId) || musicId <= 0) {
        throw new LyricsLoadError("Invalid lyrics music ID");
    }
    const cached = detailCache.get(musicId);
    if (cached) {
        detailCache.delete(musicId);
        detailCache.set(musicId, cached);
        return cached;
    }

    const inflight = detailRequests.get(musicId);
    if (inflight) return inflight;

    const request = fetchPublishedJson(`${TRANSLATION_BASE_URL}/lyrics/${musicId}.json`, signal)
        .then((value) => validateDocument(value, musicId))
        .then((document) => {
            detailCache.set(musicId, document);
            while (detailCache.size > LYRICS_DETAIL_CACHE_LIMIT) {
                const oldest = detailCache.keys().next().value as number | undefined;
                if (oldest === undefined) break;
                detailCache.delete(oldest);
            }
            return document;
        })
        .finally(() => {
            detailRequests.delete(musicId);
        });
    detailRequests.set(musicId, request);
    return request;
}

export function clearLyricsCache(): void {
    indexCache = null;
    indexCachedAt = 0;
    indexRequest = null;
    detailCache.clear();
    detailRequests.clear();
}
