// Costume Types for Moesekai
// Based on moe_costume.json master data structure

/** Color variant for a costume part. */
export interface ICostumePart {
    colorId: number;
    colorName: string;
    assetbundleName: string;
}

/** Character-specific part entry from extraParts. */
export interface ICostumeExtraPart {
    characterId: number;
    partType: string;           // "head" | "hair" | "body"
    variants: ICostumePart[];   // Color variants for this character and part type
}

/** Shop metadata for shop-sourced costumes. */
export interface ICostumeShopInfo {
    shopItemId: number;
    shopGroupId: number;
    costs: Array<{
        resourceType: string;
        resourceId: number;
    }>;
    startAt: number;
}

/** Top-level costume stats. */
export interface ICostumeStats {
    total: number;
    totalDefaults: number;
    by_source: Record<string, number>;
    by_partType: Record<string, number>;
    by_gender: Record<string, number>;
    by_rarity: Record<string, number>;
}

/** Main costume record; one object represents one costume set. */
export interface ICostumeInfo {
    costumeNumber: number;              // Stable ID replacing the old id / costume3dGroupId
    name: string;
    costume3dType: string;              // "normal"
    costume3dRarity: string;            // "rare" | "normal"
    designer: string;
    partTypes: string[];                // "head" | "hair" | "body"
    characterIds: number[];             // Wearable character IDs
    gender: string;                     // "female" | "male"
    parts: Record<string, ICostumePart[]>;  // Shared parts keyed by partType
    extraParts?: ICostumeExtraPart[];   // Character-specific parts
    source: string;                     // "card" | "shop" | "other"
    cardIds?: number[];                 // Related card IDs when source === "card"
    shopInfo?: ICostumeShopInfo;        // Shop data when source === "shop"
    publishedAt?: number;               // Optional release time; some entries omit this field
    archivePublishedAt: number;         // Archive release time
}

/** Top-level costume data wrapper. */
export interface IMoeCostumeData {
    stats: ICostumeStats;
    costumes: ICostumeInfo[];
}

export const PART_TYPE_IDS = ["head", "hair", "body"] as const;
export const PART_TYPE_LABEL_KEYS: Record<string, string> = {
    head: "common.costume.partTypes.head",
    hair: "common.costume.partTypes.hair",
    body: "common.costume.partTypes.body",
};

export const SOURCE_IDS = ["card", "shop", "other"] as const;
export const SOURCE_LABEL_KEYS: Record<string, string> = {
    card: "common.costume.sources.card",
    shop: "common.costume.sources.shop",
    other: "common.costume.sources.other",
};

export const RARITY_IDS = ["rare", "normal"] as const;
export const RARITY_LABEL_KEYS: Record<string, string> = {
    rare: "common.costume.rarities.rare",
    normal: "common.costume.rarities.normal",
};
