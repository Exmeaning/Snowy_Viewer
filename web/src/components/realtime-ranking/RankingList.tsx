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
    /** Ranks whose data was carried over from a previous snapshot (stale/syncing). */
    staleRanks?: Set<number>;
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
    staleRanks,
}: RankingListProps) {
    const { t } = useI18n();

    if (entries.length === 0) {
        return (
            <div className="hh-well rounded-[var(--hh-radius-lg)] p-10 text-center text-[var(--hh-text-secondary)]">
                {t("page.realtimeRanking.list.empty")}
            </div>
        );
    }

    return (
        // High-density list geometry: one tile holding hairline-separated rows,
        // rather than a stack of individually shadowed cards. `divide-y` gives
        // every row its separator without adding a few hundred shadows to the
        // paint. The previous divide-slate-100 was also one of the few slate
        // utilities the dark shim in globals.css does not remap, so in dark mode
        // the separators were rendering near-white.
        <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
            {/* Table header — a sunken strip, the system's label row. */}
            <div className="hh-label flex items-center border-b border-[var(--hh-border)] bg-[var(--hh-surface-sunken)] px-3 py-2.5">
                <div className="w-10 shrink-0 text-center sm:w-12">{t("page.realtimeRanking.list.rank")}</div>
                <div className="ml-2 flex-1">{t("page.realtimeRanking.list.playerInfo")}</div>
                <div className="w-32 shrink-0 text-right sm:w-40">{t("page.realtimeRanking.list.score")}</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--hh-border-hairline)]">
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
                                <div className="flex items-center gap-2 border-y border-amber-500/30 bg-amber-500/12 px-4 py-2 text-[11px] text-amber-700">
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
                                isStale={staleRanks?.has(entry.rank) ?? false}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
