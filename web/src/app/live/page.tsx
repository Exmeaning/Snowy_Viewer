"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import VirtualLiveGrid from "@/components/live/VirtualLiveGrid";
import VirtualLiveFilters from "@/components/live/VirtualLiveFilters";
import { IVirtualLiveInfo, VirtualLiveType } from "@/types/virtualLive";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";

function VirtualLiveContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [virtualLives, setVirtualLives] = useState<IVirtualLiveInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [selectedTypes, setSelectedTypes] = useState<VirtualLiveType[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort states
    const [sortBy, setSortBy] = useState<"id" | "startAt">("startAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [displayCount, setDisplayCount] = useState(12);

    // Storage key
    const STORAGE_KEY = "virtual_live_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const types = searchParams.get("types");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        const hasUrlParams = types || search || sort || order;

        if (hasUrlParams) {
            if (types) setSelectedTypes(types.split(",") as VirtualLiveType[]);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "id" | "startAt");
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.types?.length) setSelectedTypes(filters.types);
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
            types: selectedTypes,
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
        if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "startAt") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/live?${queryString}` : "/live";
        router.replace(newUrl, { scroll: false });
    }, [selectedTypes, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    // Fetch virtual lives data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 演唱会";
        async function fetchVirtualLives() {
            try {
                setIsLoading(true);
                const [data, translationsData] = await Promise.all([
                    fetchMasterData<IVirtualLiveInfo[]>("virtualLives.json"),
                    loadTranslations(),
                ]);
                setVirtualLives(data);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching virtual lives:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchVirtualLives();
    }, []);

    // Filter and sort virtual lives
    const filteredVirtualLives = useMemo(() => {
        let result = [...virtualLives];

        // Apply type filter
        if (selectedTypes.length > 0) {
            result = result.filter(vl => selectedTypes.includes(vl.virtualLiveType as VirtualLiveType));
        }

        // Apply search query (supports both name, ID, and Chinese translations)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryAsNumber = parseInt(query, 10);

            result = result.filter(vl => {
                // Match by ID
                if (vl.id === queryAsNumber) return true;
                // Match by Japanese name
                if (vl.name.toLowerCase().includes(query)) return true;
                // Match by Chinese name translation
                const chineseName = translations?.virtualLive?.name?.[vl.name];
                if (chineseName && chineseName.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            result = result.filter(vl => vl.startAt <= Date.now());
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "id":
                    comparison = a.id - b.id;
                    break;
                case "startAt":
                    comparison = a.startAt - b.startAt;
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [virtualLives, selectedTypes, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);

    // Displayed virtual lives (with pagination)
    const displayedVirtualLives = useMemo(() => {
        return filteredVirtualLives.slice(0, displayCount);
    }, [filteredVirtualLives, displayCount]);

    // Load more handler
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 12);
    }, []);

    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedTypes([]);
        setSearchQuery("");
        setSortBy("startAt");
        setSortOrder("desc");
        setDisplayCount(12);
    }, []);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: "id" | "startAt", newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        setDisplayCount(12);
    }, []);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">虚拟演唱会数据库</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    虚拟 <span className="text-miku">演唱会</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览并探索世界计划中的所有虚拟演唱会
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
                        <VirtualLiveFilters
                            selectedTypes={selectedTypes}
                            onTypeChange={setSelectedTypes}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={handleSortChange}
                            onReset={resetFilters}
                            totalItems={virtualLives.length}
                            filteredItems={filteredVirtualLives.length}
                        />
                    </div>
                </div>

                {/* Virtual Live Grid */}
                <div className="flex-1 min-w-0">
                    <VirtualLiveGrid virtualLives={displayedVirtualLives} isLoading={isLoading} />

                    {/* Load More Button */}
                    {!isLoading && displayedVirtualLives.length < filteredVirtualLives.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedVirtualLives.length} / {filteredVirtualLives.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading && displayedVirtualLives.length > 0 && displayedVirtualLives.length >= filteredVirtualLives.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {filteredVirtualLives.length} 个演唱会
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LivePage() {
    return (
        <MainLayout activeNav="演唱会">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载演唱会...</div>}>
                <VirtualLiveContent />
            </Suspense>
        </MainLayout>
    );
}
