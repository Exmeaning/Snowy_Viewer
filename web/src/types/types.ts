// Card Types for Moesekai
// Based on sekai.best and Haruki master data structure

// Unit internal field → Chinese official name mapping (source: unitProfiles.json)
// Defined first so other constants can reference it
export const UNIT_NAME_MAP: Record<string, string> = {
    light_sound: "Leo/need",
    idol: "MORE MORE JUMP！",
    street: "Vivid BAD SQUAD",
    theme_park: "Wonderlands×Showtime",
    school_refusal: "25点，Nightcord见。",
    piapro: "虚拟歌手",
};

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

// Support Unit display names (for virtual singers)
export const SUPPORT_UNIT_NAMES: Record<SupportUnit, string> = {
    "none": "原版",
    "light_sound": UNIT_NAME_MAP.light_sound,
    "idol": UNIT_NAME_MAP.idol,
    "school_refusal": UNIT_NAME_MAP.school_refusal,
    "theme_park": UNIT_NAME_MAP.theme_park,
    "street": UNIT_NAME_MAP.street,
};

// Support Unit to Unit ID mapping (for icons)
export const SUPPORT_UNIT_TO_UNIT_ID: Record<SupportUnit, string | null> = {
    "none": null,
    "light_sound": "ln",
    "idol": "mmj",
    "school_refusal": "25ji",
    "theme_park": "ws",
    "street": "vbs",
};

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

// Character profile data from characterProfiles.json
export interface ICharaProfile {
    characterId: number;
    height: string;
    school: string;
    schoolYear: string;
    birthday: string;
    introduction: string;
    hobby?: string;
    specialSkill?: string;
    favoriteFood?: string;
    hatedFood?: string;
    weak?: string;
    scenarioId?: string;
}

// Character unit information from gameCharacterUnits.json
export interface ICharaUnitInfo {
    id: number;
    gameCharacterId: number;
    unit: string;
    colorCode: string;
    skinColorCode: string;
    skinShadowColorCode1: string;
    skinShadowColorCode2: string;
}

// Unit profile data from unitProfiles.json
export interface IUnitProfile {
    unit: string;
    unitName: string;
    seq: number;
    profileSentence: string;
    colorCode: string;
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

// Unit icon file mapping (unit id → icon filename)
export const UNIT_ICON_FILES: Record<string, string> = {
    ln: "ln.webp", mmj: "mmj.webp", vbs: "vbs.webp",
    ws: "wxs.webp", "25ji": "n25.webp", vs: "vs.webp",
};

// Unit field (from master data) → unit id mapping
export const UNIT_FIELD_TO_ID: Record<string, string> = {
    light_sound: "ln",
    idol: "mmj",
    street: "vbs",
    theme_park: "ws",
    school_refusal: "25ji",
    piapro: "vs",
};

// Unit definitions
export const UNIT_DATA: UnitData[] = [
    { id: "ln", name: UNIT_NAME_MAP.light_sound, color: "#4455DD", charIds: [1, 2, 3, 4] },
    { id: "mmj", name: UNIT_NAME_MAP.idol, color: "#88DD44", charIds: [5, 6, 7, 8] },
    { id: "vbs", name: UNIT_NAME_MAP.street, color: "#EE1166", charIds: [9, 10, 11, 12] },
    { id: "ws", name: UNIT_NAME_MAP.theme_park, color: "#FF9900", charIds: [13, 14, 15, 16] },
    { id: "25ji", name: UNIT_NAME_MAP.school_refusal, color: "#884499", charIds: [17, 18, 19, 20] },
    { id: "vs", name: UNIT_NAME_MAP.piapro, color: "#33CCBB", charIds: [21, 22, 23, 24, 25, 26] },
];

// Character name mapping (Chinese, from gameCharacters.json: firstName + givenName)
export const CHARACTER_NAMES: Record<number, string> = {
    1: "星乃一歌",
    2: "天马咲希",
    3: "望月穗波",
    4: "日野森志步",
    5: "花里实乃理",
    6: "桐谷遥",
    7: "桃井爱莉",
    8: "日野森雫",
    9: "小豆泽心羽",
    10: "白石杏",
    11: "东云彰人",
    12: "青柳冬弥",
    13: "天马司",
    14: "凤笑梦",
    15: "草薙宁宁",
    16: "神代类",
    17: "宵崎奏",
    18: "朝比奈真冬",
    19: "东云绘名",
    20: "晓山瑞希",
    21: "初音未来",
    22: "镜音铃",
    23: "镜音连",
    24: "巡音流歌",
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

// Attribute icon file paths (Case sensitive for Linux/Production)
export const ATTR_ICON_PATHS: Record<CardAttribute, string> = {
    cool: "Cool.webp",
    cute: "cute.webp",
    happy: "Happy.webp",
    mysterious: "Mysterious.webp",
    pure: "Pure.webp",
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
    lotteryType?: string;
    rate: number;
}

export interface IGachaDetail {
    id: number;
    gachaId: number;
    cardId: number;
    weight: number;
    isWish?: boolean;
    gachaDetailWishType?: "fixed" | "normal" | "limited";
}

// Gacha type labels
export const GACHA_TYPE_LABELS: Record<string, string> = {
    ceil: "天井扭蛋",
    normal: "普通扭蛋",
    limited: "限定扭蛋",
    birthday: "生日扭蛋",
    colorful_festival: "Colorful Festival",
};

// Gacha category filter types
export type GachaCategoryType = "all" | "wish_pick" | "normal_pickup";

export const GACHA_CATEGORY_LABELS: Record<GachaCategoryType, string> = {
    all: "全部",
    wish_pick: "自选池",
    normal_pickup: "普通池",
};

// Helper function to check if a gacha is a wish/pick pool
export function isWishGacha(gacha: IGachaInfo): boolean {
    return gacha.gachaCardRarityRates.some(rate => rate.lotteryType === "categorized_wish");
}
