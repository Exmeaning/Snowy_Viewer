/**
 * 组卡计算 worker（allium-deck 引擎）。
 *
 * 数据链路：SnowyDataProvider/CachedDeckDataProvider 负责 master data、
 * 用户数据与音乐元数据的拉取和缓存；计算交给 allium-deck wasm 引擎
 * （lib/deck-engine/wasm-loader）。连接世界/WL3 模拟由引擎按 world_bloom
 * 参数在内部合成，不再改写 master data。
 */
import {
    CachedDeckDataProvider,
    ENGINE_OPTIONAL_MASTER_KEYS,
    fetchEngineMusicMetas,
    PRELOAD_MASTER_KEYS,
    SnowyDataProvider,
    type HarukiServer,
} from "@/lib/deck-recommend/data-provider";
import { getWl3SimulationGroupByEventId } from "@/lib/world-bloom-simulation";
import {
    loadDeckEngine,
    type DeckEngineUserHandle,
} from "@/lib/deck-engine/wasm-loader";
import { resolveDeckScore } from "./deck-score";
import { applyUserDataOverrides } from "./user-data-overrides";
import type {
    DeckResultCard,
    DeckResultDeck,
    DeckUserCard,
    DeckWorkerInput,
    DeckWorkerOutput,
} from "./engine-types";

interface EventInfoLite {
    id: number;
    eventType?: string;
}

const RARITY_CONFIG_KEYS: Record<string, string> = {
    rarity_1: "rarity1Config",
    rarity_2: "rarity2Config",
    rarity_3: "rarity3Config",
    rarity_4: "rarity4Config",
    rarity_birthday: "rarityBirthdayConfig",
};

function sendProgress(stage: string, percent: number, progressKey: string) {
    const message: DeckWorkerOutput = { type: "progress", stage, percent, progressKey };
    postMessage(message);
}

/** 单曲收益查询消息（引擎与 master data 常驻 worker，无需重新加载）。 */
interface MusicRequest {
    requestId: number;
    liveType: string;
    eventType?: string;
    skillOrder?: string;
    teammates?: { power?: number; scoreUp?: number };
    deck: {
        totalPower: number;
        eventBonusRate: number;
        supportDeckBonusRate: number;
        cards: { skillScoreUp: number; skillLifeRecovery: number }[];
    };
}

/** worker 常驻缓存：master data 按区服缓存一次，用户句柄按账号缓存一次。
 *  二次计算跳过全部网络与 wasm 数据加载，只有引擎搜索本身的开销。 */
let dataCache: {
    key: string;
    tables: Record<string, unknown[]>;
    musicMetas: unknown[];
    userData: Record<string, unknown>;
} | null = null;
let handleCache: { key: string; handle: DeckEngineUserHandle } | null = null;

