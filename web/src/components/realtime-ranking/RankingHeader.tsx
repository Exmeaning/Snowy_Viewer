"use client";

import { useI18n } from "@/contexts/I18nContext";
import { REALTIME_RANKING_REGION_OPTIONS, RealtimeRankingRegion } from "@/types/realtime-ranking";

interface RankingHeaderProps {
    region: RealtimeRankingRegion;
    onRegionChange: (region: RealtimeRankingRegion) => void;
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
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.realtimeRanking.title")} <span className="text-miku">{t("page.realtimeRanking.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.realtimeRanking.description")}
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 mb-8 items-center">
                {/* Region Toggle */}
                <div className="shrink-0 flex max-w-full overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
                    {REALTIME_RANKING_REGION_OPTIONS.map((value) => (
                        <button
                            key={value}
                            onClick={() => onRegionChange(value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${region === value
                                ? "bg-miku text-white shadow-md"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                }`}
                        >
                            {t(`page.realtimeRanking.regions.${value}`)}
                        </button>
                    ))}
                </div>

                {showChurnToggle && (
                    <button
                        onClick={() => onShowChurnChange(!showChurn)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all border whitespace-nowrap ${showChurn
                            ? "ring-2 ring-miku shadow-md bg-white border-transparent dark:bg-slate-800"
                            : "hover:bg-slate-50 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                            }`}
                    >
                        <span className={showChurn ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
                            {t("page.realtimeRanking.showChurn")}
                        </span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${showChurn ? "bg-miku border-miku" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700"}`}>
                            {showChurn && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                )}

                {/* Status Tags */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typeof eventId === "number" && (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap">
                            {t("page.realtimeRanking.eventId", { id: eventId })}
                        </span>
                    )}
                    {scopeLabel && (
                        <span className="rounded-full bg-miku/10 text-miku px-3 py-1.5 font-medium whitespace-nowrap dark:bg-miku/15">
                            {scopeLabel}
                        </span>
                    )}
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap">
                        {t("page.realtimeRanking.totalEntries", { count: formatNumber(totalEntries) })}
                    </span>
                    <span className={`rounded-full px-3 py-1.5 font-medium whitespace-nowrap ${isRefreshing
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        }`}>
                        {isRefreshing ? t("page.realtimeRanking.refreshing") : t("page.realtimeRanking.synced")}
                    </span>
                    {updatedAt ? (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 font-medium whitespace-nowrap">
                            {t("page.realtimeRanking.updatedAt", { time: formatDate(updatedAt) })}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );
}
