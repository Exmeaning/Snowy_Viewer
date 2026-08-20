"use client";

import Link from "@/components/LocalizedLink";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
    formatExchangeTime,
    getExchangeCategoryLabel,
    getExchangeStatusLabel,
    getExchangeTypeLabel,
    getRefreshCycleLabel,
    getRewardTypeLabel,
    loadExchangeCoreData,
    loadRewardLookupsByTypes,
    resolveExchangeCostGroups,
    resolveExchangeDisplayResources,
    resolveExchangeRewards,
} from "@/lib/exchanges";
import type { ExchangeRewardLookups } from "@/lib/exchanges";
import type {
    ExchangeStatus,
    FlattenedMaterialExchange,
    ResolvedExchangeCostGroup,
    ResolvedExchangeDisplayResource,
    ResolvedExchangeRelationParent,
    ResolvedExchangeReward,
} from "@/types/exchange";

// ─── constants ────────────────────────────────────────────────────────────────

const EMPTY_LOOKUPS: ExchangeRewardLookups = {
    cards: new Map(),
    stamps: new Map(),
    costumes: new Map(),
    blueprints: new Map(),
    fixtures: new Map(),
    practiceTickets: new Map(),
    skillPracticeTickets: new Map(),
    boostItems: new Map(),
    gachaTickets: new Map(),
    avatarCoordinates: new Map(),
    mysekaiItems: new Map(),
    mysekaiTools: new Map(),
};

/** Default number of sibling entries shown before collapsing. */
const SIBLINGS_INITIAL_SHOW = 6;

// ─── small ui helpers ─────────────────────────────────────────────────────────

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
        slate: "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]",
    };

    return (
        <span className={`inline-flex items-center rounded-[var(--hh-radius-sm)] px-2.5 py-1 text-[11px] font-bold ${toneClasses[tone]}`}>
            {label}
        </span>
    );
}

function getStatusTone(status: ExchangeStatus): "emerald" | "amber" | "rose" | "slate" {
    switch (status) {
        case "active":   return "emerald";
        case "upcoming": return "amber";
        case "ended":    return "rose";
        case "permanent":
        default:         return "slate";
    }
}

/** Info row styled to match the detail page layout. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-[var(--hh-text-secondary)] font-medium">{label}</span>
            <span className="font-semibold text-[var(--hh-text-primary)] text-right max-w-[60%]">{value}</span>
        </div>
    );
}

/** Section card wrapper used by detail blocks. */
function SectionCard({
    title,
    icon,
    children,
    rowStyle = false,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    rowStyle?: boolean;
}) {
    return (
        <section className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                    {icon}
                    {title}
                </h2>
            </div>
            {rowStyle ? (
                <div className="divide-y divide-[var(--hh-border)]">{children}</div>
            ) : (
                <div className="p-5">{children}</div>
            )}
        </section>
    );
}

function ResourceThumb({ src, alt }: { src?: string; alt: string }) {
    return src ? (
        <img
            src={src}
            alt={alt}
            className="h-14 w-14 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] object-contain p-2"
            loading="lazy"
        />
    ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] text-xs font-bold text-[var(--hh-text-tertiary)]">
            ?
        </div>
    );
}

// ─── block components ─────────────────────────────────────────────────────────

