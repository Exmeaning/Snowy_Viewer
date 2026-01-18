"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import {
    IMusicInfo,
    IMusicTagInfo,
    IMusicDifficultyInfo,
    MusicDifficultyType,
    getMusicJacketUrl,
    getChartSvgUrl,
    getMusicVocalAudioUrl,
    MUSIC_CATEGORY_NAMES,
    MUSIC_CATEGORY_COLORS,
    MUSIC_TAG_NAMES,
    DIFFICULTY_NAMES,
    DIFFICULTY_COLORS,
    MusicCategoryType,
    MusicTagType,
} from "@/types/music";
import { CHARACTER_NAMES } from "@/types/types";
import { useTheme, AssetSourceType } from "@/contexts/ThemeContext";
import { getCharacterIconUrl, getEventBannerUrl } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";

// Difficulty order for tabs
const DIFFICULTY_ORDER: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];

// External data URLs
const MUSIC_META_API = "https://assets.exmeaning.com/musicmeta/music_metas.json";
const RANKINGS_API = "https://assets.exmeaning.com/musicmeta/rankings_best.json";

// Music meta data structure
interface MusicMetaData {
    music_id: number;
    difficulty: string;
    music_time: number;
}

// Rankings raw data structure  
interface RankingItem {
    rank: number;
    music_id: number;
    difficulty: string;
    value: number;
    pspi?: number;
}

interface RankingsRawData {
    total_songs: number;
    rankings: {
        [key: string]: RankingItem[];
    };
}

// Ranking category definitions
type RankingCategoryKey =
    | "pt_per_hour_multi" | "pt_per_hour_auto"
    | "multi_pt_max" | "solo_pt_max" | "auto_pt_max"
    | "multi_score" | "solo_score" | "auto_score";

const RANKING_CATEGORIES: { key: RankingCategoryKey; label: string; shortLabel: string; group: string }[] = [
    // 时速榜 (PT per hour)
    { key: "pt_per_hour_multi", label: "协力时速榜", shortLabel: "协力时速", group: "时速" },
    { key: "pt_per_hour_auto", label: "自动时速榜", shortLabel: "自动时速", group: "时速" },
    // 单局PT榜
    { key: "multi_pt_max", label: "协力单局PT榜", shortLabel: "协力PT", group: "单局PT" },
    { key: "solo_pt_max", label: "单人单局PT榜", shortLabel: "单人PT", group: "单局PT" },
    { key: "auto_pt_max", label: "自动单局PT榜", shortLabel: "自动PT", group: "单局PT" },
    // 得分榜
    { key: "multi_score", label: "协力得分榜", shortLabel: "协力得分", group: "得分" },
    { key: "solo_score", label: "单人得分榜", shortLabel: "单人得分", group: "得分" },
    { key: "auto_score", label: "自动得分榜", shortLabel: "自动得分", group: "得分" },
];

// Ranking info per category
interface MusicRankings {
    total: number;
    categories: Record<string, { rank: number; difficulty: string; value: number; pspi?: number } | null>;
    bestCategory: RankingCategoryKey | null;
}



