"use client";

import React from "react";
import RankingRow from "@/components/realtime-ranking/RankingRow";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData, ChurnRankingEntry } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingListProps {
    entries: RealtimeRankingEntryWithDiff[];
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    secondsSinceUpdate?: number;
    showChurn: boolean;
    churnData: Map<string, ChurnRankingEntry>;
    onShowParkingPeriods: (userId: string) => void;
    showExtendedWarning?: boolean;
}

export default function RankingList({
    entries,
    masterData,
    assetSource,
    secondsSinceUpdate,
    showChurn,
    churnData,
    onShowParkingPeriods,
    showExtendedWarning = true,
}: RankingListProps) {
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
                {entries.map((entry, index) => {
                    const prevRank = index > 0 ? entries[index - 1].rank : 0;
                    const showNotice = showExtendedWarning && entry.rank > 100 && prevRank <= 100;
                    return (
                        <React.Fragment key={entry.userId}>
                            {showNotice && (
                                <div className="flex items-center gap-2 border-y border-amber-200/60 bg-amber-50/70 px-4 py-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                    <span className="text-base leading-none">⚠️</span>
                                    <span>100 名以后的排名，游戏不支持高精度采集，数据可能存在延迟。</span>
                                </div>
                            )}
                            <RankingRow
                                entry={entry}
                                masterData={masterData}
                                assetSource={assetSource}
                                secondsSinceUpdate={secondsSinceUpdate}
                                showChurn={showChurn}
                                churnEntry={churnData.get(entry.userId)}
                                onShowParkingPeriods={onShowParkingPeriods}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
