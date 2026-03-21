"use client";

interface RankChangeBadgeProps {
    rankDelta: number;
    isNewEntry?: boolean;
}

export default function RankChangeBadge({ rankDelta, isNewEntry = false }: RankChangeBadgeProps) {
    if (isNewEntry) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                <span>✨</span>
                新上榜
            </span>
        );
    }

    if (rankDelta > 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <span>↑</span>
                +{rankDelta}
            </span>
        );
    }

    if (rankDelta < 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                <span>↓</span>
                {rankDelta}
            </span>
        );
    }

    return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">—</span>;
}
