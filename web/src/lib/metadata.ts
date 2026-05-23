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

// ==================== Type Definitions ====================

export interface CardMeta {
    prefix: string;
    characterId: number;
    rarity: string;
    attr: string;
    asset: string;
}

export interface MusicMeta {
    title: string;
    lyricist: string;
    composer: string;
    asset: string;
}

export interface EventMeta {
    name: string;
    type: string;
    asset: string;
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

// ==================== Process-level Cache ====================

let cached: MetadataMap | null = null;

function getMap(): MetadataMap | null {
    if (cached) return cached;
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'metadata-map.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        cached = JSON.parse(raw);
        return cached;
    } catch {
        // File not found or parse error — degrade gracefully
        return null;
    }
}

// ==================== Public Accessors ====================

export function getCardMeta(id: number): CardMeta | null {
    return getMap()?.cards[String(id)] ?? null;
}

export function getMusicMeta(id: number): MusicMeta | null {
    return getMap()?.musics[String(id)] ?? null;
}

export function getEventMeta(id: number): EventMeta | null {
    return getMap()?.events[String(id)] ?? null;
}

export function getGachaMeta(id: number): GachaMeta | null {
    return getMap()?.gachas[String(id)] ?? null;
}

export function getCharacterMeta(id: number): CharacterMeta | null {
    return getMap()?.characters[String(id)] ?? null;
}

export function getVirtualLiveMeta(id: number): VirtualLiveMeta | null {
    return getMap()?.virtualLives[String(id)] ?? null;
}

export function getCostumeMeta(id: number): CostumeMeta | null {
    return getMap()?.costumes[String(id)] ?? null;
}

export function getFixtureMeta(id: number): FixtureMeta | null {
    return getMap()?.mysekaiFixtures[String(id)] ?? null;
}

export function getMangaMeta(id: number): MangaMeta | null {
    return getMap()?.mangas[String(id)] ?? null;
}

export function getExchangeMeta(id: number): ExchangeMeta | null {
    return getMap()?.exchanges[String(id)] ?? null;
}

export function getGuideMeta(id: string): GuideMeta | null {
    return getMap()?.guides?.[id] ?? null;
}

export function getStoryEventGroupMeta(id: string | number): StoryEventGroupMeta | null {
    return getMap()?.storyEventGroups?.[String(id)] ?? null;
}

export function getStoryEventEpisodeMeta(eventId: string | number, episodeNo: string | number): StoryEventEpisodeMeta | null {
    return getMap()?.storyEventEpisodes?.[`${eventId}/${episodeNo}`] ?? null;
}

export function getStoryUnitGroupMeta(unitId: string | number): StoryUnitGroupMeta | null {
    return getMap()?.storyUnitGroups?.[String(unitId)] ?? null;
}

export function getStoryUnitEpisodeMeta(unitId: string | number, episodeId: string): StoryUnitEpisodeMeta | null {
    return getMap()?.storyUnitEpisodes?.[`${unitId}/${episodeId}`] ?? null;
}

export function getStoryCardReaderMeta(cardId: string | number): StoryCardReaderMeta | null {
    return getMap()?.storyCardReaders?.[String(cardId)] ?? null;
}

export function getStorySelfReaderMeta(charaId: string | number): StorySelfReaderMeta | null {
    return getMap()?.storySelfReaders?.[String(charaId)] ?? null;
}

export function getStorySpecialReaderMeta(spId: string | number): StorySpecialReaderMeta | null {
    return getMap()?.storySpecialReaders?.[String(spId)] ?? null;
}

export function getStoryAreaCategoryMeta(category: string): StoryAreaCategoryMeta | null {
    return getMap()?.storyAreaCategories?.[category] ?? null;
}

export function getStoryAreaReaderMeta(category: string, scenarioId: string): StoryAreaReaderMeta | null {
    return getMap()?.storyAreaReaders?.[`${category}/${scenarioId}`] ?? null;
}
