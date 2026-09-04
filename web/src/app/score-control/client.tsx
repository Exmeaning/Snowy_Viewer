"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { IMusicInfo, IMusicMeta } from "@/types/music";
import type { ICardInfo } from "@/types/types";
import { fetchMasterDataForServer, fetchMusicMetas } from "@/lib/fetch";
import { saveToolState, getAccount, getOAuthAccessTokenForGameUser, isValidServer, SERVER_OPTIONS, type ServerType } from "@/lib/account";
import AccountSelector from "@/components/AccountSelector";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import MusicSelector from "@/components/deck-recommend/MusicSelector";
import EventSelector from "@/components/deck-recommend/EventSelector";
import { preloadDeckEngine } from "@/lib/deck-engine/wasm-loader";

import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getCharacterName } from "@/lib/i18n";
import { getMusicJacketUrl } from "@/lib/assets";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import {
    getValidScores,
    planSmartRoutes,
    FIRE_OPTIONS,
    type ScoreControlResult,
    type SmartRoutePlan,
} from "@/lib/score-control/score-control-calculator";
import "./score-control.css";

const _DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Easy" },
    { value: "normal", label: "Normal" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
    { value: "master", label: "Master" },
    { value: "append", label: "Append" },
];

/** Group results by boost level */
interface BoostGroup {
    boost: number;
    boostRate: number;
    label: string;
    results: ScoreControlResult[];
}

function groupByBoost(raw: ScoreControlResult[]): BoostGroup[] {
    const groups: BoostGroup[] = [];
    for (const opt of FIRE_OPTIONS) {
        const boostResults = raw.filter((r) => r.boost === opt.fires);
        if (boostResults.length > 0) {
            groups.push({
                boost: opt.fires,
                boostRate: opt.rate,
                label: opt.label,
                results: boostResults,
            });
        }
    }
    return groups;
}


/** Fire label helper */
function fireLabel(boost: number): string {
    return `${boost}🔥`;
}


// ==================== Constants ====================

// Valid event_rate values: 100, 103-128, 130 (skip 101, 102, 129 — no songs exist)
const VALID_EVENT_RATES = [
    100, 103, 104, 105, 106, 107, 108, 109, 110,
    111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
    121, 122, 123, 124, 125, 126, 127, 128, 130,
];

// ==================== Infinite Search Types ====================

interface InfiniteSongResult {
    eventRate: number;
    /** All songs at this event_rate that can use the pure AFK routes */
    songs: { musicId: number; musicTitle: string; assetbundleName: string }[];
    difficulty: string;
    routes: SmartRoutePlan[];
    decks: DeckResultInfo[];
}

// ==================== Deck Builder Types ====================
interface CardConfigItem {
    disable: boolean;
    rankMax: boolean;
    episodeRead: boolean;
    masterMax: boolean;
    skillMax: boolean;
}

interface WorkerCardConfig {
    disable?: boolean;
    rankMax?: boolean;
    episodeRead?: boolean;
    masterMax?: boolean;
    skillMax?: boolean;
}

interface DeckCardInfo {
    cardId: number;
    cardRarityType?: string;
    masterRank?: number;
    level?: number;
    [key: string]: unknown;
}

interface DeckResultInfo {
    eventBonus?: number;
    score?: number;
    cards?: DeckCardInfo[];
    [key: string]: unknown;
}

interface UserCardInfo {
    cardId: number;
    masterRank?: number;
    level?: number;
    [key: string]: unknown;
}

type CardMasterInfo = ICardInfo;

const RARITY_CONFIG_KEYS = [
    { key: "rarity_1", label: "★1", color: "#888888" },
    { key: "rarity_2", label: "★2", color: "#88BB44" },
    { key: "rarity_3", label: "★3", color: "#4488DD" },
    { key: "rarity_4", label: "★4", color: "#FFAA00" },
    { key: "rarity_birthday", label: "Birthday", color: "#FF6699" },
];

const DEFAULT_CARD_CONFIG: Record<string, CardConfigItem> = {
    rarity_1: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
};

type ScoreControlTranslationFn = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function getErrorMessage(error: string, t: ScoreControlTranslationFn): string {
    switch (error) {
        case "USER_NOT_FOUND":
            return t("page.scoreControl.errors.userNotFound");
        case "API_NOT_PUBLIC":
            return t("page.scoreControl.errors.apiNotPublic");
        case "INVALID_USER_DATA_PAYLOAD":
            return t("page.scoreControl.errors.invalidUserDataPayload");
        default:
            if (error.includes("404")) return t("page.scoreControl.errors.userNotFound404");
            if (error.includes("403")) return t("page.scoreControl.errors.apiNotPublic403");
            return error;
    }
}

