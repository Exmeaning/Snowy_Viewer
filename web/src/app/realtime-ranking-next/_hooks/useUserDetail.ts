"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    fetchChurnV2,
    fetchLatestV2,
    fetchParkingLiveV2,
    fetchTierSeriesV2,
    fetchUserSeriesV2,
    fetchWorldLinkLatestV2,
    fetchWorldLinkTierSeriesV2,
    fetchWorldLinkUserSeriesV2,
} from "@/lib/realtime-ranking-next-api";
import {
    BoardEntryV2,
    BoardSnapshotV2,
    ChurnEntryV2,
    ChurnScoreChangeV2,
    ParkingLiveUserV2,
    RealtimeRankingRegion,
    SeriesPoint,
} from "@/types/realtime-ranking-next";
import { entryKey, getTierRanks } from "../_lib/board-utils";

const DETAIL_POLL_INTERVAL = 10_000;
const NEARBY_RANGE = 5; // ±5 rows around the target player.

// When a fresh load hits a transient empty/invalid snapshot (the backend can
// briefly return no entries while swapping datasets), retry quickly instead of
// declaring the player "not found" and forcing the user to wait for the poll.
const FRESH_RETRY_DELAYS = [1_500, 3_000, 5_000] as const;

/** Tier ranks shown in the gradient panel. */
const GRADIENT_TIERS = [1, 10, 20, 30, 40, 50, 100];

export interface NearbyEntry extends BoardEntryV2 {
    isSelf: boolean;
    /** Recent score changes from churn, used for live delta + time. */
    recentChanges: ChurnScoreChangeV2[];
}

export interface TierGradientItem {
    tier: number;
    /** Latest score at this tier (from snapshot or series). */
    score: number | null;
    /** Score gap vs. the target player (tier - self). Positive => target is behind. */
    gapToSelf: number | null;
    /** Tier-line 1h speed if available from churn. */
    speed1h: number | null;
    points: SeriesPoint[];
}

export interface UserDetailData {
    self: BoardEntryV2 | null;
    selfChurn: ChurnEntryV2 | undefined;
    selfSeries: SeriesPoint[];
    nearby: NearbyEntry[];
    tierGradient: TierGradientItem[];
    parking: ParkingLiveUserV2 | null;
    eventId: number | null;
    snapshot: BoardSnapshotV2 | null;
}

const EMPTY: UserDetailData = {
    self: null,
    selfChurn: undefined,
    selfSeries: [],
    nearby: [],
    tierGradient: [],
    parking: null,
    eventId: null,
    snapshot: null,
};

interface UseUserDetailOptions {
    region: RealtimeRankingRegion;
    userId: string;
    /** WL character id when viewing a WL board, otherwise null. */
    worldLinkCharacterId: number | null;
}

