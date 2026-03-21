"use client";

import Link from "next/link";
import Image from "next/image";
import { IEventInfo, getEventStatus, EVENT_TYPE_NAMES, EVENT_STATUS_DISPLAY } from "@/types/events";
import { getEventBannerUrl, getEventLogoUrl } from "@/lib/assets";
import { AssetSourceType } from "@/contexts/ThemeContext";

interface CurrentEventCardProps {
    event: IEventInfo | null;
    assetSource: AssetSourceType;
    regionLabel: string;
}

function formatDate(ts: number) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function CurrentEventCard({ event, assetSource, regionLabel }: CurrentEventCardProps) {
    if (!event) return null;

    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];
    const eventTypeName = EVENT_TYPE_NAMES[event.eventType] || event.eventType;
    const now = Date.now();
    const totalDuration = event.aggregateAt - event.startAt;
    const elapsed = Math.max(0, now - event.startAt);
    const progressPercent = status === "ongoing" && totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : status === "ended" ? 100 : 0;

    return (
        <Link href={`/events/${event.id}`} className="group block mb-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
                <div className="grid gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="relative min-h-[180px] overflow-hidden">
                        <Image
                            src={getEventBannerUrl(event.assetbundleName, assetSource)}
                            alt={event.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-transparent md:bg-gradient-to-t md:from-black/55 md:via-black/15 md:to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center p-5">
                            <div className="relative h-24 w-full max-w-[240px]">
                                <Image
                                    src={getEventLogoUrl(event.assetbundleName, assetSource)}
                                    alt=""
                                    fill
                                    className="object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
                                    unoptimized
                                />
                            </div>
                        </div>
                    </div>

                    <div className="relative p-5 sm:p-6">
                        {status === "ongoing" && (
                            <div className="absolute inset-y-0 left-0 z-0 bg-miku/10 dark:bg-miku/8" style={{ width: `${progressPercent}%` }} />
                        )}

                        <div className="relative z-10 flex h-full flex-col justify-between gap-4">
                            <div>
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: statusDisplay.color }}>
                                        {statusDisplay.label}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {regionLabel}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {eventTypeName}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        活动 #{event.id}
                                    </span>
                                </div>

                                <h2 className="text-xl sm:text-2xl font-black text-primary-text leading-tight group-hover:text-miku transition-colors">
                                    {event.name}
                                </h2>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    当前活动榜线会每 10 秒自动刷新，点击可前往活动详情页查看完整资料。
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                                    <div>开始时间：<span className="font-medium text-slate-700 dark:text-slate-200">{formatDate(event.startAt)}</span></div>
                                    <div>结束时间：<span className="font-medium text-slate-700 dark:text-slate-200">{formatDate(event.aggregateAt)}</span></div>
                                </div>

                                <div className="text-right">
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">活动进度</div>
                                    <div className="mt-1 text-3xl sm:text-4xl font-black text-primary-text">
                                        {Math.floor(progressPercent)}<span className="ml-1 text-base sm:text-lg font-bold text-slate-400 dark:text-slate-500">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
