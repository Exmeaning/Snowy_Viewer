"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { REALTIME_RANKING_REGION_OPTIONS, RealtimeRankingRegion } from "@/types/realtime-ranking";
import { REALTIME_RANKING_LINE_OPTIONS, RealtimeRankingLine } from "@/lib/realtime-ranking-line";

interface RankingHeaderProps {
    region: RealtimeRankingRegion;
    onRegionChange: (region: RealtimeRankingRegion) => void;
    line: RealtimeRankingLine;
    onLineChange: (line: RealtimeRankingLine) => void;
    updatedAt?: number;
    eventId?: number;
    scopeLabel?: string;
    totalEntries: number;
    isRefreshing: boolean;
    showChurn: boolean;
    onShowChurnChange: (value: boolean) => void;
    showChurnToggle?: boolean;
}

export default function RankingHeader({
    region,
    onRegionChange,
    line,
    onLineChange,
    updatedAt,
    eventId,
    scopeLabel,
    totalEntries,
    isRefreshing,
    showChurn,
    onShowChurnChange,
    showChurnToggle = true,
}: RankingHeaderProps) {
    const { t, formatDate, formatNumber } = useI18n();

    return (
        <>
            {/* Page Header - matching prediction page style */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.realtimeRanking.badge")}</span>
                    <span className="rounded-full bg-slate-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("page.realtimeRanking.legacyBadge")}
                    </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.realtimeRanking.title")} <span className="text-miku">{t("page.realtimeRanking.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.realtimeRanking.description")}
                </p>

                {/* Promote the redesigned (next) version */}
                <Link
                    href="/realtime-ranking-next"
                    className="group mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-miku/30 bg-gradient-to-r from-miku/10 via-sky-400/10 to-luka/10 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-miku/60 hover:shadow-sm hover:shadow-miku/20 dark:text-slate-300"
                >
                    <span aria-hidden className="text-base leading-none">✨</span>
                    <span className="truncate text-xs sm:text-sm">{t("page.realtimeRanking.tryNextText")}</span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-miku">
                        {t("page.realtimeRanking.tryNextCta")}
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                </Link>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 mb-8 items-center">
                {/* Region Toggle */}
                <div className="shrink-0 flex max-w-full overflow-x-auto ios-glass-card p-1 rounded-xl border border-slate-200/30 dark:border-slate-700/30">
                    {REALTIME_RANKING_REGION_OPTIONS.map((value) => (
                        <button
                            key={value}
                            onClick={() => onRegionChange(value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${region === value
                                ? "ios-glass-tab-active text-white shadow-sm"
                                : "ios-glass-tab text-slate-600 dark:text-slate-300 hover:bg-white/20"
                                }`}
                        >
                            {t(`page.realtimeRanking.regions.${value}`)}
                        </button>
                    ))}
                </div>

                {/* Data Line Toggle */}
                <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {t("page.realtimeRanking.line.label")}
                    </span>
                    <div className="flex max-w-full overflow-x-auto ios-glass-card p-1 rounded-xl border border-slate-200/30 dark:border-slate-700/30">
                        {REALTIME_RANKING_LINE_OPTIONS.map((value) => (
                            <button
                                key={value}
                                onClick={() => onLineChange(value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${line === value
                                    ? "ios-glass-tab-active text-white shadow-sm"
                                    : "ios-glass-tab text-slate-600 dark:text-slate-300 hover:bg-white/20"
                                    }`}
                            >
                                {t(`page.realtimeRanking.line.${value}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {showChurnToggle && (
                    <button
                        onClick={() => onShowChurnChange(!showChurn)}
                        className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap active:scale-[0.98] ${showChurn
                            ? "bg-miku text-white border-miku shadow-md shadow-miku/20"
                            : "ios-glass-btn text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                    >
                        <span className={showChurn ? "text-white" : "text-slate-600 dark:text-slate-300"}>
                            {t("page.realtimeRanking.showChurn")}
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${showChurn ? "bg-white border-white" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700"}`}>
                            {showChurn && (
                                <svg className="w-2.5 h-2.5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4.5} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                )}

                {/* Status Tags */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {typeof eventId === "number" && (
                        <span className="rounded-full bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap backdrop-blur-[2px]">
                            {t("page.realtimeRanking.eventId", { id: eventId })}
                        </span>
                    )}
                    {scopeLabel && (
                        <span className="rounded-full bg-miku/10 text-miku border border-miku/20 px-3 py-1.5 font-medium whitespace-nowrap dark:bg-miku/15 backdrop-blur-[2px]">
                            {scopeLabel}
                        </span>
                    )}
                    <span className="rounded-full bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap backdrop-blur-[2px]">
                        {t("page.realtimeRanking.totalEntries", { count: formatNumber(totalEntries) })}
                    </span>
                    <span className={`rounded-full px-3 py-1.5 font-medium whitespace-nowrap border backdrop-blur-[2px] ${isRefreshing
                        ? "bg-amber-100/70 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                        : "bg-emerald-100/70 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                        }`}>
                        {isRefreshing ? t("page.realtimeRanking.refreshing") : t("page.realtimeRanking.synced")}
                    </span>
                    {updatedAt ? (
                        <span className="rounded-full bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap backdrop-blur-[2px]">
                            {t("page.realtimeRanking.updatedAt", { time: formatDate(updatedAt) })}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );
}
