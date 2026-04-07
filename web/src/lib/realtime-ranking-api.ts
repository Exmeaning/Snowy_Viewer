import { fetchMasterData } from "@/lib/fetch";
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

const BASE_URL = (process.env.NEXT_PUBLIC_REALTIME_RANKING_API_BASE || "/api/public").replace(/\/+$/, "");
const CHURN_TIMEOUT_MS = 15_000;

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
        displayName: raw.name?.trim() || `玩家 ${raw.userId}`,
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
            throw new Error(`获取实时排行榜失败：${response.status}`);
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
            throw new Error("实时排行榜请求超时，请稍后重试");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

export async function fetchWorldLinkRanking(region: RealtimeRankingRegion): Promise<WorldLinkSnapshot | null> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(buildRealtimeRankingApiUrl(`${region}/worldlink-latest`), {
            cache: "no-store",
            signal: controller.signal,
        });
        if (response.status === 404 || response.status === 503) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`获取 WL 单人榜失败：${response.status}`);
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

export async function fetchRealtimeRankingMasterData(): Promise<RealtimeRankingMasterData> {
    const [cards, honors, honorGroups, bondsHonors, bondsHonorWords, gameCharaUnits] = await Promise.all([
        fetchMasterData<ICardInfo[]>("cards.json").catch(() => []),
        fetchMasterData<IHonorInfo[]>("honors.json").catch(() => []),
        fetchMasterData<IHonorGroup[]>("honorGroups.json").catch(() => []),
        fetchMasterData<IBondsHonor[]>("bondsHonors.json").catch(() => []),
        fetchMasterData<IBondsHonorWord[]>("bondsHonorWords.json").catch(() => []),
        fetchMasterData<IGameCharaUnit[]>("gameCharacterUnits.json").catch(() => []),
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
        throw new Error("缺少 WL 单榜角色 ID");
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
            throw new Error(`获取周回数据失败（HTTP ${response.status}）`);
        }
        return response.json();
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("周回数据请求超时，请稍后重试");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}
