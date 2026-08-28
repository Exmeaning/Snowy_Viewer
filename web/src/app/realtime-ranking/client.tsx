"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MainLayout from "@/components/MainLayout";
import RankingHeader from "@/components/realtime-ranking/RankingHeader";
import RankingList from "@/components/realtime-ranking/RankingList";
import CurrentEventCard from "@/components/realtime-ranking/CurrentEventCard";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchEventList } from "@/lib/prediction-api";
import { fetchRealtimeRanking, fetchRealtimeRankingMasterData, fetchRealtimeRankingEvents, fetchChurnData, fetchWorldLinkChurnData, fetchWorldLinkRanking, getRealtimeRankingErrorMessage } from "@/lib/realtime-ranking-api";
import { mergeResilientEntries, shouldKeepPreviousChurn } from "@/lib/realtime-ranking-resilience";
import { publishRankingSync, extractTierScoresFromEntries } from "@/lib/ranking-sync";
import ParkingPeriodsModal from "@/components/realtime-ranking/ParkingPeriodsModal";
import Modal from "@/components/common/Modal";
import ExternalLink from "@/components/ExternalLink";
import Link from "@/components/LocalizedLink";
import {
    RealtimeRankingBoardMode,
    RealtimeRankingEntryWithDiff,
    RealtimeRankingMasterData,
    RealtimeRankingRegion,
    RealtimeRankingSnapshot,
    isRealtimeRankingRegion,
    ChurnRankingEntry,
    ChurnApiResponse,
    WorldLinkGroupSnapshot,
    WorldLinkSnapshot,
} from "@/types/realtime-ranking";
import { IEventInfo } from "@/types/events";
import { EventListItem } from "@/types/prediction";
import { getCharacterName } from "@/lib/i18n";
import { setRealtimeRankingLine, useRealtimeRankingLine } from "@/lib/realtime-ranking-line";

const DEFAULT_REGION: RealtimeRankingRegion = "cn";
const POLL_INTERVAL = 10_000;
const QUICK_JUMP_RANKS = [1, 20, 50, 100] as const;
const NAV_OFFSET = 90; // px — navbar height + breathing room
const SHOW_CHURN_STORAGE_KEY = "realtime-ranking:showChurn";
const CHURN_RETRY_DELAYS = [8_000, 20_000, 45_000, 60_000] as const;
// After this many consecutive degraded polls we stop trying to preserve the old
// board and accept the incoming payload, so a genuine roster shrink is not held
// stale forever. 30 polls ≈ 5 minutes at the 10s poll interval.
const MAX_DEGRADED_POLLS = 30;

function scrollToRank(rank: number) {
    const el = document.querySelector<HTMLElement>(`[data-rank="${rank}"]`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });

    // Add a highlight pulse after scrolling reaches the target row.
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

    // Trigger the highlight after scrolling settles.
    let scrollTimer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            window.removeEventListener("scroll", onScroll);
            highlight();
        }, 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Fallback in case the row is already in view and no scroll event fires.
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

