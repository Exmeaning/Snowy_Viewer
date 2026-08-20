"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import RankChangeBadge from "@/components/realtime-ranking/RankChangeBadge";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { getCharacterIconUrl } from "@/lib/assets";
import { RealtimeRankingEntryWithDiff, RealtimeRankingMasterData, ChurnRankingEntry } from "@/types/realtime-ranking";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface RankingRowProps {
    entry: RealtimeRankingEntryWithDiff;
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
    secondsSinceUpdate?: number;
    showChurn: boolean;
    churnEntry?: ChurnRankingEntry;
    churnData: Map<string, ChurnRankingEntry>;
    onShowParkingPeriods: (userId: string) => void;
    isTracked?: boolean;
    onTrackToggle?: (userId: string) => void;
    /** True when this row's data was carried over from a previous snapshot (syncing). */
    isStale?: boolean;
}

type RealtimeRankingTranslationFn = ReturnType<typeof useI18n>["t"];

function formatElapsed(seconds: number, t: RealtimeRankingTranslationFn): string {
    if (seconds < 0) return t("page.realtimeRanking.churn.elapsedNow");
    if (seconds < 60) return t("page.realtimeRanking.churn.elapsedSeconds", { seconds });
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) {
        return s > 0
            ? t("page.realtimeRanking.churn.elapsedMinutesSeconds", { minutes: m, seconds: s })
            : t("page.realtimeRanking.churn.elapsedMinutes", { minutes: m });
    }
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0
        ? t("page.realtimeRanking.churn.elapsedHoursMinutes", { hours: h, minutes: rm })
        : t("page.realtimeRanking.churn.elapsedHours", { hours: h });
}

