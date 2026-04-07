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
