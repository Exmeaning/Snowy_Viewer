/**
 * 页面表单状态 → worker 入参的纯映射。
 *
 * 单独成模块是为了可测：worker 只认 `simulatedEvent` / `userDataOverrides` /
 * `leaderCharacterId` 这些成组字段，散着发过去不会报错，只会静默失效
 * （模拟活动退回真实活动并报缺 ID、指定队长与进阶覆盖被丢掉）。
 * 运行时零依赖（只有 import type），Node 可直接导入做断言。
 */
import type {
    DeckAreaItemOverride,
    DeckCharacterRankOverride,
    DeckLiveType,
    DeckMysekaiFixtureOverride,
    DeckMysekaiGateOverride,
    DeckRecommendMode,
    DeckSingleCardOverride,
    DeckSkillOrder,
    DeckSkillReference,
    DeckTarget,
    DeckTrainingConfig,
    DeckWorkerInput,
} from "./engine-types";

/** 自定义加成 / 模拟活动加成的两种口径：整团 或 指定角色集合。 */
export type CustomSubMode = "unit" | "character";

/** 保存到 localStorage 的可序列化表单状态。 */
export interface DeckFormState {
    mode: DeckRecommendMode;
    eventId: string;
    selectedEventType: string | null;
    eventBonusCharacterIds: number[];
    liveType: DeckLiveType;
    supportCharacterId: number | null;
    challengeCharacterId: number | null;
    musicId: string;
    difficulty: string;
    cardConfig: Record<string, DeckTrainingConfig>;
    target: DeckTarget;
    bonusTargets: string;
    simulateEnabled: boolean;
    simType: string;
    simAttr: string;
    simUnit: string;
    simBonusMode: CustomSubMode;
    simCharacterIds: number[];
    simCharacterUnits: Record<number, string>;
    simTurn: number;
    simCharacterId: number | null;
    customSubMode: CustomSubMode;
    customUnit: string;
    customCharacterIds: number[];
    customCharacterUnits: Record<number, string>;
    customAttr: string;
    strongestTarget: "power" | "skill";
    multiTeammatePower: string;
    multiTeammateScoreUp: string;
    multiScoreUpLowerBound: string;
    skillOrder: DeckSkillOrder;
    specificSkillOrder: string;
    skillReference: DeckSkillReference;
    keepAfterTrainingState: boolean;
    bestSkillAsLeader: boolean;
    minimize: boolean;
    supportMasterMax: boolean;
    supportSkillMax: boolean;
    filterOtherUnit: boolean;
    boost: string;
    otherScore: string;
    leaderCharacterId: number | null;
    fixedCards: number[];
    fixedCharacters: number[];
    excludedCards: number[];
    singleCardOverrides: DeckSingleCardOverride[];
    areaItemLevel: string;
    areaItemOverrides: DeckAreaItemOverride[];
    characterRank: string;
    characterRankOverrides: DeckCharacterRankOverride[];
    mysekaiGateLevel: string;
    mysekaiGateOverrides: DeckMysekaiGateOverride[];
    mysekaiFixtureBonusRate: string;
    mysekaiFixtureOverrides: DeckMysekaiFixtureOverride[];
    unitFilter: string;
    attrFilter: string;
    characterFilterIds: number[];
    useCurrentDeck: boolean;
    limit: string;
    timeoutSeconds: string;
}

/** 各稀有度的默认养成假设（满级 + 已读前后篇）。 */
export const DEFAULT_CARD_CONFIG: Record<string, DeckTrainingConfig> = {
    rarity_1: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
};

