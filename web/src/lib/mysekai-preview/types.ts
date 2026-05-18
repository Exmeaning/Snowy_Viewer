import type { AssetSourceType } from "@/contexts/ThemeContext";

export type MysekaiLayoutType =
    | "floor"
    | "rug"
    | "road"
    | "wall_left"
    | "wall_right"
    | "wall_front"
    | "wall_back";

export interface MysekaiVector3Like {
    x?: number;
    y?: number;
    z?: number;
}

export interface MysekaiLayoutItem {
    position?: MysekaiVector3Like;
    rotation?: number;
    mysekaiFixtureId?: number;
    mysekaiCustomFixtureId?: number;
    textureId?: number;
    cardId?: number;
    isSpecialTraining?: boolean;
    mysekaiMusicRecordId?: number;
    ornamentRotation?: number;
    __isCustomFixture?: boolean;
    __customGroupKey?: string;
    __isGrowingPlant?: boolean;
}

export interface MysekaiHousingLayoutGroup {
    mysekaiLayoutType?: MysekaiLayoutType | string;
    mysekaiFixtures?: MysekaiLayoutItem[];
    mysekaiCanvases?: MysekaiLayoutItem[];
    mysekaiGrowingPlants?: MysekaiLayoutItem[];
    mysekaiCustomFixturePhotos?: MysekaiLayoutItem[];
    mysekaiCustomFixtureCollections?: MysekaiLayoutItem[];
    mysekaiCustomFixturePenlights?: MysekaiLayoutItem[];
    mysekaiCustomFixtureHonors?: MysekaiLayoutItem[];
    mysekaiCustomFixtureBondsHonors?: MysekaiLayoutItem[];
    mysekaiCustomFixtureRecordJackets?: MysekaiLayoutItem[];
}

export interface MysekaiSurfaceAppearance {
    mysekaiFixtureSurfaceAppearanceType?: "floor_appearance" | "wall_appearance" | string;
    mysekaiFixtureId?: number;
    textureId?: number;
}

export interface UserMysekaiSiteHousingLayout {
    mysekaiSiteId?: number;
    mysekaiSiteHousingLayouts?: MysekaiHousingLayoutGroup[];
    mysekaiFixtureSurfaceAppearances?: MysekaiSurfaceAppearance[];
}

export interface MysekaiMusicPlayFixtureSetting {
    mysekaiSiteId?: number;
    mysekaiMusicRecordId?: number;
    musicVocalId?: number;
    isInstrumental?: boolean;
}

export interface MysekaiLayoutData {
    userMysekaiSiteHousingLayouts?: UserMysekaiSiteHousingLayout[];
    userMysekaiMusicPlayFixtureSettings?: MysekaiMusicPlayFixtureSetting[];
    userMysekaiGate?: {
        mysekaiGateId?: number;
    };
    mysekaiRank?: number;
}

export interface MysekaiFixtureGridSize {
    width?: number;
    depth?: number;
    height?: number;
}

export interface MysekaiFixtureMaster {
    id?: number;
    assetbundleName?: string;
    gridSize?: MysekaiFixtureGridSize;
    mysekaiFixtureHandleType?: string;
    mysekaiFixtureType?: string;
    mysekaiSettableLayoutType?: string;
}

export interface MysekaiCustomFixtureMaster {
    id?: number;
    baseAssetBundleName?: string;
    ornamentAssetBundleName?: string;
    mysekaiCustomFixtureOrnamentType?: string;
    width?: number;
    depth?: number;
    height?: number;
}

export interface MysekaiRankReleaseMaster {
    mysekaiRankRelaseType?: string;
    mysekaiRank?: number;
    externalId?: number;
}

export interface MysekaiSiteLevelMaster {
    id?: number;
    level?: number;
    mysekaiSiteId?: number;
}

export interface MysekaiSiteLayoutMaster {
    mysekaiSiteLevelId?: number;
    mysekaiLayoutType?: string;
    width?: number;
    depth?: number;
    height?: number;
}

export interface MysekaiMusicRecordMaster {
    id?: number;
    mysekaiMusicTrackType?: "music" | "music_sound_track" | string;
    externalId?: number;
}

export interface MysekaiMusicMaster {
    id?: number;
    title?: string;
    assetbundleName?: string;
    fillerSec?: number;
}

export interface MysekaiMusicVocalMaster {
    id?: number;
    musicId?: number;
    musicVocalType?: string;
    caption?: string;
    assetbundleName?: string;
}

export interface MysekaiMusicSoundTrackMaster {
    id?: number;
    title?: string;
    assetbundleName?: string;
    assetbundleFileName?: string;
}

export interface MysekaiPreviewOptions {
    layoutUrl: string;
    siteId: number;
    assetSource: AssetSourceType;
    gridEnabled: boolean;
    shadowEnabled: boolean;
    debugEnabled: boolean;
    backWallOpacity: number;
    lookSensitivity: number;
}

export interface MysekaiPreviewStatus {
    phase: "idle" | "loading" | "ready" | "error";
    message: string;
    loaded: number;
    total: number;
    skipped: number;
    progress?: number;
    stage?: "master" | "layout" | "assets" | "finalize" | "ready" | "error" | string;
    stageLabel?: string;
    renderableTotal?: number;
    ignored?: number;
    failed?: number;
    currentAsset?: string;
}

export interface MysekaiSceneSize {
    width: number;
    depth: number;
    height?: number;
}

export interface ExtractedMysekaiEntry {
    layoutType: string;
    item: MysekaiLayoutItem;
}
