import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import {
    RealtimeRankingApiResponse,
    RealtimeRankingEntry,
    RealtimeRankingMasterData,
    RealtimeRankingRawEntry,
    RealtimeRankingRegion,
    RealtimeRankingSnapshot,
    NormalizedPlayerHonor,
    ChurnApiResponse,
    ChurnBoardType,
    WorldLinkApiResponse,
    WorldLinkGroupApiResponse,
    WorldLinkGroupSnapshot,
    WorldLinkSnapshot,
} from "@/types/realtime-ranking";
import { ICardInfo } from "@/types/types";
import { IBondsHonor, IBondsHonorWord, IGameCharaUnit, IHonorGroup, IHonorInfo } from "@/types/honor";

// /realtime-ranking uses the public rks.exmeaning.com live ranking API.
// Do not route through the local /api/public by default because this repository has no proxy route for it.
const BASE_URL = (
    process.env.NEXT_PUBLIC_REALTIME_RANKING_API_BASE || "https://rks.exmeaning.com/api/public"
).replace(/\/+$/, "");
const CHURN_TIMEOUT_MS = 15_000;

type RealtimeRankingErrorValues = Record<string, string | number>;

export type RealtimeRankingTranslationFn = (key: string, values?: RealtimeRankingErrorValues) => string;

export type RealtimeRankingErrorCode =
    | "rankingFetchFailed"
    | "rankingTimeout"
    | "worldLinkFetchFailed"
    | "missingWorldLinkCharacter"
    | "churnFetchFailed"
    | "churnTimeout"
    | "unknown";

export class RealtimeRankingApiError extends Error {
    code: RealtimeRankingErrorCode;
    values?: RealtimeRankingErrorValues;

    constructor(code: RealtimeRankingErrorCode, values?: RealtimeRankingErrorValues) {
        super(code);
        this.name = "RealtimeRankingApiError";
        this.code = code;
        this.values = values;
    }
}

const FALLBACK_ERROR_MESSAGES: Record<RealtimeRankingErrorCode, string> = {
    rankingFetchFailed: "Failed to fetch live ranking: {status}",
    rankingTimeout: "The live ranking request timed out. Please try again later.",
    worldLinkFetchFailed: "Failed to fetch WL solo board: {status}",
    missingWorldLinkCharacter: "Missing WL board character ID",
    churnFetchFailed: "Failed to fetch churn data (HTTP {status})",
    churnTimeout: "The churn data request timed out. Please try again later.",
    unknown: "Failed to load live ranking",
};

function interpolateFallback(message: string, values?: RealtimeRankingErrorValues): string {
    if (!values) return message;
    return message.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function getRealtimeRankingErrorMessage(error: unknown, t?: RealtimeRankingTranslationFn): string {
    if (error instanceof RealtimeRankingApiError) {
        const key = `page.realtimeRanking.errors.${error.code}`;
        const translated = t?.(key, error.values);
        if (translated && translated !== key) return translated;
        return interpolateFallback(FALLBACK_ERROR_MESSAGES[error.code], error.values);
    }

    if (error instanceof Error && error.message) return error.message;

    const key = "page.realtimeRanking.errors.unknown";
    const translated = t?.(key);
    return translated && translated !== key ? translated : FALLBACK_ERROR_MESSAGES.unknown;
}

function buildRealtimeRankingApiUrl(
    path: string,
    query?: Record<string, string | number | null | undefined>,
): string {
    const pathname = `${BASE_URL}/${path.replace(/^\/+|\/+$/g, "")}/`;
    if (!query) return pathname;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value == null || value === "") continue;
        searchParams.set(key, String(value));
    }

    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
}

function pickSignature(raw: RealtimeRankingRawEntry): string | undefined {
    const candidates = [raw.word, raw.signature, raw.profile, raw.comment, raw.rawSignature, raw.selfIntroduction];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return undefined;
}

function pickLeaderCardId(raw: RealtimeRankingRawEntry): number | undefined {
    const candidates = [raw.leaderCard?.cardId, raw.leaderCardId, raw.cardId, raw.deckLeaderCardId, raw.leader_card_id];
    for (const candidate of candidates) {
        if (typeof candidate === "number") return candidate;
        if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
    }
    return undefined;
}

