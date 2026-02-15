/**
 * Web Worker for deck recommendation computation
 * Runs sekai-calculator in a background thread to avoid blocking the UI
 */
import {
    CachedDataProvider,
    ChallengeLiveDeckRecommend,
    EventDeckRecommend,
    LiveCalculator,
    LiveType,
    DataProvider,
    MusicMeta,
} from "sekai-calculator";

// ==================== Data Provider Implementation ====================

// Server type
type HarukiServer = "jp" | "cn" | "tw";

// Music meta URL
const MUSIC_META_URL = "https://assets.exmeaning.com/musicmeta/music_metas.json";

// Master data URLs - use project's self-hosted official source
const MASTER_DATA_BASES: Record<string, string> = {
    jp: "https://sekaimaster.exmeaning.com/master",
    cn: "https://sekaimaster-cn.exmeaning.com/master",
};

// Haruki suite API base
const HARUKI_SUITE_API = "https://suite-api.haruki.seiunx.com/public";

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

/**
 * Transform official cardParameters format to sekai-calculator expected format.
 * Official: { param1: number[], param2: number[], param3: number[] }
 * sekai-calculator expects: Array<{ id, cardId, cardLevel, cardParameterType, power }>
 */
function transformCards(cards: any[]): any[] {
    return cards.map((card: any) => {
        if (!card.cardParameters || Array.isArray(card.cardParameters)) {
            // Already in array format or missing, skip transform
            return card;
        }
        const params = card.cardParameters as Record<string, number[]>;
        const transformed: any[] = [];
        for (const [paramType, powers] of Object.entries(params)) {
            powers.forEach((power: number, index: number) => {
                const cardLevel = index + 1;
                // Generate a deterministic ID: paramType index * 1000 + cardId * base + level
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

class SnowyDataProvider implements DataProvider {
    private userDataCache: Record<string, any> | null = null;

    constructor(
        private userId: string,
        private server: HarukiServer = "jp"
    ) {
        // Runtime validation for server
        if (!["jp", "cn", "tw"].includes(server)) {
            throw new Error(`Unsupported server: ${server}. Only JP, CN, and TW are supported.`);
        }
    }

    /**
     * Create a cached instance for better performance
     */
    public static getCachedInstance(userId: string, server: HarukiServer = "jp"): CachedDataProvider {
        return new CachedDataProvider(new SnowyDataProvider(userId, server));
    }

    /**
     * Fetch a single master data JSON, validating it's actually JSON.
     * Returns null if the response is not valid JSON (e.g. HTML 404 page).
     */
    private async fetchMasterJson(base: string, key: string): Promise<any[] | null> {
        try {
            const response = await fetch(`${base}/${key}.json`);
            if (!response.ok) return null;
            // Guard against HTML error pages returned with 200 status
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html")) return null;
            const text = await response.text();
            if (text.trimStart().startsWith("<")) return null; // HTML response
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    async getMasterData<T>(key: string): Promise<T[]> {
        // FORCE JP MASTER DATA for all servers
        // This ensures compatibility with newer events even for CN/TW/KR players
        const base = MASTER_DATA_BASES["jp"];

        let data = await this.fetchMasterJson(base, key);

        // If still null, return empty array (non-critical master data may not exist)
        if (data === null) {
            console.warn(`[DeckRecommend] Master data "${key}" not available, using empty array`);
            return [] as any;
        }

        // Transform cards data for sekai-calculator compatibility
        if (key === "cards") {
            data = transformCards(data);
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
        return all[key];
    }

    async getUserDataAll(): Promise<Record<string, any>> {
        if (this.userDataCache) return this.userDataCache;

        const url = `${HARUKI_SUITE_API}/${this.server}/suite/${this.userId}?key=${USER_DATA_KEYS}`;
        const response = await fetch(url);

        if (response.status === 404) {
            throw new Error("USER_NOT_FOUND");
        }
        if (response.status === 403) {
            throw new Error("API_NOT_PUBLIC");
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch user data (${response.status})`);
        }

        const data = await response.json();

        // Filter userCards to ensure only cards existing in JP master data are returned
        // This prevents "Object not found" errors when using non-JP accounts with JP master data
        if (data.userCards && Array.isArray(data.userCards)) {
            try {
                const masterCards = await this.getMasterData<any>("cards");
                const masterCardIds = new Set(masterCards.map((c) => c.id));
                const originalCount = data.userCards.length;
                data.userCards = data.userCards.filter((uc: any) => masterCardIds.has(uc.cardId));
                console.log(`[DeckRecommend] Filtered userCards in getUserDataAll: ${originalCount} -> ${data.userCards.length}`);
            } catch (e) {
                console.error("[DeckRecommend] Failed to filter userCards in getUserDataAll", e);
            }
        }

        // Filter userHonors (PROFILE TITLES)
        if (data.userHonors && Array.isArray(data.userHonors)) {
            try {
                const masterHonors = await this.getMasterData<any>("honors");
                const masterHonorIds = new Set(masterHonors.map((h) => h.id));
                const originalCount = data.userHonors.length;
                data.userHonors = data.userHonors.filter((h: any) => masterHonorIds.has(h.honorId));
                console.log(`[DeckRecommend] Filtered userHonors in getUserDataAll: ${originalCount} -> ${data.userHonors.length}`);
            } catch (e) {
                console.error("[DeckRecommend] Failed to filter userHonors in getUserDataAll", e);
            }
        }

        this.userDataCache = data;
        return data;
    }
}

// ==================== End Data Provider Implementation ====================

function calcDuration() {
    const startAt = performance.now();
    return {
        startAt,
        done() {
            return performance.now() - startAt;
        },
    };
}

// Master data keys needed for preloading
const PRELOAD_MASTER_KEYS = [
    "areaItemLevels", "cards", "cardMysekaiCanvasBonuses", "cardRarities",
    "characterRanks", "cardEpisodes", "events", "eventCards",
    "eventRarityBonusRates", "eventDeckBonuses", "gameCharacters",
    "gameCharacterUnits", "honors", "masterLessons", "mysekaiGates",
    "mysekaiGateLevels", "skills", "worldBloomDifferentAttributeBonuses",
    "worldBloomSupportDeckBonuses", "worldBloomSupportDeckUnitEventLimitedBonuses",
];

export interface WorkerInput {
    mode: "challenge" | "event";
    userId: string;
    server: string;
    musicId: number;
    difficulty: string;
    // Challenge mode
    characterId?: number;
    // Event mode
    eventId?: number;
    liveType?: string; // "multi" | "solo" | "auto" | "cheerful"
    supportCharacterId?: number;
    // Card config
    cardConfig: Record<string, any>;
}

export interface WorkerOutput {
    result?: any[];
    challengeHighScore?: any;
    userCards?: any[];
    duration?: number;
    error?: string;
}

async function deckRecommendRunner(args: WorkerInput): Promise<WorkerOutput> {
    const {
        mode, userId, server, musicId, difficulty,
        characterId, cardConfig,
        eventId, liveType: liveTypeStr, supportCharacterId,
    } = args;

    const dataProvider = new CachedDataProvider(
        new SnowyDataProvider(userId, server as any)
    );

    // Parallel preload all data for speed
    await Promise.all([
        dataProvider.getUserDataAll(),
        dataProvider.getMusicMeta(),
        dataProvider.preloadMasterData(PRELOAD_MASTER_KEYS),
    ]);

    const userCards = await dataProvider.getUserData<any[]>("userCards");

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);

    if (mode === "challenge") {
        if (!characterId) throw new Error("characterId is required for challenge mode");

        const userChallengeLiveSoloResults = await dataProvider.getUserData<any[]>(
            "userChallengeLiveSoloResults"
        );
        const userChallengeLiveSoloResult = userChallengeLiveSoloResults?.find(
            (it: any) => it.characterId === characterId
        );

        const challengeLiveRecommend = new ChallengeLiveDeckRecommend(dataProvider);
        const currentDuration = calcDuration();
        const result = await challengeLiveRecommend.recommendChallengeLiveDeck(
            characterId,
            {
                musicMeta,
                limit: 10,
                member: 5,
                cardConfig,
                debugLog: (str: string) => {
                    console.log("[Worker]", str);
                },
            }
        );

        return {
            challengeHighScore: userChallengeLiveSoloResult,
            result,
            userCards,
            duration: currentDuration.done(),
        };
    }

    // Event mode
    if (!eventId) throw new Error("eventId is required for event mode");

    // Map liveType string to enum
    let computedLiveType: LiveType;
    switch (liveTypeStr) {
        case "solo":
            computedLiveType = LiveType.SOLO;
            break;
        case "auto":
            computedLiveType = LiveType.AUTO;
            break;
        case "cheerful":
            computedLiveType = LiveType.CHEERFUL;
            break;
        case "multi":
        default:
            computedLiveType = LiveType.MULTI;
            break;
    }

    // Check event type for cheerful carnival conversion
    const events = await dataProvider.getMasterData<any>("events");
    const event0 = events.find((it: any) => it.id === eventId);
    if (!event0) throw new Error(`Event not found: ${eventId}`);

    if (event0.eventType === "cheerful_carnival" && computedLiveType === LiveType.MULTI) {
        computedLiveType = LiveType.CHEERFUL;
    }

    const eventDeckRecommend = new EventDeckRecommend(dataProvider);
    const currentDuration = calcDuration();
    const result = await eventDeckRecommend.recommendEventDeck(
        eventId,
        computedLiveType,
        {
            musicMeta,
            limit: 10,
            cardConfig,
            debugLog: (str: string) => {
                console.log("[Worker]", str);
            },
        },
        supportCharacterId || 0
    );

    return {
        result,
        userCards,
        duration: currentDuration.done(),
    };
}

// Worker message handler
addEventListener("message", (event: MessageEvent<{ args: WorkerInput }>) => {
    deckRecommendRunner(event.data.args)
        .then((result) => {
            postMessage(result);
        })
        .catch((err) => {
            postMessage({
                error: err.message || String(err),
            });
        });
});
