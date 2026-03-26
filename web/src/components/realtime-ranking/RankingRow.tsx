"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES } from "@/types/types";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData, ChurnRankingEntry } from "@/types/realtime-ranking";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingRowProps {
    entry: RealtimeRankingEntryWithDiff;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    secondsSinceUpdate?: number;
    showChurn: boolean;
    churnEntry?: ChurnRankingEntry;
    onShowParkingPeriods: (userId: string) => void;
}

function formatElapsed(seconds: number): string {
    if (seconds < 0) return "刚刚";
    if (seconds < 60) return `${seconds}s 前`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m${s > 0 ? `${s}s` : ""} 前`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h${rm > 0 ? `${rm}m` : ""} 前`;
}

/** 获取当前小时的 ISO key */
function getCurrentHourKey(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 获取近 1H 的周回数 */
function getCurrentHourChurn(churnEntry?: ChurnRankingEntry): number {
    if (!churnEntry) return 0;
    const hourKey = getCurrentHourKey();
    const found = churnEntry.hourly_churn.find((h) => h.hour === hourKey);
    return found?.count ?? 0;
}

export default function RankingRow({ entry, masterData, assetSource, secondsSinceUpdate, showChurn, churnEntry, onShowParkingPeriods }: RankingRowProps) {
    const leaderCard = entry.leaderCardId
        ? masterData.cards.find((card) => card.id === entry.leaderCardId)
        : undefined;

    const derivedLeaderCharacterId = entry.leaderCharacterId ?? leaderCard?.characterId;
    const isTrained = entry.leaderCardDefaultImage === "special_training";
    const masterRank = entry.leaderCardMasterRank ?? 0;
    const isTopThree = entry.rank <= 3;
    const isExtendedTier = entry.rank > 100;
    // TOP100 之外只保留“扩展”标识，不展示周回详情
    const canShowChurnDetails = !isExtendedTier && churnEntry != null;

    // 用于 lastChangedAt 的实时倒计时
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // 股票式闪烁：当分数发生实际变化时触发
    const [flashType, setFlashType] = useState<"up" | "down" | null>(null);
    const prevScoreRef = useRef(entry.score);

    // 单行展开状态（关闭全局周回面板时，允许手动展开某一行）
    const [localExpanded, setLocalExpanded] = useState(false);
    const showChurnRow = canShowChurnDetails && (showChurn || localExpanded);

    useEffect(() => {
        const nextFlashType = entry.scoreDelta === 0 ? null : entry.scoreDelta > 0 ? "up" : "down";
        const setTimer = window.setTimeout(() => setFlashType(nextFlashType), 0);
        const clearTimer = nextFlashType ? window.setTimeout(() => setFlashType(null), 1500) : undefined;

        return () => {
            window.clearTimeout(setTimer);
            if (clearTimer) window.clearTimeout(clearTimer);
        };
    }, [entry.score, entry.scoreDelta]);

    useEffect(() => {
        prevScoreRef.current = entry.score;
    }, [entry.score]);

    // --- Fix 1: 首次进入时利用 churn last_change 显示涨跌幅 ---
    const churnLastChange = churnEntry?.last_change;
    const hasChurnData = !!churnLastChange;

    const hasCurrentChange = entry.scoreDelta !== 0;

    let displayScoreDelta: number;
    let displayRankDelta: number;
    let displayElapsed: number | undefined;

    if (hasCurrentChange) {
        // 有实时变动，优先使用实时数据
        displayScoreDelta = entry.scoreDelta;
        displayRankDelta = entry.rankDelta;
        displayElapsed = secondsSinceUpdate ?? 0;
    } else if (entry.lastScoreDelta != null && entry.lastScoreDelta !== 0) {
        // 之前轮询中记录过的变动
        displayScoreDelta = entry.lastScoreDelta;
        displayRankDelta = entry.lastRankDelta ?? entry.rankDelta;
        displayElapsed = entry.lastChangedAt ? Math.floor((now - entry.lastChangedAt) / 1000) : undefined;
    } else if (entry.isNewEntry && churnLastChange) {
        // 首次加载且有 churn 数据 → 用 churn 的 last_change
        displayScoreDelta = churnLastChange.delta;
        displayRankDelta = 0; // churn 没有排名变化数据
        // 时间戳兼容：秒级 vs 毫秒级
        const churnTime = churnLastChange.time < 1e12
            ? churnLastChange.time * 1000
            : churnLastChange.time;
        displayElapsed = churnTime > 0
            ? Math.floor((now - churnTime) / 1000)
            : undefined;
    } else {
        displayScoreDelta = 0;
        displayRankDelta = entry.rankDelta;
        displayElapsed = undefined;
    }

    // --- Fix 3: 近 1H 周回数气泡 ---
    const currentHourChurn = canShowChurnDetails ? getCurrentHourChurn(churnEntry) : 0;

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
                    {/* 展开/收起按钮 — 全端显示在排名列下方 */}
                    {canShowChurnDetails && !showChurn && (
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                            {/* 移动端：1H 气泡也放在排名列 */}
                            {currentHourChurn > 0 && (
                                <span
                                    className="sm:hidden inline-flex items-center justify-center rounded-full bg-miku/15 px-1.5 py-0.5 text-[9px] font-black text-miku tabular-nums dark:bg-miku/20"
                                    title="近 1H 周回数"
                                >
                                    {currentHourChurn}
                                </span>
                            )}
                            <button
                                onClick={() => setLocalExpanded((v) => !v)}
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                                    localExpanded
                                        ? "bg-miku/10 text-miku"
                                        : "text-slate-300 hover:bg-miku/10 hover:text-miku dark:text-slate-600 dark:hover:text-miku"
                                }`}
                                title={localExpanded ? "收起周回" : "展开周回"}
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
                            <SekaiCardThumbnail card={leaderCard} trained={isTrained} mastery={masterRank} width={72} className="w-full" />
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
                        <RankChangeBadge rankDelta={displayRankDelta} isNewEntry={entry.isNewEntry} hasChurnData={hasChurnData} />
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

                        {/* PC 端：1H 气泡放在分数行右侧（有足够空间） */}
                        {canShowChurnDetails && !showChurn && currentHourChurn > 0 && (
                            <span
                                className="hidden sm:inline-flex items-center justify-center rounded-full bg-miku/15 px-1.5 py-0.5 text-[9px] font-black text-miku tabular-nums dark:bg-miku/20"
                                title="近 1H 周回数"
                            >
                                {currentHourChurn}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 周回数据展示行 */}
            <AnimatePresence>
                {showChurnRow && churnEntry && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="relative z-10 overflow-hidden"
                    >
                        <ChurnRow churnEntry={churnEntry} userId={entry.userId} onShowParkingPeriods={onShowParkingPeriods} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/** 将 hourly_churn 按 48 小时展开，最新时间在最左侧（反向排列） */
function buildHourlyGridReversed(hourlyChurn: { hour: string; count: number }[]): { hour: number; count: number; isCurrentHour: boolean; localLabel: string }[] {
    const currentHourKey = getCurrentHourKey();
    const now = new Date();

    // 构建一个 Map 方便查找
    const churnMap = new Map<string, number>();
    for (const h of hourlyChurn) {
        churnMap.set(h.hour, h.count);
    }

    // 从当前小时开始，倒序排列 48 个小时（index 0 = 当前小时，index 47 = 47小时前）
    const grid: { hour: number; count: number; isCurrentHour: boolean; localLabel: string }[] = [];

    for (let i = 0; i < 48; i++) {
        const t = new Date(now);
        t.setUTCHours(t.getUTCHours() - i);
        t.setUTCMinutes(0, 0, 0);
        const key = t.toISOString().replace(/\.\d{3}Z$/, "Z");
        // 使用本地小时数进行显示
        const localT = new Date(t);
        const hourNum = localT.getHours();
        const isCurrentHour = key === currentHourKey;

        grid.push({
            hour: hourNum,
            count: churnMap.get(key) ?? 0,
            isCurrentHour,
            localLabel: `${localT.getMonth() + 1}/${localT.getDate()} ${hourNum}:00`,
        });
    }

    return grid;
}

/** 根据 count 值返回背景色 class */
function getChurnCellColor(count: number, isCurrentHour: boolean): string {
    if (count === 0) return "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";
    if (isCurrentHour) return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
    // 根据 count 深浅渐变
    if (count >= 30) return "bg-rose-300 text-rose-900 dark:bg-rose-500/40 dark:text-rose-100";
    if (count >= 20) return "bg-rose-200 text-rose-800 dark:bg-rose-500/30 dark:text-rose-200";
    if (count >= 10) return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    return "bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400";
}

function ChurnRow({ churnEntry, userId, onShowParkingPeriods }: { churnEntry: ChurnRankingEntry; userId: string; onShowParkingPeriods: (userId: string) => void }) {
    const grid = buildHourlyGridReversed(churnEntry.hourly_churn);

    // grid[0] = 当前小时（1H），grid[1..23] = 前 1~23 小时 → 第一行
    // grid[24..47] = 前 24~47 小时 → 第二行
    const row1 = grid.slice(0, 24);
    const row2 = grid.slice(24, 48);

    // 自动滚动到最左侧（最新数据）— 已经是默认 scrollLeft=0
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = 0;
        }
    }, []);

    return (
        <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
            {/* 48H 总计 */}
            <div className="shrink-0 text-center w-10 sm:w-12">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">48H</span>
                <div className="text-xs font-black text-miku">{churnEntry.churn_48h}</div>
            </div>

            {/* 每小时网格 — 从右往左（最新在最左） */}
            <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto">
                {/* 小时标题行 */}
                <div className="flex gap-px mb-px">
                    {row1.map((cell, i) => (
                        <div key={`h-${i}`} className="flex-1 min-w-[22px] text-center text-[8px] font-medium text-slate-400 dark:text-slate-500">
                            {i === 0 ? "1H" : cell.hour}
                        </div>
                    ))}
                </div>
                {/* 第一行（近 0~23h） */}
                <div className="flex gap-px mb-px">
                    {row1.map((cell, i) => (
                        <div
                            key={`r1-${i}`}
                            className={`flex-1 min-w-[22px] text-center text-[9px] font-bold rounded-sm py-0.5 ${getChurnCellColor(cell.count, cell.isCurrentHour)}`}
                            title={cell.localLabel}
                        >
                            {cell.count > 0 ? `${cell.count}${cell.isCurrentHour ? "*" : ""}` : ""}
                        </div>
                    ))}
                </div>
                {/* 第二行（近 24~47h） */}
                <div className="flex gap-px">
                    {row2.map((cell, i) => (
                        <div
                            key={`r2-${i}`}
                            className={`flex-1 min-w-[22px] text-center text-[9px] font-bold rounded-sm py-0.5 ${getChurnCellColor(cell.count, cell.isCurrentHour)}`}
                            title={cell.localLabel}
                        >
                            {cell.count > 0 ? `${cell.count}${cell.isCurrentHour ? "*" : ""}` : ""}
                        </div>
                    ))}
                </div>
            </div>

            {/* 停车按钮 */}
            <button
                onClick={() => onShowParkingPeriods(userId)}
                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 transition-colors hover:border-miku/30 hover:bg-miku/5 hover:text-miku dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-miku/30 dark:hover:bg-miku/10 dark:hover:text-miku"
            >
                停车
            </button>
        </div>
    );
}
