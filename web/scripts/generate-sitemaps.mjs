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
    fetchGuidesJson,
    fetchMangaJson,
    fetchMasterJson,
    getBuildFetchConcurrency,
    getConfiguredGuidesDataUrls,
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

function existingRoutesByPrefix(existingData, prefix, excludePrefixes = [], matchRoute) {
    return (Array.isArray(existingData?.detailRoutes) ? existingData.detailRoutes : [])
        .filter(route => typeof route?.path === 'string'
            && route.path.startsWith(prefix)
            && !excludePrefixes.some(excluded => route.path.startsWith(excluded))
            && (!matchRoute || matchRoute(route)));
}

function matchesDepth(route, prefix, segmentCount) {
    const rest = route.path.slice(prefix.length).replace(/\/$/, '');
    if (!rest) return segmentCount === 0;
    return rest.split('/').filter(Boolean).length === segmentCount;
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

function eventMapById(events) {
    return new Map((Array.isArray(events) ? events : []).map(event => [event.id, event]));
}

function actionCategory(action) {
    const scenarioId = action?.scenarioId;
    const releaseConditionId = Number(action?.releaseConditionId);
    const cond = String(action?.releaseConditionId ?? '');

    if (scenarioId && cond.length === 6 && cond[0] === '1') return `event_${parseInt(cond.slice(1, 4), 10) + 1}`;
    if (action?.id === 2373) return 'event_145';
    if (scenarioId && scenarioId.includes('aprilfool')) return scenarioId.split('_')[1] || '';
    if (scenarioId && action?.actionSetType === 'limited') return `limited_${action.areaId}`;
    if (scenarioId && action?.actionSetType === 'normal' && action?.isNextGrade === false && releaseConditionId === 1) return 'grade1';
    if (scenarioId && action?.actionSetType === 'normal' && action?.isNextGrade === true && releaseConditionId === 1) return 'grade2';
    if (scenarioId && releaseConditionId >= 2000000 && releaseConditionId <= 2000036) return 'theater';
    return '';
}

function hasUsefulDetails(detailRoutes) {
    return Array.isArray(detailRoutes) && detailRoutes.length > 0;
}

function normalizeRoutePath(routePath) {
    if (!routePath || routePath === '/') return '/';
    const withLeadingSlash = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function assertMainRoutesAligned(routes) {
    const seen = new Set();

    for (const route of routes) {
        const normalized = normalizeRoutePath(route.path);
        if (seen.has(normalized)) {
            throw new Error(`Duplicate main sitemap route: ${normalized}`);
        }
        seen.add(normalized);
    }

    const expected = SEO_ROUTE_DATA
        .filter(route => route.indexable)
        .map(route => normalizeRoutePath(route.path));

    const actual = routes.map(route => normalizeRoutePath(route.path));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('Main sitemap routes are not aligned with indexable SEO route registry entries.');
    }

    const noindexInMain = SEO_ROUTE_DATA
        .filter(route => !route.indexable && seen.has(normalizeRoutePath(route.path)))
        .map(route => normalizeRoutePath(route.path));

    if (noindexInMain.length > 0) {
        throw new Error(`Noindex routes leaked into main sitemap: ${noindexInMain.join(', ')}`);
    }
}

const mainRoutes = SEO_ROUTE_DATA
    .filter(route => route.indexable)
    .map(route => ({
        path: normalizeRoutePath(route.path),
        priority: route.priority,
        changefreq: route.changefreq,
    }));

assertMainRoutesAligned(mainRoutes);

function buildMangaRoutes(mangasRaw) {
    return Object.entries(mangasRaw || {}).map(([id, manga]) => ({
        path: `/manga/${id}/`,
        lastmod: formatDate(manga?.publishedAt || manga?.updatedAt),
        priority: 0.5,
        changefreq: 'monthly',
    }));
}

function buildGuideRoutes(guidesRaw) {
    return (guidesRaw?.guides || []).map(guide => ({
        path: `/guides/${guide.id}/`,
        lastmod: formatDate(guide.date || guidesRaw?.generated_at),
        priority: 0.5,
        changefreq: 'monthly',
    }));
}

function buildStoryEventGroupRoutes(raw) {
    const events = eventMapById(raw?.events);
    return (Array.isArray(raw?.eventStories) ? raw.eventStories : []).map(story => {
        const event = events.get(story.eventId);
        return {
            path: `/story/event/${story.eventId}/`,
            lastmod: formatDate(event?.startAt),
            priority: 0.5,
            changefreq: 'monthly',
        };
    });
}

function buildStoryEventEpisodeRoutes(raw) {
    const events = eventMapById(raw?.events);
    return (Array.isArray(raw?.eventStories) ? raw.eventStories : []).flatMap(story => {
        const event = events.get(story.eventId);
        return (story.eventStoryEpisodes || []).map(episode => ({
            path: `/story/event/${story.eventId}/${episode.episodeNo}/`,
            lastmod: formatDate(event?.startAt),
            priority: 0.4,
            changefreq: 'monthly',
        }));
    });
}

function buildStoryUnitGroupRoutes(raw) {
    return (Array.isArray(raw?.unitStories) ? raw.unitStories : []).map(story => ({
        path: `/story/unit/${story.seq}/`,
        lastmod: formatDate(null),
        priority: 0.5,
        changefreq: 'monthly',
    }));
}

function buildStoryUnitEpisodeRoutes(raw) {
    return (Array.isArray(raw?.unitStories) ? raw.unitStories : []).flatMap(story => (story.chapters || [])
        .flatMap(chapter => (chapter.episodes || []).map(episode => ({
            path: `/story/unit/${story.seq}/${encodeURIComponent(episode.scenarioId)}/`,
            lastmod: formatDate(null),
            priority: 0.4,
            changefreq: 'monthly',
        }))));
}

function buildStoryCardRoutes(raw) {
    const cardIds = new Set((Array.isArray(raw?.cardEpisodes) ? raw.cardEpisodes : []).map(episode => episode.cardId));
    const cards = new Map((Array.isArray(raw?.cards) ? raw.cards : []).map(card => [card.id, card]));
    return [...cardIds].map(cardId => ({
        path: `/story/card/${cardId}/`,
        lastmod: formatDate(cards.get(cardId)?.releaseAt),
        priority: 0.4,
        changefreq: 'monthly',
    }));
}

function buildStorySelfRoutes(raw) {
    return (Array.isArray(raw?.characterProfiles) ? raw.characterProfiles : [])
        .filter(profile => profile.scenarioId)
        .map(profile => ({
            path: `/story/self/${profile.characterId}/`,
            lastmod: formatDate(null),
            priority: 0.4,
            changefreq: 'monthly',
        }));
}

function buildStorySpecialRoutes(raw) {
    return (Array.isArray(raw?.specialStories) ? raw.specialStories : [])
        .filter(story => story.id !== 2 && Array.isArray(story.episodes) && story.episodes.length > 0)
        .map(story => ({
            path: `/story/special/${story.id}/`,
            lastmod: formatDate(null),
            priority: 0.4,
            changefreq: 'monthly',
        }));
}

function buildStoryAreaCategoryRoutes(raw) {
    const categories = new Set();
    for (const action of Array.isArray(raw?.actionSets) ? raw.actionSets : []) {
        const category = actionCategory(action);
        if (category) categories.add(category);
    }
    return [...categories].map(category => ({
        path: `/story/area/${encodeURIComponent(category)}/`,
        lastmod: formatDate(null),
        priority: 0.4,
        changefreq: 'monthly',
    }));
}

function buildStoryAreaReaderRoutes(raw) {
    return (Array.isArray(raw?.actionSets) ? raw.actionSets : []).flatMap(action => {
        const category = actionCategory(action);
        if (!category || !action.scenarioId) return [];
        return [{
            path: `/story/area/${encodeURIComponent(category)}/${encodeURIComponent(action.scenarioId)}/`,
            lastmod: formatDate(null),
            priority: 0.3,
            changefreq: 'monthly',
        }];
    });
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
    {
        label: 'guides',
        fallback: { guides: [] },
        validate: data => data && Array.isArray(data.guides),
        fetch: () => fetchGuidesJson('guides'),
        groups: [
            {
                key: 'guides',
                logLabel: 'guide pages',
                prefix: '/guides/',
                build: buildGuideRoutes,
            },
        ],
    },
    {
        label: 'storyEvents',
        filename: 'events.json + eventStories.json',
        fallback: { events: [], eventStories: [] },
        validate: data => Array.isArray(data?.events) && Array.isArray(data?.eventStories),
        fetch: async () => ({
            events: await fetchMasterJson('events.json', 'story event routes'),
            eventStories: await fetchMasterJson('eventStories.json', 'story event route episodes'),
        }),
        groups: [
            {
                key: 'storyEventGroups',
                logLabel: 'story event group pages',
                prefix: '/story/event/',
                excludePrefixes: ['/story/eventstory/'],
                matchRoute: route => matchesDepth(route, '/story/event/', 1),
                build: buildStoryEventGroupRoutes,
            },
            {
                key: 'storyEventEpisodes',
                logLabel: 'story event reader pages',
                prefix: '/story/event/',
                excludePrefixes: ['/story/eventstory/'],
                matchRoute: route => matchesDepth(route, '/story/event/', 2),
                build: buildStoryEventEpisodeRoutes,
            },
        ],
    },
    {
        label: 'storyUnits',
        filename: 'unitStories.json',
        fallback: { unitStories: [] },
        validate: data => Array.isArray(data?.unitStories),
        fetch: async () => ({
            unitStories: await fetchMasterJson('unitStories.json', 'story unit route episodes'),
        }),
        groups: [
            {
                key: 'storyUnitGroups',
                logLabel: 'story unit group pages',
                prefix: '/story/unit/',
                matchRoute: route => matchesDepth(route, '/story/unit/', 1),
                build: buildStoryUnitGroupRoutes,
            },
            {
                key: 'storyUnitEpisodes',
                logLabel: 'story unit reader pages',
                prefix: '/story/unit/',
                matchRoute: route => matchesDepth(route, '/story/unit/', 2),
                build: buildStoryUnitEpisodeRoutes,
            },
        ],
    },
    {
        label: 'storyCards',
        filename: 'cards.json + cardEpisodes.json',
        fallback: { cards: [], cardEpisodes: [] },
        validate: data => Array.isArray(data?.cards) && Array.isArray(data?.cardEpisodes),
        fetch: async () => ({
            cards: await fetchMasterJson('cards.json', 'story card route cards'),
            cardEpisodes: await fetchMasterJson('cardEpisodes.json', 'story card route episodes'),
        }),
        groups: [
            {
                key: 'storyCardReaders',
                logLabel: 'story card reader pages',
                prefix: '/story/card/',
                build: buildStoryCardRoutes,
            },
        ],
    },
    {
        label: 'storySelf',
        filename: 'characterProfiles.json',
        fallback: { characterProfiles: [] },
        validate: data => Array.isArray(data?.characterProfiles),
        fetch: async () => ({
            characterProfiles: await fetchMasterJson('characterProfiles.json', 'story self route profiles'),
        }),
        groups: [
            {
                key: 'storySelfReaders',
                logLabel: 'story self reader pages',
                prefix: '/story/self/',
                build: buildStorySelfRoutes,
            },
        ],
    },
    {
        label: 'storySpecial',
        filename: 'specialStories.json',
        fallback: { specialStories: [] },
        validate: data => Array.isArray(data?.specialStories),
        fetch: async () => ({
            specialStories: await fetchMasterJson('specialStories.json', 'story special routes'),
        }),
        groups: [
            {
                key: 'storySpecialReaders',
                logLabel: 'story special reader pages',
                prefix: '/story/special/',
                build: buildStorySpecialRoutes,
            },
        ],
    },
    {
        label: 'storyAreas',
        filename: 'actionSets.json',
        fallback: { actionSets: [] },
        validate: data => Array.isArray(data?.actionSets),
        fetch: async () => ({
            actionSets: await fetchMasterJson('actionSets.json', 'story area routes'),
        }),
        groups: [
            {
                key: 'storyAreaCategories',
                logLabel: 'story area category pages',
                prefix: '/story/area/',
                matchRoute: route => matchesDepth(route, '/story/area/', 1),
                build: buildStoryAreaCategoryRoutes,
            },
            {
                key: 'storyAreaReaders',
                logLabel: 'story area reader pages',
                prefix: '/story/area/',
                matchRoute: route => matchesDepth(route, '/story/area/', 2),
                build: buildStoryAreaReaderRoutes,
            },
        ],
    },
];

function buildGroupFromRaw(group, raw, existingData, sourceLabel) {
    const routes = group.build(raw, existingData);
    const previous = existingRoutesByPrefix(existingData, group.prefix, group.excludePrefixes, group.matchRoute);

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
            const previous = existingRoutesByPrefix(existingData, group.prefix, group.excludePrefixes, group.matchRoute);
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
    console.log(`Guides APIs: ${getConfiguredGuidesDataUrls().join(', ')}`);
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
