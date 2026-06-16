"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    fetchLatestV2,
    fetchWorldLinkLatestV2,
} from "@/lib/realtime-ranking-next-api";
import {
    BoardEntryWithDiffV2,
    BoardSnapshotV2,
    RealtimeRankingNextBoardMode,
    RealtimeRankingRegion,
    WorldLinkGroupSnapshotV2,
    WorldLinkSnapshotV2,
} from "@/types/realtime-ranking-next";
import { buildEntriesWithDiff, LastChange } from "../_lib/board-utils";
import { mergeResilientEntries } from "@/lib/realtime-ranking-resilience";

export const POLL_INTERVAL = 10_000;
// After this many consecutive degraded polls, accept the incoming payload so a
// genuine roster shrink is not preserved as stale forever. ~5 min at 10s polls.
const MAX_DEGRADED_POLLS = 30;
const EMPTY_STALE_RANKS: Set<number> = new Set();

interface UseRealtimeBoardResult {
    snapshot: BoardSnapshotV2 | null;
    worldLinkSnapshot: WorldLinkSnapshotV2 | null;
    activeGroup: WorldLinkGroupSnapshotV2 | null;
    worldLinkAvailable: boolean;
    worldLinkConfirmedUnavailable: boolean;
    entries: BoardEntryWithDiffV2[];
    isWorldLinkMode: boolean;
    isLoading: boolean;
    isRefreshing: boolean;
    error: string | null;
    /** Ranks whose data was carried over from a previous snapshot (stale/syncing). */
    staleRanks: Set<number>;
    refresh: () => void;
    setSelectedCharacterId: (id: number | null) => void;
    selectedCharacterId: number | null;
    /** Look up a specific entry by userId in the current active board. */
    findEntry: (userId: string) => BoardEntryWithDiffV2 | null;
}

/**
 * Polls the v2 latest (and worldlink-latest) endpoints, computes live diffs,
 * and exposes the active board entries.
 */
