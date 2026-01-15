"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import {
    IVirtualLiveInfo,
    VIRTUAL_LIVE_TYPE_NAMES,
    VIRTUAL_LIVE_TYPE_COLORS,
    getVirtualLiveStatus,
    VIRTUAL_LIVE_STATUS_DISPLAY,
    VirtualLiveType
} from "@/types/virtualLive";
import { getVirtualLiveBannerUrl, getMusicJacketUrl, getEventLogoUrl, getEventBannerUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

// Master data URLs
const VIRTUAL_LIVES_DATA_URL = "https://sekaimaster.exmeaning.com/master/virtualLives.json";
const MUSICS_URL = "https://sekaimaster.exmeaning.com/master/musics.json";
const MUSIC_VOCALS_URL = "https://sekaimaster.exmeaning.com/master/musicVocals.json";

interface IMusic {
    id: number;
    title: string;
    assetbundleName: string;
}

interface IMusicVocal {
    id: number;
    musicId: number;
    musicVocalType: string;
    assetbundleName: string;
}

interface IEventInfo {
    id: number;
    name: string;
    assetbundleName: string;
}

// API URL for virtual live-event mapping
const VIRTUAL_LIVE_EVENT_MAP_URL = (process.env.NEXT_PUBLIC_API_URL || "") + "/api/virtuallive-event-map";

export default function VirtualLiveDetailClient() {
    const params = useParams();
    const router = useRouter();
    const virtualLiveId = Number(params.id);
    const { assetSource } = useTheme();

    const [virtualLive, setVirtualLive] = useState<IVirtualLiveInfo | null>(null);
    const [allMusics, setAllMusics] = useState<IMusic[]>([]);
    const [allMusicVocals, setAllMusicVocals] = useState<IMusicVocal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [relatedEvent, setRelatedEvent] = useState<IEventInfo | null>(null);

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [virtualLivesRes, musicsRes, musicVocalsRes] = await Promise.all([
                    fetch(VIRTUAL_LIVES_DATA_URL),
                    fetch(MUSICS_URL),
                    fetch(MUSIC_VOCALS_URL),
                ]);

                if (!virtualLivesRes.ok) throw new Error("Failed to fetch virtual lives data");

                const virtualLivesData: IVirtualLiveInfo[] = await virtualLivesRes.json();
                const musicsData: IMusic[] = await musicsRes.json();
                const musicVocalsData: IMusicVocal[] = await musicVocalsRes.json();

                const foundVL = virtualLivesData.find(vl => vl.id === virtualLiveId);
                if (!foundVL) {
                    throw new Error(`Virtual Live ${virtualLiveId} not found`);
                }

                setVirtualLive(foundVL);
                document.title = `Snowy SekaiViewer - ${foundVL.name}`;
                setAllMusics(musicsData);
                setAllMusicVocals(musicVocalsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching virtual live:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (virtualLiveId) {
            fetchData();
        }
    }, [virtualLiveId]);

    // Fetch related event data
    useEffect(() => {
        async function fetchRelatedEvent() {
            try {
                const res = await fetch(VIRTUAL_LIVE_EVENT_MAP_URL);
                if (res.ok) {
                    const data: Record<string, IEventInfo> = await res.json();
                    const eventInfo = data[virtualLiveId.toString()];
                    setRelatedEvent(eventInfo || null);
                }
            } catch (err) {
                console.error("Error fetching related event:", err);
            }
        }
        if (virtualLiveId) {
            fetchRelatedEvent();
        }
    }, [virtualLiveId]);

    // Get setlist music info
    const setlistWithMusic = useMemo(() => {
        if (!virtualLive?.virtualLiveSetlists) return [];

        return virtualLive.virtualLiveSetlists.map(setlist => {
            if (setlist.virtualLiveSetlistType === "music" && setlist.musicVocalId) {
                const musicVocal = allMusicVocals.find(mv => mv.id === setlist.musicVocalId);
                const music = musicVocal ? allMusics.find(m => m.id === musicVocal.musicId) : null;
                return { ...setlist, music, musicVocal };
            }
            return { ...setlist, music: null, musicVocal: null };
        });
    }, [virtualLive, allMusics, allMusicVocals]);

    // Format date helper
    const formatDate = (timestamp: number) => {
        if (!mounted) return "...";
        return new Date(timestamp).toLocaleString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Format short date helper
    const formatShortDate = (timestamp: number) => {
        if (!mounted) return "...";
        return new Date(timestamp).toLocaleString("zh-CN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <MainLayout activeNav="演唱会">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !virtualLive) {
        return (
            <MainLayout activeNav="演唱会">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">演唱会未找到</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <Link
                            href="/live"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回演唱会列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const bannerUrl = getVirtualLiveBannerUrl(virtualLive.assetbundleName);
    const status = getVirtualLiveStatus(virtualLive);
    const statusDisplay = VIRTUAL_LIVE_STATUS_DISPLAY[status];

    return (
        <MainLayout activeNav="演唱会">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/live" className="text-slate-500 hover:text-miku transition-colors">
                                演唱会
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            {virtualLive.name}
                        </li>
                    </ol>
                </nav>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {virtualLive.id}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: VIRTUAL_LIVE_TYPE_COLORS[virtualLive.virtualLiveType as VirtualLiveType] || "#9E9E9E" }}
                        >
                            {VIRTUAL_LIVE_TYPE_NAMES[virtualLive.virtualLiveType as VirtualLiveType] || virtualLive.virtualLiveType}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: statusDisplay.color }}
                        >
                            {statusDisplay.label}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        {virtualLive.name}
                    </h1>
                </div>

                {/* Main Content Grid - Banner LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Banner */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-sm font-bold text-slate-600">演唱会 Banner</span>
                            </div>
                            <div className="relative aspect-[16/5] bg-gradient-to-br from-slate-50 to-slate-100">
                                <Image
                                    src={bannerUrl}
                                    alt={`${virtualLive.name} Banner`}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    priority
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    基本信息
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="ID" value={`#${virtualLive.id}`} />
                                <InfoRow label="名称" value={virtualLive.name} />
                                <InfoRow label="类型" value={VIRTUAL_LIVE_TYPE_NAMES[virtualLive.virtualLiveType as VirtualLiveType] || virtualLive.virtualLiveType} />
                                <InfoRow label="平台" value={virtualLive.virtualLivePlatform} />
                                <InfoRow label="开始时间" value={formatDate(virtualLive.startAt)} />
                                <InfoRow label="结束时间" value={formatDate(virtualLive.endAt)} />
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{virtualLive.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Schedules Card */}
                        {virtualLive.virtualLiveSchedules && virtualLive.virtualLiveSchedules.length > 0 && (
                            <SchedulesCard
                                schedules={virtualLive.virtualLiveSchedules}
                                formatShortDate={formatShortDate}
                            />
                        )}

                        {/* Related Event Card */}
                        {relatedEvent && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        相关活动
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <Link href={`/events/${relatedEvent.id}`} className="block group">
                                        <div className="relative aspect-[2/1] w-full">
                                            <Image
                                                src={getEventBannerUrl(relatedEvent.assetbundleName, assetSource)}
                                                alt={relatedEvent.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                        Event #{relatedEvent.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                    {relatedEvent.name}
                                                </h3>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Setlist Card */}
                        {setlistWithMusic.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        节目单 ({setlistWithMusic.length})
                                    </h2>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {setlistWithMusic.map((item, index) => (
                                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {item.virtualLiveSetlistType === "music" && item.music ? (
                                                        <Link
                                                            href={`/music/${item.music.id}`}
                                                            className="flex items-center gap-3 group"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0 shadow-sm">
                                                                <Image
                                                                    src={getMusicJacketUrl(item.music.assetbundleName, assetSource)}
                                                                    alt={item.music.title}
                                                                    width={40}
                                                                    height={40}
                                                                    className="w-full h-full object-cover"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 group-hover:text-miku transition-colors">
                                                                    {item.music.title}
                                                                </p>
                                                                <p className="text-xs text-slate-500">🎵 音乐</p>
                                                            </div>
                                                        </Link>
                                                    ) : item.virtualLiveSetlistType === "mc" ? (
                                                        <div>
                                                            <p className="font-medium text-slate-700">MC 环节</p>
                                                            <p className="text-xs text-slate-400 font-mono">{item.assetbundleName}</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-medium text-slate-700">{item.virtualLiveSetlistType}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{item.assetbundleName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.virtualLiveSetlistType === "music"
                                                    ? "bg-miku/10 text-miku"
                                                    : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                    {item.virtualLiveSetlistType === "music" ? "音乐" : "MC"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        返回演唱会列表
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 font-bold text-right max-w-[60%]">{value}</span>
        </div>
    );
}

// Schedules Card Component with expandable list
interface ISchedule {
    id: number;
    seq: number;
    startAt: number;
    endAt: number;
}

function SchedulesCard({ schedules, formatShortDate }: { schedules: ISchedule[], formatShortDate: (ts: number) => string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const firstSchedule = schedules[0];
    const lastSchedule = schedules[schedules.length - 1];
    const middleSchedules = schedules.slice(1, -1);
    const hasMiddleSchedules = middleSchedules.length > 0;

    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    演出时间表 ({schedules.length} 场)
                </h2>
            </div>
            <div className="p-4 space-y-3">
                {/* First Schedule */}
                <div className="p-3 bg-miku/5 rounded-xl border border-miku/20">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-miku">首场</span>
                        <span className="text-xs text-slate-500">第 {firstSchedule.seq} 场</span>
                    </div>
                    <div className="text-sm font-medium text-slate-700">
                        {formatShortDate(firstSchedule.startAt)}
                    </div>
                    <div className="text-xs text-slate-400">
                        ~ {formatShortDate(firstSchedule.endAt)}
                    </div>
                </div>

                {/* Middle Schedules (Collapsible) */}
                {hasMiddleSchedules && (
                    <>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm text-slate-600"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {isExpanded ? '收起' : `展开其他 ${middleSchedules.length} 场演出`}
                        </button>

                        {isExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                {middleSchedules.map((schedule) => (
                                    <div key={schedule.id} className="p-2 bg-slate-50 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-0.5">第 {schedule.seq} 场</div>
                                        <div className="text-xs font-medium text-slate-700">
                                            {formatShortDate(schedule.startAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Last Schedule (if different from first) */}
                {schedules.length > 1 && (
                    <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-orange-600">末场</span>
                            <span className="text-xs text-slate-500">第 {lastSchedule.seq} 场</span>
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                            {formatShortDate(lastSchedule.startAt)}
                        </div>
                        <div className="text-xs text-slate-400">
                            ~ {formatShortDate(lastSchedule.endAt)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
