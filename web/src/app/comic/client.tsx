"use client";
import { useState, useEffect, useMemo, Suspense } from "react";

import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import PageHeader from "@/components/common/PageHeader";
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

            <PageHeader
                badge={t("page.comic.badge")}
                title={t("page.comic.title")}
                titleHighlight={t("page.comic.titleHighlight")}
                description={t("page.comic.description")}
            />

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/12 border border-red-500/30 rounded-[var(--hh-radius-lg)] text-red-600 text-sm">
                    <p className="font-bold">{t("page.comic.loadFailed")}</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Grid */}
            <div className="w-full min-w-0">
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
                                    <div className="hh-tile hh-press rounded-[var(--hh-radius-lg)] overflow-hidden group-hover:border-[var(--hh-accent)]">
                                        <div className="relative aspect-[4/3] bg-[var(--hh-surface-sunken)]">
                                            <Image
                                                src={getComicUrl(comic.assetbundleName!, assetSource)}
                                                alt={comic.title}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="p-4 border-t border-[var(--hh-border-hairline)]">
                                            <div className="hh-title text-sm text-primary-text line-clamp-1 group-hover:text-miku transition-colors">
                                                <TranslatedText
                                                    original={comic.title}
                                                    category="comic"
                                                    field="title"
                                                    originalClassName="block truncate"
                                                    translationClassName="text-xs font-medium text-[var(--hh-text-tertiary)] block truncate mt-0.5"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="hh-numeric text-[10px] font-bold text-miku bg-[var(--hh-accent-wash-strong)] px-2.5 py-0.5 rounded-[var(--hh-radius-sm)] border border-[var(--hh-accent-line)]">#{comic.id}</span>
                                                {comic.fromUserRank !== undefined && (
                                                    <span className="hh-numeric text-[10px] text-[var(--hh-text-tertiary)] font-medium">Rank {comic.fromUserRank}</span>
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
                                    className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3 font-bold flex items-center gap-2"
                                >
                                    {t("page.comic.loadMore")}
                                    <span className="hh-numeric text-xs font-semibold opacity-75 bg-black/10 px-2 py-0.5 rounded-[var(--hh-radius-sm)]">
                                        {displayedComics.length} / {filteredComics.length}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* All loaded */}
                        {displayedComics.length > 0 && displayedComics.length >= filteredComics.length && (
                            <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm font-medium">
                                {t("page.comic.allLoaded", { count: filteredComics.length })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function ComicClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.comic.loadingFallback")}</div>}>
                <ComicContent />
            </Suspense>
        </MainLayout>
    );
}
