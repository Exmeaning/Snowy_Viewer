"use client";
import Link from "next/link";
import Image from "next/image";
import { IEventInfo, EVENT_TYPE_NAMES, EVENT_TYPE_COLORS, getEventStatus, EVENT_STATUS_DISPLAY, EventType } from "@/types/events";
import { getEventStoryBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { TranslatedText } from "@/components/common/TranslatedText";
import { UNIT_DATA, UNIT_ICON_FILES, ATTR_ICON_PATHS, ATTR_NAMES } from "@/types/types";

// Build unit icon mapping from UNIT_DATA
const EVENT_UNIT_ICON: Record<string, { icon: string; name: string }> = Object.fromEntries(
    UNIT_DATA.filter(u => UNIT_ICON_FILES[u.id]).map(u => [u.id, { icon: UNIT_ICON_FILES[u.id], name: u.name }])
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
    const hasEventStoryBanner = eventStoryIds ? eventStoryIds.has(event.id) : true;
    const thumbnailUrl = hasEventStoryBanner
        ? getEventStoryBannerUrl(event.assetbundleName, assetSource)
        : getEventLogoUrl(event.assetbundleName, assetSource);
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];

    // Format dates
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <Link href={`${basePath}/${event.id}`} className="group block" data-shortcut-item="true">
            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:ring-miku/30">
                {/* Event Logo */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                    <Image
                        src={thumbnailUrl}
                        alt={event.name}
                        fill
                        className={`object-contain transition-transform duration-300 group-hover:scale-105 ${hasEventStoryBanner ? "" : "p-4"}`}
                        unoptimized
                    />

                    {/* Status Badge */}
                    <div
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {statusDisplay.label}
                    </div>

                    {/* Event Type Badge */}
                    <div
                        className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                    >
                        {EVENT_TYPE_NAMES[event.eventType as EventType]}
                    </div>

                    {/* Spoiler Badge - Bottom Right */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 sm:px-2 py-0.5 bg-orange-500 rounded-full text-[10px] sm:text-xs font-bold text-white shadow">
                            剧透
                        </div>
                    )}
                </div>

                {/* Event Info */}
                <div className="p-2.5 sm:p-4">
                    {/* ID Badge + Unit Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] sm:text-xs font-mono rounded-full">
                            #{event.id}
                        </span>
                        {unitType && (
                            EVENT_UNIT_ICON[unitType] ? (
                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center" title={EVENT_UNIT_ICON[unitType].name}>
                                    <Image
                                        src={`/data/icon/${EVENT_UNIT_ICON[unitType].icon}`}
                                        alt={EVENT_UNIT_ICON[unitType].name}
                                        width={16}
                                        height={16}
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full" title="混合">混</span>
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
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm mb-1.5 sm:mb-2 group-hover:text-miku transition-colors">
                        <TranslatedText
                            original={event.name}
                            category="events"
                            field="name"
                            originalClassName=""
                            translationClassName="text-xs font-medium text-slate-400 mt-0.5"
                        />
                    </h3>

                    {/* Date Range */}
                    <div className="text-[10px] sm:text-xs text-slate-500 space-y-0.5 hidden sm:block">
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
