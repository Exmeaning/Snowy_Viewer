/**
 * Web Worker for deck recommendation computation
 * Runs sekai-calculator in a background thread to avoid blocking the UI
 *
 * 组卡代码来源: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * 部分算法优化修改于: https://github.com/NeuraXmy/sekai-deck-recommend-cpp  作者: luna茶
 */
import {
    BaseDeckRecommend,
    type CardConfig,
    CachedDataProvider,
    ChallengeLiveDeckRecommend,
    type CustomBonusConfig,
    type CustomBonusRule,
    DataProvider,
    type EventConfig,
    EventDeckRecommend,
    LiveCalculator,
    LiveType,
    MusicMeta,
    RecommendTarget,
    type UserCard,
} from "sekai-calculator";

// ==================== INLINED DATA PROVIDER ====================

// Music meta URL
const MUSIC_META_URL = "https://assets.exmeaning.com/musicmeta/music_metas.json";

// Master data URLs - use project's self-hosted official source
const MASTER_DATA_BASES: Record<string, string> = {
    jp: "https://sekaimaster.exmeaning.com/master",
    cn: "https://sekaimaster-cn.exmeaning.com/master",
};

// Haruki suite API base
const HARUKI_SUITE_API = "https://suite-api.haruki.seiunx.com/public";
const OAUTH2_BASE = (process.env.NEXT_PUBLIC_OAUTH2_BASE_URL || "https://toolbox-api-direct.haruki.seiunx.com/api/oauth2").replace(/\/+$/, "");

// User data keys needed for deck recommendation
const USER_DATA_KEYS = [
    "userCards", "userBonds", "userDecks", "userGamedata", "userMusics",
    "userMusicResults", "userMysekaiMaterials", "userAreas",
    "userChallengeLiveSoloDecks", "userCharacters",
    "userCharacterMissionV2Statuses", "userMysekaiCanvases",
    "userCharacterMissionV2s", "userMysekaiFixtureGameCharacterPerformanceBonuses",
    "userMysekaiGates", "userWorldBloomSupportDecks", "userHonors",
    "userMysekaiCharacterTalks", "userChallengeLiveSoloResults",
    "userChallengeLiveSoloStages", "userChallengeLiveSoloHighScoreRewards",
    "userEvents", "userWorldBlooms", "userMusicAchievements",
    "userPlayerFrames", "userMaterials", "upload_time",
].join(",");

// Master data keys needed for preloading
const PRELOAD_MASTER_KEYS = [
    "areaItemLevels", "cards", "cardMysekaiCanvasBonuses", "cardRarities",
    "characterRanks", "cardEpisodes", "events", "eventCards",
    "eventRarityBonusRates", "eventDeckBonuses", "gameCharacters",
    "gameCharacterUnits", "honors", "masterLessons", "mysekaiGates",
    "mysekaiGateLevels", "skills", "worldBloomDifferentAttributeBonuses",
    "worldBloomSupportDeckBonuses", "worldBloomSupportDeckUnitEventLimitedBonuses",
];

type HarukiServer = "jp" | "cn" | "tw";

interface CardParameterEntry {
    id: number;
    cardId: number;
    cardLevel: number;
    cardParameterType: string;
    power: number;
}

interface CardWithParameters {
    id: number;
    cardParameters?: Record<string, number[]> | CardParameterEntry[];
    [key: string]: unknown;
}

interface UserCardEntry {
    cardId: number;
    masterRank?: number;
    [key: string]: unknown;
}

interface UserHonorEntry {
    honorId: number;
    [key: string]: unknown;
}

interface EventInfoLite {
    id: number;
    eventType?: string;
}

interface ChallengeResultEntry {
    characterId: number;
    highScore?: number;
    [key: string]: unknown;
}

interface DeckCardLite {
    cardId: number;
    masterRank?: number;
}

interface DeckResultLite {
    score?: number;
    eventBonus?: number;
    supportDeckBonus?: number;
    power?: { total?: number };
    cards?: DeckCardLite[];
    [key: string]: unknown;
}

type UserDataMap = Record<string, unknown>;

function getDefaultUserDataValue(key: string): unknown {
    if (key === "userGamedata") return null;
    if (key === "upload_time") return null;
    return [];
}

