"use client";

interface RankChangeBadgeProps {
    rankDelta: number;
    isNewEntry?: boolean;
    /** When initial churn data already exists, show normal movement instead of NEW. */
    hasChurnData?: boolean;
}

export default function RankChangeBadge({ rankDelta, isNewEntry = false, hasChurnData = false }: RankChangeBadgeProps) {
    // Show NEW only on first load when churn data is unavailable.
    if (isNewEntry && !hasChurnData) {
        return (
            <span className="inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] bg-sky-500/15 px-1 py-0.5 text-[9px] font-bold text-sky-700">
                <span>✨</span>
                NEW
            </span>
        );
    }

    if (rankDelta > 0) {
        return (
            <span className="hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-700">
                ↑{rankDelta}
            </span>
        );
    }

    if (rankDelta < 0) {
        return (
            <span className="hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] bg-rose-500/15 px-1 py-0.5 text-[9px] font-bold text-rose-700">
                ↓{Math.abs(rankDelta)}
            </span>
        );
    }

    return <span className="inline-flex rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1 py-0.5 text-[9px] font-medium text-[var(--hh-text-tertiary)]">—</span>;
}
