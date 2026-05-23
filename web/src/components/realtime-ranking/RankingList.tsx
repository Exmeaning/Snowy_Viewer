"use client";

import React from "react";
import RankingRow from "@/components/realtime-ranking/RankingRow";
import { useI18n } from "@/contexts/I18nContext";
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
    trackedUserId: string | null;
    onTrackToggle: (userId: string) => void;
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
    trackedUserId,
    onTrackToggle,
}: RankingListProps) {
    const { t } = useI18n();

    if (entries.length === 0) {
        return (
            <div className="ios-glass-card rounded-2xl p-10 text-center text-slate-500">
                {t("page.realtimeRanking.list.empty")}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl ios-glass-card">
            {/* Table header */}
            <div className="flex items-center border-b border-slate-200/50 bg-slate-50/50 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700/30 dark:bg-slate-800/30 dark:text-slate-500">
                <div className="w-10 shrink-0 text-center sm:w-12">{t("page.realtimeRanking.list.rank")}</div>
                <div className="ml-2 flex-1">{t("page.realtimeRanking.list.playerInfo")}</div>
                <div className="w-32 shrink-0 text-right sm:w-40">{t("page.realtimeRanking.list.score")}</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100/50 dark:divide-slate-800/40">
                {entries.map((entry, index) => {
                    const prevRank = index > 0 ? entries[index - 1].rank : 0;
                    const showNotice = showExtendedWarning && entry.rank > 100 && prevRank <= 100;
                    // For rank > 100 rows, prefer the tier-line key and fall back to userId.
                    const churnEntry = entry.rank > 100
                        ? (churnData.get(`tier:${entry.rank}`) ?? churnData.get(entry.userId))
                        : churnData.get(entry.userId);
                    return (
                        <React.Fragment key={entry.userId}>
                            {showNotice && (
                                <div className="flex items-center gap-2 border-y border-amber-200/60 bg-amber-50/70 px-4 py-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                    <span className="text-base leading-none">⚠️</span>
                                    <span>{t("page.realtimeRanking.list.extendedWarning")}</span>
                                </div>
                            )}
                            <RankingRow
                                entry={entry}
                                masterData={masterData}
                                assetSource={assetSource}
                                secondsSinceUpdate={secondsSinceUpdate}
                                showChurn={showChurn}
                                churnEntry={churnEntry}
                                churnData={churnData}
                                onShowParkingPeriods={onShowParkingPeriods}
                                isTracked={entry.userId === trackedUserId}
                                onTrackToggle={onTrackToggle}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
