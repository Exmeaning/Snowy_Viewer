/**
 * Sitemap Data Generator Script
 * 
 * 在 CI/构建阶段从远程 master API 拉取数据，
 * 生成域名无关的路由数据 JSON（sitemap-data.json）。
 * 运行时由 Next.js route handler 根据请求 Host 动态拼接 XML。
 * 
 * 使用方法: node scripts/generate-sitemaps.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_DATA_URL = 'https://sekaimaster.exmeaning.com/master';
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');

/**
 * Fetch master data from remote server
 */
async function fetchMasterData(filename) {
    const url = `${MASTER_DATA_URL}/${filename}`;
    console.log(`  Fetching ${filename}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${filename}: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`    ⚠ Error fetching ${filename}:`, error.message);
        return [];
    }
}

/**
 * Format timestamp to ISO date string
 */
function formatDate(timestamp) {
    if (!timestamp) return new Date().toISOString();
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function main() {
    console.log('=== Sitemap Data Generator ===\n');

    // Static routes (first-level pages)
    const mainRoutes = [
        { path: '/', priority: 1.0, changefreq: 'daily' },
        { path: '/about/', priority: 0.8, changefreq: 'monthly' },
        { path: '/cards/', priority: 0.9, changefreq: 'daily' },
        { path: '/music/', priority: 0.9, changefreq: 'daily' },
        { path: '/events/', priority: 0.9, changefreq: 'daily' },
        { path: '/gacha/', priority: 0.8, changefreq: 'daily' },
        { path: '/sticker/', priority: 0.7, changefreq: 'weekly' },
        { path: '/comic/', priority: 0.7, changefreq: 'weekly' },
        { path: '/live/', priority: 0.7, changefreq: 'weekly' },
        { path: '/character/', priority: 0.8, changefreq: 'weekly' },
        { path: '/mysekai/', priority: 0.7, changefreq: 'weekly' },
        { path: '/materials/', priority: 0.7, changefreq: 'weekly' },
        { path: '/costumes/', priority: 0.7, changefreq: 'weekly' },
        { path: '/manga/', priority: 0.6, changefreq: 'weekly' },
        { path: '/eventstory/', priority: 0.7, changefreq: 'weekly' },
        { path: '/honors/', priority: 0.6, changefreq: 'weekly' },
        { path: '/prediction/', priority: 0.6, changefreq: 'daily' },
        { path: '/deck-recommend/', priority: 0.6, changefreq: 'monthly' },
        { path: '/score-control/', priority: 0.6, changefreq: 'monthly' },
    ];

    // Fetch detail data
    console.log('Fetching master data...');
    const [cards, musics, events, gachas, virtualLives, characters] = await Promise.all([
        fetchMasterData('cards.json'),
        fetchMasterData('musics.json'),
        fetchMasterData('events.json'),
        fetchMasterData('gachas.json'),
        fetchMasterData('virtualLives.json'),
        fetchMasterData('gameCharacters.json'),
    ]);

    // Build detail routes (domain-agnostic, only paths)
    const detailRoutes = [];

    if (Array.isArray(cards)) {
        console.log(`  - ${cards.length} card pages`);
        for (const c of cards) {
            detailRoutes.push({ path: `/cards/${c.id}/`, lastmod: formatDate(c.releaseAt), priority: 0.6, changefreq: 'weekly' });
        }
    }

    if (Array.isArray(musics)) {
        console.log(`  - ${musics.length} music pages`);
        for (const m of musics) {
            detailRoutes.push({ path: `/music/${m.id}/`, lastmod: formatDate(m.publishedAt), priority: 0.6, changefreq: 'weekly' });
        }
    }

    if (Array.isArray(events)) {
        console.log(`  - ${events.length} event pages`);
        for (const e of events) {
            detailRoutes.push({ path: `/events/${e.id}/`, lastmod: formatDate(e.startAt), priority: 0.7, changefreq: 'weekly' });
        }
    }

    if (Array.isArray(gachas)) {
        console.log(`  - ${gachas.length} gacha pages`);
        for (const g of gachas) {
            detailRoutes.push({ path: `/gacha/${g.id}/`, lastmod: formatDate(g.startAt), priority: 0.6, changefreq: 'weekly' });
        }
    }

    if (Array.isArray(virtualLives)) {
        console.log(`  - ${virtualLives.length} virtual live pages`);
        for (const v of virtualLives) {
            detailRoutes.push({ path: `/live/${v.id}/`, lastmod: formatDate(v.startAt), priority: 0.5, changefreq: 'weekly' });
        }
    }

    if (Array.isArray(characters)) {
        console.log(`  - ${characters.length} character pages`);
        const now = formatDate(null);
        for (const c of characters) {
            detailRoutes.push({ path: `/character/${c.id}/`, lastmod: now, priority: 0.6, changefreq: 'monthly' });
        }
    }

    if (Array.isArray(events)) {
        console.log(`  - ${events.length} event story pages`);
        for (const e of events) {
            detailRoutes.push({ path: `/eventstory/${e.id}/`, lastmod: formatDate(e.startAt), priority: 0.5, changefreq: 'weekly' });
        }
    }

    // Output
    const data = {
        generatedAt: new Date().toISOString(),
        mainRoutes,
        detailRoutes,
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outFile = path.join(OUT_DIR, 'sitemap-data.json');
    fs.writeFileSync(outFile, JSON.stringify(data), 'utf-8');

    const fileSize = fs.statSync(outFile).size;
    console.log(`\n✓ Generated sitemap-data.json (${(fileSize / 1024).toFixed(1)} KB)`);
    console.log(`  Main routes: ${mainRoutes.length}`);
    console.log(`  Detail routes: ${detailRoutes.length}`);
    console.log('\n=== Sitemap data generation complete! ===');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
