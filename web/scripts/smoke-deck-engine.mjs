/**
 * 组卡 wasm 引擎冒烟测试（Node，不进构建）。
 *
 * 目的：在往上搭共享层之前，先证明
 *   1) wasm 能实例化
 *   2) 我们下发的 master 表集合能被 loadMasterData 接受（不缺必需表）
 *   3) createUserData + recommend 能跑出非空结果
 *
 * 用真实 master data（和 app 同源）+ 合成的用户数据，所以不需要真实账号。
 *
 * 使用方法: node scripts/smoke-deck-engine.mjs
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';

const MASTER_BASE = 'https://metadata.exmeaning.com/jp/master';
const MUSIC_META_URL = 'https://moe.exmeaning.com/data/music_meta/music_metas.json';

const REQUIRED_KEYS = [
    'areaItemLevels', 'areaItems', 'areas', 'cardEpisodes', 'cards',
    'cardRarities', 'characterRanks', 'eventCards', 'eventDeckBonuses',
    'eventExchangeSummaries', 'events', 'eventItems', 'eventRarityBonusRates',
    'gameCharacters', 'gameCharacterUnits', 'honors', 'masterLessons',
    'musicDifficulties', 'musics', 'musicVocals', 'shopItems', 'skills',
    'worldBloomDifferentAttributeBonuses', 'worldBlooms',
    'worldBloomSupportDeckBonuses',
];

const OPTIONAL_KEYS = [
    'worldBloomSupportDeckUnitEventLimitedBonuses',
    'cardMysekaiCanvasBonuses',
    'mysekaiGates',
    'mysekaiGateLevels',
];

/** worldBloomSupportDeckBonusesWL{1,2,3} 不需要我们提供：
 *  它们在构建期就用 --embed-file 嵌进了 wasm，引擎从虚拟文件系统的
 *  /data/ 读取。所以 staticDataPath 必须保持默认值 "/data"——
 *  把它指到真实的 URL 路径（比如 public/data）反而会让加载失败。 */
const STATIC_DATA_DIR = '/data';

async function fetchJson(url, attempts = 3) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return await res.json();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
    }
    throw new Error(`${lastErr?.message ?? lastErr} — ${url}`);
}

/** 限并发，太多并行请求会被本地代理掐断。 */
async function mapWithConcurrency(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (cursor < items.length) {
                const i = cursor++;
                out[i] = await fn(items[i]);
            }
        }),
    );
    return out;
}

async function fetchMasterData() {
    const keys = [...REQUIRED_KEYS, ...OPTIONAL_KEYS];
    const entries = await mapWithConcurrency(keys, 4, async (key) => {
        try {
            return [key, await fetchJson(`${MASTER_BASE}/${key}.json`)];
        } catch (err) {
            if (REQUIRED_KEYS.includes(key)) throw err;
            console.warn(`  (可选表缺失，跳过) ${key}: ${err.message}`);
            return null;
        }
    });
    const master = Object.fromEntries(entries.filter(Boolean));
    return master;
}

/** 合成一份最小用户数据：每个角色拿一张能找到的 4 星卡。 */
function buildSyntheticUserData(master) {
    const byCharacter = new Map();
    for (const card of master.cards) {
        if (card.cardRarityType !== 'rarity_4') continue;
        if (!byCharacter.has(card.characterId)) byCharacter.set(card.characterId, card);
    }
    const picked = [...byCharacter.values()].slice(0, 30);

    return {
        userGamedata: { userId: 1, name: 'smoke', deck: 1, rank: 1 },
        userCards: picked.map((card) => ({
            cardId: card.id,
            level: 60,
            masterRank: 0,
            skillLevel: 1,
            specialTrainingStatus: 'done',
            defaultImage: 'special_training',
            episodes: (master.cardEpisodes ?? [])
                .filter((ep) => ep.cardId === card.id)
                .map((ep) => ({ cardEpisodeId: ep.id, scenarioStatus: 'already_read' })),
        })),
        userCharacters: master.gameCharacters.map((c) => ({
            characterId: c.id,
            characterRank: 1,
        })),
        userAreas: [],
        userDecks: [],
        userHonors: [],
        userChallengeLiveSoloDecks: [],
        userMysekaiCanvases: [],
        userMysekaiGates: [],
        userMysekaiFixtureGameCharacterPerformanceBonuses: [],
    };
}