function pickLeaderCharacterId(raw: RealtimeRankingRawEntry): number | undefined {
    const candidates = [raw.leaderCard?.characterId, raw.leaderCharacterId, raw.characterId, raw.deckLeaderCharacterId, raw.leader_character_id];
    for (const candidate of candidates) {
        if (typeof candidate === "number") return candidate;
        if (typeof candidate === "string" && /^\d+$/.test(candidate)) return Number(candidate);
    }
    return undefined;
}

function tryParseNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return undefined;
}

function normalizeHonorItem(item: unknown): NormalizedPlayerHonor | null {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;

    const profileHonorType = typeof record.profileHonorType === "string" ? record.profileHonorType : undefined;
    const kind = typeof record.kind === "string"
        ? record.kind
        : typeof record.type === "string"
            ? record.type
            : profileHonorType;

    const honorId = tryParseNumber(record.honorId ?? record.honor_id ?? record.id);
    const honorLevel = tryParseNumber(record.honorLevel ?? record.honor_level ?? record.level);

    const bondsHonorId = tryParseNumber(
        record.bondsHonorId
        ?? record.bonds_honor_id
        ?? (profileHonorType === "bonds" ? record.honorId : undefined)
        ?? (kind === "bonds" ? record.id : undefined)
    );
    const bondsHonorLevel = tryParseNumber(
        record.bondsHonorLevel
        ?? record.bonds_honor_level
        ?? (profileHonorType === "bonds" ? record.honorLevel : undefined)
        ?? (kind === "bonds" ? record.level : undefined)
    );

    const bondsHonorWordId = tryParseNumber(record.bondsHonorWordId ?? record.bonds_honor_word_id);
    const bondsHonorWordAssetbundleName =
        typeof (record.bondsHonorWordAssetbundleName ?? record.bonds_honor_word_assetbundle_name ?? record.wordAssetbundleName) === "string"
            ? String(record.bondsHonorWordAssetbundleName ?? record.bonds_honor_word_assetbundle_name ?? record.wordAssetbundleName)
            : bondsHonorWordId
                ? `__WORD_ID__:${bondsHonorWordId}`
                : undefined;

    if (kind === "bonds" || profileHonorType === "bonds" || bondsHonorId) {
        if (!bondsHonorId) return null;
        return {
            kind: "bonds",
            bondsHonorId,
            bondsHonorLevel,
            bondsHonorWordAssetbundleName,
        };
    }

    if (!honorId) return null;
    return {
        kind: "normal",
        honorId,
        honorLevel,
    };
}

function pickHonors(raw: RealtimeRankingRawEntry): NormalizedPlayerHonor[] {
    const sources = [
        raw.profileHonors,
        raw.honors,
        raw.badges,
        raw.badge ? [raw.badge] : undefined,
        raw.honor ? [raw.honor] : undefined,
    ];

    for (const source of sources) {
        if (!Array.isArray(source)) continue;
        const normalized = source.map(normalizeHonorItem).filter((item): item is NormalizedPlayerHonor => !!item);
        if (normalized.length > 0) return normalized.slice(0, 3);
    }

    return [];
}

function normalizeEntry(raw: RealtimeRankingRawEntry): RealtimeRankingEntry {
    return {
        rank: raw.rank,
        score: raw.score,
        displayName: raw.name?.trim() || `Player ${raw.userId}`,
        userId: String(raw.userId),
        signature: pickSignature(raw),
        leaderCardId: pickLeaderCardId(raw),
        leaderCharacterId: pickLeaderCharacterId(raw),
        leaderCardDefaultImage: raw.leaderCard?.defaultImage,
        leaderCardMasterRank: raw.leaderCard?.masterRank,
        honors: pickHonors(raw),
        raw,
    };
}

function normalizeSnapshotBase(
    eventId: number,
    region: RealtimeRankingRegion,
    startAt: number,
    endAt: number,
    updatedAt: number,
    rankings: RealtimeRankingRawEntry[],
): RealtimeRankingSnapshot {
    return {
        eventId,
        region,
        startAt,
        endAt,
        updatedAt,
        entries: Array.isArray(rankings) ? rankings.map(normalizeEntry) : [],
    };
}

function normalizeWorldLinkGroup(group: WorldLinkGroupApiResponse): WorldLinkGroupSnapshot {
    const base = normalizeSnapshotBase(
        group.event_id,
        group.region,
        group.start_at,
        group.end_at,
        group.updated_at,
        group.rankings,
    );

    return {
        ...base,
        gameCharacterId: group.game_character_id,
        userRankingStatus: group.user_ranking_status,
        isWorldBloomChapterAggregate: group.is_world_bloom_chapter_aggregate,
    };
}

