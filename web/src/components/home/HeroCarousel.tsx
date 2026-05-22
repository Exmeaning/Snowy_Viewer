"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { IEventInfo, getEventStatus, EVENT_STATUS_DISPLAY } from "@/types/events";
import { IGachaInfo, ICardInfo, CHAR_COLORS } from "@/types/types";
import { useTheme, type AssetSourceType } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import {
    getEventBannerUrl,
    getEventLogoUrl,
    getGachaLogoUrl,
    getCardFullUrl,
    getCharacterIconUrl,
} from "@/lib/assets";
import { loadTranslations } from "@/lib/translations";
import { getTodayBirthdays, isVirtualSinger, type UpcomingBirthday } from "@/lib/birthdays";
import { useI18n } from "@/contexts/I18nContext";

// ─── Slide type definitions ───

interface EventSlide {
    type: "event";
    event: IEventInfo;
    translatedName: string;
}

interface GachaSlide {
    type: "gacha";
    gacha: IGachaInfo;
    pickupCard: ICardInfo | null;
}

interface BirthdaySlide {
    type: "birthday";
    birthday: UpcomingBirthday;
    card: ICardInfo | null;
}

type Slide = EventSlide | GachaSlide | BirthdaySlide;

// ─── Auto-play interval ───
const AUTO_PLAY_INTERVAL = 5000;