function CostGroupBlock({ title, group }: { title?: string; group: ResolvedExchangeCostGroup }) {
    return (
        <div className="hh-well p-4">
            {title ? <h3 className="hh-title mb-3 text-sm text-[var(--hh-text-primary)]">{title}</h3> : null}
            <div className="space-y-3">
                {group.costs.map((cost) => (
                    <div
                        key={`${group.costGroupId}-${cost.resourceType}-${cost.resourceId}`}
                        className="flex items-center gap-3 rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] p-3"
                    >
                        <ResourceThumb src={cost.imageUrl} alt={cost.name} />
                        <div className="min-w-0 flex-1">
                            <div className="hh-title break-words text-sm text-[var(--hh-text-primary)]">{cost.name}</div>
                            {cost.subtitle ? <div className="mt-1 text-xs text-[var(--hh-text-tertiary)]">{cost.subtitle}</div> : null}
                        </div>
                        <div className="hh-display hh-numeric shrink-0 text-sm text-[var(--hh-accent-deep)]">× {cost.quantity}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RewardCard({ reward, lookups }: { reward: ResolvedExchangeReward; lookups: ExchangeRewardLookups }) {
    const { t } = useI18n();

    if (reward.resourceType === "card" && typeof reward.resourceId === "number") {
        const cardInfo = lookups.cards.get(reward.resourceId);
        if (cardInfo) {
            const content = (
                <div className="hh-press hh-tile rounded-[var(--hh-radius-lg)] p-4 hover:border-[var(--hh-accent-line)] h-full flex flex-col justify-between">
                    <div>
                        <div className="hh-title mb-3 text-sm text-[var(--hh-text-primary)] line-clamp-2">{reward.name}</div>
                        <div className="flex justify-center">
                            <SekaiCardThumbnail card={cardInfo} width={80} />
                        </div>
                    </div>
                    <div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge label={getRewardTypeLabel(reward.resourceType, t)} tone="miku" />
                            <Badge label={t("page.exchanges.quantity", { count: reward.quantity })} tone="slate" />
                        </div>
                        {reward.subtitle ? <div className="mt-2 text-xs text-[var(--hh-text-tertiary)]">{reward.subtitle}</div> : null}
                    </div>
                </div>
            );
            return reward.linkHref ? (
                <Link href={reward.linkHref} className="block h-full">{content}</Link>
            ) : content;
        }
    }

    const content = (
        <div className="hh-press hh-tile rounded-[var(--hh-radius-lg)] p-4 hover:border-[var(--hh-accent-line)] h-full">
            <div className="mb-3 flex items-start gap-3">
                <ResourceThumb src={reward.imageUrl} alt={reward.name} />
                <div className="min-w-0 flex-1">
                    <div className="hh-title break-words text-sm text-[var(--hh-text-primary)]">{reward.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                        <Badge label={getRewardTypeLabel(reward.resourceType, t)} tone="miku" />
                        <Badge label={t("page.exchanges.quantity", { count: reward.quantity })} tone="slate" />
                    </div>
                    {reward.subtitle ? <div className="mt-2 text-xs text-[var(--hh-text-tertiary)]">{reward.subtitle}</div> : null}
                </div>
            </div>
            {typeof reward.resourceId === "number" ? (
                <div className="hh-numeric text-[11px] font-mono text-[var(--hh-text-tertiary)]">resourceId: {reward.resourceId}</div>
            ) : null}
        </div>
    );

    return reward.linkHref ? (
        <Link href={reward.linkHref} className="block h-full">{content}</Link>
    ) : content;
}

function DisplayResourceCard({ resource }: { resource: ResolvedExchangeDisplayResource }) {
    const { t } = useI18n();

    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] p-4">
            <div className="mb-3 flex items-start gap-3">
                <ResourceThumb src={resource.imageUrl} alt={resource.name} />
                <div className="min-w-0 flex-1">
                    <div className="hh-title break-words text-sm text-[var(--hh-text-primary)]">{resource.name}</div>
                    {resource.subtitle ? <div className="mt-1 text-xs text-[var(--hh-text-tertiary)]">{resource.subtitle}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Badge label={getRewardTypeLabel(resource.resourceType, t)} tone="violet" />
                        <Badge label={t("page.exchanges.groupNumber", { group: resource.groupId })} tone="slate" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Collapsible sibling entries card. */
function SiblingsCard({ siblings }: { siblings: FlattenedMaterialExchange[] }) {
    const { t } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = siblings.length > SIBLINGS_INITIAL_SHOW;
    const shown = isExpanded ? siblings : siblings.slice(0, SIBLINGS_INITIAL_SHOW);

    return (
        <SectionCard
            title={t("page.exchanges.siblingsTitle", { count: siblings.length })}
            icon={
                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {shown.map((sibling) => (
                    <Link
                        key={sibling.id}
                        href={`/exchanges/${sibling.id}`}
                        className="hh-press rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-sunken)] px-4 py-3 hover:border-[var(--hh-accent-line)] hover:bg-[var(--hh-accent-wash)]"
                    >
                        <div className="hh-title text-sm text-[var(--hh-text-primary)]">{sibling.resolvedTitle}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                            <Badge label={getExchangeStatusLabel(sibling.status, t)} tone={getStatusTone(sibling.status)} />
                            <Badge label={getRefreshCycleLabel(sibling.refreshCycle, t)} tone="slate" />
                        </div>
                    </Link>
                ))}
            </div>

            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="hh-btn hh-press mt-3 w-full py-2 px-3 rounded-[var(--hh-radius-md)] text-sm font-medium"
                >
                    <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? t("page.exchanges.collapse") : t("page.exchanges.expandOthers", { count: siblings.length - SIBLINGS_INITIAL_SHOW })}
                </button>
            )}
        </SectionCard>
    );
}

function ErrorState({ message }: { message: string }) {
    const { t } = useI18n();

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="rounded-[var(--hh-radius-lg)] border border-red-300 bg-red-500/10 p-6 text-red-600">
                <p className="hh-display text-lg">{t("page.exchanges.relationLoadFailed")}</p>
                <p className="mt-2 text-sm">{message}</p>
                <Link
                    href="/exchanges"
                    className="hh-press mt-4 inline-flex rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-2)] border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-500/10"
                >
                        {t("page.exchanges.backToList")}
                </Link>
            </div>
        </div>
    );
}

// ─── page component ───────────────────────────────────────────────────────────

export default function ExchangeDetailClient() {
    const params = useParams();
    const exchangeId = Number(params.id);
    const { assetSource } = useTheme();
    const { t, formatDate } = useI18n();
    const { setDetailName } = useBreadcrumb();

    const [coreData, setCoreData] = useState<Awaited<ReturnType<typeof loadExchangeCoreData>> | null>(null);
    const [entry, setEntry] = useState<FlattenedMaterialExchange | null>(null);
    const [rewardLookups, setRewardLookups] = useState<ExchangeRewardLookups>(EMPTY_LOOKUPS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (entry) setDetailName(entry.resolvedTitle);
    }, [entry, setDetailName]);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                setIsLoading(true);
                const loaded = await loadExchangeCoreData();
                if (cancelled) return;

                const foundEntry = loaded.flattenedExchanges.find((item) => item.id === exchangeId);
                if (!foundEntry) {
                    throw new Error(t("page.exchanges.itemNotFound", { id: exchangeId }));
                }

                setCoreData(loaded);
                setEntry(foundEntry);

                const lookups = await loadRewardLookupsByTypes(foundEntry.rewardTypes);
                if (cancelled) return;

                setRewardLookups(lookups);
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Error loading exchange detail:", err);
                setError(err instanceof Error ? err.message : t("page.exchanges.detailLoadFailed"));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        if (Number.isFinite(exchangeId) && exchangeId > 0) {
            fetchData();
        } else {
            setIsLoading(false);
            setError(t("page.exchanges.invalidItemId"));
        }

        return () => { cancelled = true; };
    }, [exchangeId, t]);

    const costInfo = useMemo(() => {
        if (!entry || !coreData) {
            return {
                baseCostGroups: [] as ResolvedExchangeCostGroup[],
                relationParents: [] as ResolvedExchangeRelationParent[],
            };
        }
        const resolved = resolveExchangeCostGroups(entry, coreData.materialMap, coreData.mysekaiMaterialMap, assetSource, t);
        return { baseCostGroups: resolved.baseCostGroups, relationParents: resolved.relationParents };
    }, [assetSource, coreData, entry, t]);

    const resolvedRewards = useMemo(() => {
        if (!entry || !coreData) return [] as ResolvedExchangeReward[];
        return resolveExchangeRewards(entry, coreData.materialMap, coreData.mysekaiMaterialMap, rewardLookups, assetSource, t);
    }, [assetSource, coreData, entry, rewardLookups, t]);

    const displayResources = useMemo(() => {
        if (!entry || !coreData) return [] as ResolvedExchangeDisplayResource[];
        return resolveExchangeDisplayResources(entry, coreData.materialMap, coreData.mysekaiMaterialMap, assetSource, t);
    }, [assetSource, coreData, entry, t]);

    const siblingEntries = useMemo(() => {
        if (!entry || !coreData) return [] as FlattenedMaterialExchange[];
        return coreData.flattenedExchanges.filter((item) => item.summaryId === entry.summaryId && item.id !== entry.id);
    }, [coreData, entry]);

    // ── loading / error states ────────────────────────────────────────────────

    if (error) {
        return (
            <MainLayout>
                <ErrorState message={error} />
            </MainLayout>
        );
    }

    if (isLoading || !entry || !coreData) {
        return (
            <MainLayout>
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="loading-spinner" />
                </div>
            </MainLayout>
        );
    }

    const startAt = entry.exchangeStartAt ?? entry.summaryStartAt;
    const endAt   = entry.summaryEndAt;

    // ── render ────────────────────────────────────────────────────────────────

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">

                {/* ── Header ── */}
                <div className="mb-8">
                    <Link
                        href="/exchanges"
                        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--hh-text-secondary)] transition-colors hover:text-[var(--hh-accent-deep)]"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    {t("page.exchanges.backToList")}
                    </Link>

                    {/* ID chip and badges */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                        <span className="hh-numeric inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-sm)] text-xs font-mono text-[var(--hh-text-secondary)] w-fit">
                            ID: #{entry.id}
                        </span>
                        <Badge label={getExchangeStatusLabel(entry.status, t)} tone={getStatusTone(entry.status)} />
                        <Badge label={getExchangeCategoryLabel(entry.exchangeCategory, t)} tone="violet" />
                        <Badge label={getExchangeTypeLabel(entry.materialExchangeType, t)} tone="amber" />
                        <Badge label={getRefreshCycleLabel(entry.refreshCycle, t)} tone="slate" />
                        {typeof entry.exchangeLimit === "number" && (
                            <Badge label={t("page.exchanges.limitTimes", { count: entry.exchangeLimit })} tone="rose" />
                        )}
                        {entry.materialExchangeRelationParents.length > 0 && (
                            <Badge label={t("page.exchanges.relatedCostIncluded")} tone="emerald" />
                        )}
                    </div>

                    <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)]">{entry.resolvedTitle}</h1>
                    <p className="mt-2 text-sm text-[var(--hh-text-secondary)]">
                        {t("page.exchanges.belongsToSummary", { summary: entry.summaryName })}
                    </p>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left column */}
                    <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">

                        {/* Rewards */}
                        <SectionCard
                            title={t("page.exchanges.rewardContent", {
                                count: resolvedRewards.length > 0
                                    ? t("page.exchanges.countSuffix", { count: resolvedRewards.length })
                                    : "",
                            })}
                            icon={
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                </svg>
                            }
                        >
                            {resolvedRewards.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {resolvedRewards.map((reward) => (
                                        <RewardCard
                                            key={`${reward.resourceType}-${reward.resourceId ?? "noid"}-${reward.seq}`}
                                            reward={reward}
                                            lookups={rewardLookups}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[var(--hh-text-tertiary)]">{t("page.exchanges.noRewards")}</p>
                            )}
                        </SectionCard>

                        {/* Display resources */}
                        {displayResources.length > 0 && (
                            <SectionCard
                                title={t("page.exchanges.displayResourceGroup")}
                                icon={
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                }
                            >
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {displayResources.map((resource) => (
                                        <DisplayResourceCard
                                            key={`${resource.id}-${resource.resourceType}-${resource.resourceId}`}
                                            resource={resource}
                                        />
                                    ))}
                                </div>
                            </SectionCard>
                        )}

                        {/* Costs */}
                        <SectionCard
                            title={t("page.exchanges.exchangeCosts")}
                            icon={
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        >
                            <div className="space-y-4">
                                {costInfo.baseCostGroups.length > 0 ? (
                                    costInfo.baseCostGroups.map((group, index) => (
                                        <CostGroupBlock
                                            key={`base-${group.costGroupId}`}
                                            title={costInfo.baseCostGroups.length > 1
                                                ? t("page.exchanges.baseCostGroup", { index: index + 1 })
                                                : t("page.exchanges.baseCost")}
                                            group={group}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-[var(--hh-text-tertiary)]">{t("page.exchanges.noBaseCost")}</p>
                                )}
                            </div>

                            {costInfo.relationParents.length > 0 && (
                                <div className="mt-6 space-y-4 border-t border-[var(--hh-border)] pt-6">
                                    <h3 className="hh-title text-base text-[var(--hh-text-primary)]">{t("page.exchanges.relationCostGroups")}</h3>
                                    {costInfo.relationParents.map((parent) => (
                                        <div key={parent.id} className="rounded-[var(--hh-radius-lg)] border border-emerald-400/40 bg-emerald-500/10 p-4">
                                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                                <Badge label={t("page.exchanges.relationCondition")} tone="emerald" />
                                                <span className="text-sm font-bold text-emerald-700">{parent.description}</span>
                                            </div>
                                            <div className="space-y-4">
                                                {parent.costGroups.map((group, index) => (
                                                    <CostGroupBlock
                                                        key={`relation-${parent.id}-${group.costGroupId}`}
                                                        title={parent.costGroups.length > 1 ? t("page.exchanges.relationCostGroup", { index: index + 1 }) : undefined}
                                                        group={group}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Right column */}
                    <div className="space-y-6">

                        {/* Basic information */}
                        <SectionCard
                            title={t("page.exchanges.basicInfo")}
                            rowStyle
                            icon={
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        >
                            <InfoRow label={t("page.exchanges.fields.exchangeItemId")} value={<span className="hh-numeric font-mono">#{entry.id}</span>} />
                            <InfoRow label={t("page.exchanges.fields.exchangeShopId")} value={<span className="hh-numeric font-mono">#{entry.summaryId}</span>} />
                            <InfoRow label={t("common.field.seq")} value={<span className="hh-numeric">{`${entry.summarySeq}-${entry.exchangeSeq}`}</span>} />
                            <InfoRow label={t("page.exchanges.fields.category")} value={getExchangeCategoryLabel(entry.exchangeCategory, t)} />
                            <InfoRow label={t("page.exchanges.fields.exchangeType")} value={getExchangeTypeLabel(entry.materialExchangeType, t)} />
                            <InfoRow label={t("page.exchanges.fields.refreshCycle")} value={getRefreshCycleLabel(entry.refreshCycle, t)} />
                            <InfoRow label={t("page.exchanges.fields.status")} value={getExchangeStatusLabel(entry.status, t)} />
                            <InfoRow label={t("page.exchanges.fields.startTime")} value={<span className="hh-numeric">{formatExchangeTime(startAt, formatDate)}</span>} />
                            <InfoRow label={t("page.exchanges.fields.endTime")} value={<span className="hh-numeric">{formatExchangeTime(endAt, formatDate)}</span>} />
                            <InfoRow label={t("page.exchanges.fields.exchangeLimit")} value={typeof entry.exchangeLimit === "number" ? t("page.exchanges.times", { count: entry.exchangeLimit }) : t("page.exchanges.unlimited")} />
                            <InfoRow label={t("page.exchanges.fields.rewardBoxId")} value={<span className="hh-numeric font-mono">#{entry.resourceBoxId}</span>} />
                            <InfoRow label={t("page.exchanges.fields.displayRewardQuantity")} value={entry.isDisplayQuantity ? t("common.field.yes") : t("common.field.no")} />
                            <InfoRow label={t("page.exchanges.fields.rewardTypeCount")} value={t("page.exchanges.rewardTypeCount", { count: entry.rewardTypes.length })} />
                            <InfoRow label={t("page.exchanges.fields.costItemCount")} value={t("page.exchanges.costItemCount", { count: entry.costs.length })} />
                        </SectionCard>

                        {/* Exchange summary */}
                        <SectionCard
                            title={t("page.exchanges.summaryInfo")}
                            rowStyle
                            icon={
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                        >
                            <InfoRow label={t("page.exchanges.fields.exchangeShopName")} value={entry.summaryName} />
                            <InfoRow label={t("page.exchanges.fields.exchangeShopStart")} value={<span className="hh-numeric">{formatExchangeTime(entry.summaryStartAt, formatDate)}</span>} />
                            <InfoRow label={t("page.exchanges.fields.exchangeShopEnd")} value={<span className="hh-numeric">{formatExchangeTime(entry.summaryEndAt, formatDate)}</span>} />
                            <InfoRow label={t("page.exchanges.fields.displayResourceGroupId")} value={<span className="hh-numeric">{entry.summaryDisplayResourceGroupId ? `#${entry.summaryDisplayResourceGroupId}` : "—"}</span>} />
                        </SectionCard>

                        {/* Sibling entries */}
                        {siblingEntries.length > 0 && (
                            <SiblingsCard siblings={siblingEntries} />
                        )}

                        <DetailPageAdCard />
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
