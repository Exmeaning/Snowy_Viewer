"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection, FilterButton } from "@/components/common/BaseFilters";
import ExternalLink from "@/components/ExternalLink";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { fetchGuidesIndex, type GuideEntry, type GuidesIndex } from "@/lib/guides";

// Category badge color mapping
const categoryColors: Record<string, string> = {
    gacha: "bg-amber-100 text-amber-700 border-amber-200",
    event: "bg-blue-100 text-blue-700 border-blue-200",
    team: "bg-emerald-100 text-emerald-700 border-emerald-200",
    beginner: "bg-purple-100 text-purple-700 border-purple-200",
    system: "bg-slate-100 text-slate-600 border-slate-200",
};

function GuidesContent() {
    const searchParams = useSearchParams();
    const { t } = useI18n();

    const [indexData, setIndexData] = useState<GuidesIndex | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Scroll restore
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "guides",
        defaultDisplayCount: 20,
        increment: 20,
        isReady: !isLoading,
    });

    // Restore URL params on mount
    useEffect(() => {
        const search = searchParams.get("search");
        const category = searchParams.get("category");
        const sort = searchParams.get("sortOrder");
        if (search) setSearchQuery(search);
        if (category) setSelectedCategory(category);
        if (sort === "asc" || sort === "desc") setSortOrder(sort);
    }, [searchParams]);

    // Update URL when filters change
    const updateURL = useCallback((params: Record<string, string>) => {
        const url = new URL(window.location.href);
        Object.entries(params).forEach(([k, v]) =>
            v && v !== "all" && v !== "desc" ? url.searchParams.set(k, v) : url.searchParams.delete(k)
        );
        window.history.replaceState({}, "", url.toString());
    }, []);

    // Fetch index
    useEffect(() => {
        async function load() {
            try {
                setIsLoading(true);
                const data = await fetchGuidesIndex();
                setIndexData(data);
                setError(null);
            } catch (err) {
                console.error("Error fetching guides index:", err);
                setError(err instanceof Error ? err.message : t("page.guides.loadFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [t]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const guides = indexData?.guides ?? [];
    const categories = indexData?.categories ?? {};

    // Filter and sort
    const filteredGuides = useMemo(() => {
        let result = [...guides];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (g) =>
                    g.title.toLowerCase().includes(q) ||
                    g.tags.some((t) => t.toLowerCase().includes(q))
            );
        }

        if (selectedCategory !== "all") {
            result = result.filter((g) => g.category === selectedCategory);
        }

        result.sort((a, b) =>
            sortOrder === "asc"
                ? a.date.localeCompare(b.date)
                : b.date.localeCompare(a.date)
        );

        return result;
    }, [guides, searchQuery, selectedCategory, sortOrder]);

    const displayedGuides = useMemo(
        () => filteredGuides.slice(0, displayCount),
        [filteredGuides, displayCount]
    );

    // Reset display count on filter change
    useEffect(() => {
        resetDisplayCount();
        updateURL({ search: searchQuery, category: selectedCategory, sortOrder });
    }, [searchQuery, selectedCategory, sortOrder, resetDisplayCount, updateURL]);

    const hasActiveFilters = searchQuery !== "" || selectedCategory !== "all" || sortOrder !== "desc";

    const resetFilters = () => {
        setSearchQuery("");
        setSelectedCategory("all");
        setSortOrder("desc");
    };

    const quickFilterContent = (
        <BaseFilters
            title={t("page.guides.filterTitle")}
            filteredCount={filteredGuides.length}
            totalCount={guides.length}
            countUnit={t("page.guides.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("page.guides.searchPlaceholder")}
            sortOptions={[{ id: "date", label: t("common.filter.sortByDate") }]}
            sortBy="date"
            sortOrder={sortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setSortOrder(order)}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
        >
            <FilterSection label={t("common.filter.category")}>
                <div className="flex flex-wrap gap-2">
                    <FilterButton
                        selected={selectedCategory === "all"}
                        onClick={() => setSelectedCategory("all")}
                    >
                        {t("common.filter.all")}
                    </FilterButton>
                    {Object.entries(categories).map(([key, label]) => (
                        <FilterButton
                            key={key}
                            selected={selectedCategory === key}
                            onClick={() => setSelectedCategory(key)}
                        >
                            {label}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>
        </BaseFilters>
    );

    useQuickFilter(t("page.guides.filterTitle"), quickFilterContent, [
        searchQuery,
        selectedCategory,
        sortOrder,
        filteredGuides.length,
        guides.length,
        t,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.guides.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.guides.title")} <span className="text-miku">{t("page.guides.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.guides.description")}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 bg-amber-500/5 border border-amber-500/10 dark:border-amber-500/20 rounded-xl px-3 py-1.5 mx-auto">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-550/10 dark:bg-amber-500/10 text-[9px] font-bold">!</span>
                    <span>{t("page.guides.machineTranslationNotice")}</span>
                </div>
            </div>

            {/* Tool Site Card */}
            <div className="mb-8 max-w-2xl mx-auto">
                <ExternalLink
                    href="https://sekaitools.exmeaning.com/"
                    className="block p-4 rounded-xl bg-gradient-to-r from-miku/5 to-luka/5 border border-miku/20 hover:border-miku/40 hover:shadow-lg transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-miku to-miku-dark flex items-center justify-center text-white flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-primary-text group-hover:text-miku transition-colors">
                                {t("page.guides.toolSiteTitle")}
                            </div>
                            <div className="text-xs text-slate-400">
                                {t("page.guides.toolSiteDescription")}
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </div>
                </ExternalLink>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("page.guides.loadFailed")}</p>
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

                {/* Guide List */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {displayedGuides.map((guide) => (
                                    <GuideCard
                                        key={guide.id}
                                        guide={guide}
                                        categoryLabel={categories[guide.category] ?? guide.category}
                                    />
                                ))}
                            </div>

                            {/* Empty State */}
                            {filteredGuides.length === 0 && !isLoading && (
                                <div className="text-center py-16 text-slate-400">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    <p className="text-sm">{t("page.guides.noResult")}</p>
                                </div>
                            )}

                            {/* Load More */}
                            {displayedGuides.length < filteredGuides.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                                    >
                                        {t("page.guides.loadMore")}
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedGuides.length} / {filteredGuides.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedGuides.length > 0 && displayedGuides.length >= filteredGuides.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    {t("page.guides.allLoaded", { count: filteredGuides.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function GuideCard({ guide, categoryLabel }: { guide: GuideEntry; categoryLabel: string }) {
    const colorClass = categoryColors[guide.category] ?? "bg-slate-100 text-slate-600 border-slate-200";

    return (
        <Link
            href={`/guides/${guide.id}/`}
            data-shortcut-item="true"
            className="block group"
        >
            <div className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {/* Category + Date */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}>
                                {categoryLabel}
                            </span>
                            <span className="text-xs text-slate-400">{guide.date}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-slate-700 group-hover:text-miku transition-colors line-clamp-2">
                            {guide.title}
                        </h3>

                        {/* Tags + Author */}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {guide.tags.slice(0, 4).map((tag) => (
                                <span
                                    key={tag}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-100"
                                >
                                    {tag}
                                </span>
                            ))}
                            <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">
                                {guide.author.group}
                            </span>
                        </div>
                    </div>

                    {/* Arrow */}
                    <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </Link>
    );
}

function GuidesLoadingFallback() {
    const { t } = useI18n();

    return (
        <div className="flex h-[50vh] w-full items-center justify-center text-slate-500">
            {t("page.guides.loadingFallback")}
        </div>
    );
}

export default function GuidesClient() {
    return (
        <MainLayout>
            <Suspense fallback={<GuidesLoadingFallback />}>
                <GuidesContent />
            </Suspense>
        </MainLayout>
    );
}
