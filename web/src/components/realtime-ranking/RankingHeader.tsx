"use client";

import { RealtimeRankingRegion } from "@/types/realtime-ranking";

interface RankingHeaderProps {
    region: RealtimeRankingRegion;
    onRegionChange: (region: RealtimeRankingRegion) => void;
    updatedAt?: number;
    eventId?: number;
    totalEntries: number;
    isRefreshing: boolean;
}

export default function RankingHeader({ region, onRegionChange, updatedAt, eventId, totalEntries, isRefreshing }: RankingHeaderProps) {
    return (
        <>
            {/* Page Header - matching prediction page style */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">实时排行榜</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    实时 <span className="text-miku">榜单</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    每 10 秒自动刷新一次，支持查看排名变化与分数变动提示。
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center sm:items-stretch">
                {/* Region Toggle */}
                <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                    {(["cn", "jp"] as const).map((value) => (
                        <button
                            key={value}
                            onClick={() => onRegionChange(value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${region === value
                                ? "bg-miku text-white shadow-md"
                                : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {value === "cn" ? "国服" : "日服"}
                        </button>
                    ))}
                </div>

                {/* Status Tags */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typeof eventId === "number" && (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">活动 #{eventId}</span>
                    )}
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">共 {totalEntries} 条榜线</span>
                    <span className={`rounded-full px-3 py-1.5 font-medium ${isRefreshing
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                        }`}>
                        {isRefreshing ? "刷新中..." : "已同步"}
                    </span>
                    {updatedAt ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">
                            更新于 {new Date(updatedAt).toLocaleString()}
                        </span>
                    ) : null}
                </div>
            </div>
        </>
    );
}
