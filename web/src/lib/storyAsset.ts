/**
 * Story Asset Loader
 * Fetches story scenario JSON from the MoeSekai-Hub mirror.
 *
 * Single source, language-based:
 *   https://moe.exmeaning.com/story_assets/pjsk-jp-assets/  (JP)
 *   https://moe.exmeaning.com/story_assets/pjsk-cn-assets/  (CN)
 *
 * Path suffix matches haruki's post-startapp/ondemand structure.
 * Files are raw brotli-compressed JSON, decompressed via brotli-dec-wasm.
 */

import { IScenarioData } from "@/types/story";
import brotliPromise from "brotli-dec-wasm";

const MIRROR_BASE = "https://moe.exmeaning.com/story_assets/";

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
    const base = `${MIRROR_BASE}pjsk-${lang}-assets/`;
    switch (type) {
        case "unit":
            return `${base}scenario/unitstory/${params.assetbundleName}/${params.scenarioId}.asset.br`;
        case "event":
            return `${base}event_story/${params.assetbundleName}/scenario/${params.scenarioId}.asset.br`;
        case "card":
            return `${base}character/member/${params.assetbundleName}/${params.scenarioId}.asset.br`;
        case "talk":
            return `${base}scenario/actionset/group${params.group}/${params.scenarioId}.asset.br`;
        case "self":
            return `${base}scenario/profile/${params.scenarioId}.asset.br`;
        case "special":
            return `${base}scenario/special/${params.assetbundleName}/${params.scenarioId}.asset.br`;
    }
}

// ── Brotli decompression ──────────────────────────────────────────────────────

async function decompressBrotli(buffer: ArrayBuffer): Promise<IScenarioData> {
    const brotli = await brotliPromise;
    const compressed = new Uint8Array(buffer);
    const decompressed = brotli.decompress(compressed);
    const text = new TextDecoder().decode(decompressed);
    return JSON.parse(text) as IScenarioData;
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
            return decompressBrotli(await res.arrayBuffer());
        }
    } catch {
        // network error
    }

    // Strip MIRROR_BASE prefix for display
    const displayPath = url.replace(MIRROR_BASE, "");
    throw new StoryAssetMissingError([displayPath]);
}
