"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMasterData } from "@/lib/fetch";
import { ICardInfo, CHARACTER_NAMES, CHAR_COLORS, UNIT_DATA } from "@/types/types";
import { getCardFullUrl, getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import {
    generateRoomCode, createRoom, findRoom, findRoomAcrossServers,
    updateRoomPlayers, updateRoomStatus, deleteRoom,
    getSupabaseClient, measureAllLatencies,
    SERVERS, RoomPlayer
} from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import "./multiplayer.css";

// ==================== CONSTANTS ====================

const MAX_PLAYERS = 4;
const MAX_ROUNDS = 10;
const INITIAL_HP = 1000;
const ATTEMPT_PENALTY = 20;
const TIMEOUT_PENALTY = 100;
const FEEDBACK_DURATION = 4000;

// Unit icon map (same as single player)
const UNIT_ICON_MAP: Record<string, string> = {
    "ln": "ln.webp", "mmj": "mmj.webp", "vbs": "vbs.webp",
    "ws": "wxs.webp", "25ji": "n25.webp", "vs": "vs.webp",
};

// Rarity options (same as single player)
const RARITY_OPTIONS = [
    { id: "rarity_1", num: 1 },
    { id: "rarity_2", num: 2 },
    { id: "rarity_3", num: 3 },
    { id: "rarity_4", num: 4 },
    { id: "rarity_birthday", num: 5 },
];
const DEFAULT_RARITIES = ["rarity_3", "rarity_4"];

type Difficulty = "easy" | "normal" | "hard" | "extreme";

// Distortion Effects (for extreme mode)
type DistortionType = "none" | "hue-rotate" | "flip-v" | "flip-h" | "grayscale" | "invert" | "rgb-shuffle";

interface ActiveDistortion {
    type: DistortionType;
    label: string;
}

const DISTORTION_POOL: { type: DistortionType; label: string }[] = [
    { type: "none", label: "不操作" },
    { type: "hue-rotate", label: "色相反转" },
    { type: "flip-v", label: "翻转" },
    { type: "flip-h", label: "镜像" },
    { type: "grayscale", label: "灰度" },
    { type: "invert", label: "反色" },
    { type: "rgb-shuffle", label: "RGB打乱" },
];

interface MultiplayerSettings {
    difficulty: Difficulty;
    selectedRarities: string[];
    selectedUnitIds: string[];
    timeLimit: number;
}

const DEFAULT_SETTINGS: MultiplayerSettings = {
    difficulty: "normal",
    selectedRarities: DEFAULT_RARITIES,
    selectedUnitIds: [],
    timeLimit: 60,
};

// Get sticker URL from generic stamp assets (01-44 range)
function getStickerImageUrl(stickerNum: number): string {
    const padded = String(stickerNum).padStart(4, "0");
    return `https://snowyassets.exmeaning.com/startapp/stamp/stamp${padded}/stamp${padded}.png`;
}

// Round multiplier by round index
function getRoundMultiplier(roundIndex: number): number {
    return (roundIndex + 1) * 0.5;
}

// Generate session ID
function generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ==================== TYPES ====================

type Phase = "lobby" | "room" | "playing" | "feedback" | "result";
type LobbyTab = "create" | "join";

interface PlayerState {
    id: string;
    characterId: number;
    slot: number;
    isHost: boolean;
    hp: number;
    blockBar: number;
    attempts: number;
    guessedCorrectly: boolean;
    guessOrder: number; // 0 = not guessed, 1 = first, 2 = second, etc.
    eliminated: boolean;
    eliminatedRound: number; // round when player was eliminated (for ranking); -1 = alive
    isDying?: boolean; // Last Stand status
}

interface RoundData {
    roundIndex: number;
    cardId: number;
    characterId: number;
    assetbundleName: string;
    cardRarityType: string;
    isTrained: boolean;
    cropX: number;
    cropY: number;
    cropSize: number;
    distortions?: ActiveDistortion[];
}

interface FloatingSticker {
    id: string;
    charId: number;
    stickerNum: number;
    x: number;
    y: number;
    senderName: string;
}

interface FloatingHpChange {
    id: string;
    playerId: string;
    amount: number;
    type: "wrong" | "kill" | "timeout" | "block";
}

// ==================== SEEDED RANDOM (copied from single player) ====================

class SeededRandom {
    private seed: number;
    constructor(seed: string) {
        this.seed = this.hashString(seed || Date.now().toString());
    }
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
    next(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
    pick<T>(array: T[]): T {
        return array[Math.floor(this.next() * array.length)];
    }
    pickMultiple<T>(array: T[], n: number): T[] {
        const result: T[] = [];
        const pool = [...array];
        for (let i = 0; i < n; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(this.next() * pool.length);
            result.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return result;
    }
}

interface ActiveSticker {
    id: string;
    stickerNum: number;
    expiresAt: number;
}


// ==================== MAIN COMPONENT ====================

function MultiplayerContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { themeColor } = useTheme();

    // Phase & identity
    const [phase, setPhase] = useState<Phase>("lobby");
    const [lobbyTab, setLobbyTab] = useState<LobbyTab>("create");
    const [mySessionId] = useState(() => generateSessionId());
    const [myCharId, setMyCharId] = useState<number>(21); // default Miku

    // Auto-fill room code from URL
    useEffect(() => {
        const roomParam = searchParams.get("room");
        if (roomParam) {
            setLobbyTab("join");
            setJoinCode(roomParam.toUpperCase());
        }
    }, [searchParams]);

    // Game settings (host-configurable)
    const [gameSettings, setGameSettings] = useState<MultiplayerSettings>(DEFAULT_SETTINGS);

    // Room state
    const [roomId, setRoomId] = useState<string>("");
    const [roomCode, setRoomCode] = useState<string>("");
    const [joinCode, setJoinCode] = useState<string>("");
    const [players, setPlayers] = useState<PlayerState[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState<string>("");

    // Multi-server state
    const [selectedServerId, setSelectedServerId] = useState<string>("tokyo-1");
    const [currentServerId, setCurrentServerId] = useState<string>("tokyo-1");
    const [serverLatencies, setServerLatencies] = useState<Map<string, number>>(new Map());
    const [isTestingLatency, setIsTestingLatency] = useState(false);
    const [isServerListExpanded, setIsServerListExpanded] = useState(false);
    const currentServerIdRef = useRef<string>("tokyo-1");

    // UI state
    const [showRules, setShowRules] = useState(false);

    // Game state
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [loadError, setLoadError] = useState<string>("");
    const [cardsLoading, setCardsLoading] = useState(true);
    const [gameDeck, setGameDeck] = useState<ICardInfo[]>([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isRoundActive, setIsRoundActive] = useState(false);
    const [roundData, setRoundData] = useState<RoundData | null>(null);
    const [guessCount, setGuessCount] = useState(0); // global guess order counter
    const [activeSettings, setActiveSettings] = useState<MultiplayerSettings>(DEFAULT_SETTINGS);
    const [myGuessed, setMyGuessed] = useState(false);

    // Feedback
    const [feedbackCard, setFeedbackCard] = useState<ICardInfo | null>(null);
    const [feedbackCorrect, setFeedbackCorrect] = useState(false);
    const [feedbackIsTrained, setFeedbackIsTrained] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);

    // Stickers
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [activeStickers, setActiveStickers] = useState<Map<string, ActiveSticker>>(new Map()); // playerId -> sticker

    // Kill notifications
    const [killNotify, setKillNotify] = useState<string>("");

    // Floating HP changes
    const [floatingHpChanges, setFloatingHpChanges] = useState<FloatingHpChange[]>([]);

    // Wrong guess shake
    const [wrongGuessShake, setWrongGuessShake] = useState(false);

    // Distortions (extreme mode)
    const [currentDistortions, setCurrentDistortions] = useState<ActiveDistortion[]>([]);

    // Canvas
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Channel
    const channelRef = useRef<RealtimeChannel | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

    // State refs for channel handlers
    const playersRef = useRef<PlayerState[]>([]);
    const guessCountRef = useRef(0);
    const currentRoundRef = useRef(0);
    const gameDeckRef = useRef<ICardInfo[]>([]);
    const isHostRef = useRef(false);
    const activeSettingsRef = useRef<MultiplayerSettings>(DEFAULT_SETTINGS);
    const cardsRef = useRef<ICardInfo[]>([]);
    const isRoundActiveRef = useRef(false);
    const myGuessedRef = useRef(false);
    const roundDataRef = useRef<RoundData | null>(null);
    const timeLeftRef = useRef(60);
    const roundKillDamageRef = useRef<Map<string, number>>(new Map()); // track kill damage per player per round

    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { guessCountRef.current = guessCount; }, [guessCount]);
    useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);
    useEffect(() => { gameDeckRef.current = gameDeck; }, [gameDeck]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);
    useEffect(() => { activeSettingsRef.current = activeSettings; }, [activeSettings]);
    useEffect(() => { cardsRef.current = cards; }, [cards]);
    useEffect(() => { isRoundActiveRef.current = isRoundActive; }, [isRoundActive]);
    useEffect(() => { myGuessedRef.current = myGuessed; }, [myGuessed]);
    useEffect(() => { roundDataRef.current = roundData; }, [roundData]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
    useEffect(() => { currentServerIdRef.current = currentServerId; }, [currentServerId]);

    // Image preloading state
    const [isPreloading, setIsPreloading] = useState(false);
    const preloadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

    // ==================== LOAD CARD DATA ====================
    const loadCards = useCallback(async () => {
        setCardsLoading(true);
        setLoadError("");
        try {
            const data = await fetchMasterData<ICardInfo[]>("cards.json");
            const validCards = data.filter(c => c.characterId > 0 && c.characterId <= 26);
            setCards(validCards);
        } catch (e) {
            console.error("Failed to load cards", e);
            setLoadError("卡面数据加载失败，请检查网络后重试");
        } finally {
            setCardsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCards();
    }, [loadCards]);

    // Available characters based on unit filter
    const availableCharacters = useMemo(() => {
        if (gameSettings.selectedUnitIds.length === 0) return Object.keys(CHARACTER_NAMES).map(Number);
        const chars: number[] = [];
        UNIT_DATA.forEach(unit => {
            if (gameSettings.selectedUnitIds.includes(unit.id)) {
                chars.push(...unit.charIds);
            }
        });
        return Array.from(new Set(chars));
    }, [gameSettings.selectedUnitIds]);

    // ==================== LATENCY TESTING ====================
    const testAllLatencies = useCallback(async () => {
        setIsTestingLatency(true);
        try {
            const results = await measureAllLatencies();
            setServerLatencies(results);

            // Auto-select best server
            let bestServerId = "tokyo-1";
            let minLatency = 9999;

            results.forEach((latency, id) => {
                if (latency > 0 && latency < minLatency) {
                    minLatency = latency;
                    bestServerId = id;
                }
            });

            setSelectedServerId(bestServerId);
        } catch (e) {
            console.warn("Latency test failed:", e);
        } finally {
            setIsTestingLatency(false);
        }
    }, []);

    // Auto-test latency when entering create tab
    useEffect(() => {
        if (phase === "lobby") {
            testAllLatencies();
        }
    }, [phase, testAllLatencies]);

    // ==================== CHANNEL SETUP ====================

    const setupChannel = useCallback((code: string, serverId?: string) => {
        const sid = serverId || currentServerIdRef.current;
        const client = getSupabaseClient(sid);
        if (channelRef.current) {
            client.removeChannel(channelRef.current);
        }

        const channel = client.channel(`room-${code}`, {
            config: { broadcast: { self: true } },
        });

        channel.on("broadcast", { event: "player_join" }, ({ payload }) => {
            setPlayers(prev => {
                if (prev.find(p => p.id === payload.id)) return prev;
                // Character validation is already done in handleJoinRoom before broadcast
                const newPlayer: PlayerState = {
                    id: payload.id,
                    characterId: payload.characterId,
                    slot: prev.length + 1,
                    isHost: false,
                    hp: INITIAL_HP,
                    blockBar: 0,
                    attempts: 0,
                    guessedCorrectly: false,
                    guessOrder: 0,
                    eliminated: false,
                    eliminatedRound: -1,
                };
                return [...prev, newPlayer];
            });
        });

        channel.on("broadcast", { event: "player_leave" }, ({ payload }) => {
            setPlayers(prev => prev.filter(p => p.id !== payload.id));
        });

        channel.on("broadcast", { event: "game_start" }, ({ payload }) => {
            // Receive seed + settings, generate deck locally
            const settings = payload.settings as MultiplayerSettings;
            const seed = payload.seed as string;
            const allCards = cardsRef.current;
            setActiveSettings(settings);
            activeSettingsRef.current = settings;

            // Filter cards by settings
            const filteredChars = settings.selectedUnitIds.length > 0
                ? (() => {
                    const chars: number[] = [];
                    UNIT_DATA.forEach(unit => {
                        if (settings.selectedUnitIds.includes(unit.id)) chars.push(...unit.charIds);
                    });
                    return new Set(chars);
                })()
                : null;

            let filtered = allCards.filter(card => {
                if (!card.assetbundleName) return false;
                if (filteredChars && !filteredChars.has(card.characterId)) return false;
                if (settings.selectedRarities.length > 0 && !settings.selectedRarities.includes(card.cardRarityType)) return false;
                return true;
            });

            // Generate deck from seed (deterministic)
            const random = new SeededRandom(seed);
            const shuffled = [...filtered].sort(() => random.next() - 0.5);
            const deck = shuffled.slice(0, MAX_ROUNDS);

            setGameDeck(deck);
            gameDeckRef.current = deck;
            setCurrentRound(0);
            currentRoundRef.current = 0;
            setPlayers(prev => prev.map(p => ({
                ...p,
                hp: INITIAL_HP,
                blockBar: 0,
                attempts: 0,
                guessedCorrectly: false,
                guessOrder: 0,
                eliminated: false,
                eliminatedRound: -1,
                isDying: false,
            })));
            setPhase("playing");
            setIsPreloading(true);
        });

        channel.on("broadcast", { event: "round_start" }, ({ payload }) => {
            const rd = payload.roundData as RoundData;
            setRoundData(rd);
            roundDataRef.current = rd;
            setCurrentRound(rd.roundIndex);
            currentRoundRef.current = rd.roundIndex;
            setTimeLeft(activeSettingsRef.current.timeLimit);
            timeLeftRef.current = activeSettingsRef.current.timeLimit;
            setIsRoundActive(true);
            isRoundActiveRef.current = true;
            setMyGuessed(false);
            myGuessedRef.current = false;
            setGuessCount(0);
            guessCountRef.current = 0;
            setCurrentDistortions(rd.distortions || []);
            setPlayers(prev => prev.map(p => ({
                ...p,
                attempts: 0,
                guessedCorrectly: false,
                guessOrder: 0,
            })));
            roundKillDamageRef.current.clear(); // reset kill tracking for new round
            // Load round image
            loadRoundImage(rd);
        });

        channel.on("broadcast", { event: "guess_result" }, ({ payload }) => {
            const { playerId, isCorrect, newPlayers, guessOrder: order, killInfo, blockInfo, hpChanges: changes } = payload;
            if (newPlayers) {
                setPlayers(newPlayers);
                playersRef.current = newPlayers;
            }
            if (order) {
                setGuessCount(order);
                guessCountRef.current = order;
            }

            // Show floating HP changes
            if (changes && Array.isArray(changes)) {
                const floats: FloatingHpChange[] = changes.map((c: { playerId: string; amount: number; type: string }) => ({
                    id: Math.random().toString(36),
                    playerId: c.playerId,
                    amount: c.amount,
                    type: c.type as FloatingHpChange["type"],
                }));
                setFloatingHpChanges(prev => [...prev, ...floats]);
                setTimeout(() => {
                    setFloatingHpChanges(prev => prev.filter(f => !floats.find(fl => fl.id === f.id)));
                }, 2000);
            }

            // Wrong guess: send hpChange for self as floating damage
            if (!isCorrect && playerId) {
                const wrongFloat: FloatingHpChange = {
                    id: Math.random().toString(36),
                    playerId,
                    amount: -(ATTEMPT_PENALTY * getRoundMultiplier(currentRoundRef.current)),
                    type: "wrong",
                };
                setFloatingHpChanges(prev => [...prev, wrongFloat]);
                setTimeout(() => {
                    setFloatingHpChanges(prev => prev.filter(f => f.id !== wrongFloat.id));
                }, 2000);

                // Shake effect for the guessing player
                if (playerId === mySessionId) {
                    setWrongGuessShake(true);
                    setTimeout(() => setWrongGuessShake(false), 500);
                }
            }

            // Show kill notification
            if (killInfo) {
                const killerName = CHARACTER_NAMES[killInfo.killerCharId] || "???";
                setKillNotify(`⚔️ ${killerName} 发动斩杀!`);
                setTimeout(() => setKillNotify(""), 3000);
            }
            if (blockInfo && blockInfo.playerId === mySessionId) {
                setKillNotify(`🛡️ 获得格挡条!`);
                setTimeout(() => setKillNotify(""), 2000);
            }

            // If this player just guessed correctly, mark
            if (playerId === mySessionId && isCorrect) {
                setMyGuessed(true);
                myGuessedRef.current = true;
            }
        });

        channel.on("broadcast", { event: "round_end" }, ({ payload }) => {
            setIsRoundActive(false);
            isRoundActiveRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);
            const { card, newPlayers } = payload;
            if (newPlayers) {
                setPlayers(newPlayers);
                playersRef.current = newPlayers;
            }
            // Show feedback
            setFeedbackCard(card);
            setFeedbackIsTrained(payload.isTrained ?? false);
            const me = (newPlayers || playersRef.current).find((p: PlayerState) => p.id === mySessionId);
            setFeedbackCorrect(me?.guessedCorrectly || false);
            setShowFeedback(true);
        });

        channel.on("broadcast", { event: "next_round" }, ({ payload }) => {
            setShowFeedback(false);
            setFeedbackCard(null);
            if (payload.newPlayers) {
                setPlayers(payload.newPlayers);
                playersRef.current = payload.newPlayers;
            }
        });

        channel.on("broadcast", { event: "game_over" }, ({ payload }) => {
            setIsRoundActive(false);
            isRoundActiveRef.current = false;
            if (timerRef.current) clearInterval(timerRef.current);
            setShowFeedback(false);
            if (payload.finalPlayers) {
                setPlayers(payload.finalPlayers);
            }
            setPhase("result");
        });

        // Return to room (host initiated rematch)
        channel.on("broadcast", { event: "return_to_room" }, () => {
            setPhase("room");
            setShowFeedback(false);
            setFeedbackCard(null);
            setIsRoundActive(false);
            isRoundActiveRef.current = false;
            setPlayers(prev => prev.map(p => ({
                ...p,
                hp: INITIAL_HP,
                blockBar: 0,
                attempts: 0,
                guessedCorrectly: false,
                guessOrder: 0,
                eliminated: false,
                eliminatedRound: -1,
                isDying: false,
            })));
            setFloatingHpChanges([]);
        });

        channel.on("broadcast", { event: "sticker" }, ({ payload }) => {
            const { playerId, stickerNum } = payload;
            setActiveStickers(prev => {
                const next = new Map(prev);
                next.set(playerId, {
                    id: Math.random().toString(36),
                    stickerNum,
                    expiresAt: Date.now() + 3000,
                });
                return next;
            });

            setTimeout(() => {
                setActiveStickers(prev => {
                    const next = new Map(prev);
                    const sticker = next.get(playerId);
                    if (sticker && sticker.expiresAt <= Date.now() + 100) {
                        next.delete(playerId);
                    }
                    return next;
                });
            }, 3000);
        });

        // Host processes guesses — consolidated here to use same channel instance
        channel.on("broadcast", { event: "player_guess" }, ({ payload }) => {
            if (!isHostRef.current) return;

            const { playerId, charId, timeLeft: guessTimeLeft } = payload as {
                playerId: string;
                charId: number;
                timeLeft: number;
            };

            const currentCard = gameDeckRef.current[currentRoundRef.current];
            if (!currentCard) return;

            const isCorrect = charId === currentCard.characterId;
            const roundMult = getRoundMultiplier(currentRoundRef.current);

            let updatedPlayers = [...playersRef.current];
            const playerIdx = updatedPlayers.findIndex(p => p.id === playerId);
            if (playerIdx === -1) return;

            const player = { ...updatedPlayers[playerIdx] };
            if (player.guessedCorrectly || player.eliminated) return;
            const isDead = player.hp <= 0 && !player.isDying; // truly dead (not in Last Stand)

            player.attempts += 1;

            if (!isCorrect) {
                // Dead players don't lose HP on wrong guess
                if (!isDead) {
                    player.hp -= ATTEMPT_PENALTY * roundMult;
                }
                updatedPlayers[playerIdx] = player;

                channelRef.current?.send({
                    type: "broadcast",
                    event: "guess_result",
                    payload: {
                        playerId,
                        isCorrect: false,
                        newPlayers: updatedPlayers,
                    },
                });
                playersRef.current = updatedPlayers;
                return;
            }

            // Correct guess!
            const newGuessOrder = guessCountRef.current + 1;
            player.guessedCorrectly = true;
            player.guessOrder = newGuessOrder;

            // Kill or Last Stand Recovery
            const isFirstAttemptCorrect = player.attempts === 1;
            const hpChanges: { playerId: string; amount: number; type: string }[] = [];
            const tl = guessTimeLeft as number;

            // Last Stand Recovery: If dying and 1st try correct -> Restore 20% HP
            if (player.isDying) {
                if (isFirstAttemptCorrect) {
                    player.isDying = false;
                    player.hp = INITIAL_HP * 0.2; // 20% Heal
                    hpChanges.push({ playerId, amount: INITIAL_HP * 0.2, type: "block" }); // visual: revival
                }
                // If not first attempt: isDying stays true, will be eliminated in advanceGame
            }
            // Kill mechanic (only for first-attempt correct, non-dying players)
            else if (isFirstAttemptCorrect && !isDead) {
                // Count how many players already got first-attempt kills this round
                const previousKills = updatedPlayers.filter(p => p.id !== playerId && p.guessedCorrectly && p.attempts === 1).length;
                const killCoeffs = [1.0, 0.4, 0.1];
                const killCoeff = killCoeffs[Math.min(previousKills, killCoeffs.length - 1)];
                const killBase = roundMult * (tl + 20) * killCoeff * 6;

                // Apply kill damage to all unanswered, non-eliminated players
                const unansweredPlayers = updatedPlayers.filter(p => p.id !== playerId && !p.eliminated && !p.guessedCorrectly);

                unansweredPlayers.forEach(op => {
                    const opIdx = updatedPlayers.findIndex(p => p.id === op.id);
                    if (opIdx !== -1) {
                        const blocked = Math.min(updatedPlayers[opIdx].blockBar, killBase);
                        const actualDamage = killBase - blocked;
                        updatedPlayers[opIdx] = {
                            ...updatedPlayers[opIdx],
                            hp: updatedPlayers[opIdx].hp - actualDamage,
                            blockBar: updatedPlayers[opIdx].blockBar - blocked,
                        };
                        // Track kill damage for retroactive block
                        const prevKillDmg = roundKillDamageRef.current.get(op.id) || 0;
                        roundKillDamageRef.current.set(op.id, prevKillDmg + actualDamage);
                        hpChanges.push({ playerId: op.id, amount: -actualDamage, type: "kill" });
                        if (blocked > 0) {
                            hpChanges.push({ playerId: op.id, amount: blocked, type: "block" });
                        }
                    }
                });
            }

            // Block bar: ANY correct guess earns block (not just first-attempt)
            // But amount decays based on attempts: 100% for 1st, 50% for 2nd, 25% for 3rd+
            if (!player.isDying && !isDead) {
                const currentAttempts = player.attempts + 1; // Use +1 because 'player' var is stale (pre-increment)
                const attemptCoeffs = [1.0, 0.5, 0.25];
                const attemptCoeff = attemptCoeffs[Math.min(currentAttempts - 1, attemptCoeffs.length - 1)];
                const blockAmount = (tl + 20) * 2.5 * attemptCoeff; // Fixed 2.5x, no round multiplier
                player.blockBar += blockAmount;

                // Retroactive block: heal back kill damage taken this round
                const killDmgTaken = roundKillDamageRef.current.get(playerId) || 0;
                if (killDmgTaken > 0 && blockAmount > 0) {
                    const healAmount = Math.min(blockAmount, killDmgTaken);
                    player.hp += healAmount;
                    player.blockBar -= healAmount;
                    roundKillDamageRef.current.set(playerId, killDmgTaken - healAmount);
                    hpChanges.push({ playerId, amount: healAmount, type: "block" });
                }
            }

            updatedPlayers[playerIdx] = player;

            channelRef.current?.send({
                type: "broadcast",
                event: "guess_result",
                payload: {
                    playerId,
                    isCorrect: true,
                    newPlayers: updatedPlayers,
                    guessOrder: newGuessOrder,
                    killInfo: (isFirstAttemptCorrect && !player.isDying && !isDead) ? { killerCharId: player.characterId } : undefined,
                    hpChanges: hpChanges.length > 0 ? hpChanges : undefined,
                    blockInfo: (player.blockBar > 0) ? { playerId, amount: player.blockBar } : undefined,
                },
            });

            playersRef.current = updatedPlayers;
            guessCountRef.current = newGuessOrder;

            // Check if all active players (alive + dying) have guessed
            const activePlayers = updatedPlayers.filter(p => !p.eliminated);
            const allGuessed = activePlayers.every(p => p.guessedCorrectly);
            if (allGuessed) {
                const card = gameDeckRef.current[currentRoundRef.current];
                channelRef.current?.send({
                    type: "broadcast",
                    event: "round_end",
                    payload: { card, newPlayers: updatedPlayers, isTrained: roundDataRef.current?.isTrained ?? false },
                });

                const feedbackTimeout = setTimeout(() => {
                    advanceGame(updatedPlayers);
                }, FEEDBACK_DURATION);
                feedbackTimerRef.current = feedbackTimeout;
            }
        });

        channel.on("broadcast", { event: "settings_update" }, ({ payload }) => {
            if (!isHostRef.current) {
                setGameSettings(payload.settings);
            }
        });

        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                console.log("Subscribed to room channel:", code);
            }
        });

        channelRef.current = channel;
        return channel;
    }, [mySessionId]);

    // Broadcast settings when player joins (if host)
    useEffect(() => {
        if (isHost && phase === "room" && channelRef.current) {
            // Give a small delay to ensure the new player is subscribed
            const timer = setTimeout(() => {
                channelRef.current?.send({
                    type: "broadcast",
                    event: "settings_update",
                    payload: { settings: gameSettings },
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [players.length, isHost, phase]); // Dependencies: whenever players change, re-broadcast to ensure new player gets it

    // Helper to update settings and broadcast
    const updateGameSettings = useCallback((newSettings: MultiplayerSettings | ((prev: MultiplayerSettings) => MultiplayerSettings)) => {
        setGameSettings(prev => {
            const next = typeof newSettings === "function" ? newSettings(prev) : newSettings;
            if (isHostRef.current && phase === "room") {
                channelRef.current?.send({
                    type: "broadcast",
                    event: "settings_update",
                    payload: { settings: next },
                });
            }
            return next;
        });
    }, [phase]);

    // ==================== CLEANUP ON UNMOUNT ====================
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                const client = getSupabaseClient(currentServerIdRef.current);
                client.removeChannel(channelRef.current);
            }
            if (timerRef.current) clearInterval(timerRef.current);
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, []);

    // ==================== IMAGE PRELOADING ====================

    // When game starts, preload first round's image, then host starts round 0
    useEffect(() => {
        if (phase === "playing" && isPreloading && gameDeckRef.current.length > 0) {
            // Preload first round's image before starting
            const card = gameDeckRef.current[0];
            const random = new SeededRandom(card.assetbundleName + 0);
            const isTrained = card.cardRarityType !== "rarity_1" && card.cardRarityType !== "rarity_2" && random.next() > 0.5;
            const url = getCardFullUrl(card.characterId, card.assetbundleName, isTrained);

            if (preloadedImagesRef.current.has(url)) {
                // Already cached
                setIsPreloading(false);
                if (isHostRef.current) {
                    setTimeout(() => startRound(0), 300);
                }
            } else {
                const img = new window.Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    preloadedImagesRef.current.set(url, img);
                    setIsPreloading(false);
                    if (isHostRef.current) {
                        setTimeout(() => startRound(0), 300);
                    }
                };
                img.onerror = () => {
                    // Still start even if image fails
                    setIsPreloading(false);
                    if (isHostRef.current) {
                        setTimeout(() => startRound(0), 300);
                    }
                };
                img.src = url;
            }
        }
    }, [phase, isPreloading]);

    // ==================== CANVAS RENDERING ====================

    const loadRoundImage = useCallback((rd: RoundData) => {
        const url = getCardFullUrl(rd.characterId, rd.assetbundleName, rd.isTrained);
        const cachedImg = preloadedImagesRef.current.get(url);
        if (cachedImg) {
            imageRef.current = cachedImg;
            drawCanvas(cachedImg, rd);
        } else {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                imageRef.current = img;
                preloadedImagesRef.current.set(url, img);
                drawCanvas(img, rd);
            };
            img.onerror = () => {
                console.error("Failed to load card image for round", rd.roundIndex);
            };
            img.src = url;
        }

        // Background prefetch: preload the NEXT round's image
        const nextIndex = rd.roundIndex + 1;
        const nextCard = gameDeckRef.current[nextIndex];
        if (nextCard) {
            const nextRandom = new SeededRandom(nextCard.assetbundleName + nextIndex);
            const nextIsTrained = nextCard.cardRarityType !== "rarity_1" && nextCard.cardRarityType !== "rarity_2" && nextRandom.next() > 0.5;
            const nextUrl = getCardFullUrl(nextCard.characterId, nextCard.assetbundleName, nextIsTrained);
            if (!preloadedImagesRef.current.has(nextUrl)) {
                const prefetchImg = new window.Image();
                prefetchImg.crossOrigin = "anonymous";
                prefetchImg.onload = () => {
                    preloadedImagesRef.current.set(nextUrl, prefetchImg);
                };
                prefetchImg.src = nextUrl;
            }
        }
    }, []);

    const drawCanvas = useCallback((img: HTMLImageElement, rd: RoundData) => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        cvs.width = 300;
        cvs.height = 300;
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const distortions = rd.distortions || [];

        ctx.save();

        // Apply CSS-like filters
        let filterString = "";
        const hasFlipH = distortions.some(d => d.type === "flip-h");
        const hasFlipV = distortions.some(d => d.type === "flip-v");
        const hasGrayscale = distortions.some(d => d.type === "grayscale");
        const hasInvert = distortions.some(d => d.type === "invert");
        const hasHueRotate = distortions.some(d => d.type === "hue-rotate");
        const hasRgbShuffle = distortions.some(d => d.type === "rgb-shuffle");

        if (hasGrayscale) filterString += "grayscale(100%) ";
        if (hasInvert) filterString += "invert(100%) ";
        if (hasHueRotate) filterString += "hue-rotate(180deg) ";
        if (filterString) ctx.filter = filterString.trim();

        // Apply flip transforms
        if (hasFlipH || hasFlipV) {
            ctx.translate(cvs.width / 2, cvs.height / 2);
            ctx.scale(hasFlipH ? -1 : 1, hasFlipV ? -1 : 1);
            ctx.translate(-cvs.width / 2, -cvs.height / 2);
        }

        ctx.drawImage(
            img,
            rd.cropX, rd.cropY, rd.cropSize, rd.cropSize,
            0, 0, cvs.width, cvs.height
        );

        ctx.restore();

        // Apply pixel manipulation (RGB Shuffle) after standard filters
        if (hasRgbShuffle) {
            const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                data[i] = g;     // R gets G
                data[i + 1] = b; // G gets B
                data[i + 2] = r; // B gets R
            }
            ctx.putImageData(imageData, 0, 0);
        }
    }, []);

    // ==================== TIMER (all clients run locally) ====================
    useEffect(() => {
        if (!isRoundActive) return;

        if (timerRef.current) clearInterval(timerRef.current);

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = Math.max(0, prev - 0.1);
                timeLeftRef.current = newTime;

                if (newTime <= 0 && isHostRef.current) {
                    clearInterval(interval);
                    hostProcessTimeout();
                }

                return newTime;
            });
        }, 100);

        timerRef.current = interval;

        return () => clearInterval(interval);
    }, [isRoundActive]);

    // ==================== HOST GAME LOGIC ====================

    const hostProcessTimeout = useCallback(() => {
        const roundMult = getRoundMultiplier(currentRoundRef.current);
        const updatedPlayers = playersRef.current.map(p => {
            if (p.eliminated || p.guessedCorrectly) return p; // Eliminated/answered players skip
            if (p.isDying) return p; // Dying players don't take timeout penalty (they'll be eliminated in advanceGame)
            return { ...p, hp: p.hp - TIMEOUT_PENALTY * roundMult };
        });

        // Broadcast round end
        const card = gameDeckRef.current[currentRoundRef.current];
        channelRef.current?.send({
            type: "broadcast",
            event: "round_end",
            payload: { card, newPlayers: updatedPlayers, isTrained: roundDataRef.current?.isTrained ?? false },
        });

        // Schedule next round or game over
        const feedbackTimeout = setTimeout(() => {
            advanceGame(updatedPlayers);
        }, FEEDBACK_DURATION);
        feedbackTimerRef.current = feedbackTimeout;
    }, []);

    const advanceGame = useCallback((currentPlayers: PlayerState[]) => {
        // Mark newly eliminated players with the current round
        const roundIdx = currentRoundRef.current;
        const updatedElim = currentPlayers.map(p => {
            // Already eliminated — skip
            if (p.eliminated) return p;

            // Last Stand resolution:
            // If player is isDying and still has hp <= 0 (didn't recover) → eliminate
            // If player is isDying and hp > 0 (recovered!) → clear isDying, stay alive
            if (p.isDying) {
                if (p.hp > 0) {
                    // Successfully recovered via first-attempt correct guess
                    return { ...p, isDying: false };
                } else {
                    // Failed to recover → eliminated
                    return { ...p, eliminated: true, eliminatedRound: roundIdx, isDying: false };
                }
            }

            // Normal players: if HP drops to 0 or below, enter Last Stand
            if (p.hp <= 0) {
                return { ...p, isDying: true };
            }

            return p;
        });

        // Check how many alive (or dying, meaning still in game)
        const activePlayers = updatedElim.filter(p => !p.eliminated);

        if (activePlayers.length <= 1 || roundIdx >= MAX_ROUNDS - 1) {
            // Game over
            channelRef.current?.send({
                type: "broadcast",
                event: "game_over",
                payload: { finalPlayers: updatedElim },
            });
            return;
        }

        // Next round
        const nextRound = currentRoundRef.current + 1;
        playersRef.current = updatedElim;
        channelRef.current?.send({
            type: "broadcast",
            event: "next_round",
            payload: { newPlayers: updatedElim },
        });

        setTimeout(() => startRound(nextRound), 500);
    }, []);

    const startRound = useCallback((roundIndex: number) => {
        const card = gameDeckRef.current[roundIndex];
        if (!card) return;

        const random = new SeededRandom(card.assetbundleName + roundIndex);
        const isTrained = card.cardRarityType !== "rarity_1" && card.cardRarityType !== "rarity_2" && random.next() > 0.5;
        const url = getCardFullUrl(card.characterId, card.assetbundleName, isTrained);
        const cachedImg = preloadedImagesRef.current.get(url);

        // Difficulty-based crop size
        const diff = activeSettingsRef.current.difficulty;
        let cropSize = 250;
        if (diff === "easy") cropSize = 400;
        else if (diff === "hard" || diff === "extreme") cropSize = 150;

        const buildAndBroadcast = (img: HTMLImageElement | null) => {
            let cropX = 0, cropY = 0;
            if (img) {
                const maxX = Math.max(0, img.width - cropSize);
                const maxY = Math.max(0, img.height - cropSize);
                cropX = Math.floor(random.next() * maxX);
                cropY = Math.floor(random.next() * maxY);
            } else {
                cropX = Math.floor(random.next() * 800);
                cropY = Math.floor(random.next() * 600);
            }

            // Extreme Mode: generate random distortions
            let distortions: ActiveDistortion[] | undefined;
            if (diff === "extreme") {
                const numDistortions = Math.floor(random.next() * 3) + 1; // 1 to 3
                const effects = random.pickMultiple(DISTORTION_POOL, numDistortions);
                const activeEffects = effects.filter(e => e.type !== "none");
                if (activeEffects.length > 0) {
                    distortions = activeEffects;
                }
            }

            const rd: RoundData = {
                roundIndex,
                cardId: card.id,
                characterId: card.characterId,
                assetbundleName: card.assetbundleName,
                cardRarityType: card.cardRarityType,
                isTrained,
                cropX,
                cropY,
                cropSize,
                distortions,
            };

            channelRef.current?.send({
                type: "broadcast",
                event: "round_start",
                payload: { roundData: rd },
            });
        };

        if (cachedImg) {
            buildAndBroadcast(cachedImg);
        } else {
            // Load image first, then compute crop with real dimensions
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                preloadedImagesRef.current.set(url, img);
                buildAndBroadcast(img);
            };
            img.onerror = () => {
                buildAndBroadcast(null);
            };
            img.src = url;
        }
    }, []);

    const handleGuess = useCallback((charId: number) => {
        const me = playersRef.current.find(p => p.id === mySessionId);
        if (!isRoundActiveRef.current || myGuessedRef.current || !roundDataRef.current || (me && me.eliminated)) return;

        channelRef.current?.send({
            type: "broadcast",
            event: "player_guess",
            payload: {
                playerId: mySessionId,
                charId,
                timeLeft: timeLeftRef.current,
            },
        });
    }, [mySessionId]);

    // ==================== ROOM ACTIONS ====================

    const handleCreateRoom = async () => {
        setError("");
        const code = generateRoomCode();
        const hostPlayer: RoomPlayer = {
            id: mySessionId,
            characterId: myCharId,
            slot: 1,
            isHost: true,
        };

        const room = await createRoom(code, hostPlayer, selectedServerId);
        if (!room) {
            setError("创建房间失败，请重试");
            return;
        }

        setRoomId(room.id);
        setRoomCode(code);
        setCurrentServerId(selectedServerId);
        currentServerIdRef.current = selectedServerId;
        setIsHost(true);
        isHostRef.current = true;

        const myPlayer: PlayerState = {
            id: mySessionId,
            characterId: myCharId,
            slot: 1,
            isHost: true,
            hp: INITIAL_HP,
            blockBar: 0,
            attempts: 0,
            guessedCorrectly: false,
            guessOrder: 0,
            eliminated: false,
            eliminatedRound: -1,
        };
        setPlayers([myPlayer]);

        setupChannel(code, selectedServerId);
        setPhase("room");
    };

    const handleJoinRoom = async () => {
        setError("");
        if (!joinCode.trim()) {
            setError("请输入房间号");
            return;
        }

        try {
            // Try to find the room across all servers
            const serverParam = searchParams.get("server");
            let foundRoom: { room: any; serverId: string } | null = null;

            if (serverParam) {
                const room = await findRoom(joinCode.trim(), serverParam);
                if (room) foundRoom = { room, serverId: serverParam };
            }

            if (!foundRoom) {
                foundRoom = await findRoomAcrossServers(joinCode.trim());
            }

            if (!foundRoom) {
                setError("房间不存在（已搜索所有服务器）");
                return;
            }

            const { room, serverId: foundServerId } = foundRoom;

            // Safe parsing of players
            let currentPlayers: RoomPlayer[] = [];
            if (Array.isArray(room.players)) {
                currentPlayers = room.players;
            } else if (typeof room.players === 'string') {
                try {
                    currentPlayers = JSON.parse(room.players);
                } catch (e) {
                    console.error("Failed to parse room.players:", e);
                    currentPlayers = [];
                }
            } else {
                console.warn("Unexpected room.players type:", typeof room.players);
                currentPlayers = [];
            }

            if (room.status !== "waiting") {
                setError("游戏已开始，无法加入");
                return;
            }

            if (currentPlayers.length >= MAX_PLAYERS) {
                setError("房间已满");
                return;
            }

            // Check if character already taken (players array already includes the host)
            const charTaken = currentPlayers.some((p: RoomPlayer) => Number(p.characterId) === Number(myCharId));

            if (charTaken) {
                setError("该角色已被选择，请换一个");
                return;
            }

            const newPlayer: RoomPlayer = {
                id: mySessionId,
                characterId: myCharId,
                slot: currentPlayers.length + 1,
                isHost: false,
            };

            const updated = await updateRoomPlayers(room.id, [...currentPlayers, newPlayer], foundServerId);
            if (!updated) {
                setError("加入房间失败，请重试");
                return;
            }

            setRoomId(room.id);
            setRoomCode(room.code);
            setCurrentServerId(foundServerId);
            currentServerIdRef.current = foundServerId;
            setIsHost(false);
            isHostRef.current = false;

            const myPlayer: PlayerState = {
                id: mySessionId,
                characterId: myCharId,
                slot: currentPlayers.length + 1,
                isHost: false,
                hp: INITIAL_HP,
                blockBar: 0,
                attempts: 0,
                guessedCorrectly: false,
                guessOrder: 0,
                eliminated: false,
                eliminatedRound: -1,
            };

            // Initialize local player state with existing players
            const initialPlayers: PlayerState[] = currentPlayers.map((p: RoomPlayer) => ({
                id: p.id,
                characterId: p.characterId,
                slot: p.slot,
                isHost: p.isHost,
                hp: INITIAL_HP,
                blockBar: 0,
                attempts: 0,
                guessedCorrectly: false,
                guessOrder: 0,
                eliminated: false,
                eliminatedRound: -1,
            }));

            setPlayers([...initialPlayers, myPlayer]);

            const channel = setupChannel(room.code, foundServerId);

            // Restore broadcast so host knows we joined
            setTimeout(() => {
                channel?.send({
                    type: "broadcast",
                    event: "player_join",
                    payload: { id: mySessionId, characterId: myCharId },
                });
            }, 500);

            setPhase("room");
        } catch (e) {
            console.error("Join room exception:", e);
            setError("加入房间时发生错误");
        }
    };

    const handleStartGame = async () => {
        if (!isHost || players.length < 2) return;

        // Generate seed for deterministic deck
        const seed = roomCode + Date.now().toString();

        // Validate deck size using current settings
        const filteredChars = gameSettings.selectedUnitIds.length > 0
            ? (() => {
                const chars: number[] = [];
                UNIT_DATA.forEach(unit => {
                    if (gameSettings.selectedUnitIds.includes(unit.id)) chars.push(...unit.charIds);
                });
                return new Set(chars);
            })()
            : null;

        const filtered = cards.filter(card => {
            if (!card.assetbundleName) return false;
            if (filteredChars && !filteredChars.has(card.characterId)) return false;
            if (gameSettings.selectedRarities.length > 0 && !gameSettings.selectedRarities.includes(card.cardRarityType)) return false;
            return card.characterId > 0 && card.characterId <= 26;
        });

        if (filtered.length < MAX_ROUNDS) {
            setError(`卡池不足 (${filtered.length})，请扩大筛选范围`);
            return;
        }

        updateRoomStatus(roomId, "playing", currentServerId); // best-effort

        channelRef.current?.send({
            type: "broadcast",
            event: "game_start",
            payload: { seed, settings: gameSettings },
        });
    };

    const handleLeaveRoom = async () => {
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "player_leave",
                payload: { id: mySessionId },
            });
            const client = getSupabaseClient(currentServerIdRef.current);
            client.removeChannel(channelRef.current);
            channelRef.current = null;
        }
        if (isHost && roomId) {
            await deleteRoom(roomId, currentServerId);
        }
        setPhase("lobby");
        setRoomCode("");
        setRoomId("");
        setPlayers([]);
        setIsHost(false);
    };

    // ==================== STICKER HANDLING ====================

    const sendSticker = useCallback((stickerNum: number) => {
        channelRef.current?.send({
            type: "broadcast",
            event: "sticker",
            payload: {
                playerId: mySessionId,
                stickerNum,
            },
        });
        setShowStickerPicker(false);
    }, [myCharId]);

    // ==================== SKIP FEEDBACK ====================
    const handleSkipFeedback = useCallback(() => {
        setShowFeedback(false);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        if (isHostRef.current) {
            channelRef.current?.send({
                type: "broadcast",
                event: "next_round",
                payload: {},
            });
            setTimeout(() => {
                advanceGame(playersRef.current);
            }, 300);
        }
    }, [advanceGame]);

    // ==================== AVAILABLE CHARACTERS (exclude taken) ====================
    const takenCharIds = useMemo(() => {
        if (phase !== "room") return new Set<number>();
        return new Set(players.filter(p => p.id !== mySessionId).map(p => p.characterId));
    }, [players, phase, mySessionId]);

    // ==================== RENDER ====================

    // Sorted players for ranking
    const rankedPlayers = useMemo(() => {
        // Sort: alive players by HP (desc), then dead players by death order (later death = higher rank)
        return [...players].sort((a, b) => {
            const aAlive = a.hp > 0;
            const bAlive = b.hp > 0;
            if (aAlive && !bAlive) return -1;
            if (!aAlive && bAlive) return 1;
            if (aAlive && bAlive) return b.hp - a.hp;
            // Both dead: later eliminatedRound = higher rank
            return (b.eliminatedRound ?? -1) - (a.eliminatedRound ?? -1);
        });
    }, [players]);

    const myPlayer = players.find(p => p.id === mySessionId);



    // ========== LOBBY PHASE ==========
    if (phase === "lobby") {
        return (
            <div className="mp-container">
                <button className="mp-back-btn" onClick={() => router.push("/guess-who/")} title="返回">
                    ←
                </button>
                <div className="mp-lobby">
                    <div className="mp-lobby-header">
                        <div className="mp-lobby-title">联机模式</div>
                        <div className="mp-lobby-subtitle">与好友一起猜卡面</div>
                    </div>

                    {/* Character Selection */}
                    <div className="mp-card">
                        <div className="mp-card-title">选择你的角色ID</div>
                        <div className="mp-char-grid">
                            {Object.entries(CHARACTER_NAMES).map(([idStr, name]) => {
                                const id = Number(idStr);
                                return (
                                    <button
                                        key={id}
                                        className={`mp-char-btn ${myCharId === id ? "selected" : ""}`}
                                        onClick={() => setMyCharId(id)}
                                        title={name}
                                    >
                                        <Image src={getCharacterIconUrl(id)} alt={name} fill sizes="48px" unoptimized />
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ textAlign: "center", marginTop: "0.5rem", fontSize: "0.875rem", color: "#94a3b8" }}>
                            当前: <strong style={{ color: themeColor }}>{CHARACTER_NAMES[myCharId]}</strong>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mp-tabs">
                        <button
                            className={`mp-tab ${lobbyTab === "create" ? "active" : ""}`}
                            onClick={() => setLobbyTab("create")}
                        >
                            开设房间
                        </button>
                        <button
                            className={`mp-tab ${lobbyTab === "join" ? "active" : ""}`}
                            onClick={() => setLobbyTab("join")}
                        >
                            加入房间
                        </button>
                    </div>

                    {lobbyTab === "create" ? (
                        <>
                            {/* Server Selection Card (Compact) */}
                            <div className="mp-card">
                                <div className="mp-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>服务器选择</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsServerListExpanded(!isServerListExpanded)}
                                            style={{
                                                fontSize: "0.75rem", background: "none", border: "none",
                                                color: themeColor, cursor: "pointer", fontWeight: 600,
                                            }}
                                        >
                                            {isServerListExpanded ? "收起列表" : "更换服务器"}
                                        </button>
                                        <button
                                            onClick={testAllLatencies}
                                            disabled={isTestingLatency}
                                            style={{
                                                fontSize: "0.75rem", background: "none", border: `1px solid ${themeColor}`,
                                                color: themeColor, borderRadius: "0.375rem", padding: "0.1rem 0.4rem",
                                                cursor: isTestingLatency ? "not-allowed" : "pointer", fontWeight: 600,
                                                opacity: isTestingLatency ? 0.5 : 1,
                                            }}
                                        >
                                            {isTestingLatency ? "测速中..." : "↻"}
                                        </button>
                                    </div>
                                </div>

                                {/* Current Selected Server (Compact View) */}
                                {!isServerListExpanded && (
                                    <div
                                        className="mp-server-item selected"
                                        style={{ marginBottom: 0, cursor: "default", border: `1px solid ${themeColor}` }}
                                    >
                                        <div className="mp-server-info">
                                            <div className="mp-server-name">
                                                {SERVERS.find(s => s.id === selectedServerId)?.name || selectedServerId}
                                                <span className="bg-miku/10 text-miku text-[10px] px-1.5 py-0.5 rounded ml-2">当前选择</span>
                                            </div>
                                            <div className="mp-server-region">{SERVERS.find(s => s.id === selectedServerId)?.region}</div>
                                        </div>
                                        <div className={`mp-server-latency ${(serverLatencies.get(selectedServerId) || 999) < 100 ? "signal-good" :
                                            (serverLatencies.get(selectedServerId) || 999) < 200 ? "signal-ok" : "signal-bad"
                                            }`}>
                                            <span className="mp-server-signal">
                                                {(serverLatencies.get(selectedServerId) || 999) < 100 ? "🟢" :
                                                    (serverLatencies.get(selectedServerId) || 999) < 200 ? "🟡" : "🔴"}
                                            </span>
                                            {serverLatencies.get(selectedServerId) !== undefined ?
                                                `${serverLatencies.get(selectedServerId)}ms` :
                                                (isTestingLatency ? "..." : "--")}
                                        </div>
                                    </div>
                                )}

                                {/* Expandable Server List */}
                                {isServerListExpanded && (
                                    <div className="mp-server-list animate-in fade-in slide-in-from-top-2 duration-200">
                                        {SERVERS.map(server => {
                                            const latency = serverLatencies.get(server.id);
                                            const isSelected = selectedServerId === server.id;
                                            let signalClass = "";
                                            let signalIcon = "⏳";
                                            if (latency !== undefined) {
                                                if (latency < 0) { signalClass = "signal-fail"; signalIcon = "❌"; }
                                                else if (latency < 100) { signalClass = "signal-good"; signalIcon = "🟢"; }
                                                else if (latency < 200) { signalClass = "signal-ok"; signalIcon = "🟡"; }
                                                else { signalClass = "signal-bad"; signalIcon = "🔴"; }
                                            }
                                            return (
                                                <button
                                                    key={server.id}
                                                    className={`mp-server-item ${isSelected ? "selected" : ""}`}
                                                    onClick={() => {
                                                        setSelectedServerId(server.id);
                                                        setIsServerListExpanded(false);
                                                    }}
                                                >
                                                    <div className="mp-server-info">
                                                        <div className="mp-server-name">{server.name}</div>
                                                        <div className="mp-server-region">{server.region}</div>
                                                    </div>
                                                    <div className={`mp-server-latency ${signalClass}`}>
                                                        <span className="mp-server-signal">{signalIcon}</span>
                                                        {latency !== undefined ? (
                                                            latency < 0 ? "超时" : `${latency}ms`
                                                        ) : (
                                                            isTestingLatency ? "..." : "--"
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="mp-server-note">
                                    ℹ️ 系统已自动选择延迟最低的服务器
                                </div>
                                <div className="text-[10px] text-slate-400 mt-2 p-2 bg-slate-50 border border-slate-100 rounded">
                                    ⚠️ 你连接的是位于<strong>日本/韩国/新加坡</strong>的公共AWS中继服务器。公共AWS服务器存在每月配额，配额用完即停，请合理使用。
                                </div>
                            </div>

                            {/* Game Rules Card */}
                            <div className="mp-card">
                                <div className="mp-card-title flex justify-between items-center">
                                    <span>游戏规则</span>
                                    <button
                                        onClick={() => setShowRules(true)}
                                        className="text-xs text-miku font-bold hover:underline"
                                    >
                                        查看详细规则
                                    </button>
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                    <p>• <span className="font-bold">无限次猜测:</span> 猜错扣血, 猜对得分</p>
                                    <p>• <span className="font-bold">斩杀/格挡:</span> 首猜即中可斩杀/格挡</p>
                                    <p>• <span className="font-bold">最后机会:</span> 濒死状态下首猜即中可复活</p>
                                </div>
                            </div>

                            {/* Game Settings Card */}
                            <div className="mp-card">
                                <div className="mp-card-title">游戏设置</div>

                                {/* Difficulty */}
                                <div style={{ marginBottom: "1rem" }}>
                                    <div className="mp-settings-label">难度设置</div>
                                    <div className="mp-settings-grid">
                                        {(["easy", "normal", "hard", "extreme"] as Difficulty[]).map(d => (
                                            <button
                                                key={d}
                                                className={`mp-settings-btn ${gameSettings.difficulty === d ? (d === "extreme" ? "active-danger" : "active") : ""}`}
                                                onClick={() => updateGameSettings(prev => ({ ...prev, difficulty: d }))}
                                            >
                                                {d === "easy" ? "简单" : d === "normal" ? "普通" : d === "hard" ? "困难" : "极限"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Rarity */}
                                <div style={{ marginBottom: "1rem" }}>
                                    <div className="mp-settings-label">卡面星级</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                        {RARITY_OPTIONS.map(({ id, num }) => {
                                            const isSelected = gameSettings.selectedRarities.includes(id);
                                            return (
                                                <button
                                                    key={id}
                                                    className={`mp-rarity-btn ${isSelected ? "active" : ""}`}
                                                    onClick={() => updateGameSettings(prev => ({
                                                        ...prev,
                                                        selectedRarities: prev.selectedRarities.includes(id)
                                                            ? prev.selectedRarities.filter(r => r !== id)
                                                            : [...prev.selectedRarities, id]
                                                    }))}
                                                >
                                                    {id === "rarity_birthday" ? (
                                                        <span style={{ position: "relative", width: 20, height: 20, display: "inline-block" }}>
                                                            <Image src="/data/icon/birthday.webp" alt="Birthday" fill style={{ objectFit: "contain" }} unoptimized />
                                                        </span>
                                                    ) : (
                                                        Array.from({ length: num }).map((_, i) => (
                                                            <span key={i} style={{ position: "relative", width: 16, height: 16, display: "inline-block" }}>
                                                                <Image src="/data/icon/star.webp" alt="Star" fill style={{ objectFit: "contain" }} unoptimized />
                                                            </span>
                                                        ))
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Time Limit */}
                                <div style={{ marginBottom: "1rem" }}>
                                    <div className="mp-settings-label">猜测时间 (秒)</div>
                                    <input
                                        className="mp-input"
                                        type="number"
                                        value={gameSettings.timeLimit}
                                        onChange={(e) => updateGameSettings(prev => ({ ...prev, timeLimit: Math.max(3, Math.min(120, Number(e.target.value))) }))}
                                        style={{ textAlign: "center", fontFamily: "monospace" }}
                                    />
                                </div>

                                {/* Unit Filter */}
                                <div style={{ marginBottom: "1rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                        <div className="mp-settings-label" style={{ marginBottom: 0 }}>角色筛选</div>
                                        {gameSettings.selectedUnitIds.length > 0 && (
                                            <button
                                                style={{ fontSize: "0.75rem", color: themeColor, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                                                onClick={() => updateGameSettings(prev => ({ ...prev, selectedUnitIds: [] }))}
                                            >
                                                重置
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                                        {UNIT_DATA.map(unit => (
                                            <button
                                                key={unit.id}
                                                onClick={() => updateGameSettings(prev => ({
                                                    ...prev,
                                                    selectedUnitIds: prev.selectedUnitIds.includes(unit.id)
                                                        ? prev.selectedUnitIds.filter(id => id !== unit.id)
                                                        : [...prev.selectedUnitIds, unit.id]
                                                }))}
                                                style={{
                                                    padding: "4px", borderRadius: "50%", border: "none", cursor: "pointer",
                                                    background: gameSettings.selectedUnitIds.includes(unit.id) ? "rgba(var(--color-miku-rgb),0.15)" : "transparent",
                                                    outline: gameSettings.selectedUnitIds.includes(unit.id) ? `2px solid ${themeColor}` : "none",
                                                    opacity: gameSettings.selectedUnitIds.includes(unit.id) ? 1 : 0.5,
                                                    transition: "all 0.2s",
                                                    filter: gameSettings.selectedUnitIds.length > 0 && !gameSettings.selectedUnitIds.includes(unit.id) ? "grayscale(1)" : "none",
                                                }}
                                            >
                                                <Image src={`/data/icon/${UNIT_ICON_MAP[unit.id]}`} alt={unit.name} width={36} height={36} unoptimized style={{ objectFit: "contain" }} />
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ textAlign: "center", marginTop: "0.25rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                                        已选: {gameSettings.selectedUnitIds.length > 0 ? `~${availableCharacters.length} 名角色` : "全部26名角色"}
                                    </div>
                                </div>

                                {/* Loading/Error State */}
                                {cardsLoading && (
                                    <div style={{ textAlign: "center", padding: "0.5rem", color: "#94a3b8", fontSize: "0.875rem" }}>
                                        加载卡面数据中...
                                    </div>
                                )}
                                {loadError && (
                                    <div style={{ textAlign: "center", padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.75rem" }}>
                                        <div style={{ color: "#dc2626", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>{loadError}</div>
                                        <button
                                            onClick={loadCards}
                                            style={{ padding: "0.375rem 1rem", background: "#dc2626", color: "white", border: "none", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                        >
                                            重新加载
                                        </button>
                                    </div>
                                )}

                                <button
                                    className="mp-btn mp-btn-primary"
                                    onClick={handleCreateRoom}
                                    disabled={cardsLoading || !!loadError}
                                    style={{ width: "100%", marginTop: "0.5rem", opacity: (cardsLoading || loadError) ? 0.5 : 1 }}
                                >
                                    {cardsLoading ? "加载中..." : "创建房间"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <input
                                className="mp-input"
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="输入房间号"
                                maxLength={6}
                            />

                            {/* Loading/Error State for join tab too */}
                            {cardsLoading && (
                                <div style={{ textAlign: "center", padding: "0.5rem", color: "#94a3b8", fontSize: "0.875rem" }}>
                                    加载卡面数据中...
                                </div>
                            )}
                            {loadError && (
                                <div style={{ textAlign: "center", padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.75rem" }}>
                                    <div style={{ color: "#dc2626", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>{loadError}</div>
                                    <button
                                        onClick={loadCards}
                                        style={{ padding: "0.375rem 1rem", background: "#dc2626", color: "white", border: "none", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                                    >
                                        重新加载
                                    </button>
                                </div>
                            )}

                            <button
                                className="mp-btn mp-btn-primary"
                                onClick={handleJoinRoom}
                                disabled={cardsLoading || !!loadError}
                                style={{ opacity: (cardsLoading || loadError) ? 0.5 : 1 }}
                            >
                                {cardsLoading ? "加载中..." : "加入房间"}
                            </button>

                            {error && <div className="mp-error">{error}</div>}
                        </div>
                    )}

                </div>

                {/* Rules Modal */}
                {showRules && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg text-slate-800">游戏规则说明</h3>
                                <button onClick={() => setShowRules(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <section>
                                    <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                                        无限次猜测
                                    </h4>
                                    <p className="text-sm text-slate-500 leading-relaxed pl-8">
                                        你可以无限次尝试猜测卡面。但要注意，<strong>每次错误猜测会扣除你的血量</strong>。
                                        如果不作答或超时，每局结束时也会扣除固定血量。
                                    </p>
                                </section>

                                <section>
                                    <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">2</span>
                                        斩杀 & 格挡
                                    </h4>
                                    <div className="text-sm text-slate-500 leading-relaxed pl-8 space-y-2">
                                        <p>
                                            <strong>斩杀：</strong>在一次机会（无错误）就猜中，会发动“斩杀”，立即扣除所有在该回合还未答题玩家的血量！
                                        </p>
                                        <p>
                                            <strong>格挡：</strong>同样地，猜中也会赋予你“格挡条”。格挡条可以用来抵消其他人对你发动的斩杀伤害，猜中花费的次数越少，格挡条越多。
                                        </p>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">3</span>
                                        濒死状态 (Last Stand)
                                    </h4>
                                    <p className="text-sm text-slate-500 leading-relaxed pl-8">
                                        当你的血量扣减至0以下时，你不会立即出局，而是进入<strong>濒死状态</strong>。
                                        在下一局中，如果你能<strong>一次猜中</strong>（无错误），你将立即复活并恢复 20% 的血量！
                                        否则，你将被彻底淘汰。
                                    </p>
                                </section>
                            </div>
                            <div className="p-4 bg-slate-50 border-t flex justify-center">
                                <button
                                    onClick={() => setShowRules(false)}
                                    className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                                >
                                    明白了
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========== ROOM PHASE (Waiting) ==========
    if (phase === "room") {
        return (
            <div className="mp-container">
                <div className="mp-lobby">
                    <div className="mp-room-code">
                        <div className="mp-room-code-label">房间号</div>
                        <div className="mp-room-code-value">{roomCode}</div>
                        <button
                            style={{
                                marginTop: "0.5rem",
                                background: "none",
                                border: "none",
                                color: themeColor,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                            onClick={() => {
                                navigator.clipboard.writeText(roomCode);
                            }}
                        >
                            📋 复制房间号
                        </button>
                        <button
                            style={{
                                marginTop: "0.5rem",
                                marginLeft: "1rem",
                                background: "none",
                                border: "none",
                                color: themeColor,
                                fontSize: "0.75rem",
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                            onClick={() => {
                                const diffMap: Record<string, string> = { "easy": "简单", "normal": "普通", "hard": "困难", "extreme": "极限" };
                                const diffText = diffMap[gameSettings.difficulty] || "普通";
                                const serverName = SERVERS.find(s => s.id === currentServerId)?.name || currentServerId;
                                const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&server=${currentServerId}`;
                                const shareText = `我正在SnowyViewer游玩【${diffText}】难度的猜卡大师 房间号【${roomCode}】服务器【${serverName}】 点击链接加入房间 ${shareUrl}`;
                                navigator.clipboard.writeText(shareText);
                                alert("分享链接已复制！");
                            }}
                        >
                            🔗 分享链接
                        </button>
                        {/* Server Badge */}
                        <div style={{ textAlign: "center", marginTop: "0.25rem", fontSize: "0.7rem", color: "#94a3b8" }}>
                            🌐 {SERVERS.find(s => s.id === currentServerId)?.name || currentServerId}
                        </div>
                    </div>

                    {/* Player slots */}
                    <div className="mp-card">
                        <div className="mp-card-title">玩家 ({players.length}/{MAX_PLAYERS})</div>
                        <div className="mp-players">
                            {[1, 2, 3, 4].map(slot => {
                                const p = players.find(pl => pl.slot === slot);
                                return (
                                    <div key={slot} className={`mp-player-slot ${p ? "filled" : ""} ${p?.isHost ? "host" : ""}`}>
                                        {p ? (
                                            <>
                                                <div className="mp-player-avatar">
                                                    <Image src={getCharacterIconUrl(p.characterId)} alt="" fill sizes="40px" unoptimized />
                                                </div>
                                                <div>
                                                    <div className="mp-player-name">{CHARACTER_NAMES[p.characterId]}</div>
                                                    <div className="mp-player-label">
                                                        P{slot} {p.isHost ? "· 房主" : ""} {p.id === mySessionId ? "· 你" : ""}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mp-empty-slot">P{slot} · 等待加入...</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Settings Display */}
                    <div className="mp-card">
                        <div className="mp-card-title">游戏设置 {!isHost && <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 400 }}>(房主配置)</span>}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.875rem" }}>
                            <div style={{ color: "#94a3b8" }}>难度</div>
                            <div style={{ color: "#334155", fontWeight: 600 }}>
                                {gameSettings.difficulty === "easy" ? "简单" : gameSettings.difficulty === "normal" ? "普通" : gameSettings.difficulty === "hard" ? "困难" : "极限"}
                            </div>
                            <div style={{ color: "#94a3b8" }}>时间限制</div>
                            <div style={{ color: "#334155", fontWeight: 600 }}>{gameSettings.timeLimit}秒</div>
                            <div style={{ color: "#94a3b8" }}>星级</div>
                            <div style={{ color: "#334155", fontWeight: 600 }}>
                                {gameSettings.selectedRarities.length === RARITY_OPTIONS.length || gameSettings.selectedRarities.length === 0 ? "全部" : gameSettings.selectedRarities.map(r => {
                                    const opt = RARITY_OPTIONS.find(o => o.id === r);
                                    return opt ? (r === "rarity_birthday" ? "BD" : `${opt.num}★`) : "";
                                }).join(", ")}
                            </div>
                            <div style={{ color: "#94a3b8" }}>角色</div>
                            <div style={{ color: "#334155", fontWeight: 600 }}>
                                {gameSettings.selectedUnitIds.length === 0 ? "全部" : `${availableCharacters.length}名`}
                            </div>
                        </div>
                    </div>

                    {isHost ? (
                        <button
                            className="mp-btn mp-btn-primary"
                            onClick={handleStartGame}
                            disabled={players.length < 2}
                        >
                            {players.length < 2 ? "等待更多玩家..." : "开始游戏"}
                        </button>
                    ) : (
                        <div className="mp-waiting">
                            <div className="mp-waiting-text">
                                等待房主开始游戏
                                <span className="mp-loading-dot">.</span>
                                <span className="mp-loading-dot">.</span>
                                <span className="mp-loading-dot">.</span>
                            </div>
                        </div>
                    )}

                    <button className="mp-btn mp-btn-danger" onClick={handleLeaveRoom}>
                        离开房间
                    </button>

                    {error && <div className="mp-error">{error}</div>}
                </div>
            </div>
        );
    }

    // ========== PLAYING PHASE ==========
    if (phase === "playing") {
        if (isPreloading) {
            return (
                <div className="mp-container">
                    <div className="mp-waiting">
                        <div className="mp-verify-title">准备开始...</div>
                        <div style={{ color: "#94a3b8", fontSize: "0.875rem" }}>即将进入游戏</div>
                    </div>
                </div>
            );
        }

        const roundMult = getRoundMultiplier(currentRound);
        const timerPercent = (timeLeft / activeSettings.timeLimit) * 100;

        return (
            <div className="mp-container">
                <div className="mp-game">
                    {/* Kill notification */}
                    {killNotify && (
                        <div className="mp-kill-notify">
                            <div className={killNotify.includes("斩杀") ? "mp-kill-text" : "mp-block-text"}>
                                {killNotify}
                            </div>
                        </div>
                    )}


                    {/* Feedback overlay */}
                    {showFeedback && feedbackCard && (
                        <div className="mp-feedback-overlay" onClick={isHost ? handleSkipFeedback : undefined}>
                            <div className={`mp-feedback-result ${feedbackCorrect ? "mp-feedback-correct" : "mp-feedback-wrong"}`}>
                                {feedbackCorrect ? "✓ 回答正确!" : "✗ 回答错误"}
                            </div>
                            {/* Answer card image */}
                            <div style={{
                                width: "280px",
                                height: "158px",
                                borderRadius: "0.5rem",
                                overflow: "hidden",
                                margin: "0.5rem auto",
                                border: "2px solid #e2e8f0",
                                position: "relative",
                                background: "#f8fafc",
                            }}>
                                <Image
                                    src={getCardFullUrl(feedbackCard.characterId, feedbackCard.assetbundleName, feedbackIsTrained)}
                                    alt={CHARACTER_NAMES[feedbackCard.characterId] || ""}
                                    fill
                                    sizes="280px"
                                    style={{ objectFit: "contain" }}
                                    unoptimized
                                />
                            </div>
                            <div style={{ color: "#334155", fontSize: "1.25rem", fontWeight: 700, marginTop: "0.5rem" }}>
                                {CHARACTER_NAMES[feedbackCard.characterId]}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                                {feedbackCard.prefix}
                            </div>
                            <div style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "1.5rem" }}>
                                {isHost ? "点击跳过" : "等待下一回合..."}
                            </div>
                        </div>
                    )}

                    {/* HUD - Player HP */}
                    <div className="mp-hud">
                        {players.map(p => {
                            const hpPercent = Math.max(0, (p.hp / INITIAL_HP) * 100);
                            const blockPercent = Math.min(100, (p.blockBar / 500) * 100);
                            const hpClass = hpPercent < 25 ? "low" : hpPercent < 50 ? "medium" : "";
                            const playerChanges = floatingHpChanges.filter(f => f.playerId === p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={`mp-hud-player ${p.id === mySessionId ? "self" : ""} ${p.eliminated || p.hp <= 0 ? "eliminated" : ""}`}
                                    style={{ position: "relative" }}
                                >
                                    <div className="mp-hud-avatar">
                                        <Image src={getCharacterIconUrl(p.characterId)} alt="" fill sizes="28px" unoptimized />
                                    </div>
                                    <div className="mp-hud-label">P{p.slot}</div>
                                    <div className={`mp-hud-hp ${p.hp < 0 ? "negative" : ""}`}>
                                        {Math.floor(p.hp)}
                                    </div>
                                    <div className="mp-hp-bar">
                                        <div className={`mp-hp-fill ${hpClass}`} style={{ width: `${hpPercent}%` }} />
                                    </div>
                                    {p.blockBar > 0 && (
                                        <div className="mp-block-bar">
                                            <div className="mp-block-fill" style={{ width: `${blockPercent}%` }} />
                                        </div>
                                    )}
                                    {/* Status indicator */}
                                    {p.isDying && !p.eliminated ? (
                                        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1 rounded-bl font-bold animate-pulse">
                                            濒死
                                        </div>
                                    ) : null}

                                    {p.guessedCorrectly ? (
                                        <div style={{ fontSize: "0.5rem", color: themeColor, fontWeight: 700 }}>✓</div>
                                    ) : p.attempts > 0 && isRoundActive ? (
                                        <div style={{ fontSize: "0.5rem", color: "#f87171", fontWeight: 700 }}>✗{p.attempts}</div>
                                    ) : null}
                                    {/* Floating HP changes */}
                                    {playerChanges.map(fc => (
                                        <div
                                            key={fc.id}
                                            className="mp-hp-float"
                                            style={{
                                                color: fc.type === "block" ? themeColor : fc.type === "kill" ? "#f97316" : "#f87171",
                                            }}
                                        >
                                            {fc.type === "block" ? `🛡️${Math.floor(fc.amount)}` : Math.floor(fc.amount)}
                                        </div>
                                    ))}

                                    {/* Chat Bubble Sticker */}
                                    {activeStickers.has(p.id) && (
                                        <div className="mp-chat-bubble">
                                            <img
                                                src={getStickerImageUrl(activeStickers.get(p.id)!.stickerNum)}
                                                alt="sticker"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Round info */}
                    <div className="mp-round-bar">
                        <div className="mp-round-label">
                            Round {currentRound + 1}/{MAX_ROUNDS}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#334155", fontWeight: 700 }}>
                            {timeLeft.toFixed(1)}s
                        </div>
                        <div className="mp-round-mult">×{roundMult.toFixed(1)}</div>
                    </div>

                    {/* Timer bar */}
                    <div className="mp-timer-bar">
                        <div
                            className={`mp-timer-fill ${timerPercent < 25 ? "urgent" : ""}`}
                            style={{ width: `${timerPercent}%` }}
                        />
                    </div>

                    {/* Game area - canvas + guess buttons */}
                    <div className="mp-game-area">
                        <div className="mp-canvas-wrap">
                            <canvas ref={canvasRef} width={300} height={300} />
                            {isRoundActive && currentDistortions.length > 0 && (
                                <div style={{
                                    position: "absolute",
                                    top: "0.5rem",
                                    right: "0.5rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                    alignItems: "flex-end",
                                    pointerEvents: "none",
                                }}>
                                    {currentDistortions.map((d: ActiveDistortion, i: number) => (
                                        <span key={i} style={{
                                            padding: "0.25rem 0.5rem",
                                            background: "#ef4444",
                                            color: "white",
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            borderRadius: "0.25rem",
                                            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                                            opacity: 0.9,
                                            whiteSpace: "nowrap",
                                        }}>
                                            {d.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {!isRoundActive && !showFeedback && (
                                <div style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "rgba(255,255,255,0.8)",
                                    color: "#334155",
                                    fontWeight: 700,
                                    borderRadius: "1rem",
                                }}>
                                    准备中...
                                </div>
                            )}
                        </div>

                        {/* Guess grid */}
                        <div className={`mp-guess-grid ${wrongGuessShake ? "mp-shake" : ""}`}>
                            {Object.entries(CHARACTER_NAMES)
                                .filter(([idStr]) => {
                                    // Filter by selected units if any are selected
                                    if (activeSettings.selectedUnitIds.length === 0) return true;
                                    const id = Number(idStr);
                                    // Check if char is in any selected unit
                                    return UNIT_DATA.some(u =>
                                        activeSettings.selectedUnitIds.includes(u.id) && u.charIds.includes(id)
                                    );
                                })
                                .map(([idStr, name]) => {
                                    const id = Number(idStr);
                                    return (
                                        <button
                                            key={id}
                                            className="mp-guess-btn"
                                            onClick={() => handleGuess(id)}
                                            disabled={!isRoundActive || myGuessed}
                                            title={name}
                                        >
                                            <Image src={getCharacterIconUrl(id)} alt={name} fill sizes="36px" unoptimized />
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Sticker toggle */}
                    <button
                        className="mp-sticker-toggle"
                        onClick={() => setShowStickerPicker(!showStickerPicker)}
                        title="发送表情"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                    </button>

                    {/* Sticker picker */}
                    {showStickerPicker && (
                        <div className="mp-sticker-picker">
                            {Array.from({ length: 32 }, (_, i) => i + 1).map(num => (
                                <button
                                    key={num}
                                    className="mp-sticker-item"
                                    onClick={() => sendSticker(num)}
                                >
                                    <img
                                        src={getStickerImageUrl(num)}
                                        alt={`sticker-${num}`}
                                        loading="lazy"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========== RESULT PHASE ==========
    if (phase === "result") {
        return (
            <div className="mp-container">
                <div className="mp-result">
                    <div className="mp-result-title">🏆 游戏结束</div>

                    <div className="mp-rank-list">
                        {rankedPlayers.map((p, idx) => {
                            const posClass = idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : "";
                            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                            return (
                                <div key={p.id} className={`mp-rank-item ${idx === 0 ? "first" : ""}`}>
                                    <div className={`mp-rank-pos ${posClass}`}>{medal}</div>
                                    <div className="mp-rank-avatar">
                                        <Image src={getCharacterIconUrl(p.characterId)} alt="" fill sizes="48px" unoptimized />
                                    </div>
                                    <div className="mp-rank-info">
                                        <div className="mp-rank-name">
                                            {CHARACTER_NAMES[p.characterId]}
                                            {p.id === mySessionId && <span style={{ color: themeColor, marginLeft: "0.5rem", fontSize: "0.75rem" }}>(你)</span>}
                                        </div>
                                        <div className="mp-rank-hp">
                                            {Math.floor(p.hp)} HP
                                            {p.hp <= 0 && <span style={{ color: "#f87171", marginLeft: "0.25rem" }}>· 已淘汰</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", width: "100%", maxWidth: "24rem" }}>
                        <button className="mp-btn mp-btn-secondary" onClick={handleLeaveRoom} style={{ flex: 1 }}>
                            返回大厅
                        </button>
                        {isHost ? (
                            <button
                                className="mp-btn mp-btn-primary"
                                onClick={() => {
                                    updateRoomStatus(roomId, "waiting", currentServerId);
                                    channelRef.current?.send({
                                        type: "broadcast",
                                        event: "return_to_room",
                                        payload: {},
                                    });
                                }}
                                style={{ flex: 1 }}
                            >
                                再来一局
                            </button>
                        ) : (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                                等待房主开始...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// ==================== EXPORT ====================

export default function MultiplayerClient() {
    return (
        <Suspense fallback={
            <div className="mp-container">
                <div className="mp-verify">
                    <div className="mp-verify-title">加载中...</div>
                </div>
            </div>
        }>
            <MultiplayerContent />
        </Suspense>
    );
}
