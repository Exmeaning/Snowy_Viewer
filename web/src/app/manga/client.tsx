"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import BaseFilters from "@/components/common/BaseFilters";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { IMangaItem, IMangaData } from "@/types/manga";
import { getMangaImageUrl } from "@/lib/assets";
import { fetchMangaData } from "@/lib/fetch";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ==================== Constants ====================

function formatDate(timestamp: number): string {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

// ==================== Component ====================

function MangaContent() {
    const searchParams = useSearchParams();

    const [mangas, setMangas] = useState<IMangaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination with scroll restore — 12 per batch
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "manga",
        defaultDisplayCount: 12,
        increment: 12,
        isReady: !isLoading,
    });

    // Fetch mangas data
    useEffect(() => {
        async function fetchMangas() {
            try {
                setIsLoading(true);
                const data = await fetchMangaData<IMangaData>();
                const list = Object.values(data);
                setMangas(list);
                setError(null);
            } catch (err) {
                console.error("Error fetching mangas:", err);
                setError(err instanceof Error ? err.message : "未知错误");
            } finally {
                setIsLoading(false);
            }
        }
        fetchMangas();
    }, []);

    // Filter and sort — supports searching by title AND episode number
    const filteredMangas = useMemo(() => {
        let result = [...mangas];

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            result = result.filter((m) => {
                // Match by title
                if (m.title.toLowerCase().includes(query)) return true;
                // Match by episode number (e.g. "123" or "#123")
                const numQuery = query.replace(/^#/, "");
                if (/^\d+$/.test(numQuery) && m.id === parseInt(numQuery, 10)) return true;
                return false;
            });
        }

        result.sort((a, b) =>
            sortOrder === "asc" ? a.id - b.id : b.id - a.id
        );

        return result;
    }, [mangas, searchQuery, sortOrder]);

    // Displayed mangas
    const displayedMangas = useMemo(() => {
        return filteredMangas.slice(0, displayCount);
    }, [filteredMangas, displayCount]);

    const quickFilterContent = (
        <BaseFilters
            filteredCount={filteredMangas.length}
            totalCount={mangas.length}
            countUnit="话"
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); resetDisplayCount(); }}
            searchPlaceholder="输入标题或话数（如 123）..."
            sortOptions={[{ id: "id", label: "话数" }]}
            sortBy="id"
            sortOrder={sortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setSortOrder(order)}
        />
    );

    useQuickFilter("官方四格筛选", quickFilterContent, [
        searchQuery,
        sortOrder,
        filteredMangas.length,
        mangas.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">官方四格</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    官方四格漫画 <span className="text-miku">列表</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览世界计划中的所有官方四格漫画（中文翻译版）
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
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
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                                {displayedMangas.map((manga) => (
                                    <Link
                                        key={manga.id}
                                        href={`/manga/${manga.id}`}
                                        data-shortcut-item="true"
                                        className="group"
                                    >
                                        <div className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all">
                                            {/* Thumbnail: crop top portion of vertical manga */}
                                            <div className="relative aspect-square overflow-hidden">
                                                <Image
                                                    src={getMangaImageUrl(manga.id)}
                                                    alt={manga.title}
                                                    fill
                                                    className="object-cover object-top group-hover:scale-105 transition-transform"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="p-3">
                                                <div className="text-sm font-bold text-slate-700">
                                                    {manga.title}
                                                </div>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[10px] text-slate-400">
                                                        第{manga.id}话
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        {formatDate(manga.date)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Load More */}
                            {displayedMangas.length < filteredMangas.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedMangas.length} / {filteredMangas.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedMangas.length > 0 && displayedMangas.length >= filteredMangas.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    已显示全部 {filteredMangas.length} 话漫画
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MangaClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载官方四格漫画...</div>}>
                <MangaContent />
            </Suspense>
        </MainLayout>
    );
}
