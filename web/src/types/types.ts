// Card Types for Snowy Viewer
// Based on sekai.best and Haruki master data structure

export type CardRarityType =
    | "rarity_1"
    | "rarity_2"
    | "rarity_3"
    | "rarity_4"
    | "rarity_birthday";

export type CardAttribute =
    | "cool"
    | "cute"
    | "happy"
    | "mysterious"
    | "pure";

export type SupportUnit =
    | "none"
    | "light_sound"
    | "idol"
    | "school_refusal"
    | "theme_park"
    | "street";

export interface ICardInfo {
    id: number;
    seq: number;
    characterId: number;
    cardRarityType: CardRarityType;
    specialTrainingPower1BonusFixed: number;
    specialTrainingPower2BonusFixed: number;
    specialTrainingPower3BonusFixed: number;
    attr: CardAttribute;
    supportUnit: SupportUnit;
    skillId: number;
    cardSkillName: string;
    specialTrainingSkillId?: number;  // Skill ID after blooming/special training  
    specialTrainingSkillName?: string; // Skill name after blooming/special training
    prefix: string;
    assetbundleName: string;
    gachaPhrase: string;
    archiveDisplayType: string;
    archivePublishedAt: number;
    cardParameters: {
        param1: number[];
        param2: number[];
        param3: number[];
    };
    specialTrainingCosts: unknown[];
    masterLessonAchieveResources: unknown[];
    releaseAt: number;
    cardSupplyId: number;
    cardSupplyType: string;
}

// Character data
export interface IGameChara {
    id: number;
    firstName: string;
    givenName: string;
    firstNameRuby?: string;
    givenNameRuby?: string;
    gender: string;
    height: number;
    live2dHeightAdjustment: number;
    figure: string;
    breastSize: string;
    modelName: string;
    unit: string;
    supportUnitType: string;
}

// Skill data structure
export interface ISkillEffectDetail {
    level: number;
    activateEffectDuration: number;
    activateEffectValue: number;
}

export interface ISkillEffect {
    id: number;
    skillEffectDetails: ISkillEffectDetail[];
    skillEnhance?: {
        activateEffectValue: number;
    };
    activateCharacterRank?: number;
    activateUnitCount?: number;
}

export interface ISkillInfo {
    id: number;
    skillId: number;
    description: string;
    skillEffects: ISkillEffect[];
}


// Unit data structure
export interface UnitData {
    id: string;
    name: string;
    color: string;
    charIds: number[];
}

// Unit definitions
export const UNIT_DATA: UnitData[] = [
    { id: "ln", name: "Leo/need", color: "#4455DD", charIds: [1, 2, 3, 4] },
    { id: "mmj", name: "MORE MORE JUMP!", color: "#88DD44", charIds: [5, 6, 7, 8] },
    { id: "vbs", name: "Vivid BAD SQUAD", color: "#EE1166", charIds: [9, 10, 11, 12] },
    { id: "ws", name: "Wonderlands×Showtime", color: "#FF9900", charIds: [13, 14, 15, 16] },
    { id: "25ji", name: "25時、ナイトコードで。", color: "#884499", charIds: [17, 18, 19, 20] },
    { id: "vs", name: "Virtual Singer", color: "#33CCBB", charIds: [21, 22, 23, 24, 25, 26] },
];

// Character name mapping (Japanese)
export const CHARACTER_NAMES: Record<number, string> = {
    1: "星乃一歌",
    2: "天馬咲希",
    3: "望月穂波",
    4: "日野森志歩",
    5: "花里みのり",
    6: "桐谷遥",
    7: "桃井愛莉",
    8: "日野森雫",
    9: "小豆沢こはね",
    10: "白石杏",
    11: "東雲彰人",
    12: "青柳冬弥",
    13: "天馬司",
    14: "鳳えむ",
    15: "草薙寧々",
    16: "神代類",
    17: "宵崎奏",
    18: "朝比奈まふゆ",
    19: "東雲絵名",
    20: "暁山瑞希",
    21: "初音ミク",
    22: "鏡音リン",
    23: "鏡音レン",
    24: "巡音ルカ",
    25: "MEIKO",
    26: "KAITO",
};

// Rarity star count mapping
export const RARITY_TO_STARS: Record<CardRarityType, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 4,
};

