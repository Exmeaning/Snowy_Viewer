/**
 * Moesekai 多账号系统
 * 使用 localStorage 存储，不涉及任何服务端通信
 * 支持绑定多个服务器的多个账号
 */

export type ServerType = "jp" | "cn" | "tw";

export interface MoesekaiAccount {
    id: string;                       // 唯一标识 = `${server}_${gameId}`
    gameId: string;                   // UID
    server: ServerType;
    nickname: string;                 // 个性签名 (word) 或用户自定义（已废弃，使用 userGamedata.name）
    avatarCharacterId: number | null; // 头像角色ID（已废弃，使用 avatarCardId）
    avatarCardId: number | null;      // 头像卡面ID（来自当前卡组的 leader）
    isApiPublic: boolean;
    userCharacters: UserCharacter[] | null;
    userGamedata: UserGamedata | null;
    userDecks: UserDeck[] | null;
    userChallengeLiveSoloStages: UserChallengeLiveSoloStage[] | null;
    userChallengeLiveSoloResults: UserChallengeLiveSoloResult[] | null;
    userChallengeLiveSoloHighScoreRewards: UserChallengeLiveSoloHighScoreReward[] | null;
    userBonds: UserBond[] | null;
    userMaterials: UserMaterial[] | null;
    userAreas: UserArea[] | null;
    userMysekaiFixtureGameCharacterPerformanceBonuses: UserMysekaiFixtureGameCharacterPerformanceBonus[] | null;
    userMysekaiGates: UserMysekaiGate[] | null;
    uploadTime: number | null;        // 数据上传时间戳
    createdAt: number;
    updatedAt: number;
}

export interface UserCharacter {
    characterId: number;
    characterRank: number;
    totalExp: number;
}

export interface UserGamedata {
    coin: number;
    totalExp: number;
    name: string;
    exp: number;
    userId: number;
    deck: number;
}

export interface UserDeck {
    deckId: number;
    leader: number;
    subLeader: number;
    member1: number;
    member2: number;
    member3: number;
    member4: number;
    member5: number;
    name: string;
}

export interface UserChallengeLiveSoloStage {
    characterId: number;
    rank: number;
}

export interface UserChallengeLiveSoloResult {
    characterId: number;
    highScore: number;
}

export interface UserChallengeLiveSoloHighScoreReward {
    characterId: number;
    challengeLiveHighScoreRewardId: number;
    gameCharacterId?: number;
    challengeLiveSoloHighScoreRewardId?: number;
    rewardId?: number;
}

export interface UserBond {
    bondsGroupId: number;
    rank: number;
    exp: number;
}

export interface UserMaterial {
    materialId: number;
    quantity: number;
}

export interface UserAreaItem {
    areaItemId: number;
    level: number;
}

export interface UserArea {
    areaId: number;
    areaItems: UserAreaItem[];
}

export interface UserMysekaiFixtureGameCharacterPerformanceBonus {
    gameCharacterId: number;
    totalBonusRate: number;
}

export interface UserMysekaiGate {
    mysekaiGateId: number;
    mysekaiGateLevel: number;
}

export interface HarukiApiResult {
    success: boolean;
    error?: "NOT_FOUND" | "API_NOT_PUBLIC" | "NETWORK_ERROR";
    userProfile?: { word: string; userId: number };
    userCharacters?: UserCharacter[];
    userGamedata?: UserGamedata;
    userDecks?: UserDeck[];
    userChallengeLiveSoloStages?: UserChallengeLiveSoloStage[];
    userChallengeLiveSoloResults?: UserChallengeLiveSoloResult[];
    userChallengeLiveSoloHighScoreRewards?: UserChallengeLiveSoloHighScoreReward[];
    userBonds?: UserBond[];
    userMaterials?: UserMaterial[];
    userAreas?: UserArea[];
    userMysekaiFixtureGameCharacterPerformanceBonuses?: UserMysekaiFixtureGameCharacterPerformanceBonus[];
    userMysekaiGates?: UserMysekaiGate[];
    uploadTime?: number;
}

