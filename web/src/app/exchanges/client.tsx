"use client";

import Link from "next/link";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterButton, FilterSection } from "@/components/common/BaseFilters";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { getCharacterIconUrl, getMaterialThumbnailUrl, getMysekaiMaterialThumbnailUrl } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import {
    areExchangeFiltersEqual,
    DEFAULT_EXCHANGE_FILTERS,
    EXCHANGE_CATEGORY_LABELS,
    filterAndSortExchanges,
    formatExchangeTime,
    getExchangeCategoryLabel,
    getExchangeTypeLabel,
    getRefreshCycleLabel,
    getRewardTypeLabel,
    getRewardTypeLabel as getRewardLabel,
    getExchangeLastModified,
    loadExchangeCoreData,
    parseExchangeFilterParams,
    resolveExchangeCostGroups,
    STATUS_LABELS,
    summarizeExchangeRewards,
    type ExchangeCoreData,
    type ExchangeListFilters,
    type ExchangeSortBy,
    type ExchangeSortOrder,
} from "@/lib/exchanges";
import type { ExchangeStatus, FlattenedMaterialExchange } from "@/types/exchange";
import { CHARACTER_NAMES, type ICardInfo } from "@/types/types";
import type { IMysekaiMaterial } from "@/types/mysekai";

function PageHeader() {
    return (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                <span className="text-miku text-xs font-bold tracking-widest uppercase">Exchange Database</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                兑换所 <span className="text-miku">图鉴</span>
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                浏览 Project SEKAI 各类兑换所条目，查看兑换成本、奖励内容与开放状态。
            </p>
        </div>
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
        miku: "bg-miku/10 text-miku",
        violet: "bg-violet-500/10 text-violet-600",
        amber: "bg-amber-500/10 text-amber-700",
        emerald: "bg-emerald-500/10 text-emerald-700",
        rose: "bg-rose-500/10 text-rose-600",
        slate: "bg-slate-100 text-slate-500",
    };

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ${toneClasses[tone]}`}>
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
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse"
                >
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        <div className="h-5 w-16 rounded-full bg-slate-100" />
                        <div className="h-5 w-20 rounded-full bg-slate-100" />
                        <div className="h-5 w-14 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-slate-200 mb-1" />
                    <div className="h-4 w-1/2 rounded bg-slate-100 mb-3" />
                    <div className="flex gap-1.5 mb-3">
                        <div className="h-5 w-16 rounded-full bg-slate-100" />
                        <div className="h-5 w-20 rounded-full bg-slate-100" />
                    </div>
                    <div className="flex justify-between">
                        <div className="h-3 w-24 rounded bg-slate-100" />
                        <div className="h-3 w-12 rounded bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-slate-200 bg-white">
            <svg className="mb-4 h-14 w-14 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V7a2 2 0 00-2-2h-3V3.5A1.5 1.5 0 0013.5 2h-3A1.5 1.5 0 009 3.5V5H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-4M9 9h6m-6 4h4" />
            </svg>
            <p className="text-base font-bold text-slate-500">{title}</p>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
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
            <p className="text-[10px] font-bold text-slate-400 mb-1">{label}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {children}
            </div>
        </div>
    );
}
function RewardThumbnail({ detail }: { detail: { resourceType: string; resourceId?: number; resourceQuantity?: number } }) {
    const { assetSource } = useTheme();
    const { cardsMap } = useExchangePageContext();

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
                className="shrink-0 h-9 w-9 rounded-md bg-slate-50 object-contain p-0.5"
                loading="lazy"
            />
        );
    }

    if (detail.resourceType === "mysekai_material") {
        return (
            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-violet-50 text-[8px] font-bold text-violet-400">
                MS
            </div>
        );
    }

    if (detail.resourceType === "character_rank_exp" && typeof detail.resourceId === "number") {
        return (
            <img
                src={getCharacterIconUrl(detail.resourceId)}
                alt={`character-rank-exp-${detail.resourceId}`}
                className="shrink-0 h-9 w-9 rounded-full border border-emerald-100 bg-white object-cover"
                loading="lazy"
                title={CHARACTER_NAMES[detail.resourceId] || `Character #${detail.resourceId}`}
            />
        );
    }

    return (
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-slate-50 text-[8px] font-bold text-slate-300">
            {getRewardTypeLabel(detail.resourceType).slice(0, 2)}
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
                    className="h-7 w-7 rounded bg-slate-50 object-contain p-0.5"
                    loading="lazy"
                />
                <span className="absolute -bottom-0.5 -right-0.5 rounded bg-slate-700/80 px-0.5 text-[7px] font-bold text-white leading-tight">
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
                        className="h-7 w-7 rounded bg-violet-50 object-contain p-0.5"
                        loading="lazy"
                    />
                ) : (
                    <div className="h-7 w-7 rounded bg-violet-50 flex items-center justify-center text-[7px] font-bold text-violet-400">MS</div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 rounded bg-slate-700/80 px-0.5 text-[7px] font-bold text-white leading-tight">
                    {cost.quantity}
                </span>
            </div>
        );
    }

    return null;
}

