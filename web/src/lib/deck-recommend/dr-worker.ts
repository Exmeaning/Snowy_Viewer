/**
 * Web Worker for deck recommendation computation
 * Runs sekai-calculator in a background thread to avoid blocking the UI
 *
 * Deck recommendation code source: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * Some algorithm optimizations are adapted from https://github.com/NeuraXmy/sekai-deck-recommend-cpp by luna-cha
 */
import {
    BaseDeckRecommend,
    type CardConfig,
    CachedDataProvider,
    ChallengeLiveDeckRecommend,
    type CustomBonusConfig,
    type CustomBonusRule,
    type EventConfig,
    EventDeckRecommend,
    LiveCalculator,
    LiveType,
    MusicMeta,
    RecommendTarget,
    type UserCard,
} from "sekai-calculator";
import { calcDuration, PRELOAD_MASTER_KEYS, type HarukiServer, SnowyDataProvider } from "./data-provider";

interface UserCardEntry {
    cardId: number;
    masterRank?: number;
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
    // Custom bonus mode
    customUnit?: string;             // Unit-event bonus unit, e.g. "leo_need"
    customCharacterIds?: number[];   // Mixed-event bonus character IDs, up to 5
    customCharacterUnits?: Record<number, string>;  // Virtual Singer supportUnit selection, e.g. {21: "leo_need"}
    customAttr?: string;             // Bonus attribute
    customCharacterBonus?: number;   // Bonus percentage per character, default 25
    customAttrBonus?: number;        // Attribute bonus percentage, default 25
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
    progressKey?: string;
}

function sendProgress(stage: string, percent: number, progressKey: string) {
    postMessage({ type: "progress", stage, percent, progressKey });
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
        leaderCharacter,
    } = args;

    sendProgress("fetching", 5, "page.deckRecommend.progress.fetchingUserData");

    const dataProvider = new CachedDataProvider(
        new SnowyDataProvider(userId, server as HarukiServer, oauthAccessToken || null)
    );

    // Parallel preload all data for speed
    await Promise.all([
        dataProvider.getUserDataAll(),
        dataProvider.getMusicMeta(),
        dataProvider.preloadMasterData(PRELOAD_MASTER_KEYS),
    ]);

    sendProgress("processing", 25, "page.deckRecommend.progress.processingData");

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

    sendProgress("calculating", 40, "page.deckRecommend.progress.calculatingBestDeck");

    if (mode === "challenge") {
        if (!characterId) throw new Error("characterId is required for challenge mode");

        const userChallengeLiveSoloResults = await dataProvider.getUserData<ChallengeResultEntry[]>(
            "userChallengeLiveSoloResults"
        );
        const userChallengeLiveSoloResult = userChallengeLiveSoloResults?.find(
            (it) => it.characterId === characterId
        );

        const challengeLiveRecommend = new ChallengeLiveDeckRecommend(dataProvider);
        sendProgress("calculating", 50, "page.deckRecommend.progress.challengeLive");
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

        sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
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

    sendProgress("calculating", 50, "page.deckRecommend.progress.eventDeck");
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

    sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
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

    sendProgress("calculating", 40, "page.deckRecommend.progress.mysekaiDeck");

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

    sendProgress("calculating", 55, "page.deckRecommend.progress.bestMysekai");

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

    sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
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
 * Build CustomBonusConfig from mixed-event custom parameters.
 * Each selected characterId becomes one { characterId, bonusRate } rule.
 * The selected attribute becomes one { unit: 'any', attr, bonusRate } rule.
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

    // Unit-event mode: apply unit bonus
    if (unit) {
        if (unit === "piapro") {
            rules.push({ unit: "piapro", bonusRate: unitBonus });
        } else {
            // Non-piapro units: original characters, unit-support Virtual Singer cards, and original Virtual Singer cards
            rules.push({ unit, bonusRate: unitBonus });
        }
    }

    // Mixed-event mode: apply character bonus
    if (characterIds) {
        for (const cid of characterIds) {
            const isVirtualSinger = cid >= 21 && cid <= 26;
            const selectedUnit = characterUnits?.[cid];

            if (isVirtualSinger && selectedUnit) {
                if (selectedUnit === "none") {
                    // Original selected: only original cards receive the bonus
                    rules.push({ unit: "any", characterId: cid, supportUnit: "none", bonusRate: characterBonus });
                } else {
                    // Specific unit selected, e.g. leo_need: both that unit's cards and original cards receive the bonus
                    rules.push({ unit: "any", characterId: cid, supportUnit: selectedUnit, bonusRate: characterBonus });
                    rules.push({ unit: "any", characterId: cid, supportUnit: "none", bonusRate: characterBonus });
                }
            } else {
                // Non-Virtual Singer or no selected unit: match all cards for that character
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

    sendProgress("calculating", 40, "page.deckRecommend.progress.customDeck");

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);
    const computedLiveType = parseLiveType(liveTypeStr);

    sendProgress("calculating", 55, "page.deckRecommend.progress.customBonusCalculating");

    const currentDuration = calcDuration();

    // Build CustomBonusConfig and let the library's CardCustomBonusCalculator handle it
    const customBonuses = buildCustomBonusConfig(
        customCharacterIds, customAttr, customCharacterBonus, customAttrBonus,
        customCharacterUnits, customUnit
    );

    // Custom scoreFunc: reuse the event PT formula from EventCalculator.getEventPoint.
    // Safely handle undefined eventBonus for cards that do not match any rule.
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
        customScoreFunc as unknown as Parameters<typeof baseRecommend.recommendHighScoreDeck>[1],
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
        // Pass through EventConfig.customBonuses so the library can call
        // CardCustomBonusCalculator.applyCustomBonus for each card.
        customEventConfig
    )) as unknown as DeckResultLite[];

    // eventBonus has already been calculated by the library from CustomBonusConfig rule matching.
    const enriched = result.map((deck) => {
        const totalCustomBonus = deck.eventBonus ?? 0;
        return {
            ...deck,
            eventBonus: totalCustomBonus,
            customBonus: totalCustomBonus,
        };
    });

    sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
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

    sendProgress("calculating", 40, "page.deckRecommend.progress.strongestDeck");

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);
    const computedLiveType = parseLiveType(liveTypeStr);

    const target = strongestTarget === "skill"
        ? RecommendTarget.Skill
        : RecommendTarget.Power;

    sendProgress("calculating", 55, strongestTarget === "skill" ? "page.deckRecommend.progress.strongestSkill" : "page.deckRecommend.progress.strongestPower");

    const currentDuration = calcDuration();
    const baseRecommend = new BaseDeckRecommend(dataProvider);

    // Use a dummy scoreFunc — it will be overridden by target in recommendHighScoreDeck
    const dummyScoreFunc = (_meta: MusicMeta, _deck: unknown) => 0;

    const result = (await baseRecommend.recommendHighScoreDeck(
        userCards as unknown as UserCard[],
        dummyScoreFunc as unknown as Parameters<typeof baseRecommend.recommendHighScoreDeck>[1],
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

    sendProgress("done", 100, "page.deckRecommend.progress.calculationComplete");
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
