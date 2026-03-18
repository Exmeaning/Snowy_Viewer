import { AssetSourceType } from "@/contexts/ThemeContext";

export const ASSET_BASE_URL_EX = "https://assets.exmeaning.com/sekai-assets";
export const ASSET_BASE_URL_UNI = "https://assets.unipjsk.com";
export const ASSET_BASE_URL_HARUKI = "https://sekai-assets-bdf29c81.seiunx.net/jp-assets";
export const ASSET_BASE_URL_SNOWY = "https://snowyassets.exmeaning.com";

// CN-specific base URLs (independent sources)
export const ASSET_BASE_URL_SNOWY_CN = "https://snowyassets.exmeaning.com/cn";
export const ASSET_BASE_URL_HARUKI_CN = "https://sekai-assets-bdf29c81.seiunx.net/cn-assets";

// Get the base URL based on asset source setting (5 independent sources)
export function getAssetBaseUrl(source: AssetSourceType): string {
    switch (source) {
        case "snowyassets": return ASSET_BASE_URL_SNOWY;
        case "haruki": return ASSET_BASE_URL_HARUKI;
        case "uni": return ASSET_BASE_URL_UNI;
        case "snowyassets_cn": return ASSET_BASE_URL_SNOWY_CN;
        case "haruki_cn": return ASSET_BASE_URL_HARUKI_CN;
        default: return ASSET_BASE_URL_SNOWY;
    }
}

// Helper: check if source is a CN source
export function isCnSource(source: AssetSourceType): boolean {
    return source === "snowyassets_cn" || source === "haruki_cn";
}

// Helper: get corresponding snowy source for current server context
function getSnowySource(source: AssetSourceType): AssetSourceType {
    return isCnSource(source) ? "snowyassets_cn" : "snowyassets";
}

// Helper: get corresponding haruki source for current server context
function getHarukiSource(source: AssetSourceType): AssetSourceType {
    return isCnSource(source) ? "haruki_cn" : "haruki";
}

export function getCharacterIconUrl(characterId: number): string {
    // Using exmeaning with specific path format as requested - NO sekai-assets subpath
    return `https://assets.exmeaning.com/character_icons/chr_ts_${characterId}.png`;
}

export function getAreaItemThumbnailUrl(
    assetbundleName: string,
    source: AssetSourceType = "uni"
): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/thumbnail/areaitem/${assetbundleName}.png`;
}

export function getMaterialThumbnailUrl(
    materialId: number,
    source: AssetSourceType = "uni"
): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/thumbnail/material/material${materialId}.png`;
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

export function getCostumeThumbnailUrl(
    assetbundleName: string,
    source: AssetSourceType = "uni"
): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/thumbnail/costume/${assetbundleName}.png`;
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

export function getEventStoryBannerUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/ondemand/event_story/${assetbundleName}/screen_image/banner_event_story.png`;
}

export function getEventBgmUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    // For CN sources or snowy/haruki, use their own base URL directly
    if (isCnSource(source) || source === "snowyassets" || source === "haruki") {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/event/${assetbundleName}/bgm/${assetbundleName}_top.mp3`;
    }
    // Uni source defaults to Haruki for BGM
    const baseUrl = ASSET_BASE_URL_HARUKI;
    return `${baseUrl}/ondemand/event/${assetbundleName}/bgm/${assetbundleName}_top.mp3`;
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
    // CN sources use their own base directly
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
    }
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
    }
    return `${ASSET_BASE_URL_HARUKI}/startapp/sound/gacha/get_voice/${assetbundleName}/${assetbundleName}.mp3`;
}

// ==================== Comic Asset URLs ====================

export function getComicUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    // CN sources use their own base directly
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/startapp/comic/one_frame/${assetbundleName}.png`;
    }
    // Comics are available on Haruki and SnowyAssets
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/startapp/comic/one_frame/${assetbundleName}.png`;
    }
    return `${ASSET_BASE_URL_HARUKI}/startapp/comic/one_frame/${assetbundleName}.png`;
}

// ==================== Manga Asset URLs ====================

export function getMangaImageUrl(id: number): string {
    return `https://moe.exmeaning.com/mangas/${id}.png`;
}

// ==================== Sticker/Stamp Asset URLs ====================