async function runDeck(input: DeckWorkerInput): Promise<DeckWorkerOutput> {
    const { mode, userId, server, oauthAccessToken, target } = input;

    // wasm 实例在 worker 内加载（同 worker 单例，二次调用零成本）。
    const engine = await loadDeckEngine();

    const dataKey = server;
    if (!dataCache || dataCache.key !== dataKey) {
        sendProgress("fetching", 5, "page.deckRecommend.progress.fetchingUserData");

        const dataProvider = new CachedDeckDataProvider(
            new SnowyDataProvider(userId, server as HarukiServer, oauthAccessToken || null),
        );

        const [userData, musicMetas] = await Promise.all([
            dataProvider.getUserDataAll(),
            fetchEngineMusicMetas(),
            dataProvider.preloadMasterData(PRELOAD_MASTER_KEYS),
        ]);

        sendProgress("processing", 25, "page.deckRecommend.progress.loadingEngine");

        const tables: Record<string, unknown[]> = {};
        for (const key of PRELOAD_MASTER_KEYS) {
            tables[key] = await dataProvider.getMasterData(key);
        }
        for (const key of ENGINE_OPTIONAL_MASTER_KEYS) {
            try {
                tables[key] = await dataProvider.getMasterData(key);
            } catch {
                // 站点不下发的表：引擎走内建 fallback（上限 4/5、终章 140%）。
            }
        }
        engine.loadMasterData(tables, musicMetas as unknown[]);
        dataCache = {
            key: dataKey,
            tables,
            musicMetas: musicMetas as unknown[],
            userData: userData as Record<string, unknown>,
        };
    }
    const { tables, userData } = dataCache;
    const uploadTime = userData.upload_time as number | undefined;
    const userCards = (userData.userCards ?? []) as DeckUserCard[];

    // 进阶数据覆盖与角色过滤：按 Haruki 语义改写快照后交给引擎。
    // 无覆盖且账号未变时直接复用已解析的用户句柄（跳过 createUserData）。
    const hasOverrides = Boolean(input.userDataOverrides || input.characterFilterIds);
    const userKey = `${userId}|${server}|${oauthAccessToken ?? ""}`;
    let user: DeckEngineUserHandle;
    let reusable = false;
    if (!hasOverrides && handleCache && handleCache.key === userKey) {
        user = handleCache.handle;
        reusable = true;
    } else {
        const preparedUserData = applyUserDataOverrides(
            userData,
            input.userDataOverrides,
            tables,
            input.characterFilterIds,
        );
        user = engine.createUserData(server, preparedUserData);
        if (!hasOverrides) {
            if (handleCache) engine.disposeUser(handleCache.handle);
            handleCache = { key: userKey, handle: user };
        }
    }

    try {
        sendProgress("calculating", 50, "page.deckRecommend.progress.calculating");

        const options = await buildOptions(input, (tables.events ?? []) as EventInfoLite[]);
        const { decks, performance } = engine.recommend(options, user);

        const result = decks.map(
            (deck): DeckResultDeck => {
                const displayScore = resolveDeckScore({
                    mode,
                    target: mode === "event" ? target : undefined,
                    strongestTarget: mode === "strongest" ? input.strongestTarget : undefined,
                    targetValue: deck.target_value,
                    eventPoint: deck.event_point ?? undefined,
                });
                return {
                    rank: deck.rank,
                    score: displayScore,
                    eventPoint: deck.event_point ?? undefined,
                    liveScore: deck.live_score,
                    totalPower: deck.total_power,
                    eventBonus: deck.event_bonus_total ?? undefined,
                    effectiveSkill: deck.multi_live_score_up ?? deck.skill_score,
                    cards: deck.cards.map(
                        (card): DeckResultCard => ({
                            cardId: card.card_id,
                            characterId: card.character_id,
                            assetKey: card.asset_key,
                            rarity: card.rarity,
                            attr: card.attr,
                            level: card.level,
                            masterRank: card.master_rank,
                            skillLevel: card.skill_level,
                            power: card.power_total,
                            skillScoreUp: card.skill_score_up,
                            eventBonus: card.event_bonus ?? 0,
                            episode1Read: card.episode1_read,
                            episode2Read: card.episode2_read,
                            hasCanvasBonus: card.has_canvas_bonus,
                            canvasPower: card.canvas_power,
                        }),
                    ),
                };
            },
        );

        sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
        return {
            type: "result",
            result,
            userCards,
            duration: performance.build_pool_ms + performance.search_ms,
            upload_time: uploadTime,
        };
    } finally {
        // 复用路径不释放句柄（handleCache 持有）；覆盖路径的临时句柄在此释放。
        if (!reusable) engine.disposeUser(user);
    }
}

/** 特定技能顺序：UI 用 1-based 数字串（1=队长位），引擎消费 0-based。 */
function toEngineSkillOrder(text: string): string | undefined {
    const digits = text.replace(/\D/g, "").split("");
    if (digits.length !== 5) return undefined;
    return digits.map((d) => String(Number(d) - 1)).join(",");
}