async function main() {
    const require = createRequire(import.meta.url);
    const pkgEntry = require.resolve(
        'haruki-sekai-deck-recommend-cpp/sekai_deck_recommend.js',
    );
    const packageDir = pkgEntry.replace(/[\\/]sekai_deck_recommend\.js$/, '');

    console.log('1) 加载 wasm 模块…');
    const { createSekaiDeckRecommend } = await import(
        `file://${packageDir.replace(/\\/g, '/')}/index.js`
    );
    const engine = await createSekaiDeckRecommend({
        // 该包是面向浏览器的构建，Node 下既不走 fs 分支、fetch 又不支持 file://。
        // 直接把 wasm 字节喂给 emscripten，绕开所有加载路径。
        moduleOptions: {
            wasmBinary: readFileSync(`${packageDir}/sekai_deck_recommend.wasm`),
        },
        staticDataPath: STATIC_DATA_DIR,
    });
    console.log('   ok');

    console.log('2) 拉取 master data…');
    const master = await fetchMasterData();
    console.log(`   ${Object.keys(master).length} 张表, cards=${master.cards.length}`);

    console.log('3) loadMasterData / loadMusicMetas…');
    engine.loadMasterData('jp', master);
    const musicMetas = await fetchJson(MUSIC_META_URL);
    engine.loadMusicMetas('jp', musicMetas);
    console.log(`   ok, musicMetas=${musicMetas.length}`);

    console.log('4) createUserData（合成账号）…');
    const userData = engine.createUserData('jp', buildSyntheticUserData(master));
    console.log('   ok');

    console.log('5) recommend(target=power, algorithm=dfs)…');
    const meta = musicMetas[0];
    const result = engine.recommend(
        {
            region: 'jp',
            live_type: 'multi',
            music_id: meta.music_id,
            music_diff: meta.difficulty,
            target: 'power',
            algorithm: 'dfs',
            limit: 3,
            timeout_ms: 15000,
        },
        userData,
    );

    console.log(`   cost_ms=${result.cost_ms}, decks=${result.decks.length}`);
    for (const [i, deck] of result.decks.entries()) {
        console.log(
            `   #${i + 1} power=${deck.total_power} score=${deck.score} ` +
                `cards=[${deck.cards.map((c) => c.card_id).join(', ')}]`,
        );
    }

    if (result.decks.length === 0) throw new Error('没有返回任何卡组');

    // 活动组卡：验证 event_id 路径与分数目标。
    const latestEvent = [...master.events].sort((a, b) => a.startAt - b.startAt).at(-1);
    console.log(`6) recommend(event_id=${latestEvent.id}, target=score, dfs)…`);
    const eventResult = engine.recommend(
        {
            region: 'jp',
            live_type: 'multi',
            music_id: meta.music_id,
            music_diff: meta.difficulty,
            event_id: latestEvent.id,
            target: 'score',
            algorithm: 'dfs',
            limit: 3,
            timeout_ms: 15000,
        },
        userData,
    );
    console.log(
        `   cost_ms=${eventResult.cost_ms}, decks=${eventResult.decks.length}` +
            (eventResult.decks[0]
                ? `, top: pt=${eventResult.decks[0].score} bonus=${eventResult.decks[0].event_bonus_rate}%`
                : ''),
    );

    // 控分组卡：target=bonus + target_bonus_list（score-control 的核心路径）。
    // 目标区间取实际能达到的附近，否则合法地返回空集、证明不了机制通不通。
    const topBonus = Math.round(eventResult.decks[0]?.event_bonus_rate ?? 0);
    const lo = Math.max(0, topBonus - 30);
    const hi = topBonus + 5;
    console.log(`7) recommend(target=bonus, target_bonus_list=[${lo}..${hi}], dfs)…`);
    const bonusResult = engine.recommend(
        {
            region: 'jp',
            live_type: 'multi',
            music_id: meta.music_id,
            music_diff: meta.difficulty,
            event_id: latestEvent.id,
            target: 'bonus',
            algorithm: 'dfs',
            target_bonus_list: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
            limit: 1,
            timeout_ms: 15000,
        },
        userData,
    );
    const reachable = [
        ...new Set(bonusResult.decks.map((d) => d.event_bonus_rate)),
    ].sort((a, b) => a - b);
    console.log(
        `   cost_ms=${bonusResult.cost_ms}, decks=${bonusResult.decks.length}, ` +
            `可达加成=[${reachable.join(', ')}]`,
    );
    if (bonusResult.decks.length === 0) {
        throw new Error('target=bonus 在可达区间内没返回卡组');
    }

    userData.dispose();
    engine.dispose();
    console.log('\n冒烟测试通过。');
}

main().catch((err) => {
    console.error('\n冒烟测试失败:', err);
    process.exit(1);
});
