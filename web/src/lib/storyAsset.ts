/**
 * Story Asset Loader
 * Fetches story scenario JSON from the storage mirror.
 *
 * Base URLs:
 *   https://storage.exmeaning.com/sekai-jp-assets/  (JP)
 *   https://storage.exmeaning.com/sekai-cn-assets/  (CN)
 *
 * Files are direct JSON, no decompression needed.
 */

import { IScenarioData } from "@/types/story";
import { ASSET_DOMAIN_MAIN } from "./assets";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StoryAssetType = "unit" | "event" | "card" | "talk" | "self" | "special";

export interface AssetParams {
    scenarioId: string;
    assetbundleName?: string; // required for unit/event/card/special
    group?: number;           // required for talk: Math.floor(actionSetId / 100)
}

export class StoryAssetMissingError extends Error {
    public readonly missingPaths: string[];
    constructor(missingPaths: string[]) {
        super("Story asset not found in mirror");
        this.name = "StoryAssetMissingError";
        this.missingPaths = missingPaths;
    }
}

// ── Path builder ──────────────────────────────────────────────────────────────

function buildPath(type: StoryAssetType, lang: "jp" | "cn", params: AssetParams): string {
    const base = `${ASSET_DOMAIN_MAIN}/sekai-${lang}-assets/`;
    switch (type) {
        case "unit":
            return `${base}scenario/unitstory/${params.assetbundleName}/${params.scenarioId}.json`;
        case "event":
            return `${base}event_story/${params.assetbundleName}/scenario/${params.scenarioId}.json`;
        case "card":
            return `${base}character/member/${params.assetbundleName}/${params.scenarioId}.json`;
        case "talk":
            return `${base}scenario/actionset/group${params.group}/${params.scenarioId}.json`;
        case "self":
            return `${base}scenario/profile/${params.scenarioId}.json`;
        case "special":
            return `${base}scenario/special/${params.assetbundleName}/${params.scenarioId}.json`;
    }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchStoryAssetFromMirror(
    type: StoryAssetType,
    lang: "jp" | "cn",
    params: AssetParams
): Promise<IScenarioData> {
    const url = buildPath(type, lang, params);
    try {
        const res = await fetch(url);
        if (res.ok) {
            return await res.json() as IScenarioData;
        }
    } catch {
        // network error
    }

    // Strip ASSET_DOMAIN_MAIN prefix for display
    const displayPath = url.replace(ASSET_DOMAIN_MAIN + "/", "");
    throw new StoryAssetMissingError([displayPath]);
}