export function useRealtimeBoard(
    region: RealtimeRankingRegion,
    boardMode: RealtimeRankingNextBoardMode,
    enabled: boolean,
): UseRealtimeBoardResult {
    const [snapshot, setSnapshot] = useState<BoardSnapshotV2 | null>(null);
    const [previousSnapshot, setPreviousSnapshot] = useState<BoardSnapshotV2 | null>(null);
    const [worldLinkSnapshot, setWorldLinkSnapshot] = useState<WorldLinkSnapshotV2 | null>(null);
    const [previousWorldLinkSnapshot, setPreviousWorldLinkSnapshot] = useState<WorldLinkSnapshotV2 | null>(null);
    const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [staleRanks, setStaleRanks] = useState<Set<number>>(new Set());

    const requestIdRef = useRef(0);
    const snapshotRef = useRef<BoardSnapshotV2 | null>(null);
    const worldLinkSnapshotRef = useRef<WorldLinkSnapshotV2 | null>(null);
    const worldLinkCheckedRef = useRef(false);
    const lastChangesRef = useRef(new Map<string, LastChange>());
    const degradedPollCountRef = useRef(0);

    const load = useCallback(async (nextRegion: RealtimeRankingRegion, isPoll: boolean) => {
        const id = ++requestIdRef.current;
        if (isPoll) {
            setIsRefreshing(true);
        } else {
            // Fresh load (region change / mount): clear prior board state.
            setIsLoading(true);
            setSnapshot(null);
            setPreviousSnapshot(null);
            setWorldLinkSnapshot(null);
            setPreviousWorldLinkSnapshot(null);
            snapshotRef.current = null;
            worldLinkSnapshotRef.current = null;
            worldLinkCheckedRef.current = false;
            lastChangesRef.current.clear();
            degradedPollCountRef.current = 0;
            setStaleRanks(new Set());
        }

        try {
            const [latest, worldLink] = await Promise.all([
                fetchLatestV2(nextRegion),
                fetchWorldLinkLatestV2(nextRegion).catch(() => null),
            ]);
            if (id !== requestIdRef.current) return;

            // Boundary handling: while polling, ignore a transiently empty/invalid
            // snapshot so the live board does not flash "no players". A fresh load
            // still applies whatever it receives (so genuine empty states surface).
            const latestValid = !!latest && latest.entries.length > 0;
            if (isPoll && !latestValid) {
                setError(null);
                return;
            }

            const previousOverall = snapshotRef.current;

            // Resilience: when polling the same event, guard against a transiently
            // collapsed payload (e.g. only tier lines survive) wiping the TOP rows.
            let nextOverall = latest;
            const sameEvent = !!previousOverall && !!latest
                && previousOverall.eventId === latest.eventId;
            if (isPoll && sameEvent && degradedPollCountRef.current < MAX_DEGRADED_POLLS) {
                const merged = mergeResilientEntries(previousOverall!.entries, latest!.entries);
                if (merged.degraded) {
                    degradedPollCountRef.current += 1;
                    nextOverall = { ...latest!, entries: merged.entries };
                    setStaleRanks(merged.staleRanks);
                } else {
                    degradedPollCountRef.current = 0;
                    setStaleRanks(new Set());
                }
            } else {
                degradedPollCountRef.current = 0;
                setStaleRanks(new Set());
            }

            setPreviousSnapshot(previousOverall);
            snapshotRef.current = nextOverall;
            setSnapshot(nextOverall);

            worldLinkCheckedRef.current = true;
            const wlMatches = worldLink && nextOverall && worldLink.eventId === nextOverall.eventId && worldLink.groups.length > 0;
            let nextWorldLink = wlMatches ? worldLink : null;

            // Resilience: merge each WL group against the matching previous group.
            const previousWorldLink = worldLinkSnapshotRef.current;
            if (isPoll && nextWorldLink && previousWorldLink
                && previousWorldLink.eventId === nextWorldLink.eventId
                && degradedPollCountRef.current < MAX_DEGRADED_POLLS) {
                const prevGroupByChar = new Map(
                    previousWorldLink.groups.map((g) => [g.gameCharacterId, g]),
                );
                const mergedGroups = nextWorldLink.groups.map((group) => {
                    const prevGroup = prevGroupByChar.get(group.gameCharacterId);
                    if (!prevGroup) return group;
                    const merged = mergeResilientEntries(prevGroup.entries, group.entries);
                    return merged.degraded ? { ...group, entries: merged.entries } : group;
                });
                nextWorldLink = { ...nextWorldLink, groups: mergedGroups };
            }

            setPreviousWorldLinkSnapshot(previousWorldLink);
            worldLinkSnapshotRef.current = nextWorldLink;
            setWorldLinkSnapshot(nextWorldLink);

            setError(null);
        } catch (err) {
            if (id !== requestIdRef.current) return;
            const message = err instanceof Error ? err.message : "unknown";
            setError(message);
        } finally {
            if (id !== requestIdRef.current) return;
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Reset & start polling when region changes / enabled toggles.
    useEffect(() => {
        if (!enabled) return;

        void load(region, false);
        const timer = window.setInterval(() => void load(region, true), POLL_INTERVAL);
        return () => window.clearInterval(timer);
    }, [enabled, region, load]);

    const worldLinkAvailable = !!worldLinkSnapshot
        && !!snapshot
        && worldLinkSnapshot.eventId === snapshot.eventId
        && worldLinkSnapshot.groups.length > 0;
    const worldLinkConfirmedUnavailable = worldLinkCheckedRef.current && !worldLinkAvailable;

    // Auto-select the first WL group when entering WL mode.
    useEffect(() => {
        if (!worldLinkSnapshot || worldLinkSnapshot.groups.length === 0) {
            setSelectedCharacterId(null);
            return;
        }
        setSelectedCharacterId((prev) => {
            if (prev != null && worldLinkSnapshot.groups.some((g) => g.gameCharacterId === prev)) {
                return prev;
            }
            return worldLinkSnapshot.groups[0].gameCharacterId;
        });
    }, [worldLinkSnapshot]);

    const activeGroup = useMemo<WorldLinkGroupSnapshotV2 | null>(() => {
        if (!worldLinkSnapshot || worldLinkSnapshot.groups.length === 0) return null;
        if (selectedCharacterId != null) {
            const matched = worldLinkSnapshot.groups.find((g) => g.gameCharacterId === selectedCharacterId);
            if (matched) return matched;
        }
        return worldLinkSnapshot.groups[0] ?? null;
    }, [worldLinkSnapshot, selectedCharacterId]);

    const previousGroup = useMemo<WorldLinkGroupSnapshotV2 | null>(() => {
        if (!previousWorldLinkSnapshot || !activeGroup) return null;
        return previousWorldLinkSnapshot.groups.find((g) => g.gameCharacterId === activeGroup.gameCharacterId) ?? null;
    }, [previousWorldLinkSnapshot, activeGroup]);

    const isWorldLinkMode = boardMode === "worldlink" && worldLinkAvailable && !!activeGroup;
    const activeSnapshot = isWorldLinkMode ? activeGroup : snapshot;
    const activePrevious = isWorldLinkMode ? previousGroup : previousSnapshot;
    const scopeKey = isWorldLinkMode && activeGroup ? `worldlink:${activeGroup.gameCharacterId}` : "overall";

    const entries = useMemo(() => {
        if (!activeSnapshot) return [];
        return buildEntriesWithDiff(activeSnapshot, activePrevious, lastChangesRef.current, scopeKey);
    }, [activeSnapshot, activePrevious, scopeKey]);

    const findEntry = useCallback(
        (userId: string) => entries.find((e) => e.userId === userId) ?? null,
        [entries],
    );

    const refresh = useCallback(() => void load(region, true), [load, region]);

    return {
        snapshot,
        worldLinkSnapshot,
        activeGroup,
        worldLinkAvailable,
        worldLinkConfirmedUnavailable,
        entries,
        isWorldLinkMode,
        isLoading,
        isRefreshing,
        error,
        // staleRanks is computed against the overall board; suppress it in WL mode.
        staleRanks: isWorldLinkMode ? EMPTY_STALE_RANKS : staleRanks,
        refresh,
        setSelectedCharacterId,
        selectedCharacterId,
        findEntry,
    };
}
