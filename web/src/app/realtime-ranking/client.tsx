"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import MainLayout from "@/components/MainLayout";
import RankingHeader from "@/components/realtime-ranking/RankingHeader";
import RankingList from "@/components/realtime-ranking/RankingList";
import CurrentEventCard from "@/components/realtime-ranking/CurrentEventCard";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { fetchEventList } from "@/lib/prediction-api";
import { fetchRealtimeRanking, fetchRealtimeRankingMasterData, fetchChurnData, fetchWorldLinkChurnData, fetchWorldLinkRanking } from "@/lib/realtime-ranking-api";
import ParkingPeriodsModal from "@/components/realtime-ranking/ParkingPeriodsModal";
import {
    RealtimeRankingBoardMode,
    RealtimeRankingEntryWithDiff,
    RealtimeRankingMasterData,
    RealtimeRankingRegion,
    RealtimeRankingSnapshot,
    ChurnRankingEntry,
    ChurnApiResponse,
    WorldLinkGroupSnapshot,
    WorldLinkSnapshot,
} from "@/types/realtime-ranking";
import { IEventInfo } from "@/types/events";
import { EventListItem } from "@/types/prediction";
import { CHARACTER_NAMES } from "@/types/types";

const DEFAULT_REGION: RealtimeRankingRegion = "cn";
const POLL_INTERVAL = 10_000;
const QUICK_JUMP_RANKS = [1, 20, 50, 100] as const;
const NAV_OFFSET = 90; // px — navbar height + breathing room
const SHOW_CHURN_STORAGE_KEY = "realtime-ranking:showChurn";
const CHURN_RETRY_DELAYS = [8_000, 20_000, 45_000, 60_000] as const;

function scrollToRank(rank: number) {
    const el = document.querySelector<HTMLElement>(`[data-rank="${rank}"]`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });

    // 滚动到达后给目标行加高亮脉冲
    const highlight = () => {
        el.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease";
        el.style.boxShadow = "inset 0 0 0 2px var(--color-miku), 0 0 16px var(--color-miku)";
        el.style.backgroundColor = "color-mix(in srgb, var(--color-miku) 8%, transparent)";
        el.style.borderRadius = "8px";
        setTimeout(() => {
            el.style.transition = "box-shadow 0.8s ease, background-color 0.8s ease, border-radius 0.8s ease";
            el.style.boxShadow = "";
            el.style.backgroundColor = "";
            setTimeout(() => {
                el.style.borderRadius = "";
                el.style.transition = "";
            }, 800);
        }, 600);
    };

    // 等滚动结束后触发高亮
    let scrollTimer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            window.removeEventListener("scroll", onScroll);
            highlight();
        }, 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // 兜底：如果已经在目标位置不会触发 scroll 事件
    scrollTimer = setTimeout(() => {
        window.removeEventListener("scroll", onScroll);
        highlight();
    }, 100);
}
const EMPTY_MASTER_DATA: RealtimeRankingMasterData = {
    cards: [],
    honors: [],
    honorGroups: [],
    bondsHonors: [],
    bondsHonorWords: [],
    gameCharaUnits: [],
};

