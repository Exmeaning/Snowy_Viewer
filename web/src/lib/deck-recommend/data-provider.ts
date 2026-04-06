/**
 * Shared Data Provider for sekai-calculator workers
 * Used by both deck-recommend worker and score-control deck-builder worker
 *
 * 组卡代码来源: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * 部分算法优化修改于: https://github.com/NeuraXmy/sekai-deck-recommend-cpp  作者: luna茶
 */
import {
    CachedDataProvider,
    DataProvider,
    MusicMeta,
} from "sekai-calculator";
import { getHarukiPublicApiBase } from "../haruki-public-api";
import { augmentMasterDataWithWorldBloomSimulation } from "../world-bloom-simulation";

// ==================== Types ====================

export type HarukiServer = "jp" | "cn" | "tw";

// ==================== Constants ====================

// Music meta URL
export const MUSIC_META_URL = "https://moe.exmeaning.com/data/music_meta/music_metas.json";

// Master data URLs - use project's self-hosted official source
export const MASTER_DATA_BASES: Record<string, string> = {
    jp: "https://sekaimaster.exmeaning.com/master",
    cn: "https://sekaimaster-cn.exmeaning.com/master",
};

// Haruki suite API base
export const HARUKI_SUITE_API = getHarukiPublicApiBase();
const OAUTH2_BASE = (process.env.NEXT_PUBLIC_OAUTH2_BASE_URL || "https://toolbox-api-direct.haruki.seiunx.com/api/oauth2").replace(/\/+$/, "");

// User data keys needed for deck recommendation
export const USER_DATA_KEYS = [
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
const USER_DATA_KEYS_LIST = USER_DATA_KEYS.split(",");

// Master data keys needed for preloading
export const PRELOAD_MASTER_KEYS = [
    "areaItemLevels", "cards", "cardMysekaiCanvasBonuses", "cardRarities",
    "characterRanks", "cardEpisodes", "events", "eventCards",
    "eventRarityBonusRates", "eventDeckBonuses", "gameCharacters",
    "gameCharacterUnits", "honors", "masterLessons", "mysekaiGates",
    "mysekaiGateLevels", "skills", "worldBloomDifferentAttributeBonuses",
    "worldBloomSupportDeckBonuses", "worldBloomSupportDeckBonusesWL1",
    "worldBloomSupportDeckBonusesWL2", "worldBloomSupportDeckBonusesWL3",
    "worldBloomSupportDeckUnitEventLimitedBonuses",
];

const LOCAL_MASTER_DATA_PATHS: Partial<Record<string, string>> = {
    worldBloomSupportDeckBonusesWL1: "/data/worldBloomSupportDeckBonusesWL1.json",
    worldBloomSupportDeckBonusesWL2: "/data/worldBloomSupportDeckBonusesWL2.json",
    worldBloomSupportDeckBonusesWL3: "/data/worldBloomSupportDeckBonusesWL3.json",
};

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
    [key: string]: unknown;
}

interface UserHonorEntry {
    honorId: number;
    [key: string]: unknown;
}

type UserDataMap = Record<string, unknown>;

function getDefaultUserDataValue(key: string): unknown {
    if (key === "userGamedata") return null;
    if (key === "upload_time") return null;
    return [];
}

const USER_DATA_CONTAINER_KEYS = ["data", "result", "updatedData"] as const;
const USER_DATA_ARRAY_KEYS = ["items", "updatedData", "records", "list"] as const;

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function extractUserDataRecord(payload: unknown): UserDataMap | null {
    const direct = toRecord(payload);
    if (!direct) return null;
    if (USER_DATA_KEYS_LIST.some((key) => key in direct)) return direct;

    for (const containerKey of USER_DATA_CONTAINER_KEYS) {
        const nested = toRecord(direct[containerKey]);
        if (nested && USER_DATA_KEYS_LIST.some((key) => key in nested)) {
            return nested;
        }
    }

    return null;
}

function applyDefaultUserDataKeys(data: UserDataMap): UserDataMap {
    const normalized: UserDataMap = { ...data };
    for (const key of USER_DATA_KEYS_LIST) {
        if (!(key in normalized)) {
            normalized[key] = getDefaultUserDataValue(key);
        }
    }
    return normalized;
}

