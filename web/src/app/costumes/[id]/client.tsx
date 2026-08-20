"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { useI18n } from "@/contexts/I18nContext";
import { getCostumeThumbnailUrl, getCharacterIconUrl } from "@/lib/assets";
import { ICardInfo, isTrainableCard } from "@/types/types";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { TranslatedText } from "@/components/common/TranslatedText";
import {
    ICostumeInfo,
    IMoeCostumeData,
    PART_TYPE_LABEL_KEYS,
    SOURCE_LABEL_KEYS,
    RARITY_LABEL_KEYS,
} from "@/types/costume";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterName } from "@/lib/i18n";

// Helper to extract base name (remove _XX color suffix)
function getVariantBaseName(assetName: string): string {
    return assetName.replace(/_\d+$/, "");
}

// Part sort score
function getPartScore(partType: string): number {
    if (partType === "body") return 1;
    if (partType === "hair") return 2;
    if (partType === "head") return 3;
    return 4;
}

interface DisplayItem {
    id: string;
    partType: string;
    baseAssetName: string;
    // If set, display this exact asset (no color switching)
    strictAsset?: string;
    // For extraParts items: associated character ID
    characterId?: number;
}

export default function CostumeDetailClient() {
    const params = useParams();
    const router = useRouter();
    const costumeNumber = Number(params.id);
    const { assetSource, useTrainedThumbnail } = useTheme();
    const { t } = useTranslation();
    const { t: tI18n, formatDate } = useI18n();
    const { setDetailName } = useBreadcrumb();
    const translateWithFallback = useCallback((key: string | undefined, fallback: string) => {
        if (!key) return fallback;
        const label = tI18n(key);
        return label === key ? fallback : label;
    }, [tI18n]);

    const [costumeGroup, setCostumeGroup] = useState<ICostumeInfo | null>(null);
    const [relatedCards, setRelatedCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Unified color selection for standard parts
    const [selectedColorId, setSelectedColorId] = useState<number>(1);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const data = await fetchMasterData<IMoeCostumeData>("moe_costume.json");
                const allCostumes = data.costumes || [];
                const group = allCostumes.find(c => c.costumeNumber === costumeNumber);

                if (!group) {
                    throw new Error(`Costume ${costumeNumber} not found`);
                }
                setCostumeGroup(group);

                // Set page title
                const translatedName = t("costumes", "name", group.name);
                document.title = `Moesekai - ${translatedName || group.name}`;

                // Fetch Related Cards if any
                if (group.cardIds && group.cardIds.length > 0) {
                    try {
                        const allCards = await fetchMasterData<ICardInfo[]>("cards.json");
                        const cards = allCards.filter(c => group.cardIds?.includes(c.id));
                        setRelatedCards(cards);
                    } catch (e) {
                        console.error("Error fetching related cards", e);
                    }
                }

                setError(null);
            } catch (err) {
                console.error("Error fetching costume:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (costumeNumber) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [costumeNumber]);

    // Build display items from shared parts + extraParts
    const displayItems = useMemo(() => {
        if (!costumeGroup) return [];
        const items: DisplayItem[] = [];

        // 1. Shared parts — support color switching
        Object.entries(costumeGroup.parts).forEach(([partType, partList]) => {
            // Group by base name to merge color variants
            const groups = new Map<string, typeof partList>();
            partList.forEach(part => {
                const base = getVariantBaseName(part.assetbundleName);
                const key = `${partType}-${base}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(part);
            });

            groups.forEach((groupItems, key) => {
                // Check for colorId collision
                const colorIds = new Set<number>();
                let hasCollision = false;
                for (const item of groupItems) {
                    if (colorIds.has(item.colorId)) { hasCollision = true; break; }
                    colorIds.add(item.colorId);
                }

                if (hasCollision) {
                    // Collision: show each variant individually
                    groupItems.forEach(item => {
                        items.push({
                            id: item.assetbundleName,
                            partType,
                            baseAssetName: item.assetbundleName,
                            strictAsset: item.assetbundleName,
                        });
                    });
                } else {
                    // Merge color variants
                    const base = getVariantBaseName(groupItems[0].assetbundleName);
                    items.push({
                        id: key,
                        partType,
                        baseAssetName: base,
                    });
                }
            });
        });

        // 2. Extra parts — character-specific, show individually
        if (costumeGroup.extraParts) {
            costumeGroup.extraParts.forEach(ep => {
                ep.variants.forEach(variant => {
                    items.push({
                        id: `extra-${ep.characterId}-${variant.assetbundleName}`,
                        partType: ep.partType,
                        baseAssetName: variant.assetbundleName,
                        strictAsset: variant.assetbundleName,
                        characterId: ep.characterId,
                    });
                });
            });
        }

        // Sort: body → hair → head → others, extraParts after shared
        return items.sort((a, b) => {
            const scoreA = getPartScore(a.partType) + (a.characterId ? 10 : 0);
            const scoreB = getPartScore(b.partType) + (b.characterId ? 10 : 0);
            return scoreA - scoreB;
        });
    }, [costumeGroup]);

    // Deduplicated list of included part types
    const includedPartTypes = useMemo(() => {
        const types = new Set<string>();
        displayItems.forEach(item => {
            const label = translateWithFallback(PART_TYPE_LABEL_KEYS[item.partType], item.partType);
            if (item.characterId) {
                types.add(tI18n("page.costumes.extraPartTag", { label }));
            } else {
                types.add(label);
            }
        });
        return Array.from(types).sort();
    }, [displayItems, tI18n, translateWithFallback]);

    // Available color variants (from shared parts only)
    const availableColors = useMemo(() => {
        if (!costumeGroup) return [];
        const uniqueColors = new Map<number, { colorId: number; colorName: string; assetbundleName: string }>();

        Object.values(costumeGroup.parts).forEach(partList => {
            partList.forEach(part => {
                if (!uniqueColors.has(part.colorId)) {
                    uniqueColors.set(part.colorId, part);
                }
            });
        });

        return Array.from(uniqueColors.values()).sort((a, b) => a.colorId - b.colorId);
    }, [costumeGroup]);

    const representative = costumeGroup;

    // Set breadcrumb detail name
    useEffect(() => {
        if (representative) setDetailName(representative.name);
    }, [representative, setDetailName]);

    const displayGender = useMemo(() => {
        if (!representative) return "";
        return tI18n(`common.costume.genders.${representative.gender}`);
    }, [representative, tI18n]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-[var(--hh-text-secondary)]">{tI18n("page.costumes.detailLoadingFallback")}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !representative) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-500/15 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="hh-title text-2xl text-[var(--hh-text-primary)] mb-2">{tI18n("page.costumes.notFoundTitle", { id: costumeNumber })}</h2>
                        <p className="text-[var(--hh-text-secondary)] mb-6">{tI18n("page.costumes.notFoundDesc")}</p>
                        <Link
                            href="/costumes"
                            className="hh-press hh-focusable inline-flex items-center gap-2 px-6 py-3 bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] font-bold rounded-[var(--hh-radius-md)]"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {tI18n("page.costumes.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="hh-numeric inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-sm)] text-xs text-[var(--hh-text-secondary)]">
                            No. {costumeNumber}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-[var(--hh-radius-sm)] ${representative.costume3dRarity === "rare"
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"
                            }`}>
                            {translateWithFallback(RARITY_LABEL_KEYS[representative.costume3dRarity], representative.costume3dRarity)}
                        </span>
                        <span className="px-3 py-1 text-xs font-bold rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent-wash)] text-miku">
                            {translateWithFallback(SOURCE_LABEL_KEYS[representative.source], representative.source)}
                        </span>
                    </div>
                    <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)]">
                        <TranslatedText
                            original={representative.name}
                            category="costumes"
                            field="name"
                            originalClassName=""
                            translationClassName="block text-lg font-medium text-[var(--hh-text-tertiary)] mt-1"
                        />
                    </h1>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Visuals */}
                    <div>
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden lg:sticky lg:top-24">
                            {/* Grid of Parts */}
                            {/* The 0.5 gap shows this background through as the grid
                                hairlines, so it tracks the border token rather than a
                                surface one. */}
                            <div className="grid grid-cols-4 gap-0.5 bg-[var(--hh-border)]">
                                {displayItems.map((item) => {
                                    let assetName = item.id;
                                    const characterName = item.characterId ? getCharacterName(tI18n, item.characterId) : "";

                                    if (item.strictAsset) {
                                        assetName = item.strictAsset;
                                    } else {
                                        // Combined mode: find the variant matching selectedColorId
                                        const partList = costumeGroup.parts[item.partType] || [];
                                        const preciseMatch = partList.find(p =>
                                            p.colorId === selectedColorId &&
                                            getVariantBaseName(p.assetbundleName) === item.baseAssetName
                                        );
                                        if (preciseMatch) {
                                            assetName = preciseMatch.assetbundleName;
                                        } else {
                                            const anyMatch = partList.find(p => getVariantBaseName(p.assetbundleName) === item.baseAssetName);
                                            if (anyMatch) assetName = anyMatch.assetbundleName;
                                        }
                                    }

                                    return (
                                        <div key={item.id} className="relative aspect-square bg-[var(--hh-surface-sunken)] flex items-center justify-center p-2 group">
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={getCostumeThumbnailUrl(assetName, assetSource)}
                                                    alt={item.id}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>

                                            {/* Labels overlay */}
                                            <div className="absolute inset-x-0 bottom-0 p-1 flex flex-col gap-0.5 pointer-events-none">
                                                <span className="self-start px-1.5 py-0.5 bg-[var(--hh-surface-2)] border border-[var(--hh-border)] text-[9px] font-bold text-[var(--hh-text-secondary)] rounded-[var(--hh-radius-xs)]">
                                                    {translateWithFallback(PART_TYPE_LABEL_KEYS[item.partType], item.partType)}
                                                </span>
                                            </div>

                                            {/* Character icon for extraParts items */}
                                            {item.characterId && (
                                                <div className="absolute top-1 right-1 w-6 h-6 rounded-full overflow-hidden ring-1 ring-[var(--hh-border)] bg-[var(--hh-surface-2)] z-10" title={characterName}>
                                                    <Image
                                                        src={getCharacterIconUrl(item.characterId)}
                                                        alt={characterName}
                                                        width={24}
                                                        height={24}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {displayItems.length === 0 && (
                                    <div className="col-span-4 aspect-[4/1] flex items-center justify-center bg-[var(--hh-surface-sunken)] text-[var(--hh-text-tertiary)] text-sm">
                                        {tI18n("page.costumes.noPartsData")}
                                    </div>
                                )}
                            </div>

                            {/* Color Selector */}
                            {availableColors.length > 1 && (
                                <div className="p-4 bg-[var(--hh-surface-1)] border-t border-[var(--hh-border)]">
                                    <p className="hh-label mb-2">{tI18n("page.costumes.colorSchemesLabel")}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableColors.map(variant => {
                                            const isSelected = selectedColorId === variant.colorId;
                                            return (
                                                <button
                                                    key={variant.colorId}
                                                    onClick={() => setSelectedColorId(variant.colorId)}
                                                    className={`hh-press hh-focusable flex items-center gap-2 px-3 py-2 rounded-[var(--hh-radius-md)] text-xs font-medium whitespace-nowrap ${isSelected
                                                        ? "bg-[var(--hh-accent-wash)] text-miku border border-[var(--hh-accent)] ring-1 ring-[var(--hh-accent)]"
                                                        : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] border border-[var(--hh-border)] hover:bg-[var(--hh-surface-3)]"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-[var(--hh-radius-xs)] overflow-hidden bg-[var(--hh-surface-sunken)] relative shrink-0">
                                                        <Image
                                                            src={getCostumeThumbnailUrl(variant.assetbundleName, assetSource)}
                                                            alt={variant.colorName}
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                    {t("costumes", "colorName", variant.colorName) || variant.colorName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {tI18n("page.costumes.basicInfo")}
                                </h2>
                            </div>
                            <div className="divide-y divide-[var(--hh-border)]">
                                <InfoRow label={tI18n("page.costumes.fields.id")} value={`#${costumeNumber}`} />
                                <InfoRow
                                    label={tI18n("page.costumes.fields.name")}
                                    value={
                                        <TranslatedText
                                            original={representative.name}
                                            category="costumes"
                                            field="name"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-[var(--hh-text-tertiary)] mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow label={tI18n("page.costumes.fields.type")} value={representative.costume3dType} />
                                <InfoRow label={tI18n("page.costumes.fields.source")} value={
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${representative.source === "card" ? "bg-blue-500/15 text-blue-600" :
                                        representative.source === "shop" ? "bg-green-500/15 text-green-600" :
                                            "bg-amber-500/15 text-amber-600"
                                        }`}>
                                        {translateWithFallback(SOURCE_LABEL_KEYS[representative.source], representative.source)}
                                    </span>
                                } />
                                <InfoRow label={tI18n("page.costumes.fields.rarity")} value={
                                    <span className={`px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-xs font-bold ${representative.costume3dRarity === "rare"
                                        ? "bg-amber-500/15 text-amber-600"
                                        : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"
                                        }`}>
                                        {translateWithFallback(RARITY_LABEL_KEYS[representative.costume3dRarity], representative.costume3dRarity)}
                                    </span>
                                } />
                                <InfoRow label={tI18n("page.costumes.fields.gender")} value={displayGender} />
                                {representative.designer && representative.designer !== "-" && (
                                    <InfoRow label={tI18n("page.costumes.fields.designer")} value={t("costumes", "designer", representative.designer) || representative.designer} />
                                )}
                                <InfoRow label={tI18n("page.costumes.fields.publishedAt")} value={
                                    mounted && representative.publishedAt
                                        ? formatDate(representative.publishedAt, { dateStyle: "long" })
                                        : representative.publishedAt ? "..." : tI18n("page.costumes.unknownPublishedAt")
                                } />
                            </div>
                        </div>

                        {/* Parts List Summary */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    {tI18n("page.costumes.partsListTitle")}
                                </h2>
                            </div>
                            <div className="p-5 flex flex-wrap gap-2">
                                {includedPartTypes.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-3 py-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] text-xs font-medium text-[var(--hh-text-secondary)] border border-[var(--hh-border)]">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Available Characters Card */}
                        {representative.characterIds && representative.characterIds.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {tI18n("page.costumes.charactersTitle")}
                                        <span className="hh-numeric text-xs font-normal text-[var(--hh-text-tertiary)] ml-1">
                                            {tI18n("page.costumes.charactersCount", { count: representative.characterIds.length })}
                                        </span>
                                    </h2>
                                </div>
                                <div className="p-5">
                                    <div className="flex flex-wrap gap-2">
                                        {representative.characterIds
                                            .filter(charId => charId <= 26)
                                            .map(charId => {
                                                const characterName = getCharacterName(tI18n, charId);
                                                return (
                                                    <div
                                                        key={charId}
                                                        className="flex items-center gap-2 px-2 py-1.5 bg-[var(--hh-surface-sunken)] rounded-full"
                                                        title={characterName}
                                                    >
                                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--hh-surface-2)] ring-1 ring-[var(--hh-border)]">
                                                            <Image
                                                                src={getCharacterIconUrl(charId)}
                                                                alt={characterName}
                                                                width={32}
                                                                height={32}
                                                                className="w-full h-full object-cover"
                                                                unoptimized
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium text-[var(--hh-text-primary)] pr-1">
                                                            {characterName}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Related Cards */}
                        {relatedCards.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        {tI18n("page.costumes.relatedCardsTitle")}
                                    </h2>
                                </div>
                                <div className="p-5">
                                    <div className="flex flex-wrap gap-3">
                                        {relatedCards.map(card => (
                                            <Link
                                                key={card.id}
                                                href={`/cards/${card.id}`}
                                                className="block"
                                                title={`Card #${card.id} - ${card.prefix}`}
                                            >
                                                <SekaiCardThumbnail card={card} trained={[1167].includes(card.id) || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday")} width={64} />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <DetailPageAdCard />
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => {
                            router.back();
                        }}
                        className="hh-btn hh-press hh-focusable inline-flex items-center gap-2 font-bold"
                        style={{ padding: "0.75rem 1.5rem" }}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {tI18n("page.costumes.backToList")}
                    </button>
                </div>
            </div>
        </MainLayout>
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-[var(--hh-text-secondary)] font-medium">{label}</span>
            <span className="text-[var(--hh-text-primary)] font-bold text-right max-w-[60%]">{value}</span>
        </div>
    );
}
