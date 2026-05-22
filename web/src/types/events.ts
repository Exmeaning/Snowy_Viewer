// Event Types for Moesekai
// Based on sekai.best and Haruki master data structure

export type EventType =
    | "marathon"
    | "cheerful_carnival"
    | "world_bloom";

export interface IEventInfo {
    id: number;
    eventType: EventType;
    name: string;
    assetbundleName: string;
    bgmAssetbundleName: string;
    eventOnlyComponentDisplayStartAt: number;
    startAt: number;
    aggregateAt: number;
    rankingAnnounceAt: number;
    distributionStartAt: number;
    eventOnlyComponentDisplayEndAt: number;
    closedAt: number;
    distributionEndAt: number;
    virtualLiveId: number;
    unit: string;
    isCountLeaderCharacterPlay: boolean;
    eventRankingRewardRanges?: IEventRankingRewardRange[];
}

export interface IEventRankingRewardRange {
    id: number;
    eventId: number;
    fromRank: number;
    toRank: number;
    isToRankBorder: boolean;
    eventRankingRewards: IEventRankingReward[];
}

export interface IEventRankingReward {
    id: number;
    eventRankingRewardRangeId: number;
    seq: number;
    resourceBoxId: number;
    rewardConditionType: string;
}

export interface IEventDeckBonus {
    id: number;
    eventId: number;
    gameCharacterUnitId?: number;
    cardAttr?: string;
    bonusRate: number;
}

export interface IEventCard {
    id: number;
    eventId: number;
    cardId: number;
    bonusRate?: number;
}

export interface IEventMusic {
    eventId: number;
    musicId: number;
    seq: number;
    releaseConditionId: number;
}

export const EVENT_TYPE_IDS = ["marathon", "cheerful_carnival", "world_bloom"] as const;
export const EVENT_TYPE_LABEL_KEYS: Record<EventType, string> = {
    marathon: "common.eventTypes.marathon",
    cheerful_carnival: "common.eventTypes.cheerful_carnival",
    world_bloom: "common.eventTypes.world_bloom",
};

// Event type colors
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
    marathon: "#F06292",
    cheerful_carnival: "#FFB74D",
    world_bloom: "#81C784",
};

/**
 * Get event status based on current time
 */
export type EventStatus = "upcoming" | "ongoing" | "ended";

export function getEventStatus(event: IEventInfo): EventStatus {
    const now = Date.now();
    if (now < event.startAt) return "upcoming";
    if (now > event.aggregateAt) return "ended";
    return "ongoing";
}

/**
 * Get event status display info
 */
export const EVENT_STATUS_DISPLAY: Record<EventStatus, { labelKey: string; color: string }> = {
    upcoming: { labelKey: "common.status.upcoming", color: "#42A5F5" },
    ongoing: { labelKey: "common.status.ongoing", color: "#66BB6A" },
    ended: { labelKey: "common.status.ended", color: "#9E9E9E" },
};

export interface IBilibiliEvent {
    event_id: number;
    event_name: string;
    bilibili_url: string | null;
    bvid: string | null;
    match_status: string;
}

export interface IBilibiliEventsResponse {
    generated_at: string;
    source: {
        wiki_page: string;
        events_api: string;
    };
    events: IBilibiliEvent[];
}
