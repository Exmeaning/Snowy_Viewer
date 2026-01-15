import { AssetSourceType } from "@/contexts/ThemeContext";

export const ASSET_BASE_URL_EX = "https://assets.exmeaning.com/sekai-assets";
export const ASSET_BASE_URL_UNI = "https://assets.unipjsk.com";
export const ASSET_BASE_URL_HARUKI = "https://sekai-assets-bdf29c81.seiunx.net/jp-assets";

// Get the base URL based on asset source setting
export function getAssetBaseUrl(source: AssetSourceType): string {
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
export function getCardGachaVoiceUrl(assetbundleName: string): string {
    return `${ASSET_BASE_URL_HARUKI}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
}

// ==================== Comic Asset URLs ====================

export function getComicUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    // Comics are only available on Haruki source
    return `${ASSET_BASE_URL_HARUKI}/startapp/comic/one_frame/${assetbundleName}.png`;
}

// ==================== Sticker/Stamp Asset URLs ====================

export function getStampUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/stamp/${assetbundleName}/${assetbundleName}.png`;
}

// ==================== Music Asset URLs ====================

// Chart SVG always uses Uni source (only available there)
export function getChartSvgUrl(musicId: number, difficulty: string): string {
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

// Virtual Live Banner always uses Haruki source
export function getVirtualLiveBannerUrl(assetbundleName: string): string {
    return `${ASSET_BASE_URL_HARUKI}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
}
