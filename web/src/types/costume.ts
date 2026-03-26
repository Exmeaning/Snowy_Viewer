// Costume Types for Moesekai
// Based on moe_costume.json master data structure

/** 服装部件颜色变体 */
export interface ICostumePart {
    colorId: number;
    colorName: string;
    assetbundleName: string;
}

/** 角色专属部件（extraParts 中的条目） */
export interface ICostumeExtraPart {
    characterId: number;
    partType: string;           // "head" | "hair" | "body"
    variants: ICostumePart[];   // 该角色该部位的颜色变体列表
}

/** 商店信息 */
export interface ICostumeShopInfo {
    shopItemId: number;
    shopGroupId: number;
    costs: Array<{
        resourceType: string;
        resourceId: number;
    }>;
    startAt: number;
}

/** 服装统计信息（顶层 stats 字段） */
export interface ICostumeStats {
    total: number;
    totalDefaults: number;
    by_source: Record<string, number>;
    by_partType: Record<string, number>;
    by_gender: Record<string, number>;
    by_rarity: Record<string, number>;
}

/** 服装主体信息 — 一个对象 = 一套服装 */
export interface ICostumeInfo {
    costumeNumber: number;              // 唯一标识（替代旧 id / costume3dGroupId）
    name: string;
    costume3dType: string;              // "normal"
    costume3dRarity: string;            // "rare" | "normal"
    designer: string;
    partTypes: string[];                // "head" | "hair" | "body"
    characterIds: number[];             // 可穿戴角色列表
    gender: string;                     // "female" | "male"
    parts: Record<string, ICostumePart[]>;  // 共享部件，key=partType
    extraParts?: ICostumeExtraPart[];   // 角色专属部件
    source: string;                     // "card" | "shop" | "other"
    cardIds?: number[];                 // 关联卡牌 ID（source === "card" 时）
    shopInfo?: ICostumeShopInfo;        // 商店信息（source === "shop" 时）
    publishedAt?: number;               // 发布时间（可选，部分条目无此字段）
    archivePublishedAt: number;         // 归档发布时间
}

/** 顶层数据包装 */
export interface IMoeCostumeData {
    stats: ICostumeStats;
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
    shop: "商店购买",
    other: "未分类",
};

// Rarity display names
export const RARITY_NAMES: Record<string, string> = {
    rare: "稀有",
    normal: "普通",
};
