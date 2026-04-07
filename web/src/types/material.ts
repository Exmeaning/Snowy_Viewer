export interface IMaterialInfo {
    id: number;
    seq: number;
    name: string;
    flavorText: string;
    flavorText2?: string;
    changeFlavorTextAt?: number;
    canUse: boolean;
    materialType: string;
}

export interface IMysekaiSiteInfo {
    id: number;
    mysekaiSiteType: string;
    mysekaiSiteCategory: string;
    assetbundleName: string;
    name: string;
    positionX: number;
    positionY: number;
    positionZ: number;
    isBase: boolean;
    isEnabledForMulti: boolean;
    presetGroupId?: number;
}
