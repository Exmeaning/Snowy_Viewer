"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import {
    IEventInfo,
    IEventDeckBonus,
    EVENT_TYPE_NAMES,
    EVENT_TYPE_COLORS,
    getEventStatus,
    EVENT_STATUS_DISPLAY,
    EventType
} from "@/types/events";
import { getEventLogoUrl, getCharacterIconUrl, getCardThumbnailUrl, getEventBannerUrl, getEventCharacterUrl, getMusicJacketUrl, getVirtualLiveBannerUrl } from "@/lib/assets";
import { CHARACTER_NAMES, getRarityNumber, RARITY_DISPLAY, isTrainableCard } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";

// Master data URLs
const EVENTS_DATA_URL = "https://sekaimaster.exmeaning.com/master/events.json";
const EVENT_DECK_BONUSES_URL = "https://sekaimaster.exmeaning.com/master/eventDeckBonuses.json";
const EVENT_CARDS_URL = "https://sekaimaster.exmeaning.com/master/eventCards.json";
const EVENT_MUSICS_URL = "https://sekaimaster.exmeaning.com/master/eventMusics.json";
const CARDS_URL = "https://sekaimaster.exmeaning.com/master/cards.json";
const MUSICS_URL = "https://sekaimaster.exmeaning.com/master/musics.json";

// Asset URL helpers - Now imported from @/lib/assets

// Local attribute icon mapping
const LOCAL_ATTR_ICONS: Record<string, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

// Attribute display names
const ATTR_NAMES: Record<string, string> = {
    cool: "Cool",
    cute: "Cute",
    happy: "Happy",
    mysterious: "Mysterious",
    pure: "Pure",
};

interface IEventCard {
    id: number;
    cardId: number;
    eventId: number;
    bonusRate: number;
}

interface IEventMusic {
    eventId: number;
    musicId: number;
    seq: number;
}

interface ICard {
    id: number;
    assetbundleName: string;
    prefix: string;
    characterId: number;
    cardRarityType: string;
    attr: string;
}

interface IMusic {
    id: number;
    title: string;
    assetbundleName: string;
}

interface IVirtualLiveInfo {
    id: number;
    name: string;
    assetbundleName: string;
}

// API URL for event-virtual live mapping
const EVENT_VIRTUAL_LIVE_MAP_URL = (process.env.NEXT_PUBLIC_API_URL || "") + "/api/event-virtuallive-map";



