import type { AssetSourceType } from "@/contexts/ThemeContext";
import {
    getCardThumbnailUrl,
    getCharacterIconUrl,
    getCommonMaterialThumbnailUrl,
    getCostumeThumbnailUrl,
    getMaterialThumbnailUrl,
    getMysekaiFixtureThumbnailUrl,
    getMysekaiMaterialThumbnailUrl,
    getPracticeTicketThumbnailUrl,
    getSkillPracticeTicketThumbnailUrl,
    getStampUrl,
} from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import type { IMaterialInfo } from "@/types/material";
import type {
    ExchangeResourceBox,
    ExchangeResourceDetail,
    ExchangeStatus,
    FlattenedMaterialExchange,
    MaterialExchange,
    MaterialExchangeCost,
    MaterialExchangeCostResourceType,
    MaterialExchangeSummary,
    ResolvedExchangeCost,
    ResolvedExchangeCostGroup,
    ResolvedExchangeDisplayResource,
    ResolvedExchangeRelationParent,
    ResolvedExchangeReward,
    RewardTypeSummary,
} from "@/types/exchange";
import type {
    IMysekaiBlueprint,
    IMysekaiFixtureInfo,
    IMysekaiMaterial,
} from "@/types/mysekai";
import type { ICostumeInfo, IMoeCostumeData } from "@/types/costume";
import type { ICardInfo } from "@/types/types";
import { CHARACTER_NAMES } from "@/types/types";

interface StampMasterRow {
    id: number;
    name: string;
    assetbundleName: string;
}

interface GenericNamedMasterRow {
    id: number;
    name?: string;
    title?: string;
    description?: string;
    assetbundleName?: string;
    iconAssetbundleName?: string;
    [key: string]: unknown;
}

export interface ExchangeCoreData {
    summaries: MaterialExchangeSummary[];
    materialMap: Map<number, IMaterialInfo>;
    mysekaiMaterialMap: Map<number, IMysekaiMaterial>;
    boxMap: Map<number, ExchangeResourceBox>;
    flattenedExchanges: FlattenedMaterialExchange[];
}

export interface ExchangeRewardLookups {
    cards: Map<number, ICardInfo>;
    stamps: Map<number, StampMasterRow>;
    costumes: Map<number, ICostumeInfo>;
    blueprints: Map<number, IMysekaiBlueprint>;
    fixtures: Map<number, IMysekaiFixtureInfo>;
    practiceTickets: Map<number, GenericNamedMasterRow>;
    skillPracticeTickets: Map<number, GenericNamedMasterRow>;
    boostItems: Map<number, GenericNamedMasterRow>;
    gachaTickets: Map<number, GenericNamedMasterRow>;
    avatarCoordinates: Map<number, GenericNamedMasterRow>;
    mysekaiItems: Map<number, GenericNamedMasterRow>;
    mysekaiTools: Map<number, GenericNamedMasterRow>;
}

const MATERIAL_EXCHANGE_PURPOSE = "material_exchange";

type ExchangeTranslationValue = string | number | boolean | null | undefined;
export type ExchangeTranslationFn = (key: string, values?: Record<string, ExchangeTranslationValue>) => string;

export const EXCHANGE_CATEGORY_LABEL_KEYS: Record<string, string> = {
    master_piece: "common.exchange.categories.master_piece",
    card_ticket: "common.exchange.categories.card_ticket",
    vocal_card_ticket: "common.exchange.categories.vocal_card_ticket",
    gacha_seal: "common.exchange.categories.gacha_seal",
    master_crystal: "common.exchange.categories.master_crystal",
    common_ticket: "common.exchange.categories.common_ticket",
    consume_material: "common.exchange.categories.consume_material",
    home_exchange: "common.exchange.categories.home_exchange",
    mysekai_material_game_character: "common.exchange.categories.mysekai_material_game_character",
};

export const EXCHANGE_TYPE_LABEL_KEYS: Record<string, string> = {
    normal: "common.exchange.types.normal",
    beginner: "common.exchange.types.beginner",
};

export const REFRESH_CYCLE_LABEL_KEYS: Record<string, string> = {
    none: "common.exchange.refreshCycles.none",
    monthly: "common.exchange.refreshCycles.monthly",
};

export const STATUS_LABEL_KEYS: Record<ExchangeStatus, string> = {
    active: "common.exchange.statuses.active",
    upcoming: "common.exchange.statuses.upcoming",
    ended: "common.exchange.statuses.ended",
    permanent: "common.exchange.statuses.permanent",
};

export const REWARD_TYPE_LABEL_KEYS: Record<string, string> = {
    card: "common.exchange.rewardTypes.card",
    material: "common.exchange.rewardTypes.material",
    mysekai_material: "common.exchange.rewardTypes.mysekai_material",
    stamp: "common.exchange.rewardTypes.stamp",
    costume_3d: "common.exchange.rewardTypes.costume_3d",
    mysekai_blueprint: "common.exchange.rewardTypes.mysekai_blueprint",
    mysekai_fixture: "common.exchange.rewardTypes.mysekai_fixture",
    practice_ticket: "common.exchange.rewardTypes.practice_ticket",
    skill_practice_ticket: "common.exchange.rewardTypes.skill_practice_ticket",
    boost_item: "common.exchange.rewardTypes.boost_item",
    gacha_ticket: "common.exchange.rewardTypes.gacha_ticket",
    avatar_coordinate: "common.exchange.rewardTypes.avatar_coordinate",
    mysekai_item: "common.exchange.rewardTypes.mysekai_item",
    mysekai_tool: "common.exchange.rewardTypes.mysekai_tool",
    character_rank_exp: "common.exchange.rewardTypes.character_rank_exp",
    coin: "common.exchange.rewardTypes.coin",
    jewel: "common.exchange.rewardTypes.jewel",
    virtual_coin: "common.exchange.rewardTypes.virtual_coin",
};

