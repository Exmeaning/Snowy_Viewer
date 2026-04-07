"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
    formatExchangeTime,
    getExchangeCategoryLabel,
    getExchangeTypeLabel,
    getRefreshCycleLabel,
    getRewardTypeLabel,
    loadExchangeCoreData,
    loadRewardLookupsByTypes,
    resolveExchangeCostGroups,
    resolveExchangeDisplayResources,
    resolveExchangeRewards,
    STATUS_LABELS,
} from "@/lib/exchanges";
import type { ExchangeRewardLookups } from "@/lib/exchanges";
import type { ExchangeStatus, FlattenedMaterialExchange, ResolvedExchangeCostGroup, ResolvedExchangeDisplayResource, ResolvedExchangeRelationParent, ResolvedExchangeReward } from "@/types/exchange";

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
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClasses[tone]}`}>
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-800">{title}</h2>
            {children}
        </section>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
            <span className="text-sm font-bold text-slate-600">{label}</span>
            <div className="text-right text-sm text-slate-800">{value}</div>
        </div>
    );
}

function ResourceThumb({ src, alt }: { src?: string; alt: string }) {
    return src ? (
        <img
            src={src}
            alt={alt}
            className="h-14 w-14 rounded-xl bg-slate-50 object-contain p-2"
            loading="lazy"
        />
    ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-xs font-bold text-slate-300">
            ?
        </div>
    );
}

function CostGroupBlock({ title, group }: { title?: string; group: ResolvedExchangeCostGroup }) {
    return (
        <div className="rounded-2xl bg-slate-50 p-4">
            {title ? <h3 className="mb-3 text-sm font-black text-slate-700">{title}</h3> : null}
            <div className="space-y-3">
                {group.costs.map((cost) => (
                    <div key={`${group.costGroupId}-${cost.resourceType}-${cost.resourceId}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <ResourceThumb src={cost.imageUrl} alt={cost.name} />
                        <div className="min-w-0 flex-1">
                            <div className="break-words text-sm font-bold text-slate-800">{cost.name}</div>
                            {cost.subtitle ? <div className="mt-1 text-xs text-slate-400">{cost.subtitle}</div> : null}
                        </div>
                        <div className="shrink-0 text-sm font-black text-miku">× {cost.quantity}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RewardCard({ reward, lookups }: { reward: ResolvedExchangeReward; lookups: ExchangeRewardLookups }) {
    if (reward.resourceType === "card" && typeof reward.resourceId === "number") {
        const cardInfo = lookups.cards.get(reward.resourceId);
        if (cardInfo) {
            const content = (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-miku/30 hover:shadow-md h-full flex flex-col justify-between">
                    <div>
                        <div className="mb-3 text-sm font-black text-slate-800 line-clamp-2">{reward.name}</div>
                        <SekaiCardThumbnail card={cardInfo} />
                    </div>
                    <div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge label={getRewardTypeLabel(reward.resourceType)} tone="miku" />
                            <Badge label={`数量 × ${reward.quantity}`} tone="slate" />
                        </div>
                        {reward.subtitle ? <div className="mt-2 text-xs text-slate-400">{reward.subtitle}</div> : null}
                    </div>
                </div>
            );
            return reward.linkHref ? (
                <Link href={reward.linkHref} className="block h-full">
                    {content}
                </Link>
            ) : content;
        }
    }

    const content = (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-miku/30 hover:shadow-md h-full">
            <div className="mb-3 flex items-start gap-3">
                <ResourceThumb src={reward.imageUrl} alt={reward.name} />
                <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-black text-slate-800">{reward.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                        <Badge label={getRewardTypeLabel(reward.resourceType)} tone="miku" />
                        <Badge label={`数量 × ${reward.quantity}`} tone="slate" />
                    </div>
                    {reward.subtitle ? <div className="mt-2 text-xs text-slate-400">{reward.subtitle}</div> : null}
                </div>
            </div>
            {typeof reward.resourceId === "number" ? (
                <div className="text-[11px] font-mono text-slate-400">resourceId: {reward.resourceId}</div>
            ) : null}
        </div>
    );

    return reward.linkHref ? (
        <Link href={reward.linkHref} className="block h-full">
            {content}
        </Link>
    ) : content;
}

