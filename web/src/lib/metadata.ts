/**
 * Server-side metadata reader for SEO.
 * 
 * Reads the pre-generated metadata-map.json (built during CI) from disk.
 * Process-level cache ensures the file is read only once per Node.js process lifetime.
 * Zero network requests at runtime.
 * 
 * This module uses `fs` and must only be imported in Server Components / generateMetadata.
 */

import fs from 'fs';
import path from 'path';

import type {
    CardMeta,
    CardPowerItem,
    CardPowerMeta,
    CardEventMeta,
} from "@/types/types";

import type { MusicMeta } from "@/types/music";

export type {
    CardMeta,
    CardPowerItem,
    CardPowerMeta,
    CardEventMeta,
    MusicMeta,
};

export interface EventMeta {
    name: string;
    type: string;
    asset: string;
    startAt?: number | string;
    endAt?: number | string;
}

export interface GachaMeta {
    name: string;
    type: string;
    asset: string;
}

export interface CharacterMeta {
    name: string;
}

export interface VirtualLiveMeta {
    name: string;
    asset: string;
    startAt?: number | string;
    endAt?: number | string;
}

export interface CostumeMeta {
    name: string;
}

export interface FixtureMeta {
    name: string;
    flavor: string;
    asset: string;
}

export interface MangaMeta {
    title: string;
}

export interface ExchangeMeta {
    name: string;
    summaryName: string;
    category: string;
    type: string;
}

export interface GuideMeta {
    title: string;
    category: string;
    tags: string[];
    date: string;
    authorGroup: string;
}

export interface StoryEventGroupMeta {
    name: string;
    asset: string;
    episodeCount: number;
    firstEpisodeTitle: string;
}

export interface StoryEventEpisodeMeta {
    eventName: string;
    episodeTitle: string;
    episodeNo: number;
    asset: string;
}

export interface StoryUnitGroupMeta {
    unitName: string;
    unit: string;
    episodeCount: number;
}

export interface StoryUnitEpisodeMeta {
    unitName: string;
    unit: string;
    episodeTitle: string;
    episodeNoLabel: string;
}

export interface StoryCardReaderMeta {
    cardPrefix: string;
    characterName: string;
    asset: string;
    characterId: number;
}

export interface StorySelfReaderMeta {
    characterName: string;
    characterId: number;
}

export interface StorySpecialReaderMeta {
    title: string;
    episodeCount: number;
}

export interface StoryAreaCategoryMeta {
    label: string;
    count: number;
}

export interface StoryAreaReaderMeta {
    areaName: string;
    scenarioId: string;
}

interface MetadataMap {
    cards: Record<string, CardMeta>;
    musics: Record<string, MusicMeta>;
    events: Record<string, EventMeta>;
    gachas: Record<string, GachaMeta>;
    characters: Record<string, CharacterMeta>;
    virtualLives: Record<string, VirtualLiveMeta>;
    costumes: Record<string, CostumeMeta>;
    mysekaiFixtures: Record<string, FixtureMeta>;
    mangas: Record<string, MangaMeta>;
    exchanges: Record<string, ExchangeMeta>;
    guides?: Record<string, GuideMeta>;
    storyEventGroups?: Record<string, StoryEventGroupMeta>;
    storyEventEpisodes?: Record<string, StoryEventEpisodeMeta>;
    storyUnitGroups?: Record<string, StoryUnitGroupMeta>;
    storyUnitEpisodes?: Record<string, StoryUnitEpisodeMeta>;
    storyCardReaders?: Record<string, StoryCardReaderMeta>;
    storySelfReaders?: Record<string, StorySelfReaderMeta>;
    storySpecialReaders?: Record<string, StorySpecialReaderMeta>;
    storyAreaCategories?: Record<string, StoryAreaCategoryMeta>;
    storyAreaReaders?: Record<string, StoryAreaReaderMeta>;
}

export const METADATA_REGIONS = ['cn', 'jp', 'tw', 'en', 'kr'] as const;
export type MetadataRegion = (typeof METADATA_REGIONS)[number];

// ==================== Process-level Cache ====================

const cache = new Map<MetadataRegion, MetadataMap | null>();

function getMap(region: MetadataRegion = 'cn'): MetadataMap | null {
    const normalizedRegion = METADATA_REGIONS.includes(region) ? region : 'cn';
    if (cache.has(normalizedRegion)) return cache.get(normalizedRegion) ?? null;
    try {
        const dataDir = path.join(process.cwd(), 'public', 'data');
        const regionalPath = path.join(dataDir, `metadata-map.${normalizedRegion}.json`);
        const filePath = fs.existsSync(regionalPath)
            ? regionalPath
            : normalizedRegion === 'jp'
                ? path.join(dataDir, 'metadata-map.json')
                : regionalPath;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as MetadataMap;
        cache.set(normalizedRegion, parsed);
        return parsed;
    } catch {
        // File not found or parse error — degrade gracefully
        cache.set(normalizedRegion, null);
        return null;
    }
}

