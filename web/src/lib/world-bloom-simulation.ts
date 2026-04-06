export const FINAL_CHAPTER_EVENT_ID = 180;

export const WL3_SIMULATION_GROUPS = [
    { groupId: 1, eventId: 3200001, title: "第1组", members: [21, 1, 6, 14, 17] },
    { groupId: 2, eventId: 3200002, title: "第2组", members: [22, 23, 4, 5, 10, 13] },
    { groupId: 3, eventId: 3200003, title: "第3组", members: [24, 3, 8, 9, 18] },
    { groupId: 4, eventId: 3200004, title: "第4组", members: [26, 2, 12, 16, 20] },
    { groupId: 5, eventId: 3200005, title: "第5组", members: [25, 7, 11, 15, 19] },
] as const;

export type Wl3SimulationGroup = typeof WL3_SIMULATION_GROUPS[number];

interface EventEntry {
    id: number;
    eventType?: string;
    [key: string]: unknown;
}

interface GameCharacterUnitEntry {
    id: number;
    gameCharacterId: number;
    unit: string;
}

interface EventDeckBonusEntry {
    id: number;
    eventId: number;
    gameCharacterUnitId?: number;
    cardAttr?: string;
    bonusRate: number;
}

interface WorldBloomEntry {
    id: number;
    eventId: number;
    gameCharacterId: number;
    worldBloomChapterType?: string;
    chapterNo: number;
    chapterStartAt: number;
    aggregateAt: number;
    chapterEndAt: number;
    isSupplemental: boolean;
}

interface CardEntry {
    id: number;
    characterId: number;
}

interface EventCardEntry {
    id: number;
    eventId: number;
    cardId: number;
    bonusRate?: number;
}

interface WorldBloomSupportDeckUnitEventLimitedBonusEntry {
    id: number;
    eventId: number;
    gameCharacterId: number;
    cardId: number;
    bonusRate: number;
}

type RawMasterDataLoader = <T = unknown>(key: string) => Promise<T[]>;

export function getWl3SimulationGroupByEventId(eventId: number | string | null | undefined): Wl3SimulationGroup | null {
    if (eventId === null || eventId === undefined || eventId === "") return null;
    const parsed = typeof eventId === "number" ? eventId : Number.parseInt(eventId, 10);
    if (!Number.isFinite(parsed)) return null;
    return WL3_SIMULATION_GROUPS.find(group => group.eventId === parsed) ?? null;
}

export function getWorldBloomEventTurn(eventId: number): 1 | 2 | 3 {
    if (eventId > 1000) {
        return (((Math.floor(eventId / 100000)) % 10) + 1) as 1 | 2 | 3;
    }
    if (eventId <= 140) return 1;
    if (eventId <= 180) return 2;
    return 3;
}

function appendMissingEntries<T extends { id: number }>(base: T[], extras: T[]): T[] {
    const existingIds = new Set(base.map(item => item.id));
    const appended = extras.filter(item => !existingIds.has(item.id));
    return appended.length > 0 ? [...base, ...appended] : base;
}

function buildFakeWl3Events(events: EventEntry[]): EventEntry[] {
    const fakeEvents = WL3_SIMULATION_GROUPS.map(group => ({
        id: group.eventId,
        eventType: "world_bloom",
        name: `WL3模拟 ${group.title}`,
        assetbundleName: "",
        bgmAssetbundleName: "",
        eventOnlyComponentDisplayStartAt: 0,
        startAt: 0,
        aggregateAt: 0,
        rankingAnnounceAt: 0,
        distributionStartAt: 0,
        eventOnlyComponentDisplayEndAt: 0,
        closedAt: 0,
        distributionEndAt: 0,
        virtualLiveId: 0,
        unit: "",
        isCountLeaderCharacterPlay: false,
    }));
    return appendMissingEntries(events, fakeEvents);
}

function buildFakeWl3EventDeckBonuses(
    eventDeckBonuses: EventDeckBonusEntry[],
    gameCharacterUnits: GameCharacterUnitEntry[],
): EventDeckBonusEntry[] {
    const nextIdBase = Math.max(0, ...eventDeckBonuses.map(item => item.id || 0)) + 1;
    const extras: EventDeckBonusEntry[] = [];
    let nextId = nextIdBase;

    for (const group of WL3_SIMULATION_GROUPS) {
        const memberSet = new Set<number>(group.members);
        for (const charaUnit of gameCharacterUnits) {
            if (!memberSet.has(charaUnit.gameCharacterId)) continue;
            extras.push({
                id: nextId++,
                eventId: group.eventId,
                gameCharacterUnitId: charaUnit.id,
                cardAttr: undefined,
                bonusRate: 25,
            });
        }
    }

    return appendMissingEntries(eventDeckBonuses, extras);
}