/** 表单初始值；测试与页面共用同一份，避免两边漂移。 */
export const DEFAULT_DECK_FORM_STATE: DeckFormState = {
    mode: "event",
    eventId: "",
    selectedEventType: null,
    eventBonusCharacterIds: [],
    liveType: "multi",
    supportCharacterId: null,
    challengeCharacterId: null,
    musicId: "",
    difficulty: "master",
    cardConfig: DEFAULT_CARD_CONFIG,
    target: "score",
    bonusTargets: "",
    simulateEnabled: false,
    simType: "marathon",
    simAttr: "",
    simUnit: "",
    simBonusMode: "unit",
    simCharacterIds: [],
    simCharacterUnits: {},
    simTurn: 3,
    simCharacterId: null,
    customSubMode: "unit",
    customUnit: "light_sound",
    customCharacterIds: [],
    customCharacterUnits: {},
    customAttr: "",
    strongestTarget: "power",
    multiTeammatePower: "",
    multiTeammateScoreUp: "",
    multiScoreUpLowerBound: "",
    skillOrder: "average",
    specificSkillOrder: "",
    skillReference: "average",
    keepAfterTrainingState: false,
    bestSkillAsLeader: true,
    minimize: false,
    supportMasterMax: false,
    supportSkillMax: false,
    filterOtherUnit: false,
    boost: "",
    otherScore: "",
    leaderCharacterId: null,
    fixedCards: [],
    fixedCharacters: [],
    excludedCards: [],
    singleCardOverrides: [],
    areaItemLevel: "",
    areaItemOverrides: [],
    characterRank: "",
    characterRankOverrides: [],
    mysekaiGateLevel: "",
    mysekaiGateOverrides: [],
    mysekaiFixtureBonusRate: "",
    mysekaiFixtureOverrides: [],
    unitFilter: "",
    attrFilter: "",
    characterFilterIds: [],
    useCurrentDeck: false,
    limit: "10",
    timeoutSeconds: "120",
};


export interface DeckWorkerArgsContext {
    server: string;
    /** 未 trim 的原始输入。 */
    userId: string;
    /** 已解析的目标加成档位；未启用或解析失败为 null。 */
    bonusTargets: number[] | null;
}