function uniq<T>(values: T[]): T[] {
    return Array.from(new Set(values));
}

function parseNumberList(value: string | null): number[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));
}

function parseStringList(value: string | null): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function parseExchangeFilterParams(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike) {
    return {
        searchQuery: searchParams.get("search") || "",
        selectedSummaryIds: parseNumberList(searchParams.get("summaries")),
        selectedCategories: parseStringList(searchParams.get("categories")),
        selectedExchangeTypes: parseStringList(searchParams.get("exchangeTypes")),
        selectedStatuses: parseStringList(searchParams.get("statuses")) as ExchangeStatus[],
        selectedRefreshCycles: parseStringList(searchParams.get("refreshCycles")),
        selectedRewardTypes: parseStringList(searchParams.get("rewardTypes")),
        selectedCostTypes: parseStringList(searchParams.get("costTypes")) as MaterialExchangeCostResourceType[],
        sortBy: (searchParams.get("sortBy") || "status_priority") as ExchangeSortBy,
        sortOrder: (searchParams.get("sortOrder") || "asc") as ExchangeSortOrder,
    };
}

export type ExchangeSortBy = "status_priority" | "seq" | "id" | "startAt" | "endAt";
export type ExchangeSortOrder = "asc" | "desc";

export interface ExchangeListFilters {
    searchQuery: string;
    selectedSummaryIds: number[];
    selectedCategories: string[];
    selectedExchangeTypes: string[];
    selectedStatuses: ExchangeStatus[];
    selectedRefreshCycles: string[];
    selectedRewardTypes: string[];
    selectedCostTypes: MaterialExchangeCostResourceType[];
    sortBy: ExchangeSortBy;
    sortOrder: ExchangeSortOrder;
}

export const DEFAULT_EXCHANGE_FILTERS: ExchangeListFilters = {
    searchQuery: "",
    selectedSummaryIds: [],
    selectedCategories: [],
    selectedExchangeTypes: [],
    selectedStatuses: [],
    selectedRefreshCycles: [],
    selectedRewardTypes: [],
    selectedCostTypes: [],
    sortBy: "status_priority",
    sortOrder: "asc",
};

interface ReadonlyURLSearchParamsLike {
    get(name: string): string | null;
}

