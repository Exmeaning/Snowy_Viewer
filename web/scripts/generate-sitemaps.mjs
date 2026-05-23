/**
 * Sitemap Data Generator Script
 *
 * 在 CI/构建阶段从远程 master API 拉取数据，
 * 生成域名无关的路由数据 JSON（sitemap-data.json）。
 * 运行时由 Next.js route handler 根据请求 Host 动态拼接 XML。
 *
 * 构建环境网络可能与宿主不同；当远程数据源临时不可用时，
 * 本脚本会优先保留已存在的 detail routes，避免把 sitemap 覆盖成空详情页。
 *
 * 使用方法: node scripts/generate-sitemaps.mjs
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
import seoRouteData from '../src/lib/seo-routes-data.json' with { type: 'json' };

const SEO_ROUTE_DATA = seoRouteData;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'sitemap-data.json');
const REQUIRE_FRESH = requireFreshBuildData();

/**
 * Format timestamp to ISO date string
 */
function formatDate(timestamp) {
    if (!timestamp) return new Date().toISOString();
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function shortenError(error) {
    const message = error?.message || String(error);
    return message.length > 500 ? `${message.slice(0, 500)}...` : message;
}

function existingRoutesByPrefix(existingData, prefix) {
    return (Array.isArray(existingData?.detailRoutes) ? existingData.detailRoutes : [])
        .filter(route => typeof route?.path === 'string' && route.path.startsWith(prefix));
}

function existingLastmodForPath(existingData, routePath, fallback) {
    const route = (Array.isArray(existingData?.detailRoutes) ? existingData.detailRoutes : [])
        .find(item => item?.path === routePath);
    return route?.lastmod || fallback;
}

function areRoutesChanged(existingData, nextMainRoutes, nextDetailRoutes) {
    if (!existingData) return true;
    return JSON.stringify(existingData.mainRoutes || []) !== JSON.stringify(nextMainRoutes)
        || JSON.stringify(existingData.detailRoutes || []) !== JSON.stringify(nextDetailRoutes);
}

function hasUsefulDetails(detailRoutes) {
    return Array.isArray(detailRoutes) && detailRoutes.length > 0;
}

const mainRoutes = SEO_ROUTE_DATA
    .filter(route => route.indexable)
    .map(route => ({
        path: route.path,
        priority: route.priority,
        changefreq: route.changefreq,
    }));

function buildMangaRoutes(mangasRaw) {
    return Object.entries(mangasRaw || {}).map(([id, manga]) => ({
        path: `/manga/${id}/`,
        lastmod: formatDate(manga?.publishedAt || manga?.updatedAt),
        priority: 0.5,
        changefreq: 'monthly',
    }));
}

const routeSources = [
    {
        label: 'cards',
        filename: 'cards.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'cards',
                logLabel: 'card pages',
                prefix: '/cards/',
                build: cards => (Array.isArray(cards) ? cards : []).map(c => ({
                    path: `/cards/${c.id}/`,
                    lastmod: formatDate(c.releaseAt),
                    priority: 0.6,
                    changefreq: 'weekly',
                })),
            },
        ],
    },
    {
        label: 'musics',
        filename: 'musics.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'musics',
                logLabel: 'music pages',
                prefix: '/music/',
                build: musics => (Array.isArray(musics) ? musics : []).map(m => ({
                    path: `/music/${m.id}/`,
                    lastmod: formatDate(m.publishedAt),
                    priority: 0.6,
                    changefreq: 'weekly',
                })),
            },
        ],
    },
    {
        label: 'events',
        filename: 'events.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'events',
                logLabel: 'event pages',
                prefix: '/events/',
                build: events => (Array.isArray(events) ? events : []).map(e => ({
                    path: `/events/${e.id}/`,
                    lastmod: formatDate(e.startAt),
                    priority: 0.7,
                    changefreq: 'weekly',
                })),
            },
            {
                key: 'eventStories',
                logLabel: 'event story pages',
                prefix: '/story/event/',
                build: events => (Array.isArray(events) ? events : []).map(e => ({
                    path: `/story/event/${e.id}/`,
                    lastmod: formatDate(e.startAt),
                    priority: 0.5,
                    changefreq: 'weekly',
                })),
            },
        ],
    },
    {
        label: 'gachas',
        filename: 'gachas.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'gachas',
                logLabel: 'gacha pages',
                prefix: '/gacha/',
                build: gachas => (Array.isArray(gachas) ? gachas : []).map(g => ({
                    path: `/gacha/${g.id}/`,
                    lastmod: formatDate(g.startAt),
                    priority: 0.6,
                    changefreq: 'weekly',
                })),
            },
        ],
    },
    {
        label: 'virtualLives',
        filename: 'virtualLives.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'virtualLives',
                logLabel: 'virtual live pages',
                prefix: '/live/',
                build: virtualLives => (Array.isArray(virtualLives) ? virtualLives : []).map(v => ({
                    path: `/live/${v.id}/`,
                    lastmod: formatDate(v.startAt),
                    priority: 0.5,
                    changefreq: 'weekly',
                })),
            },
        ],
    },
    {
        label: 'characters',
        filename: 'gameCharacters.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'characters',
                logLabel: 'character pages',
                prefix: '/character/',
                build: (characters, existingData) => {
                    const fallbackLastmod = existingData?.generatedAt || formatDate(null);
                    return (Array.isArray(characters) ? characters : []).map(c => {
                        const routePath = `/character/${c.id}/`;
                        return {
                            path: routePath,
                            lastmod: existingLastmodForPath(existingData, routePath, fallbackLastmod),
                            priority: 0.6,
                            changefreq: 'monthly',
                        };
                    });
                },
            },
        ],
    },
    {
        label: 'exchangeSummaries',
        filename: 'materialExchangeSummaries.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'exchanges',
                logLabel: 'exchange pages',
                prefix: '/exchanges/',
                build: exchangeSummaries => (Array.isArray(exchangeSummaries) ? exchangeSummaries : [])
                    .flatMap(summary => (summary.materialExchanges || []).map(exchange => ({
                        id: exchange.id,
                        lastmod: exchange.startAt || summary.startAt || summary.endAt,
                    })))
                    .map(exchange => ({
                        path: `/exchanges/${exchange.id}/`,
                        lastmod: formatDate(exchange.lastmod),
                        priority: 0.5,
                        changefreq: 'weekly',
                    })),
            },
        ],
    },
    {
        label: 'costumes',
        filename: 'moe_costume.json',
        fallback: { costumes: [] },
        validate: data => data && Array.isArray(data.costumes),
        groups: [
            {
                key: 'costumes',
                logLabel: 'costume pages',
                prefix: '/costumes/',
                build: costumesRaw => (costumesRaw?.costumes || []).map(costume => ({
                    path: `/costumes/${costume.costumeNumber}/`,
                    lastmod: formatDate(costume.publishedAt || costume.archivePublishedAt),
                    priority: 0.5,
                    changefreq: 'monthly',
                })),
            },
        ],
    },
    {
        label: 'mysekaiFixtures',
        filename: 'mysekaiFixtures.json',
        fallback: [],
        validate: Array.isArray,
        groups: [
            {
                key: 'mysekaiFixtures',
                logLabel: 'mysekai fixture pages',
                prefix: '/mysekai/',
                build: fixtures => (Array.isArray(fixtures) ? fixtures : []).map(fixture => ({
                    path: `/mysekai/${fixture.id}/`,
                    lastmod: formatDate(fixture.publishedAt || fixture.archivePublishedAt || fixture.updatedAt),
                    priority: 0.5,
                    changefreq: 'monthly',
                })),
            },
        ],
    },
    {
        label: 'mangas',
        fallback: {},
        validate: data => data && typeof data === 'object' && !Array.isArray(data),
        fetch: () => fetchMangaJson('mangas'),
        groups: [
            {
                key: 'mangas',
                logLabel: 'manga pages',
                prefix: '/manga/',
                build: buildMangaRoutes,
            },
        ],
    },
];