/** 组装引擎 options；活动类型相关的 live_type 转换在此完成。 */
async function buildOptions(
    input: DeckWorkerInput,
    eventRows: EventInfoLite[],
): Promise<Record<string, unknown>> {
    const {
        mode, eventId, eventType, simulatedEvent, liveType, supportCharacterId,
        challengeCharacterId, musicId, difficulty, cardConfig, target, bonusTargets,
        customUnit, customCharacterIds, customCharacterUnits, customAttr, strongestTarget,
        multiTeammatePower, multiTeammateScoreUp, multiScoreUpLowerBound,
        skillOrder, specificSkillOrder, skillReference, keepAfterTrainingState,
        bestSkillAsLeader, minimize, boost, otherScore, unitFilter, attrFilter,
        supportMasterMax, supportSkillMax, filterOtherUnit,
        fixedCards, fixedCharacters, excludedCards, singleCardOverrides,
        leaderCharacterId, limit, timeoutMs,
    } = input;

    let computedLiveType: string = liveType;
    const usesRealEvent = Boolean(eventId) && !simulatedEvent;
    if (usesRealEvent && (mode === "event" || mode === "mysekai")) {
        const event0 = eventRows.find((it) => it.id === eventId);
        if (event0?.eventType === "cheerful_carnival" && computedLiveType === "multi") {
            computedLiveType = "cheerful";
        }
    }
    if (mode === "challenge") {
        computedLiveType = liveType === "auto" ? "challenge_auto" : "challenge";
    }

    const options: Record<string, unknown> = {
        live_type: computedLiveType,
        limit: limit ?? 10,
        timeout_ms: timeoutMs ?? 120_000,
    };
    if (mode !== "weakest") {
        options.music_id = musicId;
        options.music_diff = difficulty;
    }

    if (mode === "weakest") {
        // 最弱组卡：无活动、无乐曲、不应用任何养成覆盖，直接按账号真实数据求最低综合力。
        options.target = "power";
        options.minimize = true;
        options.live_type = "solo";
        return options;
    }

    for (const [rarityKey, configKey] of Object.entries(RARITY_CONFIG_KEYS)) {
        const config = cardConfig[rarityKey];
        if (!config) continue;
        options[configKey] = {
            disable: config.disable,
            levelMax: config.levelMax,
            episodeRead: config.episodeRead,
            masterMax: config.masterMax,
            skillMax: config.skillMax,
        };
    }

    if (multiTeammatePower) options.multiLiveTeammatePower = multiTeammatePower;
    if (multiTeammateScoreUp) options.multiLiveTeammateScoreUp = multiTeammateScoreUp;
    if (multiScoreUpLowerBound) options.multiLiveScoreUpLowerBound = multiScoreUpLowerBound;
    if (skillOrder) options.liveSkillOrder = skillOrder;
    const engineOrder = specificSkillOrder ? toEngineSkillOrder(specificSkillOrder) : undefined;
    if (skillOrder === "specific" && engineOrder) options.specificSkillOrder = engineOrder;
    if (skillReference) options.skillReferenceChooseStrategy = skillReference;
    if (keepAfterTrainingState) options.keepAfterTrainingState = true;
    if (bestSkillAsLeader === false) options.bestSkillAsLeader = false;
    if (minimize) options.minimize = true;
    if (supportMasterMax) options.supportMasterMax = true;
    if (supportSkillMax) options.supportSkillMax = true;
    if (filterOtherUnit) options.filterOtherUnit = true;
    if (boost !== undefined) options.boost = boost;
    if (otherScore) options.otherScore = otherScore;
    if (unitFilter) options.unitFilter = unitFilter;
    if (attrFilter) options.attrFilter = attrFilter;
    if (leaderCharacterId) options.forced_leader_character_id = leaderCharacterId;
    if (fixedCards?.length) options.fixedCards = fixedCards;
    if (fixedCharacters?.length) options.fixedCharacters = fixedCharacters;
    if (excludedCards?.length) options.excludedCards = excludedCards;
    if (singleCardOverrides?.length) {
        options.singleCardConfigs = singleCardOverrides.map((entry) => ({
            cardId: entry.cardId,
            config: {
                level: entry.level,
                skillLevel: entry.skillLevel,
                masterRank: entry.masterRank,
                episodeReadCount: entry.episodeReadCount,
                canvas: entry.canvas ?? false,
            },
        }));
    }

    if (mode === "event" && simulatedEvent) {
        // 模拟活动：覆盖真实活动，按条件合成活动行。
        options.event_type = simulatedEvent.eventType;
        if (simulatedEvent.attr) options.event_attr = simulatedEvent.attr;
        if (simulatedEvent.unit) options.event_unit = simulatedEvent.unit;
        if (simulatedEvent.worldBloomTurn) {
            options.world_bloom_event_turn = simulatedEvent.worldBloomTurn;
            if (simulatedEvent.worldBloomTurn === 3 && simulatedEvent.worldBloomCharacterId) {
                options.world_bloom_character_id = simulatedEvent.worldBloomCharacterId;
            }
        }
        const searchTarget = target ?? "score";
        options.target = searchTarget;
        if (searchTarget === "bonus" && bonusTargets?.length) {
            options.target_bonus_list = bonusTargets;
        }
        return options;
    }

    if (mode === "event") {
        // EventSelector 的 WL3 模拟活动（3200001..3200005）转成引擎模拟参数。
        const wl3Group = getWl3SimulationGroupByEventId(String(eventId ?? ""));
        if (wl3Group) {
            if (!supportCharacterId) throw new Error("wl3 mode requires supportCharacterId");
            options.world_bloom_event_turn = 3;
            options.world_bloom_character_id = supportCharacterId;
            options.target = target ?? "score";
            if ((target ?? "score") === "bonus" && bonusTargets?.length) {
                options.target_bonus_list = bonusTargets;
            }
            return options;
        }
        if (!eventId) throw new Error("event mode requires eventId");
        options.event_id = eventId;
        if (eventType === "world_bloom" && supportCharacterId) {
            options.world_bloom_character_id = supportCharacterId;
        }
        const searchTarget = target ?? "score";
        options.target = searchTarget;
        if (searchTarget === "bonus" && bonusTargets?.length) {
            options.target_bonus_list = bonusTargets;
        }
        return options;
    }

    if (mode === "challenge") {
        if (!challengeCharacterId) throw new Error("challenge mode requires challengeCharacterId");
        options.challenge_live_character_id = challengeCharacterId;
        return options;
    }

    if (mode === "custom") {
        if (customUnit) options.event_unit = customUnit;
        if (customCharacterIds?.length) options.custom_bonus_character_ids = customCharacterIds;
        if (customCharacterUnits && Object.keys(customCharacterUnits).length > 0) {
            options.custom_bonus_character_support_units = Object.fromEntries(
                Object.entries(customCharacterUnits).map(([id, unit]) => [String(id), unit]),
            );
        }
        if (customAttr) options.custom_bonus_attr = customAttr;
        return options;
    }

    if (mode === "strongest") {
        options.target = strongestTarget ?? "power";
        return options;
    }


    // mysekai
    if (!eventId) throw new Error("mysekai mode requires eventId");
    options.event_id = eventId;
    options.target = "mysekai";
    return options;
}

