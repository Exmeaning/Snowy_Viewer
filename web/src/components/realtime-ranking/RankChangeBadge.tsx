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
            <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-100 px-1 py-0.5 text-[9px] font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                <span>✨</span>
                NEW
            </span>
        );
    }

    if (rankDelta > 0) {
        return (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                ↑{rankDelta}
            </span>
        );
    }

    if (rankDelta < 0) {
        return (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                ↓{Math.abs(rankDelta)}
            </span>
        );
    }

    return <span className="inline-flex rounded-md bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-400">—</span>;
}
