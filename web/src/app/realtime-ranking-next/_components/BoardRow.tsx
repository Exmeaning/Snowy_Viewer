"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";
import { useI18n } from "@/contexts/I18nContext";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { BoardEntryWithDiffV2, ChurnEntryV2, RealtimeRankingMasterData } from "@/types/realtime-ranking-next";
import { fmtSpeed } from "../_lib/board-utils";
import ChangeTime from "./ChangeTime";

interface BoardRowProps {
    entry: BoardEntryWithDiffV2;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    churnEntry?: ChurnEntryV2;
    /** Link target for the detail page (already includes query). Null disables navigation (tier lines). */
    detailHref: string | null;
    isTracked?: boolean;
    onTrackToggle?: (userId: string) => void;
}

const topThreeCardDeco: Record<number, string> = {
    1: "ring-1 ring-amber-300/70 dark:ring-amber-400/70",
    2: "ring-1 ring-slate-300/80 dark:ring-slate-400/70",
    3: "ring-1 ring-orange-300/70 dark:ring-orange-400/70",
};

const topThreeBadge: Record<number, string> = {
    1: "border-amber-200 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-amber-950 dark:border-amber-400/40 dark:from-amber-500 dark:via-yellow-400 dark:to-amber-500 dark:text-amber-950",
    2: "border-slate-200 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 text-slate-700 dark:border-slate-300/50 dark:from-slate-500 dark:via-slate-400 dark:to-slate-600 dark:text-white",
    3: "border-orange-200 bg-gradient-to-r from-orange-200 via-amber-100 to-orange-300 text-orange-800 dark:border-orange-400/40 dark:from-orange-500 dark:via-amber-500 dark:to-orange-600 dark:text-orange-950",
};