export default function HeroCarousel() {
    const { assetSource, themeColor, isShowSpoiler } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    // Touch handling
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // Update `now` every 60s
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch all data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [eventsData, gachasData, cardsData, translationsData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IGachaInfo[]>("gachas.json"),
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    loadTranslations(),
                ]);
                const now = Date.now();
                const builtSlides: Slide[] = [];

                // 1. Current/upcoming event
                const sortedEvents = eventsData
                    .filter(e => e.aggregateAt > now)
                    .sort((a, b) => a.startAt - b.startAt);
                const ongoingEvent = sortedEvents.find(e => e.startAt <= now && e.aggregateAt > now);
                const upcomingEvent = isShowSpoiler ? sortedEvents.find(e => e.startAt > now) : null;
                const currentEvent = ongoingEvent || upcomingEvent;

                if (currentEvent) {
                    const translatedName = translationsData?.events?.name?.[currentEvent.name] || "";
                    builtSlides.push({ type: "event", event: currentEvent, translatedName });
                }

                // 2. Current gachas (filter out "normal" type, keep limited/featured)
                const activeGachas = gachasData
                    .filter(g => g.startAt <= now && g.endAt > now && g.gachaType !== "normal")
                    .sort((a, b) => b.startAt - a.startAt);

                // Also include upcoming gachas if spoiler mode
                const upcomingGachas = isShowSpoiler
                    ? gachasData
                        .filter(g => g.startAt > now && g.gachaType !== "normal")
                        .sort((a, b) => a.startAt - b.startAt)
                        .slice(0, 1)
                    : [];

                const displayGachas = [...activeGachas, ...upcomingGachas].slice(0, 2);
                for (const gacha of displayGachas) {
                    // Find the first pickup card for background
                    let pickupCard: ICardInfo | null = null;
                    if (gacha.gachaPickups && gacha.gachaPickups.length > 0) {
                        const firstPickupCardId = gacha.gachaPickups[0].cardId;
                        pickupCard = cardsData.find(c => c.id === firstPickupCardId) || null;
                    }
                    builtSlides.push({ type: "gacha", gacha, pickupCard });
                }

                // 3. Today's birthdays
                const todayBirthdays = getTodayBirthdays();
                for (const birthday of todayBirthdays) {
                    // Find the latest birthday card for this character
                    const charCards = cardsData.filter(c => c.characterId === birthday.id);
                    let targetCards = charCards.filter(c => c.cardRarityType === "rarity_birthday");
                    if (targetCards.length === 0) targetCards = charCards;
                    targetCards.sort((a, b) => (b.id) - (a.id));
                    const card = targetCards[0] || null;
                    builtSlides.push({ type: "birthday", birthday, card });
                }

                setSlides(builtSlides);
            } catch (err) {
                console.error("HeroCarousel: Failed to fetch data", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler]);

    // Auto-play
    useEffect(() => {
        if (slides.length <= 1 || isPaused) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % slides.length);
        }, AUTO_PLAY_INTERVAL);
        return () => clearInterval(timer);
    }, [slides.length, isPaused]);

    const goTo = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    const goNext = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % slides.length);
    }, [slides.length]);

    const goPrev = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
    }, [slides.length]);

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        setIsPaused(true);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    }, []);

    const handleTouchEnd = useCallback(() => {
        const diff = touchStartX.current - touchEndX.current;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext();
            else goPrev();
        }
        setIsPaused(false);
    }, [goNext, goPrev]);

    // Stamina reserve calculation (for event slides)
    const STAMINA_RECOVERY_MINUTES = 30;
    const NORMAL_CAP = 25;
    const PASS_CAP = 50;

    const getStaminaLabel = useCallback((event: IEventInfo) => {
        const status = getEventStatus(event);
        if (status !== "upcoming") return null;
        const minutesUntilStart = Math.max(0, (event.startAt - now) / 60000);
        const recoverable = Math.floor(minutesUntilStart / STAMINA_RECOVERY_MINUTES);
        const normalReserve = Math.max(0, NORMAL_CAP - recoverable);
        const passReserve = Math.max(0, PASS_CAP - recoverable);

        if (normalReserve === 0 && passReserve === 0) {
            return recoverable > PASS_CAP ? t("page.home.stamina.bakerLong") : null;
        }
        if (normalReserve >= NORMAL_CAP) return t("page.home.stamina.keepFullLong");
        if (normalReserve === 0) return t("page.home.stamina.reservePassLong", { count: passReserve });
        return t("page.home.stamina.reserveLong", { count: normalReserve });
    }, [now, t]);

    // Format date
    const formatDate = (ts: number) => formatLocaleDate(ts, {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    // Format remaining time
    const formatRemaining = (endTs: number) => {
        const diff = endTs - now;
        if (diff <= 0) return t("page.home.hero.ended");
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        if (days > 0) return t("page.home.hero.remainingDaysHours", { days, hours });
        const minutes = Math.floor((diff % 3600000) / 60000);
        return t("page.home.hero.remainingHoursMinutes", { hours, minutes });
    };

    if (isLoading) {
        return (
            <div className="w-full h-[180px] lg:h-[260px] rounded-2xl animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
        );
    }

    if (slides.length === 0) {
        return (
            <div className="w-full h-[180px] lg:h-[260px] rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <p className="font-medium">{t("page.home.hero.noContent")}</p>
            </div>
        );
    }

    return (
        <div
            className="relative w-full h-[180px] lg:h-[260px] rounded-2xl overflow-hidden group/carousel select-none"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Slides */}
            {slides.map((slide, index) => (
                <div
                    key={`${slide.type}-${index}`}
                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                        index === currentIndex
                            ? "opacity-100 translate-x-0 z-10"
                            : index < currentIndex
                            ? "opacity-0 -translate-x-4 z-0"
                            : "opacity-0 translate-x-4 z-0"
                    }`}
                    aria-hidden={index !== currentIndex}
                >
                    {slide.type === "event" && (
                        <EventSlideContent
                            slide={slide}
                            assetSource={assetSource}
                            themeColor={themeColor}
                            now={now}
                            formatDate={formatDate}
                            getStaminaLabel={getStaminaLabel}
                            t={t}
                        />
                    )}
                    {slide.type === "gacha" && (
                        <GachaSlideContent
                            slide={slide}
                            assetSource={assetSource}
                            now={now}
                            formatRemaining={formatRemaining}
                            formatDate={formatDate}
                            t={t}
                        />
                    )}
                    {slide.type === "birthday" && (
                        <BirthdaySlideContent
                            slide={slide}
                            assetSource={assetSource}
                            formatDate={formatDate}
                            t={t}
                        />
                    )}
                </div>
            ))}

            {/* Navigation Arrows */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.preventDefault(); goPrev(); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/50"
                        aria-label={t("page.home.hero.previousSlide")}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); goNext(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/50"
                        aria-label={t("page.home.hero.nextSlide")}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Dot Indicators */}
            {slides.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goTo(index)}
                            className={`rounded-full transition-all duration-300 ${
                                index === currentIndex
                                    ? "w-6 h-2 bg-white shadow-sm"
                                    : "w-2 h-2 bg-white/50 hover:bg-white/70"
                            }`}
                            aria-label={t("page.home.hero.goToSlide", { index: index + 1 })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Event Slide ───

function EventSlideContent({
    slide,
    assetSource,
    themeColor,
    now,
    formatDate,
    getStaminaLabel,
    t,
}: {
    slide: EventSlide;
    assetSource: AssetSourceType;
    themeColor: string;
    now: number;
    formatDate: (ts: number) => string;
    getStaminaLabel: (event: IEventInfo) => string | null;
    t: ReturnType<typeof useI18n>["t"];
}) {
    const { event, translatedName } = slide;
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];
    const statusLabel = t(`common.status.${status}`);
    const eventTypeLabel = t(`common.eventTypes.${event.eventType}`);
    const eventTypeName = eventTypeLabel === `common.eventTypes.${event.eventType}` ? event.eventType : eventTypeLabel;

    // Progress
    const totalDuration = event.aggregateAt - event.startAt;
    const elapsed = Math.max(0, now - event.startAt);
    const progressPercent = status === "ongoing"
        ? Math.min(100, (elapsed / totalDuration) * 100)
        : 0;

    const staminaLabel = getStaminaLabel(event);

    return (
        <Link href={`/events/${event.id}`} className="block w-full h-full relative">
            {/* Background */}
            <Image
                src={getEventBannerUrl(event.assetbundleName, assetSource)}
                alt={event.name}
                fill
                className="object-cover"
                unoptimized
                loading="eager"
                fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

            {/* Event Logo (centered) */}
            <div className="absolute inset-0 flex items-center justify-center p-8 pb-16">
                <div className="relative w-full h-full max-w-[400px] max-h-[120px] lg:max-h-[160px]">
                    <Image
                        src={getEventLogoUrl(event.assetbundleName, assetSource)}
                        alt=""
                        fill
                        className="object-contain drop-shadow-2xl"
                        unoptimized
                        loading="eager"
                    />
                </div>
            </div>

            {/* Bottom Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4 flex items-end justify-between">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm"
                            style={{ backgroundColor: statusDisplay.color }}
                        >
                            {statusLabel}
                        </span>
                        <span className="text-[10px] font-bold text-white/70">
                            {eventTypeName}
                        </span>
                        {staminaLabel && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/20 backdrop-blur-sm text-amber-300">
                                ⚡ {staminaLabel}
                            </span>
                        )}
                    </div>
                    {/* Title */}
                    <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-1 drop-shadow-sm">
                        {event.name}
                    </h3>
                    {translatedName && translatedName !== event.name && (
                        <p className="text-xs text-white/60 line-clamp-1">{translatedName}</p>
                    )}
                    {/* Date */}
                    <div className="text-[10px] sm:text-xs text-white/50 font-mono">
                        {formatDate(event.startAt)} - {formatDate(event.aggregateAt)}
                    </div>
                </div>

                {/* Progress percentage */}
                {status === "ongoing" && (
                    <div className="text-3xl lg:text-4xl font-black text-white/90 select-none tracking-tighter ml-4 shrink-0 drop-shadow-sm">
                        {Math.floor(progressPercent)}<span className="text-xl ml-0.5">%</span>
                    </div>
                )}
            </div>

            {/* Progress bar at very bottom */}
            {status === "ongoing" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5">
                    <div
                        className="h-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%`, backgroundColor: themeColor }}
                    />
                </div>
            )}
        </Link>
    );
}