/** 获取当前小时的 ISO key，如 "2026-03-23T14:00:00Z" */
function getCurrentHourKey(): string {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readShowChurnPreference(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return localStorage.getItem(SHOW_CHURN_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeShowChurnPreference(value: boolean): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(SHOW_CHURN_STORAGE_KEY, value ? "1" : "0");
    } catch {
        // ignore
    }
}

function decodeHtmlEntities(value: string): string {
    if (typeof window === "undefined") return value;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}

function buildEntriesWithDiff(
    snapshot: RealtimeRankingSnapshot,
    previousSnapshot: RealtimeRankingSnapshot | null,
    lastChanges: Map<string, { rankDelta: number; scoreDelta: number; changedAt: number }>,
    scopeKey: string,
): RealtimeRankingEntryWithDiff[] {
    const previousMap = new Map(previousSnapshot?.entries.map((entry) => [entry.userId, entry]) ?? []);

    return snapshot.entries.map((entry) => {
        const previous = previousMap.get(entry.userId);
        const rankDelta = previous ? previous.rank - entry.rank : 0;
        const scoreDelta = previous ? entry.score - previous.score : 0;
        const scopedUserKey = `${scopeKey}:${entry.userId}`;

        // 分别追踪 scoreDelta 和 rankDelta，避免用 0 覆盖之前有意义的值
        // 例如：top5 超过 top4 时，被超过的玩家 rankDelta=-1 但 scoreDelta=0，
        // 不应该用 scoreDelta=0 覆盖之前记录的分数变动
        if (scoreDelta !== 0 || rankDelta !== 0) {
            const existing = lastChanges.get(scopedUserKey);
            lastChanges.set(scopedUserKey, {
                scoreDelta: scoreDelta !== 0 ? scoreDelta : (existing?.scoreDelta ?? 0),
                rankDelta: rankDelta !== 0 ? rankDelta : (existing?.rankDelta ?? 0),
                changedAt: Date.now(),
            });
        }

        const saved = lastChanges.get(scopedUserKey);

        return {
            ...entry,
            displayName: decodeHtmlEntities(entry.displayName),
            previousRank: previous?.rank,
            previousScore: previous?.score,
            rankDelta,
            scoreDelta,
            isNewEntry: !previous,
            lastScoreDelta: saved?.scoreDelta,
            lastRankDelta: saved?.rankDelta,
            lastChangedAt: saved?.changedAt,
        };
    });
}

function findWorldLinkGroup(snapshot: WorldLinkSnapshot | null, gameCharacterId: number | null): WorldLinkGroupSnapshot | null {
    if (!snapshot || snapshot.groups.length === 0) return null;
    if (gameCharacterId != null) {
        const matched = snapshot.groups.find((group) => group.gameCharacterId === gameCharacterId);
        if (matched) return matched;
    }
    return snapshot.groups[0] ?? null;
}

function applySnapshotChurnDiff(
    previous: RealtimeRankingSnapshot | null,
    next: RealtimeRankingSnapshot | null,
    onChanged: (userId: string) => void,
) {
    if (!previous || !next) return;

    const prevMap = new Map(previous.entries.map((entry) => [entry.userId, entry]));
    for (const entry of next.entries) {
        const prev = prevMap.get(entry.userId);
        if (prev && entry.score !== prev.score) {
            onChanged(entry.userId);
        }
    }
}

function RealtimeRankingContent() {
    const { assetSource, themeColor } = useTheme();

    const [hasInitializedQuery, setHasInitializedQuery] = useState(false);
    const [region, setRegion] = useState<RealtimeRankingRegion>(DEFAULT_REGION);
    const [boardMode, setBoardMode] = useState<RealtimeRankingBoardMode>("overall");
    const [selectedWorldLinkCharacterId, setSelectedWorldLinkCharacterId] = useState<number | null>(null);
    const [snapshot, setSnapshot] = useState<RealtimeRankingSnapshot | null>(null);
    const [previousSnapshot, setPreviousSnapshot] = useState<RealtimeRankingSnapshot | null>(null);
    const [worldLinkSnapshot, setWorldLinkSnapshot] = useState<WorldLinkSnapshot | null>(null);
    const [previousWorldLinkSnapshot, setPreviousWorldLinkSnapshot] = useState<WorldLinkSnapshot | null>(null);
    const [masterData, setMasterData] = useState<RealtimeRankingMasterData>(EMPTY_MASTER_DATA);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(Math.floor(POLL_INTERVAL / 1000));
    const [hasRecentUpdate, setHasRecentUpdate] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<IEventInfo | null>(null);
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
    const [activeRank, setActiveRank] = useState<number | null>(null);
    const [showChurn, setShowChurn] = useState(false);
    const [churnData, setChurnData] = useState<Map<string, ChurnRankingEntry>>(new Map());
    const [parkingModalUserId, setParkingModalUserId] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const snapshotRef = useRef<RealtimeRankingSnapshot | null>(null);
    const worldLinkSnapshotRef = useRef<WorldLinkSnapshot | null>(null);
    const boardModeRef = useRef<RealtimeRankingBoardMode>("overall");
    const selectedWorldLinkCharacterIdRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());
    const lastChangesRef = useRef(new Map<string, { rankDelta: number; scoreDelta: number; changedAt: number }>());
    const churnDataRef = useRef<Map<string, ChurnRankingEntry>>(new Map());
    const churnRequestIdRef = useRef(0);
    const churnRetryTimerRef = useRef<number | null>(null);

    /** 热更：某用户分数变化时，更新其当前小时的周回计数 */
    const updateChurnForUser = useCallback((userId: string) => {
        const map = churnDataRef.current;
        const entry = map.get(userId);
        if (!entry) return;

        const hourKey = getCurrentHourKey();
        const existing = entry.hourly_churn.find((h) => h.hour === hourKey);
        if (existing) {
            existing.count += 1;
        } else {
            entry.hourly_churn.push({ hour: hourKey, count: 1 });
        }
        entry.churn_48h += 1;

        // 触发 React 重渲染
        const next = new Map(map);
        setChurnData(next);
        churnDataRef.current = next;
    }, []);

    useEffect(() => {
        setShowChurn(readShowChurnPreference());
    }, []);

    useEffect(() => {
        boardModeRef.current = boardMode;
    }, [boardMode]);

    useEffect(() => {
        selectedWorldLinkCharacterIdRef.current = selectedWorldLinkCharacterId;
    }, [selectedWorldLinkCharacterId]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const regionParam = params.get("region");
        if (regionParam === "cn" || regionParam === "jp") {
            setRegion(regionParam);
        }
        const boardParam = params.get("board");
        if (boardParam === "worldlink") {
            setBoardMode("worldlink");
        }
        const wlCharacterIdParam = params.get("wlCharacterId");
        if (wlCharacterIdParam && /^\d+$/.test(wlCharacterIdParam)) {
            setSelectedWorldLinkCharacterId(Number(wlCharacterIdParam));
        }
        setHasInitializedQuery(true);
    }, []);

    const updateUrlState = useCallback((nextRegion: RealtimeRankingRegion, nextBoardMode: RealtimeRankingBoardMode, nextWorldLinkCharacterId: number | null) => {
        const url = new URL(window.location.href);
        url.searchParams.set("region", nextRegion);
        if (nextBoardMode === "worldlink") {
            url.searchParams.set("board", "worldlink");
            if (nextWorldLinkCharacterId != null) {
                url.searchParams.set("wlCharacterId", String(nextWorldLinkCharacterId));
            } else {
                url.searchParams.delete("wlCharacterId");
            }
        } else {
            url.searchParams.delete("board");
            url.searchParams.delete("wlCharacterId");
        }
        window.history.replaceState({}, "", url.toString());
    }, []);

    const loadSnapshot = useCallback(async (nextRegion: RealtimeRankingRegion, asRefresh = false) => {
        const currentRequestId = ++requestIdRef.current;
        if (asRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const [snapshotResult, worldLinkResult] = await Promise.allSettled([
                fetchRealtimeRanking(nextRegion),
                fetchWorldLinkRanking(nextRegion),
            ]);
            if (currentRequestId !== requestIdRef.current) return;

            if (snapshotResult.status !== "fulfilled") {
                throw snapshotResult.reason;
            }

            const nextSnapshot = snapshotResult.value;
            const previous = snapshotRef.current;
            if (asRefresh && previous) {
                setPreviousSnapshot(previous);
            }
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);

            const nextWorldLinkSnapshot = worldLinkResult.status === "fulfilled"
                && worldLinkResult.value
                && worldLinkResult.value.eventId === nextSnapshot.eventId
                ? worldLinkResult.value
                : null;
            const previousWorldLink = worldLinkSnapshotRef.current;

            if (nextWorldLinkSnapshot) {
                if (asRefresh && previousWorldLink) {
                    setPreviousWorldLinkSnapshot(previousWorldLink);
                }
                worldLinkSnapshotRef.current = nextWorldLinkSnapshot;
                setWorldLinkSnapshot(nextWorldLinkSnapshot);
            } else if (!asRefresh || previousWorldLink == null) {
                worldLinkSnapshotRef.current = null;
                setWorldLinkSnapshot(null);
                setPreviousWorldLinkSnapshot(null);
            }

            if (asRefresh) {
                if (boardModeRef.current === "worldlink") {
                    const selectedCharacterId = selectedWorldLinkCharacterIdRef.current;
                    applySnapshotChurnDiff(
                        findWorldLinkGroup(previousWorldLink, selectedCharacterId),
                        findWorldLinkGroup(nextWorldLinkSnapshot, selectedCharacterId),
                        updateChurnForUser,
                    );
                } else {
                    applySnapshotChurnDiff(previous, nextSnapshot, updateChurnForUser);
                }
            }

            setCountdown(Math.floor(POLL_INTERVAL / 1000));
            lastUpdateTimeRef.current = Date.now();
            setSecondsSinceUpdate(0);
            if (asRefresh) {
                setHasRecentUpdate(true);
                window.setTimeout(() => setHasRecentUpdate(false), 1200);
            }
            setError(null);
        } catch (err) {
            if (currentRequestId !== requestIdRef.current) return;
            setError(err instanceof Error ? err.message : "加载实时排行榜失败");
        } finally {
            if (currentRequestId !== requestIdRef.current) return;
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [updateChurnForUser]);

    const loadChurnData = useCallback(async (
        nextRegion: RealtimeRankingRegion,
        nextBoardMode: RealtimeRankingBoardMode,
        nextWorldLinkCharacterId: number | null,
    ): Promise<boolean> => {
        const currentRequestId = ++churnRequestIdRef.current;

        try {
            const data: ChurnApiResponse = nextBoardMode === "worldlink" && nextWorldLinkCharacterId != null
                ? await fetchWorldLinkChurnData(nextRegion, nextWorldLinkCharacterId)
                : await fetchChurnData(nextRegion);
            if (currentRequestId !== churnRequestIdRef.current) return true;

            const map = new Map<string, ChurnRankingEntry>();
            const scopeKey = data.board_type === "worldlink" ? `worldlink:${data.target_id}` : "overall";
            for (const entry of data.rankings) {
                const uid = String(entry.userId);
                map.set(uid, entry);

                // 将 churn 的 last_change 预注入 lastChangesRef，
                // 这样首次自动刷新后仍然能显示涨跌幅而不会被覆盖为 "—"
                const scopedUid = `${scopeKey}:${uid}`;
                if (entry.last_change && !lastChangesRef.current.has(scopedUid)) {
                    // 时间戳兼容：秒级 vs 毫秒级
                    const rawTime = entry.last_change.time;
                    const changedAt = rawTime < 1e12 ? rawTime * 1000 : rawTime;
                    lastChangesRef.current.set(scopedUid, {
                        scoreDelta: entry.last_change.delta,
                        rankDelta: 0,
                        changedAt,
                    });
                }
            }

            setChurnData(map);
            churnDataRef.current = map;
            return true;
        } catch {
            if (currentRequestId !== churnRequestIdRef.current) return true;
            return false;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchRealtimeRankingMasterData()
            .then((data) => {
                if (!cancelled) {
                    setMasterData(data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setMasterData(EMPTY_MASTER_DATA);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCountdown((prev) => (prev <= 1 ? Math.floor(POLL_INTERVAL / 1000) : prev - 1));
            setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdateTimeRef.current) / 1000));
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        updateUrlState(region, boardMode, boardMode === "worldlink" ? selectedWorldLinkCharacterId : null);
    }, [hasInitializedQuery, region, boardMode, selectedWorldLinkCharacterId, updateUrlState]);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        let cancelled = false;

        async function loadCurrentEvent() {
            try {
                const [eventList, masterEvents] = await Promise.all([
                    fetchEventList(region),
                    fetchMasterData<IEventInfo[]>("events.json"),
                ]);

                if (cancelled) return;

                const activeEvent = [...eventList]
                    .sort((a, b) => a.id - b.id)
                    .find((event: EventListItem) => event.is_active);

                if (!activeEvent) {
                    setCurrentEvent(null);
                    return;
                }

                const matched = masterEvents.find((event) => event.id === activeEvent.id);

                // Use timestamps from prediction API (reflects actual server schedule),
                // with sec→ms normalization, falling back to master data
                const s = activeEvent.start_at
                    ? (activeEvent.start_at < 10000000000 ? activeEvent.start_at * 1000 : activeEvent.start_at)
                    : matched?.startAt;
                const e = activeEvent.end_at
                    ? (activeEvent.end_at < 10000000000 ? activeEvent.end_at * 1000 : activeEvent.end_at)
                    : matched?.aggregateAt;

                const startAt = s || 0;
                const endAt = e || 0;

                const correctedEvent: IEventInfo = {
                    id: activeEvent.id,
                    name: matched?.name || activeEvent.name || "",
                    eventType: matched?.eventType || "marathon",
                    assetbundleName: matched?.assetbundleName || "",
                    bgmAssetbundleName: matched?.bgmAssetbundleName || "",
                    eventOnlyComponentDisplayStartAt: startAt,
                    startAt,
                    aggregateAt: endAt,
                    rankingAnnounceAt: endAt,
                    distributionStartAt: endAt,
                    eventOnlyComponentDisplayEndAt: endAt,
                    closedAt: endAt,
                    distributionEndAt: endAt,
                    virtualLiveId: matched?.virtualLiveId || 0,
                    unit: matched?.unit || "",
                    isCountLeaderCharacterPlay: matched?.isCountLeaderCharacterPlay || false,
                };

                setCurrentEvent(correctedEvent);
            } catch {
                if (!cancelled) {
                    setCurrentEvent(null);
                }
            }
        }

        void loadCurrentEvent();

        return () => {
            cancelled = true;
        };
    }, [hasInitializedQuery, region]);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        setPreviousSnapshot(null);
        setSnapshot(null);
        setPreviousWorldLinkSnapshot(null);
        setWorldLinkSnapshot(null);
        snapshotRef.current = null;
        worldLinkSnapshotRef.current = null;
        lastChangesRef.current.clear();
        void loadSnapshot(region, false);

        const timer = window.setInterval(() => {
            void loadSnapshot(region, true);
        }, POLL_INTERVAL);

        return () => {
            window.clearInterval(timer);
        };
    }, [hasInitializedQuery, region, loadSnapshot]);

    const worldLinkAvailable = !!worldLinkSnapshot
        && !!snapshot
        && worldLinkSnapshot.eventId === snapshot.eventId
        && worldLinkSnapshot.groups.length > 0;
    const isWorldBloomEvent = currentEvent?.eventType === "world_bloom";
    const activeWorldLinkGroup = useMemo(
        () => findWorldLinkGroup(worldLinkSnapshot, selectedWorldLinkCharacterId),
        [selectedWorldLinkCharacterId, worldLinkSnapshot],
    );
    const previousWorldLinkGroup = useMemo(() => {
        if (!previousWorldLinkSnapshot || !activeWorldLinkGroup) return null;
        return previousWorldLinkSnapshot.groups.find((group) => group.gameCharacterId === activeWorldLinkGroup.gameCharacterId) ?? null;
    }, [activeWorldLinkGroup, previousWorldLinkSnapshot]);
    const isWorldLinkMode = boardMode === "worldlink" && worldLinkAvailable && !!activeWorldLinkGroup;
    const activeSnapshot = isWorldLinkMode ? activeWorldLinkGroup : snapshot;
    const activePreviousSnapshot = isWorldLinkMode ? previousWorldLinkGroup : previousSnapshot;
    const activeScopeLabel = isWorldLinkMode && activeWorldLinkGroup
        ? `WL单榜 · ${CHARACTER_NAMES[activeWorldLinkGroup.gameCharacterId] || `角色 ${activeWorldLinkGroup.gameCharacterId}`}`
        : "总榜";
    const activeChurnData = churnData;
    const shouldShowChurnToggle = true;
    const activeChurnBoardMode: RealtimeRankingBoardMode = isWorldLinkMode ? "worldlink" : "overall";
    const activeChurnTargetId = isWorldLinkMode && activeWorldLinkGroup ? activeWorldLinkGroup.gameCharacterId : null;

    useEffect(() => {
        if (!worldLinkSnapshot || worldLinkSnapshot.groups.length === 0) {
            setSelectedWorldLinkCharacterId(null);
            return;
        }

        setSelectedWorldLinkCharacterId((prev) => {
            if (prev != null && worldLinkSnapshot.groups.some((group) => group.gameCharacterId === prev)) {
                return prev;
            }
            return worldLinkSnapshot.groups[0].gameCharacterId;
        });
    }, [worldLinkSnapshot]);

    useEffect(() => {
        if (!isLoading && boardMode === "worldlink" && !worldLinkAvailable) {
            setBoardMode("overall");
        }
    }, [boardMode, isLoading, worldLinkAvailable]);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        let disposed = false;
        const emptyMap = new Map<string, ChurnRankingEntry>();
        setChurnData(emptyMap);
        churnDataRef.current = emptyMap;
        setParkingModalUserId(null);

        if (churnRetryTimerRef.current != null) {
            window.clearTimeout(churnRetryTimerRef.current);
            churnRetryTimerRef.current = null;
        }

        const tryLoad = (attempt: number) => {
            if (disposed) return;

            void loadChurnData(region, activeChurnBoardMode, activeChurnTargetId).then((ok) => {
                if (disposed || ok) return;

                const retryDelay = CHURN_RETRY_DELAYS[Math.min(attempt, CHURN_RETRY_DELAYS.length - 1)];
                churnRetryTimerRef.current = window.setTimeout(() => {
                    tryLoad(attempt + 1);
                }, retryDelay);
            });
        };

        tryLoad(0);

        return () => {
            disposed = true;
            churnRequestIdRef.current += 1;
            if (churnRetryTimerRef.current != null) {
                window.clearTimeout(churnRetryTimerRef.current);
                churnRetryTimerRef.current = null;
            }
        };
    }, [activeChurnBoardMode, activeChurnTargetId, hasInitializedQuery, loadChurnData, region]);

    const rankingEntries = useMemo(() => {
        if (!activeSnapshot) return [];
        return buildEntriesWithDiff(
            activeSnapshot,
            activePreviousSnapshot,
            lastChangesRef.current,
            isWorldLinkMode && activeWorldLinkGroup ? `worldlink:${activeWorldLinkGroup.gameCharacterId}` : "overall",
        );
    }, [activePreviousSnapshot, activeSnapshot, activeWorldLinkGroup, isWorldLinkMode]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 md:pr-24 py-8">
                <RankingHeader
                    region={region}
                    onRegionChange={setRegion}
                    updatedAt={activeSnapshot?.updatedAt}
                    eventId={activeSnapshot?.eventId}
                    scopeLabel={activeScopeLabel}
                    totalEntries={activeSnapshot?.entries.length ?? 0}
                    isRefreshing={isRefreshing}
                    showChurn={shouldShowChurnToggle ? showChurn : false}
                    onShowChurnChange={(v) => {
                        setShowChurn(v);
                        writeShowChurnPreference(v);
                    }}
                    showChurnToggle={shouldShowChurnToggle}
                />

                <CurrentEventCard
                    event={currentEvent}
                    assetSource={assetSource}
                    themeColor={themeColor}
                />

                {(worldLinkAvailable || isWorldBloomEvent) && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setBoardMode("overall")}
                                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                                    boardMode === "overall"
                                        ? "bg-miku text-white shadow-md shadow-miku/20"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-miku/40 hover:text-miku dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                            >
                                总榜
                            </button>
                            <button
                                onClick={() => {
                                    if (worldLinkAvailable) {
                                        setBoardMode("worldlink");
                                    }
                                }}
                                disabled={!worldLinkAvailable}
                                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                                    boardMode === "worldlink" && worldLinkAvailable
                                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                        : worldLinkAvailable
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                }`}
                            >
                                WL单榜
                            </button>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {isWorldLinkMode
                                    ? "当前为单人榜高精度采集视图。"
                                    : "World Link 活动期间可切换到单人榜。"}
                            </span>
                        </div>

                        {isWorldLinkMode && worldLinkSnapshot && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {worldLinkSnapshot.groups.map((group) => {
                                    const isActive = group.gameCharacterId === activeWorldLinkGroup?.gameCharacterId;
                                    return (
                                        <button
                                            key={group.gameCharacterId}
                                            onClick={() => setSelectedWorldLinkCharacterId(group.gameCharacterId)}
                                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                                                isActive
                                                    ? "bg-miku text-white shadow-sm shadow-miku/20"
                                                    : "border border-slate-200 bg-white text-slate-600 hover:border-miku/40 hover:text-miku dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                            }`}
                                        >
                                            {CHARACTER_NAMES[group.gameCharacterId] || `角色 ${group.gameCharacterId}`}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {isWorldLinkMode && (
                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                WL 单榜的近 48H 周回按当前角色独立统计。
                            </div>
                        )}
                    </div>
                )}

                {isWorldBloomEvent && !worldLinkAvailable && !isLoading && (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                        当前为 World Link 活动，但 WL 单人榜数据暂未同步完成，稍后会自动显示。
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                        <p className="font-bold">加载失败</p>
                        <p>{error}</p>
                    </div>
                )}

                {isLoading && !activeSnapshot ? (
                    <div className="glass-card rounded-2xl p-10 text-center text-slate-500">
                        正在加载实时排行榜...
                    </div>
                ) : (
                    <RankingList
                        entries={rankingEntries}
                        masterData={masterData}
                        assetSource={assetSource}
                        secondsSinceUpdate={secondsSinceUpdate}
                        showChurn={shouldShowChurnToggle ? showChurn : false}
                        churnData={activeChurnData}
                        onShowParkingPeriods={setParkingModalUserId}
                        showExtendedWarning={!isWorldLinkMode}
                    />
                )}
            </div>

            {/* Quick Jump Sidebar — desktop: right side, mobile: bottom bar */}
            {activeSnapshot && (
                <>
                    {/* Desktop floating sidebar */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}
                        className="hidden md:flex fixed right-2 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 rounded-2xl border border-miku/20 bg-white/90 p-2 shadow-lg shadow-miku/10 backdrop-blur-md dark:border-miku/30 dark:bg-slate-900/90 dark:shadow-miku/5"
                    >
                        {QUICK_JUMP_RANKS.map((rank, i) => (
                            <motion.button
                                key={rank}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.25 + i * 0.06 }}
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => {
                                    setActiveRank(rank);
                                    scrollToRank(rank);
                                }}
                                className={`w-14 rounded-xl px-1.5 py-1.5 text-[11px] font-black transition-all ${
                                    activeRank === rank
                                        ? "border border-miku bg-miku text-white shadow-md shadow-miku/30"
                                        : "border border-miku/20 bg-miku/5 text-miku hover:border-miku/50 hover:bg-miku hover:text-white dark:border-miku/30 dark:bg-miku/10 dark:hover:bg-miku dark:hover:text-white"
                                }`}
                            >
                                T{rank}
                            </motion.button>
                        ))}

                        <div className="my-0.5 h-px w-8 bg-miku/20 dark:bg-miku/30" />

                        <motion.div
                            key={countdown}
                            initial={{ scale: 1.15, opacity: 0.6 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className={`text-sm font-black tabular-nums transition-colors ${hasRecentUpdate ? "text-miku" : "text-miku/60 dark:text-miku/50"}`}
                        >
                            {isRefreshing ? (
                                <motion.span
                                    animate={{ opacity: [1, 0.4, 1] }}
                                    transition={{ duration: 0.8, repeat: Infinity }}
                                >
                                    ...
                                </motion.span>
                            ) : (
                                `${countdown}s`
                            )}
                        </motion.div>

                        <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => void loadSnapshot(region, true)}
                            className="w-14 rounded-xl bg-miku px-1.5 py-1.5 text-[11px] font-black text-white shadow-md shadow-miku/25 transition-colors hover:bg-miku-dark dark:shadow-miku/15"
                        >
                            刷新
                        </motion.button>
                    </motion.div>

                    {/* Mobile bottom bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.1 }}
                        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-miku/20 bg-white/90 px-4 py-2.5 backdrop-blur-md dark:border-miku/30 dark:bg-slate-900/90"
                    >
                        <div className="flex items-center gap-1.5">
                            {QUICK_JUMP_RANKS.map((rank) => (
                                <motion.button
                                    key={rank}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                        setActiveRank(rank);
                                        scrollToRank(rank);
                                    }}
                                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black transition-all ${
                                        activeRank === rank
                                            ? "border border-miku bg-miku text-white"
                                            : "border border-miku/20 bg-miku/5 text-miku active:bg-miku active:text-white dark:border-miku/30 dark:bg-miku/10"
                                    }`}
                                >
                                    T{rank}
                                </motion.button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-black tabular-nums ${hasRecentUpdate ? "text-miku" : "text-miku/60 dark:text-miku/50"}`}>
                                {isRefreshing ? "..." : `${countdown}s`}
                            </span>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => void loadSnapshot(region, true)}
                                className="rounded-lg bg-miku px-3 py-1.5 text-[11px] font-black text-white shadow-sm shadow-miku/25 transition-colors active:bg-miku-dark"
                            >
                                刷新
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* 停车区间弹窗 */}
            <ParkingPeriodsModal
                userId={parkingModalUserId}
                churnEntry={parkingModalUserId ? activeChurnData.get(parkingModalUserId) : undefined}
                onClose={() => setParkingModalUserId(null)}
            />
        </MainLayout>
    );
}

export default function RealtimeRankingClient() {
    return (
        <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载实时排行榜...</div>}>
            <RealtimeRankingContent />
        </Suspense>
    );
}
