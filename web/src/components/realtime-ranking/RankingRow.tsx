"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES } from "@/types/types";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingRowProps {
    entry: RealtimeRankingEntryWithDiff;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    secondsSinceUpdate?: number;
}

function formatElapsed(seconds: number): string {
    if (seconds < 0) return "刚刚";
    if (seconds < 60) return `${seconds}s 前`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m${s > 0 ? `${s}s` : ""} 前`;
}

export default function RankingRow({ entry, masterData, assetSource, secondsSinceUpdate }: RankingRowProps) {
    const leaderCard = entry.leaderCardId
        ? masterData.cards.find((card) => card.id === entry.leaderCardId)
        : undefined;

    const derivedLeaderCharacterId = entry.leaderCharacterId ?? leaderCard?.characterId;
    const isTopThree = entry.rank <= 3;
    const isExtendedTier = entry.rank > 100;

    // 用于 lastChangedAt 的实时倒计时
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // 股票式闪烁：当分数发生实际变化时触发
    const [flashType, setFlashType] = useState<"up" | "down" | null>(null);
    const prevScoreRef = useRef(entry.score);

    useEffect(() => {
        if (entry.scoreDelta !== 0) {
            setFlashType(entry.scoreDelta > 0 ? "up" : "down");
            const timer = setTimeout(() => setFlashType(null), 1500);
            return () => clearTimeout(timer);
        }
    }, [entry.score, entry.scoreDelta]);

    useEffect(() => {
        prevScoreRef.current = entry.score;
    }, [entry.score]);

    // 决定显示哪个 scoreDelta 和对应的倒计时
    const hasCurrentChange = entry.scoreDelta !== 0;
    const displayScoreDelta = hasCurrentChange ? entry.scoreDelta : (entry.lastScoreDelta ?? 0);
    const displayRankDelta = hasCurrentChange ? entry.rankDelta : (entry.lastRankDelta ?? entry.rankDelta);
    const displayElapsed = hasCurrentChange
        ? (secondsSinceUpdate ?? 0)
        : (entry.lastChangedAt ? Math.floor((now - entry.lastChangedAt) / 1000) : undefined);

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

    const rowBg = isExtendedTier
        ? "bg-slate-50/60 dark:bg-slate-900/50"
        : entry.isNewEntry
            ? "bg-sky-50/40 dark:bg-sky-950/15"
            : entry.rankDelta > 0
                ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                : entry.rankDelta < 0
                    ? "bg-rose-50/30 dark:bg-rose-950/10"
                    : "";

    // 分数数字的颜色：有变动时显示涨跌色
    const scoreColorClass = hasCurrentChange
        ? entry.scoreDelta > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        : "text-primary-text";

    return (
        <motion.div
            layout
            data-rank={entry.rank}
            initial={entry.isNewEntry ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`relative overflow-hidden ${rowBg}`}
        >
            {/* 股票式背景闪烁层 */}
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
                {/* Rank # */}
                <div className="w-10 shrink-0 text-center sm:w-12">
                    <span className={`inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-black leading-none ${isTopThree ? topThreeBadge[entry.rank] : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>
                        #{entry.rank}
                    </span>
                    {isExtendedTier && (
                        <div className="mt-0.5 text-[8px] font-medium text-slate-400 dark:text-slate-500">扩展</div>
                    )}
                </div>

                {/* Avatar */}
                <div className="relative ml-2 w-16 shrink-0 sm:w-[72px]">
                    {leaderCard ? (
                        <div className={`overflow-hidden ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <SekaiCardThumbnail card={leaderCard} width={72} className="w-full" />
                        </div>
                    ) : derivedLeaderCharacterId ? (
                        <div className={`relative h-16 w-16 overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 sm:h-[72px] sm:w-[72px] ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <Image src={getCharacterIconUrl(derivedLeaderCharacterId)} alt={CHARACTER_NAMES[derivedLeaderCharacterId] || "角色头像"} fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center bg-slate-100 dark:bg-slate-800/80 sm:h-[72px] sm:w-[72px]">
                            <span className="text-xs font-black text-slate-400">#{entry.rank}</span>
                        </div>
                    )}
                </div>

                {/* Player info: name + signature + honors */}
                <div className="ml-3 min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold leading-tight text-primary-text">{entry.displayName}</h3>
                    {entry.signature && (
                        <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-400 dark:text-slate-500">{entry.signature}</p>
                    )}
                    <div className="mt-1 max-w-full overflow-hidden">
                        <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} compact />
                    </div>
                </div>

                {/* Score column — 股票式反馈 */}
                <div className="w-32 shrink-0 text-right sm:w-40">
                    {/* 分数主体：变动时变色 + 弹跳动画 */}
                    <motion.div
                        key={hasCurrentChange ? entry.score : "stable"}
                        initial={hasCurrentChange ? { scale: 1.12 } : false}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        className={`text-base font-black leading-tight sm:text-lg ${scoreColorClass}`}
                    >
                        {entry.score.toLocaleString()}
                        <span className="ml-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">P</span>
                    </motion.div>

                    {/* 变动详情行 */}
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                        <RankChangeBadge rankDelta={displayRankDelta} isNewEntry={entry.isNewEntry} />
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
                                    {/* 涨跌箭头 */}
                                    <span className="text-[8px]">{displayScoreDelta > 0 ? "▲" : "▼"}</span>
                                    <span>{displayScoreDelta > 0 ? "+" : ""}{displayScoreDelta.toLocaleString()}</span>
                                    {typeof displayElapsed === "number" && (
                                        <span className="ml-0.5 font-medium opacity-60">{formatElapsed(displayElapsed)}</span>
                                    )}
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="no-delta"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[9px] text-slate-400 dark:text-slate-500"
                                >
                                    —
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