// ─── Gacha Slide ───

function GachaSlideContent({
    slide,
    assetSource,
    now,
    formatRemaining,
    formatDate,
    t,
}: {
    slide: GachaSlide;
    assetSource: AssetSourceType;
    now: number;
    formatRemaining: (endTs: number) => string;
    formatDate: (ts: number) => string;
    t: ReturnType<typeof useI18n>["t"];
}) {
    const { gacha, pickupCard } = slide;
    const isUpcoming = gacha.startAt > now;

    // Use the first pickup card's full art as background
    // For rarity_3/rarity_4: use after_training artwork.
    // For rarity_birthday: use normal artwork because birthday cards have no trained art.
    const pickupBgUrl = pickupCard
        ? getCardFullUrl(
            pickupCard.characterId,
            pickupCard.assetbundleName,
            pickupCard.cardRarityType === "rarity_3" || pickupCard.cardRarityType === "rarity_4",
            assetSource
        )
        : null;

    return (
        <Link href={`/gacha/${gacha.id}`} className="block w-full h-full relative">
            {/* Background: pickup card full art */}
            {pickupBgUrl ? (
                <Image
                    src={pickupBgUrl}
                    alt={gacha.name}
                    fill
                    className="object-cover object-top"
                    unoptimized
                    loading="lazy"
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-100 to-purple-100" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

            {/* Gacha Logo (centered) */}
            <div className="absolute inset-0 flex items-center justify-center p-8 pb-16">
                <div className="relative w-full h-full max-w-[360px] max-h-[100px] lg:max-h-[140px]">
                    <Image
                        src={getGachaLogoUrl(gacha.assetbundleName, assetSource)}
                        alt=""
                        fill
                        className="object-contain drop-shadow-2xl"
                        unoptimized
                        loading="lazy"
                    />
                </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4">
                <div className="flex items-end justify-between">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm ${isUpcoming ? "bg-blue-500" : "bg-pink-500"}`}>
                                {isUpcoming ? t("page.home.hero.upcomingGacha") : t("page.home.hero.currentGacha")}
                            </span>
                        </div>
                        <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-1 drop-shadow-sm">
                            {gacha.name}
                        </h3>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white/70 ml-4 shrink-0">
                        {isUpcoming ? t("page.home.hero.gachaStartsAt", { date: formatDate(gacha.startAt) }) : formatRemaining(gacha.endAt)}
                    </div>
                </div>
            </div>
        </Link>
    );
}

// ─── Birthday Slide ───

function BirthdaySlideContent({
    slide,
    assetSource,
    formatDate,
    t,
}: {
    slide: BirthdaySlide;
    assetSource: AssetSourceType;
    formatDate: (ts: number) => string;
    t: ReturnType<typeof useI18n>["t"];
}) {
    const { birthday, card } = slide;
    const charColor = CHAR_COLORS[birthday.id.toString()] || "#ff66cc";
    const isBirthdayRarity = card?.cardRarityType === "rarity_birthday";

    const cardImageUrl = card
        ? getCardFullUrl(
            card.characterId,
            card.assetbundleName,
            isBirthdayRarity ? false : true,
            assetSource
        )
        : null;

    return (
        <Link href={`/character/${birthday.id}`} className="block w-full h-full relative">
            {/* Background */}
            {cardImageUrl ? (
                <>
                    <Image
                        src={cardImageUrl}
                        alt={birthday.name}
                        fill
                        className="object-cover object-top"
                        unoptimized
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                </>
            ) : (
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${charColor}40, ${charColor}15)` }}
                />
            )}

            {/* Content */}
            <div className="absolute inset-0 flex items-center p-6 lg:p-8">
                <div className="flex items-center gap-4 lg:gap-6">
                    {/* Character Icon */}
                    <div
                        className="relative w-16 h-16 lg:w-20 lg:h-20 shrink-0 rounded-full p-0.5 shadow-lg"
                        style={{ backgroundColor: charColor }}
                    >
                        <div className="w-full h-full rounded-full overflow-hidden bg-white">
                            <Image
                                src={getCharacterIconUrl(birthday.id)}
                                alt={birthday.name}
                                fill
                                className="object-contain rounded-full"
                                unoptimized
                            />
                        </div>
                    </div>

                    {/* Text */}
                    <div>
                        <div className="text-white/70 text-xs lg:text-sm font-medium mb-1">
                            {formatDate(new Date(2000, birthday.month - 1, birthday.day).getTime())}
                        </div>
                        <h3
                            className="text-xl lg:text-3xl font-black text-white drop-shadow-lg"
                        >
                            {isVirtualSinger(birthday.id)
                                ? t("page.home.hero.anniversaryGreeting", { name: birthday.name })
                                : t("page.home.hero.birthdayGreeting", { name: birthday.name })}
                        </h3>
                        {card && card.cardRarityType === "rarity_birthday" && (
                            <p className="text-xs lg:text-sm text-white/60 mt-1 font-medium">
                                🎉 {card.prefix}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
