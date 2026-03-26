/**
 * Metadata Map Generator Script
 * 
 * 在 CI/构建阶段从远程 master API 拉取数据，
 * 提取每个实体的 SEO 所需最小字段，生成 metadata-map.json。
 * 运行时 generateMetadata 从本地文件读取，零网络请求。
 * 
 * 使用方法: node scripts/generate-metadata-map.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_URL = process.env.MASTER_DATA_URL || 'https://sekaimaster.exmeaning.com/master';
const MANGA_URL = 'https://moe.exmeaning.com/mangas/mangas.json';
const OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'metadata-map.json');

/**
 * Fetch JSON with error handling
 */
async function fetchJSON(url, label) {
    console.log(`  Fetching ${label}...`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${label}: HTTP ${response.status}`);
    }
    const data = await response.json();
    const size = JSON.stringify(data).length;
    console.log(`    ✓ ${label} (${(size / 1024 / 1024).toFixed(2)} MB raw)`);
    return data;
}

/**
 * Fetch with graceful fallback (for optional data sources)
 */
async function fetchJSONOptional(url, label, fallback) {
    try {
        return await fetchJSON(url, label);
    } catch (error) {
        console.warn(`    ⚠ ${label} failed: ${error.message}, using fallback`);
        return fallback;
    }
}

async function main() {
    console.log('=== Metadata Map Generator ===\n');
    console.log(`Master API: ${MASTER_URL}`);
    console.log(`Output: ${OUT_FILE}\n`);

    // Fetch all data in parallel
    console.log('Fetching master data...');
    const [cards, musics, events, gachas, characters, virtualLives, costumesRaw, fixtures, mangasRaw] =
        await Promise.all([
            fetchJSON(`${MASTER_URL}/cards.json`, 'cards'),
            fetchJSON(`${MASTER_URL}/musics.json`, 'musics'),
            fetchJSON(`${MASTER_URL}/events.json`, 'events'),
            fetchJSON(`${MASTER_URL}/gachas.json`, 'gachas'),
            fetchJSON(`${MASTER_URL}/gameCharacters.json`, 'characters'),
            fetchJSON(`${MASTER_URL}/virtualLives.json`, 'virtualLives'),
            fetchJSONOptional(`${MASTER_URL}/moe_costume.json`, 'costumes', { costumes: [] }),
            fetchJSONOptional(`${MASTER_URL}/mysekaiFixtures.json`, 'fixtures', []),
            fetchJSONOptional(MANGA_URL, 'mangas', {}),
        ]);

    // Build metadata map — only extract fields needed for SEO
    console.log('\nBuilding metadata map...');

    const map = {
        cards: Object.fromEntries(
            (Array.isArray(cards) ? cards : []).map(c => [c.id, {
                prefix: c.prefix,
                characterId: c.characterId,
                rarity: c.cardRarityType,
                attr: c.attr,
                asset: c.assetbundleName,
            }])
        ),
        musics: Object.fromEntries(
            (Array.isArray(musics) ? musics : []).map(m => [m.id, {
                title: m.title,
                lyricist: m.lyricist,
                composer: m.composer,
                asset: m.assetbundleName,
            }])
        ),
        events: Object.fromEntries(
            (Array.isArray(events) ? events : []).map(e => [e.id, {
                name: e.name,
                type: e.eventType,
                asset: e.assetbundleName,
            }])
        ),
        gachas: Object.fromEntries(
            (Array.isArray(gachas) ? gachas : []).map(g => [g.id, {
                name: g.name,
                type: g.gachaType,
                asset: g.assetbundleName,
            }])
        ),
        characters: Object.fromEntries(
            (Array.isArray(characters) ? characters : []).map(c => [c.id, {
                name: `${c.firstName}${c.givenName}`,
            }])
        ),
        virtualLives: Object.fromEntries(
            (Array.isArray(virtualLives) ? virtualLives : []).map(v => [v.id, {
                name: v.name,
                asset: v.assetbundleName,
            }])
        ),
        costumes: Object.fromEntries(
            (costumesRaw?.costumes || []).map(c => [c.costumeNumber, {
                name: c.name,
            }])
        ),
        mysekaiFixtures: Object.fromEntries(
            (Array.isArray(fixtures) ? fixtures : []).map(f => [f.id, {
                name: f.name,
                flavor: f.flavorText || '',
                asset: f.assetbundleName,
            }])
        ),
        mangas: Object.fromEntries(
            Object.entries(mangasRaw || {}).map(([k, v]) => [k, {
                title: v.title || '',
            }])
        ),
    };

    // Count entries
    const counts = Object.entries(map).map(([key, val]) => `${key}: ${Object.keys(val).length}`);
    console.log(`  Entries: ${counts.join(', ')}`);

    // Write output
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(map), 'utf-8');

    const fileSize = fs.statSync(OUT_FILE).size;
    console.log(`\n✓ Generated metadata-map.json (${(fileSize / 1024).toFixed(1)} KB)`);
    console.log('\n=== Metadata map generation complete! ===');
}

main().catch(error => {
    console.error('\nFatal error:', error);
    process.exit(1);
});
