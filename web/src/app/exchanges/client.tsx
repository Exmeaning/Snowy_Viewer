"use client";

import Link from "@/components/LocalizedLink";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import PageHeader from "@/components/common/PageHeader";
import BaseFilters, { FilterButton, FilterSection } from "@/components/common/BaseFilters";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { getCharacterIconUrl, getCommonMaterialThumbnailUrl, getMaterialThumbnailUrl, getMysekaiMaterialThumbnailUrl, getPracticeTicketThumbnailUrl, getSkillPracticeTicketThumbnailUrl } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import {
    areExchangeFiltersEqual,
    DEFAULT_EXCHANGE_FILTERS,
    filterAndSortExchanges,
    formatExchangeTime,
    getExchangeCategoryLabel,
    getExchangeStatusLabel,
    getExchangeTypeLabel,
    getRefreshCycleLabel,
    getRewardTypeLabel,
    getExchangeLastModified,
    loadExchangeCoreData,
    parseExchangeFilterParams,
    summarizeExchangeRewards,
    type ExchangeCoreData,
    type ExchangeListFilters,
    type ExchangeSortBy,
    type ExchangeSortOrder,
} from "@/lib/exchanges";
import { getCharacterName } from "@/lib/i18n";
import type { ExchangeStatus, FlattenedMaterialExchange } from "@/types/exchange";
import type { ICardInfo } from "@/types/types";

// Local wrapper so the loading and loaded branches keep sharing one header
// definition instead of repeating the prop list.
function ExchangesHeader() {
    const { t } = useI18n();

    return (
        <PageHeader
            badge={t("page.exchanges.badge")}
            title={t("page.exchanges.title")}
            titleHighlight={t("page.exchanges.titleHighlight")}
            description={t("page.exchanges.description")}
        />
    );
}

function Badge({
    label,
    tone = "slate",
}: {
    label: string;
    tone?: "miku" | "violet" | "amber" | "emerald" | "rose" | "slate";
}) {
    const toneClasses: Record<string, string> = {
        miku: "bg-[var(--hh-accent-wash)] text-miku",
        violet: "bg-violet-500/12 text-violet-500",
        amber: "bg-amber-500/12 text-amber-600",
        emerald: "bg-emerald-500/12 text-emerald-600",
        rose: "bg-rose-500/12 text-rose-500",
        slate: "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]",
    };

    return (
        <span className={`inline-flex items-center rounded-[var(--hh-radius-sm)] px-2 py-1 text-[10px] font-bold ${toneClasses[tone]}`}>
            {label}
        </span>
    );
}

function getStatusTone(status: ExchangeStatus): "emerald" | "amber" | "rose" | "slate" {
    switch (status) {
        case "active":
            return "emerald";
        case "upcoming":
            return "amber";
        case "ended":
            return "rose";
        case "permanent":
        default:
            return "slate";
    }
}

function SkeletonList() {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
                <div
                    key={index}
                    className="hh-tile rounded-[var(--hh-radius-lg)] p-4 animate-pulse"
                >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        <div className="h-5 w-16 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-5 w-20 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-5 w-14 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)]" />
                    </div>
                    <div className="h-5 w-3/4 rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)] mb-1" />
                    <div className="h-4 w-1/2 rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)] mb-3" />
                    <div className="flex gap-1.5 mb-3">
                        <div className="h-5 w-16 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-5 w-20 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)]" />
                    </div>
                    <div className="flex justify-between">
                        <div className="h-3 w-24 rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-3 w-12 rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <div className="hh-well flex flex-col items-center justify-center py-20 text-center">
            <svg className="mb-4 h-14 w-14 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V7a2 2 0 00-2-2h-3V3.5A1.5 1.5 0 0013.5 2h-3A1.5 1.5 0 009 3.5V5H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-4M9 9h6m-6 4h4" />
            </svg>
            <p className="hh-title text-base text-[var(--hh-text-secondary)]">{title}</p>
            {description ? <p className="mt-1 text-sm text-[var(--hh-text-tertiary)]">{description}</p> : null}
        </div>
    );
}

interface ExchangePageContextValue {
    coreData: ExchangeCoreData;
    cardsMap: Map<number, ICardInfo>;
}

