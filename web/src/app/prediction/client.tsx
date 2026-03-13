"use client";
import React, { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import PredictionChart from "@/components/events/PredictionChart";
import PGAIChart from "@/components/events/PGAIChart";
import Sparkline from "@/components/events/Sparkline";
import ActivityStats from "@/components/events/ActivityStats";
import { fetchPredictionData, fetchEventList } from "@/lib/prediction-api";
import { PredictionData, EventListItem, ServerType, RankChart, TierKLine } from "@/types/prediction";
import { IEventInfo, getEventStatus, EVENT_TYPE_NAMES, EVENT_STATUS_DISPLAY } from "@/types/events";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getEventBannerUrl, getEventLogoUrl } from "@/lib/assets";

interface LegacyTierKline {
    rank: number;
    ChangePct?: number;
    changePct?: number;
    Speed?: number;
    speed?: number;
    CurrentIndex?: number;
    currentIndex?: number;
}

// Available rank tiers
const RANK_TIERS = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 5000, 10000];

export default function PredictionClient() {
    const { assetSource, themeColor } = useTheme();
    const [server, setServer] = useState<ServerType>('cn');
    const [events, setEvents] = useState<EventListItem[]>([]);
    const [masterEvents, setMasterEvents] = useState<IEventInfo[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
    const [selectedRank, setSelectedRank] = useState<number>(100);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [eventsLoading, setEventsLoading] = useState(true);

    // Live Clock for relative time & progress
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch master data for assets
    useEffect(() => {
        fetchMasterData<IEventInfo[]>("events.json").then(setMasterEvents).catch(console.error);
    }, []);

    // Handle server switch safely
    const handleServerChange = (newServer: ServerType) => {
        if (newServer === server) return;
        setEventsLoading(true);
        setError(null);
        setServer(newServer);
        setSelectedEventId(null); // Clear selection to prevent invalid fetch
        setEvents([]); // Clear list
        setPredictionData(null); // Clear data
    };

    const handleEventChange = (eventId: number) => {
        setError(null);
        setLoading(true);
        setSelectedEventId(eventId);
    };

    // Fetch events list when server changes
    useEffect(() => {
        fetchEventList(server)
            .then(data => {
                if (!Array.isArray(data)) {
                    setEvents([]);
                    // If data is invalid, selectedEventId stays null
                    return;
                }
                // Sort: active first, then by ID descending (latest first)
                const sortedEvents = [...data].sort((a, b) => {
                    if (a.is_active && !b.is_active) return -1;
                    if (!a.is_active && b.is_active) return 1;
                    return b.id - a.id;
                });
                setEvents(sortedEvents);

                // If no event selected (e.g. after server switch), select default
                if (!selectedEventId) {
                    const activeEvent = sortedEvents.find(e => e.is_active);
                    const latestEvent = sortedEvents[0];
                    const defaultEventId = activeEvent?.id || latestEvent?.id || null;
                    if (defaultEventId) {
                        setLoading(true);
                        setError(null);
                        setSelectedEventId(defaultEventId);
                    }
                }
            })
            .catch(err => {
                console.error('Failed to fetch events:', err);
                setError('获取活动列表失败');
                setEvents([]);
            })
            .finally(() => setEventsLoading(false));
    }, [server]);

    // Fetch prediction data when event changes
    useEffect(() => {
        if (!selectedEventId) {
            return;
        }

        fetchPredictionData(selectedEventId, server)
            .then(data => {
                setPredictionData(data);
            })
            .catch(err => {
                console.error('Failed to fetch prediction:', err);
                setError('获取预测数据失败，该活动可能暂无数据');
                setPredictionData(null);
            })
            .finally(() => setLoading(false));
    }, [selectedEventId, server]);

    // Process chart data (trim 1% from start/end) - Replacing original currentChart definition
    const currentChart = useMemo(() => {
        const raw = predictionData?.data?.charts?.find(c => c.Rank === selectedRank);
        if (!raw) return undefined;

        const trimData = (points: { t: string, y: number }[]) => {
            if (!points || points.length < 10) return points;
            const trimCount = Math.floor(points.length * 0.01);
            if (trimCount === 0) return points;
            return points.slice(trimCount, points.length - trimCount);
        };

        return {
            ...raw,
            HistoryPoints: trimData(raw.HistoryPoints),
            PredictPoints: trimData(raw.PredictPoints)
        };
    }, [predictionData, selectedRank]);

    // Get available ranks from data
    const availableRanks = predictionData?.data?.charts?.map(c => c.Rank) || [];

    // Prepare Event Banner & Status
    const eventState = useMemo(() => {
        if (!selectedEventId) return null;

        const predEvent = events.find(e => e.id == selectedEventId);
        const masterEvent = masterEvents.find(e => e.id == selectedEventId);

        if (!predEvent && !masterEvent) return null;

        const name = masterEvent?.name || predEvent?.name || "";
        const eventType = masterEvent?.eventType || "marathon";
        const assetbundleName = masterEvent?.assetbundleName || "";

        // Timestamps: Prefer Prediction Data (as it reflects current server schedule), fallback to Master Data
        const s = predEvent?.start_at ? (predEvent.start_at < 10000000000 ? predEvent.start_at * 1000 : predEvent.start_at) : masterEvent?.startAt;
        const e = predEvent?.end_at ? (predEvent.end_at < 10000000000 ? predEvent.end_at * 1000 : predEvent.end_at) : masterEvent?.aggregateAt;

        const startAt = s || 0;
        const endAt = e || 0;

        const mockEvent: IEventInfo = {
            id: selectedEventId,
            bgmAssetbundleName: "",
            eventOnlyComponentDisplayStartAt: startAt,
            name,
            eventType,
            assetbundleName,
            startAt,
            aggregateAt: endAt,
            rankingAnnounceAt: endAt,
            distributionStartAt: endAt,
            eventOnlyComponentDisplayEndAt: endAt,
            closedAt: endAt,
            distributionEndAt: endAt,
            virtualLiveId: 0,
            unit: "",
            isCountLeaderCharacterPlay: false,
        };

        const status = getEventStatus(mockEvent);
        const statusDisplay = EVENT_STATUS_DISPLAY[status];
        const eventTypeName = EVENT_TYPE_NAMES[eventType] || eventType;

        const totalDuration = endAt - startAt;
        const elapsed = Math.max(0, now - startAt);
        let progressPercent = 0;

        if (status === 'ongoing') {
            progressPercent = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
        } else if (status === 'ended') {
            progressPercent = 100;
        }


        const formatDate = (ts: number) => {
            const d = new Date(ts);
            return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
        };

        const isActive = predEvent?.is_active || (status === 'ongoing');

        // Relative Update Time
        let updateTime = null;
        if (predictionData?.timestamp) {
            const diff = now - predictionData.timestamp;
            const diffSec = Math.max(0, Math.floor(diff / 1000));
            if (diffSec < 60) updateTime = `${diffSec}秒前`;
            else if (diffSec < 3600) updateTime = `${Math.floor(diffSec / 60)}分钟前`;
            else updateTime = new Date(predictionData.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        return {
            banner: {
                mockEvent,
                status,
                statusDisplay,
                eventTypeName,
                progressPercent,
                formatDate,
                updateTime,
                hasBanner: !!assetbundleName
            },
            isActive
        };
    }, [selectedEventId, events, masterEvents, predictionData, now]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Page Header - matching events page style */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">榜线预测</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        活动 <span className="text-miku">预测</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                        实时榜线预测与PGAI全服积极指数
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center sm:items-stretch">
                    {/* Server Toggle */}
                    <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                        <button
                            onClick={() => handleServerChange('cn')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${server === 'cn'
                                ? 'bg-miku text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            国服
                        </button>
                        <button
                            onClick={() => handleServerChange('jp')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${server === 'jp'
                                ? 'bg-miku text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            日服
                        </button>
                    </div>

                    {/* Event Selector */}
                    <div className="flex-1">
                        <select
                            value={selectedEventId || ''}
                            onChange={(e) => handleEventChange(Number(e.target.value))}
                            disabled={eventsLoading || events.length === 0}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku disabled:opacity-50"
                        >
                            {eventsLoading ? (
                                <option>加载活动列表...</option>
                            ) : events.length === 0 ? (
                                <option>暂无活动数据</option>
                            ) : (
                                events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.is_active ? '🟢 ' : ''}#{event.id} {event.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    {/* Warning for >99% progress */}
                    {eventState && eventState.isActive && eventState.banner.progressPercent >= 99 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm w-full sm:w-auto justify-center sm:justify-start shrink-0"
                            style={{
                                borderColor: `${themeColor}40`,
                                backgroundColor: `${themeColor}10`,
                            }}>
                            <div
                                className="w-6 h-6 shrink-0"
                                style={{
                                    backgroundColor: themeColor,
                                    maskImage: `url(/miku.webp)`,
                                    maskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskImage: `url(/miku.webp)`,
                                    WebkitMaskSize: 'contain',
                                    WebkitMaskRepeat: 'no-repeat',
                                    WebkitMaskPosition: 'center',
                                }}
                            />
                            <span className="text-sm font-medium whitespace-nowrap" style={{ color: themeColor }}>
                                活动结束前数小时 Snowy停止预测
                            </span>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin" />
                            <span className="text-slate-500">加载预测数据...</span>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {!loading && predictionData && (
                    <div className="space-y-6">
                        {/* Event Banner */}
                        {eventState && (() => {
                            const { banner, isActive } = eventState;
                            return (
                                <>
                                    <Link href={`/events/${banner.mockEvent.id}`} className="block group mb-6">
                                        <div className="relative flex h-32 md:h-36 rounded-2xl overflow-hidden glass-card border border-white/40 bg-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] hover:shadow-md cursor-pointer">
                                            {/* Link wrapper could be added here if needed */}

                                            {/* Left Side: Background & Logo */}
                                            <div className="w-[45%] relative overflow-hidden">
                                                {banner.hasBanner ? (
                                                    <>
                                                        <div className="absolute inset-0">
                                                            <Image
                                                                src={getEventBannerUrl(banner.mockEvent.assetbundleName, assetSource)}
                                                                alt={banner.mockEvent.name}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                            <div className="absolute inset-0 bg-black/50" />
                                                        </div>
                                                        <div className="absolute inset-0 flex items-center justify-center p-2">
                                                            <div className="relative w-full h-full max-h-20 sm:max-h-24">
                                                                <Image
                                                                    src={getEventLogoUrl(banner.mockEvent.assetbundleName, assetSource)}
                                                                    alt=""
                                                                    fill
                                                                    className="object-contain drop-shadow-2xl"
                                                                    unoptimized
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
                                                {banner.status === "ongoing" && (
                                                    <div
                                                        className="absolute inset-y-0 left-0 transition-all duration-500 ease-out z-0 pointer-events-none"
                                                        style={{
                                                            width: `${banner.progressPercent}%`,
                                                            backgroundColor: themeColor,
                                                            opacity: 0.12
                                                        }}
                                                    />
                                                )}

                                                <div className="space-y-1 relative z-20">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span
                                                            className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded text-white shadow-sm"
                                                            style={{ backgroundColor: banner.statusDisplay.color }}
                                                        >
                                                            {banner.statusDisplay.label}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {banner.eventTypeName}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-primary-text text-sm sm:text-base leading-tight line-clamp-1" title={banner.mockEvent.name}>
                                                        {banner.mockEvent.name}
                                                    </h3>
                                                    <div className="pt-2 text-[10px] sm:text-xs text-slate-400 font-mono flex flex-col sm:flex-row sm:gap-2">
                                                        <span>{banner.formatDate(banner.mockEvent.startAt)}</span>
                                                        <span className="hidden sm:inline">-</span>
                                                        <span>{banner.formatDate(banner.mockEvent.aggregateAt)}</span>
                                                    </div>
                                                    {banner.updateTime && (
                                                        <div className="text-[10px] sm:text-xs text-slate-500/80 font-mono mt-0.5">
                                                            Data Update: {banner.updateTime}
                                                        </div>
                                                    )}
                                                </div>

                                                {banner.status === "ongoing" && (
                                                    <div className="absolute bottom-0 right-2 text-4xl sm:text-5xl font-black text-black dark:text-white select-none z-10 tracking-tighter">
                                                        {Math.floor(banner.progressPercent)}<span className="text-2xl ml-1">%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Link>


                                    {/* Row 1: PGAI + Activity Stats (Only if Active) */}
                                    {isActive && (
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[320px] mb-6">
                                            <div className="lg:col-span-2 h-[320px] lg:h-full">
                                                {predictionData.data.global_kline && (
                                                    <PGAIChart
                                                        globalKline={predictionData.data.global_kline}
                                                        height={undefined} // Let flex/grid handle height
                                                    />
                                                )}
                                            </div>
                                            <div className="h-auto lg:h-full">
                                                {predictionData.data.tier_klines && (
                                                    <ActivityStats tiers={predictionData.data.tier_klines} />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Row 2: Prediction List / Table */}
                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden mb-6">
                                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                            <h3 className="font-bold text-slate-700">
                                                {isActive ? '各榜线预测一览' : '活动最终结榜分数'}
                                            </h3>
                                            {isActive && <span className="text-xs text-slate-400">点击行可查看底部详情</span>}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-slate-500 font-medium w-24">榜线</th>
                                                        <th className="px-4 py-3 text-right text-slate-500 font-medium">
                                                            {isActive ? '当前分数' : '最终分数'}
                                                        </th>
                                                        {isActive && <th className="px-4 py-3 text-right text-slate-500 font-medium">预测分数</th>}
                                                        {isActive && <th className="px-4 py-3 text-right text-slate-500 font-medium">差距</th>}
                                                        {isActive && <th className="px-4 py-3 text-right text-slate-500 font-medium">速度</th>}
                                                        {isActive && <th className="px-4 py-3 text-center text-slate-500 font-medium w-32">趋势</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {predictionData.data.charts?.map(chart => {
                                                        // Handle case-sensitivity or missing data
                                                        const rank = chart.Rank;
                                                        // Try strict and loose matching
                                                        const legacyTierKlines = (predictionData.data as PredictionData["data"] & {
                                                            tierKlines?: LegacyTierKline[];
                                                        }).tierKlines;
                                                        const legacyTier = legacyTierKlines?.find((t) => t.rank == rank);
                                                        const tierStats: TierKLine | undefined = predictionData.data.tier_klines?.find((t) => t.Rank == rank)
                                                            || (legacyTier
                                                                ? {
                                                                    Rank: legacyTier.rank,
                                                                    Data: [],
                                                                    CurrentIndex: legacyTier.CurrentIndex ?? legacyTier.currentIndex ?? 0,
                                                                    Speed: legacyTier.Speed ?? legacyTier.speed ?? 0,
                                                                    ChangePct: legacyTier.ChangePct ?? legacyTier.changePct ?? 0,
                                                                }
                                                                : undefined);

                                                        const totalLen = chart.HistoryPoints.length;
                                                        const trimCount = Math.floor(totalLen * 0.01);
                                                        const historyData = chart.HistoryPoints.slice(trimCount, totalLen - trimCount).map(p => p.y);

                                                        const predLen = chart.PredictPoints?.length || 0;
                                                        const predTrim = Math.floor(predLen * 0.01);
                                                        const predictData = chart.PredictPoints?.slice(predTrim, predLen - predTrim).map(p => p.y) || [];

                                                        // Determine colors
                                                        const trendColor = tierStats && tierStats.ChangePct < 0 ? '#10b981' : '#ef4444';

                                                        return (
                                                            <tr
                                                                key={chart.Rank}
                                                                className={`border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors ${isActive && chart.Rank === selectedRank ? 'bg-miku/5' : ''
                                                                    }`}
                                                                onClick={() => isActive && setSelectedRank(chart.Rank)}
                                                            >
                                                                <td className="px-4 py-3 font-bold text-miku">T{chart.Rank}</td>
                                                                <td className="px-4 py-3 text-right text-slate-700 font-mono font-bold">
                                                                    {chart.CurrentScore.toLocaleString()}
                                                                </td>
                                                                {isActive && (
                                                                    <>
                                                                        <td className="px-4 py-3 text-right text-amber-600 font-mono font-bold">
                                                                            {chart.Rank > 10000 ? '-' : chart.PredictedScore.toLocaleString()}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right text-slate-500 font-mono">
                                                                            {chart.Rank > 10000 ? '-' : `+${(chart.PredictedScore - chart.CurrentScore).toLocaleString()}`}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-mono">
                                                                            {tierStats ? (
                                                                                <div className="flex flex-col items-end">
                                                                                    <span className="text-slate-700">{tierStats.Speed?.toLocaleString() ?? '-'} /h</span>
                                                                                    <span className={`text-[10px] ${tierStats.ChangePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                                        {tierStats.ChangePct >= 0 ? '+' : ''}{tierStats.ChangePct?.toFixed(1) ?? '0'}%
                                                                                    </span>
                                                                                </div>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="flex justify-center items-center">
                                                                                <Sparkline
                                                                                    data={historyData}
                                                                                    prediction={(predictData.length > 0 && chart.Rank <= 10000) ? predictData : undefined}
                                                                                    color={trendColor}
                                                                                    width={100}
                                                                                    height={30}
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Row 3: Large Detailed Chart (Only if Active) */}
                                    {isActive && (
                                        <div id="detailed-chart" className="scroll-mt-24 mb-6">
                                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                    <h3 className="text-lg font-bold text-slate-800 shrink-0">
                                                        T{selectedRank} 详细趋势预测
                                                    </h3>
                                                    {/* Rank Selector for Chart */}
                                                    <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto sm:flex-wrap sm:justify-end no-scrollbar">
                                                        {(availableRanks.length > 0 ? availableRanks : RANK_TIERS).map(rank => (
                                                            <button
                                                                key={rank}
                                                                onClick={() => setSelectedRank(rank)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 snap-start ${selectedRank === rank
                                                                    ? 'bg-miku text-white shadow-lg shadow-miku/20'
                                                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                T{rank}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {currentChart ? (
                                                    <PredictionChart data={currentChart} className="h-[350px] sm:h-[450px]" />
                                                ) : (
                                                    <div className="h-[350px] sm:h-[450px] flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl">
                                                        暂无 T{selectedRank} 榜线数据
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* Footer Sources */}
                                    <div className="text-center text-xs text-slate-400 pb-8 space-y-1">
                                        <p>榜线来源：Haruki</p>
                                        <p>预测来源：AkiYome v1.2.0-Uta（诗）</p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )
                }

                {/* Empty State */}
                {
                    !loading && !predictionData && !error && selectedEventId && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p>请选择一个活动查看预测数据</p>
                        </div>
                    )
                }
            </div >
        </MainLayout >
    );
}
