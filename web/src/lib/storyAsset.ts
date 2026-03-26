/**
 * Story Asset Loader
 * Fetches story scenario JSON from the MoeSekai-Hub mirror.
 * Priority: haruki → sekai.best (fallback)
 *
 * Mirror base: https://moe.exmeaning.com/story_assets/
 * Files are stored as {original_url_without_https}.br
 * File content is brotli-compressed JSON (NOT Content-Encoding, raw binary).
 * We decompress with brotli-dec-wasm.
 */

import { IScenarioData } from "@/types/story";
import brotliPromise from "brotli-dec-wasm";

const MIRROR_BASE = "https://moe.exmeaning.com/story_assets/";

// ── Path builders (matching urls_pjsk.json exactly) ──────────────────────────

function harukiPath(type: StoryAssetType, lang: "jp" | "cn", params: AssetParams): string {
    const l = lang === "cn" ? "cn-" : "jp-";
    switch (type) {
        case "unit":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/startapp/scenario/unitstory/${params.assetbundleName}/${params.scenarioId}.asset`;
        case "event":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/ondemand/event_story/${params.assetbundleName}/scenario/${params.scenarioId}.asset`;
        case "card":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/startapp/character/member/${params.assetbundleName}/${params.scenarioId}.asset`;
        case "talk":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/startapp/scenario/actionset/group${params.group}/${params.scenarioId}.asset`;
        case "self":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/startapp/scenario/profile/${params.scenarioId}.asset`;
        case "special":
            return `sekai-assets-bdf29c81.seiunx.net/${l}assets/startapp/scenario/special/${params.assetbundleName}/${params.scenarioId}.asset`;
    }
}

function sekaiPath(type: StoryAssetType, lang: "jp" | "cn", params: AssetParams): string {
    const l = lang === "cn" ? "cn-" : "jp-";
    switch (type) {
        case "unit":
            return `storage.sekai.best/sekai-${l}assets/scenario/unitstory/${params.assetbundleName}/${params.scenarioId}.asset`;
        case "event":
            return `storage.sekai.best/sekai-${l}assets/event_story/${params.assetbundleName}/scenario/${params.scenarioId}.asset`;
        case "card":
            return `storage.sekai.best/sekai-${l}assets/character/member/${params.assetbundleName}/${params.scenarioId}.asset`;
        case "talk":
            return `storage.sekai.best/sekai-${l}assets/scenario/actionset/group${params.group}/${params.scenarioId}.asset`;
        case "self":
            return `storage.sekai.best/sekai-${l}assets/scenario/profile/${params.scenarioId}.asset`;
        case "special":
            return `storage.sekai.best/sekai-${l}assets/scenario/special/${params.assetbundleName}/${params.scenarioId}.asset`;
    }
}

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

// ── Brotli decompression ──────────────────────────────────────────────────────

async function decompressBrotli(buffer: ArrayBuffer): Promise<IScenarioData> {
    const brotli = await brotliPromise;
    const compressed = new Uint8Array(buffer);
    const decompressed = brotli.decompress(compressed);
    const text = new TextDecoder().decode(decompressed);
    return JSON.parse(text) as IScenarioData;
}

// ── Fetch one URL, return null if 404/error ───────────────────────────────────

async function tryFetch(url: string): Promise<ArrayBuffer | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.arrayBuffer();
    } catch {
        return null;
    }
}

// ── Main fetch function ───────────────────────────────────────────────────────

/**
 * Fetch a story scenario asset from the mirror.
 * Tries haruki first, falls back to sekai.best.
 * Decompresses brotli in-browser via brotli-dec-wasm.
 *
 * Throws StoryAssetMissingError (with both paths) if both sources fail.
 */
export async function fetchStoryAssetFromMirror(
    type: StoryAssetType,
    lang: "jp" | "cn",
    params: AssetParams
): Promise<IScenarioData> {
    const primaryPath = harukiPath(type, lang, params);
    const fallbackPath = sekaiPath(type, lang, params);

    const primaryUrl = `${MIRROR_BASE}${primaryPath}.br`;
    const fallbackUrl = `${MIRROR_BASE}${fallbackPath}.br`;

    // Try haruki mirror first
    const primaryBuf = await tryFetch(primaryUrl);
    if (primaryBuf !== null) {
        return decompressBrotli(primaryBuf);
    }

    // Fallback to sekai.best mirror
    const fallbackBuf = await tryFetch(fallbackUrl);
    if (fallbackBuf !== null) {
        return decompressBrotli(fallbackBuf);
    }

    // Both failed — throw with the missing paths for display
    throw new StoryAssetMissingError([primaryPath + ".br", fallbackPath + ".br"]);
}
