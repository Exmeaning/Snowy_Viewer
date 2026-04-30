/**
 * Metadata Map Generator Script
 *
 * 在 CI/构建阶段从远程 master API 拉取数据，
 * 提取每个实体的 SEO 所需最小字段，生成 metadata-map.json。
 * 运行时 generateMetadata 从本地文件读取，零网络请求。
 *
 * 构建环境网络可能与宿主不同；当远程数据源临时不可用时，
 * 本脚本会优先保留已存在的 metadata-map.json，避免把完整 SEO 数据覆盖为空。
 *
 * 使用方法: node scripts/generate-metadata-map.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    fetchMangaJson,
    fetchMasterJson,
    getBuildFetchConcurrency,
    getConfiguredMangaDataUrls,
    getConfiguredMasterDataUrls,
    mapWithConcurrency,
    readJsonIfExists,
    requireFreshBuildData,
} from './lib/build-fetch.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'metadata-map.json');
const REQUIRE_FRESH = requireFreshBuildData();

function countEntries(section) {
    return Object.keys(section || {}).length;
}

function shortenError(error) {
    const message = error?.message || String(error);
    return message.length > 500 ? `${message.slice(0, 500)}...` : message;
}

function existingSection(existingMap, key) {
    const section = existingMap?.[key];
    return section && typeof section === 'object' && !Array.isArray(section) ? section : null;
}

function hasUsefulMetadata(map) {
    return [
        'cards',
        'musics',
        'events',
        'gachas',
        'characters',
        'virtualLives',
    ].some(key => countEntries(map[key]) > 0);
}

const datasets = [
    {
        key: 'cards',
        label: 'cards',
        filename: 'cards.json',
        fallback: [],
        validate: Array.isArray,
        build: cards => Object.fromEntries(
            (Array.isArray(cards) ? cards : []).map(c => [c.id, {
                prefix: c.prefix,
                characterId: c.characterId,
                rarity: c.cardRarityType,
                attr: c.attr,
                asset: c.assetbundleName,
            }])
        ),
    },
    {
        key: 'musics',
        label: 'musics',
        filename: 'musics.json',
        fallback: [],
        validate: Array.isArray,
        build: musics => Object.fromEntries(
            (Array.isArray(musics) ? musics : []).map(m => [m.id, {
                title: m.title,
                lyricist: m.lyricist,
                composer: m.composer,
                asset: m.assetbundleName,
            }])
        ),
    },
    {
        key: 'events',
        label: 'events',
        filename: 'events.json',
        fallback: [],
        validate: Array.isArray,
        build: events => Object.fromEntries(
            (Array.isArray(events) ? events : []).map(e => [e.id, {
                name: e.name,
                type: e.eventType,
                asset: e.assetbundleName,
            }])
        ),
    },
    {
        key: 'gachas',
        label: 'gachas',
        filename: 'gachas.json',
        fallback: [],
        validate: Array.isArray,
        build: gachas => Object.fromEntries(
            (Array.isArray(gachas) ? gachas : []).map(g => [g.id, {
                name: g.name,
                type: g.gachaType,
                asset: g.assetbundleName,
            }])
        ),
    },
    {
        key: 'characters',
        label: 'characters',
        filename: 'gameCharacters.json',
        fallback: [],
        validate: Array.isArray,
        build: characters => Object.fromEntries(
            (Array.isArray(characters) ? characters : []).map(c => [c.id, {
                name: `${c.firstName || ''}${c.givenName || ''}`,
            }])
        ),
    },
    {
        key: 'virtualLives',
        label: 'virtualLives',
        filename: 'virtualLives.json',
        fallback: [],
        validate: Array.isArray,
        build: virtualLives => Object.fromEntries(
            (Array.isArray(virtualLives) ? virtualLives : []).map(v => [v.id, {
                name: v.name,
                asset: v.assetbundleName,
            }])
        ),
    },
    {
        key: 'costumes',
        label: 'costumes',
        filename: 'moe_costume.json',
        fallback: { costumes: [] },
        validate: data => data && Array.isArray(data.costumes),
        build: costumesRaw => Object.fromEntries(
            (costumesRaw?.costumes || []).map(c => [c.costumeNumber, {
                name: c.name,
            }])
        ),
    },
    {
        key: 'mysekaiFixtures',
        label: 'fixtures',
        filename: 'mysekaiFixtures.json',
        fallback: [],
        validate: Array.isArray,
        build: fixtures => Object.fromEntries(
            (Array.isArray(fixtures) ? fixtures : []).map(f => [f.id, {
                name: f.name,
                flavor: f.flavorText || '',
                asset: f.assetbundleName,
            }])
        ),
    },
    {
        key: 'mangas',
        label: 'mangas',
        fallback: {},
        validate: data => data && typeof data === 'object' && !Array.isArray(data),
        fetch: () => fetchMangaJson('mangas'),
        build: mangasRaw => Object.fromEntries(
            Object.entries(mangasRaw || {}).map(([k, v]) => [k, {
                title: v?.title || '',
            }])
        ),
    },
    {
        key: 'exchanges',
        label: 'exchangeSummaries',
        filename: 'materialExchangeSummaries.json',
        fallback: [],
        validate: Array.isArray,
        build: exchangeSummaries => Object.fromEntries(
            (Array.isArray(exchangeSummaries) ? exchangeSummaries : [])
                .flatMap(summary => (summary.materialExchanges || []).map(exchange => [exchange.id, {
                    name: exchange.displayName || summary.name || `兑换项 #${exchange.id}`,
                    summaryName: summary.name || '',
                    category: summary.exchangeCategory || '',
                    type: summary.materialExchangeType || '',
                }]))
        ),
    },
];

async function loadDataset(dataset, existingMap) {
    console.log(`  Fetching ${dataset.label}...`);
    const previous = existingSection(existingMap, dataset.key);
    const previousCount = countEntries(previous);

    try {
        const raw = dataset.fetch
            ? await dataset.fetch()
            : await fetchMasterJson(dataset.filename, dataset.label);

        if (dataset.validate && !dataset.validate(raw)) {
            throw new Error(`Unexpected ${dataset.label} response shape`);
        }

        const section = dataset.build(raw);
        const sectionCount = countEntries(section);

        if (sectionCount === 0) {
            if (previousCount > 0 && !REQUIRE_FRESH) {
                console.warn(`    ⚠ ${dataset.label} returned 0 entries, keeping existing ${previousCount} entries`);
                return { key: dataset.key, section: previous, source: 'existing-empty-response' };
            }
            if (REQUIRE_FRESH) {
                throw new Error(`${dataset.label} returned 0 entries`);
            }
        }

        return { key: dataset.key, section, source: 'fresh' };
    } catch (error) {
        if (REQUIRE_FRESH) {
            throw error;
        }

        if (previousCount > 0) {
            console.warn(`    ⚠ ${dataset.label} failed: ${shortenError(error)}, keeping existing ${previousCount} entries`);
            return { key: dataset.key, section: previous, source: 'existing' };
        }

        console.warn(`    ⚠ ${dataset.label} failed: ${shortenError(error)}, using empty fallback`);
        return { key: dataset.key, section: dataset.build(dataset.fallback), source: 'fallback' };
    }
}

async function main() {
    console.log('=== Metadata Map Generator ===\n');
    console.log(`Master APIs: ${getConfiguredMasterDataUrls().join(', ')}`);
    console.log(`Manga APIs: ${getConfiguredMangaDataUrls().join(', ')}`);
    console.log(`Require fresh build data: ${REQUIRE_FRESH ? 'yes' : 'no'}`);
    console.log(`Output: ${OUT_FILE}\n`);

    const existingMap = readJsonIfExists(OUT_FILE, null);
    if (existingMap) {
        const existingCounts = Object.entries(existingMap).map(([key, val]) => `${key}: ${countEntries(val)}`);
        console.log(`Existing metadata map: ${existingCounts.join(', ')}\n`);
    }

    // Fetch all data with bounded concurrency. Docker build networking can be more fragile
    // than the host, so avoid opening every remote request at the exact same time.
    console.log('Fetching master data...');
    const results = await mapWithConcurrency(
        datasets,
        getBuildFetchConcurrency(3),
        dataset => loadDataset(dataset, existingMap)
    );

    // Build metadata map — only extract fields needed for SEO
    console.log('\nBuilding metadata map...');
    const map = Object.fromEntries(results.map(result => [result.key, result.section]));

    if (!hasUsefulMetadata(map)) {
        throw new Error('Metadata map has no useful entries. Refusing to write an empty SEO data file.');
    }

    const counts = Object.entries(map).map(([key, val]) => `${key}: ${countEntries(val)}`);
    const sources = results.map(result => `${result.key}: ${result.source}`);
    console.log(`  Entries: ${counts.join(', ')}`);
    console.log(`  Sources: ${sources.join(', ')}`);

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