function ExchangeCard({ entry }: { entry: FlattenedMaterialExchange }) {
    const rewardSummary = useMemo(() => summarizeExchangeRewards(entry.rewardDetails), [entry.rewardDetails]);
    const visibleRewards = entry.rewardDetails.slice(0, 8);
    const hiddenRewardCount = Math.max(0, entry.rewardDetails.length - 8);
    const visibleCosts = entry.costs.slice(0, 8);
    const hiddenCostCount = Math.max(0, entry.costs.length - 8);

    return (
        <Link
            href={`/exchanges/${entry.id}`}
            data-shortcut-item="true"
            className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-miku/40 hover:shadow-lg"
        >
            <div className="mb-2 flex flex-wrap gap-1.5">
                <Badge label={STATUS_LABELS[entry.status]} tone={getStatusTone(entry.status)} />
                <Badge label={getExchangeCategoryLabel(entry.exchangeCategory)} tone="violet" />
                <Badge label={getExchangeTypeLabel(entry.materialExchangeType)} tone="amber" />
                {typeof entry.exchangeLimit === "number" ? <Badge label={`限 ${entry.exchangeLimit} 次`} tone="rose" /> : null}
            </div>

            <h2 className="text-sm font-black leading-5 text-slate-800 transition-colors group-hover:text-miku mb-3 line-clamp-2">
                {entry.resolvedTitle}
            </h2>

            <div className="flex gap-4">
                {visibleRewards.length > 0 && (
                    <div className="flex-1 min-w-0">
                        <ScrollRow label="奖励">
                            {visibleRewards.map((detail, i) => (
                                <RewardThumbnail key={`r-${entry.id}-${i}`} detail={detail} />
                            ))}
                            {hiddenRewardCount > 0 && (
                                <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-400">
                                    +{hiddenRewardCount}
                                </div>
                            )}
                        </ScrollRow>
                    </div>
                )}

                {visibleCosts.length > 0 && (
                    <div className="flex-1 min-w-0">
                        <ScrollRow label="消耗">
                            {visibleCosts.map((cost, i) => (
                                <CostThumbnail key={`c-${entry.id}-${i}`} cost={cost} />
                            ))}
                            {hiddenCostCount > 0 && (
                                <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-[8px] font-bold text-slate-400">
                                    +{hiddenCostCount}
                                </div>
                            )}
                        </ScrollRow>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{formatExchangeTime(getExchangeLastModified(entry))}</span>
                <span className="font-bold text-miku transition-transform group-hover:translate-x-0.5">
                    详情 →
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
                setError(err instanceof Error ? err.message : "兑换所数据加载失败");
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
    }, []);

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
            .sort((a, b) => getExchangeCategoryLabel(a).localeCompare(getExchangeCategoryLabel(b), "zh-Hans-CN"));
    }, [coreData]);

    const rewardTypeOptions = useMemo(() => {
        if (!coreData) return [];
        return Array.from(new Set(coreData.flattenedExchanges.flatMap((entry) => entry.rewardTypes)))
            .sort((a, b) => getRewardTypeLabel(a).localeCompare(getRewardTypeLabel(b), "zh-Hans-CN"));
    }, [coreData]);

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
            title="筛选兑换所"
            filteredCount={filteredEntries.length}
            totalCount={coreData?.flattenedExchanges.length || 0}
            countUnit="项"
            searchQuery={filters.searchQuery}
            onSearchChange={(query) => updateFilters((prev) => ({ ...prev, searchQuery: query }))}
            searchPlaceholder="搜索名称、ID、分类或奖励类型..."
            sortOptions={[
                { id: "status_priority", label: "状态优先" },
                { id: "seq", label: "默认" },
                { id: "id", label: "ID" },
                { id: "startAt", label: "开始" },
                { id: "endAt", label: "结束" },
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
            <FilterSection label="兑换所">
                <select
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                    value={filters.selectedSummaryIds.length === 1 ? String(filters.selectedSummaryIds[0]) : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [Number(e.target.value)] : [];
                        updateFilters((prev) => ({ ...prev, selectedSummaryIds: val }));
                    }}
                >
                    <option value="">全部</option>
                    {summaryOptions.map((summary) => (
                        <option key={summary.id} value={summary.id}>
                            {summary.label} ({summary.count})
                        </option>
                    ))}
                </select>
            </FilterSection>

            <FilterSection label="分类">
                <select
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                    value={filters.selectedCategories.length === 1 ? filters.selectedCategories[0] : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [e.target.value] : [];
                        updateFilters((prev) => ({ ...prev, selectedCategories: val }));
                    }}
                >
                    <option value="">全部</option>
                    {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                            {EXCHANGE_CATEGORY_LABELS[category] || category}
                        </option>
                    ))}
                </select>
            </FilterSection>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FilterSection label="兑换类型">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedExchangeTypes.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedExchangeTypes: [] }))}
                        >
                            全部
                        </FilterButton>
                        {["normal", "beginner"].map((type) => (
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
                                {getExchangeTypeLabel(type)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="状态">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedStatuses.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedStatuses: [] }))}
                        >
                            全部
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
                                {STATUS_LABELS[status]}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FilterSection label="刷新周期">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedRefreshCycles.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedRefreshCycles: [] }))}
                        >
                            全部
                        </FilterButton>
                        {["none", "monthly"].map((refreshCycle) => (
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
                                {getRefreshCycleLabel(refreshCycle)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="成本类型">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={filters.selectedCostTypes.length === 0}
                            onClick={() => updateFilters((prev) => ({ ...prev, selectedCostTypes: [] }))}
                        >
                            全部
                        </FilterButton>
                        {[
                            { value: "material", label: "普通持有物" },
                            { value: "mysekai_material", label: "MySekai 持有物" },
                        ].map((type) => (
                            <FilterButton
                                key={type.value}
                                selected={filters.selectedCostTypes.includes(type.value as ExchangeListFilters["selectedCostTypes"][number])}
                                onClick={() => updateFilters((prev) => ({
                                    ...prev,
                                    selectedCostTypes: prev.selectedCostTypes.includes(type.value as ExchangeListFilters["selectedCostTypes"][number])
                                        ? prev.selectedCostTypes.filter((item) => item !== type.value)
                                        : [...prev.selectedCostTypes, type.value as ExchangeListFilters["selectedCostTypes"][number]],
                                }))}
                            >
                                {type.label}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </div>

            <FilterSection label="奖励类型">
                <select
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                    value={filters.selectedRewardTypes.length === 1 ? filters.selectedRewardTypes[0] : ""}
                    onChange={(e) => {
                        const val = e.target.value ? [e.target.value] : [];
                        updateFilters((prev) => ({ ...prev, selectedRewardTypes: val }));
                    }}
                >
                    <option value="">全部</option>
                    {rewardTypeOptions.map((rewardType) => (
                        <option key={rewardType} value={rewardType}>
                            {getRewardLabel(rewardType)}
                        </option>
                    ))}
                </select>
            </FilterSection>
        </BaseFilters>
    ), [coreData?.flattenedExchanges.length, filteredEntries.length, filters, hasActiveFilters, resetFilters, rewardTypeOptions, summaryOptions, categoryOptions, updateFilters]);

    useQuickFilter("兑换所筛选", quickFilterContent, [quickFilterContent]);

    if (!coreData) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <PageHeader />
                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                        <p className="font-bold">加载失败</p>
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
                <PageHeader />

                {error ? (
                    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
                        <p className="font-bold">加载提示</p>
                        <p className="mt-1">{error}</p>
                    </div>
                ) : null}

                {!isLoading ? (
                    <div className="mb-4 text-xs text-slate-500">
                        当前共 <span className="font-bold text-miku">{filteredEntries.length}</span>
                        {hasActiveFilters ? (
                            <>
                                <span className="mx-1">/</span>
                                <span className="font-bold text-slate-700">{coreData.flattenedExchanges.length}</span>
                            </>
                        ) : null}
                        项兑换条目
                    </div>
                ) : null}

                <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="w-full lg:w-80 lg:shrink-0">
                        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                            {quickFilterContent}
                        </div>
                    </div>

                    <div className="min-w-0 flex-1">
                        {isLoading ? (
                            <SkeletonList />
                        ) : filteredEntries.length === 0 ? (
                            <EmptyState
                                title={hasActiveFilters ? "没有找到符合条件的兑换条目" : "暂无兑换所数据"}
                                description={hasActiveFilters ? "可以尝试重置筛选后重新查看" : "当前服务器暂无可用的兑换所 masterdata 条目"}
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
                                            className="rounded-xl bg-gradient-to-r from-miku to-miku-dark px-8 py-3 font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                                        >
                                            加载更多
                                            <span className="ml-2 text-sm opacity-80">
                                                ({displayedEntries.length} / {filteredEntries.length})
                                            </span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-8 text-center text-sm text-slate-400">
                                        已显示全部 {filteredEntries.length} 项兑换条目
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </ExchangePageContext.Provider>
    );
}

export default function ExchangesClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载兑换所数据...</div>}>
                <ExchangesContent />
            </Suspense>
        </MainLayout>
    );
}
