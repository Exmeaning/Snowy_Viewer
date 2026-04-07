import { IHonorInfo, IHonorGroup, IBondsHonor, IBondsHonorWord, IGameCharaUnit } from "@/types/honor";
import { ICardInfo } from "@/types/types";

export type RealtimeRankingRegion = "cn" | "jp";
export type RealtimeRankingBoardMode = "overall" | "worldlink";
export type ChurnBoardType = "overall" | "worldlink";

export interface RealtimeRankingRawProfileHonor {
    seq: number;
    profileHonorType: "normal" | "bonds" | string;
    honorId: number;
    honorLevel: number;
    bondsHonorViewType?: string;
    bondsHonorWordId?: number;
}

export interface RealtimeRankingRawLeaderCard {
    cardId: number;
    level?: number;
    masterRank?: number;
    specialTrainingStatus?: string;
    defaultImage?: string;
    characterId?: number;
}

export interface RealtimeRankingRawEntry {
    rank: number;
    score: number;
    name: string;
    userId: number | string;
    word?: string;
    signature?: string;
    profile?: string;
    comment?: string;
    leaderCard?: RealtimeRankingRawLeaderCard;
    leaderCardId?: number;
    leaderCharacterId?: number;
    cardId?: number;
    characterId?: number;
    profileHonors?: RealtimeRankingRawProfileHonor[];
    honor?: unknown;
    honors?: unknown[];
    badge?: unknown;
    badges?: unknown[];
    [key: string]: unknown;
}

export interface RealtimeRankingApiResponse {
    event_id: number;
    region: RealtimeRankingRegion;
    start_at: number;
    end_at: number;
    updated_at: number;
    rankings: RealtimeRankingRawEntry[];
}

export interface NormalizedPlayerHonor {
    kind: "normal" | "bonds";
    honorId?: number;
    honorLevel?: number;
    bondsHonorId?: number;
    bondsHonorLevel?: number;
    bondsHonorWordAssetbundleName?: string;
}

export interface RealtimeRankingEntry {
    rank: number;
    score: number;
    displayName: string;
    userId: string;
    signature?: string;
    leaderCardId?: number;
    leaderCharacterId?: number;
    leaderCardDefaultImage?: "special_training" | "original" | string;
    leaderCardMasterRank?: number;
    honors: NormalizedPlayerHonor[];
    raw: RealtimeRankingRawEntry;
}

export interface RealtimeRankingEntryWithDiff extends RealtimeRankingEntry {
    previousRank?: number;
    previousScore?: number;
    rankDelta: number;
    scoreDelta: number;
    isNewEntry: boolean;
    /** 上一次分数确实发生变化时的 scoreDelta（用于分数无变化时 fallback 显示） */
    lastScoreDelta?: number;
    /** 上一次排名确实发生变化时的 rankDelta */
    lastRankDelta?: number;
    /** 上一次分数/排名发生变化的时间戳（ms） */
    lastChangedAt?: number;
}

export interface RealtimeRankingSnapshot {
    eventId: number;
    region: RealtimeRankingRegion;
    startAt: number;
    endAt: number;
    updatedAt: number;
    entries: RealtimeRankingEntry[];
}

export interface WorldLinkGroupApiResponse {
    event_id: number;
    region: RealtimeRankingRegion;
    game_character_id: number;
    start_at: number;
    end_at: number;
    updated_at: number;
    user_ranking_status: string;
    is_world_bloom_chapter_aggregate: boolean;
    rankings: RealtimeRankingRawEntry[];
}

export interface WorldLinkApiResponse {
    event_id: number;
    region: RealtimeRankingRegion;
    start_at: number;
    end_at: number;
    updated_at: number;
    groups: WorldLinkGroupApiResponse[];
}

export interface WorldLinkGroupSnapshot extends RealtimeRankingSnapshot {
    gameCharacterId: number;
    userRankingStatus: string;
    isWorldBloomChapterAggregate: boolean;
}

export interface WorldLinkSnapshot {
    eventId: number;
    region: RealtimeRankingRegion;
    startAt: number;
    endAt: number;
    updatedAt: number;
    groups: WorldLinkGroupSnapshot[];
}

export interface RealtimeRankingMasterData {
    cards: ICardInfo[];
    honors: IHonorInfo[];
    honorGroups: IHonorGroup[];
    bondsHonors: IBondsHonor[];
    bondsHonorWords: IBondsHonorWord[];
    gameCharaUnits: IGameCharaUnit[];
}

// ============================================================================
// Churn (周回) Types
// ============================================================================

export interface ChurnHourlyEntry {
    hour: string;   // ISO 时间字符串，如 "2026-03-23T13:00:00Z"
    count: number;
}

export interface ChurnLastChange {
    time: number;
    old_score: number;
    new_score: number;
    delta: number;
}

export interface ChurnRecentActivity {
    count: number;
    changed_at: number[];
}

export interface ChurnParkingPeriod {
    /** Unix 毫秒时间戳 */
    start_time: number;
    /** Unix 毫秒时间戳；undefined 表示仍在停车中 */
    end_time?: number;
    /** 停车时长（秒），仅已结束的停车区间有值 */
    duration_s?: number;
}

export interface ChurnRankingEntry {
    rank: number;
    userId: number | string;
    name: string;
    score: number;
    churn_48h: number;
    hourly_churn: ChurnHourlyEntry[];
    last_change: ChurnLastChange | null;
    recent_activity: ChurnRecentActivity;
    parking_periods: ChurnParkingPeriod[];
}

export interface ChurnApiResponse {
    event_id: number;
    region: RealtimeRankingRegion;
    board_type: ChurnBoardType;
    target_id: number;
    updated_at: number;
    rankings: ChurnRankingEntry[];
}
