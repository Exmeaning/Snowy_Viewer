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
        <Link href={`${basePath}/${event.id}`} className="group block select-none" data-shortcut-item="true">
            {/* Interactive Event Card with full accent mask on hover and snappy spring physics */}
            <div className="hh-card-item relative cursor-pointer overflow-hidden">
                {/* Event Logo */}
                <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)] overflow-hidden">
                    <Image
                        src={thumbnailUrl}
                        alt={event.name}
                        fill
                        className={`object-contain ${hasEventStoryBanner ? "" : "p-4"}`}
                        unoptimized
                    />

                    {/* Status Badge — status color is semantic and stays as-is. */}
                    <div
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] sm:text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {t(`common.status.${status}`)}
                    </div>

                    {/* Event Type Badge — event-type color is semantic and stays. */}
                    <div
                        className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] sm:text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                    >
                        {t(`common.eventTypes.${event.eventType}`)}
                    </div>

                    {/* Spoiler Badge */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 px-1.5 sm:px-2 py-0.5 bg-orange-500 text-white text-[10px] sm:text-xs font-bold rounded-[var(--hh-radius-xs)] shadow-sm">
                            {t("common.badge.spoiler")}
                        </div>
                    )}
                </div>

                {/* Event Info Footer with Full Accent Mask */}
                <div className="hh-card-footer p-2.5 sm:p-3">
                    {/* ID Badge + Unit Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                        <span className="hh-numeric px-1.5 sm:px-2 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] text-[10px] sm:text-xs rounded-[var(--hh-radius-xs)] transition-colors leading-none">
                            #{event.id}
                        </span>
                        {unitType && (
                            EVENT_UNIT_ICON[unitType] ? (
                                <div className="w-5 h-5 rounded-full bg-[var(--hh-surface-sunken)] flex items-center justify-center transition-colors" title={t(EVENT_UNIT_ICON[unitType].labelKey)}>
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
                                <span className="px-1.5 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] text-[10px] font-bold rounded-[var(--hh-radius-xs)] transition-colors" title={t("common.badge.mixed")}>{t("common.badge.mixed")}</span>
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
                    <h3 className="hh-title text-xs sm:text-sm font-bold text-[var(--hh-text-primary)] mb-1 leading-snug">
                        <TranslatedText
                            original={event.name}
                            category="events"
                            field="name"
                            originalClassName="hh-card-title block truncate"
                            translationClassName="hh-body text-[10px] sm:text-xs font-medium text-[var(--hh-text-tertiary)] mt-0.5 block truncate"
                        />
                    </h3>

                    {/* Date Range */}
                    <div className="hh-body text-[10px] sm:text-xs text-[var(--hh-text-secondary)] space-y-0.5 hidden sm:block">
                        <div className="flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="hh-numeric">{formatDate(event.startAt)}</span>
                            <span>~</span>
                            <span className="hh-numeric">{formatDate(event.aggregateAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
