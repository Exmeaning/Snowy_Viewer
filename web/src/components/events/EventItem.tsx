"use client";
import Link from "next/link";
import Image from "next/image";
import { IEventInfo, EVENT_TYPE_NAMES, EVENT_TYPE_COLORS, getEventStatus, EVENT_STATUS_DISPLAY, EventType } from "@/types/events";
import { getEventLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

interface EventItemProps {
    event: IEventInfo;
    isSpoiler?: boolean;
}

export default function EventItem({ event, isSpoiler }: EventItemProps) {
    const { assetSource } = useTheme();
    const logoUrl = getEventLogoUrl(event.assetbundleName, assetSource);
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
        <Link href={`/events/${event.id}`} className="group block">
            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:ring-miku/30">
                {/* Event Logo */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                    <Image
                        src={logoUrl}
                        alt={event.name}
                        fill
                        className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                    />

                    {/* Status Badge */}
                    <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {statusDisplay.label}
                    </div>

                    {/* Event Type Badge */}
                    <div
                        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                    >
                        {EVENT_TYPE_NAMES[event.eventType as EventType]}
                    </div>

                    {/* Spoiler Badge - Bottom Right */}
                    {isSpoiler && (
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-orange-500 rounded-full text-xs font-bold text-white shadow">
                            剧透
                        </div>
                    )}
                </div>

                {/* Event Info */}
                <div className="p-4">
                    {/* ID Badge */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded-full">
                            #{event.id}
                        </span>
                    </div>

                    {/* Event Name */}
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-2 mb-2 group-hover:text-miku transition-colors">
                        {event.name}
                    </h3>

                    {/* Date Range */}
                    <div className="text-xs text-slate-500 space-y-0.5">
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