/** Get the ISO key for the current hour. */
function getCurrentHourKey(): string {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Get the churn count for the current hour. */
function getCurrentHourChurn(churnEntry?: ChurnRankingEntry): number {
    if (!churnEntry) return 0;
    const hourKey = getCurrentHourKey();
    const found = churnEntry.hourly_churn.find((h) => h.hour === hourKey);
    return found?.count ?? 0;
}

export default function RankingRow({ entry, masterData, assetSource, secondsSinceUpdate, showChurn, churnEntry, churnData, onShowParkingPeriods, isTracked = false, onTrackToggle, isStale = false }: RankingRowProps) {
    const { t, formatNumber } = useI18n();
    const leaderCard = entry.leaderCardId
        ? masterData.cards.find((card) => card.id === entry.leaderCardId)
        : undefined;

    const derivedLeaderCharacterId = entry.leaderCharacterId ?? leaderCard?.characterId;
    const isTrained = entry.leaderCardDefaultImage === "special_training";
    const masterRank = entry.leaderCardMasterRank ?? 0;
    const isTopThree = entry.rank <= 3;
    const isExtendedTier = entry.rank > 100;
    const isTierLineEntry = isExtendedTier && !!churnEntry?.isTierLine;
    // Outside TOP100, real player rows show churn details while tier-line rows show tier-line speed.
    const canShowChurnDetails = !isExtendedTier && churnEntry != null;
    const canShowTierLine = isTierLineEntry;

    // Live countdown for lastChangedAt.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // Stock-style flash triggered by actual score changes.
    const [flashType, setFlashType] = useState<"up" | "down" | null>(null);
    const prevScoreRef = useRef(entry.score);

    // Per-row expansion when the global churn panel is closed.
    const [localExpanded, setLocalExpanded] = useState(false);
    const showChurnRow = canShowChurnDetails && (showChurn || localExpanded);
    const showTierLineRow = canShowTierLine && (showChurn || localExpanded);

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

    // --- Fix 1: use churn last_change to show the delta on first entry. ---
    const churnLastChange = churnEntry?.last_change;
    const hasChurnData = !!churnLastChange;

    const hasCurrentChange = entry.scoreDelta !== 0;

    let displayScoreDelta: number;
    let displayRankDelta: number;
    let displayElapsed: number | undefined;

    if (hasCurrentChange) {
        // Prefer live data when there is a current change.
        displayScoreDelta = entry.scoreDelta;
        displayRankDelta = entry.rankDelta;
        displayElapsed = secondsSinceUpdate ?? 0;
    } else if (entry.lastScoreDelta != null && entry.lastScoreDelta !== 0) {
        // Change recorded in a previous polling cycle.
        displayScoreDelta = entry.lastScoreDelta;
        displayRankDelta = entry.lastRankDelta ?? entry.rankDelta;
        displayElapsed = entry.lastChangedAt ? Math.floor((now - entry.lastChangedAt) / 1000) : undefined;
    } else if (entry.isNewEntry && churnLastChange) {
        // First load with churn data: use churn.last_change.
        displayScoreDelta = churnLastChange.delta;
        displayRankDelta = 0; // Churn has no rank movement data.
        // Timestamp compatibility: seconds vs milliseconds.
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

    // --- Fix 3: latest 1H churn bubble. ---
    const currentHourChurn = canShowChurnDetails ? getCurrentHourChurn(churnEntry) : 0;

    const topThreeCardDeco: Record<number, string> = {
        1: "ring-1 ring-amber-400/70",
        2: "ring-1 ring-[var(--hh-border-strong)]",
        3: "ring-1 ring-orange-400/70",
    };

    // Medal chips are solid fills, not three-stop gradients: a gradient badge
    // reads as web decoration, while the flat system vocabulary gets its
    // hierarchy from one saturated value. A dark on-color text pair also means
    // one class list is legible under both themes, with no dark: variant — and
    // in this app dark: resolves from the OS preference rather than the theme
    // switch, so anything that relies on it is only accidentally correct.
    const topThreeBadge: Record<number, string> = {
        1: "border-amber-500 bg-amber-400 text-amber-950",
        2: "border-[var(--hh-border-strong)] bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)]",
        3: "border-orange-500 bg-orange-400 text-orange-950",
    };

    // Movement tints stay translucent so they layer over the row's own surface
    // instead of replacing it; the tier-line rows step down to the sunken
    // surface because they are data points rather than players.
    const rowBg = entry.isNewEntry
        ? "bg-sky-500/[0.08]"
        : entry.scoreDelta > 0
            ? "bg-emerald-500/[0.07]"
            : entry.scoreDelta < 0
                ? "bg-rose-500/[0.07]"
                : isExtendedTier
                    ? "bg-[var(--hh-surface-1)]"
                    : entry.rankDelta > 0
                        ? "bg-emerald-500/[0.07]"
                        : entry.rankDelta < 0
                            ? "bg-rose-500/[0.07]"
                            : "";

    // Score color reflects movement when a change exists. Single values rather
    // than light/dark pairs: emerald-600 and rose-500 both clear 3:1 against
    // the light and the dark row surface, so the number stays legible without
    // depending on a variant this app cannot key to its own theme switch.
    const scoreColorClass = hasCurrentChange
        ? entry.scoreDelta > 0
            ? "text-emerald-600"
            : "text-rose-500"
        : "text-[var(--hh-text-primary)]";

    const trackedClasses = isTracked
        ? "ring-2 ring-miku z-20 rounded-[var(--hh-radius-lg)]"
        : "";

    return (
        <motion.div
            layout
            data-rank={entry.rank}
            initial={entry.isNewEntry ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`relative overflow-hidden transition-all duration-300 ${rowBg} ${trackedClasses} ${isStale ? "opacity-60" : ""}`}
        >
            {/* Stock-style background flash */}
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
                {/* Rank # */}
                <div className="w-10 shrink-0 text-center sm:w-12">
                    <span className={`hh-numeric inline-flex items-center justify-center rounded-[var(--hh-radius-sm)] border px-1.5 py-0.5 text-[11px] font-bold leading-none ${isTopThree ? topThreeBadge[entry.rank] : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)]"}`}>
                        #{entry.rank}
                    </span>
                    {isExtendedTier && (
                        <div className="mt-0.5 text-[8px] font-medium text-[var(--hh-text-tertiary)]">{t("page.realtimeRanking.list.extended")}</div>
                    )}
                    {isStale && (
                        <div className="mt-0.5 inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] bg-amber-500/15 px-1 py-0.5 text-[7px] font-bold text-amber-600" title={t("page.realtimeRanking.list.staleTitle")}>
                            <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" />
                            {t("page.realtimeRanking.list.stale")}
                        </div>
                    )}
                    {/* Expand/collapse button, shown under the rank column on all viewports. */}
                    {(canShowChurnDetails || canShowTierLine) && !showChurn && (
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                            {/* Mobile: also show the 1H bubble in the rank column. */}
                            {currentHourChurn > 0 && (
                                <span
                                    className="hh-numeric sm:hidden inline-flex items-center justify-center rounded-[var(--hh-radius-sm)] bg-miku/15 px-1.5 py-0.5 text-[9px] font-bold text-miku"
                                    title={t("page.realtimeRanking.list.currentHourChurnTitle")}
                                >
                                    {currentHourChurn}
                                </span>
                            )}
                            <button
                                onClick={() => setLocalExpanded((v) => !v)}
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
                            <SekaiCardThumbnail card={leaderCard} trained={isTrained} mastery={masterRank} width={72} className="w-full" />
                        </div>
                    ) : derivedLeaderCharacterId ? (
                        <div className={`relative h-16 w-16 overflow-hidden border border-[var(--hh-border)] bg-[var(--hh-surface-2)] sm:h-[72px] sm:w-[72px] ${isTopThree ? topThreeCardDeco[entry.rank] : ""}`}>
                            <Image src={getCharacterIconUrl(derivedLeaderCharacterId)} alt={getCharacterName(t, derivedLeaderCharacterId)} fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center bg-[var(--hh-surface-sunken)] sm:h-[72px] sm:w-[72px]">
                            <span className="hh-numeric text-xs font-bold text-[var(--hh-text-tertiary)]">#{entry.rank}</span>
                        </div>
                    )}
                </div>

                {/* Player info: name + signature + honors */}
                <div className="ml-3 min-w-0 flex-1 overflow-hidden">
                    {/* Name + signature: horizontal scroll on mobile, normal truncation on desktop. */}
                    <div className="relative">
                        <div
                            className="flex items-baseline gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden sm:overflow-visible"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                        >
                            <h3 className="hh-title shrink-0 text-sm font-semibold text-[var(--hh-text-primary)] sm:shrink sm:truncate flex items-center gap-1.5">
                                <span className="truncate">{entry.displayName}</span>
                                {!isExtendedTier && onTrackToggle && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onTrackToggle(entry.userId);
                                        }}
                                        className={`hh-press hh-focusable inline-flex items-center justify-center p-0.5 rounded-[var(--hh-radius-sm)] hover:bg-miku/15 ${
                                            isTracked
                                                ? "text-miku"
                                                : "text-[var(--hh-text-tertiary)] hover:text-miku"
                                        }`}
                                        title={isTracked ? t("page.realtimeRanking.untrackPlayer") : t("page.realtimeRanking.trackPlayer")}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2.8}
                                            className="w-3.5 h-3.5"
                                        >
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
                    <div className="mt-1 max-w-full overflow-hidden">
                        <PlayerHonorPreview honors={entry.honors} masterData={masterData} assetSource={assetSource} compact />
                    </div>
                </div>

                {/* Score column — stock-style feedback */}
                <div className="w-32 shrink-0 text-right sm:w-40">
                    {/* Score body: movement color plus bounce animation. Tabular digits
                        keep the column's right edge from shifting as scores tick up. */}
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

                    {/* Movement detail row */}
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
                                    className={`hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] px-1 py-0.5 text-[9px] font-bold ${
                                        displayScoreDelta > 0
                                            ? "bg-emerald-500/15 text-emerald-700"
                                            : "bg-rose-500/15 text-rose-700"
                                    }`}
                                >
                                    <span className="text-[8px]">{displayScoreDelta > 0 ? "▲" : "▼"}</span>
                                    <span>{displayScoreDelta > 0 ? "+" : ""}{formatNumber(displayScoreDelta)}</span>
                                    {typeof displayElapsed === "number" && (
                                        <span className="ml-0.5 font-medium opacity-60">{formatElapsed(displayElapsed, t)}</span>
                                    )}
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="no-delta"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-[9px] text-[var(--hh-text-tertiary)]"
                                >
                                    —
                                </motion.span>
                            )}
                        </AnimatePresence>

                        {/* Desktop: place the 1H bubble next to the score row when there is room. */}
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
                        <ChurnRow churnEntry={churnEntry} userId={entry.userId} rank={entry.rank} churnData={churnData} onShowParkingPeriods={onShowParkingPeriods} />
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

