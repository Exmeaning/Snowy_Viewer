"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useRouter } from "next/navigation";
import { localizePathForBrowser } from "@/lib/localized-path";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";
import { useI18n } from "@/contexts/I18nContext";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { BoardEntryWithDiffV2, ChurnEntryV2, RealtimeRankingMasterData } from "@/types/realtime-ranking-next";
import {
    buildHourlyGridReversed,
    calcRecentChurnCount,
    calcRecentGrowth,
    findChurnByRank,
    fmtSpeed,
    getCurrentHourKey,
    getSpeedTrend,
    getTierRanks,
} from "../_lib/board-utils";
import ChangeTime from "./ChangeTime";

interface BoardRowProps {
    entry: BoardEntryWithDiffV2;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    churnEntry?: ChurnEntryV2;
    churnData: Map<string, ChurnEntryV2>;
    showChurn: boolean;
    onShowParkingPeriods: (userId: string) => void;
    /** Link target for the detail page (already includes query). Null disables navigation (tier lines). */
    detailHref: string | null;
    isTracked?: boolean;
    onTrackToggle?: (userId: string) => void;
    /** True when this row's data was carried over from a previous snapshot (syncing). */
    isStale?: boolean;
}

const topThreeCardDeco: Record<number, string> = {
    1: "ring-1 ring-amber-400/70",
    2: "ring-1 ring-[var(--hh-border-strong)]",
    3: "ring-1 ring-orange-400/70",
};

// Medal chips are solid fills, not three-stop gradients: a gradient badge reads
// as web decoration, while the flat system vocabulary gets its hierarchy from
// one saturated value. The dark on-color text pair also means one class list is
// legible under both themes with no dark: variant — and in this app dark:
// resolves from the OS preference rather than the theme switch, so anything
// relying on it is only accidentally correct.
const topThreeBadge: Record<number, string> = {
    1: "border-amber-500 bg-amber-400 text-amber-950",
    2: "border-[var(--hh-border-strong)] bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)]",
    3: "border-orange-500 bg-orange-400 text-orange-950",
};

function getCurrentHourChurn(churnEntry?: ChurnEntryV2): number {
    if (!churnEntry) return 0;
    const hourKey = getCurrentHourKey();
    const found = churnEntry.hourly_churn?.find((h) => h.hour === hourKey);
    return found?.count ?? churnEntry.churn_1h ?? 0;
}

/** Heat color for one hourly churn cell.
 *
 *  Local rather than imported from _lib/board-utils: that module is otherwise
 *  pure data math shared with the charts and the detail page, and this is the
 *  only presentation string in it. Alpha tints are used instead of palette
 *  steps so a single class list stays legible on both the light and the dark
 *  grid surface, with no dark: variant — which matters here because dark:
 *  resolves from the OS preference in this app, not from the theme switch. */
function getChurnCellColor(count: number, isCurrentHour: boolean): string {
    if (count === 0) return "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-tertiary)]";
    if (isCurrentHour) return "bg-sky-500/20 text-sky-700";
    if (count >= 30) return "bg-rose-500/45 text-rose-950";
    if (count >= 20) return "bg-rose-500/32 text-rose-900";
    if (count >= 10) return "bg-rose-500/20 text-rose-800";
    return "bg-rose-500/12 text-rose-700";
}