export function areNumberArraysEqual(a: number[], b: number[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function areStringArraysEqual(a: string[], b: string[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function areExchangeFiltersEqual(a: ExchangeListFilters, b: ExchangeListFilters) {
    return (
        a.searchQuery === b.searchQuery &&
        areNumberArraysEqual(a.selectedSummaryIds, b.selectedSummaryIds) &&
        areStringArraysEqual(a.selectedCategories, b.selectedCategories) &&
        areStringArraysEqual(a.selectedExchangeTypes, b.selectedExchangeTypes) &&
        areStringArraysEqual(a.selectedStatuses, b.selectedStatuses) &&
        areStringArraysEqual(a.selectedRefreshCycles, b.selectedRefreshCycles) &&
        areStringArraysEqual(a.selectedRewardTypes, b.selectedRewardTypes) &&
        areStringArraysEqual(a.selectedCostTypes, b.selectedCostTypes) &&
        a.sortBy === b.sortBy &&
        a.sortOrder === b.sortOrder
    );
}

export function buildExchangeFilterQuery(filters: ExchangeListFilters): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.searchQuery.trim()) params.set("search", filters.searchQuery.trim());
    if (filters.selectedSummaryIds.length > 0) params.set("summaries", filters.selectedSummaryIds.join(","));
    if (filters.selectedCategories.length > 0) params.set("categories", filters.selectedCategories.join(","));
    if (filters.selectedExchangeTypes.length > 0) params.set("exchangeTypes", filters.selectedExchangeTypes.join(","));
    if (filters.selectedStatuses.length > 0) params.set("statuses", filters.selectedStatuses.join(","));
    if (filters.selectedRefreshCycles.length > 0) params.set("refreshCycles", filters.selectedRefreshCycles.join(","));
    if (filters.selectedRewardTypes.length > 0) params.set("rewardTypes", filters.selectedRewardTypes.join(","));
    if (filters.selectedCostTypes.length > 0) params.set("costTypes", filters.selectedCostTypes.join(","));
    if (filters.sortBy !== DEFAULT_EXCHANGE_FILTERS.sortBy) params.set("sortBy", filters.sortBy);
    if (filters.sortOrder !== DEFAULT_EXCHANGE_FILTERS.sortOrder) params.set("sortOrder", filters.sortOrder);

    return params;
}

function formatFallbackLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function translateLabel(key: string | undefined, fallback: string, t?: ExchangeTranslationFn): string {
    if (!key || !t) return fallback;
    const label = t(key);
    return label === key ? fallback : label;
}

export function getExchangeCategoryLabel(category: string, t?: ExchangeTranslationFn): string {
    return translateLabel(EXCHANGE_CATEGORY_LABEL_KEYS[category], formatFallbackLabel(category), t);
}

export function getExchangeTypeLabel(type: string, t?: ExchangeTranslationFn): string {
    return translateLabel(EXCHANGE_TYPE_LABEL_KEYS[type], formatFallbackLabel(type), t);
}

export function getRefreshCycleLabel(refreshCycle: string, t?: ExchangeTranslationFn): string {
    return translateLabel(REFRESH_CYCLE_LABEL_KEYS[refreshCycle], formatFallbackLabel(refreshCycle), t);
}

export function getExchangeStatusLabel(status: ExchangeStatus, t?: ExchangeTranslationFn): string {
    return translateLabel(STATUS_LABEL_KEYS[status], formatFallbackLabel(status), t);
}

export function getRewardTypeLabel(resourceType: string, t?: ExchangeTranslationFn): string {
    return translateLabel(REWARD_TYPE_LABEL_KEYS[resourceType], formatFallbackLabel(resourceType), t);
}

export function formatExchangeTime(
    timestamp?: number,
    formatDate?: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string
): string {
    if (!timestamp) return "-";
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    };
    return formatDate ? formatDate(timestamp, options) : new Date(timestamp).toLocaleString(undefined, options);
}

export function getEffectiveExchangeStartAt(exchange: MaterialExchange, summary: MaterialExchangeSummary): number | undefined {
    return exchange.startAt ?? summary.startAt;
}

export function getEffectiveExchangeEndAt(summary: MaterialExchangeSummary): number | undefined {
    return summary.endAt;
}

export function getExchangeStatus(exchange: MaterialExchange, summary: MaterialExchangeSummary, now = Date.now()): ExchangeStatus {
    const startAt = getEffectiveExchangeStartAt(exchange, summary);
    const endAt = getEffectiveExchangeEndAt(summary);

    if (typeof endAt === "number" && now > endAt) return "ended";
    if (typeof startAt === "number" && now < startAt) return "upcoming";
    if (typeof startAt === "number" || typeof endAt === "number") return "active";
    return "permanent";
}

function unknownId(value: number | undefined | null): string | number {
    return value ?? "?";
}

function formatResourceFallback(key: string, id: number | undefined | null, t?: ExchangeTranslationFn): string {
    const fallbackId = unknownId(id);
    if (t) {
        const labelKey = `common.exchange.resourceFallbacks.${key}`;
        const label = t(labelKey, { id: fallbackId });
        if (label !== labelKey) return label;
    }
    return `${formatFallbackLabel(key)} #${fallbackId}`;
}

export function resolveExchangeDisplayName(exchange: MaterialExchange, summary: MaterialExchangeSummary, t?: ExchangeTranslationFn): string {
    return exchange.displayName?.trim() || summary.name?.trim() || formatResourceFallback("exchangeItem", exchange.id, t);
}

export function buildMaterialExchangeResourceBoxMap(resourceBoxes: ExchangeResourceBox[]): Map<number, ExchangeResourceBox> {
    const map = new Map<number, ExchangeResourceBox>();

    resourceBoxes
        .filter((box) => box.resourceBoxPurpose === MATERIAL_EXCHANGE_PURPOSE)
        .forEach((box) => {
            const normalizedDetails = [...(box.details || [])].sort((a, b) => a.seq - b.seq);
            const prev = map.get(box.id);

            if (!prev) {
                map.set(box.id, {
                    ...box,
                    details: normalizedDetails,
                });
                return;
            }

            map.set(box.id, {
                ...prev,
                ...box,
                details: [...prev.details, ...normalizedDetails].sort((a, b) => a.seq - b.seq),
            });
        });

    return map;
}

function buildRewardTypeSummary(details: ExchangeResourceDetail[]): RewardTypeSummary[] {
    const summaryMap = new Map<string, RewardTypeSummary>();

    for (const detail of details) {
        const resourceType = detail.resourceType;
        if (!resourceType) continue;

        const prev = summaryMap.get(resourceType);
        const quantity = detail.resourceQuantity ?? 1;
        if (!prev) {
            summaryMap.set(resourceType, {
                resourceType,
                label: getRewardTypeLabel(resourceType),
                count: 1,
                totalQuantity: quantity,
            });
            continue;
        }

        prev.count += 1;
        prev.totalQuantity += quantity;
    }

    return [...summaryMap.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

export function summarizeExchangeRewards(details: ExchangeResourceDetail[]): RewardTypeSummary[] {
    return buildRewardTypeSummary(details);
}

export function buildExchangeSearchText(entry: Omit<FlattenedMaterialExchange, "searchText">): string {
    const textParts = [
        String(entry.id),
        entry.resolvedTitle,
        entry.summaryName,
        getExchangeCategoryLabel(entry.exchangeCategory),
        getExchangeTypeLabel(entry.materialExchangeType),
        getRefreshCycleLabel(entry.refreshCycle),
        ...entry.rewardTypes.map((type) => getRewardTypeLabel(type)),
        ...entry.costTypes,
    ];

    return textParts
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

export function flattenExchangeSummaries(
    summaries: MaterialExchangeSummary[],
    boxMap: Map<number, ExchangeResourceBox>
): FlattenedMaterialExchange[] {
    const entries = summaries.flatMap((summary) =>
        summary.materialExchanges.map((exchange) => {
            const rewardDetails = [...(boxMap.get(exchange.resourceBoxId)?.details || [])].sort((a, b) => a.seq - b.seq);
            const rewardTypes = uniq(
                rewardDetails
                    .map((detail) => detail.resourceType)
                    .filter((resourceType): resourceType is string => Boolean(resourceType))
            ).sort((a, b) => getRewardTypeLabel(a).localeCompare(getRewardTypeLabel(b), "zh-Hans-CN"));
            const costTypes = uniq(exchange.costs.map((cost) => cost.resourceType)).sort((a, b) => a.localeCompare(b));
            const resolvedTitle = resolveExchangeDisplayName(exchange, summary);

            const baseEntry: Omit<FlattenedMaterialExchange, "searchText"> = {
                id: exchange.id,
                summaryId: summary.id,
                summarySeq: summary.seq,
                summaryName: summary.name,
                summaryAssetbundleName: summary.assetbundleName,
                summaryStartAt: summary.startAt,
                summaryEndAt: summary.endAt,
                summaryDisplayResourceGroupId: summary.materialExchangeDisplayResourceGroupId,
                exchangeCategory: summary.exchangeCategory,
                materialExchangeType: summary.materialExchangeType,
                exchangeSeq: exchange.seq,
                displayName: exchange.displayName,
                thumbnailAssetbundleName: exchange.thumbnailAssetbundleName,
                resourceBoxId: exchange.resourceBoxId,
                refreshCycle: exchange.refreshCycle,
                exchangeLimit: exchange.exchangeLimit,
                exchangeStartAt: exchange.startAt,
                isDisplayQuantity: exchange.isDisplayQuantity,
                costs: exchange.costs,
                materialExchangeRelationParents: exchange.materialExchangeRelationParents,
                materialExchangeDisplayResourceGroups: summary.materialExchangeDisplayResourceGroups || [],
                rewardDetails,
                rewardTypes,
                costTypes,
                status: getExchangeStatus(exchange, summary),
                resolvedTitle,
            };

            return {
                ...baseEntry,
                searchText: buildExchangeSearchText(baseEntry),
            };
        })
    );

    return entries.sort((a, b) => {
        if (a.summarySeq !== b.summarySeq) return a.summarySeq - b.summarySeq;
        if (a.exchangeSeq !== b.exchangeSeq) return a.exchangeSeq - b.exchangeSeq;
        return a.id - b.id;
    });
}

export async function loadExchangeCoreData(): Promise<ExchangeCoreData> {
    const [summaries, materials, mysekaiMaterials, resourceBoxes] = await Promise.all([
        fetchMasterData<MaterialExchangeSummary[]>("materialExchangeSummaries.json"),
        fetchMasterData<IMaterialInfo[]>("materials.json"),
        fetchMasterData<IMysekaiMaterial[]>("mysekaiMaterials.json"),
        fetchMasterData<ExchangeResourceBox[]>("resourceBoxes.json"),
    ]);

    const materialMap = new Map(materials.map((item) => [item.id, item]));
    const mysekaiMaterialMap = new Map(mysekaiMaterials.map((item) => [item.id, item]));
    const boxMap = buildMaterialExchangeResourceBoxMap(resourceBoxes);

    return {
        summaries,
        materialMap,
        mysekaiMaterialMap,
        boxMap,
        flattenedExchanges: flattenExchangeSummaries(summaries, boxMap),
    };
}

function resolveCostSubtitle(resourceType: MaterialExchangeCostResourceType, item?: IMaterialInfo | IMysekaiMaterial): string | undefined {
    if (!item) return undefined;

    if (resourceType === "material") {
        return (item as IMaterialInfo).materialType;
    }

    return (item as IMysekaiMaterial).mysekaiMaterialRarityType;
}

function resolveCostName(
    resourceType: MaterialExchangeCostResourceType,
    resourceId: number,
    item?: IMaterialInfo | IMysekaiMaterial,
    t?: ExchangeTranslationFn
) {
    if (item?.name) return item.name;
    return resourceType === "material"
        ? formatResourceFallback("material", resourceId, t)
        : formatResourceFallback("mysekaiMaterial", resourceId, t);
}

function resolveCostImageUrl(
    resourceType: MaterialExchangeCostResourceType,
    resourceId: number,
    item: IMaterialInfo | IMysekaiMaterial | undefined,
    assetSource: AssetSourceType
) {
    if (resourceType === "material") {
        return getMaterialThumbnailUrl(resourceId, assetSource);
    }

    const mysekaiMaterial = item as IMysekaiMaterial | undefined;
    return mysekaiMaterial?.iconAssetbundleName
        ? getMysekaiMaterialThumbnailUrl(mysekaiMaterial.iconAssetbundleName, assetSource)
        : undefined;
}

export function resolveExchangeCostGroups(
    exchange: FlattenedMaterialExchange,
    materialMap: Map<number, IMaterialInfo>,
    mysekaiMaterialMap: Map<number, IMysekaiMaterial>,
    assetSource: AssetSourceType,
    t?: ExchangeTranslationFn
): {
    baseCostGroups: ResolvedExchangeCostGroup[];
    relationParents: ResolvedExchangeRelationParent[];
    allResolvedCosts: ResolvedExchangeCost[];
} {
    const costGroups = new Map<number, ResolvedExchangeCostGroup>();

    const resolveSingleCost = (cost: MaterialExchangeCost): ResolvedExchangeCost => {
        const resolvedItem = cost.resourceType === "material"
            ? materialMap.get(cost.resourceId)
            : mysekaiMaterialMap.get(cost.resourceId);

        return {
            resourceType: cost.resourceType,
            resourceId: cost.resourceId,
            quantity: cost.quantity,
            name: resolveCostName(cost.resourceType, cost.resourceId, resolvedItem, t),
            subtitle: resolveCostSubtitle(cost.resourceType, resolvedItem),
            imageUrl: resolveCostImageUrl(cost.resourceType, cost.resourceId, resolvedItem, assetSource),
        };
    };

    const sortedCosts = [...exchange.costs].sort((a, b) => {
        if (a.costGroupId !== b.costGroupId) return a.costGroupId - b.costGroupId;
        return a.seq - b.seq;
    });

    for (const cost of sortedCosts) {
        const prev = costGroups.get(cost.costGroupId);
        const resolvedCost = resolveSingleCost(cost);

        if (!prev) {
            costGroups.set(cost.costGroupId, {
                costGroupId: cost.costGroupId,
                costs: [resolvedCost],
            });
            continue;
        }

        prev.costs.push(resolvedCost);
    }

    const relationChildGroupIds = new Set<number>();
    exchange.materialExchangeRelationParents.forEach((parent) => {
        parent.materialExchangeRelationChildren.forEach((child) => {
            if (child.materialExchangeId === exchange.id) {
                relationChildGroupIds.add(child.materialExchangeCostGroupId);
            }
        });
    });

    const baseCostGroups = [...costGroups.values()].filter((group) => !relationChildGroupIds.has(group.costGroupId));

    const relationParents: ResolvedExchangeRelationParent[] = exchange.materialExchangeRelationParents.map((parent) => {
        const relatedGroupIds = uniq(
            parent.materialExchangeRelationChildren
                .filter((child) => child.materialExchangeId === exchange.id)
                .map((child) => child.materialExchangeCostGroupId)
        );

        return {
            id: parent.id,
            description: parent.description,
            assetbundleName: parent.assetbundleName,
            costGroups: relatedGroupIds
                .map((groupId) => costGroups.get(groupId))
                .filter((group): group is ResolvedExchangeCostGroup => Boolean(group)),
        };
    });

    return {
        baseCostGroups,
        relationParents,
        allResolvedCosts: [...costGroups.values()].flatMap((group) => group.costs),
    };
}

function getRepresentativeCostumeAssetbundleName(costume?: ICostumeInfo): string | undefined {
    if (!costume) return undefined;

    const preferredPartTypes = ["body", "hair", "head"];
    for (const partType of preferredPartTypes) {
        const part = costume.parts[partType]?.[0];
        if (part?.assetbundleName) return part.assetbundleName;
    }

    for (const partList of Object.values(costume.parts)) {
        const first = partList?.[0];
        if (first?.assetbundleName) return first.assetbundleName;
    }

    for (const extraPart of costume.extraParts || []) {
        const variant = extraPart.variants?.[0];
        if (variant?.assetbundleName) return variant.assetbundleName;
    }

    return undefined;
}

function buildMapById<T extends { id: number }>(rows: T[]): Map<number, T> {
    return new Map(rows.map((row) => [row.id, row]));
}

function buildGenericMap(rows: GenericNamedMasterRow[]): Map<number, GenericNamedMasterRow> {
    return new Map(rows.map((row) => [row.id, row]));
}

async function fetchOptionalRows<T>(path: string): Promise<T[]> {
    try {
        return await fetchMasterData<T[]>(path);
    } catch {
        return [];
    }
}

export async function loadRewardLookupsByTypes(rewardTypes: string[]): Promise<ExchangeRewardLookups> {
    const types = new Set(rewardTypes);

    const [cards, stamps, costumeData, blueprints, fixtures, practiceTickets, skillPracticeTickets, boostItems, gachaTickets, avatarCoordinates, mysekaiItems, mysekaiTools] = await Promise.all([
        types.has("card") ? fetchOptionalRows<ICardInfo>("cards.json") : Promise.resolve([]),
        types.has("stamp") ? fetchOptionalRows<StampMasterRow>("stamps.json") : Promise.resolve([]),
        types.has("costume_3d") ? fetchMasterData<IMoeCostumeData>("moe_costume.json").catch(() => ({ costumes: [] } as unknown as IMoeCostumeData)) : Promise.resolve({ costumes: [] } as unknown as IMoeCostumeData),
        types.has("mysekai_blueprint") ? fetchOptionalRows<IMysekaiBlueprint>("mysekaiBlueprints.json") : Promise.resolve([]),
        types.has("mysekai_blueprint") || types.has("mysekai_fixture") ? fetchOptionalRows<IMysekaiFixtureInfo>("mysekaiFixtures.json") : Promise.resolve([]),
        types.has("practice_ticket") ? fetchOptionalRows<GenericNamedMasterRow>("practiceTickets.json") : Promise.resolve([]),
        types.has("skill_practice_ticket") ? fetchOptionalRows<GenericNamedMasterRow>("skillPracticeTickets.json") : Promise.resolve([]),
        types.has("boost_item") ? fetchOptionalRows<GenericNamedMasterRow>("boostItems.json") : Promise.resolve([]),
        types.has("gacha_ticket") ? fetchOptionalRows<GenericNamedMasterRow>("gachaTickets.json") : Promise.resolve([]),
        types.has("avatar_coordinate") ? fetchOptionalRows<GenericNamedMasterRow>("avatarCoordinates.json") : Promise.resolve([]),
        types.has("mysekai_item") ? fetchOptionalRows<GenericNamedMasterRow>("mysekaiItems.json") : Promise.resolve([]),
        types.has("mysekai_tool") ? fetchOptionalRows<GenericNamedMasterRow>("mysekaiTools.json") : Promise.resolve([]),
    ]);

    return {
        cards: buildMapById(cards),
        stamps: buildMapById(stamps),
        costumes: new Map((costumeData.costumes || []).map((costume) => [costume.costumeNumber, costume])),
        blueprints: buildMapById(blueprints),
        fixtures: buildMapById(fixtures),
        practiceTickets: buildGenericMap(practiceTickets),
        skillPracticeTickets: buildGenericMap(skillPracticeTickets),
        boostItems: buildGenericMap(boostItems),
        gachaTickets: buildGenericMap(gachaTickets),
        avatarCoordinates: buildGenericMap(avatarCoordinates),
        mysekaiItems: buildGenericMap(mysekaiItems),
        mysekaiTools: buildGenericMap(mysekaiTools),
    };
}

function extractGenericName(item: GenericNamedMasterRow | undefined, fallback: string): string {
    const name = item?.name || item?.title || item?.description;
    return typeof name === "string" && name.trim() ? name : fallback;
}

function resolveStaticCurrency(
    resourceType: string,
    quantity: number,
    assetSource: AssetSourceType,
    t?: ExchangeTranslationFn
): ResolvedExchangeReward {
    return {
        seq: 0,
        resourceType,
        quantity,
        name: getRewardTypeLabel(resourceType, t),
        imageUrl:
            resourceType === "coin" ? getCommonMaterialThumbnailUrl("coin", assetSource) :
                resourceType === "jewel" ? getCommonMaterialThumbnailUrl("jewel", assetSource) :
                    resourceType === "virtual_coin" ? getCommonMaterialThumbnailUrl("virtual_coin", assetSource) :
                        undefined,
    };
}

export function resolveExchangeRewards(
    exchange: FlattenedMaterialExchange,
    materialMap: Map<number, IMaterialInfo>,
    mysekaiMaterialMap: Map<number, IMysekaiMaterial>,
    rewardLookups: ExchangeRewardLookups,
    assetSource: AssetSourceType,
    t?: ExchangeTranslationFn
): ResolvedExchangeReward[] {
    return exchange.rewardDetails.map((detail) => {
        const resourceId = detail.resourceId;
        const quantity = detail.resourceQuantity ?? 1;

        switch (detail.resourceType) {
            case "card": {
                const card = typeof resourceId === "number" ? rewardLookups.cards.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: card?.prefix || formatResourceFallback("card", resourceId, t),
                    subtitle: card ? CHARACTER_NAMES[card.characterId] : undefined,
                    imageUrl: card ? getCardThumbnailUrl(card.characterId, card.assetbundleName, false, assetSource) : undefined,
                    linkHref: card ? `/cards/${card.id}` : undefined,
                };
            }
            case "material": {
                const material = typeof resourceId === "number" ? materialMap.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: material?.name || formatResourceFallback("material", resourceId, t),
                    subtitle: material?.materialType,
                    imageUrl: typeof resourceId === "number" ? getMaterialThumbnailUrl(resourceId, assetSource) : undefined,
                };
            }
            case "mysekai_material": {
                const material = typeof resourceId === "number" ? mysekaiMaterialMap.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: material?.name || formatResourceFallback("mysekaiMaterial", resourceId, t),
                    subtitle: material?.mysekaiMaterialRarityType,
                    imageUrl: material?.iconAssetbundleName ? getMysekaiMaterialThumbnailUrl(material.iconAssetbundleName, assetSource) : undefined,
                };
            }
            case "stamp": {
                const stamp = typeof resourceId === "number" ? rewardLookups.stamps.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: stamp?.name || formatResourceFallback("stamp", resourceId, t),
                    imageUrl: stamp?.assetbundleName ? getStampUrl(stamp.assetbundleName, assetSource) : undefined,
                    linkHref: stamp ? `/sticker?search=${encodeURIComponent(String(stamp.id))}` : undefined,
                };
            }
            case "costume_3d": {
                const costume = typeof resourceId === "number" ? rewardLookups.costumes.get(resourceId) : undefined;
                const assetbundleName = getRepresentativeCostumeAssetbundleName(costume);
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: costume?.name || formatResourceFallback("costume", resourceId, t),
                    subtitle: costume?.source,
                    imageUrl: assetbundleName ? getCostumeThumbnailUrl(assetbundleName, assetSource) : undefined,
                    linkHref: costume ? `/costumes/${costume.costumeNumber}` : undefined,
                };
            }
            case "mysekai_blueprint": {
                const blueprint = typeof resourceId === "number" ? rewardLookups.blueprints.get(resourceId) : undefined;
                const fixture = blueprint?.mysekaiCraftType === "mysekai_fixture"
                    ? rewardLookups.fixtures.get(blueprint.craftTargetId)
                    : undefined;

                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: fixture?.name || formatResourceFallback("mysekaiBlueprint", resourceId, t),
                    subtitle: fixture ? getRewardTypeLabel("mysekai_blueprint", t) : blueprint?.mysekaiCraftType,
                    imageUrl: fixture ? getMysekaiFixtureThumbnailUrl(fixture.assetbundleName, assetSource, fixture.mysekaiFixtureMainGenreId) : undefined,
                    linkHref: fixture ? `/mysekai/${fixture.id}` : undefined,
                };
            }
            case "mysekai_fixture": {
                const fixture = typeof resourceId === "number" ? rewardLookups.fixtures.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: fixture?.name || formatResourceFallback("mysekaiFixture", resourceId, t),
                    subtitle: fixture?.mysekaiFixtureType,
                    imageUrl: fixture ? getMysekaiFixtureThumbnailUrl(fixture.assetbundleName, assetSource, fixture.mysekaiFixtureMainGenreId) : undefined,
                    linkHref: fixture ? `/mysekai/${fixture.id}` : undefined,
                };
            }
            case "practice_ticket": {
                const item = typeof resourceId === "number" ? rewardLookups.practiceTickets.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("practiceTicket", resourceId, t)),
                    subtitle: getRewardTypeLabel("practice_ticket", t),
                    imageUrl: typeof resourceId === "number" ? getPracticeTicketThumbnailUrl(resourceId, assetSource) : undefined,
                };
            }
            case "skill_practice_ticket": {
                const item = typeof resourceId === "number" ? rewardLookups.skillPracticeTickets.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("skillPracticeTicket", resourceId, t)),
                    subtitle: getRewardTypeLabel("skill_practice_ticket", t),
                    imageUrl: typeof resourceId === "number" ? getSkillPracticeTicketThumbnailUrl(resourceId, assetSource) : undefined,
                };
            }
            case "boost_item": {
                const item = typeof resourceId === "number" ? rewardLookups.boostItems.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("boostItem", resourceId, t)),
                    subtitle: getRewardTypeLabel("boost_item", t),
                };
            }
            case "gacha_ticket": {
                const item = typeof resourceId === "number" ? rewardLookups.gachaTickets.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("gachaTicket", resourceId, t)),
                    subtitle: getRewardTypeLabel("gacha_ticket", t),
                };
            }
            case "avatar_coordinate": {
                const item = typeof resourceId === "number" ? rewardLookups.avatarCoordinates.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("avatarCoordinate", resourceId, t)),
                    subtitle: getRewardTypeLabel("avatar_coordinate", t),
                };
            }
            case "mysekai_item": {
                const item = typeof resourceId === "number" ? rewardLookups.mysekaiItems.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("mysekaiItem", resourceId, t)),
                    subtitle: getRewardTypeLabel("mysekai_item", t),
                };
            }
            case "mysekai_tool": {
                const item = typeof resourceId === "number" ? rewardLookups.mysekaiTools.get(resourceId) : undefined;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: extractGenericName(item, formatResourceFallback("mysekaiTool", resourceId, t)),
                    subtitle: getRewardTypeLabel("mysekai_tool", t),
                };
            }
            case "character_rank_exp": {
                const characterId = typeof resourceId === "number" ? resourceId : 0;
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: CHARACTER_NAMES[characterId] || formatResourceFallback("character", resourceId, t),
                    subtitle: getRewardTypeLabel("character_rank_exp", t),
                    imageUrl: characterId ? getCharacterIconUrl(characterId) : undefined,
                };
            }
            case "coin":
            case "jewel":
            case "virtual_coin": {
                return {
                    ...resolveStaticCurrency(detail.resourceType, quantity, assetSource, t),
                    seq: detail.seq,
                    resourceId,
                };
            }
            default:
                return {
                    seq: detail.seq,
                    resourceType: detail.resourceType,
                    resourceId,
                    quantity,
                    name: getRewardTypeLabel(detail.resourceType, t),
                    subtitle: typeof resourceId === "number" ? `ID #${resourceId}` : undefined,
                };
        }
    });
}