export default function ScoreControlClient() {
    const { t, formatDate, formatNumber } = useI18n();
    const { assetSource } = useTheme();

    // Music selection state
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicMetas, setMusicMetas] = useState<IMusicMeta[]>([]);
    const [musicId, setMusicId] = useState("");
    const [difficulty, _setDifficulty] = useState("master");

    // Calculator inputs
    const [targetPT, setTargetPT] = useState<number>(698);
    const [minBonus, setMinBonus] = useState<number>(5);
    const [maxBonus, setMaxBonus] = useState<number>(200);

    // Result state
    const [smartRoutes, setSmartRoutes] = useState<SmartRoutePlan[] | null>(null);
    const [fallbackResults, setFallbackResults] = useState<BoostGroup[] | null>(null);
    const [fallbackCount, setFallbackCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [expandedRoute, setExpandedRoute] = useState<number | null>(null);

    // ====== Deck Builder State ======
    const [deckBuilderEnabled, setDeckBuilderEnabled] = useState(false);
    const [dbUserId, setDbUserId] = useState("");
    const [dbServer, setDbServer] = useState<ServerType>("jp");
    const [dbEventId, setDbEventId] = useState("");
    const [dbLiveType, _setDbLiveType] = useState("multi");
    const [dbSupportCharacterId, _setDbSupportCharacterId] = useState<number | null>(null);
    const [dbCardConfig, setDbCardConfig] = useState<Record<string, CardConfigItem>>(
        JSON.parse(JSON.stringify(DEFAULT_CARD_CONFIG))
    );
    const [dbShowCardConfig, setDbShowCardConfig] = useState(false);
    const [dbAllowSave, setDbAllowSave] = useState(false);

    // Deck builder results
    const [dbResults, setDbResults] = useState<DeckResultInfo[] | null>(null);
    const [dbUserCards, setDbUserCards] = useState<UserCardInfo[]>([]);
    const [dbDuration, setDbDuration] = useState<number | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [dbIsCalculating, setDbIsCalculating] = useState(false);
    const [dbUploadTime, setDbUploadTime] = useState<number | null>(null);
    const [cardsMaster, setCardsMaster] = useState<CardMasterInfo[]>([]);

    const dbWorkerRef = useRef<Worker | null>(null);

    // Fake progress bar state for deck builder
    const [dbFakeProgress, setDbFakeProgress] = useState<number>(0);
    const dbFakeProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fake progress for infinite search per-step
    const [infiniteStepProgress, setInfiniteStepProgress] = useState<number>(0);
    const infiniteStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Infinite search duration tracking
    const [infiniteSearchDuration, setInfiniteSearchDuration] = useState<number | null>(null);
    const [infiniteSearchUploadTime, setInfiniteSearchUploadTime] = useState<number | null>(null);

    /** Compute routes and update state, including fallback results. */
    const computeAndSetRoutes = (
        tp: number, rate: number, bMin: number, bMax: number,
        maxScore: number, bonuses?: number[]
    ) => {
        const routes = planSmartRoutes(tp, rate, bMin, bMax, maxScore, 10, 20, bonuses);
        setSmartRoutes(routes);
        if (routes.length > 0) {
            setExpandedRoute(0);
        } else {
            const raw = getValidScores(tp, rate, 435, 2_840_000);
            const filtered = raw.filter(r => r.eventBonus >= bMin && r.eventBonus <= bMax);
            setFallbackResults(groupByBoost(filtered));
            setFallbackCount(filtered.length);
        }
    };

    /** Start a fake progress animation that asymptotically approaches ~90% */
    const startFakeProgress = useCallback((
        setter: React.Dispatch<React.SetStateAction<number>>,
        timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    ) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setter(0);
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            // Asymptotic curve: approaches 90% over ~30s
            const progress = 90 * (1 - Math.exp(-elapsed / 12));
            setter(Math.min(90, progress));
        }, 200);
    }, []);

    /** Stop fake progress and jump to 100% (or reset to 0) */
    const stopFakeProgress = useCallback((
        setter: React.Dispatch<React.SetStateAction<number>>,
        timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
        complete: boolean = true,
    ) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (complete) {
            setter(100);
            setTimeout(() => setter(0), 600);
        } else {
            setter(0);
        }
    }, []);

    // Pre-warm the deck builder worker as soon as it is enabled, so the first
    // calculation skips both the worker chunk compile and the wasm boot.
    useEffect(() => {
        if (!deckBuilderEnabled || dbWorkerRef.current) return;
        const w = new Worker(new URL("@/lib/deck-recommend/deck-builder-worker.ts", import.meta.url));
        w.postMessage({ warmup: true });
        dbWorkerRef.current = w;
    }, [deckBuilderEnabled]);

    // ====== Infinite Song Search State ======
    const [infiniteSearchEnabled, setInfiniteSearchEnabled] = useState(false);
    const [infiniteSearchRunning, setInfiniteSearchRunning] = useState(false);
    const [infiniteSearchResults, setInfiniteSearchResults] = useState<InfiniteSongResult[]>([]);
    const [infiniteSearchProgress, setInfiniteSearchProgress] = useState<{
        currentRate: number;
        totalChecked: number;
        found: number;
        currentSongTitle: string;
    } | null>(null);
    const infiniteSearchCancelledRef = useRef(false);
    const [infiniteExpandedIdx, setInfiniteExpandedIdx] = useState<number | null>(null);

    // Group deck results by event bonus
    const dbResultsByBonus = useMemo(() => {
        if (!dbResults) return {};
        const grouped: Record<number, DeckResultInfo[]> = {};
        dbResults.forEach((deck) => {
            const bonus = deck.eventBonus ?? (deck.score || 0); // Handle potentially different field names
            // Round bonus to 1 decimal place to avoid precision issues
            const key = Math.round(bonus * 10) / 10;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(deck);
        });
        return grouped;
    }, [dbResults]);

    // Load initial data
    useEffect(() => {
        preloadDeckEngine();

        fetchMasterDataForServer<IMusicInfo[]>("jp", "musics.json")
            .then((data) => setMusics(data))
            .catch((err) => console.error("Failed to fetch musics", err));

        fetchMusicMetas()
            .then((data) => setMusicMetas(data))
            .catch((err) => console.error("Failed to fetch music meta", err));

        fetchMasterDataForServer<CardMasterInfo[]>("jp", "cards.json").then(setCardsMaster).catch(console.error);

        // Prefer values from the account system.
        const account = getAccount();
        if (account?.toolStates.scoreControl) {
            setDbUserId(account.toolStates.scoreControl.userId);
            setDbServer(account.toolStates.scoreControl.server);
            setDbAllowSave(true); setDeckBuilderEnabled(true);
        } else if (account?.toolStates.deckRecommend) {
            setDbUserId(account.toolStates.deckRecommend.userId);
            setDbServer(account.toolStates.deckRecommend.server);
            setDbAllowSave(true); setDeckBuilderEnabled(true);
        } else {
            const savedUserId = localStorage.getItem("deck_recommend_userid");
            const savedServer = localStorage.getItem("deck_recommend_server");
            if (savedUserId) { setDbUserId(savedUserId); setDbAllowSave(true); setDeckBuilderEnabled(true); }
            if (isValidServer(savedServer)) {
                setDbServer(savedServer);
            }
        }
    }, []);

    // Get event_rate for selected song + difficulty
    const selectedEventRate = useMemo((): number | null => {
        if (!musicId || !musicMetas.length) return null;
        const id = parseInt(musicId);
        const meta = musicMetas.find(
            (m) => m.music_id === id && m.difficulty === difficulty,
        );
        if (!meta) return null;
        return meta.event_rate || 100;
    }, [musicId, difficulty, musicMetas]);

    // Selected music title
    const selectedMusicTitle = useMemo(() => {
        if (!musicId) return "";
        const music = musics.find((m) => m.id.toString() === musicId);
        return music ? music.title : t("page.scoreControl.fallbackMusicTitle", { id: musicId });
    }, [musicId, musics, t]);

    // Handle calculation
    const handleCalculate = useCallback(() => {
        // If infinite search is enabled, delegate to infinite search
        if (infiniteSearchEnabled && deckBuilderEnabled) {
            handleInfiniteSearch();
            return;
        }

        if (!selectedEventRate) {
            setError(t("page.scoreControl.errors.musicMetaRequired"));
            return;
        }
        if (!targetPT || targetPT <= 0) {
            setError(t("page.scoreControl.errors.invalidTargetPt"));
            return;
        }
        if (minBonus > maxBonus) {
            setError(t("page.scoreControl.errors.invalidBonusRange"));
            return;
        }

        setIsCalculating(true);
        setError(null);
        setSmartRoutes(null);
        setFallbackResults(null);
        setFallbackCount(0);
        setExpandedRoute(null);

        // When deckBuilderEnabled, defer route display until worker completes
        if (!deckBuilderEnabled) {
            setTimeout(() => {
                try {
                    const bonusMin = Math.max(0, minBonus);
                    const bonusMax = Math.min(435, maxBonus);

                    computeAndSetRoutes(targetPT, selectedEventRate, bonusMin, bonusMax, 2_840_000);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : t("page.scoreControl.errors.calculationFailedUnknown");
                    setError(t("page.scoreControl.errors.calculationFailed", { message }));
                    setSmartRoutes(null);
                    setFallbackResults(null);
                } finally {
                    setIsCalculating(false);
                }
            }, 10);
        }

        // === Deck Builder: start multi-worker if enabled ===
        if (deckBuilderEnabled) {
            if (!dbUserId.trim()) {
                setDbError(t("page.scoreControl.errors.userRequired"));
                setIsCalculating(false);
                return;
            }
            if (!dbEventId.trim()) {
                setDbError(t("page.scoreControl.errors.eventRequired"));
                setIsCalculating(false);
                return;
            }

            setDbError(null);
            setDbResults(null);
            setDbDuration(null);
            setDbUploadTime(null);
            setDbIsCalculating(true);

            // Start fake progress
            startFakeProgress(setDbFakeProgress, dbFakeProgressTimerRef);

            // Build card config
            const configForCalc: Record<string, WorkerCardConfig> = {};
            for (const [key, val] of Object.entries(dbCardConfig)) {
                if (val.disable) {
                    configForCalc[key] = { disable: true };
                } else {
                    configForCalc[key] = {
                        rankMax: val.rankMax,
                        episodeRead: val.episodeRead,
                        masterMax: val.masterMax,
                        skillMax: val.skillMax,
                    };
                }
            }

            const bonusMin = Math.max(0, minBonus);
            const bonusMax = Math.min(435, maxBonus);

            // Target-driven build: plan routes first, then build decks only for
            // the bonus tiers these routes actually need.
            const prelimRoutes = planSmartRoutes(targetPT, selectedEventRate!, bonusMin, bonusMax, 2840000, 10, 20);
            let bonusTiers = [...new Set(
                prelimRoutes.flatMap((route) => route.steps.map((step) => step.eventBonus)),
            )].filter((tier) => tier > 0).sort((a, b) => a - b);
            if (bonusTiers.length === 0) {
                // No planned route in range: fall back to the plain wide-table calculation,
                // and still build decks for the tiers the wide table found.
                computeAndSetRoutes(targetPT, selectedEventRate!, bonusMin, bonusMax, 2_840_000);
                bonusTiers = [...new Set(
                    getValidScores(targetPT, selectedEventRate!, 435, 2_840_000)
                        .filter((r) => r.eventBonus >= bonusMin && r.eventBonus <= bonusMax)
                        .map((r) => r.eventBonus),
                )].sort((a, b) => a - b).slice(0, 32);
            }
            if (bonusTiers.length === 0) {
                setIsCalculating(false);
                return;
            }

            // Reuse the persistent worker (wasm and data stay warm inside it);
            // create it on demand if the warmup effect has not run yet.
            if (!dbWorkerRef.current) {
                dbWorkerRef.current = new Worker(
                    new URL("@/lib/deck-recommend/deck-builder-worker.ts", import.meta.url)
                );
            }

            // Single worker: only the tiers from the route planning are searched
            // (a handful), so a single round trip is enough.
            const mergeResultRows = (allResults: DeckResultInfo[]): DeckResultInfo[] => {
                // Merge results, deduplicate by eventBonus
                const seen = new Set<number>();
                const merged: DeckResultInfo[] = [];
                for (const r of allResults) {
                    const bonus = r.eventBonus ?? (r.score || 0);
                    const key = Math.round(bonus * 10) / 10;
                    if (!seen.has(key)) {
                        seen.add(key);
                        merged.push(r);
                    }
                }
                return merged;
            };

            const startTime = performance.now();
            const w = new Worker(
                new URL("@/lib/deck-recommend/deck-builder-worker.ts", import.meta.url)
            );
            dbWorkerRef.current = w;

            w.onmessage = (event) => {
                const data = event.data;
                if (data.error) {
                    setDbError(getErrorMessage(data.error, t));
                    // Fallback routes
                    try {
                        computeAndSetRoutes(targetPT, selectedEventRate!, bonusMin, bonusMax, 2_840_000);
                    } catch (_) { /* ignore */ }
                    stopFakeProgress(setDbFakeProgress, dbFakeProgressTimerRef, false);
                    setIsCalculating(false);
                    setDbIsCalculating(false);
                } else {
                    const duration = performance.now() - startTime;
                    stopFakeProgress(setDbFakeProgress, dbFakeProgressTimerRef, true);

                    const merged = mergeResultRows(data.result || []);
                    setDbResults(merged);
                    if (data.userCards) setDbUserCards(data.userCards);
                    setDbDuration(duration);
                    if (data.upload_time) setDbUploadTime(data.upload_time);

                    // Re-plan smart routes
                    if (merged.length > 0) {
                        const foundBonuses = Array.from(new Set<number>(merged.map((r) => {
                            const bonus = r.eventBonus ?? (r.score || 0);
                            return Math.round((typeof bonus === 'number' ? bonus : 0) * 10) / 10;
                        })));
                        computeAndSetRoutes(targetPT, selectedEventRate!, bonusMin, bonusMax, 100000, foundBonuses);
                    } else {
                        setSmartRoutes([]);
                    }

                    setIsCalculating(false);
                    setDbIsCalculating(false);
                }
            };

            w.onerror = (err) => {
                setDbError(t("page.scoreControl.errors.workerError", { message: err.message }));
                stopFakeProgress(setDbFakeProgress, dbFakeProgressTimerRef, false);
                setIsCalculating(false);
                setDbIsCalculating(false);
            };

            const oauthAccessToken = getOAuthAccessTokenForGameUser(dbServer, dbUserId.trim());
            w.postMessage({
                args: {
                    userId: dbUserId.trim(),
                    server: dbServer,
                    oauthAccessToken,
                    eventId: parseInt(dbEventId),
                    bonusTiers,
                    minBonus: bonusMin,
                    maxBonus: bonusMax,
                    liveType: dbLiveType,
                    musicId: parseInt(musicId),
                    difficulty,
                    supportCharacterId: dbSupportCharacterId || undefined,
                    cardConfig: configForCalc,
                },
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventRate, targetPT, minBonus, maxBonus, deckBuilderEnabled, dbUserId, dbServer, dbEventId, dbLiveType, dbSupportCharacterId, musicId, difficulty, dbCardConfig, smartRoutes, infiniteSearchEnabled, t]);

    // ====== Infinite Song Search Logic (Concurrent Worker Pool) ======
    const handleInfiniteSearch = useCallback(async () => {
        if (!musicMetas.length || !musics.length) return;
        if (!dbUserId.trim()) { setDbError(t("page.scoreControl.errors.userRequired")); return; }
        if (!dbEventId.trim()) { setDbError(t("page.scoreControl.errors.eventRequired")); return; }
        if (!targetPT || targetPT <= 0) { setError(t("page.scoreControl.errors.invalidTargetPt")); return; }

        infiniteSearchCancelledRef.current = false;
        setInfiniteSearchRunning(true);
        setInfiniteSearchResults([]);
        setInfiniteSearchProgress({ currentRate: VALID_EVENT_RATES[0], totalChecked: 0, found: 0, currentSongTitle: "" });
        setInfiniteExpandedIdx(null);
        setInfiniteStepProgress(0);
        setInfiniteSearchDuration(null);
        setInfiniteSearchUploadTime(null);
        setDbError(null);
        setError(null);

        // Hide previous normal deck builder results
        setSmartRoutes(null);
        setFallbackResults(null);
        setFallbackCount(0);
        setDbResults(null);
        setDbDuration(null);
        setDbUploadTime(null);
        setExpandedRoute(null);

        const infiniteStartTime = performance.now();

        const bonusMin = Math.max(0, minBonus);
        const bonusMax = Math.min(435, maxBonus);

        // Build card config once
        const configForCalc: Record<string, WorkerCardConfig> = {};
        for (const [key, val] of Object.entries(dbCardConfig)) {
            if (val.disable) {
                configForCalc[key] = { disable: true };
            } else {
                configForCalc[key] = {
                    rankMax: val.rankMax,
                    episodeRead: val.episodeRead,
                    masterMax: val.masterMax,
                    skillMax: val.skillMax,
                };
            }
        }

        // Build task queue: one task per event_rate that has songs
        interface InfTask {
            rate: number;
            songsAtRate: IMusicMeta[];
            firstMusicId: number;
            firstSongTitle: string;
        }
        const taskQueue: InfTask[] = [];
        for (const rate of VALID_EVENT_RATES) {
            const songsAtRate = musicMetas.filter(
                (m) => m.event_rate === rate && m.difficulty === difficulty
            );
            if (songsAtRate.length === 0) continue;
            const firstMeta = songsAtRate[0];
            const firstSongInfo = musics.find((m) => m.id === firstMeta.music_id);
            taskQueue.push({
                rate,
                songsAtRate,
                firstMusicId: firstMeta.music_id,
                firstSongTitle: firstSongInfo ? firstSongInfo.title : t("page.scoreControl.fallbackMusicTitle", { id: firstMeta.music_id }),
            });
        }

        const collected: InfiniteSongResult[] = [];
        let totalChecked = 0;
        const _taskIdx = 0;
        let capturedUploadTime: number | null = null;
        const isMobileInf = typeof window !== 'undefined' && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const poolSize = isMobileInf ? 1 : Math.min(navigator.hardwareConcurrency || 4, 4);

        // Start fake progress for the step
        startFakeProgress(setInfiniteStepProgress, infiniteStepTimerRef);

        // Process a single task and return result
        const processTask = (task: InfTask): Promise<void> => {
            return new Promise<void>((resolve) => {
                if (infiniteSearchCancelledRef.current || collected.length >= 10) {
                    resolve();
                    return;
                }

                const w = new Worker(
                    new URL("@/lib/deck-recommend/deck-builder-worker.ts", import.meta.url)
                );
                w.onmessage = (evt) => {
                    w.terminate();
                    totalChecked++;

                    // Reset step progress for next task
                    stopFakeProgress(setInfiniteStepProgress, infiniteStepTimerRef, true);
                    setTimeout(() => startFakeProgress(setInfiniteStepProgress, infiniteStepTimerRef), 100);

                    const data = evt.data;
                    if (!capturedUploadTime && data.upload_time) {
                        capturedUploadTime = data.upload_time;
                        setInfiniteSearchUploadTime(data.upload_time);
                    }
                    if (!data.error && data.result && data.result.length > 0) {
                        const results = data.result;
                        const foundBonuses = Array.from(new Set<number>(results.map((r: DeckResultInfo) => {
                            const bonus = r.eventBonus ?? (r.score || 0);
                            return Math.round((typeof bonus === 'number' ? bonus : 0) * 10) / 10;
                        })));
                        const routes = planSmartRoutes(
                            targetPT, task.rate, bonusMin, bonusMax, 100000, 10, 20, foundBonuses
                        );
                        const pureAFKRoutes = routes.filter(r => r.isPureAFK);
                        if (pureAFKRoutes.length > 0) {
                            const allSongs = task.songsAtRate.map((m) => {
                                const info = musics.find((mu) => mu.id === m.music_id);
                                return {
                                    musicId: m.music_id,
                                    musicTitle: info ? info.title : t("page.scoreControl.fallbackMusicTitle", { id: m.music_id }),
                                    assetbundleName: info ? info.assetbundleName : "",
                                };
                            });
                            collected.push({
                                eventRate: task.rate,
                                songs: allSongs,
                                difficulty,
                                routes: pureAFKRoutes,
                                decks: results,
                            });
                            setInfiniteSearchResults([...collected]);
                        }
                    }

                    setInfiniteSearchProgress({
                        currentRate: task.rate,
                        totalChecked,
                        found: collected.length,
                        currentSongTitle: t("page.scoreControl.currentSongWithRate", { title: task.firstSongTitle, rate: task.rate }),
                    });

                    resolve();
                };
                w.onerror = () => {
                    w.terminate();
                    totalChecked++;
                    resolve();
                };
                const oauthAccessToken = getOAuthAccessTokenForGameUser(dbServer, dbUserId.trim());
                w.postMessage({
                    args: {
                        userId: dbUserId.trim(),
                        server: dbServer,
                        oauthAccessToken,
                        eventId: parseInt(dbEventId),
                        minBonus: bonusMin,
                        maxBonus: bonusMax,
                        liveType: dbLiveType,
                        musicId: task.firstMusicId,
                        difficulty,
                        supportCharacterId: dbSupportCharacterId || undefined,
                        cardConfig: configForCalc,
                    },
                });
            });
        };

        // Concurrent pool runner using tagged promises
        const runPool = async () => {
            let activeCount = 0;
            let resolveSlot: (() => void) | null = null;

            const waitForSlot = (): Promise<void> => {
                if (activeCount < poolSize) return Promise.resolve();
                return new Promise<void>((resolve) => { resolveSlot = resolve; });
            };

            for (let i = 0; i < taskQueue.length; i++) {
                if (infiniteSearchCancelledRef.current || collected.length >= 10) break;

                await waitForSlot();
                if (infiniteSearchCancelledRef.current || collected.length >= 10) break;

                const task = taskQueue[i];
                activeCount++;
                processTask(task).then(() => {
                    activeCount--;
                    if (resolveSlot) {
                        const fn = resolveSlot;
                        resolveSlot = null;
                        fn();
                    }
                });
            }

            // Wait for all remaining tasks
            while (activeCount > 0) {
                await new Promise<void>((resolve) => { resolveSlot = resolve; });
            }
        };

        await runPool();

        stopFakeProgress(setInfiniteStepProgress, infiniteStepTimerRef, false);
        setInfiniteSearchDuration(performance.now() - infiniteStartTime);
        setInfiniteSearchRunning(false);
        setInfiniteSearchProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [musicMetas, musics, difficulty, dbUserId, dbServer, dbEventId, dbLiveType, dbSupportCharacterId, dbCardConfig, minBonus, maxBonus, targetPT, t]);

    const handleCancelInfiniteSearch = useCallback(() => {
        infiniteSearchCancelledRef.current = true;
    }, []);

    // Update deck builder card config
    const updateDbCardConfig = useCallback((rarity: string, field: keyof CardConfigItem, value: boolean) => {
        setDbCardConfig((prev) => ({
            ...prev,
            [rarity]: { ...prev[rarity], [field]: value },
        }));
    }, []);

    // Find card master data by ID
    const getCardMaster = useCallback((cardId: number) => {
        return cardsMaster.find((c) => c.id === cardId);
    }, [cardsMaster]);

    /** Render a single deck card with full info — shared renderer using SekaiCardThumbnail */
    const renderDeckCard = (card: DeckCardInfo, i: number, size: "sm" | "md" = "md") => {
        const masterCard = getCardMaster(card.cardId);
        const userCard = dbUserCards.find((u) => u.cardId === card.cardId);
        const rarityType = masterCard?.cardRarityType || card.cardRarityType;
        const isBirthday = rarityType === "rarity_birthday";
        const masterRank = userCard?.masterRank ?? card.masterRank ?? 0;
        const level = userCard?.level ?? card.level ?? 1;
        const showTrained = ((rarityType === "rarity_3" || rarityType === "rarity_4") && !isBirthday);

        if (!masterCard) {
            return (
                <div key={i} className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
                    ?
                </div>
            );
        }

        const thumbWidth = size === "sm" ? 40 : 48;

        const characterName = getCharacterName(t, masterCard.characterId, "short");

        return (
            <div key={i} className="relative flex flex-col items-center gap-0.5 flex-shrink-0" title={`ID:${card.cardId} ${masterCard.prefix || ""} ${characterName}`}>
                <Link href={`/cards/${card.cardId}`} className="block relative" target="_blank">
                    <SekaiCardThumbnail
                        card={masterCard}
                        trained={showTrained}
                        mastery={masterRank}
                        width={thumbWidth}
                    />
                    {i === 0 && (
                        <div className="absolute bottom-0 right-0 bg-miku/90 text-white text-[8px] font-bold px-1 py-[1px] rounded-tl-md leading-none backdrop-blur-[1px] z-10">L</div>
                    )}
                </Link>
                <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono leading-none flex items-center gap-0.5">
                    <span>Lv.{level}</span>
                    {masterRank > 0 && (
                        <span className="bg-slate-100 text-slate-600 rounded-full px-[3px] py-[1px] flex items-center gap-[1px] leading-none border border-slate-200">
                            <span className="text-[7px]">🔷</span>
                            <span className="text-[8px] font-bold">{masterRank}</span>
                        </span>
                    )}
                </div>
            </div>
        );
    };

    /** Render results table for fallback exact match */
    const renderResultsTable = (items: ScoreControlResult[]) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-50">
                        <th className="text-left px-5 py-2.5 font-medium">{t("page.scoreControl.table.eventBonus")}</th>
                        <th className="text-left px-5 py-2.5 font-medium">{t("page.scoreControl.table.scoreMin")}</th>
                        <th className="text-left px-5 py-2.5 font-medium">{t("page.scoreControl.table.scoreMax")}</th>
                        <th className="text-left px-5 py-2.5 font-medium">{t("page.scoreControl.table.scoreWindow")}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((r, i) => {
                        const isAFK = r.scoreMin === 0;
                        return (
                            <tr key={i} className={`sc-row border-b border-slate-50 last:border-0 ${isAFK ? "bg-emerald-50/50" : ""}`}>
                                <td className="px-5 py-2.5">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${isAFK ? "bg-emerald-500" : "bg-miku"}`}></span>
                                        <span className="font-bold text-primary-text">{r.eventBonus}%</span>
                                        {isAFK && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                {t("page.scoreControl.table.afk")}
                                            </span>
                                        )}
                                    </span>
                                </td>
                                <td className="px-5 py-2.5 font-mono text-slate-600">
                                    {isAFK ? (
                                        <span className="text-emerald-600 font-bold">0</span>
                                    ) : (
                                        formatNumber(r.scoreMin)
                                    )}
                                </td>
                                <td className="px-5 py-2.5 font-mono text-slate-600">
                                    {formatNumber(r.scoreMax)}
                                </td>
                                <td className="px-5 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="sc-score-bar flex-1 min-w-[60px] max-w-[120px]">
                                            <div
                                                className={`sc-score-bar-fill ${isAFK ? "!bg-gradient-to-r !from-emerald-400 !to-emerald-500" : ""}`}
                                                style={{
                                                    width: `${Math.min(100, ((r.scoreMax - r.scoreMin + 1) / 1000) * 100)}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                            {isAFK ? (
                                                <span className="text-emerald-500">{t("page.scoreControl.table.afkAvailable")}</span>
                                            ) : (
                                                <>+/-{formatNumber(Math.floor((r.scoreMax - r.scoreMin) / 2))}</>
                                            )}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Page Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.scoreControl.badge")}</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        {t("page.scoreControl.title")}<span className="text-miku">{t("page.scoreControl.titleHighlight")}</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                        {t("page.scoreControl.description")}
                    </p>
                </div>

                {/* Input Form */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                        {t("page.scoreControl.musicAndTarget")}
                    </h2>

                    {/* Song + Difficulty */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div className={infiniteSearchEnabled && deckBuilderEnabled ? "opacity-50 pointer-events-none" : ""}>
                            <MusicSelector
                                selectedMusicId={musicId}
                                onSelect={(id) => setMusicId(id)}
                                recommendMode="event"
                                liveType="multi"
                            />
                            {musicId && selectedEventRate === null && (
                                <p className="mt-1 text-xs text-amber-500">
                                    {t("page.scoreControl.noMetaForDifficulty", { difficulty: difficulty.toUpperCase() })}
                                </p>
                            )}
                            {selectedEventRate !== null && (
                                <p className="mt-1 text-xs text-slate-400">
                                    {t("page.scoreControl.musicRate", { rate: selectedEventRate })}
                                </p>
                            )}
                        </div>
                        <div className="flex items-end pb-2">
                            <p className="text-xs text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t("page.scoreControl.difficultyIrrelevant")}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Target PT + Bonus Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("page.scoreControl.targetPt")} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={targetPT}
                                onChange={(e) => setTargetPT(Number(e.target.value))}
                                placeholder="698"
                                min={1}
                                className="sc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                {t("page.scoreControl.targetPtHint")}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("page.scoreControl.minBonus")}
                            </label>
                            <input
                                type="number"
                                value={minBonus}
                                onChange={(e) => setMinBonus(Number(e.target.value))}
                                placeholder="5"
                                min={0}
                                max={435}
                                className="sc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                {t("page.scoreControl.minBonusHint")}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("page.scoreControl.maxBonus")}
                            </label>
                            <input
                                type="number"
                                value={maxBonus}
                                onChange={(e) => setMaxBonus(Number(e.target.value))}
                                placeholder="200"
                                min={0}
                                max={435}
                                className="sc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                            <p className="mt-1 text-xs text-slate-400">
                                {t("page.scoreControl.maxBonusHint")}
                            </p>
                        </div>
                    </div>

                    {/* ====== Deck Builder Toggle ====== */}
                    <div className="mb-5 p-4 rounded-xl border border-slate-200/60 bg-slate-50/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-primary-text">{t("page.scoreControl.deckBuilder")}</span>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{t("page.scoreControl.beta")}</span>
                            </div>
                            <button
                                onClick={() => setDeckBuilderEnabled(!deckBuilderEnabled)}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${deckBuilderEnabled ? 'bg-miku' : 'bg-slate-200'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${deckBuilderEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {deckBuilderEnabled && (
                            <div className="mt-2 text-xs text-amber-600 flex items-start gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span>{t("page.scoreControl.deckBuilderWarning")}</span>
                            </div>
                        )}
                    </div>

                    {/* ====== Deck Builder Expanded Options ====== */}
                    {deckBuilderEnabled && (
                        <div className="mb-5 space-y-4 p-4 rounded-xl border border-miku/20 bg-miku/5">
                            <h3 className="text-sm font-bold text-primary-text flex items-center gap-2">
                                <span className="w-1 h-4 bg-miku rounded-full"></span>
                                {t("page.scoreControl.deckBuilderSettings")}
                            </h3>

                            {/* Account Selector + User ID + Server */}
                            <AccountSelector
                                onSelect={(gameId, srv) => {
                                    setDbUserId(gameId);
                                    setDbServer(srv);
                                    if (dbAllowSave) {
                                        localStorage.setItem("deck_recommend_userid", gameId);
                                        localStorage.setItem("deck_recommend_server", srv);
                                        saveToolState("scoreControl", gameId, srv);
                                    }
                                }}
                                currentUserId={dbUserId}
                                currentServer={dbServer}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t("page.scoreControl.userId")} <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={dbUserId}
                                        onChange={(e) => {
                                            setDbUserId(e.target.value);
                                            if (dbAllowSave) localStorage.setItem("deck_recommend_userid", e.target.value);
                                        }}
                                        placeholder={t("page.scoreControl.userIdPlaceholder")}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                    />
                                    <div className="flex items-center justify-between mt-2 px-1">
                                        <span className="text-xs text-slate-500">{t("page.scoreControl.saveLocally")}</span>
                                        <button
                                            onClick={() => {
                                                const n = !dbAllowSave;
                                                setDbAllowSave(n);
                                                if (n) {
                                                    localStorage.setItem("deck_recommend_userid", dbUserId);
                                                    localStorage.setItem("deck_recommend_server", dbServer);
                                                    saveToolState("scoreControl", dbUserId, dbServer);
                                                } else {
                                                    localStorage.removeItem("deck_recommend_userid");
                                                    localStorage.removeItem("deck_recommend_server");
                                                }
                                            }}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${dbAllowSave ? 'bg-miku' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${dbAllowSave ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {t("page.scoreControl.harukiHintStart")} <ExternalLink href="https://haruki.seiunx.com" className="text-miku hover:underline">{t("page.scoreControl.harukiToolbox")}</ExternalLink> {t("page.scoreControl.harukiHintEnd")}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t("page.scoreControl.server")}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {SERVER_OPTIONS.map((s) => (
                                            <button
                                                key={s.value}
                                                onClick={() => {
                                                    setDbServer(s.value);
                                                    if (dbAllowSave) localStorage.setItem("deck_recommend_server", s.value);
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${dbServer === s.value
                                                    ? "bg-miku text-white shadow-md shadow-miku/20"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                            >
                                                {t(s.labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Event */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        {t("page.scoreControl.event")} <span className="text-red-400">*</span>
                                    </label>
                                    <EventSelector
                                        selectedEventId={dbEventId}
                                        onSelect={setDbEventId}
                                    />
                                </div>
                            </div>

                            {/* Card Config Toggle */}
                            <div>
                                <button
                                    onClick={() => setDbShowCardConfig(!dbShowCardConfig)}
                                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-miku transition-colors"
                                >
                                    <svg
                                        className={`w-4 h-4 transition-transform ${dbShowCardConfig ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {t("page.scoreControl.cardTrainingSettings")}
                                </button>
                                {dbShowCardConfig && (
                                    <div className="mt-3 overflow-x-auto">
                                        <table className="dr-config-table w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.rarity")}</th>
                                                    <th className="py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.disable")}</th>
                                                    <th className="py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.maxLevel")}</th>
                                                    <th className="py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.episodes")}</th>
                                                    <th className="py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.maxMaster")}</th>
                                                    <th className="py-2 px-2 text-slate-500 font-medium">{t("page.scoreControl.cardConfigHeaders.maxSkill")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {RARITY_CONFIG_KEYS.map((rk) => {
                                                    const cfg = dbCardConfig[rk.key];
                                                    return (
                                                        <tr key={rk.key} className="border-t border-slate-100">
                                                            <td className="py-2 px-2">
                                                                <div className="flex items-center gap-0.5">
                                                                    {rk.key === "rarity_birthday" ? (
                                                                        <div className="w-4 h-4 relative">
                                                                            <Image src="/data/icon/birthday.webp" alt="Birthday" fill className="object-contain" unoptimized />
                                                                        </div>
                                                                    ) : (
                                                                        Array.from({ length: parseInt(rk.key.split("_")[1]) }).map((_, i) => (
                                                                            <div key={i} className="w-3 h-3 relative">
                                                                                <Image src="/data/icon/star.webp" alt="Star" fill className="object-contain" unoptimized />
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <input type="checkbox" checked={!cfg.disable} onChange={(e) => updateDbCardConfig(rk.key, 'disable', !e.target.checked)} className="dr-checkbox" />
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <input type="checkbox" checked={cfg.rankMax} onChange={(e) => updateDbCardConfig(rk.key, 'rankMax', e.target.checked)} className="dr-checkbox" disabled={cfg.disable} />
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <input type="checkbox" checked={cfg.episodeRead} onChange={(e) => updateDbCardConfig(rk.key, 'episodeRead', e.target.checked)} className="dr-checkbox" disabled={cfg.disable} />
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <input type="checkbox" checked={cfg.masterMax} onChange={(e) => updateDbCardConfig(rk.key, 'masterMax', e.target.checked)} className="dr-checkbox" disabled={cfg.disable} />
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <input type="checkbox" checked={cfg.skillMax} onChange={(e) => updateDbCardConfig(rk.key, 'skillMax', e.target.checked)} className="dr-checkbox" disabled={cfg.disable} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Infinite Song Search Toggle */}
                            <div className="mt-4 p-3 rounded-xl border border-orange-200/60 bg-orange-50/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-primary-text">{t("page.scoreControl.infiniteSearch")}</span>
                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{t("page.scoreControl.experimental")}</span>
                                    </div>
                                    <button
                                        onClick={() => setInfiniteSearchEnabled(!infiniteSearchEnabled)}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${infiniteSearchEnabled ? 'bg-orange-500' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${infiniteSearchEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                {infiniteSearchEnabled && (
                                    <div className="mt-2 space-y-2">
                                        <div className="text-xs text-orange-600 flex items-start gap-1.5 bg-orange-100/60 rounded-lg p-2">
                                            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            <span>{t("page.scoreControl.infiniteWarning")}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400">{t("page.scoreControl.searchRatesHint")}</p>
                                        <p className="text-[10px] text-slate-500">{t("page.scoreControl.infiniteStartHint")}</p>
                                        {infiniteSearchRunning && (
                                            <button
                                                onClick={handleCancelInfiniteSearch}
                                                className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-lg font-bold text-sm shadow-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                {t("page.scoreControl.stopSearch")}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Calculate Button */}
                    <button
                        onClick={handleCalculate}
                        disabled={infiniteSearchEnabled && deckBuilderEnabled ? (infiniteSearchRunning || !dbUserId.trim() || !dbEventId.trim()) : (!selectedEventRate || isCalculating)}
                        className="w-full px-6 py-3 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isCalculating || infiniteSearchRunning ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                {infiniteSearchRunning ? t("page.scoreControl.searching") : t("page.scoreControl.calculating")}
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                {infiniteSearchEnabled && deckBuilderEnabled ? t("page.scoreControl.infiniteSearchButton") : t("page.scoreControl.smartCalculate")}
                            </>
                        )}
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="glass-card p-4 rounded-2xl mb-6 bg-red-50/80 border border-red-200/50">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Deck Builder Duration & Upload Time - above results */}
                {deckBuilderEnabled && !dbIsCalculating && (dbDuration !== null || dbUploadTime) && (
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {dbDuration !== null && <span className="text-xs text-slate-400">{t("page.scoreControl.calculationDuration", { seconds: (dbDuration / 1000).toFixed(1) })}</span>}
                        {dbUploadTime && <span className="text-xs text-slate-400">{t("page.scoreControl.dataTime", { time: formatDate(dbUploadTime * 1000, { dateStyle: "short", timeStyle: "short" }) })}</span>}
                    </div>
                )}

                {/* Infinite Search Duration - above results */}
                {infiniteSearchEnabled && deckBuilderEnabled && !infiniteSearchRunning && (infiniteSearchDuration !== null || infiniteSearchUploadTime) && (
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {infiniteSearchDuration !== null && <span className="text-xs text-slate-400">{t("page.scoreControl.searchDuration", { seconds: (infiniteSearchDuration / 1000).toFixed(1) })}</span>}
                        {infiniteSearchUploadTime && <span className="text-xs text-slate-400">{t("page.scoreControl.dataTime", { time: formatDate(infiniteSearchUploadTime * 1000, { dateStyle: "short", timeStyle: "short" }) })}</span>}
                    </div>
                )}

                {/* ===== Smart Route Plans (Primary) ===== */}
                {smartRoutes !== null && smartRoutes.length > 0 && (
                    <div className="sc-result-enter mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-miku rounded-full"></span>
                                {t("page.scoreControl.smartRoutesTitle")}
                            </h2>
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">
                                {t("page.scoreControl.routeCount", { count: formatNumber(smartRoutes.length) })}
                            </span>
                            <span className="text-xs text-slate-400">
                                {t("page.scoreControl.bonusRange", { min: minBonus, max: maxBonus })}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {smartRoutes.map((plan, idx) => {
                                const isExpanded = expandedRoute === idx;
                                return (
                                    <div key={idx} className="glass-card rounded-2xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedRoute(isExpanded ? null : idx)}
                                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                <span className="text-sm font-black text-primary-text whitespace-nowrap">
                                                    {t("page.scoreControl.routeLabel", { index: idx + 1 })}
                                                </span>
                                                {plan.isPureAFK ? (
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {t("page.scoreControl.pureAfk")}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        {t("page.scoreControl.afkAndControl")}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                                    {t("page.scoreControl.playCount", { count: formatNumber(plan.totalPlays) })}
                                                    {plan.afkCount > 0 && (
                                                        <span className="text-emerald-500 ml-1">{t("page.scoreControl.afkPlayCount", { count: formatNumber(plan.afkCount) })}</span>
                                                    )}
                                                </span>
                                                <span className="text-xs font-bold text-orange-500 whitespace-nowrap">
                                                    = {plan.totalPT} PT
                                                </span>
                                            </div>
                                            <svg className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                                                {plan.steps.map((step, si) => (
                                                    <div key={si} className={`rounded-xl p-4 border ${step.isAFK ? "bg-emerald-50/60 border-emerald-200/50" : "bg-blue-50/60 border-blue-200/50"}`}>
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${step.isAFK ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                                                {step.isAFK ? t("page.scoreControl.stepAfk") : t("page.scoreControl.stepControl")}
                                                            </span>
                                                            <span className="text-sm font-bold text-primary-text">x{step.count}</span>
                                                            <span className="text-xs text-slate-400">{t("page.scoreControl.eachTimePt", { pt: formatNumber(step.pt) })}</span>
                                                            <span className="text-xs text-slate-400">
                                                                {t("page.scoreControl.subtotal")} <span className="font-bold text-primary-text">{formatNumber(step.pt * step.count)} PT</span>
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-slate-400">{t("page.scoreControl.fire")}</span>
                                                                <div className="font-bold text-primary-text mt-0.5">{fireLabel(step.boost)} <span className="text-slate-400 font-normal">x{step.boostRate}</span></div>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400">{t("page.scoreControl.deckBonus")}</span>
                                                                <div className="font-bold text-primary-text mt-0.5">{step.eventBonus}%</div>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400">{t("page.scoreControl.scoreRange")}</span>
                                                                <div className="font-bold text-primary-text mt-0.5 font-mono">
                                                                    {step.isAFK ? <span className="text-emerald-600">0 ~ {formatNumber(step.scoreMax)}</span> : <span>{formatNumber(step.scoreMin)} ~ {formatNumber(step.scoreMax)}</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400">{t("page.scoreControl.action")}</span>
                                                                <div className="font-bold mt-0.5">
                                                                    {step.isAFK ? (
                                                                        <span className="text-emerald-600">{t("page.scoreControl.afkAction")}</span>
                                                                    ) : (
                                                                        <span className="text-blue-600">
                                                                            {step.scoreMin === step.scoreMax ? <>{t("page.scoreControl.targetScore", { score: formatNumber(step.scoreMin) })}</> : <>{t("page.scoreControl.controlToRange", { min: formatNumber(step.scoreMin), max: formatNumber(step.scoreMax) })}</>}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {dbResultsByBonus && dbResultsByBonus[step.eventBonus] && (
                                                            <div className="mt-2 pt-2 border-t border-slate-100/50">
                                                                <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                                                                    <span>{t("page.scoreControl.recommendedDeckWithBonus", { bonus: step.eventBonus })}</span>
                                                                    <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t("page.scoreControl.planCount", { count: formatNumber(dbResultsByBonus[step.eventBonus].length) })}</span>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {dbResultsByBonus[step.eventBonus].map((deck, deckIdx: number) => (
                                                                        <div key={deckIdx} className="bg-white/50 rounded-lg p-2 border border-slate-100">
                                                                            <div className="flex gap-1 flex-wrap mb-1">
                                                                                {deck.cards?.slice(0, 5).map((card: DeckCardInfo, i: number) => renderDeckCard(card, i))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <div className="flex items-center justify-end gap-2 pt-1">
                                                    <span className="text-xs text-slate-400">{t("page.scoreControl.total")}</span>
                                                    <span className="text-sm font-black text-orange-500 font-mono">{formatNumber(plan.steps.reduce((sum, s) => sum + s.pt * s.count, 0))} PT</span>
                                                    <span className="text-emerald-500 text-xs font-bold">{t("page.scoreControl.exactlyAchieved")}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Fallback */}
                {smartRoutes !== null && smartRoutes.length === 0 && fallbackResults !== null && (
                    <div className="sc-result-enter">
                        <div className="glass-card p-4 rounded-2xl mb-4 bg-amber-50/80 border border-amber-200/50">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <div>
                                    <p className="text-sm font-medium text-amber-800">{t("page.scoreControl.fallbackNotice")}</p>
                                    <p className="text-xs text-amber-600 mt-0.5">{t("page.scoreControl.fallbackSummary", { min: minBonus, max: maxBonus, target: formatNumber(targetPT) })}</p>
                                </div>
                            </div>
                        </div>
                        {fallbackResults.length === 0 ? (
                            <div className="glass-card p-8 rounded-2xl text-center">
                                <p className="text-slate-500 font-medium">{t("page.scoreControl.noPlan")}</p>
                                <p className="text-xs text-slate-400 mt-1">{t("page.scoreControl.noPlanHint")}</p>
                            </div>
                        ) : (
                            <>
                                <div className="glass-card p-4 sm:p-5 rounded-2xl mb-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                                <span className="w-1.5 h-6 bg-miku rounded-full"></span>{t("page.scoreControl.fallbackTitle")}
                                            </h2>
                                            <span className="px-2.5 py-1 bg-miku/10 text-miku text-xs font-bold rounded-full">{t("page.scoreControl.planCount", { count: formatNumber(fallbackCount) })}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                            <span>{t("page.scoreControl.targetPtLabel", { target: formatNumber(targetPT) })}</span>
                                            <span>·</span>
                                            <span>{t("page.scoreControl.songRateLabel", { rate: selectedEventRate })}</span>
                                            {selectedMusicTitle && (<><span>·</span><span className="truncate max-w-[200px]">{selectedMusicTitle}</span></>)}
                                        </div>
                                    </div>
                                </div>
                                {fallbackResults.map((group) => (
                                    <div key={group.boost} className="glass-card rounded-2xl mb-4 overflow-hidden">
                                        <div className="sc-boost-header px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{group.label}</span>
                                                <span className="text-xs text-slate-400">{t("page.scoreControl.multiplier", { rate: group.boostRate })}</span>
                                            </div>
                                            <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">{t("page.scoreControl.planCount", { count: formatNumber(group.results.length) })}</span>
                                        </div>
                                        {renderResultsTable(group.results)}
                                    </div>
                                ))}
                                {dbResults !== null && dbResults.length > 0 && (
                                    <div className="glass-card p-4 sm:p-5 rounded-2xl mb-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-miku rounded-full"></span>
                                            <h3 className="text-sm font-bold text-primary-text">{t("page.scoreControl.recommendedDecks")}</h3>
                                        </div>
                                        {Object.entries(dbResultsByBonus).sort(([a], [b]) => Number(a) - Number(b)).map(([bonus, decks]) => (
                                            <div key={bonus} className="mb-3 last:mb-0">
                                                <div className="text-[10px] font-bold text-miku mb-1.5">{t("page.scoreControl.recommendedDeckWithBonus", { bonus })}</div>
                                                <div className="space-y-2">
                                                    {decks.map((deck, deckIdx: number) => (
                                                        <div key={deckIdx} className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-100 dark:border-slate-700/50">
                                                            <div className="flex gap-1 flex-wrap">
                                                                {deck.cards?.slice(0, 5).map((card: DeckCardInfo, i: number) => renderDeckCard(card, i))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* No results at all */}
                {smartRoutes !== null && smartRoutes.length === 0 && fallbackResults === null && (
                    <div className="glass-card p-8 rounded-2xl text-center sc-result-enter">
                        <p className="text-slate-500 font-medium">{t("page.scoreControl.noPlan")}</p>
                        <p className="text-xs text-slate-400 mt-1">{t("page.scoreControl.noPlanHint")}</p>
                    </div>
                )}

                {/* Deck Builder Status */}
                {deckBuilderEnabled && (
                    <div className="mb-6">
                        {dbIsCalculating && (
                            <div className="glass-card p-6 rounded-2xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <svg className="w-5 h-5 animate-spin text-miku flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary-text">{t("page.scoreControl.searchingDecks")}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{t("page.scoreControl.deckBuilderProgressTask")}</p>
                                    </div>
                                    <span className="text-xs font-bold text-miku tabular-nums">{Math.round(dbFakeProgress)}%</span>
                                </div>
                                <div className="sc-fake-progress-track">
                                    <div className="sc-fake-progress-fill" style={{ width: `${dbFakeProgress}%` }} />
                                </div>
                            </div>
                        )}
                        {dbError && (
                            <div className="glass-card p-4 rounded-2xl mb-4 bg-red-50/80 border border-red-200/50">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-sm font-medium text-red-700">{dbError}</p>
                                </div>
                            </div>
                        )}
                        {!dbIsCalculating && dbResults !== null && dbResults.length === 0 && (
                            <div className="glass-card p-6 rounded-2xl text-center">
                                <p className="text-slate-500 font-medium text-sm">{t("page.scoreControl.noMatchingDeck")}</p>
                                <p className="text-xs text-slate-400 mt-1">{t("page.scoreControl.noMatchingDeckHint")}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Infinite Song Search Progress & Results */}
                {infiniteSearchEnabled && deckBuilderEnabled && (infiniteSearchRunning || infiniteSearchResults.length > 0) && (
                    <div className="mb-6 sc-result-enter">
                        {infiniteSearchRunning && infiniteSearchProgress && (
                            <div className="glass-card p-5 rounded-2xl mb-4 border border-orange-200/50 bg-orange-50/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <svg className="w-5 h-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="text-sm font-bold text-primary-text">{t("page.scoreControl.infiniteInProgress")}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div><span className="text-slate-400">{t("page.scoreControl.currentRate")}</span><div className="font-bold text-orange-600 mt-0.5">{infiniteSearchProgress.currentRate}%</div></div>
                                    <div><span className="text-slate-400">{t("page.scoreControl.checkedCount")}</span><div className="font-bold text-primary-text mt-0.5">{t("page.scoreControl.checkedSongs", { count: formatNumber(infiniteSearchProgress.totalChecked) })}</div></div>
                                    <div><span className="text-slate-400">{t("page.scoreControl.foundCount")}</span><div className="font-bold text-emerald-600 mt-0.5">{infiniteSearchProgress.found} / 10</div></div>
                                    <div><span className="text-slate-400">{t("page.scoreControl.currentSong")}</span><div className="font-bold text-primary-text mt-0.5 truncate">{infiniteSearchProgress.currentSongTitle}</div></div>
                                </div>
                                <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
                                    <div className="bg-gradient-to-r from-orange-400 to-red-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (VALID_EVENT_RATES.indexOf(infiniteSearchProgress.currentRate) + 1) / VALID_EVENT_RATES.length * 100)}%` }} />
                                </div>
                                {infiniteStepProgress > 0 && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{t("page.scoreControl.currentStep")}</span>
                                        <div className="sc-fake-progress-track flex-1">
                                            <div className="sc-fake-progress-fill !bg-gradient-to-r !from-orange-400 !to-red-400" style={{ width: `${infiniteStepProgress}%` }} />
                                        </div>
                                        <span className="text-[10px] font-bold text-orange-500 tabular-nums w-8 text-right">{Math.round(infiniteStepProgress)}%</span>
                                    </div>
                                )}
                                <p className="mt-1.5 text-[10px] text-slate-400">{t("page.scoreControl.parallelWorkersShort", { count: Math.min(navigator.hardwareConcurrency || 4, 4) })}</p>
                            </div>
                        )}

                        {!infiniteSearchRunning && infiniteSearchResults.length > 0 && (
                            <div className="glass-card p-4 rounded-2xl mb-4 bg-emerald-50/80 border border-emerald-200/50">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    <span className="text-sm font-bold text-emerald-700">{t("page.scoreControl.infiniteComplete", { rateCount: formatNumber(infiniteSearchResults.length), songCount: formatNumber(infiniteSearchResults.reduce((s, r) => s + r.songs.length, 0)) })}</span>
                                </div>
                            </div>
                        )}

                        {!infiniteSearchRunning && infiniteSearchResults.length === 0 && (
                            <div className="glass-card p-6 rounded-2xl mb-4 text-center">
                                <p className="text-slate-500 font-medium text-sm">{t("page.scoreControl.noInfiniteSongs")}</p>
                                <p className="text-xs text-slate-400 mt-1">{t("page.scoreControl.noInfiniteSongsHint")}</p>
                            </div>
                        )}

                        {infiniteSearchResults.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                        <span className="w-1.5 h-6 bg-gradient-to-b from-red-400 to-orange-500 rounded-full"></span>
                                        {t("page.scoreControl.infiniteResultsTitle")}
                                    </h2>
                                    <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">{t("page.scoreControl.rateCount", { count: formatNumber(infiniteSearchResults.length) })}</span>
                                </div>
                                <div className="space-y-3">
                                    {infiniteSearchResults.map((result, idx) => {
                                        const isExpanded = infiniteExpandedIdx === idx;
                                        return (
                                            <div key={idx} className="glass-card rounded-2xl overflow-hidden">
                                                <button onClick={() => setInfiniteExpandedIdx(isExpanded ? null : idx)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left">
                                                    <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                        <span className="text-sm font-black text-primary-text whitespace-nowrap">#{idx + 1}</span>
                                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">{t("page.scoreControl.rateBadge", { rate: result.eventRate })}</span>
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">{t("page.scoreControl.pureAfk")}</span>
                                                        <span className="text-xs text-slate-400 whitespace-nowrap">{t("page.scoreControl.songsAndRoutes", { songs: formatNumber(result.songs.length), routes: formatNumber(result.routes.length) })}</span>
                                                    </div>
                                                    <svg className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {isExpanded && (
                                                    <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                                                        {/* Songs with cover images */}
                                                        <div className="rounded-xl p-3 border border-slate-200/50 bg-slate-50/50">
                                                            <div className="text-[10px] text-slate-400 mb-1.5">{t("page.scoreControl.availableSongs", { count: formatNumber(result.songs.length) })}</div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {result.songs.map((song, si) => (

                                                                    <Link key={si} href={`/music/${song.musicId}`} target="_blank" className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-100 hover:border-miku/30 hover:shadow-sm transition-all group">

                                                                        {song.assetbundleName && result.songs.length < 5 && (
                                                                            <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 ring-1 ring-slate-200">
                                                                                <Image src={getMusicJacketUrl(song.assetbundleName, assetSource)} alt={song.musicTitle} fill className="object-cover" unoptimized />
                                                                            </div>
                                                                        )}
                                                                        <span className="text-xs text-primary-text group-hover:text-miku transition-colors">{song.musicTitle}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Routes */}
                                                        {result.routes.slice(0, 5).map((plan, pi) => (
                                                            <div key={pi} className="rounded-xl p-4 border bg-emerald-50/60 border-emerald-200/50">
                                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{t("page.scoreControl.routeLabel", { index: pi + 1 })}</span>
                                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{t("page.scoreControl.pureAfk")}</span>
                                                                    <span className="text-xs text-slate-400">{t("page.scoreControl.routeSummary", { plays: formatNumber(plan.totalPlays), pt: formatNumber(plan.totalPT) })}</span>
                                                                </div>
                                                                {plan.steps.map((step, si) => (
                                                                    <div key={si} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-1">
                                                                        <div><span className="text-slate-400">{t("page.scoreControl.step")}</span><div className="font-bold text-emerald-600 mt-0.5">{t("page.scoreControl.afkTimes", { count: formatNumber(step.count) })}</div></div>
                                                                        <div><span className="text-slate-400">{t("page.scoreControl.fire")}</span><div className="font-bold text-primary-text mt-0.5">{fireLabel(step.boost)} <span className="text-slate-400 font-normal">x{step.boostRate}</span></div></div>
                                                                        <div><span className="text-slate-400">{t("page.scoreControl.deckBonus")}</span><div className="font-bold text-primary-text mt-0.5">{step.eventBonus}%</div></div>
                                                                        <div><span className="text-slate-400">{t("page.scoreControl.perPlayPt")}</span><div className="font-bold text-orange-500 mt-0.5">{step.pt} PT</div></div>
                                                                    </div>
                                                                ))}
                                                                {/* Matching decks with full card display */}
                                                                {(() => {
                                                                    const neededBonuses = new Set(plan.steps.map(s => s.eventBonus));
                                                                    const matchingDecks = result.decks.filter((d) => {
                                                                        const bonus = d.eventBonus ?? (d.score || 0);
                                                                        const key = Math.round(bonus * 10) / 10;
                                                                        return neededBonuses.has(key);
                                                                    });
                                                                    if (matchingDecks.length === 0) return null;
                                                                    return (
                                                                        <div className="mt-2 pt-2 border-t border-emerald-200/50">
                                                                            <div className="text-[10px] text-slate-400 mb-1">{t("page.scoreControl.recommendedDeck")}</div>
                                                                            {matchingDecks.slice(0, 2).map((deck, di: number) => (
                                                                                <div key={di} className="bg-white/50 rounded-lg p-2 border border-slate-100 mb-1">
                                                                                    <div className="flex gap-1 flex-wrap mb-1">
                                                                                        {deck.cards?.slice(0, 5).map((card: DeckCardInfo, ci: number) => renderDeckCard(card, ci, "sm"))}
                                                                                    </div>
                                                                                    <span className="text-[10px] text-slate-400">{t("page.scoreControl.bonusLabel", { bonus: Math.round((deck.eventBonus ?? deck.score ?? 0) * 10) / 10 })}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 text-center text-xs text-slate-400">
                    <p>{t("page.scoreControl.licenseNotice")}</p>
                </div>
            </div>
        </MainLayout>
    );
}
