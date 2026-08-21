"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import BaseFilters from "@/components/common/BaseFilters";
import { useI18n } from "@/contexts/I18nContext";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { IMangaItem, IMangaData } from "@/types/manga";
import { getMangaImageUrl } from "@/lib/assets";
import { fetchMangaData } from "@/lib/fetch";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ==================== Component ====================

function MangaContent() {
    const { t, formatDate } = useI18n();

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
                setError(err instanceof Error ? err.message : t("page.manga.unknownError"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchMangas();
    }, [t]);

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
            countUnit={t("page.manga.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); resetDisplayCount(); }}
            searchPlaceholder={t("page.manga.searchPlaceholder")}
            sortOptions={[{ id: "id", label: t("page.manga.sortLabelEpisode") }]}
            sortBy="id"
            sortOrder={sortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setSortOrder(order)}
        />
    );

    useQuickFilter(t("page.manga.filterTitle"), quickFilterContent, [
        searchQuery,
        sortOrder,
        filteredMangas.length,
        mangas.length,
        t,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                    <span className="hh-label text-miku">{t("page.manga.badge")}</span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl text-primary-text">
                    {t("page.manga.title")} <span className="text-miku">{t("page.manga.titleHighlight")}</span>
                </h1>
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                    {t("page.manga.description")}
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/12 border border-red-500/30 rounded-[var(--hh-radius-lg)] text-red-600 text-sm">
                    <p className="font-bold">{t("page.manga.loadFailed")}</p>
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
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                            {displayedMangas.map((manga) => (
                                <Link
                                    key={manga.id}
                                    href={`/manga/${manga.id}`}
                                    data-shortcut-item="true"
                                    className="group"
                                >
                                    <div className="hh-tile hh-press rounded-[var(--hh-radius-lg)] overflow-hidden group-hover:border-[var(--hh-accent)]">
                                        {/* Thumbnail: crop top portion of vertical manga */}
                                        <div className="relative aspect-square overflow-hidden bg-[var(--hh-surface-sunken)]">
                                            <Image
                                                src={getMangaImageUrl(manga.id)}
                                                alt={manga.title}
                                                fill
                                                className="object-cover object-top"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="p-4 border-t border-[var(--hh-border-hairline)]">
                                            <div className="hh-title text-sm text-primary-text line-clamp-1 group-hover:text-miku transition-colors">
                                                {manga.title}
                                            </div>
                                            <div className="flex items-center justify-between mt-3 text-[10px] text-[var(--hh-text-tertiary)] font-medium">
                                                <span className="hh-numeric text-miku bg-[var(--hh-accent-wash-strong)] px-2 py-0.5 rounded-[var(--hh-radius-sm)] border border-[var(--hh-accent-line)]">
                                                    {t("page.manga.episodeLabel", { id: manga.id })}
                                                </span>
                                                <span className="hh-numeric">
                                                    {formatDate(manga.date * 1000, {
                                                        year: "numeric",
                                                        month: "2-digit",
                                                        day: "2-digit",
                                                    })}
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
                                    className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3 font-bold flex items-center gap-2"
                                >
                                    {t("page.manga.loadMore")}
                                    <span className="hh-numeric text-xs font-semibold opacity-75 bg-black/10 px-2 py-0.5 rounded-[var(--hh-radius-sm)]">
                                        {displayedMangas.length} / {filteredMangas.length}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* All loaded */}
                        {displayedMangas.length > 0 && displayedMangas.length >= filteredMangas.length && (
                            <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm font-medium">
                                {t("page.manga.allLoaded", { count: filteredMangas.length })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function MangaClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.manga.loadingFallback")}</div>}>
                <MangaContent />
            </Suspense>
        </MainLayout>
    );
}
