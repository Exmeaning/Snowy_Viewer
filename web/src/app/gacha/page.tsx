"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import GachaGrid from "@/components/gacha/GachaGrid";
import GachaFilters from "@/components/gacha/GachaFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { IGachaInfo } from "@/types/types";
import { fetchMasterData } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";

function GachaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [allGachas, setAllGachas] = useState<IGachaInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "startAt">("startAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [displayCount, setDisplayCount] = useState(24);

    // Storage key
    const STORAGE_KEY = "gacha_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        const hasUrlParams = search || sort || order;

        if (hasUrlParams) {
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "id" | "startAt");
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
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
            search: searchQuery,
            sortBy,
            sortOrder,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "startAt") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/gacha?${queryString}` : "/gacha";
        router.replace(newUrl, { scroll: false });
    }, [searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    // Fetch gachas from master data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 扭蛋";
        async function fetchGachas() {
            try {
                setIsLoading(true);
                const [data, translationsData] = await Promise.all([
                    fetchMasterData<IGachaInfo[]>("gachas.json"),
                    loadTranslations(),
                ]);
                setAllGachas(data);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching gachas:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchGachas();
    }, []);

    // Filter and sort gachas
    const filteredGachas = useMemo(() => {
        let result = [...allGachas];

        // Apply search query (supports both name, ID, and Chinese translations)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryAsNumber = parseInt(query, 10);

            result = result.filter(gacha => {
                // Match by ID
                if (gacha.id === queryAsNumber) return true;
                // Match by Japanese name
                if (gacha.name.toLowerCase().includes(query)) return true;
                // Match by Chinese name translation
                const chineseName = translations?.gacha?.name?.[gacha.name];
                if (chineseName && chineseName.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            result = result.filter(gacha => gacha.startAt <= Date.now());
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
    }, [allGachas, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);

    // Displayed gachas (with pagination)
    const displayedGachas = useMemo(() => {
        return filteredGachas.slice(0, displayCount);
    }, [filteredGachas, displayCount]);

    // Load more handler
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 24);
    }, []);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: "id" | "startAt", newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        setDisplayCount(24);
    }, []);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">扭蛋数据库</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    扭蛋 <span className="text-miku">列表</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览世界计划中的所有扭蛋活动
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
                        <GachaFilters
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={handleSortChange}
                            totalGachas={allGachas.length}
                            filteredGachas={filteredGachas.length}
                        />
                    </div>
                </div>

                {/* Gacha Grid */}
                <div className="flex-1 min-w-0">
                    <GachaGrid gachas={displayedGachas} isLoading={isLoading} />

                    {/* Load More Button */}
                    {!isLoading && displayedGachas.length < filteredGachas.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedGachas.length} / {filteredGachas.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading && displayedGachas.length > 0 && displayedGachas.length >= filteredGachas.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {filteredGachas.length} 个扭蛋
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function GachaPage() {
    return (
        <MainLayout activeNav="扭蛋">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载扭蛋...</div>}>
                <GachaContent />
            </Suspense>
        </MainLayout>
    );
}
