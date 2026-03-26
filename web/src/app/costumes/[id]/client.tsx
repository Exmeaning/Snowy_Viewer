"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { getCostumeThumbnailUrl, getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES, ICardInfo, isTrainableCard } from "@/types/types";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { TranslatedText } from "@/components/common/TranslatedText";
import {
    ICostumeInfo,
    IMoeCostumeData,
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES,
} from "@/types/costume";
import { fetchMasterData } from "@/lib/fetch";

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
    const { setDetailName } = useBreadcrumb();

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
            const label = PART_TYPE_NAMES[item.partType] || item.partType;
            if (item.characterId) {
                types.add(`${label} (专属)`);
            } else {
                types.add(label);
            }
        });
        return Array.from(types).sort();
    }, [displayItems]);

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
        return representative.gender === "female" ? "女性" : "男性";
    }, [representative]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
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
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">服装 {costumeNumber} 未找到</h2>
                        <p className="text-slate-500 mb-6">该服装可能尚未收录</p>
                        <Link
                            href="/costumes"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回服装图鉴
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
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500">
                            No. {costumeNumber}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${representative.costume3dRarity === "rare"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                            }`}>
                            {RARITY_NAMES[representative.costume3dRarity] || representative.costume3dRarity}
                        </span>
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-miku/10 text-miku">
                            {SOURCE_NAMES[representative.source] || representative.source}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        <TranslatedText
                            original={representative.name}
                            category="costumes"
                            field="name"
                            originalClassName=""
                            translationClassName="block text-lg font-medium text-slate-400 mt-1"
                        />
                    </h1>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Visuals */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                            {/* Grid of Parts */}
                            <div className="grid grid-cols-4 gap-0.5 bg-slate-100">
                                {displayItems.map((item) => {
                                    let assetName = item.id;

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
                                        <div key={item.id} className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-2 group">
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
                                                <span className="self-start px-1.5 py-0.5 bg-white/90 backdrop-blur text-[9px] font-bold text-slate-600 rounded shadow-sm">
                                                    {PART_TYPE_NAMES[item.partType] || item.partType}
                                                </span>
                                            </div>

                                            {/* Character icon for extraParts items */}
                                            {item.characterId && (
                                                <div className="absolute top-1 right-1 w-6 h-6 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm z-10" title={CHARACTER_NAMES[item.characterId] || ""}>
                                                    <Image
                                                        src={getCharacterIconUrl(item.characterId)}
                                                        alt={CHARACTER_NAMES[item.characterId] || ""}
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
                                    <div className="col-span-4 aspect-[4/1] flex items-center justify-center text-slate-400 text-sm">
                                        暂无部件数据
                                    </div>
                                )}
                            </div>

                            {/* Color Selector */}
                            {availableColors.length > 1 && (
                                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 mb-2">配色方案</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableColors.map(variant => {
                                            const isSelected = selectedColorId === variant.colorId;
                                            return (
                                                <button
                                                    key={variant.colorId}
                                                    onClick={() => setSelectedColorId(variant.colorId)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${isSelected
                                                        ? "bg-miku/10 text-miku border-2 border-miku"
                                                        : "bg-white text-slate-600 border border-slate-200 hover:border-miku/50"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded overflow-hidden bg-slate-100 relative shrink-0">
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
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    服装信息
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="编号" value={`#${costumeNumber}`} />
                                <InfoRow
                                    label="名称"
                                    value={
                                        <TranslatedText
                                            original={representative.name}
                                            category="costumes"
                                            field="name"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-slate-400 mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow label="类型" value={representative.costume3dType} />
                                <InfoRow label="来源" value={
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${representative.source === "card" ? "bg-blue-100 text-blue-600" :
                                        representative.source === "shop" ? "bg-green-100 text-green-600" :
                                            "bg-amber-100 text-amber-600"
                                        }`}>
                                        {SOURCE_NAMES[representative.source] || representative.source}
                                    </span>
                                } />
                                <InfoRow label="稀有度" value={
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${representative.costume3dRarity === "rare"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                                        }`}>
                                        {RARITY_NAMES[representative.costume3dRarity] || representative.costume3dRarity}
                                    </span>
                                } />
                                <InfoRow label="性别" value={displayGender} />
                                {representative.designer && representative.designer !== "-" && (
                                    <InfoRow label="设计者" value={t("costumes", "designer", representative.designer) || representative.designer} />
                                )}
                                <InfoRow label="发布时间" value={
                                    mounted && representative.publishedAt
                                        ? new Date(representative.publishedAt).toLocaleDateString("zh-CN", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })
                                        : representative.publishedAt ? "..." : "未知"
                                } />
                            </div>
                        </div>

                        {/* Parts List Summary */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-500/10 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    包含部件
                                </h2>
                            </div>
                            <div className="p-5 flex flex-wrap gap-2">
                                {includedPartTypes.map(tag => (
                                    <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-xs font-medium text-slate-600 border border-slate-200">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Available Characters Card */}
                        {representative.characterIds && representative.characterIds.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        可穿戴角色
                                        <span className="text-xs font-normal text-slate-400 ml-1">
                                            ({representative.characterIds.length})
                                        </span>
                                    </h2>
                                </div>
                                <div className="p-5">
                                    <div className="flex flex-wrap gap-2">
                                        {representative.characterIds
                                            .filter(charId => charId <= 26)
                                            .map(charId => (
                                                <div
                                                    key={charId}
                                                    className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-full"
                                                    title={CHARACTER_NAMES[charId] || `Character ${charId}`}
                                                >
                                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-white ring-1 ring-slate-200">
                                                        <Image
                                                            src={getCharacterIconUrl(charId)}
                                                            alt={CHARACTER_NAMES[charId] || `Character ${charId}`}
                                                            width={32}
                                                            height={32}
                                                            className="w-full h-full object-cover"
                                                            unoptimized
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-700 pr-1">
                                                        {CHARACTER_NAMES[charId] || `#${charId}`}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Related Cards */}
                        {relatedCards.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-500/10 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        关联卡牌
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
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => {
                            router.back();
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        返回服装图鉴
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
            <span className="text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 font-bold text-right max-w-[60%]">{value}</span>
        </div>
    );
}