export function resolveExchangeDisplayResources(
    exchange: FlattenedMaterialExchange,
    materialMap: Map<number, IMaterialInfo>,
    mysekaiMaterialMap: Map<number, IMysekaiMaterial>,
    assetSource: AssetSourceType,
    t?: ExchangeTranslationFn
): ResolvedExchangeDisplayResource[] {
    return [...exchange.materialExchangeDisplayResourceGroups]
        .sort((a, b) => a.seq - b.seq)
        .map((group) => {
            if (group.resourceType === "material") {
                const material = materialMap.get(group.resourceId);
                return {
                    id: group.id,
                    groupId: group.groupId,
                    seq: group.seq,
                    resourceType: group.resourceType,
                    resourceId: group.resourceId,
                    name: material?.name || formatResourceFallback("material", group.resourceId, t),
                    subtitle: material?.materialType,
                    imageUrl: getMaterialThumbnailUrl(group.resourceId, assetSource),
                };
            }

            if (group.resourceType === "mysekai_material") {
                const material = mysekaiMaterialMap.get(group.resourceId);
                return {
                    id: group.id,
                    groupId: group.groupId,
                    seq: group.seq,
                    resourceType: group.resourceType,
                    resourceId: group.resourceId,
                    name: material?.name || formatResourceFallback("mysekaiMaterial", group.resourceId, t),
                    subtitle: material?.mysekaiMaterialRarityType,
                    imageUrl: material?.iconAssetbundleName ? getMysekaiMaterialThumbnailUrl(material.iconAssetbundleName, assetSource) : undefined,
                };
            }

            return {
                id: group.id,
                groupId: group.groupId,
                seq: group.seq,
                resourceType: group.resourceType,
                resourceId: group.resourceId,
                name: getRewardTypeLabel(group.resourceType, t),
                subtitle: `ID #${group.resourceId}`,
            };
        });
}

