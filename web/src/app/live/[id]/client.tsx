"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import {
    ICompactResourceBoxDetails,
    IResourceBoxDetail,
    IResourceBoxInfo,
    IVirtualLiveInfo,
    IVirtualLiveReward,
    VIRTUAL_LIVE_TYPE_COLORS,
    getVirtualLiveStatus,
    VIRTUAL_LIVE_STATUS_DISPLAY,
    VirtualLiveType
} from "@/types/virtualLive";
import {
    getCommonMaterialThumbnailUrl,
    getEventBannerUrl,
    getMaterialThumbnailUrl,
    getMusicJacketUrl,
    getStampUrl,
    getVirtualLiveBannerUrl,
} from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import { useI18n } from "@/contexts/I18nContext";
import type { IMaterialInfo } from "@/types/material";
import type { IHonorGroup, IHonorInfo } from "@/types/honor";
import DegreeImage from "@/components/honor/DegreeImage";

interface IMusic {
    id: number;
    title: string;
    assetbundleName: string;
}

interface IMusicVocal {
    id: number;
    musicId: number;
    musicVocalType: string;
    assetbundleName: string;
}

interface IEventInfo {
    id: number;
    name: string;
    assetbundleName: string;
}

interface IStampInfo {
    id: number;
    name: string;
    assetbundleName: string;
}

interface IGenericRewardItem {
    id: number;
    name?: string;
    title?: string;
    description?: string;
    assetbundleName?: string;
    assetBundleName?: string;
}

interface IRewardLookupData {
    materials: IMaterialInfo[];
    stamps: IStampInfo[];
    honors: IHonorInfo[];
    honorGroups: IHonorGroup[];
    boostItems: IGenericRewardItem[];
    virtualLiveTransitionItems: IGenericRewardItem[];
}

interface IRewardLookupMaps {
    materialMap: Map<number, IMaterialInfo>;
    stampMap: Map<number, IStampInfo>;
    honorMap: Map<number, IHonorInfo>;
    honorGroupMap: Map<number, IHonorGroup>;
    boostItemMap: Map<number, IGenericRewardItem>;
    virtualLiveTransitionItemMap: Map<number, IGenericRewardItem>;
}

interface IResolvedVirtualLiveReward {
    key: string;
    resourceType: string;
    resourceId?: number;
    resourceLevel?: number;
    quantity: number;
    typeLabel: string;
    name: string;
    subtitle?: string;
    imageUrl?: string;
    linkHref?: string;
    honor?: IHonorInfo;
    honorGroup?: IHonorGroup;
}

interface IResolvedVirtualLiveRewardBox {
    reward: IVirtualLiveReward;
    box?: IResourceBoxInfo;
    details: IResolvedVirtualLiveReward[];
}

// API URL for virtual live-event mapping
const VIRTUAL_LIVE_EVENT_MAP_URL = (process.env.NEXT_PUBLIC_API_URL || "") + "/api/virtuallive-event-map";
const VIRTUAL_LIVE_REWARD_PURPOSE = "virtual_live_reward";

const EMPTY_REWARD_LOOKUPS: IRewardLookupData = {
    materials: [],
    stamps: [],
    honors: [],
    honorGroups: [],
    boostItems: [],
    virtualLiveTransitionItems: [],
};

function isCompactResourceBoxServer(): boolean {
    if (typeof window === "undefined") return false;
    const server = localStorage.getItem("server-source") || "jp";
    return server === "cn" || server === "tw" || server === "kr";
}

