"use client";
import { useState, useEffect, useMemo, type CSSProperties } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import {
    IVirtualLiveInfo,
    VIRTUAL_LIVE_TYPE_COLORS,
    getVirtualLiveStatus,
    VIRTUAL_LIVE_STATUS_DISPLAY,
    VirtualLiveType,
} from "@/types/virtualLive";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getVirtualLiveBannerUrl } from "@/lib/assets";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useI18n } from "@/contexts/I18nContext";

export default function UpcomingLiveTab() {
    const { assetSource, isShowSpoiler } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const [virtualLives, setVirtualLives] = useState<IVirtualLiveInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const data = await fetchMasterData<IVirtualLiveInfo[]>("virtualLives.json");
                setVirtualLives(data);
                setError(null);
            } catch (err) {
                console.error("Error fetching virtual lives:", err);
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [t]);

    // Find upcoming or ongoing virtual lives
    const displayLives = useMemo(() => {
        const now = Date.now();

        // Exclude beginner type
        const filtered = virtualLives.filter(vl => vl.virtualLiveType !== "beginner");

        // Ongoing lives (already started, not ended)
        const ongoing = filtered.filter(vl => vl.startAt <= now && vl.endAt > now);

        // Upcoming lives (not started yet) — only when spoiler is on
        const upcoming = isShowSpoiler
            ? filtered.filter(vl => vl.startAt > now)
            : [];

        // Combine: ongoing first, then upcoming sorted by startAt
        const combined = [
            ...ongoing.sort((a, b) => a.startAt - b.startAt),
            ...upcoming.sort((a, b) => a.startAt - b.startAt),
        ];

        return combined.slice(0, 3);
    }, [virtualLives, isShowSpoiler]);

    // Find the next schedule for a virtual live
    const getNextSchedule = (vl: IVirtualLiveInfo) => {
        const now = Date.now();
        const schedules = vl.virtualLiveSchedules || [];
        // Find the next upcoming schedule
        const next = schedules
            .filter(s => s.endAt > now)
            .sort((a, b) => a.startAt - b.startAt)[0];
        return next || null;
    };

    const formatDate = (ts: number) => formatLocaleDate(ts, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="animate-pulse h-20 w-full rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-sunken)]" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="hh-tile hh-tile-tint p-6 rounded-[var(--hh-radius-lg)] text-red-600 text-sm text-center"
                style={{ "--hh-tint": "var(--hh-accent-alert)" } as CSSProperties}
            >
                <p className="font-bold">{t("page.home.upcomingLive.loadFailedTitle")}</p>
                <p>{error}</p>
            </div>
        );
    }

    if (displayLives.length === 0) {
        return (
            <div className="hh-well p-8 text-center text-[var(--hh-text-tertiary)]">
                <p className="font-medium">{t("page.home.upcomingLive.noData")}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-3">
                {displayLives.map(vl => {
                    const status = getVirtualLiveStatus(vl);
                    const statusDisplay = VIRTUAL_LIVE_STATUS_DISPLAY[status];
                    const typeLabel = t(`common.virtualLiveTypes.${vl.virtualLiveType}`);
                    const typeName = typeLabel === `common.virtualLiveTypes.${vl.virtualLiveType}` ? vl.virtualLiveType : typeLabel;
                    const typeColor = VIRTUAL_LIVE_TYPE_COLORS[vl.virtualLiveType as VirtualLiveType] || "#9E9E9E";
                    const nextSchedule = getNextSchedule(vl);

                    return (
                        <Link key={vl.id} href={`/live/${vl.id}`} className="block group hh-press">
                            <div className="hh-tile relative flex h-20 sm:h-24 rounded-[var(--hh-radius-lg)] overflow-hidden transition-colors hover:border-[var(--hh-accent-line)]">
                                {/* Left: Banner (35%) */}
                                <div className="w-[35%] relative overflow-hidden">
                                    <Image
                                        src={getVirtualLiveBannerUrl(vl.assetbundleName, assetSource)}
                                        alt={vl.name}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                    <div className="absolute inset-0 bg-black/30" />
                                </div>

                                {/* Right: Info (65%) */}
                                <div className="w-[65%] flex flex-col justify-center p-3 sm:p-4 gap-1">
                                    {/* Badges — status and live-type colors are semantic. */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span
                                            className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-white"
                                            style={{ backgroundColor: statusDisplay.color }}
                                        >
                                            {t(`common.status.${status}`)}
                                        </span>
                                        <span
                                            className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-white"
                                            style={{ backgroundColor: typeColor }}
                                        >
                                            {typeName}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="hh-title font-bold text-[var(--hh-text-primary)] text-xs sm:text-sm leading-tight line-clamp-1 group-hover:text-miku transition-colors">
                                        <TranslatedText
                                            original={vl.name}
                                            category="virtualLive"
                                            field="name"
                                            originalClassName="line-clamp-1"
                                            translationClassName="text-[10px] text-[var(--hh-text-tertiary)] line-clamp-1 font-normal"
                                        />
                                    </h3>

                                    {/* Schedule info */}
                                    <div className="hh-numeric text-[10px] sm:text-xs text-[var(--hh-text-tertiary)]">
                                        {nextSchedule ? (
                                            <span>
                                                {t("page.home.upcomingLive.nextSchedule", { date: formatDate(nextSchedule.startAt) })}
                                            </span>
                                        ) : (
                                            <span>
                                                {formatDate(vl.startAt)} - {formatDate(vl.endAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {/* View All Link */}
            <div className="mt-4 text-center">
                <Link href="/live" className="inline-flex items-center gap-1 text-sm text-miku hover:text-miku-dark font-medium transition-colors">
                    {t("page.home.upcomingLive.viewAll")}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