function transformCards(cards: CardWithParameters[]): CardWithParameters[] {

    return cards.map((card) => {
        if (!card.cardParameters || Array.isArray(card.cardParameters)) {
            return card;
        }
        const params = card.cardParameters;
        const transformed: CardParameterEntry[] = [];
        for (const [paramType, powers] of Object.entries(params)) {
            powers.forEach((power: number, index: number) => {
                const cardLevel = index + 1;
                const paramIndex = paramType === "param1" ? 1 : paramType === "param2" ? 2 : 3;
                const id = paramIndex * 10000 + (card.id % 10000) * 100 + cardLevel;
                transformed.push({
                    id,
                    cardId: card.id,
                    cardLevel,
                    cardParameterType: paramType,
                    power,
                });
            });
        }
        return { ...card, cardParameters: transformed };
    });
}

function calcDuration() {
    const startAt = performance.now();
    return {
        startAt,
        done() {
            return performance.now() - startAt;
        },
    };
}

class SnowyDataProvider implements DataProvider {
    private userDataCache: UserDataMap | null = null;

    constructor(
        private userId: string,
        private server: HarukiServer = "jp",
        private oauthAccessToken: string | null = null,
    ) {
        if (!["jp", "cn", "tw"].includes(server)) {
            throw new Error(`Unsupported server: ${server}. Only JP, CN, and TW are supported.`);
        }
    }

    public static getCachedInstance(userId: string, server: HarukiServer = "jp", oauthAccessToken: string | null = null): CachedDataProvider {
        return new CachedDataProvider(new SnowyDataProvider(userId, server, oauthAccessToken));
    }

