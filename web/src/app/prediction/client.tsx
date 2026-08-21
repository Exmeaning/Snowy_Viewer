"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import Modal from "@/components/common/Modal";
import PredictionChart from "@/components/events/PredictionChart";
import PGAIChart from "@/components/events/PGAIChart";
import Sparkline from "@/components/events/Sparkline";
import ActivityStats from "@/components/events/ActivityStats";
import { useI18n } from "@/contexts/I18nContext";
import { fetchPredictionData, fetchEventList } from "@/lib/prediction-api";
import { PredictionData, EventListItem, ServerType, TierKLine } from "@/types/prediction";
import { IEventInfo, getEventStatus, EVENT_STATUS_DISPLAY } from "@/types/events";
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
    const { t, formatDate, formatNumber } = useI18n();
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
    const [isWlNoticeOpen, setIsWlNoticeOpen] = useState(false);

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
                setError(t("page.prediction.errors.eventsFetchFailed"));
                setEvents([]);
            })
            .finally(() => setEventsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [server, t]);

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
                setError(t("page.prediction.errors.predictionFetchFailed"));
                setPredictionData(null);
            })
            .finally(() => setLoading(false));
    }, [selectedEventId, server, t]);

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
        const eventTypeLabel = t(`common.eventTypes.${eventType}`);
        const eventTypeName = eventTypeLabel === `common.eventTypes.${eventType}` ? eventType : eventTypeLabel;

        const totalDuration = endAt - startAt;
        const elapsed = Math.max(0, now - startAt);
        let progressPercent = 0;

        if (status === 'ongoing') {
            progressPercent = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
        } else if (status === 'ended') {
            progressPercent = 100;
        }


        const formatEventDate = (ts: number) => formatDate(ts, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        const isActive = predEvent?.is_active || (status === 'ongoing');

        // Relative Update Time
        let updateTime = null;
        if (predictionData?.timestamp) {
            const diff = now - predictionData.timestamp;
            const diffSec = Math.max(0, Math.floor(diff / 1000));
            if (diffSec < 60) updateTime = t("page.prediction.relativeTime.secondsAgo", { seconds: diffSec });
            else if (diffSec < 3600) updateTime = t("page.prediction.relativeTime.minutesAgo", { minutes: Math.floor(diffSec / 60) });
            else updateTime = formatDate(predictionData.timestamp, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
        }

        return {
            banner: {
                mockEvent,
                status,
                statusDisplay,
                eventTypeName,
                progressPercent,
                formatEventDate,
                updateTime,
                hasBanner: !!assetbundleName
            },
            isActive
        };
    }, [selectedEventId, events, masterEvents, predictionData, now, t, formatDate]);

    const isWorldBloomEvent = eventState?.banner.mockEvent.eventType === "world_bloom";

     
    useEffect(() => {
        if (selectedEventId && isWorldBloomEvent) {
            setIsWlNoticeOpen(true);
            return;
        }
        setIsWlNoticeOpen(false);
    }, [selectedEventId, isWorldBloomEvent]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Page header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku text-xs">{t("page.prediction.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                        {t("page.prediction.title")} <span className="text-miku">{t("page.prediction.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                        {t("page.prediction.description")}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center sm:items-stretch">
                    {/* Server Toggle */}
                    <div className="hh-segment flex">
                        <button
                            onClick={() => handleServerChange('cn')}
                            data-selected={server === 'cn'}
                            className="hh-segment-item hh-press"
                        >
                            {t("page.prediction.servers.cn")}
                        </button>
                        <button
                            onClick={() => handleServerChange('jp')}
                            data-selected={server === 'jp'}
                            className="hh-segment-item hh-press"
                        >
                            {t("page.prediction.servers.jp")}
                        </button>
                    </div>

                    {/* Event Selector */}
                    <div className="flex-1">
                        <select
                            value={selectedEventId || ''}
                            onChange={(e) => handleEventChange(Number(e.target.value))}
                            disabled={eventsLoading || events.length === 0}
                            className="hh-input w-full px-4 py-2.5 text-sm disabled:opacity-50"
                        >
                            {eventsLoading ? (
                                <option>{t("page.prediction.events.loading")}</option>
                            ) : events.length === 0 ? (
                                <option>{t("page.prediction.events.empty")}</option>
                            ) : (
                                events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.is_active ? '🟢 ' : ''}#{event.id} {event.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    {isWorldBloomEvent && (
                        <button
                            onClick={() => setIsWlNoticeOpen(true)}
                            className="hh-press hh-focusable inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--hh-radius-md)] border border-amber-500/30 bg-amber-500/12 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/20 shrink-0"
                        >
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                            </svg>
                            {t("page.prediction.wl.noticeButton")}
                        </button>
                    )}
                    {/* Warning for >99% progress */}
                    {eventState && eventState.isActive && eventState.banner.progressPercent >= 99 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--hh-radius-md)] border w-full sm:w-auto justify-center sm:justify-start shrink-0"
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
                                {t("page.prediction.stopPredictionNotice")}
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
                            <div className="hh-spinner w-10 h-10" />
                            <span className="text-[var(--hh-text-secondary)]">{t("page.prediction.loading")}</span>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {!loading && predictionData && (
                    <div className="space-y-6">
                        {/* Event Banner */}
                        {eventState && (() => {
                            const { banner, isActive } = eventState;
                            const statusLabel = t(`common.status.${banner.status}`);
                            const fallbackStatusLabel = t(banner.statusDisplay.labelKey);
                            const resolvedStatusLabel = statusLabel === `common.status.${banner.status}` ? fallbackStatusLabel : statusLabel;
                            return (
                                <>
                                    <Link href={`/events/${banner.mockEvent.id}`} className="block group mb-6">
                                        <div className="hh-tile relative flex h-32 md:h-36 rounded-[var(--hh-radius-lg)] overflow-hidden transition-transform active:scale-[0.99] cursor-pointer">
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
                                                    <div className="absolute inset-0 bg-[var(--hh-surface-inset)] flex items-center justify-center text-[var(--hh-text-tertiary)] font-bold text-4xl">
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
                                                        {/* Status color comes from masterdata, so the label keeps
                                                            literal white to stay legible on any of those fills. */}
                                                        <span
                                                            className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-white"
                                                            style={{ backgroundColor: banner.statusDisplay.color }}
                                                        >
                                                            {resolvedStatusLabel}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-[var(--hh-text-tertiary)]">
                                                            {banner.eventTypeName}
                                                        </span>
                                                    </div>
                                                    <h3 className="hh-title font-semibold text-[var(--hh-text-primary)] text-sm sm:text-base line-clamp-1" title={banner.mockEvent.name}>
                                                        {banner.mockEvent.name}
                                                    </h3>
                                                    <div className="hh-numeric pt-2 text-[10px] sm:text-xs text-[var(--hh-text-tertiary)] flex flex-col sm:flex-row sm:gap-2">
                                                        <span>{banner.formatEventDate(banner.mockEvent.startAt)}</span>
                                                        <span className="hidden sm:inline">-</span>
                                                        <span>{banner.formatEventDate(banner.mockEvent.aggregateAt)}</span>
                                                    </div>
                                                    {banner.updateTime && (
                                                        <div className="hh-numeric text-[10px] sm:text-xs text-[var(--hh-text-secondary)] mt-0.5">
                                                            {t("page.prediction.dataUpdate", { time: banner.updateTime })}
                                                        </div>
                                                    )}
                                                </div>

                                                {banner.status === "ongoing" && (
                                                    <div className="hh-numeric hh-display absolute bottom-0 right-2 text-4xl sm:text-5xl text-[var(--hh-text-primary)] select-none z-10">
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

                                    {/* Row 2: Prediction List / Table.
                                        A tile with a sunken header strip and hairline row
                                        separators — the console list idiom, rather than one
                                        shadowed card per row. Every score/gap/speed cell is
                                        .hh-numeric so the right-aligned columns keep a stable
                                        edge as values tick during a live event; `font-mono`
                                        was doing that job before but at the cost of a
                                        different typeface inside a system-UI table. */}
                                    <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden mb-6">
                                        <div className="px-6 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-sunken)] flex justify-between items-center">
                                            <h3 className="hh-title font-semibold text-[var(--hh-text-primary)]">
                                                {isActive ? t("page.prediction.table.activeTitle") : t("page.prediction.table.finalTitle")}
                                            </h3>
                                            {isActive && <span className="text-xs text-[var(--hh-text-tertiary)]">{t("page.prediction.table.detailHint")}</span>}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-[var(--hh-surface-1)]">
                                                    <tr>
                                                        <th className="hh-label px-4 py-3 text-left w-24">{t("page.prediction.table.tier")}</th>
                                                        <th className="hh-label px-4 py-3 text-right">
                                                            {isActive ? t("page.prediction.table.currentScore") : t("page.prediction.table.finalScore")}
                                                        </th>
                                                        {isActive && <th className="hh-label px-4 py-3 text-right">{t("page.prediction.table.predictedScore")}</th>}
                                                        {isActive && <th className="hh-label px-4 py-3 text-right">{t("page.prediction.table.gap")}</th>}
                                                        {isActive && <th className="hh-label px-4 py-3 text-right">{t("page.prediction.table.speed")}</th>}
                                                        {isActive && <th className="hh-label px-4 py-3 text-center w-32">{t("page.prediction.table.trend")}</th>}
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
                                                                className={`border-t border-[var(--hh-border-hairline)] hover:bg-[var(--hh-surface-1)] cursor-pointer transition-colors ${isActive && chart.Rank === selectedRank ? 'bg-[var(--hh-accent-wash)]' : ''
                                                                    }`}
                                                                onClick={() => isActive && setSelectedRank(chart.Rank)}
                                                            >
                                                                <td className="hh-numeric px-4 py-3 font-bold text-miku">T{chart.Rank}</td>
                                                                <td className="hh-numeric px-4 py-3 text-right text-[var(--hh-text-primary)] font-bold">
                                                                    {formatNumber(chart.CurrentScore)}
                                                                </td>
                                                                {isActive && (
                                                                    <>
                                                                        <td className="hh-numeric px-4 py-3 text-right text-amber-600 font-bold">
                                                                            {chart.Rank > 10000 ? '-' : formatNumber(chart.PredictedScore)}
                                                                        </td>
                                                                        <td className="hh-numeric px-4 py-3 text-right text-[var(--hh-text-secondary)]">
                                                                            {chart.Rank > 10000 ? '-' : `+${formatNumber(chart.PredictedScore - chart.CurrentScore)}`}
                                                                        </td>
                                                                        <td className="hh-numeric px-4 py-3 text-right">
                                                                            {tierStats ? (
                                                                                <div className="flex flex-col items-end">
                                                                                    <span className="text-[var(--hh-text-primary)]">{tierStats.Speed != null ? formatNumber(tierStats.Speed) : '-'} /h</span>
                                                                                    <span className={`text-[10px] ${tierStats.ChangePct >= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
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
                                            <div className="hh-tile rounded-[var(--hh-radius-lg)] p-6">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                    <h3 className="hh-title text-lg text-[var(--hh-text-primary)] shrink-0">
                                                        {t("page.prediction.chart.detailTitle", { rank: selectedRank })}
                                                    </h3>
                                                    {/* Rank Selector for Chart */}
                                                    <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto sm:flex-wrap sm:justify-end no-scrollbar">
                                                        {(availableRanks.length > 0 ? availableRanks : RANK_TIERS).map(rank => (
                                                            <button
                                                                key={rank}
                                                                onClick={() => setSelectedRank(rank)}
                                                                className={`hh-chip hh-press hh-numeric flex-shrink-0 snap-start ${selectedRank === rank ? 'hh-chip-active' : ''}`}
                                                            >
                                                                T{rank}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {currentChart ? (
                                                    <PredictionChart data={currentChart} className="h-[350px] sm:h-[450px]" />
                                                ) : (
                                                    <div className="hh-well h-[350px] sm:h-[450px] flex items-center justify-center text-[var(--hh-text-tertiary)]">
                                                        {t("page.prediction.chart.noTierData", { rank: selectedRank })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {/* Footer Sources */}
                                    <div className="text-center text-xs text-[var(--hh-text-tertiary)] pb-8 space-y-1">
                                        <p>{t("page.prediction.sources.tier")}</p>
                                        <p>{t("page.prediction.sources.prediction")}</p>
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
                        <div className="hh-well flex flex-col items-center justify-center py-20 text-[var(--hh-text-tertiary)]">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p>{t("page.prediction.empty")}</p>
                        </div>
                    )
                }
            </div >
            <Modal
                isOpen={isWlNoticeOpen}
                onClose={() => setIsWlNoticeOpen(false)}
                title={t("page.prediction.wl.title")}
                size="sm"
                syncHistory={false}
            >
                <div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                        {t("page.prediction.wl.description")}
                    </div>
                </div>
            </Modal>
        </MainLayout >
    );
}
