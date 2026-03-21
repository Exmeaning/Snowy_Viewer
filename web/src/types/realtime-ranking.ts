import { IHonorInfo, IHonorGroup, IBondsHonor, IBondsHonorWord, IGameCharaUnit } from "@/types/honor";
import { ICardInfo } from "@/types/types";

export type RealtimeRankingRegion = "cn" | "jp";

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
    honors: NormalizedPlayerHonor[];
    raw: RealtimeRankingRawEntry;
}

export interface RealtimeRankingEntryWithDiff extends RealtimeRankingEntry {
    previousRank?: number;
    previousScore?: number;
    rankDelta: number;
    scoreDelta: number;
    isNewEntry: boolean;
}

export interface RealtimeRankingSnapshot {
    eventId: number;
    region: RealtimeRankingRegion;
    startAt: number;
    endAt: number;
    updatedAt: number;
    entries: RealtimeRankingEntry[];
}

export interface RealtimeRankingMasterData {
    cards: ICardInfo[];
    honors: IHonorInfo[];
    honorGroups: IHonorGroup[];
    bondsHonors: IBondsHonor[];
    bondsHonorWords: IBondsHonorWord[];
    gameCharaUnits: IGameCharaUnit[];
}