export default function BoardRow({
    entry,
    masterData,
    assetSource,
    churnEntry,
    detailHref,
    isTracked = false,
    onTrackToggle,
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

    // On first entry there is no previous snapshot to diff against, so the live
    // delta is 0 until the second poll. Fall back to the most recent score change
    // reported by churn data (matching the detail page LastChangeBadge), so the
    // latest gain/loss shows immediately on load — mirroring the legacy board.
    // The displayed delta and its time always come from the SAME source so they
    // stay consistent.
    const churnLast = (() => {
        const changes = churnEntry?.recent_score_changes;
        if (!changes || changes.length === 0) return null;
        return changes.reduce((acc, c) => (c.t > acc.t ? c : acc), changes[0]);
    })();

    let displayScoreDelta: number;
    let displayChangedAt: number | null;
    if (hasCurrentChange) {
        displayScoreDelta = entry.scoreDelta;
        // buildEntriesWithDiff stamps lastChangedAt whenever a delta is non-zero.
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

    const speed1h = churnEntry?.growth_1h ?? 0;

    const rowBg = entry.isNewEntry
        ? "bg-sky-50/40 dark:bg-sky-950/15"
        : entry.scoreDelta > 0
            ? "bg-emerald-50/30 dark:bg-emerald-950/10"
            : entry.scoreDelta < 0
                ? "bg-rose-50/30 dark:bg-rose-950/10"
                : isTierLine
                    ? "bg-slate-50/60 dark:bg-slate-900/50"
                    : "";

    const scoreColorClass = hasCurrentChange
        ? entry.scoreDelta > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        : "text-primary-text";

    const trackedClasses = isTracked
        ? "ring-2 ring-miku shadow-[0_0_15px_rgba(51,204,187,0.3)] dark:shadow-[0_0_20px_rgba(51,204,187,0.2)] z-20 rounded-xl"
        : "";

    const clickable = !isTierLine && detailHref != null;

    const handleRowClick = () => {
        if (clickable && detailHref) router.push(detailHref);
    };

    return (
        <motion.div
            layout
            data-rank={entry.rank}
            initial={entry.isNewEntry ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={handleRowClick}
            className={`relative overflow-hidden transition-all duration-300 ${rowBg} ${trackedClasses} ${clickable ? "cursor-pointer hover:bg-miku/[0.04] dark:hover:bg-miku/[0.06]" : ""}`}
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
                                ? "bg-emerald-400/20 dark:bg-emerald-500/15"
                                : "bg-rose-400/20 dark:bg-rose-500/15"
                        }`}
                    />
                )}
            </AnimatePresence>

            <div className="relative z-10 flex w-full items-center px-3 py-2.5 sm:py-3">
                {/* Rank */}
                <div className="w-10 shrink-0 text-center sm:w-12">
                    <span className={`inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-black leading-none ${isTopThree ? topThreeBadge[entry.rank] : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>
                        #{entry.rank}
                    </span>
                    {isTierLine && (
                        <div className="mt-0.5 text-[8px] font-medium text-slate-400 dark:text-slate-500">
                            {t("page.realtimeRankingNext.list.tierLine")}
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <div className="relative ml-2 w-16 shrink-0 sm:w-[72px]">
                    {leaderCard ? (
                        <div className={`overflow-hidden ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <SekaiCardThumbnail card={leaderCard} trained={isTrained} mastery={masterRank} width={72} className="w-full" />
                        </div>
                    ) : derivedCharacterId ? (
                        <div className={`relative h-16 w-16 overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 sm:h-[72px] sm:w-[72px] ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <Image src={getCharacterIconUrl(derivedCharacterId)} alt={getCharacterName(t, derivedCharacterId)} fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center bg-slate-100 dark:bg-slate-800/80 sm:h-[72px] sm:w-[72px]">
                            <span className="text-xs font-black text-slate-400">#{entry.rank}</span>
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
                            <h3 className="shrink-0 text-sm font-bold leading-tight text-primary-text sm:shrink sm:truncate flex items-center gap-1.5">
                                <span className="truncate">{entry.displayName}</span>
                                {!isTierLine && onTrackToggle && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onTrackToggle(entry.userId);
                                        }}
                                        className={`inline-flex items-center justify-center p-0.5 rounded-md transition-all duration-200 hover:scale-110 active:scale-90 hover:bg-miku/15 ${
                                            isTracked ? "text-miku" : "text-slate-300 hover:text-miku dark:text-slate-600 dark:hover:text-miku"
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
                                <p className="shrink-0 text-[11px] leading-tight text-slate-400 dark:text-slate-500 sm:shrink sm:truncate">{entry.signature}</p>
                            )}
                        </div>
                        <div
                            className="pointer-events-none absolute right-0 top-0 h-full w-5 sm:hidden"
                            style={{ background: "linear-gradient(to left, var(--surface-base), transparent)" }}
                        />
                    </div>
                    <div className="mt-1 flex items-center gap-2 max-w-full overflow-hidden">
                        <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} compact />
                        {!isTierLine && speed1h > 0 && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-miku/10 px-1.5 py-0.5 text-[9px] font-black text-miku tabular-nums dark:bg-miku/15">
                                1H {fmtSpeed(speed1h)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Score */}
                <div className="w-28 shrink-0 text-right sm:w-36">
                    <motion.div
                        key={hasCurrentChange ? entry.score : "stable"}
                        initial={hasCurrentChange ? { scale: 1.12 } : false}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className={`text-base font-black leading-tight sm:text-lg ${scoreColorClass}`}
                    >
                        {formatNumber(entry.score)}
                        <span className="ml-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">P</span>
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
                                    className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-bold ${
                                        displayScoreDelta > 0
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                            : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                                    }`}
                                >
                                    <span className="text-[8px]">{displayScoreDelta > 0 ? "▲" : "▼"}</span>
                                    <span>{displayScoreDelta > 0 ? "+" : ""}{formatNumber(displayScoreDelta)}</span>
                                    {displayChangedAt && (
                                        <ChangeTime changedAt={displayChangedAt} className="ml-0.5 text-[8px] font-medium opacity-60" />
                                    )}
                                </motion.span>
                            ) : (
                                <motion.span key="no-delta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] text-slate-400 dark:text-slate-500">
                                    —
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Chevron for navigable rows */}
                {clickable && (
                    <Link
                        href={detailHref}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 hidden shrink-0 items-center justify-center text-slate-300 transition-colors hover:text-miku dark:text-slate-600 sm:flex"
                        title={t("page.realtimeRankingNext.viewDetail")}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                )}
            </div>
        </motion.div>
    );
}