const ACCOUNTS_KEY = "moesekai_accounts";
const ACTIVE_KEY = "moesekai_active_account";

// Legacy keys
const LEGACY_ACCOUNT_KEY = "moesekai_account";
const LEGACY_USERID_KEY = "deck_recommend_userid";
const LEGACY_SERVER_KEY = "deck_recommend_server";

function isValidServer(s: string): s is ServerType {
    return s === "jp" || s === "cn" || s === "tw";
}

function makeAccountId(server: ServerType, gameId: string): string {
    return `${server}_${gameId}`;
}

/** 获取角色头像URL */
export function getCharacterIconUrl(characterId: number): string {
    return `https://assets.exmeaning.com/character_icons/chr_ts_${characterId}.png`;
}

/** 获取等级最高的角色ID */
export function getTopCharacterId(characters: UserCharacter[]): number {
    if (!characters || characters.length === 0) return 21; // 默认miku
    return characters.reduce((top, c) => c.characterRank > top.characterRank ? c : top, characters[0]).characterId;
}

/** 获取当前卡组的 leader 卡面 ID */
export function getLeaderCardId(userGamedata: UserGamedata | null, userDecks: UserDeck[] | null): number | null {
    if (!userGamedata || !userDecks || userDecks.length === 0) return null;
    const currentDeck = userDecks.find(d => d.deckId === userGamedata.deck);
    return currentDeck ? currentDeck.leader : null;
}

// ==================== Haruki API ====================

/** 调用 Haruki API 验证用户数据可用性 */
export async function verifyHarukiApi(server: ServerType, gameId: string): Promise<HarukiApiResult> {
    const url = `https://suite-api.haruki.seiunx.com/public/${server}/suite/${gameId}?key=userGamedata,userDecks,userCharacters,userChallengeLiveSoloStages,userChallengeLiveSoloResults,userChallengeLiveSoloHighScoreRewards,userBonds,userMaterials,userAreas,userMysekaiFixtureGameCharacterPerformanceBonuses,userMysekaiGates,upload_time`;
    try {
        const res = await fetch(url);
        if (res.status === 404) {
            return { success: false, error: "NOT_FOUND" };
        }
        if (res.status === 403) {
            return { success: false, error: "API_NOT_PUBLIC" };
        }
        if (!res.ok) {
            return { success: false, error: "NETWORK_ERROR" };
        }
        const data = await res.json();
        if (!data.userGamedata) {
            return { success: false, error: "NOT_FOUND" };
        }
        return {
            success: true,
            userGamedata: data.userGamedata,
            userDecks: data.userDecks || [],
            userCharacters: data.userCharacters || [],
            userChallengeLiveSoloStages: data.userChallengeLiveSoloStages || [],
            userChallengeLiveSoloResults: data.userChallengeLiveSoloResults || [],
            userChallengeLiveSoloHighScoreRewards: data.userChallengeLiveSoloHighScoreRewards || [],
            userBonds: data.userBonds || [],
            userMaterials: data.userMaterials || [],
            userAreas: data.userAreas || [],
            userMysekaiFixtureGameCharacterPerformanceBonuses: data.userMysekaiFixtureGameCharacterPerformanceBonuses || [],
            userMysekaiGates: data.userMysekaiGates || [],
            uploadTime: data.upload_time,
        };
    } catch {
        return { success: false, error: "NETWORK_ERROR" };
    }
}

// ==================== 多账号 CRUD ====================

/** 获取所有账号 */
export function getAccounts(): MoesekaiAccount[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(ACCOUNTS_KEY);
        if (raw) return JSON.parse(raw) as MoesekaiAccount[];

        // 尝试从旧数据迁移
        return migrateFromLegacy();
    } catch {
        return [];
    }
}

