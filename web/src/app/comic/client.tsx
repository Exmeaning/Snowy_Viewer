"use client";
import { useState, useEffect, useMemo, Suspense } from "react";

import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import BaseFilters from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { getComicUrl } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { oldComicTips } from "@/lib/oldComicTips";

interface ITipInfo {
    id: number;
    title: string;
    description?: string;
    fromUserRank?: number;
    toUserRank?: number;
    assetbundleName?: string; // Only comics have this
}

function ComicContent() {
    const { assetSource } = useTheme();
    const { t } = useI18n();

    const [comics, setComics] = useState<ITipInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination with scroll restore
    const { displayCount, loadMore } = useScrollRestore({
        storageKey: "comic",
        defaultDisplayCount: 24,
        increment: 24,
        isReady: !isLoading,
    });

    // Selected comic for full view
    const [selectedComic, setSelectedComic] = useState<ITipInfo | null>(null);

    // Fetch comics data
    useEffect(() => {
        async function fetchComics() {
            try {
                setIsLoading(true);
                const data = await fetchMasterData<ITipInfo[]>("tips.json");
                // Filter only comics (those with assetbundleName)
                const comicsOnly = data.filter(t => t.assetbundleName);

                // Add manual old comic tips
                const comicIds = new Set(comicsOnly.map(c => c.id));
                const missingOldComics = oldComicTips.filter(c => !comicIds.has(c.id));
                const allComics = [...comicsOnly, ...missingOldComics];

                setComics(allComics);
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

    const quickFilterContent = (
        <BaseFilters
            filteredCount={filteredComics.length}
            totalCount={comics.length}
            countUnit={t("page.comic.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("page.comic.searchPlaceholder")}
            sortOptions={[{ id: "id", label: "ID" }]}
            sortBy="id"
            sortOrder={sortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setSortOrder(order)}
        />
    );

    useQuickFilter(t("page.comic.filterTitle"), quickFilterContent, [
        searchQuery,
        sortOrder,
        filteredComics.length,
        comics.length,
        t,
    ]);



    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <ImagePreviewModal
                isOpen={!!selectedComic}
                onClose={() => setSelectedComic(null)}
                title={selectedComic ? t("page.comic.previewTitle", { title: selectedComic.title }) : t("page.comic.previewTitleFallback")}
                imageUrl={selectedComic?.assetbundleName ? getComicUrl(selectedComic.assetbundleName, assetSource) : ""}
                alt={selectedComic?.title || t("page.comic.previewAltFallback")}
                fileName={selectedComic ? `comic_${selectedComic.id}.png` : "comic.png"}
            />

            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.comic.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.comic.title")} <span className="text-miku">{t("page.comic.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.comic.description")}
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("page.comic.loadFailed")}</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout - Same as Events Page */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel on Large Screens */}
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
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                {displayedComics.map(comic => (
                                    <div
                                        key={comic.id}
                                        onClick={() => setSelectedComic(comic)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setSelectedComic(comic);
                                            }
                                        }}
                                        data-shortcut-item="true"
                                        tabIndex={0}
                                        role="button"
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
                                                <div className="text-sm font-bold text-slate-700">
                                                    <TranslatedText
                                                        original={comic.title}
                                                        category="comic"
                                                        field="title"
                                                        originalClassName="block"
                                                        translationClassName="text-xs font-medium text-slate-400 block"
                                                    />
                                                </div>
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
                                        data-shortcut-load-more="true"
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        {t("page.comic.loadMore")}
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedComics.length} / {filteredComics.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedComics.length > 0 && displayedComics.length >= filteredComics.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    {t("page.comic.allLoaded", { count: filteredComics.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ComicClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.comic.loadingFallback")}</div>}>
                <ComicContent />
            </Suspense>
        </MainLayout>
    );
}
