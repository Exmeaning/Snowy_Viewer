"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { getComicUrl } from "@/lib/assets";

// Master data URL
const TIPS_DATA_URL = "https://sekaimaster.exmeaning.com/master/tips.json";

interface ITipInfo {
    id: number;
    title: string;
    description?: string;
    fromUserRank?: number;
    toUserRank?: number;
    assetbundleName?: string; // Only comics have this
}

function ComicContent() {
    const searchParams = useSearchParams();
    const { isShowSpoiler, assetSource } = useTheme();

    const [comics, setComics] = useState<ITipInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [displayCount, setDisplayCount] = useState(24);

    // Selected comic for full view
    const [selectedComic, setSelectedComic] = useState<ITipInfo | null>(null);

    // Fetch comics data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 漫画";
        async function fetchComics() {
            try {
                setIsLoading(true);
                const response = await fetch(TIPS_DATA_URL);

                if (!response.ok) {
                    throw new Error("Failed to fetch tips data");
                }

                const data: ITipInfo[] = await response.json();
                // Filter only comics (those with assetbundleName)
                const comicsOnly = data.filter(t => t.assetbundleName);
                setComics(comicsOnly);
                setError(null);
            } catch (err) {
                console.error("Error fetching comics:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchComics();
    }, []);

    // Filter and sort comics
    const filteredComics = useMemo(() => {
        let result = [...comics];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c => c.title.toLowerCase().includes(query));
        }

        // Sort
        result.sort((a, b) => sortOrder === "asc" ? a.id - b.id : b.id - a.id);

        return result;
    }, [comics, searchQuery, sortOrder]);

    // Displayed comics
    const displayedComics = useMemo(() => {
        return filteredComics.slice(0, displayCount);
    }, [filteredComics, displayCount]);

    // Load more
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 24);
    }, []);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Full Image Viewer */}
            {selectedComic && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setSelectedComic(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
                        onClick={() => setSelectedComic(null)}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="max-w-4xl max-h-[90vh] overflow-auto">
                        <img
                            src={getComicUrl(selectedComic.assetbundleName!, assetSource)}
                            alt={selectedComic.title}
                            className="max-w-full h-auto"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-white text-center mt-4 font-bold">{selectedComic.title}</p>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">漫画图鉴</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    四格漫画 <span className="text-miku">列表</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览世界计划中的所有四格漫画
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout - Same as Events Page */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel on Large Screens */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24">
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    筛选
                                </h2>
                                <span className="text-xs text-slate-500">
                                    {filteredComics.length} 篇
                                </span>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Search */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                        搜索
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="输入漫画标题..."
                                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku transition-all"
                                        />
                                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Sort Options */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                        排序
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortOrder === "desc"
                                                ? "bg-miku text-white"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            最新优先
                                            {sortOrder === "desc" && (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortOrder === "asc"
                                                ? "bg-miku text-white"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            最旧优先
                                            {sortOrder === "asc" && (
                                                <svg className="w-3 h-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {displayedComics.map(comic => (
                                    <div
                                        key={comic.id}
                                        onClick={() => setSelectedComic(comic)}
                                        className="group cursor-pointer"
                                    >
                                        <div className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all">
                                            <div className="relative aspect-[4/3]">
                                                <Image
                                                    src={getComicUrl(comic.assetbundleName!, assetSource)}
                                                    alt={comic.title}
                                                    fill
                                                    className="object-contain bg-slate-50 group-hover:scale-105 transition-transform"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="p-3">
                                                <p className="text-sm font-bold text-slate-700 truncate">{comic.title}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">#{comic.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Load More */}
                            {displayedComics.length < filteredComics.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedComics.length} / {filteredComics.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedComics.length > 0 && displayedComics.length >= filteredComics.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    已显示全部 {filteredComics.length} 篇漫画
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ComicPage() {
    return (
        <MainLayout activeNav="漫画">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载漫画...</div>}>
                <ComicContent />
            </Suspense>
        </MainLayout>
    );
}
