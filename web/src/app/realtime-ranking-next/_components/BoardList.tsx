"use client";

import { motion } from "framer-motion";
import BoardRow from "./BoardRow";
import { BoardEntryWithDiffV2, ChurnEntryV2, RealtimeRankingMasterData, RealtimeRankingRegion } from "@/types/realtime-ranking-next";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { entryKey } from "../_lib/board-utils";

interface BoardListProps {
    entries: BoardEntryWithDiffV2[];
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    churnData: Map<string, ChurnEntryV2>;
    showChurn: boolean;
    onShowParkingPeriods: (userId: string) => void;
    region: RealtimeRankingRegion;
    eventId?: number;
    /** WL character id when in WL mode, otherwise null. */
    worldLinkCharacterId: number | null;
    trackedUserId: string | null;
    onTrackToggle: (userId: string) => void;
    /** Ranks whose data was carried over from a previous snapshot (stale/syncing). */
    staleRanks?: Set<number>;
}

function buildDetailHref(
    userId: string,
    region: RealtimeRankingRegion,
    eventId: number | undefined,
    worldLinkCharacterId: number | null,
): string {
    const params = new URLSearchParams();
    params.set("region", region);
    if (eventId != null) params.set("event", String(eventId));
    if (worldLinkCharacterId != null) params.set("wl", String(worldLinkCharacterId));
    return `/realtime-ranking-next/u/${encodeURIComponent(userId)}?${params.toString()}`;
}

export default function BoardList({
    entries,
    masterData,
    assetSource,
    churnData,
    showChurn,
    onShowParkingPeriods,
    region,
    eventId,
    worldLinkCharacterId,
    trackedUserId,
    onTrackToggle,
    staleRanks,
}: BoardListProps) {
    return (
        // High-density list geometry: one tile holding hairline-separated rows,
        // rather than a stack of individually shadowed cards. `divide-y` with the
        // hairline token gives every row its separator without adding a few
        // hundred shadows to the paint. The previous divide-slate-100 was also
        // one of the few slate utilities the dark shim in globals.css does not
        // remap, so in dark mode the separators were rendering near-white.
        <motion.div
            layout
            className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)] divide-y divide-[var(--hh-border-hairline)]"
        >
            {entries.map((entry) => {
                const key = entryKey(entry.rank, entry.userId, entry.isTierLine);
                const churnEntry = churnData.get(key);
                const detailHref = entry.isTierLine
                    ? null
                    : buildDetailHref(entry.userId, region, eventId, worldLinkCharacterId);
                return (
                    <BoardRow
                        key={entry.isTierLine ? `tier-${entry.rank}` : entry.userId}
                        entry={entry}
                        masterData={masterData}
                        assetSource={assetSource}
                        churnEntry={churnEntry}
                        churnData={churnData}
                        showChurn={showChurn}
                        onShowParkingPeriods={onShowParkingPeriods}
                        detailHref={detailHref}
                        isTracked={!entry.isTierLine && trackedUserId === entry.userId}
                        onTrackToggle={onTrackToggle}
                        isStale={staleRanks?.has(entry.rank) ?? false}
                    />
                );
            })}
        </motion.div>
    );
}
