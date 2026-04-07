"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import Modal from "@/components/common/Modal";
import BaseFilters, {
    FilterButton,
    FilterSection,
    FilterToggle,
} from "@/components/common/BaseFilters";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { AssetSourceType } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getMaterialThumbnailUrl, getMysekaiMaterialThumbnailUrl } from "@/lib/assets";
import { useImageUrlActions } from "@/hooks/useImageUrlActions";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import {
    findMaterialExchangeUsages,
    loadExchangeCoreData,
    STATUS_LABELS,
    type MaterialExchangeUsages,
} from "@/lib/exchanges";
import type { ExchangeStatus, FlattenedMaterialExchange } from "@/types/exchange";
import type { IMaterialInfo, IMysekaiSiteInfo } from "@/types/material";
import type { IMysekaiMaterial } from "@/types/mysekai";

type TabType = "materials" | "mysekaiMaterials";
type SortOrder = "asc" | "desc";
type MaterialSortBy = "seq" | "id" | "name";
type MysekaiSortBy = MaterialSortBy | "rarity";
type MaterialDetailSelection =
    | { kind: "material"; item: IMaterialInfo }
    | { kind: "mysekai"; item: IMysekaiMaterial }
    | null;

interface MaterialFiltersState {
    searchQuery: string;
    selectedTypes: string[];
    usableOnly: boolean;
    sortBy: MaterialSortBy;
    sortOrder: SortOrder;
}

interface MysekaiFiltersState {
    searchQuery: string;
    selectedTypes: string[];
    selectedRarities: string[];
    selectedSites: number[];
    sortBy: MysekaiSortBy;
    sortOrder: SortOrder;
}

const DEFAULT_TAB: TabType = "materials";

const DEFAULT_MATERIAL_FILTERS: MaterialFiltersState = {
    searchQuery: "",
    selectedTypes: [],
    usableOnly: false,
    sortBy: "seq",
    sortOrder: "asc",
};

const DEFAULT_MYSEKAI_FILTERS: MysekaiFiltersState = {
    searchQuery: "",
    selectedTypes: [],
    selectedRarities: [],
    selectedSites: [],
    sortBy: "seq",
    sortOrder: "asc",
};

const MATERIAL_SORT_OPTIONS = [
    { id: "seq", label: "默认" },
    { id: "id", label: "ID" },
    { id: "name", label: "名称" },
] as const;

const MYSEKAI_SORT_OPTIONS = [
    { id: "seq", label: "默认" },
    { id: "id", label: "ID" },
    { id: "name", label: "名称" },
    { id: "rarity", label: "稀有度" },
] as const;

const MATERIAL_TYPE_LABELS: Record<string, string> = {
    common: "通用",
    costume: "服装",
    music: "音乐",
    special_training: "特训",
    master_lesson: "大师训练",
    card_ticket: "卡牌券",
    gacha_ceil_ticket: "天井券",
    vocal_card_ticket: "anvo兑换券",
    character_rank_exp_ticket: "心愿小瓶",
    card_episode_release_ticket: "剧情解锁券",
    auto_exchange_music_vocal_ticket: "connect live版vocal兑换券",
    birthday_party_delivery: "祝祭的雨露",
};

const MYSEKAI_TYPE_LABELS: Record<string, string> = {
    wood: "木材",
    mineral: "矿石",
    junk: "杂物",
    plant: "植物",
    tone: "音色",
    game_character: "角色记忆",
    birthday_party: "生日会",
};

const MYSEKAI_RARITY_LABELS: Record<string, string> = {
    rarity_1: "★1",
    rarity_2: "★2",
    rarity_3: "★3",
    rarity_4: "★4",
};

const MYSEKAI_SITE_LOCAL_LABELS: Record<number, string> = {
    5: "初始空地",
    6: "愿望沙滩",
    7: "浪漫花田",
    8: "遗忘之所",
};

const MATERIAL_TYPE_ORDER = Object.keys(MATERIAL_TYPE_LABELS);
const MYSEKAI_TYPE_ORDER = Object.keys(MYSEKAI_TYPE_LABELS);
const MYSEKAI_RARITY_ORDER = ["rarity_1", "rarity_2", "rarity_3", "rarity_4"];

function toSearchText(value: string | number | undefined | null): string {
    return String(value ?? "").trim().toLowerCase();
}

function parseStringList(value: string | null): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseNumberList(value: string | null): number[] {
    return parseStringList(value)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function areNumberArraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function areMaterialFiltersEqual(a: MaterialFiltersState, b: MaterialFiltersState): boolean {
    return (
        a.searchQuery === b.searchQuery &&
        areStringArraysEqual(a.selectedTypes, b.selectedTypes) &&
        a.usableOnly === b.usableOnly &&
        a.sortBy === b.sortBy &&
        a.sortOrder === b.sortOrder
    );
}

function areMysekaiFiltersEqual(a: MysekaiFiltersState, b: MysekaiFiltersState): boolean {
    return (
        a.searchQuery === b.searchQuery &&
        areStringArraysEqual(a.selectedTypes, b.selectedTypes) &&
        areStringArraysEqual(a.selectedRarities, b.selectedRarities) &&
        areNumberArraysEqual(a.selectedSites, b.selectedSites) &&
        a.sortBy === b.sortBy &&
        a.sortOrder === b.sortOrder
    );
}

function getUniqueValues(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }

    return result;
}

