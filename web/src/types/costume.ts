// Costume Types for Snowy Viewer
// Based on snowy_costumes.json master data structure

export interface ICostumePart {
    colorId: number;
    colorName: string;
    assetbundleName: string;
    // For compatibility with previous code if needed, but the example shows only these 3
}

export interface ICostumeInfo {
    id: number;
    costume3dGroupId: number;
    costume3dType: string;        // "normal"
    name: string;
    partTypes: string[];          // "head" | "hair" | "body"
    characterIds: number[];       // list of character IDs that can wear this
    gender: string;               // "female" | "male"
    costume3dRarity: string;      // "rare" | "normal"
    costumePrefix: string;        // New field
    designer: string;
    publishedAt: number;
    archivePublishedAt: number;
    parts: Record<string, ICostumePart[]>; // Dictionary of parts
    source: string;               // "card" | "default" | "shop" | "other"
    cardIds?: number[];           // related card IDs (usually for source === "card")
    assetPrefix?: string;         // Optional compatibility or older field
}

export interface ISnowyCostumesData {
    costumes: ICostumeInfo[];
}

// Part type display names
export const PART_TYPE_NAMES: Record<string, string> = {
    head: "发饰",
    hair: "发型",
    body: "服装",
};

// Source display names
export const SOURCE_NAMES: Record<string, string> = {
    card: "卡牌服装",
    default: "默认服装",
    shop: "商店购买",
    other: "未分类",
};

// Rarity display names
export const RARITY_NAMES: Record<string, string> = {
    rare: "稀有",
    normal: "普通",
};
