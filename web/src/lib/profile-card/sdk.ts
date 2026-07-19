// Profile Card Workshop — data layer.
//
// Rendering is powered by the open-source allium-renderer / sekai-custom-profile-sdk
// by empty-sekai: https://github.com/empty-sekai/allium-renderer
// The resource-descriptor → URL mapping below follows the SDK demo's reference
// provider (crates/allium-renderer-wasm/demo/workbench/emptySekaiResourceProvider.js).

import type { ResourceDescriptor, ResourceProvider } from "@empty-sekai/sekai-custom-profile-sdk";

export const PROFILE_CARD_REPO_URL = "https://github.com/empty-sekai/allium-renderer";
export const PROFILE_CARD_SDK_NAME = "@empty-sekai/sekai-custom-profile-sdk";

export type ProfileCardServer = "cn" | "tw" | "kr" | "en";
export const PROFILE_CARD_SERVERS: ProfileCardServer[] = ["cn", "tw", "kr", "en"];

const PROFILE_API_BASE = "https://baijing.exmeaning.com/api";
const CDN_ORIGIN = "https://cdn.emptysekai.com";
const STATIC_BASE = `${CDN_ORIGIN}/renderer-static/v0.2`;

// SDK worker/wasm artifacts are copied into public/ at build time
// (scripts/copy-profile-card-sdk.mjs) so the worker loads outside the bundler.
export const SDK_PUBLIC_BASE = "/profile-card-sdk";
export const SDK_ASSET_VERSION = "0.3.0";

export function getProfileUrl(server: ProfileCardServer, uid: string) {
    return `${PROFILE_API_BASE}/${server}/${encodeURIComponent(uid)}/profile`;
}

export function getMasterdataBase(server: ProfileCardServer) {
    return `${CDN_ORIGIN}/masterdata/${server}/latest`;
}

export function getAssetBase(server: ProfileCardServer) {
    return `${CDN_ORIGIN}/assets/${server}`;
}

// Logical font families used by masterdata per region; alias map mirrors the SDK
// demo so one uploaded file covers both the JP family name and its CN counterpart.
export const FONT_FAMILY_ALIASES: ReadonlyMap<string, readonly string[]> = new Map([
    ["FOT-RodinNTLGPro-DB", ["FOT-RodinNTLGPro-DB", "FZLanTingHei-DB-GBK"]],
    ["FOT-SkipProN-B", ["FOT-SkipProN-B", "FZZhengHei-EB-GBK"]],
    ["FOT-PopHappinessStd-EB", ["FOT-PopHappinessStd-EB", "FZShaoEr-M11-JF"]],
]);

export function defaultFontFamilies(fileName: string): string[] {
    const stem = String(fileName).replace(/\.(?:ttf|otf)$/i, "");
    return [...(FONT_FAMILY_ALIASES.get(stem) ?? [stem])];
}

export interface UserCustomProfileCardEntry {
    customProfileCardId?: number | string;
    seq?: number;
    customProfileCard?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ProfileCardProfile {
    userCustomProfileCards?: UserCustomProfileCardEntry[];
    [key: string]: unknown;
}

export interface ProfileCardPage {
    card: Record<string, unknown>;
    cardId: number | string | null;
    seq: number;
    documentKey: string;
}

export function normalizeProfilePages(profile: ProfileCardProfile): ProfileCardPage[] {
    const entries = profile?.userCustomProfileCards;
    if (!Array.isArray(entries) || entries.length === 0) return [];
    return entries
        .filter((entry): entry is UserCustomProfileCardEntry => Boolean(entry) && typeof entry === "object")
        .map((entry, index) => {
            const card = (entry.customProfileCard ?? entry) as Record<string, unknown>;
            const seq = Number.isFinite(entry.seq) ? Number(entry.seq) : index + 1;
            const cardId = entry.customProfileCardId ?? (card.id as number | string | undefined) ?? null;
            return { card, cardId, seq, documentKey: `profile-card-${cardId ?? index}` };
        })
        .sort((a, b) => a.seq - b.seq);
}

const ROOT_ASSET_PREFIXES = [
    "ugc/editor_image/",
    "ugc/avatar/",
    "uploads/editor_image/",
    "uploads/avatar/",
    "presets/",
];

function stripPng(key: string) {
    return key.replace(/\.png$/i, "");
}

function encodePath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
}

function gameAssetObjectPath(key: string, region: string) {
    if (ROOT_ASSET_PREFIXES.some((prefix) => key.startsWith(prefix))) return key;
    const normalized = stripPng(key);
    const character = normalized.match(/^bonds_honor\/chr_sd_(.+)$/);
    if (character) {
        const name = `chr_sd_${character[1]}`;
        return `assets/${region}/bonds_honor/character/${name}/${name}.png`;
    }
    const word = normalized.match(/^bonds_honor\/word\/(.+)$/);
    if (word) return `assets/${region}/bonds_honor/word/${word[1]}/${word[1]}.png`;
    return `assets/${region}/${normalized}.png`;
}

export function resourceUrl(resource: ResourceDescriptor, server: ProfileCardServer): string {
    const rawKey = String(resource.key).replace(/^\/+/, "");
    if (resource.namespace === "static") {
        return `${STATIC_BASE}/${encodePath(stripPng(rawKey))}.png`;
    }
    if (resource.namespace !== "assets") {
        throw new Error(`unsupported resource namespace ${resource.namespace}`);
    }
    const objectPath = gameAssetObjectPath(rawKey, server);
    const standardPrefix = `assets/${server}/`;
    if (objectPath.startsWith(standardPrefix)) {
        return `${getAssetBase(server)}/${encodePath(objectPath.slice(standardPrefix.length))}`;
    }
    return `${CDN_ORIGIN}/${encodePath(objectPath)}`;
}

export function createResourceProvider(server: ProfileCardServer): ResourceProvider {
    return {
        cacheIdentity(resource) {
            return resourceUrl(resource, server);
        },
        async provide(resource, context) {
            const response = await fetch(resourceUrl(resource, server), {
                cache: "default",
                signal: context.signal,
            });
            if (!response.ok) throw new Error(`resource fetch failed ${response.status}`);
            return { source: await response.blob() };
        },
    };
}