export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const eventId = Number(params.id);
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';

    const [event, setEvent] = useState<IEventInfo | null>(null);
    const [deckBonuses, setDeckBonuses] = useState<IEventDeckBonus[]>([]);
    const [eventCards, setEventCards] = useState<IEventCard[]>([]);
    const [eventMusics, setEventMusics] = useState<IEventMusic[]>([]);
    const [allCards, setAllCards] = useState<ICard[]>([]);
    const [allMusics, setAllMusics] = useState<IMusic[]>([]);
    const [virtualLive, setVirtualLive] = useState<IVirtualLiveInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState<"logo" | "banner" | "character">("logo");
    const { useTrainedThumbnail, assetSource } = useTheme();

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [eventsRes, bonusesRes, eventCardsRes, eventMusicsRes, cardsRes, musicsRes] = await Promise.all([
                    fetch(EVENTS_DATA_URL),
                    fetch(EVENT_DECK_BONUSES_URL),
                    fetch(EVENT_CARDS_URL),
                    fetch(EVENT_MUSICS_URL),
                    fetch(CARDS_URL),
                    fetch(MUSICS_URL),
                ]);

                if (!eventsRes.ok) throw new Error("Failed to fetch events data");

                const eventsData: IEventInfo[] = await eventsRes.json();
                const bonusesData: IEventDeckBonus[] = await bonusesRes.json();
                const eventCardsData: IEventCard[] = await eventCardsRes.json();
                const eventMusicsData: IEventMusic[] = await eventMusicsRes.json();
                const cardsData: ICard[] = await cardsRes.json();
                const musicsData: IMusic[] = await musicsRes.json();

                const foundEvent = eventsData.find(e => e.id === eventId);
                if (!foundEvent) {
                    throw new Error(`Event ${eventId} not found`);
                }

                setEvent(foundEvent);
                document.title = `Snowy SekaiViewer - ${foundEvent.name}`;
                setDeckBonuses(bonusesData.filter(b => b.eventId === eventId));
                setEventCards(eventCardsData.filter(c => c.eventId === eventId));
                setEventMusics(eventMusicsData.filter(m => m.eventId === eventId));
                setAllCards(cardsData);
                setAllMusics(musicsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching event:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    // Fetch virtual live data
    useEffect(() => {
        async function fetchVirtualLive() {
            try {
                const res = await fetch(EVENT_VIRTUAL_LIVE_MAP_URL);
                if (res.ok) {
                    const data: Record<string, IVirtualLiveInfo> = await res.json();
                    const vlInfo = data[eventId.toString()];
                    setVirtualLive(vlInfo || null);
                }
            } catch (err) {
                console.error("Error fetching virtual live:", err);
            }
        }
        if (eventId) {
            fetchVirtualLive();
        }
    }, [eventId]);

    // Get bonus attribute
    const bonusAttr = useMemo(() => {
        const attrBonus = deckBonuses.find(b => b.cardAttr && !b.gameCharacterUnitId);
        return attrBonus?.cardAttr;
    }, [deckBonuses]);

    // Get bonus characters
    const bonusCharacterIds = useMemo(() => {
        const getBaseId = (id: number) => {
            if (id <= 26) return id;
            if (id >= 27 && id <= 31) return 21; // Miku
            if (id >= 32 && id <= 36) return 22; // Rin
            if (id >= 37 && id <= 41) return 23; // Len
            if (id >= 42 && id <= 46) return 24; // Luka
            if (id >= 47 && id <= 51) return 25; // MEIKO
            if (id >= 52 && id <= 56) return 26; // KAITO
            return id;
        };

        return deckBonuses
            .filter(b => b.gameCharacterUnitId)
            .map(b => getBaseId(b.gameCharacterUnitId!))
            .filter((id, index, arr) => arr.indexOf(id) === index) // unique
            .sort((a, b) => a - b);
    }, [deckBonuses]);

    // Get event cards with full card info
    const eventCardsWithInfo = useMemo(() => {
        return eventCards
            .map(ec => {
                const card = allCards.find(c => c.id === ec.cardId);
                return card ? { ...ec, card } : null;
            })
            .filter((c): c is (IEventCard & { card: ICard }) => c !== null);
    }, [eventCards, allCards]);

    // Get theme songs
    const themeSongs = useMemo(() => {
        return eventMusics.map(em => {
            return allMusics.find(m => m.id === em.musicId);
        }).filter((m): m is IMusic => !!m);
    }, [eventMusics, allMusics]);

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

    if (isLoading) {
        return (
            <MainLayout activeNav="活动">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !event) {
        return (
            <MainLayout activeNav="活动">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">活动未找到</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <Link
                            href="/events"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回活动列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const logoUrl = getEventLogoUrl(event.assetbundleName, assetSource);
    const bannerUrl = getEventBannerUrl(event.assetbundleName, assetSource);
    const characterUrl = getEventCharacterUrl(event.assetbundleName, assetSource);
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];

    return (
        <MainLayout activeNav="活动">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/events" className="text-slate-500 hover:text-miku transition-colors">
                                活动
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            {event.name}
                        </li>
                    </ol>
                </nav>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {event.id}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                        >
                            {EVENT_TYPE_NAMES[event.eventType as EventType]}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: statusDisplay.color }}
                        >
                            {statusDisplay.label}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        {event.name}
                    </h1>
                </div>

                {/* Main Content Grid - Images LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Image Gallery */}
                    <div>
                        {isScreenshotMode ? (
                            /* Screenshot Mode: Show all images in flat layout */
                            <div className="space-y-4">
                                {/* Logo */}
                                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-600">Logo</span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                        <Image
                                            src={logoUrl}
                                            alt={`${event.name} Logo`}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                            priority
                                        />
                                    </div>
                                </div>
                                {/* Banner */}
                                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-600">背景</span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                        <Image
                                            src={bannerUrl}
                                            alt={`${event.name} Banner`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                {/* Character */}
                                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-600">角色</span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                        <Image
                                            src={characterUrl}
                                            alt={`${event.name} Character`}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Normal Mode: Tabs */
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                                {/* Tabs */}
                                <div className="flex border-b border-slate-200">
                                    {[
                                        { key: "logo", label: "Logo" },
                                        { key: "banner", label: "背景" },
                                        { key: "character", label: "角色" },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveImageTab(tab.key as "logo" | "banner" | "character")}
                                            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activeImageTab === tab.key
                                                ? "text-miku border-b-2 border-miku bg-miku/5"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Image Content */}
                                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                    {activeImageTab === "logo" && (
                                        <Image
                                            src={logoUrl}
                                            alt={`${event.name} Logo`}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                            priority
                                        />
                                    )}
                                    {activeImageTab === "banner" && (
                                        <Image
                                            src={bannerUrl}
                                            alt={`${event.name} Banner`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    )}
                                    {activeImageTab === "character" && (
                                        <Image
                                            src={characterUrl}
                                            alt={`${event.name} Character`}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    )}
                                </div>
                            </div>
                        )}
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
                                    活动信息
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="ID" value={`#${event.id}`} />
                                <InfoRow label="名称" value={event.name} />
                                <InfoRow label="类型" value={EVENT_TYPE_NAMES[event.eventType as EventType]} />
                                <InfoRow label="开始时间" value={formatDate(event.startAt)} />
                                <InfoRow label="结束时间" value={formatDate(event.aggregateAt)} />
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{event.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Bonus Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    加成信息
                                </h2>
                            </div>
                            <div className="p-5 space-y-4">
                                {bonusAttr && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500 font-medium">加成属性</span>
                                        <div className="flex items-center gap-2">
                                            <Image
                                                src={LOCAL_ATTR_ICONS[bonusAttr] || LOCAL_ATTR_ICONS.cool}
                                                alt={bonusAttr}
                                                width={28}
                                                height={28}
                                                unoptimized
                                            />
                                            <span className="text-sm font-bold text-slate-700">
                                                {ATTR_NAMES[bonusAttr] || bonusAttr}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {bonusCharacterIds.length > 0 && (
                                    <div>
                                        <span className="text-sm text-slate-500 font-medium block mb-2">加成角色</span>
                                        <div className="flex flex-wrap gap-2">
                                            {bonusCharacterIds.map(charId => (
                                                <div
                                                    key={charId}
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-full"
                                                    title={CHARACTER_NAMES[charId]}
                                                >
                                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-white ring-1 ring-slate-200">
                                                        <Image
                                                            src={getCharacterIconUrl(charId)}
                                                            alt={CHARACTER_NAMES[charId] || `Character ${charId}`}
                                                            width={24}
                                                            height={24}
                                                            className="w-full h-full object-cover"
                                                            unoptimized
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600">
                                                        {CHARACTER_NAMES[charId]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Theme Songs Card */}
                        {themeSongs.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        活动相关歌曲 ({themeSongs.length})
                                    </h2>
                                </div>
                                <div className="p-0">
                                    {themeSongs.map((music) => (
                                        <div key={music.id} className="p-5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                            <Link
                                                href={`/music/${music.id}`}
                                                className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl hover:bg-miku/10 transition-colors group"
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0 shadow-sm">
                                                    <Image
                                                        src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                                        alt={music.title}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 truncate group-hover:text-miku transition-colors">
                                                        {music.title}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-mono">ID: {music.id}</p>
                                                </div>
                                                <svg className="w-5 h-5 text-slate-400 group-hover:text-miku transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Virtual Live Card */}
                        {virtualLive && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-500/10 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        虚拟演唱会
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <Link href={`/live/${virtualLive.id}`} className="block group">
                                        <div className="relative aspect-[16/5] w-full">
                                            <Image
                                                src={getVirtualLiveBannerUrl(virtualLive.assetbundleName)}
                                                alt={virtualLive.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                        Live #{virtualLive.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                    {virtualLive.name}
                                                </h3>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Event Cards - Now in Right Column */}
                        {eventCardsWithInfo.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        活动卡牌 ({eventCardsWithInfo.length})
                                    </h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
                                        {eventCardsWithInfo.map(({ cardId, card }) => {
                                            const rarityNum = getRarityNumber(card.cardRarityType as any);
                                            const attrIcon = LOCAL_ATTR_ICONS[card.attr] || LOCAL_ATTR_ICONS.cool;
                                            // Cards that only have trained images
                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(cardId);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail &&
                                                (card.cardRarityType === "rarity_3" || card.cardRarityType === "rarity_4"));

                                            return (
                                                <Link
                                                    key={cardId}
                                                    href={`/cards/${cardId}`}
                                                    className="group block"
                                                >
                                                    <div className="relative rounded-lg overflow-hidden bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all">
                                                        {/* Card Image */}
                                                        <div className="aspect-square w-full bg-slate-50 p-1 relative">
                                                            <div className="w-full h-full relative rounded overflow-hidden">
                                                                <Image
                                                                    src={getCardThumbnailUrl(card.characterId, card.assetbundleName, showTrained, assetSource)}
                                                                    alt={card.prefix}
                                                                    fill
                                                                    className="object-cover group-hover:scale-105 transition-transform"
                                                                    unoptimized
                                                                />
                                                            </div>

                                                            {/* Attribute Badge - Top Left */}
                                                            <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 drop-shadow-md z-10">
                                                                <Image
                                                                    src={attrIcon}
                                                                    alt={card.attr}
                                                                    fill
                                                                    className="object-contain"
                                                                    unoptimized
                                                                />
                                                            </div>

                                                            {/* Rarity Badge - Top Right */}
                                                            <div className="absolute top-0.5 right-0.5 z-10">
                                                                <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[12px]">
                                                                    {card.cardRarityType === "rarity_birthday" ? (
                                                                        <div className="w-2.5 h-2.5 relative">
                                                                            <Image
                                                                                src="/data/icon/birthday.webp"
                                                                                alt="Birthday"
                                                                                fill
                                                                                className="object-contain"
                                                                                unoptimized
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-white text-[7px] font-bold leading-none">{rarityNum}</span>
                                                                            <div className="w-2 h-2 relative">
                                                                                <Image
                                                                                    src="/data/icon/star.webp"
                                                                                    alt="Star"
                                                                                    fill
                                                                                    className="object-contain"
                                                                                    unoptimized
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
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
                        返回活动列表
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
