import { EVENT_TYPE_TO_FILTER_ID, EVENT_UNIT_FILTERS, type EventUnitFilterId } from "@/components/events/EventFilters";
import type { ICharaUnitInfo } from "@/types/types";

export interface IActionSet {
    releaseConditionId: number;
    scenarioId?: string;
}

export interface IEventStory {
    id: number;
    eventId: number;
    bannerGameCharacterUnitId: number;
}

/**
 * Build a map from eventId → raw unit string (e.g. "band", "idol", "shuffle")
 * by parsing actionSets data.
 */
export function buildEventRawUnitMap(actionSets: IActionSet[]): Map<number, string> {
    const map = new Map<number, string>();
    map.set(1, "band");
    map.set(5, "idol");
    map.set(6, "street");
    map.set(9, "shuffle");

    for (const action of actionSets) {
        const rcId = String(action.releaseConditionId);
        if (
            action.scenarioId &&
            (action.scenarioId.includes("areatalk_ev") || action.scenarioId.includes("areatalk_wl")) &&
            rcId.length === 6 &&
            rcId[0] === "1"
        ) {
            const eventId = parseInt(rcId.substring(1, 4), 10) + 1;
            const eventType = action.scenarioId.split("_")[2];
            if (!map.has(eventId)) {
                map.set(eventId, eventType);
            }
        }
    }
    return map;
}

/**
 * Convert a raw unit string to a filter ID.
 * Known group units map to their filter ID; unknown ones become "mixed".
 */
export function rawUnitToFilterId(raw: string): EventUnitFilterId {
    return EVENT_TYPE_TO_FILTER_ID[raw] || "mixed";
}

/**
 * Get the display name for an event's unit given the eventUnitMap (filterId map).
 * Returns "无" if the event has no entry in the map.
 */
export function getEventUnitDisplayName(eventId: number, eventUnitMap: Map<number, EventUnitFilterId>): string {
    const filterId = eventUnitMap.get(eventId);
    if (!filterId) return "无";
    const unitInfo = EVENT_UNIT_FILTERS.find(u => u.id === filterId);
    return unitInfo?.name ?? "其他";
}

/**
 * Build a map from eventId → gameCharacterId (banner character).
 * Uses eventStories.json's bannerGameCharacterUnitId and resolves it
 * to a gameCharacterId via gameCharacterUnits.
 */
export function buildEventBannerCharMap(
    eventStories: IEventStory[],
    charaUnits: ICharaUnitInfo[],
): Map<number, number> {
    const unitIdToCharId = new Map<number, number>();
    for (const cu of charaUnits) {
        unitIdToCharId.set(cu.id, cu.gameCharacterId);
    }

    const map = new Map<number, number>();
    for (const story of eventStories) {
        const charId = unitIdToCharId.get(story.bannerGameCharacterUnitId);
        if (charId !== undefined) {
            map.set(story.eventId, charId);
        }
    }
    return map;
}
