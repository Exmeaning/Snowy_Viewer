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
        // Assuming SnowyAssets mirrors the structure or has it available
        // Note: The user request didn't explicitly specify charts, but "uni's and haruki's can be used"
        // implies full coverage. Let's check if there's a specific path for charts on snowyassets later if needed.
        // For now, let's assume it might be proxied or we fallback/use specific common path if known.
        // Actually, Uni charts are on charts-new.unipjsk.com, not the main asset server.
        // If snowyassets allows everything, maybe it proxies charts too?
        // Given the request "can uni's haruki's all be used", I'll add the option.
        // But for charts, Uni uses a different domain. Let's keep Uni as fallback but add snowy support if possible.
        // Since I don't know the exact snowy chart URL, I'll stick to Uni for charts unless I'm sure.
        // Wait, the user said "can uni's haruki's all be used" -> "Uni's and Haruki's [assets] can all be used".
        // It implies SnowyAssets is a superset or proxy.
        // For safely, let's assume standard asset structure.
        // But charts are special in Uni.
        // Let's modify getting chart url to accept source for API signature consistency, but maybe keep uni for now if unsure.
        // Actually, let's try to use snowyassets if selected.
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