function buildFakeWl3WorldBlooms(worldBlooms: WorldBloomEntry[]): WorldBloomEntry[] {
    const nextIdBase = Math.max(0, ...worldBlooms.map(item => item.id || 0)) + 1;
    const extras: WorldBloomEntry[] = [];
    let nextId = nextIdBase;

    for (const group of WL3_SIMULATION_GROUPS) {
        let chapterNo = 1;
        for (const characterId of group.members) {
            extras.push({
                id: nextId++,
                eventId: group.eventId,
                gameCharacterId: characterId,
                worldBloomChapterType: "game_character",
                chapterNo: chapterNo++,
                chapterStartAt: 0,
                aggregateAt: 0,
                chapterEndAt: 0,
                isSupplemental: false,
            });
        }
    }

    return appendMissingEntries(worldBlooms, extras);
}

function buildFakeWl3LimitedBonuses(
    bonuses: WorldBloomSupportDeckUnitEventLimitedBonusEntry[],
    cards: CardEntry[],
    eventCards: EventCardEntry[],
    events: EventEntry[],
): WorldBloomSupportDeckUnitEventLimitedBonusEntry[] {
    const nextIdBase = Math.max(0, ...bonuses.map(item => item.id || 0)) + 1;
    const cardCharacterMap = new Map(cards.map(card => [card.id, card.characterId]));
    const eventTypeMap = new Map(events.map(event => [event.id, event.eventType]));
    const existing = new Set(bonuses.map(item => `${item.eventId}:${item.gameCharacterId}:${item.cardId}`));
    const extras: WorldBloomSupportDeckUnitEventLimitedBonusEntry[] = [];
    let nextId = nextIdBase;

    for (const group of WL3_SIMULATION_GROUPS) {
        const memberSet = new Set<number>(group.members);
        const used = new Set<string>();

        for (const eventCard of eventCards) {
            if (eventCard.eventId === FINAL_CHAPTER_EVENT_ID) continue;
            if (getWorldBloomEventTurn(eventCard.eventId) > 2) continue;
            if ((eventCard.bonusRate ?? 0) <= 0) continue;
            if (eventTypeMap.get(eventCard.eventId) !== "world_bloom") continue;

            const characterId = cardCharacterMap.get(eventCard.cardId);
            if (characterId === undefined || !memberSet.has(characterId)) continue;

            const uniqueKey = `${characterId}:${eventCard.cardId}`;
            if (used.has(uniqueKey)) continue;
            used.add(uniqueKey);

            const idKey = `${group.eventId}:${characterId}:${eventCard.cardId}`;
            if (existing.has(idKey)) continue;
            existing.add(idKey);

            extras.push({
                id: nextId++,
                eventId: group.eventId,
                gameCharacterId: characterId,
                cardId: eventCard.cardId,
                bonusRate: 20,
            });
        }
    }

    return appendMissingEntries(bonuses, extras);
}

export async function augmentMasterDataWithWorldBloomSimulation<T>(
    key: string,
    data: T[],
    loadRawMasterData: RawMasterDataLoader,
): Promise<T[]> {
    if (key === "events") {
        return buildFakeWl3Events(data as EventEntry[]) as T[];
    }
    if (key === "eventDeckBonuses") {
        const gameCharacterUnits = await loadRawMasterData<GameCharacterUnitEntry>("gameCharacterUnits");
        return buildFakeWl3EventDeckBonuses(data as EventDeckBonusEntry[], gameCharacterUnits) as T[];
    }
    if (key === "worldBlooms") {
        return buildFakeWl3WorldBlooms(data as WorldBloomEntry[]) as T[];
    }
    if (key === "worldBloomSupportDeckUnitEventLimitedBonuses") {
        const [cards, eventCards, events] = await Promise.all([
            loadRawMasterData<CardEntry>("cards"),
            loadRawMasterData<EventCardEntry>("eventCards"),
            loadRawMasterData<EventEntry>("events"),
        ]);
        return buildFakeWl3LimitedBonuses(
            data as WorldBloomSupportDeckUnitEventLimitedBonusEntry[],
            cards,
            eventCards,
            buildFakeWl3Events(events),
        ) as T[];
    }
    return data;
}
