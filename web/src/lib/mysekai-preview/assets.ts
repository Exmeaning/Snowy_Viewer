import type { AssetSourceType } from "@/contexts/ThemeContext";
import { getMysekaiRawAssetUrl } from "@/lib/assets";

export const MYSEKAI_PREVIEW_STORAGE_KEY = "mysekai_scene_preview_options_v2";
export const LOCAL_TEST_LAYOUT_URL = "/data/mysekai-preview/testmysekai.json";

const MASTER_DATA_BASE_URL_BY_REGION: Record<"jp" | "cn", string> = {
    jp: "https://sekaimaster.exmeaning.com/master",
    cn: "https://sekaimaster-cn.exmeaning.com/master",
};

export function getMysekaiCandidateRawUrls(assetPath: string, source: AssetSourceType): string[] {
    return [getMysekaiRawAssetUrl(assetPath, source)];
}

export function getMysekaiMasterDataUrls(path: string, source: AssetSourceType): string[] {
    const region = source.endsWith("-cn") ? "cn" : "jp";
    const normalizedPath = path.replace(/^\/+/, "");
    return [`${MASTER_DATA_BASE_URL_BY_REGION[region]}/${normalizedPath}`];
}

function withoutMdlPrefix(assetName: string): string {
    return assetName.replace(/^mdl_/, "");
}

function customBaseUsesPreview(assetName: string): boolean {
    const shortName = withoutMdlPrefix(assetName);
    const customPart = shortName.match(/^cst\d+_custom_(.+)$/)?.[1] || "";
    return /^bottom\d+mount\d+$/.test(customPart) || /^collection\d+board\d+$/.test(customPart);
}

function customBasePreviewTexturePath(assetName: string, textureId: number): string {
    const shortName = withoutMdlPrefix(assetName);
    const customPart = shortName.match(/^cst\d+_custom_(.+)$/)?.[1] || "";
    const suffix = /^collection\d+board\d+$/.test(customPart) ? `_preview_${textureId}` : "_preview";
    return `fixture/${assetName}/texture/tex_${shortName}${suffix}.webp`;
}

function customAttachTextureName(assetName: string): string {
    const shortName = withoutMdlPrefix(assetName);
    const match = shortName.match(/^(cst\d+)_([^_]+)_(.+)$/);
    if (!match) return shortName;
    const [, prefix, category, rest] = match;
    if (category === "attach") return `${prefix}_attach_common_${rest}`;
    if (category === "title") return `${prefix}_title_${rest}_common`;
    return shortName;
}

export function getFixtureObjectPaths(assetName: string, handleType?: string, fixtureType?: string): string[] {
    if (fixtureType === "canvas") {
        return [`fixture/${assetName}/model/${assetName}.obj`];
    }
    if (handleType === "road") {
        return [`fixture/${assetName}/mdl_non1002_way_basemodel1.obj`];
    }
    if (handleType === "fence") {
        return [
            `fixture/${assetName}/mdl_pole_center.obj`,
            `fixture/${assetName}/mdl_wing_short.obj`,
            `fixture/${assetName}/mdl_wing_long.obj`,
        ];
    }
    if (assetName.startsWith("mdl_cst0001_custom_") && customBaseUsesPreview(assetName)) {
        return [`fixture/${assetName}/preview.obj`];
    }
    return [`fixture/${assetName}/${assetName}.obj`];
}

export function getCustomFixtureAttachObjectPaths(assetName: string): string[] {
    return [`custom_fixture_attach/${assetName}/${assetName}.obj`];
}

export function getFixtureTexturePaths(assetName: string, textureId: number, handleType?: string): string[] {
    if (assetName.startsWith("mdl_cst0001_custom_") && customBaseUsesPreview(assetName)) {
        return [customBasePreviewTexturePath(assetName, textureId)];
    }
    if (handleType === "idle_timeline") {
        return [`fixture/${assetName}/texture/tex_${withoutMdlPrefix(assetName)}_body_${textureId}.webp`];
    }
    return [`fixture/${assetName}/texture/tex_${withoutMdlPrefix(assetName)}_${textureId}.webp`];
}

export function getCustomFixtureAttachTexturePaths(assetName: string, textureId: number): string[] {
    if (assetName.startsWith("mdl_cst0002_attach_logo")) {
        return [];
    }
    return [`custom_fixture_attach/${assetName}/texture/tex_${customAttachTextureName(assetName)}_${textureId}.webp`];
}

export function getRoomSkinFloorTexturePath(assetName: string, textureId: number): string {
    return `site/field/my_room_asset/skin/${assetName}/texture/tex_${assetName}_floor_floor1_uvset1_${textureId}.webp`;
}

export function getRoomSkinWallTexturePath(assetName: string, textureId: number): string {
    return `site/field/my_room_asset/skin/${assetName}/texture/tex_${assetName}_wall_wall1_uvset1_${textureId}.webp`;
}

export function getRoomSkinDoorTexturePath(assetName: string, textureId: number): string {
    return `site/field/my_room_asset/skin/${assetName}/texture/tex_${assetName}_door_door1_${textureId}.webp`;
}

export function getRoomSkinDoorObjectPaths(assetName: string): string[] {
    return [`site/field/my_room_asset/skin/${assetName}/mdl_${assetName}_door_door1.obj`];
}

export function getOutdoorGrassTexturePath(): string {
    return "site/field/grasslands/texture/tex_site_base_grasslands_grass01.webp";
}

export function getMusicJacketTexturePath(assetbundleName: string): string {
    return `thumbnail/music_jacket/${assetbundleName}.webp`;
}