// ==================== Public Accessors ====================

export function getCardMeta(id: number, region?: MetadataRegion): CardMeta | null {
    const regional = getMap(region)?.cards[String(id)];
    if (regional) {
        return { ...regional, isJpFallback: false };
    }
    if (region && region !== 'jp') {
        const jpCard = getMap('jp')?.cards[String(id)];
        if (jpCard) {
            return { ...jpCard, isJpFallback: true };
        }
    }
    return null;
}

export function getMusicMeta(id: number, region?: MetadataRegion): MusicMeta | null {
    // 1. Check if ID exists in JP canonical pool
    const jpMusic = getMap('jp')?.musics[String(id)];
    if (!jpMusic) {
        // ID is NOT in JP. This means it is a region-exclusive song (EN, CN, KR, Global exclusive).
        // Per architecture rule: region-exclusive / conflicting IDs bypass SSR pre-rendering (initialData = null)
        // and delegate cleanly to client-side CSR with multi-server detection.
        return null;
    }

    // 2. If region is specified (e.g. 'cn', 'en', etc.) and not 'jp':
    if (region && region !== 'jp') {
        const regional = getMap(region)?.musics[String(id)];
        if (regional) {
            return { ...regional, isJpFallback: false };
        }
        // Song is in JP canonical pool, but not yet released in this region -> JP advance!
        return { ...jpMusic, isJpFallback: true };
    }

    // 3. Region is 'jp' or default
    return { ...jpMusic, isJpFallback: false };
}

export function getEventMeta(id: number, region?: MetadataRegion): EventMeta | null {
    return getMap(region)?.events[String(id)] ?? null;
}

export function getGachaMeta(id: number, region?: MetadataRegion): GachaMeta | null {
    return getMap(region)?.gachas[String(id)] ?? null;
}

export function getCharacterMeta(id: number, region?: MetadataRegion): CharacterMeta | null {
    return getMap(region)?.characters[String(id)] ?? null;
}

export function getVirtualLiveMeta(id: number, region?: MetadataRegion): VirtualLiveMeta | null {
    return getMap(region)?.virtualLives[String(id)] ?? null;
}

export function getCostumeMeta(id: number, region?: MetadataRegion): CostumeMeta | null {
    return getMap(region)?.costumes[String(id)] ?? null;
}

export function getFixtureMeta(id: number, region?: MetadataRegion): FixtureMeta | null {
    return getMap(region)?.mysekaiFixtures[String(id)] ?? null;
}

export function getMangaMeta(id: number, region?: MetadataRegion): MangaMeta | null {
    return getMap(region)?.mangas[String(id)] ?? null;
}

export function getExchangeMeta(id: number, region?: MetadataRegion): ExchangeMeta | null {
    return getMap(region)?.exchanges[String(id)] ?? null;
}

export function getGuideMeta(id: string, region?: MetadataRegion): GuideMeta | null {
    return getMap(region)?.guides?.[id] ?? null;
}

export function getStoryEventGroupMeta(id: string | number, region?: MetadataRegion): StoryEventGroupMeta | null {
    return getMap(region)?.storyEventGroups?.[String(id)] ?? null;
}

export function getStoryEventEpisodeMeta(eventId: string | number, episodeNo: string | number, region?: MetadataRegion): StoryEventEpisodeMeta | null {
    return getMap(region)?.storyEventEpisodes?.[`${eventId}/${episodeNo}`] ?? null;
}

export function getStoryUnitGroupMeta(unitId: string | number, region?: MetadataRegion): StoryUnitGroupMeta | null {
    return getMap(region)?.storyUnitGroups?.[String(unitId)] ?? null;
}

export function getStoryUnitEpisodeMeta(unitId: string | number, episodeId: string, region?: MetadataRegion): StoryUnitEpisodeMeta | null {
    return getMap(region)?.storyUnitEpisodes?.[`${unitId}/${episodeId}`] ?? null;
}

export function getStoryCardReaderMeta(cardId: string | number, region?: MetadataRegion): StoryCardReaderMeta | null {
    return getMap(region)?.storyCardReaders?.[String(cardId)] ?? null;
}

export function getStorySelfReaderMeta(charaId: string | number, region?: MetadataRegion): StorySelfReaderMeta | null {
    return getMap(region)?.storySelfReaders?.[String(charaId)] ?? null;
}

export function getStorySpecialReaderMeta(spId: string | number, region?: MetadataRegion): StorySpecialReaderMeta | null {
    return getMap(region)?.storySpecialReaders?.[String(spId)] ?? null;
}

export function getStoryAreaCategoryMeta(category: string, region?: MetadataRegion): StoryAreaCategoryMeta | null {
    return getMap(region)?.storyAreaCategories?.[category] ?? null;
}

export function getStoryAreaReaderMeta(category: string, scenarioId: string, region?: MetadataRegion): StoryAreaReaderMeta | null {
    return getMap(region)?.storyAreaReaders?.[`${category}/${scenarioId}`] ?? null;
}