export function filterAndSortExchanges(entries: FlattenedMaterialExchange[], filters: ExchangeListFilters): FlattenedMaterialExchange[] {
    let result = [...entries];

    if (filters.selectedSummaryIds.length > 0) {
        result = result.filter((entry) => filters.selectedSummaryIds.includes(entry.summaryId));
    }

    if (filters.selectedCategories.length > 0) {
        result = result.filter((entry) => filters.selectedCategories.includes(entry.exchangeCategory));
    }

    if (filters.selectedExchangeTypes.length > 0) {
        result = result.filter((entry) => filters.selectedExchangeTypes.includes(entry.materialExchangeType));
    }

    if (filters.selectedStatuses.length > 0) {
        result = result.filter((entry) => filters.selectedStatuses.includes(entry.status));
    }

    if (filters.selectedRefreshCycles.length > 0) {
        result = result.filter((entry) => filters.selectedRefreshCycles.includes(entry.refreshCycle));
    }

    if (filters.selectedRewardTypes.length > 0) {
        result = result.filter((entry) => entry.rewardTypes.some((type) => filters.selectedRewardTypes.includes(type)));
    }

    if (filters.selectedCostTypes.length > 0) {
        result = result.filter((entry) => entry.costTypes.some((type) => filters.selectedCostTypes.includes(type)));
    }

    if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.trim().toLowerCase();
        result = result.filter((entry) => entry.searchText.includes(query));
    }

    const STATUS_PRIORITY: Record<ExchangeStatus, number> = {
        active: 0,
        upcoming: 1,
        permanent: 2,
        ended: 3,
    };

    result.sort((a, b) => {
        let compare = 0;

        switch (filters.sortBy) {
            case "status_priority": {
                compare = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
                if (compare === 0) {
                    compare = a.summarySeq - b.summarySeq;
                    if (compare === 0) compare = a.exchangeSeq - b.exchangeSeq;
                }
                break;
            }
            case "id":
                compare = a.id - b.id;
                break;
            case "startAt":
                compare = (a.exchangeStartAt ?? a.summaryStartAt ?? 0) - (b.exchangeStartAt ?? b.summaryStartAt ?? 0);
                break;
            case "endAt":
                compare = (a.summaryEndAt ?? 0) - (b.summaryEndAt ?? 0);
                break;
            case "seq":
            default:
                compare = a.summarySeq - b.summarySeq;
                if (compare === 0) compare = a.exchangeSeq - b.exchangeSeq;
                break;
        }

        if (compare !== 0) {
            return filters.sortOrder === "asc" ? compare : -compare;
        }

        return a.id - b.id;
    });

    return result;
}

