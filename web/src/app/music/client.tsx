"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import MusicGrid from "@/components/music/MusicGrid";
import MusicFilters from "@/components/music/MusicFilters";
import MusicItem from "@/components/music/MusicItem";
import {
    IMusicInfo,
    IMusicTagInfo,
    MusicTagType,
    MusicCategoryType,
} from "@/types/music";

interface MusicDifficulty {
    musicId: number;
    musicDifficulty: string;
    playLevel: number;
}

type RawMusicCategory = MusicCategoryType | { musicCategoryName: MusicCategoryType };
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { fetchSongConstants, buildSongConstantsMap } from "@/lib/songConstants";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { fetchMusicAliases } from "@/lib/musicAliases";

// Search index item (from search-index.json)
interface SearchIndexItem {
    id: number;
    n: string;   // name (JP)
    cn?: string;  // name (CN translation)
    g: string;    // group: cards, music, events, gacha
}

// Level Separator Card Component
function LevelSeparatorCard({ level, difficulty }: { level: number; difficulty: string }) {
    const difficultyColors: Record<string, string> = {
        EASY: "from-green-400 to-green-500",
        NORMAL: "from-blue-400 to-blue-500",
        HARD: "from-yellow-400 to-yellow-500",
        EXPERT: "from-red-400 to-red-500",
        MASTER: "from-purple-500 to-purple-600",
        APPEND: "from-pink-500 to-pink-600",
    };

    const gradientClass = difficultyColors[difficulty] || "from-slate-400 to-slate-500";

    return (
        <div className={`aspect-square rounded-xl bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center shadow-lg`}>
            <div className="text-white text-center px-2">
                <div className="text-[10px] sm:text-xs font-bold opacity-90 mb-0.5">
                    {difficulty}
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black">
                    {level}
                </div>
            </div>
        </div>
    );
}

function MusicContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [musicDifficulties, setMusicDifficulties] = useState<MusicDifficulty[]>([]);
    const [eventMusicIds, setEventMusicIds] = useState<Set<number>>(new Set());
    const [musicCnMap, setMusicCnMap] = useState<Map<number, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [songConstantsMap, setSongConstantsMap] = useState<Record<number, Record<string, number>>>({});
    const [musicAliasesMap, setMusicAliasesMap] = useState<Map<number, string[]>>(new Map());


    // Filter states
    const [selectedTag, setSelectedTag] = useState<MusicTagType>("all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>([]);
    const [hasEventOnly, setHasEventOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>("master");
    const [showDifficulty, setShowDifficulty] = useState(true);

    // Sort states
    const [sortBy, setSortBy] = useState<"publishedAt" | "id" | "level" | "constant">("publishedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination with scroll restore
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "music",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading,
    });

    // Storage key
    const STORAGE_KEY = "music_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const tag = searchParams.get("tag");
        const categories = searchParams.get("categories");
        const eventOnly = searchParams.get("eventOnly");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");
        const showDiff = searchParams.get("showDifficulty");

        const hasUrlParams = tag || categories || eventOnly || search || sort || order || showDiff;

        if (hasUrlParams) {
            if (tag) setSelectedTag(tag as MusicTagType);
            if (categories) setSelectedCategories(categories.split(",") as MusicCategoryType[]);
            if (eventOnly === "true") setHasEventOnly(true);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "publishedAt" | "id" | "level" | "constant");
            if (order) setSortOrder(order as "asc" | "desc");
            if (showDiff === "false") setShowDifficulty(false);
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.tag && filters.tag !== "all") setSelectedTag(filters.tag);
                    if (filters.categories?.length) setSelectedCategories(filters.categories);
                    if (filters.eventOnly) setHasEventOnly(true);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                    if (filters.showDifficulty === false) setShowDifficulty(false);
                }
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    }, []);

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        const filters = {
            tag: selectedTag,
            categories: selectedCategories,
            eventOnly: hasEventOnly,
            search: searchQuery,
            sortBy,
            sortOrder,
            showDifficulty,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        const params = new URLSearchParams();
        if (selectedTag !== "all") params.set("tag", selectedTag);
        if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
        if (hasEventOnly) params.set("eventOnly", "true");
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "publishedAt") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        if (!showDifficulty) params.set("showDifficulty", "false");

        const queryString = params.toString();
        const newUrl = queryString ? `/music?${queryString}` : "/music";
        router.replace(newUrl, { scroll: false });
    }, [selectedTag, selectedCategories, hasEventOnly, searchQuery, sortBy, sortOrder, showDifficulty, router, filtersInitialized]);

    // Fetch data
    useEffect(() => {
        // document.title = "Snowy SekaiViewer 音乐"; // Moved to metadata
        async function fetchData() {
            try {
                setIsLoading(true);

                // Fetch essential data and search index (for CN translations)
                const [musicsData, tagsData, difficultiesData, eventMusicsData, searchIndexData] = await Promise.all([
                    fetchMasterData<IMusicInfo[]>("musics.json"),
                    fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
                    fetchMasterData<MusicDifficulty[]>("musicDifficulties.json"),
                    fetchMasterData<{ musicId: number }[]>("eventMusics.json"),
                    fetch("https://translation.exmeaning.com/data/search-index.json")
                        .then((res) => res.json() as Promise<SearchIndexItem[]>)
                        .catch(() => [] as SearchIndexItem[]),
                ]);

                // Build musicId -> CN title map from search index
                const cnMap = new Map<number, string>();
                for (const item of searchIndexData) {
                    if (item.g === "music" && item.cn) {
                        cnMap.set(item.id, item.cn);
                    }
                }

                // Normalize musics data (CN server returns categories as objects)
                const normalizedMusics = musicsData.map((music) => ({
                    ...music,
                    categories: (music.categories as unknown as RawMusicCategory[]).map((cat) =>
                        typeof cat === "object" && cat !== null && "musicCategoryName" in cat
                            ? cat.musicCategoryName
                            : cat
                    ),
                }));

                setMusics(normalizedMusics);
                setMusicTags(tagsData);
                setMusicDifficulties(difficultiesData);
                setEventMusicIds(new Set(eventMusicsData.map((em) => em.musicId)));
                setMusicCnMap(cnMap);
                setError(null);

                // Fetch song constants (non-blocking)
                fetchSongConstants().then(entries => {
                    setSongConstantsMap(buildSongConstantsMap(entries));
                }).catch(err => {
                    console.warn("Failed to load song constants:", err);
                });

                // Fetch music aliases (non-blocking)
                fetchMusicAliases().then(aliasesMap => {
                    setMusicAliasesMap(aliasesMap);
                }).catch(err => {
                    console.warn("Failed to load music aliases:", err);
                });

            } catch (err) {
                console.error("Error fetching music data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Build difficulty map
    const musicDifficultiesMap = useMemo(() => {
        const map: Record<number, Record<string, number>> = {};
        musicDifficulties.forEach(d => {
            if (!map[d.musicId]) map[d.musicId] = {};
            map[d.musicId]![d.musicDifficulty] = d.playLevel;
        });
        return map;
    }, [musicDifficulties]);

    // Filter and sort musics
    const filteredMusics = useMemo(() => {
        let result = [...musics];

        // Apply tag filter
        if (selectedTag !== "all") {
            const musicIdsWithTag = new Set(
                musicTags
                    .filter((mt) => mt.musicTag === selectedTag)
                    .map((mt) => mt.musicId)
            );
            result = result.filter((m) => musicIdsWithTag.has(m.id));
        }

        // Apply category filter (all selected categories must be present)
        if (selectedCategories.length > 0) {
            result = result.filter((m) =>
                selectedCategories.every((cat) => m.categories.includes(cat))
            );
        }

        // Apply event only filter
        if (hasEventOnly) {
            result = result.filter((m) => eventMusicIds.has(m.id));
        }

        // Apply search query (supports both name, ID, Chinese translations, and aliases)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryAsNumber = parseInt(query, 10);

            result = result.filter((m) => {
                // Match by ID
                if (m.id === queryAsNumber) return true;
                // Match by Japanese title
                if (m.title.toLowerCase().includes(query)) return true;
                // Match by Chinese title from search index
                const chineseTitle = musicCnMap.get(m.id);
                if (chineseTitle && chineseTitle.toLowerCase().includes(query)) return true;
                // Match by composer/lyricist/arranger
                if (m.composer.toLowerCase().includes(query)) return true;
                if (m.lyricist.toLowerCase().includes(query)) return true;
                if (m.arranger.toLowerCase().includes(query)) return true;
                // Match by aliases
                const aliases = musicAliasesMap.get(m.id);
                if (aliases && aliases.some(alias => alias.toLowerCase().includes(query))) return true;
                return false;
            });
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            result = result.filter((m) => m.publishedAt <= Date.now());
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "id":
                    comparison = a.id - b.id;
                    break;
                case "publishedAt":
                    comparison = a.publishedAt - b.publishedAt;
                    break;
                case "level":
                    const levelA = musicDifficultiesMap[a.id]?.[selectedDifficulty] || 0;
                    const levelB = musicDifficultiesMap[b.id]?.[selectedDifficulty] || 0;
                    comparison = levelA - levelB;
                    if (comparison === 0) comparison = a.publishedAt - b.publishedAt;
                    break;
                case "constant":
                    const constA = songConstantsMap[a.id]?.[selectedDifficulty] || 0;
                    const constB = songConstantsMap[b.id]?.[selectedDifficulty] || 0;
                    comparison = constA - constB;
                    if (comparison === 0) comparison = a.publishedAt - b.publishedAt;
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [musics, musicTags, eventMusicIds, selectedTag, selectedCategories, hasEventOnly, searchQuery, sortBy, sortOrder, isShowSpoiler, musicCnMap, musicDifficultiesMap, selectedDifficulty, songConstantsMap, musicAliasesMap]);

    // Displayed musics with level separators (only when sorting by level)
    const displayedMusicsWithSeparators = useMemo(() => {
        const musics = filteredMusics.slice(0, displayCount);

        if (sortBy !== "level" && sortBy !== "constant") {
            return musics.map(m => ({ type: 'music' as const, data: m }));
        }

        // Group by level/constant and insert separators
        const result: Array<{ type: 'music' | 'separator', data: IMusicInfo | { level: number, difficulty: string } }> = [];
        let lastLevel: number | null = null;

        for (const music of musics) {
            const rawLevel = sortBy === "constant"
                ? (songConstantsMap[music.id]?.[selectedDifficulty] || 0)
                : (musicDifficultiesMap[music.id]?.[selectedDifficulty] || 0);
            // For constant sorting, group by integer level only (e.g., 35 not 35.1/35.2)
            const groupLevel = sortBy === "constant" ? Math.floor(rawLevel) : rawLevel;

            if (groupLevel !== lastLevel) {
                result.push({
                    type: 'separator',
                    data: { level: groupLevel, difficulty: selectedDifficulty.toUpperCase() }
                });
                lastLevel = groupLevel;
            }

            result.push({ type: 'music', data: music });
        }

        return result;
    }, [filteredMusics, displayCount, sortBy, musicDifficultiesMap, selectedDifficulty, songConstantsMap]);



    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedTag("all");
        setSelectedCategories([]);
        setHasEventOnly(false);
        setSearchQuery("");
        setSortBy("publishedAt");
        setSortOrder("desc");
        setShowDifficulty(true);
        resetDisplayCount();
    }, [resetDisplayCount]);

    // Sort change handler
    const handleSortChange = useCallback(
        (newSortBy: "publishedAt" | "id" | "level" | "constant", newSortOrder: "asc" | "desc") => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
            resetDisplayCount();
        },
        [resetDisplayCount]
    );

    const quickFilterContent = (
        <MusicFilters
            selectedTag={selectedTag}
            onTagChange={(tag) => {
                setSelectedTag(tag);
            }}
            selectedCategories={selectedCategories}
            onCategoryChange={(cats) => {
                setSelectedCategories(cats);
            }}
            hasEventOnly={hasEventOnly}
            onHasEventOnlyChange={(checked) => {
                setHasEventOnly(checked);
            }}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
                setSearchQuery(q);
            }}
            selectedDifficulty={selectedDifficulty}
            onDifficultyChange={setSelectedDifficulty}
            showDifficulty={showDifficulty}
            onShowDifficultyChange={setShowDifficulty}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onReset={resetFilters}
            totalMusics={musics.length}
            filteredMusics={filteredMusics.length}
        />
    );

    useQuickFilter("音乐筛选", quickFilterContent, [
        selectedTag,
        selectedCategories,
        hasEventOnly,
        searchQuery,
        selectedDifficulty,
        showDifficulty,
        sortBy,
        sortOrder,
        musics.length,
        filteredMusics.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">
                        音乐数据库
                    </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    音乐 <span className="text-miku">图鉴</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览并探索世界计划中的所有乐曲
                </p>
                <p className="text-xs text-slate-400 mt-1">
                    音乐别名搜索支持 · 别名库来源：<a href="https://github.com/Team-Haruki" target="_blank" rel="noopener noreferrer" className="text-miku hover:underline">haruki</a>（别名由用户上传，与 Moesekai 无关）
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-500 underline hover:no-underline"
                    >
                        重试
                    </button>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel on Large Screens */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                {/* Music Grid */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {Array.from({ length: 15 }).map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="rounded-xl overflow-hidden bg-white/60 border border-slate-200/60">
                                        <div className="aspect-square bg-slate-200"></div>
                                        <div className="p-3 space-y-2">
                                            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : displayedMusicsWithSeparators.filter(item => item.type === 'music').length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-6xl mb-4">🎵</div>
                            <h3 className="text-xl font-bold text-slate-600 mb-2">
                                没有找到匹配的音乐
                            </h3>
                            <p className="text-slate-500">
                                尝试调整筛选条件
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {displayedMusicsWithSeparators.map((item, index) => {
                                if (item.type === 'separator') {
                                    const sepData = item.data as { level: number, difficulty: string };
                                    return (
                                        <LevelSeparatorCard
                                            key={`sep-${sepData.difficulty}-${sepData.level}`}
                                            level={sepData.level}
                                            difficulty={sepData.difficulty}
                                        />
                                    );
                                } else {
                                    const music = item.data as IMusicInfo;
                                    const now = Date.now();
                                    const isSpoiler = music.publishedAt > now;
                                    const musicConstant = showDifficulty ? undefined : songConstantsMap[music.id]?.[selectedDifficulty];
                                    return <MusicItem key={music.id} music={music} isSpoiler={isSpoiler} constant={musicConstant} difficulties={musicDifficultiesMap[music.id]} showDifficulty={showDifficulty} cnTitle={musicCnMap.get(music.id)} />;
                                }
                            })}
                        </div>
                    )}

                    {/* Load More Button */}
                    {!isLoading && displayedMusicsWithSeparators.filter(item => item.type === 'music').length < filteredMusics.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                data-shortcut-load-more="true"
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedMusicsWithSeparators.filter(item => item.type === 'music').length} / {filteredMusics.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading &&
                        displayedMusicsWithSeparators.filter(item => item.type === 'music').length > 0 &&
                        displayedMusicsWithSeparators.filter(item => item.type === 'music').length >= filteredMusics.length && (
                            <div className="mt-8 text-center text-slate-400 text-sm">
                                已显示全部 {filteredMusics.length} 首乐曲
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

export default function MusicClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载音乐...</div>}>
                <MusicContent />
            </Suspense>
        </MainLayout>
    );
}
