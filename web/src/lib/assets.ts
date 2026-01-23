import { AssetSourceType } from "@/contexts/ThemeContext";

export const ASSET_BASE_URL_EX = "https://assets.exmeaning.com/sekai-assets";
export const ASSET_BASE_URL_UNI = "https://assets.unipjsk.com";
export const ASSET_BASE_URL_HARUKI = "https://sekai-assets-bdf29c81.seiunx.net/jp-assets";
export const ASSET_BASE_URL_SNOWY = "https://snowyassets.exmeaning.com";

// Get the base URL based on asset source setting
export function getAssetBaseUrl(source: AssetSourceType): string {
    if (source === "snowyassets") {
        return ASSET_BASE_URL_SNOWY;
    }
    return source === "haruki" ? ASSET_BASE_URL_HARUKI : ASSET_BASE_URL_UNI;
}

export function getCharacterIconUrl(characterId: number): string {
    // Using exmeaning with specific path format as requested - NO sekai-assets subpath
    return `https://assets.exmeaning.com/character_icons/chr_ts_${characterId}.png`;
}

export function getAttrIconUrl(attr: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/thumbnail/common/attribute/${attr}.png`;
}

export function getUnitLogoUrl(unitId: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/thumbnail/common/unit/${unitId}.png`;
}

export function getCardThumbnailUrl(
    characterId: number,
    assetbundleName: string,
    trained: boolean = false,
    source: AssetSourceType = "uni"
): string {
    const baseUrl = getAssetBaseUrl(source);
    const status = trained ? "after_training" : "normal";
    return `${baseUrl}/startapp/thumbnail/chara/${assetbundleName}_${status}.png`;
}

export function getCardFullUrl(
    characterId: number,
    assetbundleName: string,
    trained: boolean = false,
    source: AssetSourceType = "uni"
): string {
    const baseUrl = getAssetBaseUrl(source);
    const status = trained ? "after_training" : "normal";
    return `${baseUrl}/startapp/character/member/${assetbundleName}/card_${status}.png`;
}

export function getEventBannerUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/event/${assetbundleName}/screen/bg.png`;
}

export function getEventCharacterUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/event/${assetbundleName}/screen/character.png`;
}

export function getEventLogoUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/event/${assetbundleName}/logo/logo.png`;
}

// ==================== Gacha Asset URLs ====================

export function getGachaLogoUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/gacha/${assetbundleName}/logo/logo.png`;
}

export function getGachaBannerUrl(gachaId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/home/banner/banner_gacha${gachaId}/banner_gacha${gachaId}.png`;
}

export function getGachaScreenUrl(assetbundleName: string, gachaId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/gacha/${assetbundleName}/screen/texture/bg_gacha${gachaId}_1.png`;
}

// Gacha Voice always uses Haruki source (audio files not on Uni)
// Update: SnowyAssets also has these files
export function getCardGachaVoiceUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
    }
    return `${ASSET_BASE_URL_HARUKI}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
}

// ==================== Comic Asset URLs ====================

export function getComicUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    // Comics are available on Haruki and SnowyAssets
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/comic/one_frame/${assetbundleName}.png`;
    }
    return `${ASSET_BASE_URL_HARUKI}/startapp/comic/one_frame/${assetbundleName}.png`;
}

// ==================== Sticker/Stamp Asset URLs ====================

export function getStampUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/stamp/${assetbundleName}/${assetbundleName}.png`;
}

// ==================== Music Asset URLs ====================

// Chart SVG available on Uni and SnowyAssets
export function getChartSvgUrl(musicId: number, difficulty: string, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `https://charts-new.unipjsk.com/moe/svg/${musicId}/${difficulty}.svg`;
    }
    return `https://charts-new.unipjsk.com/moe/svg/${musicId}/${difficulty}.svg`;
}

export function getMusicJacketUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/music/jacket/${assetbundleName}/${assetbundleName}.png`;
}

export function getMusicVocalAudioUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/music/long/${assetbundleName}/${assetbundleName}.mp3`;
}

// ==================== Virtual Live Asset URLs ====================

// Virtual Live Banner available on Haruki and SnowyAssets
export function getVirtualLiveBannerUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
    }
    return `${ASSET_BASE_URL_HARUKI}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
}

// ==================== MySEKAI Asset URLs ====================

// MySEKAI Fixture Thumbnail available on Haruki and SnowyAssets
// MySEKAI Fixture Thumbnail available on Haruki and SnowyAssets
export function getMysekaiFixtureThumbnailUrl(assetbundleName: string, source: AssetSourceType = "uni", genreId: number = 0): string {
    const baseUrl = source === "snowyassets" ? ASSET_BASE_URL_SNOWY : ASSET_BASE_URL_HARUKI;

    // Wall (Genre ID 7)
    if (genreId === 7) {
        return `${baseUrl}/ondemand/mysekai/thumbnail/surface_appearance/${assetbundleName}/tex_${assetbundleName}_wall_appearance_1.png`;
    }

    // Floor (Genre ID 8)
    if (genreId === 8) {
        return `${baseUrl}/ondemand/mysekai/thumbnail/surface_appearance/${assetbundleName}/tex_${assetbundleName}_floor_appearance_1.png`;
    }

    // Default
    return `${baseUrl}/ondemand/mysekai/thumbnail/fixture/${assetbundleName}_1.png`;
}

// MySEKAI Material Thumbnail available on Haruki and SnowyAssets
export function getMysekaiMaterialThumbnailUrl(iconAssetbundleName: string, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/ondemand/mysekai/thumbnail/material/${iconAssetbundleName}.png`;
    }
    // Default to Haruki for MySEKAI as Uni doesn't have these
    return `${ASSET_BASE_URL_HARUKI}/ondemand/mysekai/thumbnail/material/${iconAssetbundleName}.png`;
}

// ==================== Character Asset URLs ====================

// Character trim image (main display image)
export function getCharacterTrimUrl(characterId: number, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/character/character_trim/chr_trim_${characterId}.png`;
    }
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/character_trim/chr_trim_${characterId}.png`;
}

// Character horizontal label
export function getCharacterLabelHUrl(characterId: number, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/character/label/chr_h_lb_${characterId}.png`;
    }
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/label/chr_h_lb_${characterId}.png`;
}

// Character vertical label
export function getCharacterLabelVUrl(characterId: number, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/character/label_vertical/chr_v_lb_${characterId}.png`;
    }
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/label_vertical/chr_v_lb_${characterId}.png`;
}

// Character select thumbnail (for list view)
export function getCharacterSelectUrl(characterId: number, source: AssetSourceType = "uni"): string {
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/character/character_select/chr_tl_${characterId}.png`;
    }
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/character_select/chr_tl_${characterId}.png`;
}

