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
}

const REGION_LABELS: Record<RealtimeRankingRegion, string> = {
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
}: BoardHeaderProps) {
    const { t, formatNumber } = useI18n();

    const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "—";

    const availableLines = getAvailableLines(region);
    const effectiveLine = getEffectiveLine(line, region);

    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-primary-text sm:text-3xl">
                            {t("page.realtimeRankingNext.title")}
                        </h1>
                        <span className="rounded-full bg-miku/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-miku">
                            beta
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t("page.realtimeRankingNext.subtitle")}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    {/* Region selector */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {REALTIME_RANKING_REGION_OPTIONS.map((r) => (
                            <button
                                key={r}
                                onClick={() => onRegionChange(r)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                                    region === r
                                        ? "bg-miku text-white shadow-sm shadow-miku/20"
                                        : "border border-slate-200 bg-white text-slate-500 hover:border-miku/40 hover:text-miku dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                            >
                                {REGION_LABELS[r]}
                            </button>
                        ))}
                    </div>

                    {/* Data line selector */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {t("page.realtimeRankingNext.line.label")}
                        </span>
                        {availableLines.map((l) => (
                            <button
                                key={l}
                                onClick={() => onLineChange(l)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                                    effectiveLine === l
                                        ? "bg-miku text-white shadow-sm shadow-miku/20"
                                        : "border border-slate-200 bg-white text-slate-500 hover:border-miku/40 hover:text-miku dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                            >
                                {t(`page.realtimeRankingNext.line.${l}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                {eventId != null && (
                    <span className="inline-flex items-center gap-1">
                        <span className="font-medium">{t("page.realtimeRankingNext.eventId")}</span>
                        <span className="font-black text-primary-text">#{eventId}</span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1">
                    <span className="font-medium">{t("page.realtimeRankingNext.totalEntries")}</span>
                    <span className="font-black text-primary-text">{formatNumber(totalEntries)}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="font-medium">{t("page.realtimeRankingNext.updatedAt")}</span>
                    <span className="font-black text-primary-text tabular-nums">{updatedLabel}</span>
                </span>
                <button
                    onClick={onRefresh}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-miku px-3 py-1 text-[11px] font-black text-white shadow-sm shadow-miku/25 transition-colors hover:bg-miku-dark"
                >
                    {isRefreshing ? (
                        <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                            {t("page.realtimeRankingNext.refreshing")}
                        </motion.span>
                    ) : (
                        <>
                            <span>{t("page.realtimeRankingNext.refresh")}</span>
                            <span className="tabular-nums opacity-80">{countdown}s</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
