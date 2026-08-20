"use client";

import Link from "@/components/LocalizedLink";
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
            {/* Page header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-[var(--hh-radius-md)] mb-4">
                    <span className="hh-label text-miku text-xs">{t("page.realtimeRanking.badge")}</span>
                    <span className="hh-label rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-2 py-0.5 text-[10px]">
                        {t("page.realtimeRanking.legacyBadge")}
                    </span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                    {t("page.realtimeRanking.title")} <span className="text-miku">{t("page.realtimeRanking.titleHighlight")}</span>
                </h1>
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                    {t("page.realtimeRanking.description")}
                </p>

                {/* Promote the redesigned (next) version. The three-stop accent gradient
                    became a flat accent wash: the tint still marks this as the one
                    promoted link on the page without reading as a web banner. */}
                <Link
                    href="/realtime-ranking-next"
                    className="hh-press hh-focusable group mt-4 inline-flex max-w-full items-center gap-2 rounded-[var(--hh-radius-md)] border border-miku/30 bg-[var(--hh-accent-wash)] px-4 py-2 text-sm font-semibold text-[var(--hh-text-secondary)] hover:border-miku/60"
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
                {/* Region toggle */}
                <div className="hh-segment shrink-0 flex max-w-full overflow-x-auto">
                    {REALTIME_RANKING_REGION_OPTIONS.map((value) => (
                        <button
                            key={value}
                            onClick={() => onRegionChange(value)}
                            data-selected={region === value}
                            className="hh-segment-item hh-press whitespace-nowrap"
                        >
                            {t(`page.realtimeRanking.regions.${value}`)}
                        </button>
                    ))}
                </div>

                {/* Data line toggle */}
                <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[var(--hh-text-secondary)] whitespace-nowrap">
                        {t("page.realtimeRanking.line.label")}
                    </span>
                    <div className="hh-segment flex max-w-full overflow-x-auto">
                        {REALTIME_RANKING_LINE_OPTIONS.map((value) => (
                            <button
                                key={value}
                                onClick={() => onLineChange(value)}
                                data-selected={line === value}
                                className="hh-segment-item hh-press whitespace-nowrap"
                            >
                                {t(`page.realtimeRanking.line.${value}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {showChurnToggle && (
                    <button
                        onClick={() => onShowChurnChange(!showChurn)}
                        aria-pressed={showChurn}
                        className={`hh-press hh-focusable shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--hh-radius-md)] text-sm font-bold border whitespace-nowrap ${showChurn
                            ? "bg-miku text-[var(--hh-text-on-accent)] border-miku"
                            : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] border-[var(--hh-border)] hover:border-[var(--hh-border-strong)]"
                            }`}
                    >
                        <span>{t("page.realtimeRanking.showChurn")}</span>
                        <div className={`w-4 h-4 rounded-[var(--hh-radius-xs)] border flex items-center justify-center transition-colors ${showChurn ? "border-[var(--hh-text-on-accent)] bg-[var(--hh-text-on-accent)]" : "border-[var(--hh-border-strong)] bg-[var(--hh-surface-2)]"}`}>
                            {showChurn && (
                                <svg className="w-2.5 h-2.5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4.5} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                )}

                {/* Status tags.
                    These were `bg-white/40` + `backdrop-blur-[2px]`: the tint alone is
                    only 40% opaque, so the blur was carrying the contrast. Since the
                    redesign neutralizes backdrop-filter globally, keeping the weak tint
                    would have let the page gradient read straight through the chips.
                    They are now opaque surface fills, which is also what makes them
                    read as inset system status pills rather than floating glass. */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {typeof eventId === "number" && (
                        <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-1)] border border-[var(--hh-border)] text-[var(--hh-text-secondary)] px-3 py-1.5 font-medium whitespace-nowrap">
                            {t("page.realtimeRanking.eventId", { id: eventId })}
                        </span>
                    )}
                    {scopeLabel && (
                        <span className="rounded-[var(--hh-radius-sm)] bg-miku/10 text-miku border border-miku/20 px-3 py-1.5 font-medium whitespace-nowrap">
                            {scopeLabel}
                        </span>
                    )}
                    <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-1)] border border-[var(--hh-border)] text-[var(--hh-text-secondary)] px-3 py-1.5 font-medium whitespace-nowrap">
                        {t("page.realtimeRanking.totalEntries", { count: formatNumber(totalEntries) })}
                    </span>
                    <span className={`rounded-[var(--hh-radius-sm)] px-3 py-1.5 font-medium whitespace-nowrap border ${isRefreshing
                        ? "bg-amber-500/12 text-amber-700 border-amber-500/30"
                        : "bg-emerald-500/12 text-emerald-700 border-emerald-500/30"
                        }`}>
                        {isRefreshing ? t("page.realtimeRanking.refreshing") : t("page.realtimeRanking.synced")}
                    </span>
                    {updatedAt ? (
                        <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-1)] border border-[var(--hh-border)] text-[var(--hh-text-secondary)] px-3 py-1.5 font-medium whitespace-nowrap">
                            {t("page.realtimeRanking.updatedAt", { time: formatDate(updatedAt) })}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );
}