const ExchangePageContext = React.createContext<ExchangePageContextValue | null>(null);

function useExchangePageContext() {
    const ctx = React.useContext(ExchangePageContext);
    if (!ctx) throw new Error("useExchangePageContext must be used within provider");
    return ctx;
}

function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-2">
            <p className="hh-label mb-1">{label}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {children}
            </div>
        </div>
    );
}
function RewardThumbnail({ detail }: { detail: { resourceType: string; resourceId?: number; resourceQuantity?: number } }) {
    const { t } = useI18n();
    const { assetSource } = useTheme();
    const { coreData, cardsMap } = useExchangePageContext();

    if (detail.resourceType === "card" && typeof detail.resourceId === "number") {
        const card = cardsMap.get(detail.resourceId);
        if (card) {
            return (
                <div className="shrink-0" title={card.prefix}>
                    <SekaiCardThumbnail card={card} width={40} />
                </div>
            );
        }
    }

    if (detail.resourceType === "material" && typeof detail.resourceId === "number") {
        return (
            <img
                src={getMaterialThumbnailUrl(detail.resourceId, assetSource)}
                alt={`material-${detail.resourceId}`}
                className="shrink-0 h-9 w-9 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] object-contain p-0.5"
                loading="lazy"
            />
        );
    }

    if (
        detail.resourceType === "coin" ||
        detail.resourceType === "jewel" ||
        detail.resourceType === "virtual_coin"
    ) {
        const assetName = detail.resourceType === "coin"
            ? "coin"
            : detail.resourceType === "jewel"
                ? "jewel"
                : "virtual_coin";
        return (
            <img
                src={getCommonMaterialThumbnailUrl(assetName, assetSource)}
                alt={detail.resourceType}
                className="shrink-0 h-9 w-9 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] object-contain p-0.5"
                loading="lazy"
            />
        );
    }

    if (detail.resourceType === "mysekai_material" && typeof detail.resourceId === "number") {
        const mat = coreData.mysekaiMaterialMap.get(detail.resourceId);
        const imgUrl = mat?.iconAssetbundleName
            ? getMysekaiMaterialThumbnailUrl(mat.iconAssetbundleName, assetSource)
            : undefined;
        return imgUrl ? (
            <img
                src={imgUrl}
                alt={mat?.name ?? `mysekai-mat-${detail.resourceId}`}
                className="shrink-0 h-9 w-9 rounded-[var(--hh-radius-md)] bg-violet-500/12 object-contain p-0.5"
                loading="lazy"
                title={mat?.name}
            />
        ) : (
            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-[var(--hh-radius-md)] bg-violet-500/12 text-[8px] font-bold text-violet-500">
                MS
            </div>
        );
    }

    if (detail.resourceType === "practice_ticket" && typeof detail.resourceId === "number") {
        return (
            <img
                src={getPracticeTicketThumbnailUrl(detail.resourceId, assetSource)}
                alt={`practice-ticket-${detail.resourceId}`}
                className="shrink-0 h-9 w-9 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] object-contain p-0.5"
                loading="lazy"
                title={getRewardTypeLabel(detail.resourceType, t)}
            />
        );
    }

    if (detail.resourceType === "skill_practice_ticket" && typeof detail.resourceId === "number") {
        return (
            <img
                src={getSkillPracticeTicketThumbnailUrl(detail.resourceId, assetSource)}
                alt={`skill-practice-ticket-${detail.resourceId}`}
                className="shrink-0 h-9 w-9 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] object-contain p-0.5"
                loading="lazy"
                title={getRewardTypeLabel(detail.resourceType, t)}
            />
        );
    }

    if (detail.resourceType === "character_rank_exp" && typeof detail.resourceId === "number") {
        return (
            <div
                className="shrink-0 relative"
                title={`${getRewardTypeLabel(detail.resourceType, t)} · ${getCharacterName(t, detail.resourceId)}`}
            >
                <img
                    src={getCharacterIconUrl(detail.resourceId)}
                    alt={`character-rank-exp-${detail.resourceId}`}
                    className="h-9 w-9 rounded-full border border-emerald-500/30 bg-[var(--hh-surface-2)] object-cover"
                    loading="lazy"
                />
                <span className="hh-numeric absolute -bottom-0.5 -right-0.5 rounded-[var(--hh-radius-xs)] bg-emerald-500 px-[3px] text-[6px] font-bold text-white leading-tight select-none">
                    EXP
                </span>
            </div>
        );
    }

    return (
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] text-[8px] font-bold text-[var(--hh-text-tertiary)]">
            {getRewardTypeLabel(detail.resourceType, t).slice(0, 2)}
        </div>
    );
}

