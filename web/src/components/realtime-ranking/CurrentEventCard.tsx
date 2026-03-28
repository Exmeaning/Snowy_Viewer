"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { IEventInfo, getEventStatus, EVENT_TYPE_NAMES, EVENT_STATUS_DISPLAY } from "@/types/events";
import { getEventBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface CurrentEventCardProps {
    event: IEventInfo | null;
    assetSource: AssetSourceType;
    themeColor: string;
}

function formatDate(ts: number) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function CurrentEventCard({ event, assetSource, themeColor }: CurrentEventCardProps) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!event || getEventStatus(event) !== "ongoing") {
            return;
        }

        const timer = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, [event]);

    if (!event) return null;

    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];
    const eventTypeName = EVENT_TYPE_NAMES[event.eventType] || event.eventType;
    const hasBanner = !!event.assetbundleName;
    const totalDuration = event.aggregateAt - event.startAt;
    const elapsed = Math.max(0, now - event.startAt);
    let progressPercent = 0;
    if (status === "ongoing") {
        progressPercent = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
    } else if (status === "ended") {
        progressPercent = 100;
    }

    return (
        <Link href={`/events/${event.id}`} className="block group mb-6">
            <div className="relative flex h-32 md:h-36 rounded-2xl overflow-hidden glass-card border border-white/40 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] hover:shadow-md cursor-pointer">
                {/* Left Side: Background & Logo */}
                <div className="w-[45%] relative overflow-hidden">
                    {hasBanner ? (
                        <>
                            <div className="absolute inset-0">
                                <Image
                                    src={getEventBannerUrl(event.assetbundleName, assetSource)}
                                    alt={event.name}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                                <div className="absolute inset-0 bg-black/50" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center p-2">
                                <div className="relative w-full h-full max-h-20 sm:max-h-24">
                                    <Image
                                        src={getEventLogoUrl(event.assetbundleName, assetSource)}
                                        alt=""
                                        fill
                                        className="object-contain drop-shadow-2xl"
                                        unoptimized
                                        loading="eager"
                                        fetchPriority="high"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-miku to-blue-400 flex items-center justify-center text-white/20 font-bold text-4xl">
                            NO IMAGE
                        </div>
                    )}
                </div>

                {/* Right Side: Info */}
                <div className="w-[55%] relative flex flex-col justify-center p-3 sm:p-4 z-10 overflow-hidden">
                    {/* Progress Overlay */}
                    {status === "ongoing" && (
                        <div
                            className="absolute inset-y-0 left-0 transition-all duration-500 ease-out z-0 pointer-events-none"
                            style={{
                                width: `${progressPercent}%`,
                                backgroundColor: themeColor,
                                opacity: 0.12,
                            }}
                        />
                    )}

                    <div className="space-y-1 relative z-20">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span
                                className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm"
                                style={{ backgroundColor: statusDisplay.color }}
                            >
                                {statusDisplay.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                {eventTypeName}
                            </span>
                        </div>
                        <h3 className="font-bold text-primary-text text-sm sm:text-base leading-tight line-clamp-1" title={event.name}>
                            {event.name}
                        </h3>
                        <div className="pt-2 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono flex flex-col sm:flex-row sm:gap-2">
                            <span>{formatDate(event.startAt)}</span>
                            <span className="hidden sm:inline">-</span>
                            <span>{formatDate(event.aggregateAt)}</span>
                        </div>
                    </div>

                    {status === "ongoing" && (
                        <div className="absolute bottom-0 right-2 text-4xl sm:text-5xl font-black text-black dark:text-white select-none z-10 tracking-tighter">
                            {Math.floor(progressPercent)}<span className="text-2xl ml-1">%</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
