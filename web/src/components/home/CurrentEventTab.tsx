"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { IEventInfo, getEventStatus, EVENT_STATUS_DISPLAY } from "@/types/events";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { fetchMasterData } from "@/lib/fetch";
import { getEventBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { useTranslation } from "@/contexts/TranslationContext";

export default function CurrentEventTab() {
    const { assetSource, themeColor, isShowSpoiler } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const { t: translateMasterText } = useTranslation();
    const [currentEvent, setCurrentEvent] = useState<IEventInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());

    // Update `now` every 60s for real-time stamina calculation
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Stamina reserve calculation for upcoming events
    const STAMINA_RECOVERY_MINUTES = 30;
    const NORMAL_CAP = 25;
    const PASS_CAP = 50;

    const staminaReserve = useMemo(() => {
        if (!currentEvent) return null;
        const status = getEventStatus(currentEvent);
        if (status !== "upcoming") return null;
        const minutesUntilStart = Math.max(0, (currentEvent.startAt - now) / 60000);
        const recoverable = Math.floor(minutesUntilStart / STAMINA_RECOVERY_MINUTES);
        const normalReserve = Math.max(0, NORMAL_CAP - recoverable);
        const passReserve = Math.max(0, PASS_CAP - recoverable);
        return { normalReserve, passReserve, recoverable };
    }, [currentEvent, now]);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const eventsData = await fetchMasterData<IEventInfo[]>("events.json");

                // Find ongoing or upcoming event
                const now = Date.now();
                const sortedEvents = eventsData
                    .filter(e => e.aggregateAt > now) // Not ended yet
                    .sort((a, b) => a.startAt - b.startAt);

                const ongoingEvent = sortedEvents.find(e => e.startAt <= now && e.aggregateAt > now);
                // Only show upcoming event when spoiler mode is enabled
                const upcomingEvent = isShowSpoiler ? sortedEvents.find(e => e.startAt > now) : null;

                setCurrentEvent(ongoingEvent || upcomingEvent || null);
                setError(null);
            } catch (err) {
                console.error("Error fetching event data:", err);
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler, t]);

    if (isLoading) {
        return (
            <div className="animate-pulse h-32 w-full rounded-2xl bg-slate-100" />
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm text-center">
                <p className="font-bold">{t("page.home.currentEvent.loadFailedTitle")}</p>
                <p>{error}</p>
            </div>
        );
    }

    if (!currentEvent) {
        return (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-medium">{t("page.home.currentEvent.noActiveEvent")}</p>
            </div>
        );
    }

    const status = getEventStatus(currentEvent);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];
    const statusLabel = t(`common.status.${status}`);
    const eventTypeLabel = t(`common.eventTypes.${currentEvent.eventType}`);
    const eventTypeName = eventTypeLabel === `common.eventTypes.${currentEvent.eventType}` ? currentEvent.eventType : eventTypeLabel;
    const translatedName = translateMasterText("events", "name", currentEvent.name);

    // Calculate progress
    const totalDuration = currentEvent.aggregateAt - currentEvent.startAt;
    const elapsed = Math.max(0, now - currentEvent.startAt);
    const progressPercent = status === "ongoing"
        ? Math.min(100, (elapsed / totalDuration) * 100)
        : 0;

    // Format dates
    const formatDate = (ts: number) => formatLocaleDate(ts, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div>
            <Link href={`/events/${currentEvent.id}`} className="block group">
                <div className="relative flex h-32 md:h-36 rounded-2xl overflow-hidden glass-card border border-white/40 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">

                    {/* Left Side: Background & Logo (45%) */}
                    <div className="w-[45%] relative overflow-hidden">
                        {/* Background Image */}
                        <div className="absolute inset-0">
                            <Image
                                src={getEventBannerUrl(currentEvent.assetbundleName, assetSource)}
                                alt={currentEvent.name}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                unoptimized
                            />
                            {/* Dark Overlay Mask */}
                            <div className="absolute inset-0 bg-black/50" />
                        </div>

                        {/* Centered Logo */}
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                            <div className="relative w-full h-full max-h-20 sm:max-h-24">
                                <Image
                                    src={getEventLogoUrl(currentEvent.assetbundleName, assetSource)}
                                    alt=""
                                    fill
                                    className="object-contain drop-shadow-2xl"
                                    unoptimized
                                    loading="eager"
                                    fetchPriority="high"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Info (55%) */}
                    <div className="w-[55%] relative flex flex-col justify-center p-3 sm:p-4 z-10 overflow-hidden">

                        {/* Progress Background Overlay (Limited to right side) - Using Theme Color */}
                        {status === "ongoing" && (
                            <div
                                className="absolute inset-y-0 left-0 transition-all duration-500 ease-out z-0 pointer-events-none"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: themeColor,
                                    opacity: 0.12
                                }}
                            />
                        )}

                        {/* Content */}
                        <div className="space-y-1 relative z-20">
                            {/* Status Badge */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span
                                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm"
                                    style={{ backgroundColor: statusDisplay.color }}
                                >
                                    {statusLabel}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {eventTypeName}
                                </span>
                                {staminaReserve && (() => {
                                    const label = staminaReserve.normalReserve === 0 && staminaReserve.passReserve === 0
                                        ? (staminaReserve.recoverable > PASS_CAP ? t("page.home.stamina.bakerShort") : null)
                                        : staminaReserve.normalReserve >= NORMAL_CAP
                                        ? t("page.home.stamina.keepFullShort")
                                        : staminaReserve.normalReserve === 0
                                        ? t("page.home.stamina.reserveShort", { count: staminaReserve.passReserve })
                                        : t("page.home.stamina.reserveShort", { count: staminaReserve.normalReserve });
                                    if (!label) return null;
                                    return (
                                        <span
                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-miku/10 text-miku cursor-help"
                                            title={
                                                staminaReserve.normalReserve > 0 && staminaReserve.passReserve > 0
                                                    ? t("page.home.stamina.detailBoth", { normal: staminaReserve.normalReserve, pass: staminaReserve.passReserve })
                                                    : staminaReserve.passReserve > 0
                                                    ? t("page.home.stamina.detailPass", { pass: staminaReserve.passReserve })
                                                    : undefined
                                            }
                                        >
                                            ⚡ {label}
                                        </span>
                                    );
                                })()}
                            </div>

                            {/* Title (JP Priority) */}
                            <h3 className="font-bold text-primary-text text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-miku transition-colors" title={currentEvent.name}>
                                {currentEvent.name}
                            </h3>

                            {/* Title (CN - Second Line) */}
                            <p className="text-xs text-slate-500 line-clamp-1 h-4">
                                {translatedName !== currentEvent.name ? translatedName : ""}
                            </p>

                            {/* Date Range & Time */}
                            <div className="pt-2 text-[10px] sm:text-xs text-slate-400 font-mono flex flex-col sm:flex-row sm:gap-2">
                                <span>{formatDate(currentEvent.startAt)}</span>
                                <span className="hidden sm:inline">-</span>
                                <span>{formatDate(currentEvent.aggregateAt)}</span>
                            </div>
                        </div>

                        {/* Big Percentage (Bottom Right) */}
                        {status === "ongoing" && (
                            <div
                                className="absolute bottom-0 right-2 text-4xl sm:text-5xl font-black text-slate-800 dark:text-slate-100 select-none z-10 tracking-tighter"
                            >
                                {Math.floor(progressPercent)}<span className="text-2xl ml-1">%</span>
                            </div>
                        )}
                    </div>
                </div>
            </Link>


        </div>
    );
}
