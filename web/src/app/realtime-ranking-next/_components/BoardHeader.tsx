"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import {
    RealtimeRankingRegion,
    REALTIME_RANKING_REGION_OPTIONS,
} from "@/types/realtime-ranking-next";
import {
    getAvailableLines,
    getEffectiveLine,
    RealtimeRankingLine,
} from "@/lib/realtime-ranking-line";

interface BoardHeaderProps {
    region: RealtimeRankingRegion;
    onRegionChange: (region: RealtimeRankingRegion) => void;
    line: RealtimeRankingLine;
    onLineChange: (line: RealtimeRankingLine) => void;
    updatedAt?: number;
    eventId?: number;
    totalEntries: number;
    countdown: number;
    isRefreshing: boolean;
    onRefresh: () => void;
    showChurn: boolean;
    onShowChurnChange: (value: boolean) => void;
}

const REGION_SHORT_NAMES: Record<RealtimeRankingRegion, string> = {
    cn: "CN",
    jp: "JP",
    tw: "TW",
    kr: "KR",
    en: "EN",
};

export default function BoardHeader({
    region,
    onRegionChange,
    line,
    onLineChange,
    updatedAt,
    eventId,
    totalEntries,
    countdown,
    isRefreshing,
    onRefresh,
    showChurn,
    onShowChurnChange,
}: BoardHeaderProps) {
    const { t, formatNumber } = useI18n();

    const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";

    const availableLines = getAvailableLines(region);
    const effectiveLine = getEffectiveLine(line, region);

    return (
        <div className="mb-6 space-y-4">
            {/* Title Header */}
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-primary-text sm:text-3xl">
                        {t("page.realtimeRankingNext.title")}
                    </h1>
                    <span className="rounded-full bg-miku/15 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-miku">
                        v2 Next
                    </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t("page.realtimeRankingNext.subtitle")}
                </p>
            </div>

            {/* Controls Bar: Server (Region), Line, Churn toggle */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Server (Region) Selector */}
                <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200/60 bg-white/70 p-1 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                    {REALTIME_RANKING_REGION_OPTIONS.map((r) => {
                        const isSelected = region === r;
                        const regionText = t(`page.realtimeRanking.regions.${r}`);
                        return (
                            <button
                                key={r}
                                onClick={() => onRegionChange(r)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all whitespace-nowrap ${
                                    isSelected
                                        ? "bg-miku text-white shadow-sm shadow-miku/25"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
                                }`}
                                title={regionText}
                            >
                                <span className="uppercase">{REGION_SHORT_NAMES[r]}</span>
                                <span className="hidden text-[10px] font-semibold opacity-85 sm:inline">
                                    {regionText}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Line / Route Selector */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {t("page.realtimeRanking.line.label")}
                    </span>
                    <div className="flex max-w-full overflow-x-auto rounded-xl border border-slate-200/60 bg-white/70 p-1 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/70">
                        {availableLines.map((l) => {
                            const isSelected = effectiveLine === l;
                            return (
                                <button
                                    key={l}
                                    onClick={() => onLineChange(l)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all whitespace-nowrap ${
                                        isSelected
                                            ? "bg-miku text-white shadow-sm shadow-miku/25"
                                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
                                    }`}
                                >
                                    {t(`page.realtimeRanking.line.${l}`)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Churn & Speed Toggle Button */}
                <button
                    onClick={() => onShowChurnChange(!showChurn)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap active:scale-[0.98] ${
                        showChurn
                            ? "border-miku bg-miku text-white shadow-sm shadow-miku/25"
                            : "border-slate-200/60 bg-white/70 text-slate-600 hover:border-miku/40 hover:text-miku dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300"
                    }`}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        className={`h-3.5 w-3.5 ${showChurn ? "text-white" : "text-miku"}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{t("page.realtimeRanking.showChurn")}</span>
                    <div
                        className={`ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${
                            showChurn
                                ? "border-white bg-white"
                                : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                        }`}
                    >
                        {showChurn && (
                            <svg className="h-2 w-2 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4.5} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                </button>
            </div>

            {/* Status Bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200/40 bg-white/40 px-3.5 py-2 text-xs text-slate-500 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-400">
                {eventId != null && (
                    <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-slate-400 dark:text-slate-500">{t("page.realtimeRankingNext.eventId")}</span>
                        <span className="font-black text-primary-text">#{eventId}</span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-slate-400 dark:text-slate-500">{t("page.realtimeRankingNext.totalEntries")}</span>
                    <span className="font-black text-primary-text">{formatNumber(totalEntries)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-slate-400 dark:text-slate-500">{t("page.realtimeRankingNext.updatedAt")}</span>
                    <span className="font-black text-primary-text tabular-nums">{updatedLabel}</span>
                </span>

                <div className="ml-auto flex items-center gap-2">
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                            isRefreshing
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                        }`}
                    >
                        {isRefreshing ? t("page.realtimeRanking.refreshing") : t("page.realtimeRanking.synced")}
                    </span>

                    <button
                        onClick={onRefresh}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-miku px-3 py-1 text-[11px] font-black text-white shadow-sm shadow-miku/25 transition-all hover:bg-miku-dark active:scale-95"
                    >
                        {isRefreshing ? (
                            <motion.span
                                animate={{ opacity: [1, 0.4, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                            >
                                {t("page.realtimeRankingNext.refreshing")}
                            </motion.span>
                        ) : (
                            <>
                                <span>{t("page.realtimeRankingNext.refresh")}</span>
                                <span className="tabular-nums opacity-85">{countdown}s</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