function CostThumbnail({ cost }: { cost: { resourceType: string; resourceId: number; quantity: number } }) {
    const { assetSource } = useTheme();
    const { coreData } = useExchangePageContext();

    if (cost.resourceType === "material") {
        return (
            <div className="shrink-0 relative" title={coreData.materialMap.get(cost.resourceId)?.name}>
                <img
                    src={getMaterialThumbnailUrl(cost.resourceId, assetSource)}
                    alt={`cost-${cost.resourceId}`}
                    className="h-7 w-7 rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)] object-contain p-0.5"
                    loading="lazy"
                />
                <span className="hh-numeric absolute -bottom-0.5 -right-0.5 rounded-[var(--hh-radius-xs)] bg-[rgba(20,22,28,0.85)] px-0.5 text-[7px] font-bold text-white leading-tight">
                    {cost.quantity}
                </span>
            </div>
        );
    }

    if (cost.resourceType === "mysekai_material") {
        const mat = coreData.mysekaiMaterialMap.get(cost.resourceId);
        const imgUrl = mat?.iconAssetbundleName
            ? getMysekaiMaterialThumbnailUrl(mat.iconAssetbundleName, assetSource)
            : undefined;
        return (
            <div className="shrink-0 relative" title={mat?.name}>
                {imgUrl ? (
                    <img
                        src={imgUrl}
                        alt={`cost-ms-${cost.resourceId}`}
                        className="h-7 w-7 rounded-[var(--hh-radius-xs)] bg-violet-500/12 object-contain p-0.5"
                        loading="lazy"
                    />
                ) : (
                    <div className="h-7 w-7 rounded-[var(--hh-radius-xs)] bg-violet-500/12 flex items-center justify-center text-[7px] font-bold text-violet-500">MS</div>
                )}
                <span className="hh-numeric absolute -bottom-0.5 -right-0.5 rounded-[var(--hh-radius-xs)] bg-[rgba(20,22,28,0.85)] px-0.5 text-[7px] font-bold text-white leading-tight">
                    {cost.quantity}
                </span>
            </div>
        );
    }

    return null;
}