function getVirtualLiveRewards(virtualLive: IVirtualLiveInfo | null): IVirtualLiveReward[] {
    if (!virtualLive) return [];

    const rewards = [
        ...(virtualLive.virtualLiveReward ? [virtualLive.virtualLiveReward] : []),
        ...(virtualLive.virtualLiveRewards || []),
    ];
    const seen = new Set<string>();

    return rewards.filter((reward) => {
        if (!reward || !Number.isFinite(reward.resourceBoxId)) return false;
        const key = `${reward.virtualLiveType}:${reward.resourceBoxId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getRelevantRewardBoxes(
    virtualLive: IVirtualLiveInfo,
    resourceBoxes: IResourceBoxInfo[]
): IResourceBoxInfo[] {
    const rewardBoxIds = new Set(getVirtualLiveRewards(virtualLive).map((reward) => reward.resourceBoxId));
    return resourceBoxes.filter((box) => box.resourceBoxPurpose === VIRTUAL_LIVE_REWARD_PURPOSE && rewardBoxIds.has(box.id));
}

function resolveCompactEnumValue(enumValues: string[] | undefined, value: number | string | undefined): string | undefined {
    if (typeof value === "string") return value;
    if (typeof value === "number") return enumValues?.[value];
    return undefined;
}

function getRelevantRewardBoxesFromCompact(
    virtualLive: IVirtualLiveInfo,
    compactDetails: ICompactResourceBoxDetails | null
): IResourceBoxInfo[] {
    if (!compactDetails?.resourceBoxId?.length) return [];

    const rewardBoxIds = new Set(getVirtualLiveRewards(virtualLive).map((reward) => reward.resourceBoxId));
    const purposeEnum = compactDetails.__ENUM__?.resourceBoxPurpose;
    const typeEnum = compactDetails.__ENUM__?.resourceType;
    const boxes = new Map<number, IResourceBoxInfo>();

    for (let index = 0; index < compactDetails.resourceBoxId.length; index++) {
        const resourceBoxId = compactDetails.resourceBoxId[index];
        if (!rewardBoxIds.has(resourceBoxId)) continue;

        const resourceBoxPurpose = resolveCompactEnumValue(purposeEnum, compactDetails.resourceBoxPurpose[index]);
        if (resourceBoxPurpose !== VIRTUAL_LIVE_REWARD_PURPOSE) continue;

        const resourceType = resolveCompactEnumValue(typeEnum, compactDetails.resourceType[index]);
        if (!resourceType) continue;

        let box = boxes.get(resourceBoxId);
        if (!box) {
            box = {
                resourceBoxPurpose,
                id: resourceBoxId,
                resourceBoxType: "expand",
                details: [],
            };
            boxes.set(resourceBoxId, box);
        }

        box.details?.push({
            resourceBoxPurpose,
            resourceBoxId,
            seq: (box.details.length || 0) + 1,
            resourceType,
            resourceId: compactDetails.resourceId?.[index],
            resourceLevel: compactDetails.resourceLevel?.[index],
            resourceQuantity: compactDetails.resourceQuantity?.[index],
        });
    }

    return getVirtualLiveRewards(virtualLive)
        .map((reward) => boxes.get(reward.resourceBoxId))
        .filter((box): box is IResourceBoxInfo => Boolean(box));
}

function mergeRewardBoxes(primary: IResourceBoxInfo[], fallback: IResourceBoxInfo[]): IResourceBoxInfo[] {
    const merged = new Map(primary.map((box) => [box.id, box]));

    fallback.forEach((box) => {
        const current = merged.get(box.id);
        if (!current || (current.details || []).length === 0) {
            merged.set(box.id, box);
        }
    });

    return Array.from(merged.values());
}

function hasRewardDetailsForEveryBox(rewards: IVirtualLiveReward[], resourceBoxes: IResourceBoxInfo[]): boolean {
    const boxesWithDetails = new Set(
        resourceBoxes
            .filter((box) => (box.details || []).length > 0)
            .map((box) => box.id)
    );

    return rewards.every((reward) => boxesWithDetails.has(reward.resourceBoxId));
}

function collectRewardResourceTypes(resourceBoxes: IResourceBoxInfo[]): Set<string> {
    const types = new Set<string>();
    resourceBoxes.forEach((box) => {
        (box.details || []).forEach((detail) => {
            if (detail.resourceType) types.add(detail.resourceType);
        });
    });
    return types;
}

function buildMapById<T extends { id: number }>(items: T[]): Map<number, T> {
    return new Map(items.map((item) => [item.id, item]));
}

async function fetchOptionalMasterData<T>(shouldFetch: boolean, path: string, fallback: T): Promise<T> {
    if (!shouldFetch) return fallback;
    try {
        return await fetchMasterData<T>(path);
    } catch (error) {
        console.warn(`[VirtualLiveReward] Failed to fetch ${path}`, error);
        return fallback;
    }
}

async function fetchOptionalMasterRows<T>(shouldFetch: boolean, path: string): Promise<T[]> {
    return fetchOptionalMasterData<T[]>(shouldFetch, path, []);
}

function getTranslatedOrFallback(key: string, fallback: string, t: (key: string, values?: Record<string, string | number>) => string): string {
    const translated = t(key);
    return translated === key ? fallback : translated;
}

function formatResourceType(resourceType: string): string {
    return resourceType
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getRewardTypeLabel(resourceType: string, t: (key: string, values?: Record<string, string | number>) => string): string {
    return getTranslatedOrFallback(`common.exchange.rewardTypes.${resourceType}`, formatResourceType(resourceType), t);
}

function getRewardConditionLabel(virtualLiveType: string, t: (key: string, values?: Record<string, string | number>) => string): string {
    const pageLabel = getTranslatedOrFallback(`page.live.rewardTypes.${virtualLiveType}`, "", t);
    if (pageLabel) return pageLabel;
    return getTranslatedOrFallback(`common.virtualLiveTypes.${virtualLiveType}`, formatResourceType(virtualLiveType), t);
}

function extractGenericName(item: IGenericRewardItem | undefined, fallback: string): string {
    const name = item?.name || item?.title || item?.description;
    return typeof name === "string" && name.trim() ? name : fallback;
}

function resolveVirtualLiveRewardDetail(
    detail: IResourceBoxDetail,
    lookupMaps: IRewardLookupMaps,
    assetSource: ReturnType<typeof useTheme>["assetSource"],
    t: (key: string, values?: Record<string, string | number>) => string
): IResolvedVirtualLiveReward {
    const resourceId = detail.resourceId;
    const quantity = detail.resourceQuantity ?? 1;
    const typeLabel = getRewardTypeLabel(detail.resourceType, t);
    const fallbackName = typeof resourceId === "number"
        ? t("page.live.rewardFallbackName", { type: typeLabel, id: resourceId })
        : typeLabel;

    switch (detail.resourceType) {
        case "material": {
            const material = typeof resourceId === "number" ? lookupMaps.materialMap.get(resourceId) : undefined;
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: material?.name || fallbackName,
                subtitle: material?.materialType || typeLabel,
                imageUrl: typeof resourceId === "number" ? getMaterialThumbnailUrl(resourceId, assetSource) : undefined,
                linkHref: typeof resourceId === "number" ? `/materials?search=${encodeURIComponent(String(resourceId))}` : undefined,
            };
        }
        case "stamp": {
            const stamp = typeof resourceId === "number" ? lookupMaps.stampMap.get(resourceId) : undefined;
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: stamp?.name || fallbackName,
                subtitle: typeLabel,
                imageUrl: stamp?.assetbundleName ? getStampUrl(stamp.assetbundleName, assetSource) : undefined,
                linkHref: typeof resourceId === "number" ? `/sticker?search=${encodeURIComponent(String(resourceId))}` : undefined,
            };
        }
        case "honor": {
            const honor = typeof resourceId === "number" ? lookupMaps.honorMap.get(resourceId) : undefined;
            const honorGroup = honor ? lookupMaps.honorGroupMap.get(honor.groupId) : undefined;
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}-${detail.resourceLevel ?? "level"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: honor?.name || fallbackName,
                subtitle: honorGroup?.name || typeLabel,
                honor,
                honorGroup,
            };
        }
        case "boost_item": {
            const item = typeof resourceId === "number" ? lookupMaps.boostItemMap.get(resourceId) : undefined;
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: extractGenericName(item, fallbackName),
                subtitle: typeLabel,
            };
        }
        case "virtual_live_transition_item": {
            const item = typeof resourceId === "number" ? lookupMaps.virtualLiveTransitionItemMap.get(resourceId) : undefined;
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: extractGenericName(item, fallbackName),
                subtitle: typeLabel,
            };
        }
        case "coin":
        case "jewel":
        case "virtual_coin":
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "currency"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: typeLabel,
                imageUrl: getCommonMaterialThumbnailUrl(detail.resourceType, assetSource),
            };
        default:
            return {
                key: `${detail.seq}-${detail.resourceType}-${resourceId ?? "none"}`,
                resourceType: detail.resourceType,
                resourceId,
                resourceLevel: detail.resourceLevel,
                quantity,
                typeLabel,
                name: fallbackName,
                subtitle: typeof resourceId === "number" ? `ID #${resourceId}` : undefined,
            };
    }
}

