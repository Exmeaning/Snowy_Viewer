// Honor types based on sekai.best IHonorInfo / IHonorGroup

export interface IHonorLevel {
    honorId: number;
    level: number;
    bonus: number;
    description: string;
    honorRarity?: string;
    assetbundleName?: string;
}

export interface IHonorInfo {
    id: number;
    seq: number;
    groupId: number;
    honorRarity?: string;
    name: string;
    assetbundleName?: string;
    levels: IHonorLevel[];
    honorMissionType?: string;
    honorType?: string;
}

export interface IHonorGroup {
    id: number;
    name: string;
    honorType: string;
    backgroundAssetbundleName?: string;
    frameName?: string;
}

// ==================== Bonds Honor Types ====================

export interface IBondsHonor {
    id: number;
    seq: number;
    bondsGroupId: number;
    gameCharacterUnitId1: number;
    gameCharacterUnitId2: number;
    honorRarity: string;
    name: string;
    levels: IBondsHonorLevel[];
}

export interface IBondsHonorLevel {
    id: number;
    bondsHonorId: number;
    level: number;
    description: string;
}

export interface IBondsHonorWord {
    id: number;
    seq: number;
    bondsGroupId: number;
    assetbundleName: string;
    name: string;
    description: string;
}

export interface IBond {
    id: number;
    groupId: number;
    characterId1: number;
    characterId2: number;
}

export interface IGameCharaUnit {
    id: number;
    gameCharacterId: number;
    unit: string;
    colorCode: string;
    skinColorCode: string;
    skinShadowColorCode: string;
}

// Honor rarity display names
export const HONOR_RARITY_NAMES: Record<string, string> = {
    low: "普",
    middle: "羽",
    high: "花",
    highest: "星",
};

// Honor type display names
export const HONOR_TYPE_NAMES: Record<string, string> = {
    achievement: "成就",
    event: "活动",
    event_point: "活动点数",
    rank_match: "排位赛",
    character_rank: "角色",
    bonds: "绊",
    birthday: "生日",
    license: "许可",
    unit_rank: "团体等级",
    world_bloom: "世界开花",
    main_story: "主线剧情",
    challenge_live: "挑战Live",
    virtual_live: "虚拟Live",
};
