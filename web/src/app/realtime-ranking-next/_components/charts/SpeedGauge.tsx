"use client";

import { useI18n } from "@/contexts/I18nContext";
import { ChurnEntryV2 } from "@/types/realtime-ranking-next";
import { calcRecentGrowth, fmtSpeed, getSpeedTrend } from "../../_lib/board-utils";

interface SpeedGaugeProps {
    churnEntry?: ChurnEntryV2;
}

interface StatCardProps {
    label: string;
    value: string;
    accent?: "miku" | "sky" | "emerald" | "rose" | "slate";
    trend?: "up" | "down" | "flat";
}

const accentClass: Record<NonNullable<StatCardProps["accent"]>, string> = {
    miku: "text-miku",
    sky: "text-sky-600 dark:text-sky-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-500 dark:text-rose-400",
    slate: "text-slate-700 dark:text-slate-200",
};

function StatCard({ label, value, accent = "slate", trend }: StatCardProps) {
    const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : null;
    const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-slate-400";
    return (
        <div className="rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/50">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
            <div className={`mt-0.5 flex items-baseline gap-1 text-lg font-black tabular-nums ${accentClass[accent]}`}>
                <span>{value}</span>
                {trendIcon && <span className={`text-xs ${trendColor}`}>{trendIcon}</span>}
            </div>
        </div>
    );
}

export default function SpeedGauge({ churnEntry }: SpeedGaugeProps) {
    const { t } = useI18n();

    if (!churnEntry) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                {t("page.realtimeRankingNext.detail.noSpeedData")}
            </div>
        );
    }

    const changes = churnEntry.recent_score_changes ?? [];
    const speed1h = churnEntry.growth_1h ?? 0;
    const speed20min3 = calcRecentGrowth(changes, 20) * 3;
    const trend = getSpeedTrend(speed1h, speed20min3);

    const churn1h = churnEntry.churn_1h ?? 0;
    const churn20min3 = (churnEntry.churn_20min ?? 0) * 3;
    const churn48h = churnEntry.churn_48h ?? 0;

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard label={t("page.realtimeRankingNext.detail.speed1h")} value={fmtSpeed(speed1h)} accent="slate" trend={trend} />
            <StatCard label={t("page.realtimeRankingNext.detail.speed20min3")} value={fmtSpeed(speed20min3)} accent={trend === "up" ? "emerald" : trend === "down" ? "rose" : "slate"} />
            <StatCard label={t("page.realtimeRankingNext.detail.churn48h")} value={String(churn48h)} accent="miku" />
            <StatCard label={t("page.realtimeRankingNext.detail.churn1h")} value={String(churn1h)} accent="miku" />
            <StatCard label={t("page.realtimeRankingNext.detail.churn20min3")} value={String(churn20min3)} accent="sky" />
        </div>
    );
}
