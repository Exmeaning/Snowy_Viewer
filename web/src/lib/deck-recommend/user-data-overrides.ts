/**
 * Advanced override layer over the player data snapshot (pure functions).
 *
 * The allium-deck UserProfile already consumes userCharacters (character
 * ranks), userAreas (area items), userMysekaiGates, userMysekaiFixtureGame-
 * CharacterPerformanceBonuses and userHonors, so no engine change is needed.
 * This module rewrites the snapshot before the request, matching the
 * Haruki-Toolbox semantics: a uniform value applies to every known item and
 * is clamped to its cap, single-item overrides take precedence, and missing
 * items are inserted from masterdata.
 */

import type {
    DeckAreaItemOverride,
    DeckCharacterRankOverride,
    DeckMysekaiFixtureOverride,
    DeckMysekaiGateOverride,
    DeckUserDataOverrides,
} from "./engine-types";

type JsonRecord = Record<string, unknown>;

/** Masterdata subset consumed by the override layer (raw moe camelCase rows). */
export interface DeckOverrideMasterData {
    areaItems?: unknown[];
    areaItemLevels?: unknown[];
    gameCharacters?: unknown[];
    characterRanks?: unknown[];
    mysekaiGates?: unknown[];
    mysekaiGateLevels?: unknown[];
    /** Card master rows: used for cardId -> characterId mapping in character filtering. */
    cards?: unknown[];
}

function isRecord(value: unknown): value is JsonRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecords(value: unknown): JsonRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function intValue(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
}

function positive(value: unknown): number | null {
    const n = intValue(value);
    return n > 0 ? n : null;
}

function nonNegative(value: unknown): number | null {
    const n = intValue(value);
    return n >= 0 ? n : null;
}

function clamp(value: number, max: number): number {
    return Math.min(Math.max(value, 0), max);
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

// ==================== Masterdata indexes ====================

function areaItemMaxLevelMap(areaItemLevels: unknown[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of asRecords(areaItemLevels)) {
        const id = positive(row.areaItemId);
        const level = positive(row.level);
        if (id === null || level === null) continue;
        map.set(id, Math.max(map.get(id) ?? 0, level));
    }
    return map;
}

function areaItemAreaMap(areaItems: unknown[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of asRecords(areaItems)) {
        const id = positive(row.id);
        const areaId = positive(row.areaId);
        if (id !== null && areaId !== null) map.set(id, areaId);
    }
    return map;
}

function gameCharacterIds(gameCharacters: unknown[]): number[] {
    const ids: number[] = [];
    for (const row of asRecords(gameCharacters)) {
        const id = positive(row.id);
        if (id !== null) ids.push(id);
    }
    return ids.sort((a, b) => a - b);
}

function characterMaxRankMap(gameCharacters: unknown[], characterRanks: unknown[]): Map<number, number> {
    const map = new Map<number, number>();
    let globalMax = 0;
    for (const row of asRecords(characterRanks)) {
        const characterId = positive(row.characterId);
        const rank = positive(row.characterRank);
        if (rank === null) continue;
        globalMax = Math.max(globalMax, rank);
        if (characterId !== null) {
            map.set(characterId, Math.max(map.get(characterId) ?? 0, rank));
        }
    }
    // Compatible with a global rank table that has no characterId column.
    if (map.size === 0) {
        for (const id of gameCharacterIds(gameCharacters)) {
            map.set(id, globalMax);
        }
    } else {
        for (const id of gameCharacterIds(gameCharacters)) {
            if (!map.has(id)) map.set(id, globalMax);
        }
    }
    return map;
}

function mysekaiGateMaxLevelMap(
    mysekaiGates: unknown[],
    mysekaiGateLevels: unknown[],
): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of asRecords(mysekaiGateLevels)) {
        const gateId = positive(row.mysekaiGateId);
        const level = positive(row.level);
        if (gateId === null || level === null) continue;
        map.set(gateId, Math.max(map.get(gateId) ?? 0, level));
    }
    // Gates without any level row get 0 so a uniform value still applies.
    for (const row of asRecords(mysekaiGates)) {
        const id = positive(row.id);
        if (id !== null && !map.has(id)) map.set(id, 0);
    }
    return map;
}

// ==================== Area items ====================

