"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import GachaGrid from "@/components/gacha/GachaGrid";
import GachaFilters from "@/components/gacha/GachaFilters";
import { useTheme } from "@/contexts/ThemeContext";

// API endpoint
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://sekaiviewerapi.exmeaning.com";

// Gacha list item from API
interface GachaListItem {
    id: number;
    gachaType: string;
    name: string;
    assetbundleName: string;
    startAt: number;
    endAt: number;
    pickupCardIds: number[];
}

interface GachaListResponse {
    total: number;
    page: number;
    limit: number;
    gachas: GachaListItem[];
}

function GachaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [gachas, setGachas] = useState<GachaListItem[]>([]);
    const [totalGachas, setTotalGachas] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "startAt">("startAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 24;

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

    // Fetch gachas from API
    const fetchGachas = useCallback(async (pageNum: number, reset: boolean = false) => {
        try {
            setIsLoading(true);

            const params = new URLSearchParams();
            params.set("page", pageNum.toString());
            params.set("limit", PAGE_SIZE.toString());
            if (searchQuery) params.set("search", searchQuery);
            if (isShowSpoiler) params.set("showSpoiler", "true");

            const response = await fetch(`${API_BASE_URL}/api/gachas?${params}`);

            if (!response.ok) {
                throw new Error("Failed to fetch gachas data");
            }

            const data: GachaListResponse = await response.json();

            if (reset) {
                setGachas(data.gachas);
            } else {
                setGachas(prev => [...prev, ...data.gachas]);
            }

            setTotalGachas(data.total);
            setHasMore(data.gachas.length === PAGE_SIZE && (pageNum * PAGE_SIZE) < data.total);
            setError(null);
        } catch (err) {
            console.error("Error fetching gachas:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, isShowSpoiler]);

    // Initial fetch and refetch when filters change
    useEffect(() => {
        if (!filtersInitialized) return;
        document.title = "Snowy SekaiViewer 扭蛋";
        setPage(1);
        fetchGachas(1, true);
    }, [filtersInitialized, searchQuery, isShowSpoiler, fetchGachas]);

    // Sort gachas client-side (since API returns by startAt desc)
    const sortedGachas = useMemo(() => {
        const result = [...gachas];
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
    }, [gachas, sortBy, sortOrder]);

    // Transform to format expected by GachaGrid
    const displayGachas = useMemo(() => {
        return sortedGachas.map(g => ({
            id: g.id,
            gachaType: g.gachaType,
            name: g.name,
            assetbundleName: g.assetbundleName,
            startAt: g.startAt,
            endAt: g.endAt,
            seq: 0,
            gachaBehaviors: [],
            gachaCardRarityRates: [],
            gachaDetails: [],
            gachaPickups: g.pickupCardIds.map((cardId, idx) => ({
                id: idx,
                gachaId: g.id,
                cardId
            }))
        }));
    }, [sortedGachas]);

    // Load more handler
    const loadMore = useCallback(() => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchGachas(nextPage, false);
    }, [page, fetchGachas]);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: "id" | "startAt", newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
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
                        onClick={() => fetchGachas(1, true)}
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
                            totalGachas={totalGachas}
                            filteredGachas={gachas.length}
                        />
                    </div>
                </div>

                {/* Gacha Grid */}
                <div className="flex-1 min-w-0">
                    <GachaGrid gachas={displayGachas} isLoading={isLoading && page === 1} />

                    {/* Load More Button */}
                    {!isLoading && hasMore && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({gachas.length} / {totalGachas})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Loading more indicator */}
                    {isLoading && page > 1 && (
                        <div className="mt-8 flex justify-center">
                            <div className="loading-spinner" style={{ width: '2rem', height: '2rem' }} />
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading && !hasMore && gachas.length > 0 && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {gachas.length} 个扭蛋
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
