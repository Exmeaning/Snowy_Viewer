// Shared pure helpers for realtime-ranking-next.

import {
    BoardEntryWithDiffV2,
    BoardSnapshotV2,
    ChurnEntryV2,
} from "@/types/realtime-ranking-next";

/** Threshold beyond which a row is a tier line rather than a real player. */
export const TOP_PLAYER_LIMIT = 100;

export interface LastChange {
    rankDelta: number;
    scoreDelta: number;
    changedAt: number;
}

/** Decode HTML entities found in display names / signatures. */
export function decodeHtmlEntities(value: string): string {
    if (typeof window === "undefined") return value;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}

/** Map key for churn / lastChanges lookups: players by userId, tier lines by `tier:{rank}`. */
export function entryKey(rank: number, userId: string, isTierLine: boolean): string {
    return isTierLine ? `tier:${rank}` : userId;
}

/**
 * Build board entries enriched with live diff data.
 * TOP100 players diff by userId; tier lines (rank > 100) diff by rank position.
 * `lastChanges` is mutated in place to remember the most recent non-zero delta.
 */
export function buildEntriesWithDiff(
    snapshot: BoardSnapshotV2,
    previous: BoardSnapshotV2 | null,
    lastChanges: Map<string, LastChange>,
    scopeKey: string,
): BoardEntryWithDiffV2[] {
    const prevByUserId = new Map(previous?.entries.map((e) => [e.userId, e]) ?? []);
    const prevByRank = new Map(previous?.entries.map((e) => [e.rank, e]) ?? []);

    return snapshot.entries.map((entry) => {
        const isTierLine = entry.rank > TOP_PLAYER_LIMIT;
        const prev = isTierLine ? prevByRank.get(entry.rank) : prevByUserId.get(entry.userId);

        const rankDelta = prev && !isTierLine ? prev.rank - entry.rank : 0;
        const scoreDelta = prev ? entry.score - prev.score : 0;

        const scopedKey = isTierLine
            ? `${scopeKey}:tier:${entry.rank}`
            : `${scopeKey}:${entry.userId}`;

        if (scoreDelta !== 0 || rankDelta !== 0) {
            const existing = lastChanges.get(scopedKey);
            lastChanges.set(scopedKey, {
                scoreDelta: scoreDelta !== 0 ? scoreDelta : existing?.scoreDelta ?? 0,
                rankDelta: rankDelta !== 0 ? rankDelta : existing?.rankDelta ?? 0,
                changedAt: Date.now(),
            });
        }

        const saved = lastChanges.get(scopedKey);

        return {
            ...entry,
            displayName: decodeHtmlEntities(entry.displayName),
            signature: entry.signature ? decodeHtmlEntities(entry.signature) : entry.signature,
            previousRank: prev?.rank,
            previousScore: prev?.score,
            rankDelta,
            scoreDelta,
            isNewEntry: !prev,
            isTierLine,
            lastScoreDelta: saved?.scoreDelta,
            lastRankDelta: saved?.rankDelta,
            lastChangedAt: saved?.changedAt,
        };
    });
}

/** ISO key for the current hour, e.g. "2026-06-14T18:00:00Z". */
export function getCurrentHourKey(): string {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Find a churn entry by rank within a churn map. */
export function findChurnByRank(churn: Map<string, ChurnEntryV2>, rank: number): ChurnEntryV2 | undefined {
    for (const e of churn.values()) {
        if (e.rank === rank) return e;
    }
    return undefined;
}

/** Neighbouring tier ranks used for speed comparison. */
export function getTierRanks(rank: number): [number | null, number | null] {
    if (rank <= 10) {
        return [rank > 1 ? rank - 1 : null, rank < 10 ? rank + 1 : null];
    }
    const lower = Math.floor((rank - 1) / 10) * 10;
    const upper = Math.ceil((rank + 1) / 10) * 10;
    return [lower > 0 ? lower : null, upper <= 100 ? upper : null];
}

/** Format a score speed in k units. */
export function fmtSpeed(value: number): string {
    return `${Math.round(value / 1000)}k`;
}

/** Speed trend by comparing 20×3 projection against the actual 1h speed. */
export function getSpeedTrend(speed1h: number, speed20min3: number): "up" | "down" | "flat" {
    if (speed1h === 0 && speed20min3 === 0) return "flat";
    const ratio = speed1h > 0 ? speed20min3 / speed1h : speed20min3 > 0 ? Infinity : 1;
    if (ratio > 1.08) return "up";
    if (ratio < 0.92) return "down";
    return "flat";
}

/** Sum positive deltas within the latest N minutes from recent_score_changes. */
export function calcRecentGrowth(changes: { t: number; delta: number }[], minutes: number): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return changes.filter((c) => c.t >= cutoff && c.delta > 0).reduce((acc, c) => acc + c.delta, 0);
}

/** Count positive deltas within the latest N minutes. */
export function calcRecentChurnCount(changes: { t: number; delta: number }[], minutes: number): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return changes.filter((c) => c.t >= cutoff && c.delta > 0).length;
}