export default function MusicDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
    const musicId = Number(params.id);
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';

    const [music, setMusic] = useState<IMusicInfo | null>(null);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [difficulties, setDifficulties] = useState<IMusicDifficultyInfo[]>([]);
    const [vocals, setVocals] = useState<any[]>([]);
    const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Duration and ranking states
    const [musicDuration, setMusicDuration] = useState<number | null>(null);
    const [rankings, setRankings] = useState<MusicRankings | null>(null);
    const [selectedRankingCategory, setSelectedRankingCategory] = useState<RankingCategoryKey>("pt_per_hour_multi");

    // View states
    const [selectedDifficulty, setSelectedDifficulty] = useState<MusicDifficultyType>("master");
    const [imageViewerOpen, setImageViewerOpen] = useState(false);

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [musicsData, tagsData, diffisData, vocalsData, eventsData, eventMusicsData] = await Promise.all([
                    fetchMasterData<IMusicInfo[]>("musics.json"),
                    fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
                    fetchMasterData<IMusicDifficultyInfo[]>("musicDifficulties.json"),
                    fetchMasterData<any[]>("musicVocals.json"),
                    fetchMasterData<any[]>("events.json"),
                    fetchMasterData<any[]>("eventMusics.json"),
                ]);

                const foundMusic = musicsData.find(m => m.id === musicId);
                if (!foundMusic) {
                    throw new Error(`Music ${musicId} not found`);
                }

                setMusic(foundMusic);
                document.title = `Snowy SekaiViewer - ${foundMusic.title}`;
                setMusicTags(tagsData.filter(t => t.musicId === musicId));
                setDifficulties(diffisData.filter(d => d.musicId === musicId).sort((a, b) => {
                    return DIFFICULTY_ORDER.indexOf(a.musicDifficulty) - DIFFICULTY_ORDER.indexOf(b.musicDifficulty);
                }));
                setVocals(vocalsData.filter(v => v.musicId === musicId));

                // Process related events using client-side data
                const musicEvents = eventMusicsData.filter(em => em.musicId === musicId);
                const relatedEventIds = new Set(musicEvents.map(em => em.eventId));
                const related = eventsData.filter(e => relatedEventIds.has(e.id));
                // Sort by event id (newest first usually, or old to new)
                related.sort((a, b) => b.id - a.id);
                setRelatedEvents(related);

                setError(null);

                // Set default difficulty to master if available
                const availableDiffs = diffisData.filter(d => d.musicId === musicId);
                if (availableDiffs.length > 0) {
                    const masterDiff = availableDiffs.find(d => d.musicDifficulty === "master");
                    setSelectedDifficulty(masterDiff?.musicDifficulty || "expert");
                }
            } catch (err) {
                console.error("Error fetching music:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (musicId) {
            fetchData();

            // Fetch optional meta and rankings data (don't block main content)
            async function fetchMetaData() {
                try {
                    const metaRes = await fetch(MUSIC_META_API);
                    if (metaRes.ok) {
                        const metaData: MusicMetaData[] = await metaRes.json();
                        const thisMusicMeta = metaData.find(m => m.music_id === musicId);
                        if (thisMusicMeta) {
                            setMusicDuration(thisMusicMeta.music_time);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to fetch music duration:", err);
                }

                try {
                    const rankingsRes = await fetch(RANKINGS_API);
                    if (rankingsRes.ok) {
                        const rankingsData: RankingsRawData = await rankingsRes.json();

                        // Collect rankings for all categories
                        const categories: Record<string, { rank: number; difficulty: string; value: number; pspi: number } | null> = {};
                        let bestRank = Infinity;
                        let bestCategory: RankingCategoryKey | null = null;

                        for (const cat of RANKING_CATEGORIES) {
                            const categoryRankings = rankingsData.rankings[cat.key];
                            if (categoryRankings) {
                                const thisRanking = categoryRankings.find(item => item.music_id === musicId);
                                if (thisRanking) {
                                    categories[cat.key] = {
                                        rank: thisRanking.rank,
                                        difficulty: thisRanking.difficulty,
                                        value: thisRanking.value,
                                        pspi: thisRanking.pspi ?? 0,
                                    };
                                    // Track best (lowest) rank
                                    if (thisRanking.rank < bestRank) {
                                        bestRank = thisRanking.rank;
                                        bestCategory = cat.key;
                                    }
                                } else {
                                    categories[cat.key] = null;
                                }
                            }
                        }

                        setRankings({
                            total: rankingsData.total_songs,
                            categories,
                            bestCategory,
                        });

                        // Default to best category if available
                        if (bestCategory) {
                            setSelectedRankingCategory(bestCategory);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to fetch ranking:", err);
                }
            }

            fetchMetaData();
        }
    }, [musicId]);

    // Selected difficulty info
    const selectedDifficultyInfo = useMemo(() => {
        return difficulties.find(d => d.musicDifficulty === selectedDifficulty);
    }, [difficulties, selectedDifficulty]);

    // Get tag names for this music
    const tagNames = useMemo(() => {
        return musicTags.map(t => MUSIC_TAG_NAMES[t.musicTag as MusicTagType] || t.musicTag);
    }, [musicTags]);

    if (isLoading) {
        return (
            <MainLayout activeNav="音乐">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !music) {
        return (
            <MainLayout activeNav="音乐">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">乐曲未找到</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <Link
                            href="/music"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回音乐列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);
    const chartUrl = getChartSvgUrl(musicId, selectedDifficulty);

    return (
        <MainLayout activeNav="音乐">
            {/* Full Image Viewer Modal */}
            {imageViewerOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setImageViewerOpen(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        onClick={() => setImageViewerOpen(false)}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={jacketUrl}
                        alt={music.title}
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/music" className="text-slate-500 hover:text-miku transition-colors">
                                音乐
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            {music.title}
                        </li>
                    </ol>
                </nav>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {music.id}
                        </span>
                        {/* Category Tags */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {music.categories.map((cat) => (
                                <span
                                    key={cat}
                                    className="px-2 py-0.5 text-xs font-bold rounded text-white"
                                    style={{ backgroundColor: MUSIC_CATEGORY_COLORS[cat as MusicCategoryType] }}
                                >
                                    {MUSIC_CATEGORY_NAMES[cat as MusicCategoryType]}
                                </span>
                            ))}
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">
                        {music.title}
                    </h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-slate-600">{music.composer}</span>
                        {tagNames.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {tagNames.map((tag, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 bg-miku/10 text-miku rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Grid - 2 Column Layout like Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Jacket Image */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            {/* Jacket Image */}
                            <div
                                className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 cursor-zoom-in"
                                onClick={() => setImageViewerOpen(true)}
                            >
                                <Image
                                    src={jacketUrl}
                                    alt={music.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    priority
                                />
                                <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                    点击放大
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    乐曲信息
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="ID" value={`#${music.id}`} />
                                <InfoRow label="标题" value={music.title} />
                                <InfoRow label="作曲" value={music.composer} />
                                <InfoRow label="编曲" value={music.arranger} />
                                <InfoRow label="作词" value={music.lyricist} />
                                {/* Duration */}
                                {musicDuration != null && (
                                    <InfoRow
                                        label="歌曲时长"
                                        value={`${Math.floor(musicDuration / 60)}:${Math.floor(musicDuration % 60).toString().padStart(2, "0")}`}
                                    />
                                )}
                                <InfoRow
                                    label="发布时间"
                                    value={mounted && music.publishedAt
                                        ? new Date(music.publishedAt).toLocaleDateString("zh-CN", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })
                                        : "..."}
                                />
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{music.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Ranking Card */}
                        {rankings && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        META排行
                                    </h2>
                                </div>

                                {/* Category Tabs */}
                                <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-1">
                                    {RANKING_CATEGORIES.map((cat) => {
                                        const catRanking = rankings.categories[cat.key];
                                        const isSelected = selectedRankingCategory === cat.key;
                                        return (
                                            <button
                                                key={cat.key}
                                                onClick={() => setSelectedRankingCategory(cat.key)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                                    ? "bg-miku text-white shadow-sm"
                                                    : catRanking
                                                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                        : "bg-slate-50 text-slate-300 cursor-not-allowed"
                                                    }`}
                                                disabled={!catRanking}
                                            >
                                                {cat.shortLabel}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Compact Horizontal Rank Display */}
                                {rankings.categories[selectedRankingCategory] && (
                                    <div className="p-4 flex items-center justify-between">
                                        {/* Left: PSPI */}
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="text-xs text-slate-400 mb-0.5">PSPI</div>
                                                <div className="text-2xl font-black text-miku">
                                                    {(rankings.categories[selectedRankingCategory]!.pspi ?? 0).toFixed(1)}
                                                </div>
                                            </div>
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded uppercase font-mono">
                                                {rankings.categories[selectedRankingCategory]!.difficulty}
                                            </span>
                                        </div>

                                        {/* Right: Rank */}
                                        <div className="text-right">
                                            <span className="text-4xl sm:text-5xl font-black text-miku">
                                                #{rankings.categories[selectedRankingCategory]!.rank}
                                            </span>
                                            <span className="text-slate-400 text-sm ml-1">/{rankings.total}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Difficulty Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    难度信息
                                </h2>
                            </div>

                            {/* Difficulty Grid */}
                            <div className="p-4 grid grid-cols-5 gap-2">
                                {difficulties.map((diff) => (
                                    <button
                                        key={diff.musicDifficulty}
                                        className={`flex flex-col items-center p-2 rounded-xl transition-all ${selectedDifficulty === diff.musicDifficulty
                                            ? "ring-2 shadow-lg bg-white"
                                            : "hover:bg-slate-50 border border-transparent"
                                            }`}
                                        style={
                                            selectedDifficulty === diff.musicDifficulty
                                                ? {
                                                    borderColor: DIFFICULTY_COLORS[diff.musicDifficulty],
                                                    boxShadow: `0 0 0 2px ${DIFFICULTY_COLORS[diff.musicDifficulty]}`
                                                }
                                                : {}
                                        }
                                        onClick={() => setSelectedDifficulty(diff.musicDifficulty)}
                                    >
                                        <span
                                            className="text-[10px] font-bold uppercase"
                                            style={{ color: DIFFICULTY_COLORS[diff.musicDifficulty] }}
                                        >
                                            {DIFFICULTY_NAMES[diff.musicDifficulty].slice(0, 3)}
                                        </span>
                                        <span
                                            className="text-lg font-black"
                                            style={{ color: DIFFICULTY_COLORS[diff.musicDifficulty] }}
                                        >
                                            {diff.playLevel}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Selected Difficulty Details */}
                            {selectedDifficultyInfo && (
                                <div className="px-5 pb-4">
                                    <div className="flex items-center justify-between py-2 border-t border-slate-100">
                                        <span className="text-sm text-slate-500">NOTE数</span>
                                        <span className="text-sm font-bold text-slate-700">
                                            {selectedDifficultyInfo.totalNoteCount.toLocaleString()}
                                        </span>
                                    </div>

                                    <a
                                        href={chartUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                        style={{ backgroundColor: DIFFICULTY_COLORS[selectedDifficulty] }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        打开 {DIFFICULTY_NAMES[selectedDifficulty]} 谱面预览
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Vocals Card */}
                        {vocals.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        演唱版本（已跳过9秒空白）
                                    </h2>
                                </div>
                                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                                    {vocals.map((vocal) => (
                                        <VocalPlayer
                                            key={vocal.id}
                                            vocal={vocal}
                                            fillerSec={music.fillerSec}
                                            assetSource={assetSource}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Related Events Card */}
                        {relatedEvents.length > 0 && (
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
                                    {relatedEvents.map((event) => (
                                        <Link key={event.id} href={`/events/${event.id}`} className="block group border-b border-slate-50 last:border-0 relative">
                                            <div className="relative aspect-[2/1] w-full">
                                                <Image
                                                    src={getEventBannerUrl(event.assetbundleName, assetSource)}
                                                    alt={event.name}
                                                    fill
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                                <div className="absolute bottom-0 left-0 w-full p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                            Event #{event.id}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                        {event.name}
                                                    </h3>
                                                </div>
                                            </div>
                                        </Link>
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
                        返回音乐列表
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}

// Vocal Player Component
function VocalPlayer({ vocal, fillerSec, assetSource }: { vocal: any; fillerSec: number; assetSource: AssetSourceType }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrl = getMusicVocalAudioUrl(vocal.assetbundleName, assetSource);

    const togglePlay = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.onplay = () => setIsPlaying(true);
            audioRef.current.onpause = () => setIsPlaying(false);
            audioRef.current.onloadedmetadata = () => {
                if (audioRef.current) setDuration(audioRef.current.duration);
            };
            audioRef.current.ontimeupdate = () => {
                if (audioRef.current) {
                    setProgress(audioRef.current.currentTime);
                }
            };

            // Initial offset skip
            if (fillerSec > 0) {
                audioRef.current.currentTime = fillerSec;
            }
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setProgress(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    // Format time (mm:ss)
    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="px-5 py-4 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center gap-4">
                {/* Play Button */}
                <button
                    onClick={togglePlay}
                    className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying
                        ? "bg-slate-800 text-white"
                        : "bg-miku text-white shadow-md shadow-miku/20 hover:scale-105 active:scale-95"
                        }`}
                >
                    {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm font-bold text-slate-700 truncate">
                            {vocal.caption}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Download Button */}
                            <a
                                href={audioUrl}
                                download={`${vocal.caption}.mp3`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-miku hover:bg-miku/5 rounded-lg transition-colors"
                                title="下载音频"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                        {vocal.characters?.map((chara: any) => (
                            <div
                                key={chara.id}
                                className="w-6 h-6 rounded-full overflow-hidden bg-slate-100 ring-1 ring-white"
                                title={chara.characterType === "game_character"
                                    ? CHARACTER_NAMES[chara.characterId] || `Character ${chara.characterId}`
                                    : `Guest ${chara.characterId}`}
                            >
                                {chara.characterType === "game_character" && chara.characterId <= 26 && (
                                    <Image
                                        src={getCharacterIconUrl(chara.characterId)}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Progress Bar & Time */}
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={progress}
                            onChange={handleSeek}
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-miku hover:bg-slate-300 transition-colors"
                        />
                        <span className="text-[10px] font-mono text-slate-400 shrink-0 min-w-[60px] text-right">
                            {formatTime(progress)} / {formatTime(duration)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 font-bold">{value}</span>
        </div>
    );
}