function buildGroupFromRaw(group, raw, existingData, sourceLabel) {
    const routes = group.build(raw, existingData);
    const previous = existingRoutesByPrefix(existingData, group.prefix);

    if (routes.length === 0) {
        if (previous.length > 0 && !REQUIRE_FRESH) {
            console.warn(`    ⚠ ${group.logLabel} returned 0 entries, keeping existing ${previous.length} routes`);
            return { key: group.key, logLabel: group.logLabel, routes: previous, source: 'existing-empty-response' };
        }
        if (REQUIRE_FRESH) {
            throw new Error(`${group.logLabel} returned 0 routes`);
        }
    }

    console.log(`  - ${routes.length} ${group.logLabel} (${sourceLabel})`);
    return { key: group.key, logLabel: group.logLabel, routes, source: sourceLabel };
}

async function loadRouteSource(source, existingData) {
    console.log(`  Fetching ${source.filename || source.label}...`);

    try {
        const raw = source.fetch
            ? await source.fetch()
            : await fetchMasterJson(source.filename, source.label);
        if (source.validate && !source.validate(raw)) {
            throw new Error(`Unexpected ${source.label} response shape`);
        }

        return source.groups.map(group => buildGroupFromRaw(group, raw, existingData, 'fresh'));
    } catch (error) {
        if (REQUIRE_FRESH) {
            throw error;
        }

        return source.groups.map(group => {
            const previous = existingRoutesByPrefix(existingData, group.prefix);
            if (previous.length > 0) {
                console.warn(`    ⚠ ${group.logLabel} failed: ${shortenError(error)}, keeping existing ${previous.length} routes`);
                return { key: group.key, logLabel: group.logLabel, routes: previous, source: 'existing' };
            }

            const routes = group.build(source.fallback, existingData);
            console.warn(`    ⚠ ${group.logLabel} failed: ${shortenError(error)}, using empty fallback`);
            return { key: group.key, logLabel: group.logLabel, routes, source: 'fallback' };
        });
    }
}