function applyAreaItems(
    userAreas: unknown,
    areaItems: unknown[],
    areaItemLevels: unknown[],
    uniformLevel: number | null | undefined,
    overrides: DeckAreaItemOverride[] | undefined,
): JsonRecord[] {
    const maxLevels = areaItemMaxLevelMap(areaItemLevels);
    const areaByItem = areaItemAreaMap(areaItems);
    const targetLevels = new Map<number, number>();

    if (uniformLevel && uniformLevel > 0) {
        for (const id of [...maxLevels.keys()].sort((a, b) => a - b)) {
            targetLevels.set(id, clamp(uniformLevel, maxLevels.get(id) ?? 0));
        }
    }
    for (const override of overrides ?? []) {
        const id = positive(override.areaItemId);
        const level = positive(override.level);
        if (id === null || level === null || !maxLevels.has(id)) continue;
        targetLevels.set(id, clamp(level, maxLevels.get(id) ?? 0));
    }
    if (targetLevels.size === 0) {
        return asRecords(userAreas);
    }

    const emitted = new Set<number>();
    const prepared: JsonRecord[] = [];
    for (const area of asRecords(userAreas)) {
        const areaItemsInArea: JsonRecord[] = [];
        for (const item of asRecords(area.areaItems)) {
            const itemId = positive(item.areaItemId);
            if (itemId === null || emitted.has(itemId)) continue;
            emitted.add(itemId);
            areaItemsInArea.push(
                targetLevels.has(itemId)
                    ? { ...item, level: targetLevels.get(itemId) }
                    : item,
            );
        }
        prepared.push({ ...area, areaItems: areaItemsInArea });
    }

    // Items covered but missing from the user data are appended to their area.
    const areaById = new Map<number, JsonRecord>();
    for (const area of prepared) {
        const areaId = positive(area.areaId);
        if (areaId !== null) areaById.set(areaId, area);
    }
    for (const [itemId, level] of [...targetLevels.entries()].sort(([a], [b]) => a - b)) {
        if (emitted.has(itemId)) continue;
        const areaId = areaByItem.get(itemId);
        if (areaId === undefined) continue;
        const target = { areaItemId: itemId, level };
        const area = areaById.get(areaId);
        if (area) {
            const items = asRecords(area.areaItems);
            items.push(target);
            area.areaItems = items;
        } else {
            const newArea: JsonRecord = { areaId, areaItems: [target] };
            prepared.push(newArea);
            areaById.set(areaId, newArea);
        }
        emitted.add(itemId);
    }

    return prepared;
}

// ==================== Character ranks ====================

function applyCharacterRanks(
    userCharacters: unknown,
    gameCharacters: unknown[],
    characterRanks: unknown[],
    uniformRank: number | null | undefined,
    overrides: DeckCharacterRankOverride[] | undefined,
): JsonRecord[] {
    const maxRanks = characterMaxRankMap(gameCharacters, characterRanks);
    const targetRanks = new Map<number, number>();

    if (uniformRank && uniformRank > 0) {
        for (const characterId of gameCharacterIds(gameCharacters)) {
            targetRanks.set(characterId, clamp(uniformRank, maxRanks.get(characterId) ?? 0));
        }
    }
    for (const override of overrides ?? []) {
        const id = positive(override.characterId);
        const rank = positive(override.rank);
        if (id === null || rank === null) continue;
        targetRanks.set(id, clamp(rank, maxRanks.get(id) ?? 0));
    }
    if (targetRanks.size === 0) {
        return asRecords(userCharacters);
    }

    const emitted = new Set<number>();
    const prepared: JsonRecord[] = [];
    for (const character of asRecords(userCharacters)) {
        const characterId = positive(character.characterId);
        if (characterId === null || emitted.has(characterId)) continue;
        emitted.add(characterId);
        prepared.push(
            targetRanks.has(characterId)
                ? { ...character, characterRank: targetRanks.get(characterId) }
                : character,
        );
    }
    for (const [characterId, rank] of [...targetRanks.entries()].sort(([a], [b]) => a - b)) {
        if (emitted.has(characterId)) continue;
        prepared.push({ characterId, characterRank: rank });
    }
    return prepared;
}

// ==================== MySekai gates ====================

function applyMysekaiGates(
    userGates: unknown,
    mysekaiGates: unknown[],
    mysekaiGateLevels: unknown[],
    uniformLevel: number | null | undefined,
    overrides: DeckMysekaiGateOverride[] | undefined,
): JsonRecord[] {
    const maxLevels = mysekaiGateMaxLevelMap(mysekaiGates, mysekaiGateLevels);
    const targetLevels = new Map<number, number>();

    if (uniformLevel && uniformLevel > 0) {
        for (const gateId of [...maxLevels.keys()].sort((a, b) => a - b)) {
            targetLevels.set(gateId, clamp(uniformLevel, maxLevels.get(gateId) ?? 0));
        }
    }
    for (const override of overrides ?? []) {
        const gateId = positive(override.mysekaiGateId);
        const level = positive(override.level);
        if (gateId === null || level === null) continue;
        targetLevels.set(gateId, clamp(level, maxLevels.get(gateId) ?? 0));
    }
    if (targetLevels.size === 0) {
        return asRecords(userGates);
    }

    const emitted = new Set<number>();
    const prepared: JsonRecord[] = [];
    for (const gate of asRecords(userGates)) {
        const gateId = positive(gate.mysekaiGateId);
        if (gateId === null || emitted.has(gateId)) continue;
        emitted.add(gateId);
        prepared.push(
            targetLevels.has(gateId)
                ? { ...gate, mysekaiGateLevel: targetLevels.get(gateId) }
                : gate,
        );
    }
    for (const [gateId, level] of [...targetLevels.entries()].sort(([a], [b]) => a - b)) {
        if (emitted.has(gateId)) continue;
        prepared.push({ mysekaiGateId: gateId, mysekaiGateLevel: level });
    }
    return prepared;
}