function sortByPreferredOrder(values: string[], preferredOrder: string[]): string[] {
    const orderMap = new Map(preferredOrder.map((value, index) => [value, index]));

    return [...values].sort((a, b) => {
        const aOrder = orderMap.get(a);
        const bOrder = orderMap.get(b);

        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return a.localeCompare(b, "zh-Hans-CN");
    });
}

function formatFallbackLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function getMaterialTypeLabel(value: string): string {
    return MATERIAL_TYPE_LABELS[value] || formatFallbackLabel(value);
}

function getMysekaiTypeLabel(value: string): string {
    return MYSEKAI_TYPE_LABELS[value] || formatFallbackLabel(value);
}

function getMysekaiRarityLabel(value: string): string {
    return MYSEKAI_RARITY_LABELS[value] || formatFallbackLabel(value);
}

function getMysekaiRarityRank(value: string): number {
    const match = value.match(/(\d+)/);
    return match ? Number(match[1]) : 0;
}

function getEffectiveMaterialDescription(material: IMaterialInfo): string {
    if (
        material.flavorText2 &&
        typeof material.changeFlavorTextAt === "number" &&
        Date.now() >= material.changeFlavorTextAt
    ) {
        return material.flavorText2;
    }

    return material.flavorText || "";
}

function getMysekaiSiteLabel(siteId: number, siteMap: Map<number, IMysekaiSiteInfo>): string {
    return MYSEKAI_SITE_LOCAL_LABELS[siteId] || siteMap.get(siteId)?.name || `区域 ${siteId}`;
}

function PageHeader() {
    return (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                <span className="text-miku text-xs font-bold tracking-widest uppercase">Materials Database</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                持有物 <span className="text-miku">图鉴</span>
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm">
                浏览 Project SEKAI 普通持有物与 MySekai 持有物
            </p>
        </div>
    );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-slate-400 font-medium">{title}</p>
            {description && <p className="text-slate-400 text-xs mt-1">{description}</p>}
        </div>
    );
}