/** Expand hourly_churn into 48 hours, with the newest hour on the left. */
function buildHourlyGridReversed(hourlyChurn: { hour: string; count: number }[]): { hour: number; count: number; isCurrentHour: boolean; localLabel: string }[] {
    const currentHourKey = getCurrentHourKey();
    const now = new Date();

    // Build a map for efficient lookup.
    const churnMap = new Map<string, number>();
    for (const h of hourlyChurn) {
        churnMap.set(h.hour, h.count);
    }

    // Start from the current hour and list 48 hours in reverse order.
    const grid: { hour: number; count: number; isCurrentHour: boolean; localLabel: string }[] = [];

    for (let i = 0; i < 48; i++) {
        const t = new Date(now);
        t.setUTCHours(t.getUTCHours() - i);
        t.setUTCMinutes(0, 0, 0);
        const key = t.toISOString().replace(/\.\d{3}Z$/, "Z");
        // Display local hour numbers.
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

/** Return the background color class based on count. */
function getChurnCellColor(count: number, isCurrentHour: boolean): string {
    if (count === 0) return "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-tertiary)]";
    if (isCurrentHour) return "bg-sky-500/20 text-sky-700";
    // Darken the color as count increases. Alpha tints rather than palette
    // steps, so one class list works on both the light and the dark surface.
    if (count >= 30) return "bg-rose-500/45 text-rose-950";
    if (count >= 20) return "bg-rose-500/32 text-rose-900";
    if (count >= 10) return "bg-rose-500/20 text-rose-800";
    return "bg-rose-500/12 text-rose-700";
}

/** Calculate neighboring tier ranks from the current rank. */
function getTierRanks(rank: number): [number | null, number | null] {
    if (rank <= 10) {
        return [rank > 1 ? rank - 1 : null, rank < 10 ? rank + 1 : null];
    }
    const lower = Math.floor((rank - 1) / 10) * 10;
    const upper = Math.ceil((rank + 1) / 10) * 10;
    return [lower > 0 ? lower : null, upper <= 100 ? upper : null];
}

/** Calculate total growth within the latest N minutes from recent_score_changes. */
function calcRecentGrowth(recentChanges: { time: number; delta: number }[], minutes: number): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return recentChanges
        .filter((c) => c.time >= cutoff && c.delta > 0)
        .reduce((acc, c) => acc + c.delta, 0);
}

/** Calculate churn count within the latest N minutes from recent_score_changes. */
function calcRecentChurnCount(recentChanges: { time: number; delta: number }[], minutes: number): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return recentChanges.filter((c) => c.time >= cutoff && c.delta > 0).length;
}