function DisplayResourceCard({ resource }: { resource: ResolvedExchangeDisplayResource }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
                <ResourceThumb src={resource.imageUrl} alt={resource.name} />
                <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-black text-slate-800">{resource.name}</div>
                    {resource.subtitle ? <div className="mt-1 text-xs text-slate-400">{resource.subtitle}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <Badge label={getRewardTypeLabel(resource.resourceType)} tone="violet" />
                        <Badge label={`组 ${resource.groupId}`} tone="slate" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600">
                <p className="text-lg font-black">兑换项加载失败</p>
                <p className="mt-2 text-sm">{message}</p>
                <Link href="/exchanges" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-500 shadow-sm transition-colors hover:bg-red-100">
                    返回兑换所列表
                </Link>
            </div>
        </div>
    );
}

export default function ExchangeDetailClient() {
    const params = useParams();
    const exchangeId = Number(params.id);
    const { assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();

    const [coreData, setCoreData] = useState<Awaited<ReturnType<typeof loadExchangeCoreData>> | null>(null);
    const [entry, setEntry] = useState<FlattenedMaterialExchange | null>(null);
    const [rewardLookups, setRewardLookups] = useState<ExchangeRewardLookups>(EMPTY_LOOKUPS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (entry) {
            setDetailName(entry.resolvedTitle);
        }
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
                    throw new Error(`未找到 ID 为 ${exchangeId} 的兑换项。`);
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
                setError(err instanceof Error ? err.message : "兑换项详情加载失败");
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        if (Number.isFinite(exchangeId) && exchangeId > 0) {
            fetchData();
        } else {
            setIsLoading(false);
            setError("兑换项 ID 无效。");
        }

        return () => {
            cancelled = true;
        };
    }, [exchangeId]);

    const costInfo = useMemo(() => {
        if (!entry || !coreData) {
            return {
                baseCostGroups: [] as ResolvedExchangeCostGroup[],
                relationParents: [] as ResolvedExchangeRelationParent[],
            };
        }

        const resolved = resolveExchangeCostGroups(entry, coreData.materialMap, coreData.mysekaiMaterialMap, assetSource);
        return {
            baseCostGroups: resolved.baseCostGroups,
            relationParents: resolved.relationParents,
        };
    }, [assetSource, coreData, entry]);

    const resolvedRewards = useMemo(() => {
        if (!entry || !coreData) return [] as ResolvedExchangeReward[];
        return resolveExchangeRewards(entry, coreData.materialMap, coreData.mysekaiMaterialMap, rewardLookups, assetSource);
    }, [assetSource, coreData, entry, rewardLookups]);

    const displayResources = useMemo(() => {
        if (!entry || !coreData) return [] as ResolvedExchangeDisplayResource[];
        return resolveExchangeDisplayResources(entry, coreData.materialMap, coreData.mysekaiMaterialMap, assetSource);
    }, [assetSource, coreData, entry]);

    const siblingEntries = useMemo(() => {
        if (!entry || !coreData) return [] as FlattenedMaterialExchange[];
        return coreData.flattenedExchanges.filter((item) => item.summaryId === entry.summaryId && item.id !== entry.id);
    }, [coreData, entry]);

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
    const endAt = entry.summaryEndAt;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <Link href="/exchanges" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-miku">
                        <span>←</span>
                        返回兑换所列表
                    </Link>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex flex-wrap gap-2">
                            <Badge label={STATUS_LABELS[entry.status]} tone={getStatusTone(entry.status)} />
                            <Badge label={getExchangeCategoryLabel(entry.exchangeCategory)} tone="violet" />
                            <Badge label={getExchangeTypeLabel(entry.materialExchangeType)} tone="amber" />
                            <Badge label={getRefreshCycleLabel(entry.refreshCycle)} tone="slate" />
                            {typeof entry.exchangeLimit === "number" ? <Badge label={`限 ${entry.exchangeLimit} 次`} tone="rose" /> : null}
                            {entry.materialExchangeRelationParents.length > 0 ? <Badge label="含关联成本" tone="emerald" /> : null}
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{entry.resolvedTitle}</h1>
                        <p className="mt-3 text-base text-slate-500">
                            所属兑换所：<span className="font-bold text-slate-700">{entry.summaryName}</span>
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-6">
                        <SectionCard title="奖励内容">
                            {resolvedRewards.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {resolvedRewards.map((reward) => (
                                        <RewardCard key={`${reward.resourceType}-${reward.resourceId ?? "noid"}-${reward.seq}`} reward={reward} lookups={rewardLookups} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">暂无奖励内容。</p>
                            )}
                        </SectionCard>

                        <SectionCard title="兑换成本">
                            <div className="space-y-4">
                                {costInfo.baseCostGroups.length > 0 ? (
                                    costInfo.baseCostGroups.map((group, index) => (
                                        <CostGroupBlock
                                            key={`base-${group.costGroupId}`}
                                            title={costInfo.baseCostGroups.length > 1 ? `基础成本组 ${index + 1}` : "基础成本"}
                                            group={group}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-400">暂无基础成本信息。</p>
                                )}
                            </div>

                            {costInfo.relationParents.length > 0 ? (
                                <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
                                    <h3 className="text-base font-black text-slate-800">关联成本组</h3>
                                    {costInfo.relationParents.map((parent) => (
                                        <div key={parent.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                                <Badge label="关联条件" tone="emerald" />
                                                <span className="text-sm font-bold text-emerald-700">{parent.description}</span>
                                            </div>
                                            <div className="space-y-4">
                                                {parent.costGroups.map((group, index) => (
                                                    <CostGroupBlock
                                                        key={`relation-${parent.id}-${group.costGroupId}`}
                                                        title={parent.costGroups.length > 1 ? `关联成本组 ${index + 1}` : undefined}
                                                        group={group}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </SectionCard>

                        {displayResources.length > 0 ? (
                            <SectionCard title="展示资源组">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {displayResources.map((resource) => (
                                        <DisplayResourceCard key={`${resource.id}-${resource.resourceType}-${resource.resourceId}`} resource={resource} />
                                    ))}
                                </div>
                            </SectionCard>
                        ) : null}

                        {siblingEntries.length > 0 ? (
                            <SectionCard title="同兑换所其它条目">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {siblingEntries.map((sibling) => (
                                        <Link
                                            key={sibling.id}
                                            href={`/exchanges/${sibling.id}`}
                                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:border-miku/40 hover:bg-miku/5"
                                        >
                                            <div className="text-sm font-black text-slate-800">{sibling.resolvedTitle}</div>
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                <Badge label={STATUS_LABELS[sibling.status]} tone={getStatusTone(sibling.status)} />
                                                <Badge label={getRefreshCycleLabel(sibling.refreshCycle)} tone="slate" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </SectionCard>
                        ) : null}
                    </div>

                    <div className="space-y-6">
                        <SectionCard title="基础信息">
                            <InfoRow label="兑换项 ID" value={<span className="font-mono">#{entry.id}</span>} />
                            <InfoRow label="兑换所 ID" value={<span className="font-mono">#{entry.summaryId}</span>} />
                            <InfoRow label="排序序号" value={`${entry.summarySeq}-${entry.exchangeSeq}`} />
                            <InfoRow label="分类" value={getExchangeCategoryLabel(entry.exchangeCategory)} />
                            <InfoRow label="兑换类型" value={getExchangeTypeLabel(entry.materialExchangeType)} />
                            <InfoRow label="刷新周期" value={getRefreshCycleLabel(entry.refreshCycle)} />
                            <InfoRow label="状态" value={STATUS_LABELS[entry.status]} />
                            <InfoRow label="开始时间" value={formatExchangeTime(startAt)} />
                            <InfoRow label="结束时间" value={formatExchangeTime(endAt)} />
                            <InfoRow label="兑换次数限制" value={typeof entry.exchangeLimit === "number" ? `${entry.exchangeLimit} 次` : "不限"} />
                            <InfoRow label="奖励 Box ID" value={<span className="font-mono">#{entry.resourceBoxId}</span>} />
                            <InfoRow label="显示奖励数量" value={entry.isDisplayQuantity ? "是" : "否"} />
                            <InfoRow label="奖励类型数" value={`${entry.rewardTypes.length} 类`} />
                            <InfoRow label="成本条目数" value={`${entry.costs.length} 条`} />
                        </SectionCard>

                        <SectionCard title="兑换所摘要">
                            <InfoRow label="兑换所名称" value={entry.summaryName} />
                            <InfoRow label="兑换所起始" value={formatExchangeTime(entry.summaryStartAt)} />
                            <InfoRow label="兑换所结束" value={formatExchangeTime(entry.summaryEndAt)} />
                            <InfoRow label="展示资源组 ID" value={entry.summaryDisplayResourceGroupId ? `#${entry.summaryDisplayResourceGroupId}` : "-"} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