export function getExchangeLastModified(entry: FlattenedMaterialExchange): number | undefined {
    return entry.exchangeStartAt ?? entry.summaryStartAt ?? entry.summaryEndAt;
}

export interface MaterialExchangeUsages {
    asCost: FlattenedMaterialExchange[];
    asReward: FlattenedMaterialExchange[];
}

const USAGE_STATUS_PRIORITY: Record<ExchangeStatus, number> = {
    active: 0,
    upcoming: 1,
    permanent: 2,
    ended: 3,
};

function sortByStatusPriority(entries: FlattenedMaterialExchange[]): FlattenedMaterialExchange[] {
    return [...entries].sort((a, b) => {
        const statusDiff = USAGE_STATUS_PRIORITY[a.status] - USAGE_STATUS_PRIORITY[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.summarySeq - b.summarySeq || a.exchangeSeq - b.exchangeSeq || a.id - b.id;
    });
}

export function findMaterialExchangeUsages(
    materialId: number,
    materialType: "material" | "mysekai_material",
    flattenedExchanges: FlattenedMaterialExchange[]
): MaterialExchangeUsages {
    const asCost: FlattenedMaterialExchange[] = [];
    const asReward: FlattenedMaterialExchange[] = [];

    for (const entry of flattenedExchanges) {
        const isCost = entry.costs.some(
            (cost) => cost.resourceType === materialType && cost.resourceId === materialId
        );
        if (isCost) asCost.push(entry);

        const isReward = entry.rewardDetails.some(
            (detail) => detail.resourceType === materialType && detail.resourceId === materialId
        );
        if (isReward) asReward.push(entry);
    }

    return {
        asCost: sortByStatusPriority(asCost),
        asReward: sortByStatusPriority(asReward),
    };
}
