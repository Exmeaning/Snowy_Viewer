"use client";

import RankingRow from "@/components/realtime-ranking/RankingRow";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingListProps {
    entries: RealtimeRankingEntryWithDiff[];
    expandedIds: string[];
    onToggleExpand: (userId: string) => void;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
}

export default function RankingList({ entries, expandedIds, onToggleExpand, masterData, assetSource }: RankingListProps) {
    if (entries.length === 0) {
        return (
            <div className="glass-card rounded-2xl p-10 text-center text-slate-500">
                当前暂无可展示的排行榜数据。
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((entry) => (
                <RankingRow
                    key={entry.userId}
                    entry={entry}
                    expanded={expandedIds.includes(entry.userId)}
                    onToggle={() => onToggleExpand(entry.userId)}
                    masterData={masterData}
                    assetSource={assetSource}
                />
            ))}
        </div>
    );
}
