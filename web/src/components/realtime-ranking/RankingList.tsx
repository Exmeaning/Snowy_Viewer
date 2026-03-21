"use client";

import RankingRow from "@/components/realtime-ranking/RankingRow";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingListProps {
    entries: RealtimeRankingEntryWithDiff[];
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    secondsSinceUpdate?: number;
}

export default function RankingList({ entries, masterData, assetSource, secondsSinceUpdate }: RankingListProps) {
    if (entries.length === 0) {
        return (
            <div className="glass-card rounded-2xl p-10 text-center text-slate-500">
                当前暂无可展示的排行榜数据。
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
            {/* Table header */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500">
                <div className="w-10 shrink-0 text-center sm:w-12">排名</div>
                <div className="ml-2 flex-1">玩家信息</div>
                <div className="w-32 shrink-0 text-right sm:w-40">分数</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry) => (
                    <RankingRow
                        key={entry.userId}
                        entry={entry}
                        masterData={masterData}
                        assetSource={assetSource}
                        secondsSinceUpdate={secondsSinceUpdate}
                    />
                ))}
            </div>
        </div>
    );
}