/** 保存所有账号 */
function saveAccounts(accounts: MoesekaiAccount[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** 获取当前选中的账号 */
export function getActiveAccount(): MoesekaiAccount | null {
    const accounts = getAccounts();
    if (accounts.length === 0) return null;

    const activeId = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    if (activeId) {
        const found = accounts.find(a => a.id === activeId);
        if (found) return found;
    }
    // 默认返回第一个
    return accounts[0];
}

/** 设置当前选中的账号 */
export function setActiveAccount(accountId: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACTIVE_KEY, accountId);
    // 同步旧 key 以保持向后兼容
    const accounts = getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (account) {
        localStorage.setItem(LEGACY_USERID_KEY, account.gameId);
        localStorage.setItem(LEGACY_SERVER_KEY, account.server);
    }
}

/** 添加账号 */
export function addAccount(account: MoesekaiAccount): void {
    const accounts = getAccounts();
    const existing = accounts.findIndex(a => a.id === account.id);
    if (existing >= 0) {
        accounts[existing] = { ...account, updatedAt: Date.now() };
    } else {
        accounts.push(account);
    }
    saveAccounts(accounts);
    // 如果是第一个账号，自动设为活跃
    if (accounts.length === 1) {
        setActiveAccount(account.id);
    }
}

/** 创建并添加账号 */
export function createAccount(
    gameId: string,
    server: ServerType,
    nickname: string,
    avatarCharacterId: number | null,
    userCharacters: UserCharacter[] | null,
    isApiPublic: boolean,
): MoesekaiAccount {
    const account: MoesekaiAccount = {
        id: makeAccountId(server, gameId),
        gameId,
        server,
        nickname,
        avatarCharacterId,
        avatarCardId: null,
        isApiPublic,
        userCharacters,
        userGamedata: null,
        userDecks: null,
        userChallengeLiveSoloStages: null,
        userChallengeLiveSoloResults: null,
        userChallengeLiveSoloHighScoreRewards: null,
        userBonds: null,
        userMaterials: null,
        userAreas: null,
        userMysekaiFixtureGameCharacterPerformanceBonuses: null,
        userMysekaiGates: null,
        uploadTime: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    addAccount(account);
    return account;
}

/** 更新账号 */
export function updateAccount(accountId: string, updates: Partial<MoesekaiAccount>): void {
    const accounts = getAccounts();
    const idx = accounts.findIndex(a => a.id === accountId);
    if (idx < 0) return;
    accounts[idx] = { ...accounts[idx], ...updates, updatedAt: Date.now() };
    saveAccounts(accounts);
}

/** 删除账号 */
export function removeAccount(accountId: string): void {
    let accounts = getAccounts();
    accounts = accounts.filter(a => a.id !== accountId);
    saveAccounts(accounts);
    // 如果删除的是当前活跃账号，切换到第一个
    const activeId = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
    if (activeId === accountId) {
        if (accounts.length > 0) {
            setActiveAccount(accounts[0].id);
        } else {
            localStorage.removeItem(ACTIVE_KEY);
            localStorage.removeItem(LEGACY_USERID_KEY);
            localStorage.removeItem(LEGACY_SERVER_KEY);
        }
    }
}

/** 清除所有账号 */
export function clearAllAccounts(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCOUNTS_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LEGACY_ACCOUNT_KEY);
    localStorage.removeItem(LEGACY_USERID_KEY);
    localStorage.removeItem(LEGACY_SERVER_KEY);
}

/** 检查是否有账号 */
export function hasAccounts(): boolean {
    return getAccounts().length > 0;
}

// ==================== 向后兼容 ====================

/** 从旧数据迁移 */
function migrateFromLegacy(): MoesekaiAccount[] {
    if (typeof window === "undefined") return [];

    const accounts: MoesekaiAccount[] = [];

    try {
        // 尝试从旧的单账号 key 迁移
        const oldRaw = localStorage.getItem(LEGACY_ACCOUNT_KEY);
        if (oldRaw) {
            const old = JSON.parse(oldRaw);
            if (old.gameId) {
                const account: MoesekaiAccount = {
                    id: makeAccountId(old.server || "jp", old.gameId),
                    gameId: old.gameId,
                    server: old.server || "jp",
                    nickname: old.nickname || "",
                    avatarCharacterId: null,
                    avatarCardId: null,
                    isApiPublic: true,
                    userCharacters: null,
                    userGamedata: null,
                    userDecks: null,
                    userChallengeLiveSoloStages: null,
                    userChallengeLiveSoloResults: null,
                    userChallengeLiveSoloHighScoreRewards: null,
                    userBonds: null,
                    userMaterials: null,
                    userAreas: null,
                    userMysekaiFixtureGameCharacterPerformanceBonuses: null,
                    userMysekaiGates: null,
                    uploadTime: null,
                    createdAt: old.createdAt || Date.now(),
                    updatedAt: Date.now(),
                };
                accounts.push(account);
            }
        }

        // 尝试从 legacy userid key 迁移
        if (accounts.length === 0) {
            const legacyId = localStorage.getItem(LEGACY_USERID_KEY);
            const legacyServer = localStorage.getItem(LEGACY_SERVER_KEY);
            if (legacyId) {
                const server: ServerType = legacyServer && isValidServer(legacyServer) ? legacyServer : "jp";
                const account: MoesekaiAccount = {
                    id: makeAccountId(server, legacyId),
                    gameId: legacyId,
                    server,
                    nickname: "",
                    avatarCharacterId: null,
                    avatarCardId: null,
                    isApiPublic: true,
                    userCharacters: null,
                    userGamedata: null,
                    userDecks: null,
                    userChallengeLiveSoloStages: null,
                    userChallengeLiveSoloResults: null,
                    userChallengeLiveSoloHighScoreRewards: null,
                    userBonds: null,
                    userMaterials: null,
                    userAreas: null,
                    userMysekaiFixtureGameCharacterPerformanceBonuses: null,
                    userMysekaiGates: null,
                    uploadTime: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                accounts.push(account);
            }
        }

        if (accounts.length > 0) {
            saveAccounts(accounts);
            setActiveAccount(accounts[0].id);
        }
    } catch {
        // ignore migration errors
    }

    return accounts;
}

// ==================== 兼容旧接口 (供 worker 等使用) ====================

/** 兼容旧的 getAccount 接口 */
export function getAccount(): { gameId: string; server: ServerType; toolStates: { deckRecommend: { userId: string; server: ServerType } | null; scoreControl: { userId: string; server: ServerType } | null } } | null {
    const active = getActiveAccount();
    if (!active) return null;
    const state = { userId: active.gameId, server: active.server, savedAt: Date.now() };
    return {
        gameId: active.gameId,
        server: active.server,
        toolStates: {
            deckRecommend: state,
            scoreControl: state,
        },
    };
}

/** 兼容旧的 saveToolState */
export function saveToolState(
    _tool: "deckRecommend" | "scoreControl",
    userId: string,
    server: ServerType,
): void {
    const accounts = getAccounts();
    const id = makeAccountId(server, userId);
    const existing = accounts.find(a => a.id === id);
    if (!existing) {
        // 自动创建账号
        createAccount(userId, server, "", null, null, true);
    }
    setActiveAccount(id);
}

// ==================== 头像缓存 ====================

const AVATAR_CACHE_KEY = "moesekai_avatar_cache";

/** 获取缓存的头像 URL */
export function getCachedAvatarUrl(accountId: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = localStorage.getItem(AVATAR_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw) as Record<string, string>;
        return cache[accountId] || null;
    } catch {
        return null;
    }
}

/** 缓存头像 URL */
export function setCachedAvatarUrl(accountId: string, url: string): void {
    if (typeof window === "undefined") return;
    try {
        const raw = localStorage.getItem(AVATAR_CACHE_KEY);
        const cache: Record<string, string> = raw ? JSON.parse(raw) : {};
        cache[accountId] = url;
        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // ignore
    }
}

export const SERVER_LABELS: Record<ServerType, string> = {
    cn: "简中服",
    jp: "日服",
    tw: "繁中服",
};

export const SERVER_OPTIONS: { value: ServerType; label: string }[] = [
    { value: "cn", label: "简中服 (CN)" },
    { value: "jp", label: "日服 (JP)" },
    { value: "tw", label: "繁中服 (TW)" },
];