export async function fetchRealtimeRanking(region: RealtimeRankingRegion): Promise<RealtimeRankingSnapshot> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(buildRealtimeRankingApiUrl(`${region}/latest`), {
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new RealtimeRankingApiError("rankingFetchFailed", { status: response.status });
        }

        const data: RealtimeRankingApiResponse = await response.json();

        return normalizeSnapshotBase(
            data.event_id,
            data.region,
            data.start_at,
            data.end_at,
            data.updated_at,
            data.rankings,
        );
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new RealtimeRankingApiError("rankingTimeout");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

export async function fetchWorldLinkRanking(region: RealtimeRankingRegion): Promise<WorldLinkSnapshot | null> {
    const controller = new AbortController();
    // WL responses (~200KB+) are much larger than overall-board responses (~70KB), so 10s can time out on slow networks.
    // A 200 response can still be aborted before the body finishes downloading, which would falsely show the pending-sync notice.
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(buildRealtimeRankingApiUrl(`${region}/worldlink-latest`), {
            cache: "no-store",
            signal: controller.signal,
        });
        if (response.status === 404 || response.status === 503) {
            return null;
        }
        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            if (errorText.includes("no worldlink data available")) {
                return null;
            }
            throw new RealtimeRankingApiError("worldLinkFetchFailed", { status: response.status });
        }

        const data: WorldLinkApiResponse = await response.json();
        return {
            eventId: data.event_id,
            region: data.region,
            startAt: data.start_at,
            endAt: data.end_at,
            updatedAt: data.updated_at,
            groups: Array.isArray(data.groups) ? data.groups.map(normalizeWorldLinkGroup) : [],
        };
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return null;
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function fetchMasterDataFromSource<T>(region: RealtimeRankingRegion, path: string): Promise<T> {
    return region === "cn" || region === "jp"
        ? fetchMasterData<T>(path)
        : fetchMasterDataForServer<T>(region, path);
}

export async function fetchRealtimeRankingMasterData(region: RealtimeRankingRegion): Promise<RealtimeRankingMasterData> {
    const [cards, honors, honorGroups, bondsHonors, bondsHonorWords, gameCharaUnits] = await Promise.all([
        fetchMasterDataFromSource<ICardInfo[]>(region, "cards.json").catch(() => []),
        fetchMasterDataFromSource<IHonorInfo[]>(region, "honors.json").catch(() => []),
        fetchMasterDataFromSource<IHonorGroup[]>(region, "honorGroups.json").catch(() => []),
        fetchMasterDataFromSource<IBondsHonor[]>(region, "bondsHonors.json").catch(() => []),
        fetchMasterDataFromSource<IBondsHonorWord[]>(region, "bondsHonorWords.json").catch(() => []),
        fetchMasterDataFromSource<IGameCharaUnit[]>(region, "gameCharacterUnits.json").catch(() => []),
    ]);

    return {
        cards,
        honors,
        honorGroups,
        bondsHonors,
        bondsHonorWords,
        gameCharaUnits,
    };
}

export async function fetchRealtimeRankingEvents(region: RealtimeRankingRegion) {
    return fetchMasterDataFromSource<import("@/types/events").IEventInfo[]>(region, "events.json");
}

export async function fetchChurnData(region: RealtimeRankingRegion): Promise<ChurnApiResponse> {
    return fetchScopedChurnData(region, "overall");
}

export async function fetchWorldLinkChurnData(region: RealtimeRankingRegion, gameCharacterId: number): Promise<ChurnApiResponse> {
    return fetchScopedChurnData(region, "worldlink", gameCharacterId);
}

async function fetchScopedChurnData(
    region: RealtimeRankingRegion,
    boardType: ChurnBoardType,
    gameCharacterId?: number,
): Promise<ChurnApiResponse> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CHURN_TIMEOUT_MS);
    if (boardType === "worldlink" && !gameCharacterId) {
        throw new RealtimeRankingApiError("missingWorldLinkCharacter");
    }

    const url = buildRealtimeRankingApiUrl(
        `${region}/${boardType === "worldlink" ? "worldlink-churn" : "churn"}`,
        boardType === "worldlink" ? { gameCharacterId } : undefined,
    );

    try {
        const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new RealtimeRankingApiError("churnFetchFailed", { status: response.status });
        }
        return response.json();
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new RealtimeRankingApiError("churnTimeout");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}
