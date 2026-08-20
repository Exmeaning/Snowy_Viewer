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
                    <h1 className="hh-display text-2xl text-[var(--hh-text-primary)] sm:text-3xl">
                        {t("page.realtimeRankingNext.title")}
                    </h1>
                    <span className="hh-label rounded-[var(--hh-radius-sm)] bg-miku/15 px-2.5 py-0.5 text-[11px] text-miku">
                        v2 Next
                    </span>
                </div>
                <p className="mt-1 text-xs text-[var(--hh-text-secondary)]">
                    {t("page.realtimeRankingNext.subtitle")}
                </p>
            </div>

            {/* Controls Bar: Server (Region), Line, Churn toggle.
                The three control troughs were `bg-white/70` + `backdrop-blur-sm`.
                With backdrop-filter neutralized globally, a 70% tint would have let
                the page gradient show through, so they are now the sunken trough of
                a segmented control — opaque, and the shape the system already uses
                for exactly this kind of mutually-exclusive choice. */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Server (Region) Selector */}
                <div className="hh-segment flex max-w-full overflow-x-auto">
                    {REALTIME_RANKING_REGION_OPTIONS.map((r) => {
                        const isSelected = region === r;
                        const regionText = t(`page.realtimeRanking.regions.${r}`);
                        return (
                            <button
                                key={r}
                                onClick={() => onRegionChange(r)}
                                data-selected={isSelected}
                                className="hh-segment-item hh-press flex items-center justify-center gap-1.5 whitespace-nowrap"
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
                    <span className="text-xs font-medium text-[var(--hh-text-tertiary)] whitespace-nowrap">
                        {t("page.realtimeRanking.line.label")}
                    </span>
                    <div className="hh-segment flex max-w-full overflow-x-auto">
                        {availableLines.map((l) => {
                            const isSelected = effectiveLine === l;
                            return (
                                <button
                                    key={l}
                                    onClick={() => onLineChange(l)}
                                    data-selected={isSelected}
                                    className="hh-segment-item hh-press whitespace-nowrap"
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
                    aria-pressed={showChurn}
                    className={`hh-press hh-focusable shrink-0 flex items-center gap-1.5 rounded-[var(--hh-radius-md)] border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                        showChurn
                            ? "border-miku bg-miku text-[var(--hh-text-on-accent)]"
                            : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:border-miku/40 hover:text-miku"
                    }`}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        className={`h-3.5 w-3.5 ${showChurn ? "text-[var(--hh-text-on-accent)]" : "text-miku"}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{t("page.realtimeRanking.showChurn")}</span>
                    <div
                        className={`ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-[var(--hh-radius-xs)] border transition-colors ${
                            showChurn
                                ? "border-[var(--hh-text-on-accent)] bg-[var(--hh-text-on-accent)]"
                                : "border-[var(--hh-border-strong)] bg-[var(--hh-surface-2)]"
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

            {/* Status Bar — a sunken well, which is how the system reads a strip of
                passive readouts. It was `bg-white/40` + blur; at 40% the tint was
                not carrying the contrast on its own. */}
            <div className="hh-well flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2 text-xs text-[var(--hh-text-secondary)]">
                {eventId != null && (
                    <span className="inline-flex items-center gap-1.5">
                        <span className="font-medium text-[var(--hh-text-tertiary)]">{t("page.realtimeRankingNext.eventId")}</span>
                        <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">#{eventId}</span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-[var(--hh-text-tertiary)]">{t("page.realtimeRankingNext.totalEntries")}</span>
                    <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">{formatNumber(totalEntries)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="font-medium text-[var(--hh-text-tertiary)]">{t("page.realtimeRankingNext.updatedAt")}</span>
                    <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">{updatedLabel}</span>
                </span>

                <div className="ml-auto flex items-center gap-2">
                    <span
                        className={`rounded-[var(--hh-radius-sm)] px-2.5 py-0.5 text-[10px] font-bold border ${
                            isRefreshing
                                ? "border-amber-500/30 bg-amber-500/12 text-amber-700"
                                : "border-emerald-500/30 bg-emerald-500/12 text-emerald-700"
                        }`}
                    >
                        {isRefreshing ? t("page.realtimeRanking.refreshing") : t("page.realtimeRanking.synced")}
                    </span>

                    <button
                        onClick={onRefresh}
                        className="hh-press hh-focusable inline-flex items-center gap-1.5 rounded-[var(--hh-radius-md)] bg-miku px-3 py-1 text-[11px] font-bold text-[var(--hh-text-on-accent)] hover:bg-miku-dark"
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
                                <span className="hh-numeric opacity-85">{countdown}s</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
