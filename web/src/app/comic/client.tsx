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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 ios-glass-card border-miku/30 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.comic.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.comic.title")} <span className="text-miku">{t("page.comic.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto font-light">
                    {t("page.comic.description")}
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 ios-glass-card border-red-500/20 bg-red-500/5 text-red-500 rounded-xl text-sm">
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
                                        <div className="ios-glass-card ios-glass-card-interactive rounded-2xl overflow-hidden group">
                                            <div className="relative aspect-[4/3] bg-slate-100/50 dark:bg-slate-900/50">
                                                <Image
                                                    src={getComicUrl(comic.assetbundleName!, assetSource)}
                                                    alt={comic.title}
                                                    fill
                                                    className="object-contain group-hover:scale-105 transition-transform duration-500"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                            </div>
                                            <div className="p-4 border-t border-slate-200/20 dark:border-slate-800/20">
                                                <div className="text-sm font-bold text-primary-text line-clamp-1 group-hover:text-miku transition-colors duration-300">
                                                    <TranslatedText
                                                        original={comic.title}
                                                        category="comic"
                                                        field="title"
                                                        originalClassName="block truncate"
                                                        translationClassName="text-xs font-medium text-slate-400 dark:text-slate-500 block truncate mt-0.5"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-[10px] font-bold text-miku bg-miku/10 dark:bg-miku/20 px-2.5 py-0.5 rounded-full border border-miku/20">#{comic.id}</span>
                                                    {comic.fromUserRank !== undefined && (
                                                        <span className="text-[10px] text-slate-400 font-medium">Rank {comic.fromUserRank}</span>
                                                    )}
                                                </div>
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
                                        className="ios-glass-btn ios-glass-btn-primary px-8 py-3 font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                                    >
                                        {t("page.comic.loadMore")}
                                        <span className="text-xs font-semibold opacity-75 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                            {displayedComics.length} / {filteredComics.length}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedComics.length > 0 && displayedComics.length >= filteredComics.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm font-medium">
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
