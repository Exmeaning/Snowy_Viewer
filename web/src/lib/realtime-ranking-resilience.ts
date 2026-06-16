// ============================================================================
// Resilient snapshot merging for the realtime ranking boards.
//
// Problem: the live ranking API occasionally returns a transiently empty or
// partially-collapsed payload (e.g. the TOP100 real players are missing while
// only the tier lines T100/T200/T300 survive). The board UIs used to overwrite
// their state with whatever a poll returned, so a single bad poll wiped the
// visible 1-99 rows until the next good poll arrived.
//
// This helper merges an incoming payload against the previously-applied one so
// that a degraded poll keeps the last good rows (flagged as "stale") instead of
// making them disappear. Healthy polls pass through untouched.
// ============================================================================

/** Minimal shape shared by both the legacy and v2 board entries. */
export interface MergeableEntry {
    rank: number;
    userId: string;
    score: number;
}

export interface ResilientMergeOptions {
    /** Rows with rank <= topLimit are considered "real players". Default 100. */
    topLimit?: number;
    /**
     * Minimum ratio of incoming TOP rows vs. previous TOP rows required to treat
     * the incoming payload as healthy. Below this we consider it collapsed and
     * fall back to merging. Default 0.5.
     */
    minHealthRatio?: number;
    /**
     * Skip the collapse heuristic entirely when the previous snapshot had fewer
     * than this many TOP rows (e.g. very early in an event when few players are
     * ranked). Default 20.
     */
    minPrevTop?: number;
}

export interface ResilientMergeResult<T extends MergeableEntry> {
    /** The entries to render, sorted by rank ascending. */
    entries: T[];
    /** True when the incoming payload looked collapsed and we fell back to merging. */
    degraded: boolean;
    /** Ranks whose data was carried over from the previous snapshot (stale). */
    staleRanks: Set<number>;
}

function countTopEntries<T extends MergeableEntry>(entries: T[], topLimit: number): number {
    let count = 0;
    for (const entry of entries) {
        if (entry.rank <= topLimit) count += 1;
    }
    return count;
}

/**
 * Merge an incoming list of entries against the previously-applied list,
 * preserving last-good rows when the incoming payload looks collapsed.
 *
 * - When `incoming` is empty/null: keep `previous` entirely (all stale).
 * - When the incoming TOP-row count is healthy: pass `incoming` through.
 * - When the incoming TOP rows collapsed: merge by rank, preferring incoming
 *   values and back-filling missing ranks from `previous` (flagged stale).
 */
export function mergeResilientEntries<T extends MergeableEntry>(
    previous: T[] | null | undefined,
    incoming: T[] | null | undefined,
    opts: ResilientMergeOptions = {},
): ResilientMergeResult<T> {
    const topLimit = opts.topLimit ?? 100;
    const minHealthRatio = opts.minHealthRatio ?? 0.5;
    const minPrevTop = opts.minPrevTop ?? 20;

    const prev = previous ?? [];
    const inc = incoming ?? [];

    // No previous reference: accept incoming as-is (nothing to protect yet).
    if (prev.length === 0) {
        return { entries: inc, degraded: false, staleRanks: new Set() };
    }

    // Incoming completely empty: keep the previous board entirely.
    if (inc.length === 0) {
        return {
            entries: [...prev].sort((a, b) => a.rank - b.rank),
            degraded: true,
            staleRanks: new Set(prev.map((e) => e.rank)),
        };
    }

    const prevTop = countTopEntries(prev, topLimit);
    const incTop = countTopEntries(inc, topLimit);

    // Healthy: either the previous board was too small to judge, or incoming
    // retains enough TOP rows. Accept incoming verbatim.
    const healthy = prevTop < minPrevTop || incTop >= prevTop * minHealthRatio;
    if (healthy) {
        return { entries: inc, degraded: false, staleRanks: new Set() };
    }

    // Collapsed: merge by rank, preferring incoming and back-filling from prev.
    const byRank = new Map<number, T>();
    for (const entry of prev) {
        byRank.set(entry.rank, entry);
    }
    const incomingRanks = new Set<number>();
    for (const entry of inc) {
        byRank.set(entry.rank, entry);
        incomingRanks.add(entry.rank);
    }

    const staleRanks = new Set<number>();
    for (const rank of byRank.keys()) {
        if (!incomingRanks.has(rank)) staleRanks.add(rank);
    }

    const entries = Array.from(byRank.values()).sort((a, b) => a.rank - b.rank);
    return { entries, degraded: true, staleRanks };
}

/**
 * Heuristic for churn-style payloads: returns true when the incoming list looks
 * too collapsed compared to the previous one and the caller should keep the old
 * data instead of overwriting it. Conservative — only blocks when the previous
 * set was sizable and the incoming set lost most of it.
 */
export function shouldKeepPreviousChurn(
    previousSize: number,
    incomingSize: number,
    opts: { minPrevSize?: number; minHealthRatio?: number } = {},
): boolean {
    const minPrevSize = opts.minPrevSize ?? 20;
    const minHealthRatio = opts.minHealthRatio ?? 0.5;
    if (previousSize < minPrevSize) return false;
    if (incomingSize === 0) return true;
    return incomingSize < previousSize * minHealthRatio;
}
