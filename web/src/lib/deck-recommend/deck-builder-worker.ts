/**
 * Web Worker for score-control deck building
 * Uses EventBonusDeckRecommend to find decks with exact target event bonus
 *
 * 组卡代码来源: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * 部分算法优化修改于: https://github.com/NeuraXmy/sekai-deck-recommend-cpp  作者: luna茶
 */
import {
    type CardConfig,
    CachedDataProvider,
    EventBonusDeckRecommend,
    LiveCalculator,
    LiveType,
} from "sekai-calculator";
import { calcDuration, PRELOAD_MASTER_KEYS, type HarukiServer, SnowyDataProvider } from "./data-provider";

interface UserCardEntry {
    cardId: number;
    [key: string]: unknown;
}

interface EventInfoLite {
    id: number;
    eventType?: string;
}

type DeckResultRow = Record<string, unknown>;

// ==================== WORKER LOGIC ====================

// Types

export interface DeckBuilderInput {
    userId: string;
    server: string;
    oauthAccessToken?: string;
    eventId: number;
    minBonus: number;
    maxBonus: number;
    liveType: string; // "multi" | "solo" | "auto" | "cheerful"
    musicId: number;
    difficulty: string;
    supportCharacterId?: number;
    cardConfig: Record<string, CardConfig>;
}

export interface DeckBuilderOutput {
    result?: DeckResultRow[];
    userCards?: UserCardEntry[];
    duration?: number;
    error?: string;
    upload_time?: number;
}

async function deckBuilderRunner(args: DeckBuilderInput): Promise<DeckBuilderOutput> {
    const {
        userId, server, oauthAccessToken, eventId, minBonus, maxBonus,
        liveType: liveTypeStr, musicId, difficulty,
        supportCharacterId, cardConfig,
    } = args;

    const dataProvider = new CachedDataProvider(
        new SnowyDataProvider(userId, server as HarukiServer, oauthAccessToken || null)
    );

    // Parallel preload all data
    await Promise.all([
        dataProvider.getUserDataAll(),
        dataProvider.getMusicMeta(),
        dataProvider.preloadMasterData(PRELOAD_MASTER_KEYS),
    ]);

    const userCards = await dataProvider.getUserData<UserCardEntry[]>("userCards");
    const uploadTime = await dataProvider.getUserData<number | undefined>("upload_time").catch(() => undefined);

    const liveCalculator = new LiveCalculator(dataProvider);
    const musicMeta = await liveCalculator.getMusicMeta(musicId, difficulty);

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
    const events = await dataProvider.getMasterData<EventInfoLite>("events");
    const event0 = events.find((it) => it.id === eventId);
    if (!event0) throw new Error(`Event not found: ${eventId}`);

    if (event0.eventType === "cheerful_carnival" && computedLiveType === LiveType.MULTI) {
        computedLiveType = LiveType.CHEERFUL;
    }

    const recommend = new EventBonusDeckRecommend(dataProvider);
    const currentDuration = calcDuration();

    const result = await recommend.recommendEventBonusDeck(
        eventId,
        minBonus,
        computedLiveType,
        {
            musicMeta,
            member: 5,
            cardConfig,
            debugLog: (str: string) => {
                console.log("[DeckBuilder]", str);
            },
        },
        supportCharacterId || 0,
        maxBonus
    );

    return {
        result: result as unknown as DeckResultRow[],
        userCards,
        duration: currentDuration.done(),
        upload_time: uploadTime,
    };
}

// Worker message handler
addEventListener("message", (event: MessageEvent<{ args: DeckBuilderInput }>) => {
    deckBuilderRunner(event.data.args)
        .then((output) => {
            postMessage(output);
        })
        .catch((err) => {
            postMessage({
                error: err.message || String(err),
            });
        });
});