// ==================== Fixture bonuses ====================

function applyFixtures(
    userBonuses: unknown,
    gameCharacters: unknown[],
    uniformRate: number | null | undefined,
    overrides: DeckMysekaiFixtureOverride[] | undefined,
): JsonRecord[] {
    const characterIds = gameCharacterIds(gameCharacters);
    const targetRates = new Map<number, number>();

    const normalizedUniform = nonNegative(uniformRate);
    if (normalizedUniform !== null) {
        for (const characterId of characterIds) {
            targetRates.set(characterId, normalizedUniform);
        }
    }
    for (const override of overrides ?? []) {
        const characterId = positive(override.characterId);
        const rate = nonNegative(override.totalBonusRate);
        if (characterId === null || rate === null) continue;
        targetRates.set(characterId, rate);
    }
    if (targetRates.size === 0) {
        return asRecords(userBonuses);
    }

    const emitted = new Set<number>();
    const prepared: JsonRecord[] = [];
    for (const bonus of asRecords(userBonuses)) {
        const characterId = positive(bonus.gameCharacterId);
        if (characterId === null || emitted.has(characterId)) continue;
        emitted.add(characterId);
        prepared.push(
            targetRates.has(characterId)
                ? { ...bonus, totalBonusRate: targetRates.get(characterId) }
                : bonus,
        );
    }
    for (const [characterId, rate] of [...targetRates.entries()].sort(([a], [b]) => a - b)) {
        if (emitted.has(characterId)) continue;
        prepared.push({ gameCharacterId: characterId, totalBonusRate: rate });
    }
    return prepared;
}

/**
 * Apply overrides and return a new snapshot (the input is untouched).
 * With no overrides the result equals the account's real data (deep copy).
 * `characterFilterIds` restricts the card pool to the given characters
 * (Haruki's characterFilters), applied after the overrides.
 */
export function applyUserDataOverrides(
    userData: unknown,
    overrides: DeckUserDataOverrides | undefined,
    master: DeckOverrideMasterData,
    characterFilterIds?: number[] | null,
): JsonRecord {
    const data = cloneJson(isRecord(userData) ? userData : {});
    if (characterFilterIds && characterFilterIds.length > 0 && master.cards) {
        const allowedCharacters = new Set(characterFilterIds);
        const cardCharacterMap = new Map<number, number>();
        for (const row of asRecords(master.cards)) {
            const cardId = Number(row.id);
            const characterId = Number(row.characterId);
            if (Number.isInteger(cardId) && cardId > 0 && Number.isInteger(characterId) && characterId > 0) {
                cardCharacterMap.set(cardId, characterId);
            }
        }
        data.userCards = asRecords(data.userCards).filter((card) => {
            const cardId = Number(card.cardId);
            return allowedCharacters.has(cardCharacterMap.get(cardId) ?? 0);
        });
    }
    if (!overrides) return data;

    const {
        areaItemLevel,
        areaItemLevelOverrides,
        characterRank,
        characterRankOverrides,
        mysekaiGateLevel,
        mysekaiGateLevelOverrides,
        mysekaiFixtureBonusRate,
        mysekaiFixtureBonusRateOverrides,
    } = overrides;

    if (areaItemLevel || areaItemLevelOverrides?.length) {
        data.userAreas = applyAreaItems(
            data.userAreas,
            master.areaItems ?? [],
            master.areaItemLevels ?? [],
            areaItemLevel,
            areaItemLevelOverrides,
        );
    }
    if (characterRank || characterRankOverrides?.length) {
        data.userCharacters = applyCharacterRanks(
            data.userCharacters,
            master.gameCharacters ?? [],
            master.characterRanks ?? [],
            characterRank,
            characterRankOverrides,
        );
    }
    if (mysekaiGateLevel || mysekaiGateLevelOverrides?.length) {
        data.userMysekaiGates = applyMysekaiGates(
            data.userMysekaiGates,
            master.mysekaiGates ?? [],
            master.mysekaiGateLevels ?? [],
            mysekaiGateLevel,
            mysekaiGateLevelOverrides,
        );
    }
    if (
        (mysekaiFixtureBonusRate !== null && mysekaiFixtureBonusRate !== undefined)
        || mysekaiFixtureBonusRateOverrides?.length
    ) {
        data.userMysekaiFixtureGameCharacterPerformanceBonuses = applyFixtures(
            data.userMysekaiFixtureGameCharacterPerformanceBonuses,
            master.gameCharacters ?? [],
            mysekaiFixtureBonusRate,
            mysekaiFixtureBonusRateOverrides,
        );
    }

    return data;
}
