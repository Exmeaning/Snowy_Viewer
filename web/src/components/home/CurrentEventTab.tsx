"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { IEventInfo, getEventStatus, EVENT_TYPE_NAMES, EVENT_STATUS_DISPLAY, EVENT_TYPE_COLORS } from "@/types/events";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getEventBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { loadTranslations, TranslationData } from "@/lib/translations";

export default function CurrentEventTab() {
    const { assetSource, themeColor, isShowSpoiler } = useTheme();
    const [currentEvent, setCurrentEvent] = useState<IEventInfo | null>(null);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

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
                const [eventsData, translationsData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(),
                ]);
                setTranslations(translationsData);

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
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler]);

    if (isLoading) {
        return (
            <div className="animate-pulse h-32 w-full rounded-2xl bg-slate-100" />
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm text-center">
                <p className="font-bold">加载活动失败</p>
                <p>{error}</p>
            </div>
        );
    }

    if (!currentEvent) {
        return (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-medium">暂无进行中的活动</p>
            </div>
        );
    }

    const status = getEventStatus(currentEvent);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];
    const eventTypeColor = EVENT_TYPE_COLORS[currentEvent.eventType] || "#333";
    const eventTypeName = EVENT_TYPE_NAMES[currentEvent.eventType] || currentEvent.eventType;
    const translatedName = translations?.events?.name?.[currentEvent.name] || "";

    // Calculate progress
    const totalDuration = currentEvent.aggregateAt - currentEvent.startAt;
    const elapsed = Math.max(0, now - currentEvent.startAt);
    const progressPercent = status === "ongoing"
        ? Math.min(100, (elapsed / totalDuration) * 100)
        : 0;

    // Format dates
    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

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
                            <div className="flex items-center gap-2 mb-1.5">
                                <span
                                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm"
                                    style={{ backgroundColor: statusDisplay.color }}
                                >
                                    {statusDisplay.label}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {eventTypeName}
                                </span>
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

                        {/* Big Percentage (Bottom Right) - Fully opaque black */}
                        {status === "ongoing" && (
                            <div
                                className="absolute bottom-0 right-2 text-4xl sm:text-5xl font-black text-black dark:text-white select-none z-10 tracking-tighter"
                            >
                                {Math.floor(progressPercent)}<span className="text-2xl ml-1">%</span>
                            </div>
                        )}
                    </div>
                </div>
            </Link>

            {/* Stamina Reserve Tip for Upcoming Events */}
            {staminaReserve && (
                <div className="mt-2 px-4 py-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs sm:text-sm flex items-center gap-2">
                    <span className="text-amber-500 text-base" aria-hidden="true">⚡</span>
                    <span className="text-amber-700 font-medium">
                        {staminaReserve.normalReserve === 0 && staminaReserve.passReserve === 0 ? (
                            staminaReserve.recoverable > PASS_CAP
                                ? "距活动开始太久，可将多余体力塞进烤森"
                                : "体力充裕，无需预留"
                        ) : staminaReserve.normalReserve >= NORMAL_CAP ? (
                            "活动即将开始，请保持满体力"
                        ) : staminaReserve.normalReserve === 0 ? (
                            <>预留 <span className="font-bold">{staminaReserve.passReserve}</span> 体力 / 月卡 — 开活恰好回满</>
                        ) : (
                            <>预留 <span className="font-bold">{staminaReserve.normalReserve}</span> 体力 / 普通 · 预留 <span className="font-bold">{staminaReserve.passReserve}</span> 体力 / 月卡 — 开活恰好回满</>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
}