export default function BoardRow({
    entry,
    masterData,
    assetSource,
    churnEntry,
    churnData,
    showChurn,
    onShowParkingPeriods,
    detailHref,
    isTracked = false,
    onTrackToggle,
    isStale = false,
}: BoardRowProps) {
    const { t, formatNumber } = useI18n();
    const router = useRouter();

    const leaderCard = entry.leaderCardId
        ? masterData.cards.find((card) => card.id === entry.leaderCardId)
        : undefined;
    const derivedCharacterId = entry.leaderCharacterId ?? leaderCard?.characterId;
    const isTrained = entry.leaderCardDefaultImage === "special_training";
    const masterRank = entry.leaderCardMasterRank ?? 0;
    const isTopThree = entry.rank <= 3;
    const isTierLine = entry.isTierLine;

    // Per-row expansion when global churn toggle is closed.
    const [localExpanded, setLocalExpanded] = useState(false);
    const canShowChurnDetails = !isTierLine && churnEntry != null;
    const canShowTierLine = isTierLine && churnEntry != null;
    const showChurnRow = canShowChurnDetails && (showChurn || localExpanded);
    const showTierLineRow = canShowTierLine && (showChurn || localExpanded);

    // Stock-style flash on score change.
    const [flashType, setFlashType] = useState<"up" | "down" | null>(null);
    useEffect(() => {
        const next = entry.scoreDelta === 0 ? null : entry.scoreDelta > 0 ? "up" : "down";
        const setTimer = window.setTimeout(() => setFlashType(next), 0);
        const clearTimer = next ? window.setTimeout(() => setFlashType(null), 1500) : undefined;
        return () => {
            window.clearTimeout(setTimer);
            if (clearTimer) window.clearTimeout(clearTimer);
        };
    }, [entry.score, entry.scoreDelta]);

    const hasCurrentChange = entry.scoreDelta !== 0;

    const churnLast = (() => {
        const changes = churnEntry?.recent_score_changes;
        if (!changes || changes.length === 0) return null;
        return changes.reduce((acc, c) => (c.t > acc.t ? c : acc), changes[0]);
    })();

    let displayScoreDelta: number;
    let displayChangedAt: number | null;
    if (hasCurrentChange) {
        displayScoreDelta = entry.scoreDelta;
        displayChangedAt = entry.lastChangedAt ?? null;
    } else if (entry.lastScoreDelta && entry.lastScoreDelta !== 0) {
        displayScoreDelta = entry.lastScoreDelta;
        displayChangedAt = entry.lastChangedAt ?? null;
    } else if (churnLast) {
        displayScoreDelta = churnLast.delta;
        displayChangedAt = churnLast.t;
    } else {
        displayScoreDelta = 0;
        displayChangedAt = null;
    }
    const displayRankDelta = hasCurrentChange ? entry.rankDelta : entry.lastRankDelta ?? entry.rankDelta;

    const currentHourChurn = canShowChurnDetails ? getCurrentHourChurn(churnEntry) : 0;
    const speed1h = churnEntry?.growth_1h ?? 0;

    // Movement tints stay translucent so they layer over the row's own surface
    // instead of replacing it; tier-line rows step down to the soft surface
    // because they are data points rather than players.
    const rowBg = entry.isNewEntry
        ? "bg-sky-500/[0.08]"
        : entry.scoreDelta > 0
            ? "bg-emerald-500/[0.07]"
            : entry.scoreDelta < 0
                ? "bg-rose-500/[0.07]"
                : isTierLine
                    ? "bg-[var(--hh-surface-1)]"
                    : "";

    // Single values rather than light/dark pairs: emerald-600 and rose-500 both
    // clear 3:1 against the light and the dark row surface.
    const scoreColorClass = hasCurrentChange
        ? entry.scoreDelta > 0
            ? "text-emerald-600"
            : "text-rose-500"
        : "text-[var(--hh-text-primary)]";

    const trackedClasses = isTracked
        ? "ring-2 ring-miku z-20 rounded-[var(--hh-radius-lg)]"
        : "";

    const clickable = !isTierLine && detailHref != null;

    const handleRowClick = () => {
        if (clickable && detailHref) router.push(localizePathForBrowser(detailHref));
    };

    return (
        <motion.div
            layout
            data-rank={entry.rank}
            initial={entry.isNewEntry ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={handleRowClick}
            className={`relative overflow-hidden transition-all duration-300 ${rowBg} ${trackedClasses} ${clickable ? "cursor-pointer hover:bg-miku/[0.06]" : ""} ${isStale ? "opacity-60" : ""}`}
        >
            <AnimatePresence>
                {flashType && (
                    <motion.div
                        key={`flash-${entry.score}`}
                        initial={{ opacity: 0.45 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={`absolute inset-0 pointer-events-none z-0 ${
                            flashType === "up"
                                ? "bg-emerald-500/20"
                                : "bg-rose-500/20"
                        }`}
                    />
                )}
            </AnimatePresence>

            <div className="relative z-10 flex w-full items-center px-3 py-2.5 sm:py-3">
                {/* Rank */}
                <div className="w-10 shrink-0 text-center sm:w-12">
                    <span className={`hh-numeric inline-flex items-center justify-center rounded-[var(--hh-radius-sm)] border px-1.5 py-0.5 text-[11px] font-bold leading-none ${isTopThree ? topThreeBadge[entry.rank] : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)]"}`}>
                        #{entry.rank}
                    </span>
                    {isTierLine && (
                        <div className="mt-0.5 text-[8px] font-medium text-[var(--hh-text-tertiary)]">
                            {t("page.realtimeRankingNext.list.tierLine")}
                        </div>
                    )}
                    {isStale && (
                        <div className="mt-0.5 inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] bg-amber-500/15 px-1 py-0.5 text-[7px] font-bold text-amber-600" title={t("page.realtimeRankingNext.list.staleTitle")}>
                            <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" />
                            {t("page.realtimeRankingNext.list.stale")}
                        </div>
                    )}

                    {/* Expand/collapse button under rank column */}
                    {(canShowChurnDetails || canShowTierLine) && !showChurn && (
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                            {currentHourChurn > 0 && (
                                <span
                                    className="hh-numeric sm:hidden inline-flex items-center justify-center rounded-[var(--hh-radius-sm)] bg-miku/15 px-1.5 py-0.5 text-[9px] font-bold text-miku"
                                    title={t("page.realtimeRanking.list.currentHourChurnTitle")}
                                >
                                    {currentHourChurn}
                                </span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLocalExpanded((v) => !v);
                                }}
                                className={`hh-press hh-focusable inline-flex items-center justify-center w-5 h-5 rounded-[var(--hh-radius-sm)] ${
                                    localExpanded
                                        ? "bg-miku/10 text-miku"
                                        : "text-[var(--hh-text-tertiary)] hover:bg-miku/10 hover:text-miku"
                                }`}
                                title={localExpanded ? t("page.realtimeRanking.list.collapseChurn") : t("page.realtimeRanking.list.expandChurn")}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                    className={`w-3 h-3 transition-transform duration-200 ${localExpanded ? "rotate-180" : ""}`}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <div className="relative ml-2 w-16 shrink-0 sm:w-[72px]">
                    {leaderCard ? (
                        <div className={`overflow-hidden ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <SekaiCardThumbnail card={leaderCard} trained={isTrained} mastery={masterRank} width={72} className="w-full" assetSource={assetSource} />
                        </div>
                    ) : derivedCharacterId ? (
                        <div className={`relative h-16 w-16 overflow-hidden border border-[var(--hh-border)] bg-[var(--hh-surface-2)] sm:h-[72px] sm:w-[72px] ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <Image src={getCharacterIconUrl(derivedCharacterId)} alt={getCharacterName(t, derivedCharacterId)} fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center bg-[var(--hh-surface-sunken)] sm:h-[72px] sm:w-[72px]">
                            <span className="hh-numeric text-xs font-bold text-[var(--hh-text-tertiary)]">#{entry.rank}</span>
                        </div>
                    )}
                </div>

                {/* Player info */}
                <div className="ml-3 min-w-0 flex-1 overflow-hidden">
                    <div className="relative">
                        <div
                            className="flex items-baseline gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden sm:overflow-visible"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                        >
                            <h3 className="hh-title shrink-0 text-sm font-semibold text-[var(--hh-text-primary)] sm:shrink sm:truncate flex items-center gap-1.5">
                                <span className="truncate">{entry.displayName}</span>
                                {!isTierLine && onTrackToggle && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onTrackToggle(entry.userId);
                                        }}
                                        className={`hh-press hh-focusable inline-flex items-center justify-center p-0.5 rounded-[var(--hh-radius-sm)] hover:bg-miku/15 ${
                                            isTracked ? "text-miku" : "text-[var(--hh-text-tertiary)] hover:text-miku"
                                        }`}
                                        title={isTracked ? t("page.realtimeRankingNext.untrack") : t("page.realtimeRankingNext.track")}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} className="w-3.5 h-3.5">
                                            <circle cx="12" cy="12" r="8" />
                                            <circle cx="12" cy="12" r="3" fill={isTracked ? "currentColor" : "none"} />
                                            <line x1="12" y1="1" x2="12" y2="3" />
                                            <line x1="12" y1="21" x2="12" y2="23" />
                                            <line x1="1" y1="12" x2="3" y2="12" />
                                            <line x1="21" y1="12" x2="23" y2="12" />
                                        </svg>
                                    </button>
                                )}
                            </h3>
                            {entry.signature && (
                                <p className="shrink-0 text-[11px] leading-tight text-[var(--hh-text-tertiary)] sm:shrink sm:truncate">{entry.signature}</p>
                            )}
                        </div>
                        {/* Functional fade mask: the name strip scrolls horizontally on mobile,
                            and this signals there is more text past the edge. It has to match
                            whatever surface the row is painted on, so it stays a gradient. */}
                        <div
                            className="pointer-events-none absolute right-0 top-0 h-full w-5 sm:hidden"
                            style={{ background: "linear-gradient(to left, var(--hh-surface-2), transparent)" }}
                        />
                    </div>
                    <div className="mt-1 flex items-center gap-2 max-w-full overflow-hidden">
                        <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} compact />
                        {!isTierLine && !showChurn && speed1h > 0 && (
                            <span className="hh-numeric shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-miku/10 px-1.5 py-0.5 text-[9px] font-bold text-miku">
                                1H {fmtSpeed(speed1h)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Score */}
                <div className="w-28 shrink-0 text-right sm:w-36">
                    {/* Tabular digits keep the column's right edge from shifting as scores tick up. */}
                    <motion.div
                        key={hasCurrentChange ? entry.score : "stable"}
                        initial={hasCurrentChange ? { scale: 1.12 } : false}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className={`hh-numeric hh-display text-base font-bold sm:text-lg ${scoreColorClass}`}
                    >
                        {formatNumber(entry.score)}
                        <span className="ml-0.5 text-[10px] font-bold text-[var(--hh-text-tertiary)]">P</span>
                    </motion.div>
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                        <RankChangeBadge rankDelta={displayRankDelta} isNewEntry={entry.isNewEntry} hasChurnData={!!churnEntry} />
                        <AnimatePresence mode="wait">
                            {displayScoreDelta !== 0 ? (
                                <motion.span
                                    key={`delta-${displayScoreDelta}-${entry.score}`}
                                    initial={{ opacity: 0, y: displayScoreDelta > 0 ? 6 : -6, scale: 0.85 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                                    className={`hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] px-1 py-0.5 text-[9px] font-bold ${
                                        displayScoreDelta > 0
                                            ? "bg-emerald-500/15 text-emerald-700"
                                            : "bg-rose-500/15 text-rose-700"
                                    }`}
                                >
                                    <span className="text-[8px]">{displayScoreDelta > 0 ? "▲" : "▼"}</span>
                                    <span>{displayScoreDelta > 0 ? "+" : ""}{formatNumber(displayScoreDelta)}</span>
                                    {displayChangedAt && (
                                        <ChangeTime changedAt={displayChangedAt} className="ml-0.5 text-[8px] font-medium opacity-60" />
                                    )}
                                </motion.span>
                            ) : (
                                <motion.span key="no-delta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-[var(--hh-text-tertiary)]">
                                    —
                                </motion.span>
                            )}
                        </AnimatePresence>

                        {/* Desktop 1H bubble when collapsed */}
                        {canShowChurnDetails && !showChurn && currentHourChurn > 0 && (
                            <span
                                className="hh-numeric hidden sm:inline-flex items-center justify-center rounded-[var(--hh-radius-sm)] bg-miku/15 px-1.5 py-0.5 text-[9px] font-bold text-miku"
                                title={t("page.realtimeRanking.list.currentHourChurnTitle")}
                            >
                                {currentHourChurn}
                            </span>
                        )}
                    </div>
                </div>

                {/* Chevron for navigable rows */}
                {clickable && (
                    <Link
                        href={detailHref}
                        onClick={(e) => e.stopPropagation()}
                        className="hh-focusable ml-1 hidden shrink-0 items-center justify-center text-[var(--hh-text-tertiary)] transition-colors hover:text-miku sm:flex"
                        title={t("page.realtimeRankingNext.viewDetail")}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                )}
            </div>

            {/* Churn data detail row */}
            <AnimatePresence>
                {showChurnRow && churnEntry && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="relative z-10 overflow-hidden"
                    >
                        <ChurnRow
                            churnEntry={churnEntry}
                            userId={entry.userId}
                            rank={entry.rank}
                            churnData={churnData}
                            onShowParkingPeriods={onShowParkingPeriods}
                        />
                    </motion.div>
                )}
                {showTierLineRow && churnEntry && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="relative z-10 overflow-hidden"
                    >
                        <TierLineChurnRow churnEntry={churnEntry} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function ChurnRow({
    churnEntry,
    userId,
    rank,
    churnData,
    onShowParkingPeriods,
}: {
    churnEntry: ChurnEntryV2;
    userId: string;
    rank: number;
    churnData: Map<string, ChurnEntryV2>;
    onShowParkingPeriods: (userId: string) => void;
}) {
    const { t } = useI18n();
    const grid = buildHourlyGridReversed(churnEntry.hourly_churn ?? []);
    const row1 = grid.slice(0, 24);
    const row2 = grid.slice(24, 48);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }, []);

    // Churn counts.
    const recentChanges = churnEntry.recent_score_changes ?? [];
    const churn1h = churnEntry.churn_1h ?? calcRecentChurnCount(recentChanges, 60);
    const churn20min = churnEntry.churn_20min ?? calcRecentChurnCount(recentChanges, 20);

    // Score speeds.
    const speed1h = churnEntry.growth_1h ?? 0;
    const speed20min3 = calcRecentGrowth(recentChanges, 20) * 3;
    const trend = getSpeedTrend(speed1h, speed20min3);

    // Neighbor tiers.
    const [lowerRank, upperRank] = getTierRanks(rank);
    const lowerEntry = lowerRank != null ? findChurnByRank(churnData, lowerRank) : undefined;
    const upperEntry = upperRank != null ? findChurnByRank(churnData, upperRank) : undefined;

    const trendIcon = trend === "up"
        ? <span className="text-emerald-600 font-bold">▲</span>
        : trend === "down"
            ? <span className="text-rose-500 font-bold">▼</span>
            : <span className="text-[var(--hh-text-tertiary)]">—</span>;

    return (
        <div className="px-3 pb-2.5 pt-1.5 border-t border-[var(--hh-border-hairline)]">
            {/* Churn grid row */}
            <div className="flex items-center gap-2">
                {/* 48H total */}
                <div className="shrink-0 text-center w-10 sm:w-12">
                    <span className="hh-label text-[10px]">48H</span>
                    <div className="hh-numeric text-xs font-bold text-miku">{churnEntry.churn_48h ?? 0}</div>
                </div>

                {/* Hourly grid */}
                <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto">
                    <div className="flex gap-px mb-px">
                        {row1.map((cell, i) => (
                            <div key={`h-${i}`} className="hh-numeric flex-1 min-w-[22px] text-center text-[8px] font-medium text-[var(--hh-text-tertiary)]">
                                {i === 0 ? "1H" : cell.hour}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-px mb-px">
                        {row1.map((cell, i) => (
                            <div key={`r1-${i}`} className={`hh-numeric flex-1 min-w-[22px] text-center text-[9px] font-bold rounded-[var(--hh-radius-xs)] py-0.5 ${getChurnCellColor(cell.count, cell.isCurrentHour)}`} title={cell.localLabel}>
                                {cell.count > 0 ? `${cell.count}${cell.isCurrentHour ? "*" : ""}` : ""}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-px">
                        {row2.map((cell, i) => (
                            <div key={`r2-${i}`} className={`hh-numeric flex-1 min-w-[22px] text-center text-[9px] font-bold rounded-[var(--hh-radius-xs)] py-0.5 ${getChurnCellColor(cell.count, cell.isCurrentHour)}`} title={cell.localLabel}>
                                {cell.count > 0 ? `${cell.count}${cell.isCurrentHour ? "*" : ""}` : ""}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parking button */}
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onShowParkingPeriods(userId);
                    }}
                    className="hh-press hh-focusable shrink-0 rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] px-2 py-1 text-[10px] font-bold text-[var(--hh-text-secondary)] hover:border-miku/40 hover:bg-miku/10 hover:text-miku"
                >
                    {t("page.realtimeRanking.churn.parking")}
                </button>
            </div>

            {/* Speed and churn stats row */}
            <div className="relative mt-1.5 pl-[calc(2.5rem+0.5rem)] sm:pl-[calc(3rem+0.5rem)]">
                <div
                    className="flex flex-nowrap items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:gap-y-1"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                    {/* Latest 1h churn */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-miku/10 px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.churn1h")}</span>
                        <span className="hh-numeric font-bold text-miku">{churn1h}</span>
                    </span>

                    {/* Latest 20min×3 churn */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-sky-500/12 px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.churn20min3")}</span>
                        <span className="hh-numeric font-bold text-sky-600">{churn20min * 3}</span>
                    </span>

                    <span className="shrink-0 text-[var(--hh-text-tertiary)] select-none px-0.5">·</span>

                    {/* Latest 1h speed and trend marker */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.speed1h")}</span>
                        <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">{fmtSpeed(speed1h)}</span>
                        <span className="text-[9px] leading-none">{trendIcon}</span>
                    </span>

                    {/* Latest 20min×3 speed */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.speed20min3")}</span>
                        <span className={`hh-numeric font-bold ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-500" : "text-[var(--hh-text-primary)]"}`}>
                            {fmtSpeed(speed20min3)}
                        </span>
                    </span>

                    {/* Neighbor-tier speed comparison */}
                    {(lowerRank != null || upperRank != null) && (
                        <>
                            <span className="shrink-0 text-[var(--hh-text-tertiary)] select-none px-0.5">·</span>
                            {lowerRank != null && (() => {
                                const spd = lowerEntry?.growth_1h;
                                const faster = spd != null && speed1h > spd;
                                const slower = spd != null && speed1h < spd;
                                return (
                                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] px-1.5 py-0.5 text-[10px] font-bold ${
                                        faster ? "bg-emerald-500/12" :
                                        slower ? "bg-rose-500/12" :
                                        "bg-[var(--hh-surface-sunken)]"
                                    }`}>
                                        <span className={`hh-numeric font-medium ${faster ? "text-emerald-700" : slower ? "text-rose-600" : "text-[var(--hh-text-secondary)]"}`}>
                                            T{lowerRank}
                                        </span>
                                        <span className={`hh-numeric ${faster ? "text-emerald-700" : slower ? "text-rose-600" : "text-[var(--hh-text-secondary)]"}`}>
                                            {spd != null ? fmtSpeed(spd) : "—"}
                                        </span>
                                        {faster && <span className="text-emerald-600 text-[9px]">↑</span>}
                                        {slower && <span className="text-rose-500 text-[9px]">↓</span>}
                                    </span>
                                );
                            })()}
                            {upperRank != null && (() => {
                                const spd = upperEntry?.growth_1h;
                                const faster = spd != null && speed1h > spd;
                                const slower = spd != null && speed1h < spd;
                                return (
                                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] px-1.5 py-0.5 text-[10px] font-bold ${
                                        faster ? "bg-emerald-500/12" :
                                        slower ? "bg-rose-500/12" :
                                        "bg-[var(--hh-surface-sunken)]"
                                    }`}>
                                        <span className={`hh-numeric font-medium ${faster ? "text-emerald-700" : slower ? "text-rose-600" : "text-[var(--hh-text-secondary)]"}`}>
                                            T{upperRank}
                                        </span>
                                        <span className={`hh-numeric ${faster ? "text-emerald-700" : slower ? "text-rose-600" : "text-[var(--hh-text-secondary)]"}`}>
                                            {spd != null ? fmtSpeed(spd) : "—"}
                                        </span>
                                        {faster && <span className="text-emerald-600 text-[9px]">↑</span>}
                                        {slower && <span className="text-rose-500 text-[9px]">↓</span>}
                                    </span>
                                );
                            })()}
                        </>
                    )}
                </div>
                {/* Functional fade mask for the horizontally scrolling stats strip. */}
                <div
                    className="pointer-events-none absolute right-0 top-0 h-full w-6 sm:hidden"
                    style={{ background: "linear-gradient(to left, var(--hh-surface-2), transparent)" }}
                />
            </div>
        </div>
    );
}

function TierLineChurnRow({ churnEntry }: { churnEntry: ChurnEntryV2 }) {
    const { t } = useI18n();
    const recentChanges = churnEntry.recent_score_changes ?? [];
    const speed1h = churnEntry.growth_1h ?? 0;
    const speed20min3 = calcRecentGrowth(recentChanges, 20) * 3;
    const trend = getSpeedTrend(speed1h, speed20min3);

    const trendIcon = trend === "up"
        ? <span className="text-emerald-600 font-bold">▲</span>
        : trend === "down"
            ? <span className="text-rose-500 font-bold">▼</span>
            : <span className="text-[var(--hh-text-tertiary)]">—</span>;

    return (
        <div className="px-3 pb-2.5 pt-1.5 border-t border-[var(--hh-border-hairline)]">
            <div className="relative pl-[calc(2.5rem+0.5rem)] sm:pl-[calc(3rem+0.5rem)]">
                <div
                    className="flex flex-nowrap items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:gap-y-1"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                    {/* Label */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-tertiary)]">{t("page.realtimeRanking.churn.tierLineSpeed")}</span>
                    </span>

                    <span className="shrink-0 text-[var(--hh-text-tertiary)] select-none px-0.5">·</span>

                    {/* Latest 1h speed and trend */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.speed1h")}</span>
                        <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">{fmtSpeed(speed1h)}</span>
                        <span className="text-[9px] leading-none">{trendIcon}</span>
                    </span>

                    {/* Latest 20min×3 speed */}
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-1.5 py-0.5 text-[10px]">
                        <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.speed20min3")}</span>
                        <span className={`hh-numeric font-bold ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-500" : "text-[var(--hh-text-primary)]"}`}>
                            {fmtSpeed(speed20min3)}
                        </span>
                    </span>
                </div>
                {/* Functional fade mask for the horizontally scrolling stats strip. */}
                <div
                    className="pointer-events-none absolute right-0 top-0 h-full w-6 sm:hidden"
                    style={{ background: "linear-gradient(to left, var(--hh-surface-2), transparent)" }}
                />
            </div>
        </div>
    );
}