function ExchangeCard({ entry }: { entry: FlattenedMaterialExchange }) {
    const { t, formatDate } = useI18n();
    const _rewardSummary = useMemo(() => summarizeExchangeRewards(entry.rewardDetails), [entry.rewardDetails]);
    const visibleRewards = entry.rewardDetails.slice(0, 8);
    const hiddenRewardCount = Math.max(0, entry.rewardDetails.length - 8);
    const visibleCosts = entry.costs.slice(0, 8);
    const hiddenCostCount = Math.max(0, entry.costs.length - 8);

    return (
        <Link
            href={`/exchanges/${entry.id}`}
            data-shortcut-item="true"
            className="hh-tile hh-press group block rounded-[var(--hh-radius-lg)] p-4 hover:border-[var(--hh-accent-line)]"
        >
            <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge label={getExchangeStatusLabel(entry.status, t)} tone={getStatusTone(entry.status)} />
                <Badge label={getExchangeCategoryLabel(entry.exchangeCategory, t)} tone="violet" />
                <Badge label={getExchangeTypeLabel(entry.materialExchangeType, t)} tone="amber" />
                {typeof entry.exchangeLimit === "number" ? <Badge label={t("page.exchanges.limitTimes", { count: entry.exchangeLimit })} tone="rose" /> : null}
            </div>

            <h2 className="hh-title text-sm text-[var(--hh-text-primary)] transition-colors group-hover:text-miku mb-3 line-clamp-2">
                {entry.resolvedTitle}
            </h2>

            <div className="flex gap-4">
                {visibleRewards.length > 0 && (
                    <div className="flex-1 min-w-0">
                        <ScrollRow label={t("page.exchanges.rewards")}>
                            {visibleRewards.map((detail, i) => (
                                <RewardThumbnail key={`r-${entry.id}-${i}`} detail={detail} />
                            ))}
                            {hiddenRewardCount > 0 && (
                                <div className="hh-numeric shrink-0 flex h-9 w-9 items-center justify-center rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] text-[10px] font-bold text-[var(--hh-text-tertiary)]">
                                    +{hiddenRewardCount}
                                </div>
                            )}
                        </ScrollRow>
                    </div>
                )}

                {visibleCosts.length > 0 && (
                    <div className="flex-1 min-w-0">
                        <ScrollRow label={t("page.exchanges.costs")}>
                            {visibleCosts.map((cost, i) => (
                                <CostThumbnail key={`c-${entry.id}-${i}`} cost={cost} />
                            ))}
                            {hiddenCostCount > 0 && (
                                <div className="hh-numeric shrink-0 flex h-7 w-7 items-center justify-center rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)] text-[8px] font-bold text-[var(--hh-text-tertiary)]">
                                    +{hiddenCostCount}
                                </div>
                            )}
                        </ScrollRow>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="hh-numeric text-[var(--hh-text-tertiary)]">{formatExchangeTime(getExchangeLastModified(entry), formatDate)}</span>
                <span className="font-bold text-miku transition-transform group-hover:translate-x-0.5">
                    {t("page.exchanges.detailLink")}
                </span>
            </div>
        </Link>
    );
}

function normalizeFilters(filters: ExchangeListFilters): ExchangeListFilters {
    const allowedSortBy: ExchangeSortBy[] = ["status_priority", "seq", "id", "startAt", "endAt"];
    const allowedSortOrder: ExchangeSortOrder[] = ["asc", "desc"];

    return {
        ...DEFAULT_EXCHANGE_FILTERS,
        ...filters,
        sortBy: allowedSortBy.includes(filters.sortBy) ? filters.sortBy : DEFAULT_EXCHANGE_FILTERS.sortBy,
        sortOrder: allowedSortOrder.includes(filters.sortOrder) ? filters.sortOrder : DEFAULT_EXCHANGE_FILTERS.sortOrder,
    };
}

function ExchangesContent() {
    const searchParams = useSearchParams();
    const { t } = useI18n();
    const [coreData, setCoreData] = useState<ExchangeCoreData | null>(null);
    const [cardsMap, setCardsMap] = useState<Map<number, ICardInfo>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [filters, setFilters] = useState<ExchangeListFilters>(DEFAULT_EXCHANGE_FILTERS);

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "exchanges",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading,
    });

    useEffect(() => {
        const parsed = normalizeFilters(parseExchangeFilterParams(searchParams));
        setFilters((prev) => (areExchangeFiltersEqual(prev, parsed) ? prev : parsed));
        setFiltersInitialized(true);
    }, [searchParams]);

    useEffect(() => {
        if (!filtersInitialized || typeof window === "undefined") return;

        const url = new URL(window.location.href);
        url.search = "";

        const nextParams = new URLSearchParams();
        if (filters.searchQuery.trim()) nextParams.set("search", filters.searchQuery.trim());
        if (filters.selectedSummaryIds.length > 0) nextParams.set("summaries", filters.selectedSummaryIds.join(","));
        if (filters.selectedCategories.length > 0) nextParams.set("categories", filters.selectedCategories.join(","));
        if (filters.selectedExchangeTypes.length > 0) nextParams.set("exchangeTypes", filters.selectedExchangeTypes.join(","));
        if (filters.selectedStatuses.length > 0) nextParams.set("statuses", filters.selectedStatuses.join(","));
        if (filters.selectedRefreshCycles.length > 0) nextParams.set("refreshCycles", filters.selectedRefreshCycles.join(","));
        if (filters.selectedRewardTypes.length > 0) nextParams.set("rewardTypes", filters.selectedRewardTypes.join(","));
        if (filters.selectedCostTypes.length > 0) nextParams.set("costTypes", filters.selectedCostTypes.join(","));
        if (filters.sortBy !== DEFAULT_EXCHANGE_FILTERS.sortBy) nextParams.set("sortBy", filters.sortBy);
        if (filters.sortOrder !== DEFAULT_EXCHANGE_FILTERS.sortOrder) nextParams.set("sortOrder", filters.sortOrder);

        url.search = nextParams.toString();
        window.history.replaceState({}, "", url.toString());
    }, [filters, filtersInitialized]);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                setIsLoading(true);
                const [loaded, cards] = await Promise.all([
                    loadExchangeCoreData(),
                    fetchMasterData<ICardInfo[]>("cards.json").catch(() => [] as ICardInfo[]),
                ]);
                if (cancelled) return;
                setCoreData(loaded);
                setCardsMap(new Map(cards.map((c) => [c.id, c])));
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading exchanges:", err);
                setError(err instanceof Error ? err.message : t("page.exchanges.loadFailed"));
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const summaryOptions = useMemo(() => {
        if (!coreData) return [];
        return [...coreData.summaries]
            .sort((a, b) => a.seq - b.seq)
            .map((summary) => ({
                id: summary.id,
                label: summary.name,
                count: summary.materialExchanges.length,
            }));
    }, [coreData]);

    const categoryOptions = useMemo(() => {
        if (!coreData) return [];
        return Array.from(new Set(coreData.flattenedExchanges.map((entry) => entry.exchangeCategory)))
            .sort((a, b) => getExchangeCategoryLabel(a, t).localeCompare(getExchangeCategoryLabel(b, t)));
    }, [coreData, t]);

    const rewardTypeOptions = useMemo(() => {
        if (!coreData) return [];
        return Array.from(new Set(coreData.flattenedExchanges.flatMap((entry) => entry.rewardTypes)))
            .sort((a, b) => getRewardTypeLabel(a, t).localeCompare(getRewardTypeLabel(b, t)));
    }, [coreData, t]);

    const hasActiveFilters =
        filters.searchQuery !== DEFAULT_EXCHANGE_FILTERS.searchQuery ||
        filters.selectedSummaryIds.length > 0 ||
        filters.selectedCategories.length > 0 ||
        filters.selectedExchangeTypes.length > 0 ||
        filters.selectedStatuses.length > 0 ||
        filters.selectedRefreshCycles.length > 0 ||
        filters.selectedRewardTypes.length > 0 ||
        filters.selectedCostTypes.length > 0 ||
        filters.sortBy !== DEFAULT_EXCHANGE_FILTERS.sortBy ||
        filters.sortOrder !== DEFAULT_EXCHANGE_FILTERS.sortOrder;

    const updateFilters = useCallback((updater: (prev: ExchangeListFilters) => ExchangeListFilters) => {
        setFilters((prev) => normalizeFilters(updater(prev)));
        resetDisplayCount();
    }, [resetDisplayCount]);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_EXCHANGE_FILTERS);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const filteredEntries = useMemo(() => {
        if (!coreData) return [];
        return filterAndSortExchanges(coreData.flattenedExchanges, filters);
    }, [coreData, filters]);

    const displayedEntries = useMemo(() => filteredEntries.slice(0, displayCount), [filteredEntries, displayCount]);

    const quickFilterContent = useMemo(() => (
        <BaseFilters
            title={t("page.exchanges.filterPanelTitle")}
            filteredCount={filteredEntries.length}
            totalCount={coreData?.flattenedExchanges.length || 0}
            countUnit={t("page.exchanges.countUnit")}
            searchQuery={filters.searchQuery}
            onSearchChange={(query) => updateFilters((prev) => ({ ...prev, searchQuery: query }))}
            searchPlaceholder={t("page.exchanges.searchPlaceholder")}
            sortOptions={[
                { id: "status_priority", label: t("common.filter.sortByStatusPriority") },
                { id: "seq", label: t("common.filter.sortByDefault") },
                { id: "id", label: t("common.filter.sortById") },
                { id: "startAt", label: t("common.filter.sortByStartAt") },
                { id: "endAt", label: t("common.filter.sortByEndAt") },
            ]}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={(sortBy, sortOrder) => updateFilters((prev) => ({
                ...prev,
                sortBy: sortBy as ExchangeSortBy,
                sortOrder,
            }))}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
        >
            <FilterSection label={t("common.filter.exchangeShop")}>
                <select
                    className="hh-input w-full p-2 text-sm"
                    value={filters.selectedSummaryIds.length === 1 ? String(filters.selectedSummaryIds[0]) : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [Number(e.target.value)] : [];
                        updateFilters((prev) => ({ ...prev, selectedSummaryIds: val }));
                    }}
                >
                    <option value="">{t("common.filter.all")}</option>
                    {summaryOptions.map((summary) => (
                        <option key={summary.id} value={summary.id}>
                            {summary.label} ({summary.count})
                        </option>
                    ))}
                </select>
            </FilterSection>

            <FilterSection label={t("common.filter.category")}>
                <select
                    className="hh-input w-full p-2 text-sm"
                    value={filters.selectedCategories.length === 1 ? filters.selectedCategories[0] : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [e.target.value] : [];
                        updateFilters((prev) => ({ ...prev, selectedCategories: val }));
                    }}
                >
                    <option value="">{t("common.filter.all")}</option>
                    {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                            {getExchangeCategoryLabel(category, t)}
                        </option>
                    ))}
                </select>
            </FilterSection>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FilterSection label={t("common.filter.exchangeType")}>
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedExchangeTypes.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedExchangeTypes: [] }))}
                        >
                            {t("common.filter.all")}
                        </FilterButton>
                        {(["normal", "beginner"] as ExchangeListFilters["selectedExchangeTypes"]).map((type) => (
                            <FilterButton
                                key={type}
                                selected={filters.selectedExchangeTypes.includes(type)}
                                onClick={() => updateFilters((prev) => ({
                                    ...prev,
                                    selectedExchangeTypes: prev.selectedExchangeTypes.includes(type)
                                        ? prev.selectedExchangeTypes.filter((item) => item !== type)
                                        : [...prev.selectedExchangeTypes, type].sort((a, b) => a.localeCompare(b)),
                                }))}
                            >
                                {getExchangeTypeLabel(type, t)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label={t("page.exchanges.fields.status")}>
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedStatuses.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedStatuses: [] }))}
                        >
                            {t("common.filter.all")}
                        </FilterButton>
                        {(["active", "upcoming", "permanent", "ended"] as ExchangeStatus[]).map((status) => (
                            <FilterButton
                                key={status}
                                selected={filters.selectedStatuses.includes(status)}
                                onClick={() => updateFilters((prev) => ({
                                    ...prev,
                                    selectedStatuses: prev.selectedStatuses.includes(status)
                                        ? prev.selectedStatuses.filter((item) => item !== status)
                                        : [...prev.selectedStatuses, status],
                                }))}
                            >
                                {getExchangeStatusLabel(status, t)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FilterSection label={t("common.filter.refreshCycle")}>
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedRefreshCycles.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedRefreshCycles: [] }))}
                        >
                            {t("common.filter.all")}
                        </FilterButton>
                        {(["none", "monthly"] as ExchangeListFilters["selectedRefreshCycles"]).map((refreshCycle) => (
                            <FilterButton
                                key={refreshCycle}
                                selected={filters.selectedRefreshCycles.includes(refreshCycle)}
                                onClick={() => updateFilters((prev) => ({
                                    ...prev,
                                    selectedRefreshCycles: prev.selectedRefreshCycles.includes(refreshCycle)
                                        ? prev.selectedRefreshCycles.filter((item) => item !== refreshCycle)
                                        : [...prev.selectedRefreshCycles, refreshCycle].sort((a, b) => a.localeCompare(b)),
                                }))}
                            >
                                {getRefreshCycleLabel(refreshCycle, t)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label={t("common.filter.costType")}>
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedCostTypes.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedCostTypes: [] }))}
                        >
                            {t("common.filter.all")}
                        </FilterButton>
                        {([
                            "material",
                            "mysekai_material",
                        ] as ExchangeListFilters["selectedCostTypes"]).map((type) => (
                            <FilterButton
                                key={type}
                                selected={filters.selectedCostTypes.includes(type)}
                                onClick={() => updateFilters((prev) => ({
                                    ...prev,
                                    selectedCostTypes: prev.selectedCostTypes.includes(type)
                                        ? prev.selectedCostTypes.filter((item) => item !== type)
                                        : [...prev.selectedCostTypes, type],
                                }))}
                            >
                                {getRewardTypeLabel(type, t)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </div>

            <FilterSection label={t("common.filter.rewardType")}>
                <select
                    className="hh-input w-full p-2 text-sm"
                    value={filters.selectedRewardTypes.length === 1 ? filters.selectedRewardTypes[0] : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [e.target.value] : [];
                        updateFilters((prev) => ({ ...prev, selectedRewardTypes: val }));
                    }}
                >
                    <option value="">{t("common.filter.all")}</option>
                    {rewardTypeOptions.map((rewardType) => (
                        <option key={rewardType} value={rewardType}>
                            {getRewardTypeLabel(rewardType, t)}
                        </option>
                    ))}
                </select>
            </FilterSection>
        </BaseFilters>
    ), [coreData?.flattenedExchanges.length, filteredEntries.length, filters, hasActiveFilters, resetFilters, rewardTypeOptions, summaryOptions, categoryOptions, t, updateFilters]);

    useQuickFilter(t("page.exchanges.filterTitle"), quickFilterContent, [quickFilterContent, t]);

    if (!coreData) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <ExchangesHeader />
                {error ? (
                    <div className="rounded-[var(--hh-radius-lg)] border border-red-500/30 bg-red-500/12 px-5 py-4 text-sm text-red-600">
                        <p className="font-bold">{t("common.state.loadingFailed")}</p>
                        <p className="mt-1">{error}</p>
                    </div>
                ) : (
                    <SkeletonList />
                )}
            </div>
        );
    }

    return (
        <ExchangePageContext.Provider value={{ coreData, cardsMap }}>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <ExchangesHeader />

                {error ? (
                    <div className="mb-6 rounded-[var(--hh-radius-lg)] border border-amber-500/30 bg-amber-500/12 px-5 py-4 text-sm text-amber-600">
                        <p className="font-bold">{t("page.exchanges.loadNotice")}</p>
                        <p className="mt-1">{error}</p>
                    </div>
                ) : null}

                {!isLoading ? (
                    <div className="hh-numeric mb-4 text-xs text-[var(--hh-text-secondary)]">
                        {t("page.exchanges.currentTotalSummary", {
                            count: filteredEntries.length,
                            total: hasActiveFilters
                                ? t("page.exchanges.currentTotalSuffix", { total: coreData.flattenedExchanges.length })
                                : "",
                        })}
                    </div>
                ) : null}

                <div className="w-full min-w-0">
                    {isLoading ? (
                        <SkeletonList />
                    ) : filteredEntries.length === 0 ? (
                        <EmptyState
                            title={hasActiveFilters ? t("page.exchanges.noResult") : t("page.exchanges.noData")}
                            description={hasActiveFilters ? t("page.exchanges.resetHint") : t("page.exchanges.noDataDescription")}
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {displayedEntries.map((entry) => (
                                    <ExchangeCard key={entry.id} entry={entry} />
                                ))}
                            </div>

                            {displayedEntries.length < filteredEntries.length ? (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="hh-press hh-focusable rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-deep)] bg-[var(--hh-accent)] px-8 py-3 font-bold text-[var(--hh-text-on-accent)]"
                                    >
                                        {t("page.exchanges.loadMore")}
                                        <span className="hh-numeric ml-2 text-sm opacity-80">
                                            ({displayedEntries.length} / {filteredEntries.length})
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <div className="hh-numeric mt-8 text-center text-sm text-[var(--hh-text-tertiary)]">
                                    {t("page.exchanges.allLoaded", { count: filteredEntries.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ExchangePageContext.Provider>
    );
}

function ExchangesLoadingFallback() {
    const { t } = useI18n();

    return (
        <div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">
            {t("page.exchanges.loadingFallback")}
        </div>
    );
}

export default function ExchangesClient() {
    return (
        <MainLayout>
            <Suspense fallback={<ExchangesLoadingFallback />}>
                <ExchangesContent />
            </Suspense>
        </MainLayout>
    );
}
