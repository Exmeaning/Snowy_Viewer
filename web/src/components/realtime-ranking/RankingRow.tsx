"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import ScoreChangeBadge from "@/components/realtime-ranking/ScoreChangeBadge";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES } from "@/types/types";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingRowProps {
    entry: RealtimeRankingEntryWithDiff;
    expanded: boolean;
    onToggle: () => void;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
}

export default function RankingRow({ entry, expanded, onToggle, masterData, assetSource }: RankingRowProps) {
    const leaderCard = entry.leaderCardId
        ? masterData.cards.find((card) => card.id === entry.leaderCardId)
        : undefined;

    const derivedLeaderCharacterId = entry.leaderCharacterId ?? leaderCard?.characterId;
    const hasDetails = Boolean(entry.signature || entry.honors.length > 0 || leaderCard || derivedLeaderCharacterId);
    const isTopThree = entry.rank <= 3;
    const isExtendedTier = entry.rank > 100;

    const topThreeCardDecorations: Record<number, string> = {
        1: "ring-2 ring-amber-300/70 shadow-[0_0_24px_rgba(251,191,36,0.25)] dark:ring-amber-400/70 dark:shadow-[0_0_28px_rgba(251,191,36,0.18)]",
        2: "ring-2 ring-slate-300/80 shadow-[0_0_20px_rgba(148,163,184,0.2)] dark:ring-slate-400/70 dark:shadow-[0_0_24px_rgba(148,163,184,0.16)]",
        3: "ring-2 ring-orange-300/70 shadow-[0_0_20px_rgba(251,146,60,0.2)] dark:ring-orange-400/70 dark:shadow-[0_0_24px_rgba(251,146,60,0.16)]",
    };

    const topThreeBadgeStyles: Record<number, string> = {
        1: "border border-amber-200 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-amber-950 dark:border-amber-400/40 dark:bg-gradient-to-r dark:from-amber-500 dark:via-yellow-400 dark:to-amber-500 dark:text-amber-950",
        2: "border border-slate-200 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 text-slate-700 dark:border-slate-300/50 dark:bg-gradient-to-r dark:from-slate-500 dark:via-slate-400 dark:to-slate-600 dark:text-white dark:shadow-[0_0_16px_rgba(226,232,240,0.16)]",
        3: "border border-orange-200 bg-gradient-to-r from-orange-200 via-amber-100 to-orange-300 text-orange-800 dark:border-orange-400/40 dark:bg-gradient-to-r dark:from-orange-500 dark:via-amber-500 dark:to-orange-600 dark:text-orange-950",
    };

    const rowToneClass = isExtendedTier
        ? "border-slate-200/80 bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-900/70"
        : entry.isNewEntry
            ? "border-sky-200 bg-sky-50/60 dark:border-sky-500/40 dark:bg-sky-950/20"
            : entry.rankDelta > 0
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-950/20"
                : entry.rankDelta < 0
                    ? "border-rose-200 bg-rose-50/50 dark:border-rose-500/40 dark:bg-rose-950/20"
                    : "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70";

    return (
        <motion.div
            layout
            initial={entry.isNewEntry ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={`rounded-2xl border ${rowToneClass} backdrop-blur-sm shadow-sm`}
        >
            <button
                onClick={onToggle}
                className="flex w-full items-start gap-3 p-4 text-left"
            >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="w-14 shrink-0 text-center sm:w-16">
                        <div className={`mx-auto inline-flex min-w-[3.25rem] items-center justify-center rounded-2xl px-3 py-2 text-lg font-black shadow-sm ${isTopThree ? topThreeBadgeStyles[entry.rank] : "border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"}`}>
                            #{entry.rank}
                        </div>
                        {isExtendedTier && (
                            <div className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">扩展榜线</div>
                        )}
                    </div>

                    <div className="relative w-20 shrink-0">
                        {leaderCard ? (
                            <div className={`overflow-hidden shadow-sm ${isTopThree ? topThreeCardDecorations[entry.rank] : ""}`}>
                                <SekaiCardThumbnail card={leaderCard} width={80} className="w-full" />
                            </div>
                        ) : derivedLeaderCharacterId ? (
                            <div className={`relative h-20 w-20 overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${isTopThree ? topThreeCardDecorations[entry.rank] : ""}`}>
                                <Image src={getCharacterIconUrl(derivedLeaderCharacterId)} alt={CHARACTER_NAMES[derivedLeaderCharacterId] || "角色头像"} fill className="object-cover" unoptimized />
                            </div>
                        ) : (
                            <div className="flex h-20 w-20 flex-col items-center justify-center bg-slate-100 px-3 py-2 dark:bg-slate-800/80">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Rank</span>
                                <span className="text-xl font-black text-primary-text">#{entry.rank}</span>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-base font-bold text-primary-text sm:text-lg">{entry.displayName}</h3>
                                </div>
                                <div className="mt-2 max-w-full overflow-hidden">
                                    <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} />
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-2 lg:items-end">
                                <div className="text-left lg:text-right">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Score</div>
                                    <div className="text-2xl font-black leading-none text-primary-text sm:text-3xl lg:text-4xl">
                                        {entry.score.toLocaleString()}<span className="ml-1 text-sm font-bold text-slate-400 dark:text-slate-500 sm:text-base">PT</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    <RankChangeBadge rankDelta={entry.rankDelta} isNewEntry={entry.isNewEntry} />
                                    <ScoreChangeBadge scoreDelta={entry.scoreDelta} />
                                    {hasDetails && (
                                        <span className="rounded-full bg-miku/10 px-2 py-1 text-[11px] font-bold text-miku dark:bg-miku/20 dark:text-cyan-300">
                                            {expanded ? "收起详情" : "展开详情"}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {expanded && hasDetails && (
                    <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                    >
                        <div className="space-y-4 p-4">
                            <div>
                                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">个性签名</div>
                                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                                    {entry.signature || "该用户未公开个性签名"}
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">徽章 / 称号</div>
                                <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
