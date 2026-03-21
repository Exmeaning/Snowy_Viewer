"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MainLayout from "@/components/MainLayout";
import RankingHeader from "@/components/realtime-ranking/RankingHeader";
import RankingList from "@/components/realtime-ranking/RankingList";
import CurrentEventCard from "@/components/realtime-ranking/CurrentEventCard";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { fetchEventList } from "@/lib/prediction-api";
import { fetchRealtimeRanking, fetchRealtimeRankingMasterData } from "@/lib/realtime-ranking-api";
import {
    RealtimeRankingEntryWithDiff,
    RealtimeRankingMasterData,
    RealtimeRankingRegion,
    RealtimeRankingSnapshot,
} from "@/types/realtime-ranking";
import { IEventInfo } from "@/types/events";
import { EventListItem } from "@/types/prediction";

const DEFAULT_REGION: RealtimeRankingRegion = "cn";
const POLL_INTERVAL = 10_000;
const EMPTY_MASTER_DATA: RealtimeRankingMasterData = {
    cards: [],
    honors: [],
    honorGroups: [],
    bondsHonors: [],
    bondsHonorWords: [],
    gameCharaUnits: [],
};

function decodeHtmlEntities(value: string): string {
    if (typeof window === "undefined") return value;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}

function buildEntriesWithDiff(snapshot: RealtimeRankingSnapshot, previousSnapshot: RealtimeRankingSnapshot | null): RealtimeRankingEntryWithDiff[] {
    const previousMap = new Map(previousSnapshot?.entries.map((entry) => [entry.userId, entry]) ?? []);

    return snapshot.entries.map((entry) => {
        const previous = previousMap.get(entry.userId);
        return {
            ...entry,
            displayName: decodeHtmlEntities(entry.displayName),
            previousRank: previous?.rank,
            previousScore: previous?.score,
            rankDelta: previous ? previous.rank - entry.rank : 0,
            scoreDelta: previous ? entry.score - previous.score : 0,
            isNewEntry: !previous,
        };
    });
}

function RealtimeRankingContent() {
    const { assetSource } = useTheme();

    const [region, setRegion] = useState<RealtimeRankingRegion>(DEFAULT_REGION);
    const [snapshot, setSnapshot] = useState<RealtimeRankingSnapshot | null>(null);
    const [previousSnapshot, setPreviousSnapshot] = useState<RealtimeRankingSnapshot | null>(null);
    const [masterData, setMasterData] = useState<RealtimeRankingMasterData>(EMPTY_MASTER_DATA);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const [countdown, setCountdown] = useState(Math.floor(POLL_INTERVAL / 1000));
    const [hasRecentUpdate, setHasRecentUpdate] = useState(false);
    const [currentEvent, setCurrentEvent] = useState<IEventInfo | null>(null);
    const requestIdRef = useRef(0);
    const snapshotRef = useRef<RealtimeRankingSnapshot | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const regionParam = params.get("region");
        if (regionParam === "cn" || regionParam === "jp") {
            setRegion(regionParam);
        }
    }, []);

    const updateUrlRegion = useCallback((nextRegion: RealtimeRankingRegion) => {
        const url = new URL(window.location.href);
        url.searchParams.set("region", nextRegion);
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
            const nextSnapshot = await fetchRealtimeRanking(nextRegion);
            if (currentRequestId !== requestIdRef.current) return;

            const previous = snapshotRef.current;
            if (asRefresh && previous) {
                setPreviousSnapshot(previous);
            }
            snapshotRef.current = nextSnapshot;
            setSnapshot(nextSnapshot);
            setCountdown(Math.floor(POLL_INTERVAL / 1000));
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
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
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

                const matched = masterEvents.find((event) => event.id === activeEvent.id) || null;
                setCurrentEvent(matched);
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
    }, [region]);

    useEffect(() => {
        updateUrlRegion(region);
        setExpandedIds([]);
        setPreviousSnapshot(null);
        setSnapshot(null);
        snapshotRef.current = null;
        void loadSnapshot(region, false);

        const timer = window.setInterval(() => {
            void loadSnapshot(region, true);
        }, POLL_INTERVAL);

        return () => window.clearInterval(timer);
    }, [region, loadSnapshot, updateUrlRegion]);

    const rankingEntries = useMemo(() => {
        if (!snapshot) return [];
        return buildEntriesWithDiff(snapshot, previousSnapshot);
    }, [snapshot, previousSnapshot]);

    const handleToggleExpand = useCallback((userId: string) => {
        setExpandedIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    }, []);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <RankingHeader
                    region={region}
                    onRegionChange={setRegion}
                    updatedAt={snapshot?.updatedAt}
                    eventId={snapshot?.eventId}
                    totalEntries={snapshot?.entries.length ?? 0}
                    isRefreshing={isRefreshing}
                    countdown={countdown}
                    hasRecentUpdate={hasRecentUpdate}
                />

                <CurrentEventCard
                    event={currentEvent}
                    assetSource={assetSource}
                    regionLabel={region === "cn" ? "简中服" : "日服"}
                />

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                        <p className="font-bold">加载失败</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <p>全部榜线均会显示，详细信息默认折叠；前百玩家与扩展榜线都可按需展开查看。</p>
                    <button
                        onClick={() => void loadSnapshot(region, true)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        立即刷新
                    </button>
                </div>

                {isLoading && !snapshot ? (
                    <div className="glass-card rounded-2xl p-10 text-center text-slate-500">
                        正在加载实时排行榜...
                    </div>
                ) : (
                    <RankingList
                        entries={rankingEntries}
                        expandedIds={expandedIds}
                        onToggleExpand={handleToggleExpand}
                        masterData={masterData}
                        assetSource={assetSource}
                    />
                )}
            </div>
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