function Badge({ label, tone = "slate" }: { label: string; tone?: "miku" | "violet" | "amber" | "emerald" | "slate" }) {
    const toneClassMap = {
        miku: "bg-miku/10 text-miku",
        violet: "bg-violet-500/10 text-violet-600",
        amber: "bg-amber-500/10 text-amber-700",
        emerald: "bg-emerald-500/10 text-emerald-700",
        slate: "bg-slate-100 text-slate-500",
    } satisfies Record<string, string>;

    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${toneClassMap[tone]}`}>
            {label}
        </span>
    );
}

function CardImage({
    src,
    alt,
    className = "relative aspect-square mb-3 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center",
    imageClassName = "w-full h-full object-contain p-2",
}: {
    src: string;
    alt: string;
    className?: string;
    imageClassName?: string;
}) {
    const [hasError, setHasError] = useState(false);

    return (
        <div className={className}>
            {src && !hasError ? (
                <img
                    src={src}
                    alt={alt}
                    className={imageClassName}
                    loading="lazy"
                    onError={() => setHasError(true)}
                />
            ) : (
                <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            )}
        </div>
    );
}

function RegularMaterialCard({
    item,
    assetSource,
    onClick,
}: {
    item: IMaterialInfo;
    assetSource: AssetSourceType;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-shortcut-item="true"
            className="group block w-full text-left bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-4 h-full active:scale-[0.98]"
            title={`查看 ${item.name} 详情`}
        >
            <CardImage
                src={getMaterialThumbnailUrl(item.id, assetSource)}
                alt={item.name}
                imageClassName="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />

            <div className="flex flex-col min-h-0 gap-2">
                <div>
                    <h3 className="font-bold text-sm text-slate-800 leading-5 break-words group-hover:text-miku transition-colors">
                        {item.name}
                    </h3>
                    <p className="mt-1 text-[10px] font-mono text-slate-400">#{item.id}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                    <Badge label={getMaterialTypeLabel(item.materialType)} tone="miku" />
                    {item.canUse && <Badge label="可使用" tone="emerald" />}
                </div>
            </div>
        </button>
    );
}

function MysekaiMaterialCard({
    item,
    assetSource,
    siteMap,
    onClick,
}: {
    item: IMysekaiMaterial;
    assetSource: AssetSourceType;
    siteMap: Map<number, IMysekaiSiteInfo>;
    onClick: () => void;
}) {
    const visibleSiteIds = item.mysekaiSiteIds.slice(0, 2);
    const extraSiteCount = Math.max(0, item.mysekaiSiteIds.length - visibleSiteIds.length);

    return (
        <button
            type="button"
            onClick={onClick}
            data-shortcut-item="true"
            className="group block w-full text-left bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-4 h-full active:scale-[0.98]"
            title={`查看 ${item.name} 详情`}
        >
            <CardImage
                src={getMysekaiMaterialThumbnailUrl(item.iconAssetbundleName, assetSource)}
                alt={item.name}
                imageClassName="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />

            <div className="flex flex-col min-h-0 gap-2">
                <div>
                    <h3 className="font-bold text-sm text-slate-800 leading-5 break-words group-hover:text-miku transition-colors">
                        {item.name}
                    </h3>
                    <p className="mt-1 text-[10px] font-mono text-slate-400">#{item.id}</p>
                </div>

                <div className="flex flex-wrap gap-1">
                    <Badge label={getMysekaiTypeLabel(item.mysekaiMaterialType)} tone="violet" />
                    <Badge label={getMysekaiRarityLabel(item.mysekaiMaterialRarityType)} tone="amber" />
                    {item.mysekaiSiteIds.length === 0 ? (
                        <Badge label="特殊来源" tone="emerald" />
                    ) : (
                        <>
                            {visibleSiteIds.map((siteId) => (
                                <Badge key={`${item.id}-${siteId}`} label={getMysekaiSiteLabel(siteId, siteMap)} tone="slate" />
                            ))}
                            {extraSiteCount > 0 && <Badge label={`+${extraSiteCount}`} tone="slate" />}
                        </>
                    )}
                </div>
            </div>
        </button>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm font-bold text-slate-600">{label}</span>
            <span className="text-sm text-slate-800 text-right max-w-[60%]">{value}</span>
        </div>
    );
}

function getExchangeStatusTone(status: ExchangeStatus): "miku" | "violet" | "amber" | "emerald" | "slate" {
    switch (status) {
        case "active": return "emerald";
        case "upcoming": return "amber";
        case "ended": return "slate";
        case "permanent": default: return "violet";
    }
}

function ExchangeUsageLink({ entry }: { entry: FlattenedMaterialExchange }) {
    return (
        <Link
            href={`/exchanges/${entry.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm transition-colors hover:border-miku/30 hover:bg-miku/5"
        >
            <span className="truncate font-medium text-slate-700">{entry.resolvedTitle}</span>
            <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                getExchangeStatusTone(entry.status) === "emerald" ? "bg-emerald-500/10 text-emerald-700" :
                getExchangeStatusTone(entry.status) === "amber" ? "bg-amber-500/10 text-amber-700" :
                getExchangeStatusTone(entry.status) === "violet" ? "bg-violet-500/10 text-violet-600" :
                "bg-slate-100 text-slate-500"
            }`}>
                {STATUS_LABELS[entry.status]}
            </span>
        </Link>
    );
}

function ExchangeUsageSection({ selection }: { selection: MaterialDetailSelection }) {
    const [usages, setUsages] = useState<MaterialExchangeUsages | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!selection) {
            setUsages(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        loadExchangeCoreData()
            .then((coreData) => {
                if (cancelled) return;
                const materialType = selection.kind === "material" ? "material" as const : "mysekai_material" as const;
                const result = findMaterialExchangeUsages(
                    selection.item.id,
                    materialType,
                    coreData.flattenedExchanges
                );
                setUsages(result);
            })
            .catch(() => {
                if (!cancelled) setUsages(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [selection]);

    if (isLoading) {
        return (
            <div>
                <h3 className="mb-3 text-sm font-bold text-slate-700">兑换所关联</h3>
                <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">加载中...</div>
            </div>
        );
    }

    if (!usages || (usages.asCost.length === 0 && usages.asReward.length === 0)) {
        return null;
    }

    return (
        <div>
            <h3 className="mb-3 text-sm font-bold text-slate-700">兑换所关联</h3>
            <div className="space-y-3">
                {usages.asCost.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-slate-500">作为兑换成本 ({usages.asCost.length})</p>
                        <div className="space-y-1">
                            {usages.asCost.slice(0, 8).map((entry) => (
                                <ExchangeUsageLink key={`cost-${entry.id}`} entry={entry} />
                            ))}
                            {usages.asCost.length > 8 && (
                                <p className="text-xs text-slate-400 pl-3">还有 {usages.asCost.length - 8} 项...</p>
                            )}
                        </div>
                    </div>
                )}
                {usages.asReward.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-slate-500">作为兑换奖励 ({usages.asReward.length})</p>
                        <div className="space-y-1">
                            {usages.asReward.slice(0, 8).map((entry) => (
                                <ExchangeUsageLink key={`reward-${entry.id}`} entry={entry} />
                            ))}
                            {usages.asReward.length > 8 && (
                                <p className="text-xs text-slate-400 pl-3">还有 {usages.asReward.length - 8} 项...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MaterialDetailModal({
    selection,
    assetSource,
    siteMap,
    onClose,
}: {
    selection: MaterialDetailSelection;
    assetSource: AssetSourceType;
    siteMap: Map<number, IMysekaiSiteInfo>;
    onClose: () => void;
}) {
    const regularMaterial = selection?.kind === "material" ? selection.item : null;
    const mysekaiMaterial = selection?.kind === "mysekai" ? selection.item : null;
    const title = selection?.item.name ?? "持有物详情";
    const description = regularMaterial
        ? getEffectiveMaterialDescription(regularMaterial)
        : mysekaiMaterial?.description || "";
    const imageUrl = regularMaterial
        ? getMaterialThumbnailUrl(regularMaterial.id, assetSource)
        : mysekaiMaterial
            ? getMysekaiMaterialThumbnailUrl(mysekaiMaterial.iconAssetbundleName, assetSource)
            : "";
    const actionFileName = selection ? `${selection.item.name}_${selection.item.id}` : "material";
    const mysekaiSiteLabels = mysekaiMaterial
        ? mysekaiMaterial.mysekaiSiteIds.length === 0
            ? ["特殊来源"]
            : mysekaiMaterial.mysekaiSiteIds.map((siteId) => getMysekaiSiteLabel(siteId, siteMap))
        : [];

    const { headerActions, errorMessage, saveClickCount } = useImageUrlActions({
        isOpen: !!selection,
        imageUrl,
        fileName: actionFileName,
    });

    return (
        <Modal
            isOpen={!!selection}
            onClose={onClose}
            title={title}
            size="md"
            syncHistory={false}
            headerActions={headerActions}
        >
            {selection && (
                <div className="space-y-5">
                    {saveClickCount >= 2 && (
                        <div className="rounded-xl border border-miku/15 bg-gradient-to-r from-miku/5 to-luka/5 px-4 py-2.5 animate-in fade-in duration-300">
                            <p className="text-xs leading-relaxed text-slate-600">
                                若浏览器未正常弹出下载，可尝试<strong className="text-slate-700">右键图片（移动端长按）→ 保存图像</strong>。
                                或更换最新版浏览器后再试。
                            </p>
                        </div>
                    )}

                    {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}

                    <div className="flex justify-center">
                        <div className="w-full max-w-[380px]">
                            <CardImage
                                key={`${selection.kind}-${selection.item.id}`}
                                src={imageUrl}
                                alt={selection.item.name}
                                className="relative aspect-square w-full rounded-xl overflow-hidden bg-transparent flex items-center justify-center"
                                imageClassName="mx-auto h-full w-full object-contain p-4 sm:p-6"
                            />
                        </div>
                    </div>

                    <div className="space-y-0">
                        <InfoRow label="ID" value={`#${selection.item.id}`} />
                        <InfoRow label="名称" value={selection.item.name} />
                        <InfoRow label="排序序号" value={String(selection.item.seq)} />
                        {regularMaterial ? (
                            <>
                                <InfoRow label="类型" value={getMaterialTypeLabel(regularMaterial.materialType)} />
                                <InfoRow label="可使用" value={regularMaterial.canUse ? "是" : "否"} />
                            </>
                        ) : mysekaiMaterial ? (
                            <>
                                <InfoRow label="类型" value={getMysekaiTypeLabel(mysekaiMaterial.mysekaiMaterialType)} />
                                <InfoRow label="稀有度" value={getMysekaiRarityLabel(mysekaiMaterial.mysekaiMaterialRarityType)} />
                            </>
                        ) : null}
                    </div>

                    {mysekaiMaterial && (
                        <div>
                            <h3 className="mb-3 text-sm font-bold text-slate-700">来源区域</h3>
                            <div className="flex flex-wrap gap-2">
                                {mysekaiSiteLabels.map((siteLabel) => (
                                    <Badge key={`${mysekaiMaterial.id}-${siteLabel}`} label={siteLabel} tone="slate" />
                                ))}
                            </div>
                        </div>
                    )}

                    {description && (
                        <div>
                            <h3 className="mb-3 text-sm font-bold text-slate-700">说明</h3>
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                                    {description}
                                </p>
                            </div>
                        </div>
                    )}

                    <ExchangeUsageSection selection={selection} />
                </div>
            )}
        </Modal>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse p-3">
                    <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-3" />
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-full" />
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function MaterialsContent() {
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();

    const [materials, setMaterials] = useState<IMaterialInfo[]>([]);
    const [mysekaiMaterials, setMysekaiMaterials] = useState<IMysekaiMaterial[]>([]);
    const [mysekaiSites, setMysekaiSites] = useState<IMysekaiSiteInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    const [activeTab, setActiveTab] = useState<TabType>(DEFAULT_TAB);
    const [materialFilters, setMaterialFilters] = useState<MaterialFiltersState>(DEFAULT_MATERIAL_FILTERS);
    const [mysekaiFilters, setMysekaiFilters] = useState<MysekaiFiltersState>(DEFAULT_MYSEKAI_FILTERS);
    const [selectedDetail, setSelectedDetail] = useState<MaterialDetailSelection>(null);

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "materials",
        defaultDisplayCount: 48,
        increment: 48,
        isReady: !isLoading,
    });

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const requestedTab = searchParams.get("tab");
        const hasMysekaiParams = Boolean(
            searchParams.get("mysekaiTypes") ||
            searchParams.get("rarities") ||
            searchParams.get("sites")
        );

        const nextActiveTab: TabType =
            requestedTab === "mysekaiMaterials" || (!requestedTab && hasMysekaiParams)
                ? "mysekaiMaterials"
                : "materials";

        const nextMaterialFilters: MaterialFiltersState = {
            ...DEFAULT_MATERIAL_FILTERS,
        };

        const nextMysekaiFilters: MysekaiFiltersState = {
            ...DEFAULT_MYSEKAI_FILTERS,
        };

        if (nextActiveTab === "materials") {
            nextMaterialFilters.searchQuery = searchParams.get("search") || "";

            const sortBy = searchParams.get("sortBy");
            if (sortBy === "seq" || sortBy === "id" || sortBy === "name") {
                nextMaterialFilters.sortBy = sortBy;
            }

            const sortOrder = searchParams.get("sortOrder");
            if (sortOrder === "asc" || sortOrder === "desc") {
                nextMaterialFilters.sortOrder = sortOrder;
            }

            nextMaterialFilters.selectedTypes = parseStringList(searchParams.get("materialTypes"));
            nextMaterialFilters.usableOnly = searchParams.get("usable") === "true";
        } else {
            nextMysekaiFilters.searchQuery = searchParams.get("search") || "";

            const sortBy = searchParams.get("sortBy");
            if (sortBy === "seq" || sortBy === "id" || sortBy === "name" || sortBy === "rarity") {
                nextMysekaiFilters.sortBy = sortBy;
            }

            const sortOrder = searchParams.get("sortOrder");
            if (sortOrder === "asc" || sortOrder === "desc") {
                nextMysekaiFilters.sortOrder = sortOrder;
            }

            nextMysekaiFilters.selectedTypes = parseStringList(searchParams.get("mysekaiTypes"));
            nextMysekaiFilters.selectedRarities = parseStringList(searchParams.get("rarities"));
            nextMysekaiFilters.selectedSites = parseNumberList(searchParams.get("sites"));
        }

        setActiveTab((prev) => (prev === nextActiveTab ? prev : nextActiveTab));
        setMaterialFilters((prev) => (areMaterialFiltersEqual(prev, nextMaterialFilters) ? prev : nextMaterialFilters));
        setMysekaiFilters((prev) => (areMysekaiFiltersEqual(prev, nextMysekaiFilters) ? prev : nextMysekaiFilters));
        setFiltersInitialized(true);
    }, [searchParams]);
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            setIsLoading(true);

            const [materialsResult, mysekaiMaterialsResult, mysekaiSitesResult] = await Promise.allSettled([
                fetchMasterData<IMaterialInfo[]>("materials.json"),
                fetchMasterData<IMysekaiMaterial[]>("mysekaiMaterials.json"),
                fetchMasterData<IMysekaiSiteInfo[]>("mysekaiSites.json"),
            ]);

            if (cancelled) return;

            const nextMaterials = materialsResult.status === "fulfilled" ? materialsResult.value : [];
            const nextMysekaiMaterials = mysekaiMaterialsResult.status === "fulfilled" ? mysekaiMaterialsResult.value : [];
            const nextMysekaiSites = mysekaiSitesResult.status === "fulfilled" ? mysekaiSitesResult.value : [];

            setMaterials(nextMaterials);
            setMysekaiMaterials(nextMysekaiMaterials);
            setMysekaiSites(nextMysekaiSites);

            const mainDataFailed = materialsResult.status === "rejected" && mysekaiMaterialsResult.status === "rejected";
            const partialFailed =
                materialsResult.status === "rejected" ||
                mysekaiMaterialsResult.status === "rejected" ||
                mysekaiSitesResult.status === "rejected";

            if (mainDataFailed) {
                setError("持有物数据加载失败，请稍后重试。");
            } else if (partialFailed) {
                setError("部分持有物数据加载失败，部分筛选或标签可能不完整。");
            } else {
                setError(null);
            }

            setIsLoading(false);
        }

        fetchData();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!filtersInitialized || typeof window === "undefined") return;

        const url = new URL(window.location.href);
        url.search = "";

        if (activeTab !== DEFAULT_TAB) {
            url.searchParams.set("tab", activeTab);
        }

        if (activeTab === "materials") {
            if (materialFilters.searchQuery.trim()) {
                url.searchParams.set("search", materialFilters.searchQuery.trim());
            }
            if (materialFilters.selectedTypes.length > 0) {
                url.searchParams.set("materialTypes", materialFilters.selectedTypes.join(","));
            }
            if (materialFilters.usableOnly) {
                url.searchParams.set("usable", "true");
            }
            if (materialFilters.sortBy !== DEFAULT_MATERIAL_FILTERS.sortBy) {
                url.searchParams.set("sortBy", materialFilters.sortBy);
            }
            if (materialFilters.sortOrder !== DEFAULT_MATERIAL_FILTERS.sortOrder) {
                url.searchParams.set("sortOrder", materialFilters.sortOrder);
            }
        } else {
            if (mysekaiFilters.searchQuery.trim()) {
                url.searchParams.set("search", mysekaiFilters.searchQuery.trim());
            }
            if (mysekaiFilters.selectedTypes.length > 0) {
                url.searchParams.set("mysekaiTypes", mysekaiFilters.selectedTypes.join(","));
            }
            if (mysekaiFilters.selectedRarities.length > 0) {
                url.searchParams.set("rarities", mysekaiFilters.selectedRarities.join(","));
            }
            if (mysekaiFilters.selectedSites.length > 0) {
                url.searchParams.set("sites", mysekaiFilters.selectedSites.join(","));
            }
            if (mysekaiFilters.sortBy !== DEFAULT_MYSEKAI_FILTERS.sortBy) {
                url.searchParams.set("sortBy", mysekaiFilters.sortBy);
            }
            if (mysekaiFilters.sortOrder !== DEFAULT_MYSEKAI_FILTERS.sortOrder) {
                url.searchParams.set("sortOrder", mysekaiFilters.sortOrder);
            }
        }

        window.history.replaceState({}, "", url.toString());
    }, [activeTab, materialFilters, mysekaiFilters, filtersInitialized]);

    const mysekaiSiteMap = useMemo(() => {
        const map = new Map<number, IMysekaiSiteInfo>();
        mysekaiSites
            .filter((site) => site.mysekaiSiteCategory === "harvest")
            .forEach((site) => {
                map.set(site.id, site);
            });
        return map;
    }, [mysekaiSites]);

    const materialTypeOptions = useMemo(
        () => sortByPreferredOrder(getUniqueValues(materials.map((item) => item.materialType)), MATERIAL_TYPE_ORDER),
        [materials]
    );

    const mysekaiTypeOptions = useMemo(
        () => sortByPreferredOrder(getUniqueValues(mysekaiMaterials.map((item) => item.mysekaiMaterialType)), MYSEKAI_TYPE_ORDER),
        [mysekaiMaterials]
    );

    const mysekaiRarityOptions = useMemo(
        () => sortByPreferredOrder(getUniqueValues(mysekaiMaterials.map((item) => item.mysekaiMaterialRarityType)), MYSEKAI_RARITY_ORDER),
        [mysekaiMaterials]
    );

    const mysekaiSiteOptions = useMemo(() => {
        const uniqueSiteIds = Array.from(
            new Set(mysekaiMaterials.flatMap((item) => item.mysekaiSiteIds))
        ).sort((a, b) => a - b);

        return uniqueSiteIds.map((siteId) => ({
            id: siteId,
            label: getMysekaiSiteLabel(siteId, mysekaiSiteMap),
        }));
    }, [mysekaiMaterials, mysekaiSiteMap]);

    const filteredMaterials = useMemo(() => {
        let result = [...materials];

        if (materialFilters.selectedTypes.length > 0) {
            result = result.filter((item) => materialFilters.selectedTypes.includes(item.materialType));
        }

        if (materialFilters.usableOnly) {
            result = result.filter((item) => item.canUse);
        }

        if (materialFilters.searchQuery.trim()) {
            const query = toSearchText(materialFilters.searchQuery);
            result = result.filter((item) => {
                const description = getEffectiveMaterialDescription(item);
                return (
                    toSearchText(item.name).includes(query) ||
                    toSearchText(item.id).includes(query) ||
                    toSearchText(description).includes(query)
                );
            });
        }

        result.sort((a, b) => {
            let compare = 0;

            if (materialFilters.sortBy === "id") {
                compare = a.id - b.id;
            } else if (materialFilters.sortBy === "name") {
                compare = a.name.localeCompare(b.name, "zh-Hans-CN");
            } else {
                compare = a.seq - b.seq;
            }

            if (compare !== 0) {
                return materialFilters.sortOrder === "asc" ? compare : -compare;
            }

            return a.id - b.id;
        });

        return result;
    }, [materials, materialFilters]);

    const filteredMysekaiMaterials = useMemo(() => {
        let result = [...mysekaiMaterials];

        if (mysekaiFilters.selectedTypes.length > 0) {
            result = result.filter((item) => mysekaiFilters.selectedTypes.includes(item.mysekaiMaterialType));
        }

        if (mysekaiFilters.selectedRarities.length > 0) {
            result = result.filter((item) => mysekaiFilters.selectedRarities.includes(item.mysekaiMaterialRarityType));
        }

        if (mysekaiFilters.selectedSites.length > 0) {
            result = result.filter((item) =>
                item.mysekaiSiteIds.some((siteId) => mysekaiFilters.selectedSites.includes(siteId))
            );
        }

        if (mysekaiFilters.searchQuery.trim()) {
            const query = toSearchText(mysekaiFilters.searchQuery);
            result = result.filter((item) => {
                return (
                    toSearchText(item.name).includes(query) ||
                    toSearchText(item.id).includes(query) ||
                    toSearchText(item.description).includes(query)
                );
            });
        }

        result.sort((a, b) => {
            let compare = 0;

            if (mysekaiFilters.sortBy === "id") {
                compare = a.id - b.id;
            } else if (mysekaiFilters.sortBy === "name") {
                compare = a.name.localeCompare(b.name, "zh-Hans-CN");
            } else if (mysekaiFilters.sortBy === "rarity") {
                compare = getMysekaiRarityRank(a.mysekaiMaterialRarityType) - getMysekaiRarityRank(b.mysekaiMaterialRarityType);
            } else {
                compare = a.seq - b.seq;
            }

            if (compare !== 0) {
                return mysekaiFilters.sortOrder === "asc" ? compare : -compare;
            }

            return a.id - b.id;
        });

        return result;
    }, [mysekaiMaterials, mysekaiFilters]);

    const currentItems = activeTab === "materials" ? filteredMaterials : filteredMysekaiMaterials;
    const currentTotalCount = activeTab === "materials" ? materials.length : mysekaiMaterials.length;
    const displayedItems = useMemo(() => currentItems.slice(0, displayCount), [currentItems, displayCount]);

    const hasActiveMaterialFilters =
        materialFilters.searchQuery !== DEFAULT_MATERIAL_FILTERS.searchQuery ||
        materialFilters.selectedTypes.length > 0 ||
        materialFilters.usableOnly !== DEFAULT_MATERIAL_FILTERS.usableOnly ||
        materialFilters.sortBy !== DEFAULT_MATERIAL_FILTERS.sortBy ||
        materialFilters.sortOrder !== DEFAULT_MATERIAL_FILTERS.sortOrder;

    const hasActiveMysekaiFilters =
        mysekaiFilters.searchQuery !== DEFAULT_MYSEKAI_FILTERS.searchQuery ||
        mysekaiFilters.selectedTypes.length > 0 ||
        mysekaiFilters.selectedRarities.length > 0 ||
        mysekaiFilters.selectedSites.length > 0 ||
        mysekaiFilters.sortBy !== DEFAULT_MYSEKAI_FILTERS.sortBy ||
        mysekaiFilters.sortOrder !== DEFAULT_MYSEKAI_FILTERS.sortOrder;

    const updateMaterialFilters = useCallback((updater: (prev: MaterialFiltersState) => MaterialFiltersState) => {
        setMaterialFilters((prev) => updater(prev));
        resetDisplayCount();
    }, [resetDisplayCount]);

    const updateMysekaiFilters = useCallback((updater: (prev: MysekaiFiltersState) => MysekaiFiltersState) => {
        setMysekaiFilters((prev) => updater(prev));
        resetDisplayCount();
    }, [resetDisplayCount]);

    const resetMaterialFilters = useCallback(() => {
        setMaterialFilters(DEFAULT_MATERIAL_FILTERS);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const resetMysekaiFilters = useCallback(() => {
        setMysekaiFilters(DEFAULT_MYSEKAI_FILTERS);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const quickFilterTitle = activeTab === "materials" ? "持有物筛选" : "MySekai 持有物筛选";
    const quickFilterContent = useMemo(() => {
        return activeTab === "materials" ? (
            <BaseFilters
                title="筛选持有物"
                filteredCount={filteredMaterials.length}
                totalCount={materials.length}
                countUnit="种"
                searchQuery={materialFilters.searchQuery}
                onSearchChange={(query) => updateMaterialFilters((prev) => ({ ...prev, searchQuery: query }))}
                searchPlaceholder="搜索持有物名称、说明或 ID..."
                sortOptions={MATERIAL_SORT_OPTIONS.map((option) => ({ ...option }))}
                sortBy={materialFilters.sortBy}
                sortOrder={materialFilters.sortOrder}
                onSortChange={(sortBy, sortOrder) =>
                    updateMaterialFilters((prev) => ({
                        ...prev,
                        sortBy: sortBy as MaterialSortBy,
                        sortOrder,
                    }))
                }
                hasActiveFilters={hasActiveMaterialFilters}
                onReset={resetMaterialFilters}
            >
                <FilterSection label="持有物类型">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={materialFilters.selectedTypes.length === 0}
                            onClick={() => updateMaterialFilters((prev) => ({ ...prev, selectedTypes: [] }))}
                        >
                            全部
                        </FilterButton>
                        {materialTypeOptions.map((type) => (
                            <FilterButton
                                key={type}
                                selected={materialFilters.selectedTypes.includes(type)}
                                onClick={() =>
                                    updateMaterialFilters((prev) => ({
                                        ...prev,
                                        selectedTypes: prev.selectedTypes.includes(type)
                                            ? prev.selectedTypes.filter((item) => item !== type)
                                            : [...prev.selectedTypes, type],
                                    }))
                                }
                            >
                                {getMaterialTypeLabel(type)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="显示">
                    <FilterToggle
                        selected={materialFilters.usableOnly}
                        onClick={() => updateMaterialFilters((prev) => ({ ...prev, usableOnly: !prev.usableOnly }))}
                        label="仅显示可使用道具"
                    />
                </FilterSection>
            </BaseFilters>
        ) : (
            <BaseFilters
                title="筛选 MySekai 持有物"
                filteredCount={filteredMysekaiMaterials.length}
                totalCount={mysekaiMaterials.length}
                countUnit="种"
                searchQuery={mysekaiFilters.searchQuery}
                onSearchChange={(query) => updateMysekaiFilters((prev) => ({ ...prev, searchQuery: query }))}
                searchPlaceholder="搜索 MySekai 持有物名称、说明或 ID..."
                sortOptions={MYSEKAI_SORT_OPTIONS.map((option) => ({ ...option }))}
                sortBy={mysekaiFilters.sortBy}
                sortOrder={mysekaiFilters.sortOrder}
                onSortChange={(sortBy, sortOrder) =>
                    updateMysekaiFilters((prev) => ({
                        ...prev,
                        sortBy: sortBy as MysekaiSortBy,
                        sortOrder,
                    }))
                }
                hasActiveFilters={hasActiveMysekaiFilters}
                onReset={resetMysekaiFilters}
            >
                <FilterSection label="持有物类型">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={mysekaiFilters.selectedTypes.length === 0}
                            onClick={() => updateMysekaiFilters((prev) => ({ ...prev, selectedTypes: [] }))}
                        >
                            全部
                        </FilterButton>
                        {mysekaiTypeOptions.map((type) => (
                            <FilterButton
                                key={type}
                                selected={mysekaiFilters.selectedTypes.includes(type)}
                                onClick={() =>
                                    updateMysekaiFilters((prev) => ({
                                        ...prev,
                                        selectedTypes: prev.selectedTypes.includes(type)
                                            ? prev.selectedTypes.filter((item) => item !== type)
                                            : [...prev.selectedTypes, type],
                                    }))
                                }
                            >
                                {getMysekaiTypeLabel(type)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="稀有度">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={mysekaiFilters.selectedRarities.length === 0}
                            onClick={() => updateMysekaiFilters((prev) => ({ ...prev, selectedRarities: [] }))}
                        >
                            全部
                        </FilterButton>
                        {mysekaiRarityOptions.map((rarity) => (
                            <FilterButton
                                key={rarity}
                                selected={mysekaiFilters.selectedRarities.includes(rarity)}
                                onClick={() =>
                                    updateMysekaiFilters((prev) => ({
                                        ...prev,
                                        selectedRarities: prev.selectedRarities.includes(rarity)
                                            ? prev.selectedRarities.filter((item) => item !== rarity)
                                            : [...prev.selectedRarities, rarity],
                                    }))
                                }
                            >
                                {getMysekaiRarityLabel(rarity)}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="来源区域">
                    <div className="grid grid-cols-2 gap-2">
                        <FilterButton
                            selected={mysekaiFilters.selectedSites.length === 0}
                            onClick={() => updateMysekaiFilters((prev) => ({ ...prev, selectedSites: [] }))}
                        >
                            全部
                        </FilterButton>
                        {mysekaiSiteOptions.map((site) => (
                            <FilterButton
                                key={site.id}
                                selected={mysekaiFilters.selectedSites.includes(site.id)}
                                onClick={() =>
                                    updateMysekaiFilters((prev) => ({
                                        ...prev,
                                        selectedSites: prev.selectedSites.includes(site.id)
                                            ? prev.selectedSites.filter((item) => item !== site.id)
                                            : [...prev.selectedSites, site.id].sort((a, b) => a - b),
                                    }))
                                }
                            >
                                {site.label}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </BaseFilters>
        );
    }, [
        activeTab,
        filteredMaterials.length,
        filteredMysekaiMaterials.length,
        hasActiveMaterialFilters,
        hasActiveMysekaiFilters,
        materialFilters,
        materialTypeOptions,
        materials.length,
        mysekaiFilters,
        mysekaiMaterials.length,
        mysekaiRarityOptions,
        mysekaiSiteOptions,
        mysekaiTypeOptions,
        resetMaterialFilters,
        resetMysekaiFilters,
        updateMaterialFilters,
        updateMysekaiFilters,
    ]);

    useQuickFilter(quickFilterTitle, quickFilterContent, [quickFilterTitle, quickFilterContent]);

    const currentTabLabel = activeTab === "materials" ? "普通持有物" : "MySekai 持有物";
    const currentHasActiveFilters = activeTab === "materials" ? hasActiveMaterialFilters : hasActiveMysekaiFilters;

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <MaterialDetailModal
                selection={selectedDetail}
                assetSource={assetSource}
                siteMap={mysekaiSiteMap}
                onClose={() => setSelectedDetail(null)}
            />

            <PageHeader />

            <div className="mb-4 flex items-center gap-2 flex-wrap">
                {([
                    { key: "materials" as TabType, label: "普通持有物" },
                    { key: "mysekaiMaterials" as TabType, label: "MySekai 持有物" },
                ]).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => {
                            setSelectedDetail(null);
                            setActiveTab(tab.key);
                            resetDisplayCount();
                        }}
                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === tab.key
                            ? "bg-miku/10 text-miku ring-1 ring-miku/30"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {!isLoading && (
                <div className="mb-4 text-xs text-slate-500">
                    当前为 <span className="font-bold text-miku">{currentTabLabel}</span>，
                    共 <span className="font-bold text-miku">{currentItems.length}</span>
                    {currentHasActiveFilters ? ` / ${currentTotalCount}` : ""} 种
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载提示</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <SkeletonGrid />
                    ) : currentItems.length === 0 ? (
                        <EmptyState
                            title={currentHasActiveFilters ? "没有找到符合条件的持有物" : "暂无持有物数据"}
                            description={
                                currentHasActiveFilters
                                    ? "可以尝试重置筛选后重新查看"
                                    : activeTab === "materials"
                                        ? "当前普通持有物 masterdata 暂无可用条目"
                                        : "当前 MySekai 持有物 masterdata 暂无可用条目"
                            }
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                {activeTab === "materials"
                                    ? (displayedItems as IMaterialInfo[]).map((item) => (
                                        <RegularMaterialCard
                                            key={item.id}
                                            item={item}
                                            assetSource={assetSource}
                                            onClick={() => setSelectedDetail({ kind: "material", item })}
                                        />
                                    ))
                                    : (displayedItems as IMysekaiMaterial[]).map((item) => (
                                        <MysekaiMaterialCard
                                            key={item.id}
                                            item={item}
                                            assetSource={assetSource}
                                            siteMap={mysekaiSiteMap}
                                            onClick={() => setSelectedDetail({ kind: "mysekai", item })}
                                        />
                                    ))}
                            </div>

                            {displayedItems.length < currentItems.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedItems.length} / {currentItems.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {displayedItems.length > 0 && displayedItems.length >= currentItems.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    已显示全部 {currentItems.length} 种{currentTabLabel}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MaterialsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载持有物数据...</div>}>
                <MaterialsContent />
            </Suspense>
        </MainLayout>
    );
}
