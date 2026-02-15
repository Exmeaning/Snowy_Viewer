"use client";
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { IMusicInfo, MusicTagType, MusicCategoryType, IMusicTagInfo, IMusicMeta } from "@/types/music";
import { fetchMasterData } from "@/lib/fetch";
import { getMusicJacketUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import SelectorModal from "./SelectorModal";
import MusicFilters from "@/components/music/MusicFilters";

const MUSIC_META_API = "https://assets.exmeaning.com/musicmeta/music_metas.json";

interface MusicSelectorProps {
    selectedMusicId: string;
    onSelect: (musicId: string) => void;
    recommendMode?: "event" | "challenge";
    liveType?: string;
}

type RecommendType = "efficiency" | "pt" | "score";

export default function MusicSelector({ selectedMusicId, onSelect, recommendMode = "event", liveType = "multi" }: MusicSelectorProps) {
    const { assetSource } = useTheme();
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [musicMetas, setMusicMetas] = useState<IMusicMeta[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    // Filter/Recommend state
    const [recommendType, setRecommendType] = useState<RecommendType>("efficiency");

    // Filters state
    const [selectedTag, setSelectedTag] = useState<MusicTagType>("all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>([]);
    const [hasEventOnly, setHasEventOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "publishedAt">("publishedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Normalize liveType for meta lookup
    const metaMode = useMemo(() => {
        if (liveType === "multi" || liveType === "cheerful") return "multi";
        if (liveType === "auto") return "auto";
        if (liveType === "solo") return "solo";
        return "multi";
    }, [liveType]);

    // Handle recommendType switch when mode changes (e.g. solo has no efficiency)
    useEffect(() => {
        if (metaMode === "solo" && recommendType === "efficiency") {
            setRecommendType("score");
        }
    }, [metaMode, recommendType]);

    // Load musics and tags on mount
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchMasterData<IMusicInfo[]>("musics.json"),
            fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
            fetch(MUSIC_META_API).then(res => res.json()).catch(err => {
                console.error("Failed to fetch music meta", err);
                return [];
            }),
            loadTranslations()
        ])
            .then(([musicsData, tagsData, metasData, translationsData]) => {
                setMusics(musicsData);
                setMusicTags(tagsData);
                setMusicMetas(metasData);
                setTranslations(translationsData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load musics", err);
                setLoading(false);
            });
    }, []);

    // Recommended Musics Logic
    const recommendedMusics = useMemo(() => {
        if (!musics.length || !musicMetas.length) return [];

        let sortField: keyof IMusicMeta | null = null;

        if (recommendType === "efficiency") {
            if (metaMode === "multi") sortField = "pspi_pt_per_hour_multi";
            else if (metaMode === "auto") sortField = "pspi_pt_per_hour_auto";
        } else if (recommendType === "pt") {
            if (metaMode === "multi") sortField = "pspi_multi_pt_max";
            else if (metaMode === "auto") sortField = "pspi_auto_pt_max";
            else if (metaMode === "solo") sortField = "pspi_solo_pt_max";
        } else if (recommendType === "score") {
            if (metaMode === "multi") sortField = "pspi_multi_score";
            else if (metaMode === "auto") sortField = "pspi_auto_score";
            else if (metaMode === "solo") sortField = "pspi_solo_score";
        }

        if (!sortField) return [];

        if (!sortField) return [];

        // Pinned IDs for specific modes (e.g. Multi PT -> 226, 448)
        const pinnedIds = (metaMode === "multi" && recommendType === "pt") ? [226, 448] : [];

        // Sort metas
        const sortedMetas = [...musicMetas].sort((a, b) => ((b[sortField!] as number) || 0) - ((a[sortField!] as number) || 0));

        // Map to store ranks
        const rankMap = new Map<number, number>();
        let currentRank = 1;
        const seenForRank = new Set<number>();

        for (const meta of sortedMetas) {
            if (!seenForRank.has(meta.music_id)) {
                seenForRank.add(meta.music_id);
                rankMap.set(meta.music_id, currentRank++);
            }
        }

        // Dedupe by music_id and get items
        const seen = new Set<number>();
        const result: { music: IMusicInfo, meta: IMusicMeta, value: number, isPinned?: boolean, rank: number }[] = [];

        const addItem = (id: number, isPinned: boolean = false) => {
            if (seen.has(id)) return;
            // Best meta is already in sortedMetas, but lookup might be faster via id if we don't care about specific diff
            const meta = sortedMetas.find(m => m.music_id === id) || musicMetas.find(m => m.music_id === id);

            if (meta) {
                const music = musics.find(m => m.id === id);
                if (music) {
                    seen.add(id);
                    result.push({
                        music,
                        meta,
                        value: (meta[sortField!] as number) || 0,
                        isPinned,
                        rank: rankMap.get(id) || 999
                    });
                }
            }
        };

        // 1. Add pinned items first
        for (const pid of pinnedIds) {
            addItem(pid, true);
        }

        // 2. Fill with sorted items
        for (const meta of sortedMetas) {
            if (result.length >= 2) break;
            addItem(meta.music_id);
        }

        return result;
    }, [musics, musicMetas, metaMode, recommendType]);

    // Filter musics [Rest of the logic remains similar]
    const filteredMusics = useMemo(() => {
        let result = [...musics];

        // Tag filter
        if (selectedTag !== "all") {
            const validIds = new Set(
                musicTags
                    .filter(t => t.musicTag === selectedTag)
                    .map(t => t.musicId)
            );
            result = result.filter(m => validIds.has(m.id));
        }

        // Category filter
        if (selectedCategories.length > 0) {
            result = result.filter(m =>
                m.categories.some(cat => selectedCategories.includes(cat))
            );
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m => {
                // Match by ID
                if (m.id.toString().includes(q)) return true;
                // Match by Japanese title
                if (m.title.toLowerCase().includes(q)) return true;
                // Match by Chinese title translation
                const chineseTitle = translations?.music?.title?.[m.title];
                if (chineseTitle && chineseTitle.toLowerCase().includes(q)) return true;
                // Match by creator/artist
                if (m.creatorArtistId.toString().includes(q)) return true; // original checked this but maybe not useful for user search? kept as is
                if (m.lyricist.toLowerCase().includes(q)) return true;
                if (m.composer.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // Sort
        result.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        return result;
    }, [musics, musicTags, selectedTag, selectedCategories, hasEventOnly, searchQuery, sortBy, sortOrder, translations]);

    // Get currently selected music object
    const selectedMusic = useMemo(() => {
        if (!selectedMusicId) return null;
        return musics.find(m => m.id.toString() === selectedMusicId) || null;
    }, [musics, selectedMusicId]);

    const handleSelect = (music: IMusicInfo) => {
        onSelect(music.id.toString());
        setModalOpen(false);
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                歌曲 <span className="text-red-400">*</span>
            </label>

            <button
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-miku/50 transition-all text-left shadow-sm group"
            >
                {selectedMusic ? (
                    <>
                        <div className="relative w-16 aspect-square bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                            <Image
                                src={getMusicJacketUrl(selectedMusic.assetbundleName, assetSource)}
                                alt={selectedMusic.title}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 rounded-md">
                                    #{selectedMusic.id}
                                </span>
                            </div>
                            <div className="text-sm font-bold text-slate-700 truncate group-hover:text-miku transition-colors">
                                {selectedMusic.title}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                                {selectedMusic.lyricist} / {selectedMusic.composer}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <span className="text-slate-400 text-sm">点击选择歌曲...</span>
                    </>
                )}
                <div className="text-slate-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </div>
            </button>

            <SelectorModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title="选择歌曲"
            >
                <div>
                    {/* Recommendations Integrated Section */}
                    {recommendedMusics.length > 0 && !searchQuery && (
                        <div className="mb-6 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-miku rounded-full"></span>
                                    猜你想选
                                    <span className="text-xs font-normal text-slate-400 ml-1">
                                        基于 {liveType === "cheerful" ? "Multi" : liveType.charAt(0).toUpperCase() + liveType.slice(1)} 模式
                                    </span>
                                </h3>

                                {/* Tabs */}
                                <div className="flex bg-slate-100 rounded-lg p-0.5">
                                    {metaMode !== "solo" && (
                                        <button
                                            onClick={() => setRecommendType("efficiency")}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${recommendType === "efficiency"
                                                ? "bg-white text-miku shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                                }`}
                                        >
                                            效率
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setRecommendType("pt")}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${recommendType === "pt"
                                            ? "bg-white text-miku shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                            }`}
                                    >
                                        PT
                                    </button>
                                    <button
                                        onClick={() => setRecommendType("score")}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${recommendType === "score"
                                            ? "bg-white text-miku shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                            }`}
                                    >
                                        分数
                                    </button>
                                </div>
                            </div>

                            {/* List View */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {recommendedMusics.map((item, idx) => (
                                    <div
                                        key={item.music.id}
                                        onClick={() => handleSelect(item.music)}
                                        className="cursor-pointer bg-white rounded-lg border border-slate-200 hover:border-miku/50 hover:shadow-md transition-all active:scale-[0.99] flex items-center gap-3 p-2 group"
                                    >
                                        {/* Rank */}
                                        <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded ${item.rank === 1 ? "bg-yellow-100 text-yellow-600" :
                                            item.rank === 2 ? "bg-slate-100 text-slate-500" :
                                                item.rank === 3 ? "bg-amber-100 text-amber-700" :
                                                    "bg-slate-50 text-slate-400"
                                            }`}>
                                            #{item.rank}
                                        </div>

                                        {/* Image */}
                                        <div className="relative w-10 h-10 rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                                            <Image
                                                src={getMusicJacketUrl(item.music.assetbundleName, assetSource)}
                                                alt={item.music.title}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-700 truncate group-hover:text-miku transition-colors">
                                                {item.music.title}
                                            </div>
                                            {translations?.music?.title?.[item.music.title] && (
                                                <div className="text-xs text-slate-500 truncate mb-0.5">
                                                    {translations.music.title[item.music.title]}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {item.music.composer}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Value */}
                                        <div className="text-right">
                                            <div className="text-sm font-black text-miku font-mono">
                                                {item.value.toFixed(0)}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                PSPI
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <MusicFilters
                            selectedTag={selectedTag}
                            onTagChange={setSelectedTag}
                            selectedCategories={selectedCategories}
                            onCategoryChange={setSelectedCategories}
                            hasEventOnly={hasEventOnly}
                            onHasEventOnlyChange={setHasEventOnly}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={setSortBy as any}
                            onReset={() => {
                                setSelectedTag("all");
                                setSelectedCategories([]);
                                setHasEventOnly(false);
                                setSearchQuery("");
                                setSortBy("publishedAt");
                                setSortOrder("desc");
                            }}
                            totalMusics={musics.length}
                            filteredMusics={filteredMusics.length}
                        />

                        {loading ? (
                            <div className="py-20 text-center text-slate-400">加载中...</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredMusics.slice(0, 50).map(music => (
                                    <div
                                        key={music.id}
                                        onClick={() => handleSelect(music)}
                                        className="cursor-pointer"
                                    >
                                        <MusicSelectionItem music={music} translations={translations} />
                                    </div>
                                ))}
                                {filteredMusics.length > 50 && (
                                    <div className="col-span-full py-4 text-center text-slate-400 text-sm">
                                        仅显示前 50 个结果，请使用搜索精确查找
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </SelectorModal>
        </div>
    );
}

// Simplified MusicItem for selection
function MusicSelectionItem({ music, translations }: { music: IMusicInfo, translations: TranslationData | null }) {
    const { assetSource } = useTheme();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);

    return (
        <div className="group bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all hover:shadow-md hover:ring-miku/50 active:scale-[0.98] flex items-center gap-3 p-2">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                <Image
                    src={jacketUrl}
                    alt={music.title}
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <div className="text-xs font-mono text-slate-400 bg-slate-50 px-1 rounded">
                        #{music.id}
                    </div>
                    {/* Categories Badges */}
                    <div className="flex gap-1">
                        {music.categories.includes("mv") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="3D MV" />
                        )}
                        {music.categories.includes("mv_2d") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="2D MV" />
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-slate-700 text-sm line-clamp-1 group-hover:text-miku transition-colors custom-font-jp">
                    {music.title}
                </h3>
                {translations?.music?.title?.[music.title] && (
                    <div className="text-xs text-slate-500 line-clamp-1 mb-0.5">
                        {translations.music.title[music.title]}
                    </div>
                )}

                <div className="text-xs text-slate-400 line-clamp-1">
                    {music.composer}
                </div>
            </div>
        </div>
    );
}