export function getStampUrl(assetbundleName: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/stamp/${assetbundleName}/${assetbundleName}.png`;
}

// ==================== Music Asset URLs ====================

// Music score (SUS) URL for chart preview
export function getMusicScoreUrl(musicId: number, difficulty: string, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    const paddedId = String(musicId).padStart(4, '0');
    const ext = isCnSource(source) ? ".txt" : "";
    return `${baseUrl}/startapp/music/music_score/${paddedId}_01/${difficulty}${ext}`;
}

// Chart SVG available on Uni and SnowyAssets
export function getChartSvgUrl(musicId: number, difficulty: string, source: AssetSourceType = "uni"): string {
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
    // CN sources use their own base directly
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
    }
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
    }
    return `${ASSET_BASE_URL_HARUKI}/ondemand/virtual_live/select/banner/${assetbundleName}/${assetbundleName}.png`;
}

// ==================== MySEKAI Asset URLs ====================

// MySEKAI Fixture Thumbnail available on Haruki and SnowyAssets
export function getMysekaiFixtureThumbnailUrl(assetbundleName: string, source: AssetSourceType = "uni", genreId: number = 0): string {
    // CN sources use their own base, JP defaults to Snowy or Haruki
    let baseUrl: string;
    if (isCnSource(source)) {
        baseUrl = getAssetBaseUrl(source);
    } else {
        baseUrl = source === "snowyassets" ? ASSET_BASE_URL_SNOWY : ASSET_BASE_URL_HARUKI;
    }

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
    // CN sources use their own base
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/mysekai/thumbnail/material/${iconAssetbundleName}.png`;
    }
    if (source === "snowyassets") {
        return `${ASSET_BASE_URL_SNOWY}/ondemand/mysekai/thumbnail/material/${iconAssetbundleName}.png`;
    }
    // Default to Haruki for MySEKAI as Uni doesn't have these
    return `${ASSET_BASE_URL_HARUKI}/ondemand/mysekai/thumbnail/material/${iconAssetbundleName}.png`;
}

// ==================== Character Asset URLs ====================

// Character trim image (main display image)
export function getCharacterTrimUrl(characterId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/character_trim/chr_trim_${characterId}.png`;
}

// Character horizontal label
export function getCharacterLabelHUrl(characterId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/label/chr_h_lb_${characterId}.png`;
}

// Character vertical label
export function getCharacterLabelVUrl(characterId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/label_vertical/chr_v_lb_${characterId}.png`;
}

// Character select thumbnail (for list view)
export function getCharacterSelectUrl(characterId: number, source: AssetSourceType = "uni"): string {
    const baseUrl = getAssetBaseUrl(source);
    return `${baseUrl}/startapp/character/character_select/chr_tl_${characterId}.png`;
}

// ==================== Honor/Degree Asset URLs ====================

// Honor background image (degree_main or degree_sub)
export function getHonorBgUrl(assetbundleName: string, sub: boolean = false, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    return `${baseUrl}/startapp/honor/${assetbundleName}/degree_${sub ? "sub" : "main"}.png`;
}

// Honor frame image (generic frames by rarity)
export function getHonorFrameUrl(rarity: string, sub: boolean = false, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    const rarityMap: Record<string, number> = { low: 1, middle: 2, high: 3, highest: 4 };
    const num = rarityMap[rarity] || 1;
    const size = sub ? "s" : "m";
    return `${baseUrl}/startapp/honor/frame/frame_degree_${size}_${num}.png`;
}

// Honor custom frame (for specific honor groups like birthday)
export function getHonorCustomFrameUrl(frameName: string, rarity: string, sub: boolean = false, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    const rarityMap: Record<string, number> = { low: 1, middle: 2, high: 3, highest: 4 };
    const num = rarityMap[rarity] || 1;
    const size = sub ? "s" : "m";
    return `${baseUrl}/startapp/honor_frame/${frameName}/frame_degree_${size}_${num}.png`;
}

// Honor rank/scroll overlay image
export function getHonorRankUrl(assetbundleName: string, type: "rank" | "scroll", sub: boolean = false, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    const suffix = type === "rank" ? `rank_${sub ? "sub" : "main"}` : "scroll";
    return `${baseUrl}/startapp/honor/${assetbundleName}/${suffix}.png`;
}

// Honor rank match background
export function getHonorRankMatchBgUrl(assetbundleName: string, sub: boolean = false, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    return `${baseUrl}/startapp/rank_live/honor/${assetbundleName}/degree_${sub ? "sub" : "main"}.png`;
}

// Bonds honor word image
export function getBondsHonorWordUrl(assetbundleName: string, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    return `${baseUrl}/startapp/bonds_honor/word/${assetbundleName}_01.png`;
}

// Bonds honor character SD image
export function getBondsHonorCharacterUrl(characterId: number, source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    const paddedId = String(characterId).padStart(2, "0");
    return `${baseUrl}/startapp/bonds_honor/character/chr_sd_${paddedId}_01.png`;
}

// Honor degree level icon
export function getHonorLevelIconUrl(source: AssetSourceType = "snowyassets"): string {
    const baseUrl = getAssetBaseUrl(isCnSource(source) ? source : (source === "uni" ? "snowyassets" : source));
    return `${baseUrl}/startapp/honor/frame/icon_degreeLv.png`;
}

// ==================== Story/Scenario Asset URLs ====================

// Get scenario JSON URL (uses /ondemand/ and .json extension)
// Rule: Use Snowy or Uni. Haruki source defaults to Snowy. CN sources use their own.
export function getScenarioJsonUrl(scenarioPath: string, source: AssetSourceType = "uni"): string {
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/${scenarioPath}.json`;
    }
    let targetSource = source;
    if (source === "haruki") {
        targetSource = "snowyassets";
    }
    const baseUrl = getAssetBaseUrl(targetSource);
    // scenarioPath format: event_story/{assetbundleName}/scenario/{scenarioId}
    return `${baseUrl}/ondemand/${scenarioPath}.json`;
}

