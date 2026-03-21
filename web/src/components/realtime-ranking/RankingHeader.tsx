"use client";

import { RealtimeRankingRegion } from "@/types/realtime-ranking";

interface RankingHeaderProps {
    region: RealtimeRankingRegion;
    onRegionChange: (region: RealtimeRankingRegion) => void;
    updatedAt?: number;
    eventId?: number;
    totalEntries: number;
    isRefreshing: boolean;
    countdown: number;
    hasRecentUpdate: boolean;
}

export default function RankingHeader({ region, onRegionChange, updatedAt, eventId, totalEntries, isRefreshing, countdown, hasRecentUpdate }: RankingHeaderProps) {
    return (
        <div className="glass-card rounded-2xl p-5 sm:p-6 mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">实时排行榜</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        实时 <span className="text-miku">榜单</span>
                    </h1>
                    <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
                        每 10 秒自动刷新一次，支持查看排名变化与分数变动提示。
                    </p>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                        {(["cn", "jp"] as const).map((value) => (
                            <button
                                key={value}
                                onClick={() => onRegionChange(value)}
                                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${region === value ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
                            >
                                {value.toUpperCase()}
                            </button>
                        ))}
                        <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-bold transition-all ${hasRecentUpdate ? "bg-miku/15 text-miku shadow-sm shadow-miku/20 dark:bg-miku/25 dark:text-cyan-300 animate-pulse" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>
                            {isRefreshing ? "刷新中..." : `下次刷新 ${countdown}s`}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {typeof eventId === "number" && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium dark:bg-slate-800">活动 ID #{eventId}</span>
                        )}
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium dark:bg-slate-800">共 {totalEntries} 条榜线</span>
                        <span className={`rounded-full px-3 py-1 font-medium ${isRefreshing ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"}`}>
                            {isRefreshing ? "刷新中..." : "已同步"}
                        </span>
                        {updatedAt ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium dark:bg-slate-800">
                                更新于 {new Date(updatedAt).toLocaleString()}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
