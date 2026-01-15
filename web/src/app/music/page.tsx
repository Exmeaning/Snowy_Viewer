"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import MusicGrid from "@/components/music/MusicGrid";
import MusicFilters from "@/components/music/MusicFilters";
import {
    IMusicInfo,
    IMusicTagInfo,
    MusicTagType,
    MusicCategoryType,
} from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";

// Master data URLs
const MUSICS_DATA_URL = "https://sekaimaster.exmeaning.com/master/musics.json";
const MUSIC_TAGS_URL = "https://sekaimaster.exmeaning.com/master/musicTags.json";

function MusicContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [eventMusicIds, setEventMusicIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [selectedTag, setSelectedTag] = useState<MusicTagType>("all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>([]);
    const [hasEventOnly, setHasEventOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort states
    const [sortBy, setSortBy] = useState<"publishedAt" | "id">("publishedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [displayCount, setDisplayCount] = useState(30);

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

        const hasUrlParams = tag || categories || eventOnly || search || sort || order;

        if (hasUrlParams) {
            if (tag) setSelectedTag(tag as MusicTagType);
            if (categories) setSelectedCategories(categories.split(",") as MusicCategoryType[]);
            if (eventOnly === "true") setHasEventOnly(true);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "publishedAt" | "id");
            if (order) setSortOrder(order as "asc" | "desc");
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

        const queryString = params.toString();
        const newUrl = queryString ? `/music?${queryString}` : "/music";
        router.replace(newUrl, { scroll: false });
    }, [selectedTag, selectedCategories, hasEventOnly, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    // Fetch data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 音乐";
        async function fetchData() {
            try {
                setIsLoading(true);
                const [musicsRes, tagsRes, eventMusicsRes] = await Promise.all([
                    fetch(MUSICS_DATA_URL),
                    fetch(MUSIC_TAGS_URL),
                    fetch("https://sekaimaster.exmeaning.com/master/eventMusics.json"),
                ]);

                if (!musicsRes.ok || !tagsRes.ok || !eventMusicsRes.ok) {
                    throw new Error("Failed to fetch music data");
                }

                const musicsData: IMusicInfo[] = await musicsRes.json();
                const tagsData: IMusicTagInfo[] = await tagsRes.json();
                const eventMusicsData: { musicId: number }[] = await eventMusicsRes.json();

                setMusics(musicsData);
                setMusicTags(tagsData);
                setEventMusicIds(new Set(eventMusicsData.map((em) => em.musicId)));
                setError(null);
            } catch (err) {
                console.error("Error fetching music data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

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

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(
                (m) =>
                    m.title.toLowerCase().includes(query) ||
                    m.composer.toLowerCase().includes(query) ||
                    m.lyricist.toLowerCase().includes(query) ||
                    m.arranger.toLowerCase().includes(query)
            );
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
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [musics, musicTags, eventMusicIds, selectedTag, selectedCategories, hasEventOnly, searchQuery, sortBy, sortOrder, isShowSpoiler]);

    // Displayed musics (with pagination)
    const displayedMusics = useMemo(() => {
        return filteredMusics.slice(0, displayCount);
    }, [filteredMusics, displayCount]);

    // Load more handler
    const loadMore = useCallback(() => {
        setDisplayCount((prev) => prev + 30);
    }, []);

    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedTag("all");
        setSelectedCategories([]);
        setHasEventOnly(false);
        setSearchQuery("");
        setSortBy("publishedAt");
        setSortOrder("desc");
        setDisplayCount(30);
    }, []);

    // Sort change handler
    const handleSortChange = useCallback(
        (newSortBy: "publishedAt" | "id", newSortOrder: "asc" | "desc") => {
            setSortBy(newSortBy);
            setSortOrder(newSortOrder);
            setDisplayCount(30);
        },
        []
    );

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
                    <div className="lg:sticky lg:top-24">
                        <MusicFilters
                            selectedTag={selectedTag}
                            onTagChange={(tag) => {
                                setSelectedTag(tag);
                                setDisplayCount(30);
                            }}
                            selectedCategories={selectedCategories}
                            onCategoryChange={(cats) => {
                                setSelectedCategories(cats);
                                setDisplayCount(30);
                            }}
                            hasEventOnly={hasEventOnly}
                            onHasEventOnlyChange={(checked) => {
                                setHasEventOnly(checked);
                                setDisplayCount(30);
                            }}
                            searchQuery={searchQuery}
                            onSearchChange={(q) => {
                                setSearchQuery(q);
                                setDisplayCount(30);
                            }}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={handleSortChange}
                            onReset={resetFilters}
                            totalMusics={musics.length}
                            filteredMusics={filteredMusics.length}
                        />
                    </div>
                </div>

                {/* Music Grid */}
                <div className="flex-1 min-w-0">
                    <MusicGrid musics={displayedMusics} isLoading={isLoading} />

                    {/* Load More Button */}
                    {!isLoading && displayedMusics.length < filteredMusics.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedMusics.length} / {filteredMusics.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading &&
                        displayedMusics.length > 0 &&
                        displayedMusics.length >= filteredMusics.length && (
                            <div className="mt-8 text-center text-slate-400 text-sm">
                                已显示全部 {filteredMusics.length} 首乐曲
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

export default function MusicPage() {
    return (
        <MainLayout activeNav="音乐">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载音乐...</div>}>
                <MusicContent />
            </Suspense>
        </MainLayout>
    );
}
