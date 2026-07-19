"use client";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { IEventInfo, EVENT_TYPE_COLORS, getEventStatus, EVENT_STATUS_DISPLAY, EventType } from "@/types/events";
import { getEventStoryBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { TranslatedText } from "@/components/common/TranslatedText";
import { UNIT_DATA, UNIT_ICON_FILES, UNIT_ID_LABEL_KEYS, ATTR_ICON_PATHS, ATTR_NAMES } from "@/types/types";
import { useI18n } from "@/contexts/I18nContext";

// Build unit icon mapping from UNIT_DATA
const EVENT_UNIT_ICON: Record<string, { icon: string; labelKey: string }> = Object.fromEntries(
    UNIT_DATA.filter(u => UNIT_ICON_FILES[u.id]).map(u => [u.id, { icon: UNIT_ICON_FILES[u.id], labelKey: UNIT_ID_LABEL_KEYS[u.id] ?? `common.units.${u.id}` }])
);

interface EventItemProps {
    event: IEventInfo;
    isSpoiler?: boolean;
    basePath?: string;
    unitType?: string;
    bonusAttr?: string;
    eventStoryIds?: Set<number>;
}

export default function EventItem({ event, isSpoiler, basePath = "/events", unitType, bonusAttr, eventStoryIds }: EventItemProps) {
    const { assetSource } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const hasEventStoryBanner = eventStoryIds ? eventStoryIds.has(event.id) : true;
    const thumbnailUrl = hasEventStoryBanner
        ? getEventStoryBannerUrl(event.assetbundleName, assetSource)
        : getEventLogoUrl(event.assetbundleName, assetSource);
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];

    // Format dates
    const formatDate = (timestamp: number) => formatLocaleDate(timestamp, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <Link href={`${basePath}/${event.id}`} className="group pressable block" data-shortcut-item="true">
            <div className="ios-glass-card ios-glass-card-interactive rounded-2xl overflow-hidden cursor-pointer">
                {/* Event Logo */}
                <div className="relative aspect-[16/9] bg-slate-100/50 dark:bg-slate-800/40 overflow-hidden">
                    <Image
                        src={thumbnailUrl}
                        alt={event.name}
                        fill
                        className={`object-contain transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-soft)] group-hover:scale-105 ${hasEventStoryBanner ? "" : "p-4"}`}
                        unoptimized
                    />

                    {/* Status Badge */}
                    <div
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {t(`common.status.${status}`)}
                    </div>

                    {/* Event Type Badge */}
                    <div
                        className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                    >
                        {t(`common.eventTypes.${event.eventType}`)}
                    </div>

                    {/* Spoiler Badge - Bottom Right */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 sm:px-2 py-0.5 bg-orange-500 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm animate-pulse">
                            {t("common.badge.spoiler")}
                        </div>
                    )}
                </div>

                {/* Event Info */}
                <div className="p-2.5 sm:p-4">
                    {/* ID Badge + Unit Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <span className="px-1.5 sm:px-2 py-0.5 ios-glass-tab text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-mono rounded-full">
                            #{event.id}
                        </span>
                        {unitType && (
                            EVENT_UNIT_ICON[unitType] ? (
                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center" title={t(EVENT_UNIT_ICON[unitType].labelKey)}>
                                    <Image
                                        src={`/data/icon/${EVENT_UNIT_ICON[unitType].icon}`}
                                        alt={t(EVENT_UNIT_ICON[unitType].labelKey)}
                                        width={16}
                                        height={16}
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full" title={t("common.badge.mixed")}>{t("common.badge.mixed")}</span>
                            )
                        )}
                        {bonusAttr && ATTR_ICON_PATHS[bonusAttr as keyof typeof ATTR_ICON_PATHS] && (
                            <div className="w-5 h-5 flex items-center justify-center" title={ATTR_NAMES[bonusAttr as keyof typeof ATTR_NAMES]}>
                                <Image
                                    src={`/data/icon/${ATTR_ICON_PATHS[bonusAttr as keyof typeof ATTR_ICON_PATHS]}`}
                                    alt={ATTR_NAMES[bonusAttr as keyof typeof ATTR_NAMES] || bonusAttr}
                                    width={16}
                                    height={16}
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>

                    {/* Event Name */}
                    <h3 className="type-title font-bold text-slate-800 text-xs sm:text-sm mb-1.5 sm:mb-2 group-hover:text-miku">
                        <TranslatedText
                            original={event.name}
                            category="events"
                            field="name"
                            originalClassName=""
                            translationClassName="text-xs type-caption font-medium text-slate-400 mt-0.5"
                        />
                    </h3>

                    {/* Date Range */}
                    <div className="text-[10px] sm:text-xs type-caption text-slate-500 space-y-0.5 hidden sm:block">
                        <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{formatDate(event.startAt)}</span>
                            <span>~</span>
                            <span>{formatDate(event.aggregateAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
