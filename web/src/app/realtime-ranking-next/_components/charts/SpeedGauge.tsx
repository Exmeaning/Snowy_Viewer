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

// Single values rather than light/dark pairs: each of these clears 3:1 against
// both the light and the dark readout surface, so the stat colors no longer
// depend on a dark: variant — which in this app resolves from the OS preference
// rather than from the theme switch.
const accentClass: Record<NonNullable<StatCardProps["accent"]>, string> = {
    miku: "text-miku",
    sky: "text-sky-600",
    emerald: "text-emerald-600",
    rose: "text-rose-500",
    slate: "text-[var(--hh-text-primary)]",
};

function StatCard({ label, value, accent = "slate", trend }: StatCardProps) {
    const trendIcon = trend === "up" ? "▲" : trend === "down" ? "▼" : null;
    const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-500" : "text-[var(--hh-text-tertiary)]";
    return (
        // A sunken readout block inside the enclosing tile: the previous
        // `bg-white/60` relied on translucency for its separation, which the
        // flat system expresses as a value step instead.
        <div className="hh-well px-3 py-2.5">
            <div className="hh-label">{label}</div>
            <div className={`hh-numeric mt-0.5 flex items-baseline gap-1 text-lg font-bold ${accentClass[accent]}`}>
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
            <div className="rounded-[var(--hh-radius-md)] border border-dashed border-[var(--hh-border)] px-3 py-6 text-center text-xs text-[var(--hh-text-tertiary)]">
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