function resolveVirtualLiveRewardBoxes(
    virtualLive: IVirtualLiveInfo | null,
    resourceBoxes: IResourceBoxInfo[],
    lookupMaps: IRewardLookupMaps,
    assetSource: ReturnType<typeof useTheme>["assetSource"],
    t: (key: string, values?: Record<string, string | number>) => string
): IResolvedVirtualLiveRewardBox[] {
    if (!virtualLive) return [];
    const boxMap = new Map(resourceBoxes.map((box) => [box.id, box]));

    return getVirtualLiveRewards(virtualLive).map((reward) => {
        const box = boxMap.get(reward.resourceBoxId);
        return {
            reward,
            box,
            details: (box?.details || [])
                .slice()
                .sort((a, b) => a.seq - b.seq)
                .map((detail) => resolveVirtualLiveRewardDetail(detail, lookupMaps, assetSource, t)),
        };
    });
}

export default function VirtualLiveDetailClient() {
    const params = useParams();
    const virtualLiveId = Number(params.id);
    const { assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();
    const { t, formatDate: formatLocaleDate, formatNumber } = useI18n();

    const [virtualLive, setVirtualLive] = useState<IVirtualLiveInfo | null>(null);
    const [allMusics, setAllMusics] = useState<IMusic[]>([]);
    const [allMusicVocals, setAllMusicVocals] = useState<IMusicVocal[]>([]);
    const [rewardResourceBoxes, setRewardResourceBoxes] = useState<IResourceBoxInfo[]>([]);
    const [rewardLookups, setRewardLookups] = useState<IRewardLookupData>(EMPTY_REWARD_LOOKUPS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [relatedEvent, setRelatedEvent] = useState<IEventInfo | null>(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);

    const rewardLookupMaps = useMemo<IRewardLookupMaps>(() => ({
        materialMap: buildMapById(rewardLookups.materials),
        stampMap: buildMapById(rewardLookups.stamps),
        honorMap: buildMapById(rewardLookups.honors),
        honorGroupMap: buildMapById(rewardLookups.honorGroups),
        boostItemMap: buildMapById(rewardLookups.boostItems),
        virtualLiveTransitionItemMap: buildMapById(rewardLookups.virtualLiveTransitionItems),
    }), [rewardLookups]);

    const resolvedRewardBoxes = useMemo(
        () => resolveVirtualLiveRewardBoxes(virtualLive, rewardResourceBoxes, rewardLookupMaps, assetSource, t),
        [virtualLive, rewardResourceBoxes, rewardLookupMaps, assetSource, t]
    );

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Set breadcrumb detail name
    useEffect(() => {
        if (virtualLive) setDetailName(virtualLive.name);
    }, [virtualLive, setDetailName]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [virtualLivesData, musicsData, musicVocalsData, resourceBoxesData] = await Promise.all([
                    fetchMasterData<IVirtualLiveInfo[]>("virtualLives.json"),
                    fetchMasterData<IMusic[]>("musics.json"),
                    fetchMasterData<IMusicVocal[]>("musicVocals.json"),
                    fetchOptionalMasterRows<IResourceBoxInfo>(true, "resourceBoxes.json"),
                ]);

                const foundVL = virtualLivesData.find(vl => vl.id === virtualLiveId);
                if (!foundVL) {
                    throw new Error(`Virtual Live ${virtualLiveId} not found`);
                }

                const resourceBoxRewards = getVirtualLiveRewards(foundVL);
                const relevantRewardBoxesFromResourceBoxes = getRelevantRewardBoxes(foundVL, resourceBoxesData);
                const shouldUseCompactFallback =
                    isCompactResourceBoxServer() ||
                    !hasRewardDetailsForEveryBox(resourceBoxRewards, relevantRewardBoxesFromResourceBoxes);
                const compactResourceBoxDetails = await fetchOptionalMasterData<ICompactResourceBoxDetails | null>(
                    shouldUseCompactFallback,
                    "compactResourceBoxDetails.json",
                    null
                );
                const relevantRewardBoxes = mergeRewardBoxes(
                    relevantRewardBoxesFromResourceBoxes,
                    getRelevantRewardBoxesFromCompact(foundVL, compactResourceBoxDetails)
                );
                const rewardResourceTypes = collectRewardResourceTypes(relevantRewardBoxes);
                const [
                    materialsData,
                    stampsData,
                    honorsData,
                    honorGroupsData,
                    boostItemsData,
                    virtualLiveTransitionItemsData,
                ] = await Promise.all([
                    fetchOptionalMasterRows<IMaterialInfo>(rewardResourceTypes.has("material"), "materials.json"),
                    fetchOptionalMasterRows<IStampInfo>(rewardResourceTypes.has("stamp"), "stamps.json"),
                    fetchOptionalMasterRows<IHonorInfo>(rewardResourceTypes.has("honor"), "honors.json"),
                    fetchOptionalMasterRows<IHonorGroup>(rewardResourceTypes.has("honor"), "honorGroups.json"),
                    fetchOptionalMasterRows<IGenericRewardItem>(rewardResourceTypes.has("boost_item"), "boostItems.json"),
                    fetchOptionalMasterRows<IGenericRewardItem>(
                        rewardResourceTypes.has("virtual_live_transition_item"),
                        "virtualLiveTransitionItems.json"
                    ),
                ]);

                setVirtualLive(foundVL);
                document.title = `Moesekai - ${foundVL.name}`;
                setAllMusics(musicsData);
                setAllMusicVocals(musicVocalsData);
                setRewardResourceBoxes(relevantRewardBoxes);
                setRewardLookups({
                    materials: materialsData,
                    stamps: stampsData,
                    honors: honorsData,
                    honorGroups: honorGroupsData,
                    boostItems: boostItemsData,
                    virtualLiveTransitionItems: virtualLiveTransitionItemsData,
                });
                setError(null);
            } catch (err) {
                console.error("Error fetching virtual live:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (virtualLiveId) {
            fetchData();
        }
    }, [virtualLiveId]);

    // Fetch related event data
    useEffect(() => {
        async function fetchRelatedEvent() {
            try {
                const res = await fetch(VIRTUAL_LIVE_EVENT_MAP_URL);
                if (res.ok) {
                    const data: Record<string, IEventInfo> = await res.json();
                    const eventInfo = data[virtualLiveId.toString()];
                    setRelatedEvent(eventInfo || null);
                }
            } catch (err) {
                console.error("Error fetching related event:", err);
            }
        }
        if (virtualLiveId) {
            fetchRelatedEvent();
        }
    }, [virtualLiveId]);

    // Get setlist music info
    const setlistWithMusic = useMemo(() => {
        if (!virtualLive?.virtualLiveSetlists) return [];

        return virtualLive.virtualLiveSetlists.map(setlist => {
            if (setlist.virtualLiveSetlistType === "music" && setlist.musicVocalId) {
                const musicVocal = allMusicVocals.find(mv => mv.id === setlist.musicVocalId);
                const music = musicVocal ? allMusics.find(m => m.id === musicVocal.musicId) : null;
                return { ...setlist, music, musicVocal };
            }
            return { ...setlist, music: null, musicVocal: null };
        });
    }, [virtualLive, allMusics, allMusicVocals]);

    // Format date helper
    const formatDate = (timestamp: number) => {
        if (!mounted) return "...";
        return formatLocaleDate(timestamp, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Format short date helper
    const formatShortDate = (timestamp: number) => {
        if (!mounted) return "...";
        return formatLocaleDate(timestamp, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">{t("common.state.loading")}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !virtualLive) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">
                            {t("page.live.notFoundTitle", { id: virtualLiveId })}
                        </h2>
                        <p className="text-slate-500 mb-6">{t("page.live.notFoundDesc")}</p>
                        <Link
                            href="/live"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t("page.live.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const bannerUrl = getVirtualLiveBannerUrl(virtualLive.assetbundleName, assetSource);
    const status = getVirtualLiveStatus(virtualLive);
    const statusDisplay = VIRTUAL_LIVE_STATUS_DISPLAY[status];

    return (
        <MainLayout>
            <ImagePreviewModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                title={t("page.live.bannerDetailTitle", { name: virtualLive.name })}
                imageUrl={bannerUrl}
                alt={t("page.live.bannerDetailAlt", { name: virtualLive.name })}
                fileName={`live_${virtualLive.id}_banner.png`}
            />

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {virtualLive.id}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: VIRTUAL_LIVE_TYPE_COLORS[virtualLive.virtualLiveType as VirtualLiveType] || "#9E9E9E" }}
                        >
                            {t(`common.virtualLiveTypes.${virtualLive.virtualLiveType}`)}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: statusDisplay.color }}
                        >
                            {t("common.status." + status)}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        <TranslatedText
                            original={virtualLive.name}
                            category="virtualLive"
                            field="name"
                            originalClassName=""
                            translationClassName="block text-lg font-medium text-slate-400 mt-1"
                        />
                    </h1>
                </div>

                {/* Main Content Grid - Banner LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Banner */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-sm font-bold text-slate-600">{t("page.live.bannerTitle")}</span>
                            </div>
                            <div
                                className="relative aspect-[16/5] bg-gradient-to-br from-slate-50 to-slate-100 cursor-zoom-in"
                                onClick={() => setImageViewerOpen(true)}
                            >
                                <Image
                                    src={bannerUrl}
                                    alt={t("page.live.bannerDetailAlt", { name: virtualLive.name })}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    priority
                                />
                                <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                    {t("page.live.clickExpand")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t("page.live.basicInfo")}
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="ID" value={`#${virtualLive.id}`} />
                                <InfoRow
                                    label={t("common.field.name")}
                                    value={
                                        <TranslatedText
                                            original={virtualLive.name}
                                            category="virtualLive"
                                            field="name"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-slate-400 mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow
                                    label={t("common.field.type")}
                                    value={
                                        t(`common.virtualLiveTypes.${virtualLive.virtualLiveType}`)
                                    }
                                />
                                <InfoRow label={t("page.live.platformLabel")} value={virtualLive.virtualLivePlatform} />
                                <InfoRow label={t("page.live.startTimeLabel")} value={formatDate(virtualLive.startAt)} />
                                <InfoRow label={t("page.live.endTimeLabel")} value={formatDate(virtualLive.endAt)} />
                                <InfoRow
                                    label={t("page.live.assetNameLabel")}
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{virtualLive.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Rewards Card */}
                        {resolvedRewardBoxes.length > 0 && (
                            <VirtualLiveRewardsCard
                                rewardBoxes={resolvedRewardBoxes}
                                formatNumber={formatNumber}
                                getConditionLabel={(virtualLiveType) => getRewardConditionLabel(virtualLiveType, t)}
                                assetSource={assetSource}
                            />
                        )}

                        {/* Schedules Card */}
                        {virtualLive.virtualLiveSchedules && virtualLive.virtualLiveSchedules.length > 0 && (
                            <SchedulesCard
                                schedules={virtualLive.virtualLiveSchedules}
                                formatShortDate={formatShortDate}
                            />
                        )}

                        {/* Related Event Card */}
                        {relatedEvent && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {t("page.live.relatedEventTitle")}
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <Link href={`/events/${relatedEvent.id}`} className="block group">
                                        <div className="relative aspect-[2/1] w-full">
                                            <Image
                                                src={getEventBannerUrl(relatedEvent.assetbundleName, assetSource)}
                                                alt={relatedEvent.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                        Event #{relatedEvent.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                    <TranslatedText
                                                        original={relatedEvent.name}
                                                        category="events"
                                                        field="name"
                                                        originalClassName="truncate block"
                                                        translationClassName="text-sm font-medium text-white/90 truncate block mt-0.5"
                                                    />
                                                </h3>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Setlist Card */}
                        {setlistWithMusic.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        {t("page.live.setlistTitle", { count: setlistWithMusic.length })}
                                    </h2>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {setlistWithMusic.map((item, index) => (
                                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {item.virtualLiveSetlistType === "music" && item.music ? (
                                                        <Link
                                                            href={`/music/${item.music.id}`}
                                                            className="flex items-center gap-3 group"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0 shadow-sm">
                                                                <Image
                                                                    src={getMusicJacketUrl(item.music.assetbundleName, assetSource)}
                                                                    alt={item.music.title}
                                                                    width={40}
                                                                    height={40}
                                                                    className="w-full h-full object-cover"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 group-hover:text-miku transition-colors">
                                                                    <TranslatedText
                                                                        original={item.music.title}
                                                                        category="music"
                                                                        field="title"
                                                                        originalClassName="truncate block"
                                                                        translationClassName="text-xs text-slate-500 truncate block font-normal"
                                                                    />
                                                                </p>
                                                                <p className="text-xs text-slate-500">{t("page.live.setlistMusicLabel")}</p>
                                                            </div>
                                                        </Link>
                                                    ) : item.virtualLiveSetlistType === "mc" ? (
                                                        <div>
                                                            <p className="font-medium text-slate-700">{t("page.live.setlistMcLabel")}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{item.assetbundleName}</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-medium text-slate-700">{item.virtualLiveSetlistType}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{item.assetbundleName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.virtualLiveSetlistType === "music"
                                                    ? "bg-miku/10 text-miku"
                                                    : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                    {item.virtualLiveSetlistType === "music" ? t("page.live.setlistTypeMusic") : t("page.live.setlistTypeMc")}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <DetailPageAdCard />
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <Link
                        href="/live"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t("page.live.backToList")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

function VirtualLiveRewardsCard({
    rewardBoxes,
    formatNumber,
    getConditionLabel,
    assetSource,
}: {
    rewardBoxes: IResolvedVirtualLiveRewardBox[];
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    getConditionLabel: (virtualLiveType: string) => string;
    assetSource: ReturnType<typeof useTheme>["assetSource"];
}) {
    const { t } = useI18n();
    const totalRewards = rewardBoxes.reduce((total, box) => total + box.details.length, 0);

    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12v10H4V12m16 0H4m16 0h1V8h-5.5M4 12H3V8h5.5m7 0H12m3.5 0C17 6.5 17 4 15 4s-3 2-3 4m3.5 0H12m-3.5 0H12m-3.5 0C7 6.5 7 4 9 4s3 2 3 4" />
                    </svg>
                    {t("page.live.rewardsTitle", { count: totalRewards })}
                </h2>
            </div>
            <div className="divide-y divide-slate-100">
                {rewardBoxes.map((box) => (
                    <div key={`${box.reward.virtualLiveType}-${box.reward.resourceBoxId}`} className="p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center rounded-full bg-miku/10 px-2.5 py-1 text-xs font-bold text-miku">
                                {getConditionLabel(box.reward.virtualLiveType)}
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                                {t("page.live.rewardBoxLabel", { id: box.reward.resourceBoxId })}
                            </span>
                        </div>

                        {box.details.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {box.details.map((detail) => (
                                    <VirtualLiveRewardItem
                                        key={detail.key}
                                        detail={detail}
                                        formatNumber={formatNumber}
                                        assetSource={assetSource}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                                {t("page.live.rewardEmpty")}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function VirtualLiveRewardItem({
    detail,
    formatNumber,
    assetSource,
}: {
    detail: IResolvedVirtualLiveReward;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    assetSource: ReturnType<typeof useTheme>["assetSource"];
}) {
    const { t } = useI18n();
    const showQuantity = detail.quantity > 1 || detail.resourceType === "coin" || detail.resourceType === "jewel" || detail.resourceType === "virtual_coin";
    const content = (
        <>
            <VirtualLiveRewardThumbnail detail={detail} assetSource={assetSource} />
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-slate-800 group-hover:text-miku transition-colors">
                    {detail.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {detail.subtitle && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {detail.subtitle}
                        </span>
                    )}
                    {typeof detail.resourceId === "number" && (
                        <span className="font-mono text-[10px] text-slate-400">ID: {detail.resourceId}</span>
                    )}
                    {showQuantity && (
                        <span className="rounded bg-miku/10 px-1.5 py-0.5 text-[10px] font-bold text-miku">
                            {t("page.live.rewardQuantity", { count: formatNumber(detail.quantity) })}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const className = "group flex min-h-[84px] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition-all hover:border-miku/40 hover:bg-white hover:shadow-sm";

    return detail.linkHref ? (
        <Link href={detail.linkHref} className={className}>
            {content}
        </Link>
    ) : (
        <div className={className}>
            {content}
        </div>
    );
}

function VirtualLiveRewardThumbnail({
    detail,
    assetSource,
}: {
    detail: IResolvedVirtualLiveReward;
    assetSource: ReturnType<typeof useTheme>["assetSource"];
}) {
    if (detail.honor) {
        return (
            <div className="w-32 shrink-0">
                <DegreeImage
                    honor={detail.honor}
                    honorGroup={detail.honorGroup}
                    honorLevel={detail.resourceLevel || detail.honor.levels[0]?.level}
                    source={assetSource}
                />
            </div>
        );
    }

    if (detail.imageUrl) {
        return (
            <div className="relative h-14 w-14 shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <Image
                    src={detail.imageUrl}
                    alt={detail.name}
                    fill
                    sizes="56px"
                    className="object-contain p-1.5"
                    unoptimized
                />
            </div>
        );
    }

    return (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-slate-400 shadow-sm ring-1 ring-slate-200">
            {detail.typeLabel.slice(0, 2).toUpperCase()}
        </div>
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 font-bold text-right max-w-[60%]">{value}</span>
        </div>
    );
}

// Schedules Card Component with expandable list
interface ISchedule {
    id: number;
    seq: number;
    startAt: number;
    endAt: number;
}

function SchedulesCard({ schedules, formatShortDate }: { schedules: ISchedule[], formatShortDate: (ts: number) => string }) {
    const { t } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);

    const firstSchedule = schedules[0];
    const lastSchedule = schedules[schedules.length - 1];
    const middleSchedules = schedules.slice(1, -1);
    const hasMiddleSchedules = middleSchedules.length > 0;

    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {t("page.live.schedulesTitle", { count: schedules.length })}
                </h2>
            </div>
            <div className="p-4 space-y-3">
                {/* First Schedule */}
                <div className="p-3 bg-miku/5 rounded-xl border border-miku/20">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-miku">{t("page.live.scheduleFirst")}</span>
                        <span className="text-xs text-slate-500">{t("page.live.scheduleSeq", { seq: firstSchedule.seq })}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-700">
                        {formatShortDate(firstSchedule.startAt)}
                    </div>
                    <div className="text-xs text-slate-400">
                        ~ {formatShortDate(firstSchedule.endAt)}
                    </div>
                </div>

                {/* Middle Schedules (Collapsible) */}
                {hasMiddleSchedules && (
                    <>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm text-slate-600"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {isExpanded ? t("page.live.scheduleMiddleCollapse") : t("page.live.scheduleMiddleExpand", { count: middleSchedules.length })}
                        </button>

                        {isExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                {middleSchedules.map((schedule) => (
                                    <div key={schedule.id} className="p-2 bg-slate-50 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-0.5">{t("page.live.scheduleSeq", { seq: schedule.seq })}</div>
                                        <div className="text-xs font-medium text-slate-700">
                                            {formatShortDate(schedule.startAt)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Last Schedule (if different from first) */}
                {schedules.length > 1 && (
                    <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-orange-600">{t("page.live.scheduleLast")}</span>
                            <span className="text-xs text-slate-500">{t("page.live.scheduleSeq", { seq: lastSchedule.seq })}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-700">
                            {formatShortDate(lastSchedule.startAt)}
                        </div>
                        <div className="text-xs text-slate-400">
                            ~ {formatShortDate(lastSchedule.endAt)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