// Get scenario background image URL (uses /ondemand/ and .png extension)
// Rule: Use Snowy or Haruki. Uni source defaults to Haruki. CN sources use their own.
export function getBackgroundImageUrl(bgName: string, source: AssetSourceType = "uni"): string {
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/scenario/background/${bgName}/${bgName}.png`;
    }
    let targetSource = source;
    if (source === "uni") {
        targetSource = "haruki";
    }
    const baseUrl = getAssetBaseUrl(targetSource);
    return `${baseUrl}/ondemand/scenario/background/${bgName}/${bgName}.png`;
}

// Get story voice URL (audio only on Haruki/Snowy, not Uni)
// Rule: Use Snowy or Haruki. Uni source defaults to Haruki. CN sources use their own.
export function getStoryVoiceUrl(scenarioId: string, voiceId: string, source: AssetSourceType = "uni"): string {
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/sound/scenario/voice/${scenarioId}/${voiceId}.mp3`;
    }
    const baseUrl = source === "snowyassets" ? ASSET_BASE_URL_SNOWY : ASSET_BASE_URL_HARUKI;
    return `${baseUrl}/ondemand/sound/scenario/voice/${scenarioId}/${voiceId}.mp3`;
}

// Get story BGM URL (audio only on Haruki/Snowy)
// Rule: Use Snowy or Haruki. Uni source defaults to Haruki. CN sources use their own.
export function getStoryBgmUrl(bgmName: string, source: AssetSourceType = "uni"): string {
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/sound/scenario/bgm/${bgmName}/${bgmName}.mp3`;
    }
    const baseUrl = source === "snowyassets" ? ASSET_BASE_URL_SNOWY : ASSET_BASE_URL_HARUKI;
    return `${baseUrl}/ondemand/sound/scenario/bgm/${bgmName}/${bgmName}.mp3`;
}

// Get story sound effect URL (audio only on Haruki/Snowy)
// Rule: Use Snowy or Haruki. Uni source defaults to Haruki. CN sources use their own.
export function getStorySoundEffectUrl(seName: string, source: AssetSourceType = "uni"): string {
    if (isCnSource(source)) {
        const baseUrl = getAssetBaseUrl(source);
        return `${baseUrl}/ondemand/sound/scenario/se/${seName}.mp3`;
    }
    const baseUrl = source === "snowyassets" ? ASSET_BASE_URL_SNOWY : ASSET_BASE_URL_HARUKI;
    return `${baseUrl}/ondemand/sound/scenario/se/${seName}.mp3`;
}

// Get story episode image URL
// Rule: Use Snowy assets. CN sources use CN Snowy.
export function getStoryEpisodeImageUrl(assetbundleName: string, episodeNo: number, source: AssetSourceType = "snowyassets"): string {
    const paddedNo = episodeNo.toString().padStart(2, "0");
    const baseUrl = isCnSource(source) ? ASSET_BASE_URL_SNOWY_CN : ASSET_BASE_URL_SNOWY;
    return `${baseUrl}/ondemand/event_story/${assetbundleName}/episode_image/${assetbundleName}_${paddedNo}.png`;
}