self.onmessage = async (event: MessageEvent<{ args?: DeckWorkerInput; music?: MusicRequest; warmup?: boolean }>) => {
    const { args, music } = event.data;
    if (event.data.warmup) {
        // 预热：提前加载 wasm 实例，让首次真实计算跳过引擎启动。
        loadDeckEngine()
            .then(() => postMessage({ type: "warm" }))
            .catch(() => postMessage({ type: "warm" }));
        return;
    }
    if (music) {
        // 单曲收益：master data 已在 worker 内缓存；音乐推荐不依赖用户数据。
        try {
            const engine = await loadDeckEngine();
            const raw = engine.recommendMusic({
                    live_type: music.liveType,
                    event_type: music.eventType,
                    skill_order_choose_strategy: music.skillOrder ?? "average",
                    multi_live_teammate_score_up: music.teammates?.scoreUp,
                    multi_live_teammate_power: music.teammates?.power,
                    deck: {
                        total_power: music.deck.totalPower,
                        event_bonus_rate: music.deck.eventBonusRate,
                        support_deck_bonus_rate: music.deck.supportDeckBonusRate,
                        cards: music.deck.cards.map((c) => ({
                            skill_score_up: c.skillScoreUp,
                            skill_life_recovery: c.skillLifeRecovery,
                        })),
                    },
                });
            const rows = raw
                .map((row) => ({
                    musicId: row.music_id,
                    difficulty: row.difficulty,
                    liveScore: row.live_score,
                    eventPoint: row.event_point ?? undefined,
                }))
                .sort((a, b) => (b.eventPoint ?? b.liveScore) - (a.eventPoint ?? a.liveScore));
            postMessage({ type: "music", requestId: music.requestId, rows });
        } catch (err) {
            postMessage({ type: "music", requestId: music.requestId, rows: [] });
            console.error("music ranking failed:", err);
        }
        return;
    }
    if (!args) return;
    try {
        postMessage(await runDeck(args));
    } catch (err) {
        postMessage({
            type: "result",
            error: err instanceof Error ? err.message : String(err),
        } satisfies DeckWorkerOutput);
    }
};