// Rarity display config with colors
export const RARITY_DISPLAY: Record<number, { label: string; color: string }> = {
    1: { label: "1★", color: "#888888" },
    2: { label: "2★", color: "#88BB44" },
    3: { label: "3★", color: "#4488DD" },
    4: { label: "4★", color: "#FFAA00" },
    5: { label: "🎂", color: "#FF6699" },
};

// Check if card can be trained (special training)
export function isTrainableCard(card: ICardInfo): boolean {
    return card.cardRarityType === "rarity_3" ||
        card.cardRarityType === "rarity_4" ||
        card.cardRarityType === "rarity_birthday";
}

// Get rarity number from type
export function getRarityNumber(rarityType: CardRarityType): number {
    if (rarityType === "rarity_birthday") return 5;
    return parseInt(rarityType.replace("rarity_", ""));
}

// Attribute display names
export const ATTR_NAMES: Record<CardAttribute, string> = {
    cool: "Cool",
    cute: "Cute",
    happy: "Happy",
    mysterious: "Mysterious",
    pure: "Pure",
};

// Attribute colors for UI
export const ATTR_COLORS: Record<CardAttribute, string> = {
    cool: "#4455dd",
    cute: "#ff6699",
    happy: "#ffaa00",
    mysterious: "#bb88ff",
    pure: "#44dd88",
};

// Character short names (Chinese)
export const CHAR_NAMES: Record<number, string> = {
    1: "一歌", 2: "咲希", 3: "穗波", 4: "志步",
    5: "实乃理", 6: "遥", 7: "爱莉", 8: "雫",
    9: "心羽", 10: "杏", 11: "彰人", 12: "冬弥",
    13: "司", 14: "笑梦", 15: "宁宁", 16: "类",
    17: "奏", 18: "真冬", 19: "绘名", 20: "瑞希",
    21: "Miku", 22: "Rin", 23: "Len", 24: "Luka", 25: "MEIKO", 26: "KAITO"
};

// Character theme colors for UI customization
export const CHAR_COLORS: Record<string, string> = {
    "1": "#33aaee", "2": "#ffdd44", "3": "#ee6666", "4": "#BBDD22",
    "5": "#FFCCAA", "6": "#99CCFF", "7": "#ffaacc", "8": "#99EEDD",
    "9": "#ff6699", "10": "#00BBDD", "11": "#ff7722", "12": "#0077DD",
    "13": "#FFBB00", "14": "#FF66BB", "15": "#33DD99", "16": "#BB88EE",
    "17": "#bb6688", "18": "#8888CC", "19": "#CCAA88", "20": "#DDAACC",
    "21": "#33ccbb", "22": "#ffcc11", "23": "#FFEE11", "24": "#FFBBCC",
    "25": "#DD4444", "26": "#3366CC"
};

// ==================== Gacha Types ====================

export interface IGachaInfo {
    id: number;
    gachaType: string;
    name: string;
    seq: number;
    assetbundleName: string;
    gachaCeilItemId?: number;
    startAt: number;
    endAt: number;
    gachaBehaviors: IGachaBehavior[];
    gachaCardRarityRates: IGachaCardRarityRate[];
    gachaDetails: IGachaDetail[];
    gachaPickups: IGachaPickup[];
    wishSelectCount?: number;
    wishFixedSelectCount?: number;
    wishLimitedSelectCount?: number;
    gachaCeilExchangeId?: number;
    gachaBonusId?: number;
}

export interface IGachaPickup {
    id: number;
    gachaId: number;
    cardId: number;
    gachaPickupType?: string;
}

export interface IGachaBehavior {
    id: number;
    gachaId: number;
    gachaBehaviorType: string;
    costResourceType: string;
    costResourceQuantity: number;
    spinCount: number;
    spinLimit?: number;
}

export interface IGachaCardRarityRate {
    id: number;
    gachaId: number;
    cardRarityType: CardRarityType;
    rate: number;
}

export interface IGachaDetail {
    id: number;
    gachaId: number;
    cardId: number;
    weight: number;
    isWish?: boolean;
}

// Gacha type labels
export const GACHA_TYPE_LABELS: Record<string, string> = {
    ceil: "天井扭蛋",
    normal: "普通扭蛋",
    limited: "限定扭蛋",
    birthday: "生日扭蛋",
    colorful_festival: "Colorful Festival",
};