async function main() {
    console.log('=== Sitemap Data Generator ===\n');
    console.log(`Master APIs: ${getConfiguredMasterDataUrls().join(', ')}`);
    console.log(`Manga APIs: ${getConfiguredMangaDataUrls().join(', ')}`);
    console.log(`Require fresh build data: ${REQUIRE_FRESH ? 'yes' : 'no'}`);
    console.log(`Output: ${OUT_FILE}\n`);

    const existingData = readJsonIfExists(OUT_FILE, null);
    if (existingData) {
        console.log(`Existing sitemap data: main ${existingData.mainRoutes?.length || 0}, details ${existingData.detailRoutes?.length || 0}\n`);
    }

    console.log('Fetching master data...');
    const groupedResults = await mapWithConcurrency(
        routeSources,
        getBuildFetchConcurrency(3),
        source => loadRouteSource(source, existingData)
    );
    const groupResults = groupedResults.flat();

    const detailRoutes = groupResults.flatMap(result => result.routes);

    if (!hasUsefulDetails(detailRoutes)) {
        throw new Error('Sitemap detail routes are empty. Refusing to write an empty detail sitemap data file.');
    }

    // Output. Keep generatedAt stable when routes did not change so scheduled workflows
    // do not create empty hourly commits.
    const routesChanged = areRoutesChanged(existingData, mainRoutes, detailRoutes);
    const data = {
        generatedAt: routesChanged ? new Date().toISOString() : (existingData?.generatedAt || new Date().toISOString()),
        mainRoutes,
        detailRoutes,
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(data), 'utf-8');

    const fileSize = fs.statSync(OUT_FILE).size;
    const sources = groupResults.map(result => `${result.key}: ${result.source}`);
    console.log(`\n✓ Generated sitemap-data.json (${(fileSize / 1024).toFixed(1)} KB)`);
    console.log(`  Main routes: ${mainRoutes.length}`);
    console.log(`  Detail routes: ${detailRoutes.length}`);
    console.log(`  Sources: ${sources.join(', ')}`);
    console.log('\n=== Sitemap data generation complete! ===');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