/** Get the ISO key for the current hour, e.g. "2026-03-23T14:00:00Z". */
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
    const previousByUserId = new Map(previousSnapshot?.entries.map((entry) => [entry.userId, entry]) ?? []);
    const previousByRank   = new Map(previousSnapshot?.entries.map((entry) => [entry.rank,   entry]) ?? []);

    return snapshot.entries.map((entry) => {
        const isTierLine = entry.rank > 100;

        // Tier-line rows after rank 100 diff by rank position, regardless of player changes.
        // Player rows within TOP100 diff by userId.
        const previous = isTierLine
            ? previousByRank.get(entry.rank)
            : previousByUserId.get(entry.userId);

        const rankDelta  = previous && !isTierLine ? previous.rank - entry.rank : 0;
        const scoreDelta = previous ? entry.score - previous.score : 0;

        // lastChanges key: use tier:{rank} for tier lines and userId for players.
        const scopedKey = isTierLine
            ? `${scopeKey}:tier:${entry.rank}`
            : `${scopeKey}:${entry.userId}`;

        if (scoreDelta !== 0 || rankDelta !== 0) {
            const existing = lastChanges.get(scopedKey);
            lastChanges.set(scopedKey, {
                scoreDelta: scoreDelta !== 0 ? scoreDelta : (existing?.scoreDelta ?? 0),
                rankDelta:  rankDelta  !== 0 ? rankDelta  : (existing?.rankDelta  ?? 0),
                changedAt: Date.now(),
            });
        }

        const saved = lastChanges.get(scopedKey);

        return {
            ...entry,
            displayName: decodeHtmlEntities(entry.displayName),
            previousRank:  previous?.rank,
            previousScore: previous?.score,
            rankDelta,
            scoreDelta,
            isNewEntry: !previous,
            lastScoreDelta: saved?.scoreDelta,
            lastRankDelta:  saved?.rankDelta,
            lastChangedAt:  saved?.changedAt,
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
    onChanged: (key: string, scoreDelta: number, isTierLine?: boolean) => void,
) {
    if (!previous || !next) return;

    const prevByUserId = new Map(previous.entries.map((entry) => [entry.userId, entry]));
    const prevByRank   = new Map(previous.entries.map((entry) => [entry.rank,   entry]));

    for (const entry of next.entries) {
        const isTierLine = entry.rank > 100;
        const prev = isTierLine ? prevByRank.get(entry.rank) : prevByUserId.get(entry.userId);
        if (prev && entry.score !== prev.score) {
            const delta = entry.score - prev.score;
            if (!isTierLine) {
                onChanged(entry.userId, delta);
            }
            onChanged(`tier:${entry.rank}`, delta, true);
        }
    }
}

function RealtimeRankingContent() {
    const { t, formatNumber = (val: number) => val.toLocaleString() } = useI18n();
    const { assetSource, themeColor, serverSource } = useTheme();

    const [hasInitializedQuery, setHasInitializedQuery] = useState(false);
    const [region, setRegion] = useState<RealtimeRankingRegion>(DEFAULT_REGION);
    const line = useRealtimeRankingLine();
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
    const [trackedUserId, setTrackedUserId] = useState<string | null>(null);
    const [lastTrackedData, setLastTrackedData] = useState<RealtimeRankingEntryWithDiff | null>(null);
    const [celebrationOpen, setCelebrationOpen] = useState(false);
    // Ranks whose data was carried over from a previous snapshot because the
    // latest poll returned a collapsed payload (used for the "syncing" hint).
    const [staleRanks, setStaleRanks] = useState<Set<number>>(new Set());

    // Load tracked user ID from localStorage on region change or snapshot event change
    useEffect(() => {
        if (typeof window === "undefined") return;
        const eventId = snapshot?.eventId;
        if (!eventId) {
            setTrackedUserId(null);
            return;
        }
        const key = `realtime-ranking:tracked:${region}:${eventId}`;
        try {
            const saved = localStorage.getItem(key);
            setTrackedUserId(saved);
        } catch {
            setTrackedUserId(null);
        }
    }, [region, snapshot?.eventId]);

    // Handle track toggle
    const handleTrackToggle = useCallback((userId: string) => {
        const eventId = snapshotRef.current?.eventId;
        if (!eventId) return;
        const key = `realtime-ranking:tracked:${region}:${eventId}`;
        setTrackedUserId((prev) => {
            const next = prev === userId ? null : userId;
            try {
                if (next) {
                    localStorage.setItem(key, next);
                } else {
                    localStorage.removeItem(key);
                }
            } catch {
                // ignore
            }
            return next;
        });
    }, [region]);

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
    const worldLinkCheckedRef = useRef(false);
    const observedActiveEventRef = useRef<{ key: string; endAt: number } | null>(null);
    // Count of consecutive degraded polls per board scope, so a sustained roster
    // shrink eventually overrides the stale-preservation behaviour.
    const degradedPollCountRef = useRef(0);

    /** Hot update: when a user or tier line score changes, update its speed data. */
    const updateChurnForUser = useCallback((key: string, scoreDelta: number, isTierLine?: boolean) => {
        const map = churnDataRef.current;
        const entry = map.get(key);
        if (!entry) return;

        const now = Date.now();
        const cutoff1h = now - 3600_000;

        // Tier-line entries have no churn grid, so skip hourly_churn / churn_48h.
        if (!isTierLine) {
            const hourKey = getCurrentHourKey();
            const existing = entry.hourly_churn.find((h) => h.hour === hourKey);
            if (existing) {
                existing.count += 1;
            } else {
                entry.hourly_churn.push({ hour: hourKey, count: 1 });
            }
            entry.churn_48h += 1;
        }

        // Update recent_score_changes by appending the new record and keeping the latest hour.
        const newChange = { time: now, delta: scoreDelta };
        entry.recent_score_changes = [
            ...entry.recent_score_changes.filter((c) => c.time >= cutoff1h),
            newChange,
        ];

        // Recalculate growth_1h.
        entry.growth_1h = entry.recent_score_changes
            .filter((c) => c.time >= cutoff1h && c.delta > 0)
            .reduce((acc, c) => acc + c.delta, 0);

        // For tier lines, also update recent_activity.count.
        if (isTierLine && entry.recent_activity) {
            entry.recent_activity.count += 1;
            entry.recent_activity.changed_at = [...entry.recent_activity.changed_at, now];
        }

        // Trigger a React re-render.
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
        if (isRealtimeRankingRegion(regionParam)) {
            setRegion(regionParam);
        } else if (isRealtimeRankingRegion(serverSource)) {
            setRegion(serverSource);
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
    }, [serverSource]);

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
            // During WL events, load both endpoints initially; during polling, only refresh the active board to avoid double bandwidth on slow networks.
            const skipOverall   = asRefresh && boardModeRef.current === "worldlink";
            const skipWorldLink = asRefresh && boardModeRef.current !== "worldlink";

            const snapshotPromise = skipOverall
                ? Promise.resolve(null as RealtimeRankingSnapshot | null)
                : fetchRealtimeRanking(nextRegion);
            const worldLinkPromise = skipWorldLink
                ? Promise.resolve(null as WorldLinkSnapshot | null)
                : fetchWorldLinkRanking(nextRegion);

            const [snapshotResult, worldLinkResult] = await Promise.allSettled([snapshotPromise, worldLinkPromise]);
            if (currentRequestId !== requestIdRef.current) return;

            // Keep old references before refreshing so diff calculation can use them.
            const previousOverall   = snapshotRef.current;
            const previousWorldLink = worldLinkSnapshotRef.current;

            // --- Overall snapshot handling ---
            let nextOverallSnapshot: RealtimeRankingSnapshot | null = null;

            if (!skipOverall) {
                if (snapshotResult.status !== "fulfilled") {
                    throw snapshotResult.reason;
                }
                const incomingOverall = snapshotResult.value;

                // Resilience: when polling the same event, guard against a
                // transiently collapsed payload wiping the visible board. Only
                // applies once we already have a healthy reference for this event.
                const sameEvent = !!previousOverall && !!incomingOverall
                    && previousOverall.eventId === incomingOverall.eventId;
                if (asRefresh && sameEvent && degradedPollCountRef.current < MAX_DEGRADED_POLLS) {
                    const merged = mergeResilientEntries(
                        previousOverall!.entries,
                        incomingOverall.entries,
                    );
                    if (merged.degraded) {
                        degradedPollCountRef.current += 1;
                        nextOverallSnapshot = { ...incomingOverall, entries: merged.entries };
                        setStaleRanks(merged.staleRanks);
                    } else {
                        degradedPollCountRef.current = 0;
                        nextOverallSnapshot = incomingOverall;
                        setStaleRanks(new Set());
                    }
                } else {
                    // Fresh load, event change, or degraded-budget exhausted:
                    // accept the incoming payload verbatim.
                    degradedPollCountRef.current = 0;
                    nextOverallSnapshot = incomingOverall;
                    setStaleRanks(new Set());
                }

                if (asRefresh && previousOverall) {
                    setPreviousSnapshot(previousOverall);
                }
                snapshotRef.current = nextOverallSnapshot;
                setSnapshot(nextOverallSnapshot);

                if (nextOverallSnapshot && nextOverallSnapshot.entries.length > 0) {
                    publishRankingSync({
                        region: nextRegion,
                        eventId: nextOverallSnapshot.eventId,
                        updatedAt: nextOverallSnapshot.updatedAt,
                        tierScores: extractTierScoresFromEntries(nextOverallSnapshot.entries),
                        source: "realtime-ranking",
                    });
                }

                // If the event changed, clear old WL snapshots to avoid cross-event residue.
                if (previousWorldLink && nextOverallSnapshot &&
                    previousWorldLink.eventId !== nextOverallSnapshot.eventId) {
                    worldLinkSnapshotRef.current = null;
                    setWorldLinkSnapshot(null);
                    setPreviousWorldLinkSnapshot(null);
                }
            }

            // --- WL solo-board snapshot handling ---
            let nextWorldLinkSnapshot: WorldLinkSnapshot | null = null;

            if (!skipWorldLink) {
                const currentEventId = snapshotRef.current?.eventId ?? nextOverallSnapshot?.eventId;
                // Only fulfilled requests count as checking WL availability; timeouts/network failures should not show the pending-sync hint.
                const wlFulfilled = worldLinkResult.status === "fulfilled";
                const candidate = wlFulfilled ? worldLinkResult.value : null;
                nextWorldLinkSnapshot = candidate && candidate.eventId === currentEventId ? candidate : null;

                if (nextWorldLinkSnapshot) {
                    // Resilience: merge each incoming WL group against the matching
                    // previous group so a collapsed poll does not wipe the board.
                    const sameWlEvent = !!previousWorldLink
                        && previousWorldLink.eventId === nextWorldLinkSnapshot.eventId;
                    if (asRefresh && sameWlEvent && degradedPollCountRef.current < MAX_DEGRADED_POLLS) {
                        const prevGroupByChar = new Map(
                            previousWorldLink!.groups.map((g) => [g.gameCharacterId, g]),
                        );
                        const activeCharId = selectedWorldLinkCharacterIdRef.current;
                        let activeDegraded = false;
                        let activeStaleRanks = new Set<number>();
                        const mergedGroups = nextWorldLinkSnapshot.groups.map((group) => {
                            const prevGroup = prevGroupByChar.get(group.gameCharacterId);
                            if (!prevGroup) return group;
                            const merged = mergeResilientEntries(prevGroup.entries, group.entries);
                            if (group.gameCharacterId === activeCharId) {
                                activeDegraded = merged.degraded;
                                activeStaleRanks = merged.staleRanks;
                            }
                            return merged.degraded ? { ...group, entries: merged.entries } : group;
                        });
                        nextWorldLinkSnapshot = { ...nextWorldLinkSnapshot, groups: mergedGroups };
                        if (activeDegraded) {
                            degradedPollCountRef.current += 1;
                            setStaleRanks(activeStaleRanks);
                        } else {
                            degradedPollCountRef.current = 0;
                            setStaleRanks(new Set());
                        }
                    } else {
                        degradedPollCountRef.current = 0;
                        setStaleRanks(new Set());
                    }

                    if (asRefresh && previousWorldLink) {
                        setPreviousWorldLinkSnapshot(previousWorldLink);
                    }
                    worldLinkSnapshotRef.current = nextWorldLinkSnapshot;
                    setWorldLinkSnapshot(nextWorldLinkSnapshot);
                    worldLinkCheckedRef.current = true;
                } else if (!asRefresh || previousWorldLink == null) {
                    worldLinkSnapshotRef.current = null;
                    setWorldLinkSnapshot(null);
                    setPreviousWorldLinkSnapshot(null);
                    // Fulfilled but no usable data confirms unavailability; rejected requests retry on the next poll.
                    if (wlFulfilled) {
                        worldLinkCheckedRef.current = true;
                    }
                }
            }

            // --- Churn hot-update diff ---
            if (asRefresh) {
                if (boardModeRef.current === "worldlink") {
                    const selectedCharacterId = selectedWorldLinkCharacterIdRef.current;
                    applySnapshotChurnDiff(
                        findWorldLinkGroup(previousWorldLink, selectedCharacterId),
                        findWorldLinkGroup(worldLinkSnapshotRef.current, selectedCharacterId),
                        updateChurnForUser,
                    );
                } else {
                    applySnapshotChurnDiff(previousOverall, nextOverallSnapshot, updateChurnForUser);
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
            setError(getRealtimeRankingErrorMessage(err, t));
        } finally {
            if (currentRequestId !== requestIdRef.current) return;
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [t, updateChurnForUser]);

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
                // Entries without userId are tier-line data points such as TOP200; use "tier:{rank}" as the key.
                const isTierLine = entry.userId == null;
                const mapKey = isTierLine ? `tier:${entry.rank}` : String(entry.userId);
                map.set(mapKey, { ...entry, isTierLine: isTierLine || undefined });

                if (isTierLine) {
                    // Tier-line entries: use the latest recent_score_changes item as the initial diff baseline.
                    const scopedTierKey = `${scopeKey}:tier:${entry.rank}`;
                    const changes = entry.recent_score_changes;
                    if (changes && changes.length > 0 && !lastChangesRef.current.has(scopedTierKey)) {
                        const last = changes[changes.length - 1];
                        const changedAt = last.time < 1e12 ? last.time * 1000 : last.time;
                        lastChangesRef.current.set(scopedTierKey, {
                            scoreDelta: last.delta,
                            rankDelta: 0,
                            changedAt,
                        });
                    }
                    continue;
                }

                // Preload churn last_change into lastChangesRef so the first automatic refresh still shows the delta instead of overwriting it with "—".
                const scopedUid = `${scopeKey}:${mapKey}`;
                if (entry.last_change && !lastChangesRef.current.has(scopedUid)) {
                    // Timestamp compatibility: seconds vs milliseconds.
                    const rawTime = entry.last_change.time;
                    const changedAt = rawTime < 1e12 ? rawTime * 1000 : rawTime;
                    lastChangesRef.current.set(scopedUid, {
                        scoreDelta: entry.last_change.delta,
                        rankDelta: 0,
                        changedAt,
                    });
                }
            }

            // Resilience: a transiently collapsed churn payload should not wipe
            // the detailed per-row stats that are already displayed. Keep the
            // previous map when the incoming one lost most of its rows.
            if (shouldKeepPreviousChurn(churnDataRef.current.size, map.size)) {
                return true;
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
        setMasterData(EMPTY_MASTER_DATA);
        fetchRealtimeRankingMasterData(region)
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
    }, [region]);

    useEffect(() => {
        observedActiveEventRef.current = null;
    }, [region]);

    useEffect(() => {
        if (!snapshot || snapshot.region !== region) return;

        const now = Date.now();
        if (snapshot.startAt > now || snapshot.endAt <= now) return;

        observedActiveEventRef.current = {
            key: `${snapshot.region}:${snapshot.eventId}`,
            endAt: snapshot.endAt,
        };
    }, [region, snapshot]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("debug_celebration") === "true") {
                setCelebrationOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCountdown((prev) => (prev <= 1 ? Math.floor(POLL_INTERVAL / 1000) : prev - 1));
            setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdateTimeRef.current) / 1000));

            // Check the cached active event deadline instead of depending on the realtime API still returning data after event end.
            const observedActiveEvent = observedActiveEventRef.current;
            if (observedActiveEvent && Date.now() >= observedActiveEvent.endAt) {
                const celebratedKey = `realtime-ranking:celebrated:${observedActiveEvent.key}`;
                observedActiveEventRef.current = null;

                try {
                    if (sessionStorage.getItem(celebratedKey)) return;
                    sessionStorage.setItem(celebratedKey, "true");
                } catch {
                    // Storage can be unavailable in private browsing; still show the celebration once for this in-memory observation.
                }

                setCelebrationOpen(true);
            }
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        updateUrlState(region, boardMode, boardMode === "worldlink" ? selectedWorldLinkCharacterId : null);
    }, [hasInitializedQuery, region, boardMode, selectedWorldLinkCharacterId, updateUrlState]);

    const buildCurrentEventFromSnapshot = useCallback((baseSnapshot: RealtimeRankingSnapshot | null): IEventInfo | null => {
        if (!baseSnapshot) return null;
        return {
            id: baseSnapshot.eventId,
            name: t("page.realtimeRanking.eventFallback", { id: baseSnapshot.eventId }),
            eventType: "marathon",
            assetbundleName: "",
            bgmAssetbundleName: "",
            eventOnlyComponentDisplayStartAt: baseSnapshot.startAt,
            startAt: baseSnapshot.startAt,
            aggregateAt: baseSnapshot.endAt,
            rankingAnnounceAt: baseSnapshot.endAt,
            distributionStartAt: baseSnapshot.endAt,
            eventOnlyComponentDisplayEndAt: baseSnapshot.endAt,
            closedAt: baseSnapshot.endAt,
            distributionEndAt: baseSnapshot.endAt,
            virtualLiveId: 0,
            unit: "",
            isCountLeaderCharacterPlay: false,
        };
    }, [t]);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        let cancelled = false;

        async function loadCurrentEvent() {
            try {
                const [eventListResult, masterEvents] = await Promise.all([
                    (region === "cn" || region === "jp"
                        ? fetchEventList(region)
                        : Promise.resolve([] as EventListItem[])
                    ).catch(() => [] as EventListItem[]),
                    fetchRealtimeRankingEvents(region).catch(() => [] as IEventInfo[]),
                ]);

                if (cancelled) return;

                const activeEvent = [...eventListResult]
                    .sort((a, b) => a.id - b.id)
                    .find((event: EventListItem) => event.is_active);

                const snapshotEvent = snapshotRef.current;
                const eventId = activeEvent?.id ?? snapshotEvent?.eventId;
                if (!eventId) {
                    setCurrentEvent(null);
                    return;
                }

                const matched = masterEvents.find((event) => event.id === eventId);

                // Use timestamps from realtime snapshot when available; CN/JP prediction API
                // can provide schedule too. Normalize sec→ms and then fall back to master data.
                const s = snapshotEvent?.eventId === eventId
                    ? snapshotEvent.startAt
                    : activeEvent?.start_at
                        ? (activeEvent.start_at < 10000000000 ? activeEvent.start_at * 1000 : activeEvent.start_at)
                        : matched?.startAt;
                const e = snapshotEvent?.eventId === eventId
                    ? snapshotEvent.endAt
                    : activeEvent?.end_at
                        ? (activeEvent.end_at < 10000000000 ? activeEvent.end_at * 1000 : activeEvent.end_at)
                        : matched?.aggregateAt;

                const startAt = s || 0;
                const endAt = e || 0;

                const correctedEvent: IEventInfo = {
                    id: eventId,
                    name: matched?.name || activeEvent?.name || t("page.realtimeRanking.eventFallback", { id: eventId }),
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
                    setCurrentEvent(buildCurrentEventFromSnapshot(snapshotRef.current));
                }
            }
        }

        void loadCurrentEvent();

        return () => {
            cancelled = true;
        };
    }, [buildCurrentEventFromSnapshot, hasInitializedQuery, region, snapshot?.eventId, snapshot?.startAt, snapshot?.endAt, t]);

    useEffect(() => {
        if (!hasInitializedQuery) return;

        setPreviousSnapshot(null);
        setSnapshot(null);
        setPreviousWorldLinkSnapshot(null);
        setWorldLinkSnapshot(null);
        snapshotRef.current = null;
        worldLinkSnapshotRef.current = null;
        worldLinkCheckedRef.current = false;
        lastChangesRef.current.clear();
        void loadSnapshot(region, false);

        const timer = window.setInterval(() => {
            void loadSnapshot(region, true);
        }, POLL_INTERVAL);

        return () => {
            window.clearInterval(timer);
        };
        // `line` switches the API host, so a fresh reload is required on change.
    }, [hasInitializedQuery, region, loadSnapshot, line]);

    const worldLinkAvailable = !!worldLinkSnapshot
        && !!snapshot
        && worldLinkSnapshot.eventId === snapshot.eventId
        && worldLinkSnapshot.groups.length > 0;
    // Show the pending-sync hint only after the WL API was successfully checked; timeouts/network errors retry on later polls.
    const worldLinkConfirmedUnavailable = worldLinkCheckedRef.current && !worldLinkAvailable;
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
    const activeWorldLinkCharacterName = activeWorldLinkGroup
        ? getCharacterName(t, activeWorldLinkGroup.gameCharacterId)
        : "";
    const activeScopeLabel = isWorldLinkMode && activeWorldLinkGroup
        ? t("page.realtimeRanking.board.scopeWorldLink", { character: activeWorldLinkCharacterName })
        : t("page.realtimeRanking.board.scopeOverall");
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
        // `line` switches the API host, so churn data must be reloaded on change.
    }, [activeChurnBoardMode, activeChurnTargetId, hasInitializedQuery, loadChurnData, region, line]);

    const rankingEntries = useMemo(() => {
        if (!activeSnapshot) return [];
        return buildEntriesWithDiff(
            activeSnapshot,
            activePreviousSnapshot,
            lastChangesRef.current,
            isWorldLinkMode && activeWorldLinkGroup ? `worldlink:${activeWorldLinkGroup.gameCharacterId}` : "overall",
        );
    }, [activePreviousSnapshot, activeSnapshot, activeWorldLinkGroup, isWorldLinkMode]);

    const trackedEntry = useMemo(() => {
        if (!trackedUserId) return null;
        return rankingEntries.find((entry) => entry.userId === trackedUserId) || null;
    }, [rankingEntries, trackedUserId]);

    useEffect(() => {
        if (trackedEntry) {
            setLastTrackedData(trackedEntry);
        }
    }, [trackedEntry]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 md:pr-24 py-8">
                <RankingHeader
                    region={region}
                    onRegionChange={setRegion}
                    line={line}
                    onLineChange={setRealtimeRankingLine}
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
                                {t("page.realtimeRanking.board.overall")}
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
                                {t("page.realtimeRanking.board.worldlink")}
                            </button>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {isWorldLinkMode
                                    ? t("page.realtimeRanking.board.worldlinkHighPrecision")
                                    : t("page.realtimeRanking.board.worldlinkAvailableHint")}
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
                                            {getCharacterName(t, group.gameCharacterId)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {isWorldLinkMode && (
                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                {t("page.realtimeRanking.board.worldlinkIndependentNotice")}
                            </div>
                        )}
                    </div>
                )}

                {isWorldBloomEvent && worldLinkConfirmedUnavailable && !isLoading && (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                        {t("page.realtimeRanking.board.worldlinkPendingNotice")}
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                        <p className="font-bold">{t("page.realtimeRanking.loadFailedTitle")}</p>
                        <p>{error}</p>
                    </div>
                )}

                {isLoading && !activeSnapshot ? (
                    <div className="ios-glass-card rounded-2xl p-10 text-center text-slate-500">
                        {t("page.realtimeRanking.loading")}
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
                        showExtendedWarning={true}
                        trackedUserId={trackedUserId}
                        onTrackToggle={handleTrackToggle}
                        staleRanks={staleRanks}
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
                        className="hidden md:flex fixed right-2 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 rounded-2xl ios-glass-card border border-miku/20 p-2 shadow-lg dark:border-miku/30"
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
                                {t("page.realtimeRanking.refresh")}
                        </motion.button>
                    </motion.div>

                    {/* Mobile bottom bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.1 }}
                        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 border-t border-miku/20 px-4 py-2.5 ios-glass-card dark:border-miku/30"
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
                            {t("page.realtimeRanking.refresh")}
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}

            {/* Tracked Player Floating Panel */}
            <AnimatePresence>
                {trackedUserId && lastTrackedData && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 26 }}
                        className="fixed bottom-18 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-auto sm:min-w-[480px] max-w-[640px]"
                    >
                        <div className="ios-glass-panel rounded-2xl p-4 border border-miku/30 dark:border-miku/20 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
                            {/* Glow element */}
                            <div className="absolute -inset-px bg-gradient-to-r from-miku/10 via-sky-500/10 to-miku/10 opacity-30 pointer-events-none rounded-2xl" />
                            
                            <div className="flex items-center justify-between gap-3 relative z-10">
                                {/* Player Info Left */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-1.5 py-0.5 text-[10px] font-black leading-none">
                                        #{lastTrackedData.rank}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-miku uppercase px-1.5 py-0.5 rounded-full bg-miku/10 border border-miku/20">
                                                {t("page.realtimeRanking.trackingTarget")}
                                            </span>
                                            {!trackedEntry && (
                                                <span className="text-[10px] font-bold text-amber-500 uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse-fast">
                                                    {t("page.realtimeRanking.trackingSync")}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-sm text-primary-text truncate mt-0.5">
                                            {lastTrackedData.displayName}
                                        </h4>
                                    </div>
                                </div>

                                {/* Score & Diff Right */}
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-primary-text">
                                        {formatNumber(lastTrackedData.score)}<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 ml-0.5">P</span>
                                    </div>
                                    {lastTrackedData.lastScoreDelta != null && lastTrackedData.lastScoreDelta !== 0 && (
                                        <div className="text-[10px] font-black text-emerald-500">
                                            +{formatNumber(lastTrackedData.lastScoreDelta)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Extra stats: Churn/Speed & Actions */}
                            <div className="flex items-center justify-between border-t border-slate-200/40 dark:border-slate-800/40 pt-2.5 gap-4 relative z-10">
                                {/* Speed info if churn data is loaded */}
                                <div className="flex items-center gap-2 min-w-0">
                                    {(() => {
                                        const key = lastTrackedData.rank > 100 ? `tier:${lastTrackedData.rank}` : lastTrackedData.userId;
                                        const churn = activeChurnData.get(key);
                                        if (churn) {
                                            return (
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-miku/10 px-1 py-0.5 font-bold text-miku">
                                                        <span>1H:</span>
                                                        <span>{churn.growth_1h ? `${Math.round(churn.growth_1h / 1000)}k` : "0k"}</span>
                                                    </span>
                                                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-bold">
                                                        <span>48H:</span>
                                                        <span className="text-slate-700 dark:text-slate-300">{churn.churn_48h}</span>
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return (
                                            <p className="text-[10px] text-slate-400 truncate">
                                                {t("page.realtimeRanking.trackingHelp")}
                                            </p>
                                        );
                                    })()}
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {trackedEntry && (
                                        <button
                                            onClick={() => scrollToRank(lastTrackedData.rank)}
                                            className="ios-glass-btn text-miku border border-miku/20 hover:bg-miku/10 px-2.5 py-1 text-xs font-bold rounded-lg transition-all"
                                        >
                                            {t("page.realtimeRanking.trackingFocus")}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleTrackToggle(lastTrackedData.userId)}
                                        className="ios-glass-btn text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/20 px-2.5 py-1 text-xs font-bold rounded-lg transition-all"
                                    >
                                        {t("page.realtimeRanking.untrackPlayer")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Parking periods modal */}
            <ParkingPeriodsModal
                userId={parkingModalUserId}
                churnEntry={parkingModalUserId ? activeChurnData.get(parkingModalUserId) : undefined}
                onClose={() => setParkingModalUserId(null)}
            />

            {/* Celebration Modal */}
            
            <Modal
                isOpen={celebrationOpen}
                onClose={() => setCelebrationOpen(false)}
                title={t("page.realtimeRanking.celebrationTitle")}
                size="md"
            >
                <div className="space-y-6 text-center">
                    {/* Celebratory header graphic or animation */}
                    <div className="flex justify-center relative py-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-miku/20 via-sky-400/20 to-luka/20 blur-xl rounded-full" />
                        <motion.div
                            animate={{
                                scale: [1, 1.15, 1],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="relative text-6xl"
                        >
                            🎉
                        </motion.div>
                    </div>

                    <h3 className="text-2xl font-black bg-gradient-to-r from-miku via-sky-500 to-luka bg-clip-text text-transparent">
                        {t("page.realtimeRanking.celebrationTitle")}
                    </h3>

                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed text-left px-2">
                        {t("page.realtimeRanking.celebrationTextPart1")}
                        <Link
                            href="/patreon"
                            target="_blank"
                            className="text-miku font-black underline decoration-dotted hover:opacity-80 transition-opacity mx-1"
                        >
                            {t("page.realtimeRanking.celebrationTextLink")}
                        </Link>
                        {t("page.realtimeRanking.celebrationTextPart2")}
                    </p>

                    {/* QR Code scans displayed directly in the modal per user request! */}
                    <div className="p-4 ios-glass-panel rounded-2xl border border-slate-200/50 dark:border-slate-800/50 space-y-4">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {t("page.realtimeRanking.celebrationQrScanHint")}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                            {/* Alipay */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-32 h-32 rounded-xl overflow-hidden shadow-md border border-slate-200/70 relative bg-white">
                                    <img
                                        src="/patreon/alipay.png"
                                        alt="Alipay QR Code"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{t("page.realtimeRanking.celebrationAlipay")}</span>
                            </div>

                            {/* WeChat */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-32 h-32 rounded-xl overflow-hidden shadow-md border border-slate-200/70 relative bg-white">
                                    <img
                                        src="/patreon/wechat.png"
                                        alt="WeChat QR Code"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{t("page.realtimeRanking.celebrationWechat")}</span>
                            </div>
                        </div>

                        {/* Ko-fi Link */}
                        <div className="flex flex-col items-center gap-1.5 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {t("page.realtimeRanking.celebrationKofi")}
                            </span>
                            <ExternalLink
                                href="https://ko-fi.com/moesekai"
                                className="hover:opacity-80 transition-opacity"
                            >
                                <img
                                    src="https://storage.ko-fi.com/cdn/brandasset/v2/support_me_on_kofi_dark.png"
                                    alt="Support on Ko-fi"
                                    className="h-8"
                                />
                            </ExternalLink>
                        </div>
                    </div>

                    {/* Direct button link to the full Patreon page */}
                    <div className="pt-2">
                        <Link
                            href="/patreon"
                            target="_blank"
                            className="block w-full py-3 px-6 text-sm font-extrabold text-white text-center bg-gradient-to-r from-miku via-sky-500 to-luka hover:opacity-90 active:scale-[0.98] shadow-lg shadow-miku/20 rounded-2xl transition-all"
                        >
                            {t("page.realtimeRanking.celebrationButton")}
                        </Link>
                    </div>
                </div>
            </Modal>
        </MainLayout>
    );
}

export default function RealtimeRankingClient() {
    const { t } = useI18n();

    return (
        <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.realtimeRanking.loading")}</div>}>
            <RealtimeRankingContent />
        </Suspense>
    );
}