export function useUserDetail({ region, userId, worldLinkCharacterId }: UseUserDetailOptions) {
    const [data, setData] = useState<UserDetailData>(EMPTY);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const retryTimerRef = useRef<number | null>(null);
    const freshRetryCountRef = useRef(0);

    const load = useCallback(async (isPoll: boolean) => {
        const id = ++requestIdRef.current;
        if (isPoll) {
            setIsRefreshing(true);
        }
        if (!isPoll) {
            // A new fresh load supersedes any pending retry.
            if (retryTimerRef.current != null) {
                window.clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            setIsLoading(true);
            setData(EMPTY);
        }

        let willRetry = false;

        try {
            // Snapshot: WL group or overall.
            let snapshot: BoardSnapshotV2 | null;
            if (worldLinkCharacterId != null) {
                const wl = await fetchWorldLinkLatestV2(region);
                snapshot = wl?.groups.find((g) => g.gameCharacterId === worldLinkCharacterId) ?? null;
            } else {
                snapshot = await fetchLatestV2(region);
            }
            if (id !== requestIdRef.current) return;

            // Distinguish a transient empty/invalid snapshot from a snapshot that
            // is genuinely complete but simply doesn't contain this player.
            const snapshotEmpty = !snapshot || snapshot.entries.length === 0;
            if (!isPoll && snapshotEmpty && freshRetryCountRef.current < FRESH_RETRY_DELAYS.length) {
                const delay = FRESH_RETRY_DELAYS[freshRetryCountRef.current];
                freshRetryCountRef.current += 1;
                willRetry = true;
                retryTimerRef.current = window.setTimeout(() => void load(false), delay);
                return; // keep isLoading=true; do not flash "not found"
            }
            // Got a usable fresh snapshot (or exhausted retries): reset the counter.
            if (!isPoll) freshRetryCountRef.current = 0;

            const self = snapshot?.entries.find((e) => e.userId === userId) ?? null;
            const since = snapshot?.startAt;

            // Determine neighbouring tiers for the gradient + tier series.
            const selfRank = self?.rank ?? 100;
            const [lowerTier, upperTier] = getTierRanks(selfRank);
            const tiersToFetch = Array.from(
                new Set([...GRADIENT_TIERS, lowerTier, upperTier].filter((x): x is number => x != null && x > 0)),
            ).sort((a, b) => a - b);

            const userSeriesPromise = worldLinkCharacterId != null
                ? fetchWorldLinkUserSeriesV2(region, { gameCharacterId: worldLinkCharacterId, userIds: [userId], since })
                : fetchUserSeriesV2(region, { userIds: [userId], since });
            const tierSeriesPromise = worldLinkCharacterId != null
                ? fetchWorldLinkTierSeriesV2(region, { gameCharacterId: worldLinkCharacterId, tiers: tiersToFetch, since })
                : fetchTierSeriesV2(region, { tiers: tiersToFetch, since });

            const [userSeries, tierSeries, churnList, parkingList] = await Promise.all([
                userSeriesPromise.catch(() => ({} as Record<string, SeriesPoint[]>)),
                tierSeriesPromise.catch(() => ({} as Record<string, SeriesPoint[]>)),
                fetchChurnV2(region, { top: 200 }).catch(() => [] as ChurnEntryV2[]),
                worldLinkCharacterId != null
                    ? Promise.resolve([] as ParkingLiveUserV2[])
                    : fetchParkingLiveV2(region).catch(() => [] as ParkingLiveUserV2[]),
            ]);
            if (id !== requestIdRef.current) return;

            // Churn map.
            const churnMap = new Map<string, ChurnEntryV2>();
            for (const c of churnList) {
                const isTierLine = c.userId == null;
                churnMap.set(entryKey(c.rank, String(c.userId ?? ""), isTierLine), { ...c, isTierLine: isTierLine || undefined });
            }
            const selfChurn = churnMap.get(userId);

            // Nearby entries (±N around self).
            const nearby: NearbyEntry[] = [];
            if (snapshot && self) {
                const lo = self.rank - NEARBY_RANGE;
                const hi = self.rank + NEARBY_RANGE;
                for (const e of snapshot.entries) {
                    if (e.rank >= lo && e.rank <= hi) {
                        const c = churnMap.get(e.userId);
                        nearby.push({
                            ...e,
                            isSelf: e.userId === userId,
                            recentChanges: c?.recent_score_changes ?? [],
                        });
                    }
                }
                nearby.sort((a, b) => a.rank - b.rank);
            }

            // Tier gradient.
            // Current score / gap come from the full TOP100 snapshot (always complete,
            // so every gradient tier is filled immediately). The 1h speed is derived
            // from the tier-series points because churn carries no tier-line entries.
            const scoreByRank = new Map<number, number>();
            for (const e of snapshot?.entries ?? []) scoreByRank.set(e.rank, e.score);

            const selfScore = self?.score ?? null;
            const nowMs = Date.now();
            const tierGradient: TierGradientItem[] = GRADIENT_TIERS.map((tier) => {
                const points = tierSeries[String(tier)] ?? [];
                const lastSeries = points.length > 0 ? points[points.length - 1].s : null;
                // Prefer the live snapshot score (full TOP100); fall back to the last series point.
                const score = scoreByRank.get(tier) ?? lastSeries;

                let speed1h: number | null = null;
                if (points.length >= 2) {
                    const cutoff = nowMs - 3_600_000;
                    const recent = points.filter((p) => p.t >= cutoff);
                    const ref = recent.length >= 2 ? recent : points;
                    if (ref.length >= 2) {
                        speed1h = ref[ref.length - 1].s - ref[0].s;
                    }
                }

                return {
                    tier,
                    score: score ?? null,
                    gapToSelf: score != null && selfScore != null ? score - selfScore : null,
                    speed1h,
                    points,
                };
            });

            const parking = worldLinkCharacterId != null
                ? null
                : parkingList.find((p) => p.userId === userId) ?? null;

            const fetchedSeries = userSeries[userId] ?? [];

            // Boundary handling: a poll may briefly return an empty snapshot
            // (no entries / self missing) or an empty churn list while the
            // backend swaps datasets. In that case we keep the last good values
            // instead of flashing "no data" / "no speed" / "player not found".
            const snapshotValid = !!snapshot && snapshot.entries.length > 0 && !!self;
            const gradientValid = tierGradient.some((g) => g.score != null);

            setData((prev) => {
                const keepOnPoll = isPoll; // only preserve while polling, never on a fresh load

                // Snapshot-derived fields move together.
                const nextSelf = snapshotValid ? self : keepOnPoll ? prev.self : self;
                const nextNearby = snapshotValid ? nearby : keepOnPoll ? prev.nearby : nearby;
                const nextParking = snapshotValid ? parking : keepOnPoll ? prev.parking : parking;
                const nextSnapshot = snapshotValid ? snapshot : keepOnPoll ? prev.snapshot : snapshot;
                const nextEventId = snapshotValid ? (snapshot?.eventId ?? null) : keepOnPoll ? prev.eventId : null;

                // Gradient, churn and series come from independent endpoints.
                const nextGradient = gradientValid ? tierGradient : keepOnPoll ? prev.tierGradient : tierGradient;
                const nextChurn = selfChurn ?? (keepOnPoll ? prev.selfChurn : undefined);
                const nextSeries = fetchedSeries.length > 0 ? fetchedSeries : keepOnPoll ? prev.selfSeries : fetchedSeries;

                return {
                    self: nextSelf,
                    selfChurn: nextChurn,
                    selfSeries: nextSeries,
                    nearby: nextNearby,
                    tierGradient: nextGradient,
                    parking: nextParking,
                    eventId: nextEventId,
                    snapshot: nextSnapshot,
                };
            });
            setError(null);
            setUpdatedAt(Date.now());
        } catch (err) {
            if (id !== requestIdRef.current) return;
            // A network error on a fresh load is also transient: retry quickly
            // a few times before surfacing the error, so a single failed request
            // doesn't strand the user on an error screen until the next poll.
            if (!isPoll && freshRetryCountRef.current < FRESH_RETRY_DELAYS.length) {
                const delay = FRESH_RETRY_DELAYS[freshRetryCountRef.current];
                freshRetryCountRef.current += 1;
                willRetry = true;
                retryTimerRef.current = window.setTimeout(() => void load(false), delay);
                return;
            }
            setError(err instanceof Error ? err.message : "unknown");
        } finally {
            if (id !== requestIdRef.current) return;
            if (!willRetry) {
                setIsLoading(false);
            }
            setIsRefreshing(false);
        }
    }, [region, userId, worldLinkCharacterId]);

    useEffect(() => {
        freshRetryCountRef.current = 0;
        void load(false);
        const timer = window.setInterval(() => void load(true), DETAIL_POLL_INTERVAL);
        return () => {
            requestIdRef.current += 1;
            window.clearInterval(timer);
            if (retryTimerRef.current != null) {
                window.clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
        };
    }, [load]);

    const refresh = useCallback(() => void load(true), [load]);

    return useMemo(
        () => ({ data, isLoading, isRefreshing, updatedAt, error, refresh }),
        [data, isLoading, isRefreshing, updatedAt, error, refresh],
    );
}