/** Format score speed in k units. */
function fmtSpeed(value: number): string {
    return `${Math.round(value / 1000)}k`;
}

/** Speed trend: compare latest 20min×3 with latest 1h to detect acceleration, slowdown, or flat movement. */
function getSpeedTrend(speed1h: number, speed20min3: number): "up" | "down" | "flat" {
    if (speed1h === 0 && speed20min3 === 0) return "flat";
    const ratio = speed1h > 0 ? speed20min3 / speed1h : speed20min3 > 0 ? Infinity : 1;
    if (ratio > 1.08) return "up";
    if (ratio < 0.92) return "down";
    return "flat";
}

function ChurnRow({ churnEntry, userId, rank, churnData, onShowParkingPeriods }: {
    churnEntry: ChurnRankingEntry;
    userId: string;
    rank: number;
    churnData: Map<string, ChurnRankingEntry>;
    onShowParkingPeriods: (userId: string) => void;
}) {
    const { t } = useI18n();
    const grid = buildHourlyGridReversed(churnEntry.hourly_churn);
    const row1 = grid.slice(0, 24);
    const row2 = grid.slice(24, 48);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }, []);

    // Churn counts.
    const recentChanges = churnEntry.recent_score_changes ?? [];
    const churn1h = calcRecentChurnCount(recentChanges, 60);
    const churn20min = calcRecentChurnCount(recentChanges, 20);

    // Score speeds.
    const speed1h = churnEntry.growth_1h;
    const speed20min3 = calcRecentGrowth(recentChanges, 20) * 3;
    const trend = getSpeedTrend(speed1h, speed20min3);

    // Neighbor tiers.
    const [lowerRank, upperRank] = getTierRanks(rank);
    const findByRank = (r: number | null): ChurnRankingEntry | undefined => {
        if (r == null || r <= 0) return undefined;
        for (const e of churnData.values()) {
            if (e.rank === r) return e;
        }
        return undefined;
    };
    const lowerEntry = findByRank(lowerRank);
    const upperEntry = findByRank(upperRank);

    const trendIcon = trend === "up"
        ? <span className="text-emerald-600 font-bold">▲</span>
        : trend === "down"
            ? <span className="text-rose-500 font-bold">▼</span>
            : <span className="text-[var(--hh-text-tertiary)]">—</span>;

    return (
        <div className="border-t border-[var(--hh-border-hairline)] px-3 pb-2.5 pt-1.5">
            {/* Churn grid row */}
            <div className="flex items-center gap-2">
                {/* 48H total */}
                <div className="shrink-0 text-center w-10 sm:w-12">
                    <span className="hh-label text-[10px]">48H</span>
                    <div className="hh-numeric text-xs font-bold text-miku">{churnEntry.churn_48h}</div>
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
                    onClick={() => onShowParkingPeriods(userId)}
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

                {/* Neighbor-tier speed comparison with independent bubbles. */}
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

/** Tier-line speed row for rank > 100 data points without real player information. */
function TierLineChurnRow({ churnEntry }: { churnEntry: ChurnRankingEntry }) {
    const { t } = useI18n();
    const recentChanges = churnEntry.recent_score_changes ?? [];
    const speed1h = churnEntry.growth_1h;
    const speed20min3 = calcRecentGrowth(recentChanges, 20) * 3;
    const trend = getSpeedTrend(speed1h, speed20min3);
    const activityCount = churnEntry.recent_activity?.count ?? 0;

    const trendIcon = trend === "up"
        ? <span className="text-emerald-600 font-bold">▲</span>
        : trend === "down"
            ? <span className="text-rose-500 font-bold">▼</span>
            : <span className="text-[var(--hh-text-tertiary)]">—</span>;

    return (
        <div className="border-t border-[var(--hh-border-hairline)] px-3 pb-2.5 pt-1.5">
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

                    {activityCount > 0 && (
                        <>
                            <span className="shrink-0 text-[var(--hh-text-tertiary)] select-none px-0.5">·</span>
                            {/* Recent sample count */}
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] bg-sky-500/12 px-1.5 py-0.5 text-[10px]">
                                <span className="font-medium text-[var(--hh-text-secondary)]">{t("page.realtimeRanking.churn.recentSamples")}</span>
                                <span className="hh-numeric font-bold text-sky-600">{activityCount}</span>
                            </span>
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