    private async fetchMasterJson(base: string, key: string): Promise<unknown[] | null> {
        try {
            const response = await fetch(`${base}/${key}.json`);
            if (!response.ok) return null;
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html")) return null;
            const text = await response.text();
            if (text.trimStart().startsWith("<")) return null;
            const parsed = JSON.parse(text) as unknown;
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    async getMasterData<T>(key: string): Promise<T[]> {
        const base = MASTER_DATA_BASES["jp"];
        let data = await this.fetchMasterJson(base, key);
        if (data === null) {
            console.warn(`[DeckRecommend] Master data "${key}" not available, using empty array`);
            return [] as T[];
        }
        if (key === "cards") {
            data = transformCards(data as CardWithParameters[]);
        }
        return data as T[];
    }

    async getMusicMeta(): Promise<MusicMeta[]> {
        const response = await fetch(MUSIC_META_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch music meta (${response.status})`);
        }
        return response.json();
    }

    async getUserData<T>(key: string): Promise<T> {
        const all = await this.getUserDataAll();
        if (!(key in all)) {
            throw new Error(`User data key not found: ${key}`);
        }
        return all[key] as T;
    }

    async getUserDataAll(): Promise<UserDataMap> {
        if (this.userDataCache) return this.userDataCache;

        let data: UserDataMap & {
            userCards?: UserCardEntry[];
            userHonors?: UserHonorEntry[];
        };

        if (this.oauthAccessToken) {
            const keys = USER_DATA_KEYS.split(",");
            const responses = await Promise.all(keys.map(async (key) => {
                const response = await fetch(`${OAUTH2_BASE}/game-data/${this.server}/${key}/${this.userId}`, {
                    headers: {
                        Authorization: `Bearer ${this.oauthAccessToken}`,
                    },
                });
                if (response.status === 404) {
                    throw new Error("USER_NOT_FOUND");
                }
                if (response.status === 403) {
                    throw new Error("API_NOT_PUBLIC");
                }
                if (response.status === 400) {
                    console.warn(`[DeckRecommend] OAuth user data key "${key}" returned 400, using fallback default value`);
                    return [key, getDefaultUserDataValue(key)] as const;
                }
                if (!response.ok) {
                    throw new Error(`Failed to fetch user data (${response.status})`);
                }
                return [key, await response.json()] as const;
            }));
            data = Object.fromEntries(responses) as UserDataMap & {
                userCards?: UserCardEntry[];
                userHonors?: UserHonorEntry[];
            };
        } else {
            const response = await fetch(`${HARUKI_SUITE_API}/${this.server}/suite/${this.userId}?key=${USER_DATA_KEYS}`);

            if (response.status === 404) {
                throw new Error("USER_NOT_FOUND");
            }
            if (response.status === 403) {
                throw new Error("API_NOT_PUBLIC");
            }
            if (!response.ok) {
                throw new Error(`Failed to fetch user data (${response.status})`);
            }

            data = (await response.json()) as UserDataMap & {
                userCards?: UserCardEntry[];
                userHonors?: UserHonorEntry[];
            };
        }

        // Filter userCards to ensure only cards existing in JP master data are returned
        if (data.userCards && Array.isArray(data.userCards)) {
            try {
                const masterCards = await this.getMasterData<{ id: number }>("cards");
                const masterCardIds = new Set(masterCards.map((c) => c.id));
                const originalCount = data.userCards.length;
                data.userCards = data.userCards.filter((uc) => masterCardIds.has(uc.cardId));
                console.log(`[DeckRecommend] Filtered userCards: ${originalCount} -> ${data.userCards.length}`);
            } catch (e) {
                console.error("[DeckRecommend] Failed to filter userCards", e);
            }
        }

        // Filter userHonors
        if (data.userHonors && Array.isArray(data.userHonors)) {
            try {
                const masterHonors = await this.getMasterData<{ id: number }>("honors");
                const masterHonorIds = new Set(masterHonors.map((h) => h.id));
                const originalCount = data.userHonors.length;
                data.userHonors = data.userHonors.filter((h) => masterHonorIds.has(h.honorId));
                console.log(`[DeckRecommend] Filtered userHonors: ${originalCount} -> ${data.userHonors.length}`);
            } catch (e) {
                console.error("[DeckRecommend] Failed to filter userHonors", e);
            }
        }

        this.userDataCache = data;
        return data;
    }
}

// ==================== WORKER LOGIC ====================

// Types

export interface WorkerInput {
    mode: "challenge" | "event" | "mysekai" | "custom" | "strongest";
    userId: string;
    server: string;
    oauthAccessToken?: string;
    musicId: number;
    difficulty: string;
    // Challenge mode
    characterId?: number;
    // Event mode
    eventId?: number;
    liveType?: string; // "multi" | "solo" | "auto" | "cheerful"
    supportCharacterId?: number;
    // Card config
    cardConfig: Record<string, CardConfig>;
    // Custom mode: 自定义加成
    customUnit?: string;             // 箱活模式：加成团体（如 "leo_need"）
    customCharacterIds?: number[];   // 混活模式：最多5个加成角色ID
    customCharacterUnits?: Record<number, string>;  // 虚拟歌手角色选择的团体 supportUnit（如 {21: "leo_need"}）
    customAttr?: string;             // 加成属性
    customCharacterBonus?: number;   // 每个角色的加成百分比，默认25
    customAttrBonus?: number;        // 属性加成百分比，默认25
    // Leader character (all modes)
    leaderCharacter?: number;
    // Strongest mode target
    strongestTarget?: "power" | "skill";
}

export interface WorkerOutput {
    type?: "progress" | "result";
    result?: DeckResultLite[];
    challengeHighScore?: ChallengeResultEntry;
    userCards?: UserCardEntry[];
    duration?: number;
    error?: string;
    upload_time?: number;
    // Progress
    stage?: string;
    percent?: number;
    stageLabel?: string;
}

function sendProgress(stage: string, percent: number, stageLabel: string) {
    postMessage({ type: "progress", stage, percent, stageLabel });
}

/** Map liveType string to LiveType enum */
function parseLiveType(liveTypeStr?: string): LiveType {
    switch (liveTypeStr) {
        case "solo": return LiveType.SOLO;
        case "auto": return LiveType.AUTO;
        case "cheerful": return LiveType.CHEERFUL;
        case "multi":
        default: return LiveType.MULTI;
    }
}

async function deckRecommendRunner(args: WorkerInput): Promise<WorkerOutput> {
    const {
        mode, userId, server, oauthAccessToken, musicId, difficulty,
        characterId, cardConfig,
        eventId, liveType: liveTypeStr, supportCharacterId,
        leaderCharacter, strongestTarget,
    } = args;

    sendProgress("fetching", 5, "正在获取用户数据...");

    const dataProvider = new CachedDataProvider(
        new SnowyDataProvider(userId, server as HarukiServer, oauthAccessToken || null)
    );

    // Parallel preload all data for speed
    await Promise.all([
        dataProvider.getUserDataAll(),
        dataProvider.getMusicMeta(),
        dataProvider.preloadMasterData(PRELOAD_MASTER_KEYS),
    ]);

    sendProgress("processing", 25, "数据加载完成，预处理中...");

    const userCards = await dataProvider.getUserData<UserCardEntry[]>("userCards");
    const uploadTime = await dataProvider.getUserData<number | undefined>("upload_time").catch(() => undefined);

    // Mysekai mode: no music needed
    if (mode === "mysekai") {
        return await runMysekaiMode(args, dataProvider, userCards, uploadTime);
    }

    // Custom mode
    if (mode === "custom") {
        return await runCustomMode(args, dataProvider, userCards, uploadTime);
    }

    // Strongest mode: pure power or skill optimization, no event
    if (mode === "strongest") {
        return await runStrongestMode(args, dataProvider, userCards, uploadTime);
    }

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);

    sendProgress("calculating", 40, "开始计算最优卡组...");

    if (mode === "challenge") {
        if (!characterId) throw new Error("characterId is required for challenge mode");

        const userChallengeLiveSoloResults = await dataProvider.getUserData<ChallengeResultEntry[]>(
            "userChallengeLiveSoloResults"
        );
        const userChallengeLiveSoloResult = userChallengeLiveSoloResults?.find(
            (it) => it.characterId === characterId
        );

        const challengeLiveRecommend = new ChallengeLiveDeckRecommend(dataProvider);
        sendProgress("calculating", 50, "挑战Live组卡计算中...");
        const currentDuration = calcDuration();
        const result = await challengeLiveRecommend.recommendChallengeLiveDeck(
            characterId,
            {
                musicMeta,
                limit: 10,
                member: 5,
                cardConfig,
                leaderCharacter: leaderCharacter || undefined,
                debugLog: (str: string) => {
                    console.log("[Worker]", str);
                },
            }
        );

        sendProgress("done", 100, "计算完成");
        return {
            type: "result",
            challengeHighScore: userChallengeLiveSoloResult,
            result: result as unknown as DeckResultLite[],
            userCards,
            duration: currentDuration.done(),
            upload_time: uploadTime,
        };
    }

    // Event mode
    if (!eventId) throw new Error("eventId is required for event mode");

    let computedLiveType = parseLiveType(liveTypeStr);

    // Check event type for cheerful carnival conversion
    const events = await dataProvider.getMasterData<EventInfoLite>("events");
    const event0 = events.find((it) => it.id === eventId);
    if (!event0) throw new Error(`Event not found: ${eventId}`);

    if (event0.eventType === "cheerful_carnival" && computedLiveType === LiveType.MULTI) {
        computedLiveType = LiveType.CHEERFUL;
    }

    sendProgress("calculating", 50, "活动组卡计算中...");
    const eventDeckRecommend = new EventDeckRecommend(dataProvider);
    const currentDuration = calcDuration();
    const result = await eventDeckRecommend.recommendEventDeck(
        eventId,
        computedLiveType,
        {
            musicMeta,
            limit: 10,
            cardConfig,
            leaderCharacter: leaderCharacter || undefined,
            debugLog: (str: string) => {
                console.log("[Worker]", str);
            },
        },
        supportCharacterId || 0
    );

    sendProgress("done", 100, "计算完成");
    return {
        type: "result",
        result: result as unknown as DeckResultLite[],
        userCards,
        duration: currentDuration.done(),
        upload_time: uploadTime,
    };
}

// ==================== MYSEKAI MODE ====================

async function runMysekaiMode(
    args: WorkerInput,
    dataProvider: CachedDataProvider,
    userCards: UserCardEntry[],
    uploadTime: number | undefined
): Promise<WorkerOutput> {
    const { eventId, supportCharacterId, cardConfig, leaderCharacter } = args;
    if (!eventId) throw new Error("eventId is required for mysekai mode");

    sendProgress("calculating", 40, "烤森组卡计算中...");

    // Get event config
    const events = await dataProvider.getMasterData<EventInfoLite>("events");
    const event0 = events.find((it) => it.id === eventId);
    if (!event0) throw new Error(`Event not found: ${eventId}`);

    // Use EventDeckRecommend to get high-bonus decks, then re-rank by mysekai PT
    const eventDeckRecommend = new EventDeckRecommend(dataProvider);
    const currentDuration = calcDuration();

    // We need a dummy musicMeta for the calculator
    const musicMetas = await dataProvider.getMusicMeta();
    const dummyMusicMeta = musicMetas[0]; // any music meta works since we'll override scoring

    sendProgress("calculating", 55, "计算最优烤森卡组...");

    const rawResults = (await eventDeckRecommend.recommendEventDeck(
        eventId,
        LiveType.MULTI,
        {
            musicMeta: dummyMusicMeta,
            limit: 10,
            cardConfig,
            leaderCharacter: leaderCharacter || undefined,
            debugLog: (str: string) => {
                console.log("[Worker:Mysekai]", str);
            },
        },
        supportCharacterId || 0
    )) as unknown as DeckResultLite[];

    // Re-calculate mysekai event points for each deck
    const mysekaiResults = rawResults.map((deck) => {
        const totalPower = deck.power?.total || 0;
        const eventBonus = (deck.eventBonus || 0) + (deck.supportDeckBonus || 0);

        let powerBonus = 1 + (totalPower / 450000);
        powerBonus = Math.floor(powerBonus * 10 + 1e-6) / 10.0;
        const eventBonusRate = Math.floor(eventBonus + 1e-6) / 100.0;
        const mysekaiPt = Math.floor(powerBonus * (1 + eventBonusRate) + 1e-6) * 500;

        return {
            ...deck,
            score: mysekaiPt,
            mysekaiPt,
            mysekaiPowerBonus: powerBonus,
            mysekaiEventBonusRate: eventBonusRate,
        };
    });

    // Sort by mysekai PT descending
    mysekaiResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    sendProgress("done", 100, "计算完成");
    return {
        type: "result",
        result: mysekaiResults,
        userCards,
        duration: currentDuration.done(),
        upload_time: uploadTime,
    };
}

// ==================== CUSTOM MODE ====================

/**
 * 从混活自定义参数构建 CustomBonusConfig
 * 每个选中的角色 characterId → 一条 { characterId, bonusRate } 规则
 * 选中的属性 → 一条 { unit: 'any', attr, bonusRate } 规则
 */
function buildCustomBonusConfig(
    characterIds?: number[],
    attr?: string,
    characterBonus: number = 25,
    attrBonus: number = 25,
    characterUnits?: Record<number, string>,
    unit?: string,
    unitBonus: number = 25,
): CustomBonusConfig {
    const rules: CustomBonusRule[] = [];

    // 箱活模式：按团体加成
    if (unit) {
        if (unit === "piapro") {
            rules.push({ unit: "piapro", bonusRate: unitBonus });
        } else {
            // 非 piapro 团体：该团体的原创角色 + 该团体的虚拟歌手应援卡 + 原版虚拟歌手
            rules.push({ unit, bonusRate: unitBonus });
        }
    }

    // 混活模式：按角色加成
    if (characterIds) {
        for (const cid of characterIds) {
            const isVirtualSinger = cid >= 21 && cid <= 26;
            const selectedUnit = characterUnits?.[cid];

            if (isVirtualSinger && selectedUnit) {
                if (selectedUnit === "none") {
                    // 选了原版 → 仅原版卡获得加成
                    rules.push({ unit: "any", characterId: cid, supportUnit: "none", bonusRate: characterBonus });
                } else {
                    // 选了具体团体（如 leo_need）→ 该团体卡 + 原版卡都获得加成
                    rules.push({ unit: "any", characterId: cid, supportUnit: selectedUnit, bonusRate: characterBonus });
                    rules.push({ unit: "any", characterId: cid, supportUnit: "none", bonusRate: characterBonus });
                }
            } else {
                // 非虚拟歌手 或 未指定团体 → 匹配所有
                rules.push({ unit: "any", characterId: cid, bonusRate: characterBonus });
            }
        }
    }

    if (attr && attr !== "any") {
        rules.push({ unit: "any", attr, bonusRate: attrBonus });
    }

    return { rules };
}

async function runCustomMode(
    args: WorkerInput,
    dataProvider: CachedDataProvider,
    userCards: UserCardEntry[],
    uploadTime: number | undefined
): Promise<WorkerOutput> {
    const {
        musicId, difficulty, cardConfig, liveType: liveTypeStr,
        customUnit, customCharacterIds, customAttr,
        customCharacterBonus = 25, customAttrBonus = 25,
        customCharacterUnits,
        leaderCharacter,
        supportCharacterId,
    } = args;

    sendProgress("calculating", 40, "自定义组卡计算中...");

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);
    const computedLiveType = parseLiveType(liveTypeStr);

    sendProgress("calculating", 55, "使用自定义加成计算中...");

    const currentDuration = calcDuration();

    // 构建 CustomBonusConfig，交由库的 CardCustomBonusCalculator 处理
    const customBonuses = buildCustomBonusConfig(
        customCharacterIds, customAttr, customCharacterBonus, customAttrBonus,
        customCharacterUnits, customUnit
    );

    // 自定义 scoreFunc：复用活动PT公式（EventCalculator.getEventPoint 逻辑）
    // 安全处理 eventBonus 为 undefined 的情况（未匹配任何规则的卡牌）
    const customScoreFunc = (meta: MusicMeta, deckDetail: DeckResultLite) => {
        const selfScore = LiveCalculator.getLiveScoreByDeck(
            deckDetail as unknown as Parameters<typeof LiveCalculator.getLiveScoreByDeck>[0],
            meta, computedLiveType
        );
        const deckBonus = (deckDetail.eventBonus ?? 0) + (deckDetail.supportDeckBonus ?? 0);
        const musicRate0 = (meta.event_rate || 100) / 100;
        const deckRate = deckBonus / 100 + 1;

        let baseScore: number;
        if (computedLiveType === LiveType.SOLO || computedLiveType === LiveType.AUTO) {
            baseScore = 100 + Math.floor(selfScore / 20000);
        } else {
            const otherScore = 4 * selfScore;
            baseScore = 110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore / 340000));
        }
        return Math.floor(baseScore * musicRate0 * deckRate);
    };

    const customEventConfig: EventConfig = { customBonuses };
    if (customUnit && customUnit !== "any") {
        customEventConfig.worldBloomSupportUnit = customUnit;
        customEventConfig.specialCharacterId = supportCharacterId ?? 0;
    }

    const baseRecommend = new BaseDeckRecommend(dataProvider);
    const result = (await baseRecommend.recommendHighScoreDeck(
        userCards as unknown as UserCard[],
        customScoreFunc as any,
        {
            musicMeta,
            limit: 10,
            cardConfig,
            leaderCharacter: leaderCharacter || undefined,
            debugLog: (str: string) => {
                console.log("[Worker:Custom]", str);
            },
        },
        computedLiveType,
        // 通过 EventConfig.customBonuses 传递，库会在 CardCalculator.getCardDetail 中
        // 调用 CardCustomBonusCalculator.applyCustomBonus 为每张卡计算自定义加成
        customEventConfig
    )) as unknown as DeckResultLite[];

    // 结果中 eventBonus 已由库计算（来自 CustomBonusConfig 规则匹配），直接使用
    const enriched = result.map((deck) => {
        const totalCustomBonus = deck.eventBonus ?? 0;
        return {
            ...deck,
            eventBonus: totalCustomBonus,
            customBonus: totalCustomBonus,
        };
    });

    sendProgress("done", 100, "计算完成");
    return {
        type: "result",
        result: enriched,
        userCards,
        duration: currentDuration.done(),
        upload_time: uploadTime,
    };
}

// ==================== STRONGEST MODE ====================

async function runStrongestMode(
    args: WorkerInput,
    dataProvider: CachedDataProvider,
    userCards: UserCardEntry[],
    uploadTime: number | undefined
): Promise<WorkerOutput> {
    const {
        musicId, difficulty, cardConfig, liveType: liveTypeStr,
        leaderCharacter, strongestTarget = "power",
    } = args;

    sendProgress("calculating", 40, "最强组卡计算中...");

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);
    const computedLiveType = parseLiveType(liveTypeStr);

    const target = strongestTarget === "skill"
        ? RecommendTarget.Skill
        : RecommendTarget.Power;

    sendProgress("calculating", 55, `${strongestTarget === "skill" ? "技能实效" : "综合力"}最优计算中...`);

    const currentDuration = calcDuration();
    const baseRecommend = new BaseDeckRecommend(dataProvider);

    // Use a dummy scoreFunc — it will be overridden by target in recommendHighScoreDeck
    const dummyScoreFunc = (_meta: MusicMeta, _deck: unknown) => 0;

    const result = (await baseRecommend.recommendHighScoreDeck(
        userCards as unknown as UserCard[],
        dummyScoreFunc as any,
        {
            musicMeta,
            limit: 10,
            cardConfig,
            leaderCharacter: leaderCharacter || undefined,
            target,
            debugLog: (str: string) => {
                console.log("[Worker:Strongest]", str);
            },
        },
        computedLiveType,
        {} // no event config
    )) as unknown as DeckResultLite[];

    sendProgress("done", 100, "计算完成");
    return {
        type: "result",
        result,
        userCards,
        duration: currentDuration.done(),
        upload_time: uploadTime,
    };
}

// Worker message handler
addEventListener("message", (event: MessageEvent<{ args: WorkerInput }>) => {
    deckRecommendRunner(event.data.args)
        .then((result) => {
            postMessage({ ...result, type: "result" });
        })
        .catch((err) => {
            postMessage({
                type: "result",
                error: err.message || String(err),
            });
        });
});