function normalizeSuiteUserDataPayload(payload: unknown): UserDataMap {
    const record = extractUserDataRecord(payload);
    if (!record) {
        throw new Error("INVALID_USER_DATA_PAYLOAD");
    }
    return applyDefaultUserDataKeys(record);
}

function normalizePerKeyUserDataValue(key: string, payload: unknown): unknown {
    const direct = toRecord(payload);
    if (!direct) {
        return payload;
    }

    if (key in direct) {
        return direct[key];
    }

    for (const containerKey of USER_DATA_CONTAINER_KEYS) {
        const nested = toRecord(direct[containerKey]);
        if (nested && key in nested) {
            return nested[key];
        }
    }

    for (const arrayKey of USER_DATA_ARRAY_KEYS) {
        const candidate = direct[arrayKey];
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return payload;
}

// ==================== Helper Functions ====================

/**
 * Transform official cardParameters format to sekai-calculator expected format.
 * Official: { param1: number[], param2: number[], param3: number[] }
 * sekai-calculator expects: Array<{ id, cardId, cardLevel, cardParameterType, power }>
 */
export function transformCards(cards: CardWithParameters[]): CardWithParameters[] {
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

export function calcDuration() {
    const startAt = performance.now();
    return {
        startAt,
        done() {
            return performance.now() - startAt;
        },
    };
}

// ==================== Data Provider ====================

export class SnowyDataProvider implements DataProvider {
    private userDataCache: UserDataMap | null = null;
    private masterDataRawCache = new Map<string, Promise<unknown[]>>();

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

    private async fetchJsonArray(url: string): Promise<unknown[] | null> {
        try {
            const response = await fetch(url);
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

    private async loadRawMasterData(key: string): Promise<unknown[]> {
        const cached = this.masterDataRawCache.get(key);
        if (cached) {
            return cached;
        }
        const promise = (async () => {
            const localPath = LOCAL_MASTER_DATA_PATHS[key];
            let data = localPath === undefined ? null : await this.fetchJsonArray(localPath);
            if (data === null) {
                const base = MASTER_DATA_BASES["jp"];
                data = await this.fetchJsonArray(`${base}/${key}.json`);
            }
            if (data === null) {
                console.warn(`[DeckRecommend] Master data "${key}" not available, using empty array`);
                return [];
            }
            return data;
        })();
        this.masterDataRawCache.set(key, promise);
        return promise;
    }

    async getMasterData<T>(key: string): Promise<T[]> {
        let data = await this.loadRawMasterData(key);
        data = await augmentMasterDataWithWorldBloomSimulation(
            key,
            data,
            async <U,>(depKey: string) => await this.loadRawMasterData(depKey) as U[],
        );
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
            const response = await fetch(`${OAUTH2_BASE}/game-data/${this.server}/suite/${this.userId}`, {
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

            if (response.ok) {
                data = normalizeSuiteUserDataPayload(await response.json()) as UserDataMap & {
                    userCards?: UserCardEntry[];
                    userHonors?: UserHonorEntry[];
                };
            } else if (response.status === 400) {
                console.warn("[DeckRecommend] OAuth suite endpoint returned 400, falling back to per-key requests");
                const keys = USER_DATA_KEYS.split(",");
                const entries = await Promise.all(keys.map(async (key) => {
                    const keyResponse = await fetch(`${OAUTH2_BASE}/game-data/${this.server}/${key}/${this.userId}`, {
                        headers: {
                            Authorization: `Bearer ${this.oauthAccessToken}`,
                        },
                    });

                    if (keyResponse.status === 404) {
                        throw new Error("USER_NOT_FOUND");
                    }
                    if (keyResponse.status === 403) {
                        throw new Error("API_NOT_PUBLIC");
                    }
                    if (keyResponse.status === 400) {
                        console.warn(`[DeckRecommend] OAuth user data key "${key}" returned 400, using fallback default value`);
                        return [key, getDefaultUserDataValue(key)] as const;
                    }
                    if (!keyResponse.ok) {
                        throw new Error(`Failed to fetch user data (${keyResponse.status})`);
                    }

                    return [key, await keyResponse.json()] as const;
                }));

                data = Object.fromEntries(entries) as UserDataMap & {
                    userCards?: UserCardEntry[];
                    userHonors?: UserHonorEntry[];
                };
            } else {
                throw new Error(`Failed to fetch user data (${response.status})`);
            }
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