/** 把表单状态打包成 worker 入参。纯函数，无副作用。 */
export function buildDeckWorkerArgs(
    state: DeckFormState,
    { server, userId, bonusTargets }: DeckWorkerArgsContext,
): DeckWorkerInput {
    const {
        mode, eventId, selectedEventType, liveType, supportCharacterId,
        challengeCharacterId, musicId, difficulty, cardConfig, target,
        simulateEnabled, simType, simAttr, simUnit, simBonusMode, simCharacterIds,
        simCharacterUnits, simTurn, simCharacterId,
        customSubMode, customUnit, customCharacterIds, customCharacterUnits, customAttr,
        strongestTarget, multiTeammatePower, multiTeammateScoreUp, multiScoreUpLowerBound,
        skillOrder, specificSkillOrder, skillReference, keepAfterTrainingState,
        bestSkillAsLeader, minimize, supportMasterMax, supportSkillMax, filterOtherUnit,
        boost, otherScore, leaderCharacterId, fixedCards, fixedCharacters,
        excludedCards, singleCardOverrides, limit, timeoutSeconds,
        areaItemLevel, areaItemOverrides, characterRank, characterRankOverrides,
        mysekaiGateLevel, mysekaiGateOverrides, mysekaiFixtureBonusRate, mysekaiFixtureOverrides,
        unitFilter, attrFilter, characterFilterIds,
    } = state;
    const needsMusic = mode !== "mysekai" && mode !== "weakest";

    return {
            server,
            userId: userId.trim(),
            mode,
            eventId: eventId ? parseInt(eventId) : undefined,
            eventType: selectedEventType ?? undefined,
            liveType,
            supportCharacterId: (mode === "event" && selectedEventType === "world_bloom") ? (supportCharacterId ?? undefined) : undefined,
            challengeCharacterId: challengeCharacterId ?? undefined,
            musicId: musicId ? parseInt(musicId) : undefined,
            difficulty: needsMusic ? difficulty : undefined,
            cardConfig,
            target: mode === "event" ? target : undefined,
            bonusTargets: bonusTargets ?? undefined,
            // 模拟活动：整个条件打包给 worker；缺了它 worker 会退回真实活动分支并因缺 eventId 报错。
            simulatedEvent: mode === "event" && simulateEnabled
                ? {
                      eventType: simType,
                      attr: simType !== "world_bloom" && simAttr ? simAttr : undefined,
                      unit: simType === "world_bloom"
                          ? (simTurn !== 3 ? simUnit || undefined : undefined)
                          : (simBonusMode === "unit" ? simUnit || undefined : undefined),
                      characterIds: simType !== "world_bloom" && simBonusMode === "character" && simCharacterIds.length > 0
                          ? simCharacterIds
                          : undefined,
                      characterUnits: simType !== "world_bloom" && simBonusMode === "character"
                          && Object.keys(simCharacterUnits).length > 0
                          ? simCharacterUnits
                          : undefined,
                      worldBloomTurn: simType === "world_bloom" ? simTurn : undefined,
                      worldBloomCharacterId:
                          simType === "world_bloom" && simTurn === 3 ? simCharacterId ?? undefined : undefined,
                  }
                : undefined,
            customUnit: customSubMode === "unit" ? customUnit : undefined,
            customCharacterIds: customSubMode === "character" ? customCharacterIds : undefined,
            customCharacterUnits: customSubMode === "character" ? customCharacterUnits : undefined,
            customAttr: customAttr || undefined,
            strongestTarget: mode === "strongest" ? strongestTarget : undefined,
            multiTeammatePower: multiTeammatePower ? parseInt(multiTeammatePower) : undefined,
            multiTeammateScoreUp: multiTeammateScoreUp ? parseInt(multiTeammateScoreUp) : undefined,
            multiScoreUpLowerBound: multiScoreUpLowerBound ? parseInt(multiScoreUpLowerBound) : undefined,
            skillOrder,
            specificSkillOrder: skillOrder === "specific" ? specificSkillOrder : undefined,
            skillReference,
            keepAfterTrainingState,
            bestSkillAsLeader,
            minimize: mode === "weakest" ? true : minimize,
            supportMasterMax,
            supportSkillMax,
            filterOtherUnit,
            boost: boost ? parseInt(boost) : undefined,
            otherScore: otherScore ? parseInt(otherScore) : undefined,
            fixedCards: fixedCards.length > 0 ? [...fixedCards] : undefined,
            fixedCharacters: fixedCharacters.length > 0 ? fixedCharacters : undefined,
            excludedCards: excludedCards.length > 0 ? excludedCards : undefined,
            singleCardOverrides: singleCardOverrides.length > 0 ? singleCardOverrides : undefined,
            // 指定队长角色（引擎 forced_leader_character_id）。
            leaderCharacterId: leaderCharacterId ?? undefined,
            // 进阶数据覆盖：worker 只读 userDataOverrides 这一个对象；
            // 最弱组卡按账号真实数据算，不带覆盖。
            userDataOverrides: mode === "weakest" ? undefined : {
                areaItemLevel: areaItemLevel ? parseInt(areaItemLevel) : null,
                areaItemLevelOverrides: areaItemOverrides.length > 0 ? areaItemOverrides : undefined,
                characterRank: characterRank ? parseInt(characterRank) : null,
                characterRankOverrides: characterRankOverrides.length > 0 ? characterRankOverrides : undefined,
                mysekaiGateLevel: mysekaiGateLevel ? parseInt(mysekaiGateLevel) : null,
                mysekaiGateLevelOverrides: mysekaiGateOverrides.length > 0 ? mysekaiGateOverrides : undefined,
                mysekaiFixtureBonusRate: mysekaiFixtureBonusRate ? parseFloat(mysekaiFixtureBonusRate) : null,
                mysekaiFixtureBonusRateOverrides: mysekaiFixtureOverrides.length > 0 ? mysekaiFixtureOverrides : undefined,
            },
            unitFilter: unitFilter || undefined,
            attrFilter: attrFilter || undefined,
            characterFilterIds: characterFilterIds.length > 0 ? characterFilterIds : undefined,
            limit: Math.min(30, Math.max(1, parseInt(limit) || 10)),
            timeoutMs: Math.min(300, Math.max(5, parseInt(timeoutSeconds) || 120)) * 1000,
    };
}
