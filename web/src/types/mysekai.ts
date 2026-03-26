export interface IMysekaiFixtureGridSize {
    width: number;
    depth: number;
    height: number;
}

export interface IMysekaiFixtureTagGroup {
    id: number;
    mysekaiFixtureTagId1?: number;
    mysekaiFixtureTagId2?: number;
    mysekaiFixtureTagId3?: number;
    [key: string]: number | undefined;
}

export interface IMysekaiFixtureInfo {
    id: number;
    mysekaiFixtureType: string;
    name: string;
    pronunciation: string;
    flavorText: string;
    seq: number;
    gridSize: IMysekaiFixtureGridSize;
    mysekaiFixtureMainGenreId: number;
    mysekaiFixtureSubGenreId: number;
    mysekaiFixtureHandleType: string;
    mysekaiSettableSiteType: string;
    mysekaiSettableLayoutType: string;
    mysekaiFixturePutType: string;
    // mysekaiFixtureAnotherColors: any[]; // Assuming array, keeping as any for now if not strictly needed
    mysekaiFixtureTagGroup: IMysekaiFixtureTagGroup;
    isAssembled: boolean;
    isDisassembled: boolean;
    // mysekaiFixturePlayerActionType: string;
    // isGameCharacterAction: boolean;
    assetbundleName: string;
    firstPutCost: number;
    secondPutCost: number;
}

export interface IMysekaiFixtureGenre {
    id: number;
    name: string;
    seq: number;
}

export interface IMysekaiFixtureSubGenre {
    id: number;
    name: string;
    seq: number;
    mysekaiFixtureMainGenreId: number;
}

export interface IMysekaiFixtureTag {
    id: number;
    name: string;
    seq?: number;
    pronunciation?: string;
    mysekaiFixtureTagType?: string; // 'game_character', 'unit', or other
    externalId?: number; // character ID or unit ID
}

// Blueprint - links fixture to materials
export interface IMysekaiBlueprint {
    id: number;
    mysekaiCraftType: string;
    craftTargetId: number; // This is the fixture ID when mysekaiCraftType is 'mysekai_fixture'
    isEnableSketch: boolean;
    isObtainedByConvert: boolean;
    craftCountLimit?: number;
    isAvailableWithoutPossession: boolean;
}

// Material Cost - materials needed for a blueprint
export interface IMysekaiBlueprintMaterialCost {
    id: number;
    mysekaiBlueprintId: number;
    mysekaiMaterialId: number;
    seq: number;
    quantity: number;
}

// Material - material info
export interface IMysekaiMaterial {
    id: number;
    seq: number;
    mysekaiMaterialType: string;
    name: string;
    pronunciation: string;
    description: string;
    mysekaiMaterialRarityType: string;
    iconAssetbundleName: string;
    modelAssetbundleName: string;
    mysekaiSiteIds: number[];
}

// Character Talk Condition
export interface IMysekaiCharacterTalkCondition {
    id: number;
    mysekaiCharacterTalkConditionType: string;
    mysekaiCharacterTalkConditionTypeValue: number;
}

// Character Talk Condition Group (each row links a groupId to a conditionId)
export interface IMysekaiCharacterTalkConditionGroup {
    id: number;
    groupId: number;
    mysekaiCharacterTalkConditionId: number;
}

// Character Talk
export interface IMysekaiCharacterTalk {
    id: number;
    mysekaiCharacterTalkConditionGroupId: number;
    mysekaiCharacterTalkVoiceId?: number;
    mysekaiGameCharacterUnitGroupId?: number;
}

// Character Unit Group
export interface IMysekaiGameCharacterUnitGroup {
    id: number;
    gameCharacterUnitId1?: number;
    gameCharacterUnitId2?: number;
    gameCharacterUnitId3?: number;
    gameCharacterUnitId4?: number;
    gameCharacterUnitId5?: number;
}
