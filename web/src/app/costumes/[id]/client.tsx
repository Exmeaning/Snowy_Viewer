"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { getCostumeThumbnailUrl, getCharacterIconUrl, getCardThumbnailUrl } from "@/lib/assets";
import { CHARACTER_NAMES, UNIT_DATA, ICardInfo, getRarityNumber } from "@/types/types";
import {
    ICostumeInfo,
    ISnowyCostumesData,
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES,
} from "@/types/costume";
import { fetchMasterData } from "@/lib/fetch";

// Unit icon mapping for Miku sub-filter
const UNIT_ICONS: Record<string, string> = {
    "vs": "vs.webp",
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
};

// Local attribute icon mapping
const LOCAL_ATTR_ICONS: Record<string, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

// Helper to extract base name (remove _XX color suffix)
function getVariantBaseName(assetName: string): string {
    return assetName.replace(/_\d+$/, "");
}

// VS Suffix Logic helpers
const VS_SUFFIX_MAP: Record<number, number> = {
    // Miku Variants -> All map to Miku (21)
    21: 21, 22: 21, 23: 21, 24: 21, 25: 21, 26: 21,
    // Other VS -> Specific Characters
    27: 22, // Rin
    28: 23, // Len
    29: 24, // Luka
    30: 25, // MEIKO
    31: 26  // KAITO
};

const MIKU_UNIT_MAP: Record<number, string> = {
    21: "vs",
    22: "ln",
    23: "mmj",
    24: "vbs",
    25: "ws",
    26: "25ji"
};

// Helper to extract character info from asset name
function getCharacterInfoFromAsset(assetName: string): { characterId: number | null; unit?: string } {
    // Matches _01, _26 at the end of string
    const match = assetName.match(/_(\d+)$/);
    if (match) {
        const rawId = parseInt(match[1], 10);
        // Check if it's a special VS suffix
        if (VS_SUFFIX_MAP[rawId]) {
            return {
                characterId: VS_SUFFIX_MAP[rawId],
                unit: rawId >= 21 && rawId <= 26 ? MIKU_UNIT_MAP[rawId] : undefined
            };
        }
        return { characterId: rawId };
    }
    return { characterId: null };
}

interface DisplayItem {
    id: string;
    partType: string;
    baseAssetName: string;
    costume: ICostumeInfo;
    // If strictMode is true, this item ONLY displays the specfic asset variant found during splitting
    strictAsset?: string;
    // For special groups: associated character ID if found
    characterId?: number;
    unit?: string;
}

// Helper to build entry
const build_entry = (
    partType: string,
    partData: { assetbundleName: string; colorId: number; colorName: string },
    baseInfo: ICostumeInfo,
    selectedCharacterId: number | null,
    selectedMikuUnit: string | null
): DisplayItem | null => {
    const { assetbundleName } = partData;
    const info = getCharacterInfoFromAsset(assetbundleName);

    // Special group filtering logic
    if (selectedCharacterId !== null) {
        if (info.characterId && info.characterId !== selectedCharacterId) return null;
        if (selectedCharacterId === 21 && selectedMikuUnit && info.unit && info.unit !== selectedMikuUnit) return null;
    }

    return {
        id: assetbundleName,
        partType,
        baseAssetName: getVariantBaseName(assetbundleName),
        costume: baseInfo, // Base info is the whole group now
        strictAsset: assetbundleName,
        characterId: info.characterId || undefined,
        unit: info.unit
    };
};

export default function CostumeDetailClient() {
    const params = useParams();
    const router = useRouter();
    const groupId = Number(params.id);
    const { assetSource } = useTheme();

    // Now groupCostumes is a single ICostumeInfo object because the JSON structure is grouped
    const [costumeGroup, setCostumeGroup] = useState<ICostumeInfo | null>(null);
    const [relatedCards, setRelatedCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Single unified color selection for standard groups
    const [selectedColorId, setSelectedColorId] = useState<number>(1);
    // Character selection for special groups
    const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
    // Miku Unit selection (special sub-filter)
    const [selectedMikuUnit, setSelectedMikuUnit] = useState<string | null>(null);

    // Check if this is a special group (Default Costumes) that needs per-character breakdown
    const isSpecialGroup = groupId === 1 || groupId === 201;

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const data = await fetchMasterData<ISnowyCostumesData>("snowy_costumes.json");
                const allCostumes = data.costumes || [];
                // Find the group directly
                const group = allCostumes.find(c => c.costume3dGroupId === groupId);

                if (!group) {
                    throw new Error(`Costume group ${groupId} not found`);
                }
                setCostumeGroup(group);

                // Set page title
                document.title = `Snowy SekaiViewer - ${group.name}`;

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
        if (groupId) {
            fetchData();
        }
    }, [groupId]);

    // Available Characters in this group (for special groups)
    const availableCharacters = useMemo(() => {
        if (!isSpecialGroup || !costumeGroup) return [];
        const chars = new Set<number>();

        // Iterate all parts to find characters
        Object.values(costumeGroup.parts).forEach(partList => {
            partList.forEach(part => {
                const info = getCharacterInfoFromAsset(part.assetbundleName);
                if (info.characterId) chars.add(info.characterId);
            });
        });

        return Array.from(chars).sort((a, b) => a - b);
    }, [costumeGroup, isSpecialGroup]);

    // Initialize selected character for special groups
    useEffect(() => {
        if (isSpecialGroup && availableCharacters.length > 0 && selectedCharacterId === null) {
            setSelectedCharacterId(availableCharacters[0]);
        }
    }, [isSpecialGroup, availableCharacters, selectedCharacterId]);

    // Identification of all display items
    const displayItems = useMemo(() => {
        if (!costumeGroup) return [];
        const items: DisplayItem[] = [];

        if (isSpecialGroup) {
            // SPECIAL LOGIC: Treat everything as individual items
            if (selectedCharacterId === null && availableCharacters.length > 0) return []; // Wait for selection

            // Iterate parts
            Object.entries(costumeGroup.parts).forEach(([partType, partList]) => {
                partList.forEach(part => {
                    const item = build_entry(partType, part, costumeGroup, selectedCharacterId, selectedMikuUnit);
                    if (item) items.push(item);
                });
            });

            // Sort: Body -> Hair -> Head -> Others
            return items.sort((a, b) => {
                const getPartScore = (p: string) => {
                    if (p === "body") return 1;
                    if (p === "hair") return 2;
                    if (p === "head") return 3;
                    return 4;
                };
                return getPartScore(a.partType) - getPartScore(b.partType);
            });

        } else {
            // STANDARD LOGIC
            // Flatten all parts
            const allParts: Array<{ partType: string; part: { assetbundleName: string; colorId: number; colorName: string } }> = [];
            Object.entries(costumeGroup.parts).forEach(([partType, partList]) => {
                partList.forEach(part => {
                    allParts.push({ partType, part });
                });
            });

            // Group by Part Type + Base Name
            // Key: `${partType}-${baseName}`
            const groups = new Map<string, typeof allParts>();

            allParts.forEach(item => {
                // Deduplication logic: (partType, assetbundleName)
                // Actually the "Groups" here are for bundling color variants
                const base = getVariantBaseName(item.part.assetbundleName);
                const key = `${item.partType}-${base}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
            });

            // Process groups
            groups.forEach((groupItems, key) => {
                // Check collision
                const colorIds = new Set<number>();
                let hasCollision = false;
                for (const item of groupItems) {
                    if (colorIds.has(item.part.colorId)) {
                        hasCollision = true; // Use old logic if collision
                        break;
                    }
                    colorIds.add(item.part.colorId);
                }

                if (hasCollision) {
                    groupItems.forEach(item => {
                        items.push({
                            id: item.part.assetbundleName,
                            partType: item.partType,
                            baseAssetName: item.part.assetbundleName,
                            costume: costumeGroup,
                            strictAsset: item.part.assetbundleName
                        });
                    });
                } else {
                    // Merge
                    const representative = groupItems[0];
                    const baseAssetName = getVariantBaseName(representative.part.assetbundleName);
                    items.push({
                        id: key,
                        partType: representative.partType,
                        baseAssetName: baseAssetName,
                        costume: costumeGroup
                    });
                }
            });

            // Sort
            return items.sort((a, b) => {
                const getScore = (item: DisplayItem) => {
                    const part = item.partType;
                    if (part === "body") return 1;
                    if (part === "hair") return 2;
                    if (part === "head") {
                        if (item.baseAssetName.includes("unique")) return 4;
                        return 3;
                    }
                    return 5;
                };
                return getScore(a) - getScore(b);
            });
        }
    }, [costumeGroup, isSpecialGroup, selectedCharacterId, selectedMikuUnit, availableCharacters]);

    // Deduplicated list of included parts
    const includedPartTypes = useMemo(() => {
        const types = new Set<string>();
        displayItems.forEach(item => {
            const label = PART_TYPE_NAMES[item.partType] || item.partType;
            if (item.baseAssetName.includes("unique")) {
                types.add(`${label} (特殊)`);
            } else {
                types.add(label);
            }
        });
        return Array.from(types).sort();
    }, [displayItems]);

    // Available color variants (Distinct by colorId) - Only for standard groups
    const availableColors = useMemo(() => {
        if (isSpecialGroup || !costumeGroup) return [];

        const uniqueColors = new Map<number, { colorId: number; colorName: string; assetbundleName: string }>();

        // Iterate parts to find colors
        Object.values(costumeGroup.parts).forEach(partList => {
            partList.forEach(part => {
                if (!uniqueColors.has(part.colorId)) {
                    uniqueColors.set(part.colorId, part);
                }
            });
        });

        return Array.from(uniqueColors.values()).sort((a, b) => a.colorId - b.colorId);
    }, [costumeGroup, isSpecialGroup]);

    // Representative is just the group itself now
    const representative = costumeGroup;

    // Override Gender Display
    const displayGender = useMemo(() => {
        if (!representative) return "";
        if (groupId === 1) return "女性";
        if (groupId === 201) return "男性";
        return representative.gender === "female" ? "女性" : "男性";
    }, [groupId, representative]);

    if (isLoading) {
        return (
            <MainLayout activeNav="服装">
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
            <MainLayout activeNav="服装">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">服装 {groupId} 未找到</h2>
                        <p className="text-slate-500 mb-6">该服装组可能尚未收录</p>
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
        <MainLayout activeNav="服装">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/costumes" className="text-slate-500 hover:text-miku transition-colors">
                                服装
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            {representative.name}
                        </li>
                    </ol>
                </nav>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500">
                            Group ID: {groupId}
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
                        {representative.name}
                    </h1>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Visuals */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                            {/* Grid of Parts - UPDATED TO 4 COLUMNS */}
                            <div className="grid grid-cols-4 gap-0.5 bg-slate-100">
                                {displayItems.map((item) => {
                                    // Determine asset name to display
                                    // Default to item.id (which is usually assetbundleName in new logic)
                                    let assetName = item.id;

                                    // If strict mode or special group, item.id IS the asset name
                                    if (item.strictAsset) {
                                        assetName = item.strictAsset;
                                    } else if (!isSpecialGroup) {
                                        // Combined mode: Need to find the specific variant for selectedColorId
                                        // The item represents a "Base Group" (e.g. Body part)
                                        // We need to look into costumeGroup.parts[item.partType] to find the one with selectedColorId
                                        // matching this base name

                                        const partList = item.costume.parts[item.partType] || [];

                                        // Find match for both BaseName and ColorId
                                        const preciseMatch = partList.find(p =>
                                            p.colorId === selectedColorId &&
                                            getVariantBaseName(p.assetbundleName) === item.baseAssetName
                                        );

                                        if (preciseMatch) {
                                            assetName = preciseMatch.assetbundleName;
                                        } else {
                                            // Fallback: Try to find ANY match for this base name (e.g. if color 2 doesn't exist for this part, show color 1)
                                            // Or maybe we shouldn't fallback to different color? 
                                            // Use item.id (key) which is usually the FIRST one found in group logic
                                            // But item.id might be complex key. 
                                            // Item.baseAssetName is the safe fallback base. 
                                            // Let's try to find any part with this base
                                            const anyMatch = partList.find(p => getVariantBaseName(p.assetbundleName) === item.baseAssetName);
                                            if (anyMatch) assetName = anyMatch.assetbundleName;
                                        }
                                    }

                                    return (
                                        <div key={item.id} className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-2 group">
                                            {/* Container */}
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

                                            {/* Special Group: Unit Icon Overlay (if Miku) or Character Icon Overlay */}
                                            {isSpecialGroup && item.unit && (
                                                <div className="absolute top-1 right-1 w-6 h-6 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm z-10" title={item.unit}>
                                                    <Image
                                                        src={`/data/icon/${UNIT_ICONS[item.unit]}`}
                                                        alt={item.unit}
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
                                {displayItems.length === 0 && isSpecialGroup && (
                                    <div className="col-span-4 aspect-[4/1] flex items-center justify-center text-slate-400 text-sm">
                                        该角色暂无部件或未选择团体
                                    </div>
                                )}
                            </div>

                            {/* Character Selector (For Special Groups) */}
                            {isSpecialGroup && availableCharacters.length > 0 && (
                                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold text-slate-500">选择角色</p>
                                        <span className="text-xs font-bold text-miku">
                                            {CHARACTER_NAMES[selectedCharacterId!] || ""}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {availableCharacters.map(charId => {
                                            const isSelected = selectedCharacterId === charId;
                                            return (
                                                <button
                                                    key={charId}
                                                    onClick={() => {
                                                        setSelectedCharacterId(charId);
                                                        setSelectedMikuUnit(null); // Reset unit filter when switching char
                                                    }}
                                                    className={`w-10 h-10 rounded-full overflow-hidden transition-all ${isSelected
                                                        ? "ring-2 ring-miku scale-110"
                                                        : "ring-1 ring-slate-200 grayscale opacity-70 hover:grayscale-0 hover:opacity-100"
                                                        }`}
                                                    title={CHARACTER_NAMES[charId]}
                                                >
                                                    <Image
                                                        src={getCharacterIconUrl(charId)}
                                                        alt={CHARACTER_NAMES[charId] || "Chara"}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Miku Unit Selector (Sub-filter) */}
                                    {selectedCharacterId === 21 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/60">
                                            <p className="text-xs font-bold text-slate-500 mb-2">选择团体 (Miku)</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => setSelectedMikuUnit(null)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedMikuUnit === null
                                                        ? "bg-miku text-white border-miku"
                                                        : "bg-white text-slate-500 border-slate-200 hover:border-miku"
                                                        }`}
                                                >
                                                    全部
                                                </button>
                                                {Object.entries(UNIT_ICONS).map(([unitKey, iconFile]) => (
                                                    <button
                                                        key={unitKey}
                                                        onClick={() => setSelectedMikuUnit(unitKey === selectedMikuUnit ? null : unitKey)}
                                                        className={`w-8 h-8 rounded-lg overflow-hidden border transition-all ${selectedMikuUnit === unitKey
                                                            ? "ring-2 ring-miku border-miku"
                                                            : "border-slate-200 opacity-70 hover:opacity-100"
                                                            }`}
                                                        title={unitKey}
                                                    >
                                                        <Image
                                                            src={`/data/icon/${iconFile}`}
                                                            alt={unitKey}
                                                            width={32}
                                                            height={32}
                                                            className="w-full h-full object-contain"
                                                            unoptimized
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Color Selector (For Standard Groups) */}
                            {!isSpecialGroup && availableColors.length > 0 && (
                                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 mb-2">配色方案</p>
                                    <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 custom-scrollbar">
                                        {availableColors.map(variant => {
                                            const isSelected = selectedColorId === variant.colorId;
                                            return (
                                                <button
                                                    key={variant.colorId} // Unique key based on colorId (deduplicated)
                                                    onClick={() => setSelectedColorId(variant.colorId)}
                                                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${isSelected
                                                        ? "bg-miku/10 text-miku ring-2 ring-miku"
                                                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-miku/50"
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
                                                    {variant.colorName}
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
                                <InfoRow label="组 ID" value={`#${groupId}`} />
                                <InfoRow label="名称" value={representative.name} />
                                <InfoRow label="类型" value={representative.costume3dType} />
                                <InfoRow label="来源" value={
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${representative.source === "card" ? "bg-blue-100 text-blue-600" :
                                        representative.source === "shop" ? "bg-green-100 text-green-600" :
                                            representative.source === "default" ? "bg-slate-100 text-slate-500" :
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
                                    <InfoRow label="设计者" value={representative.designer} />
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
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded select-all">
                                        {representative.costumePrefix}
                                    </span>}
                                />
                            </div>
                        </div>

                        {/* Parts List Summary (Simplified) */}
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
                                        {relatedCards.map(card => {
                                            const rarityNum = getRarityNumber(card.cardRarityType as any);
                                            const attrIcon = LOCAL_ATTR_ICONS[card.attr] || LOCAL_ATTR_ICONS.cool;

                                            return (
                                                <Link
                                                    key={card.id}
                                                    href={`/cards/${card.id}`}
                                                    className="group relative w-16 h-16 rounded-lg overflow-hidden ring-1 ring-slate-200 hover:ring-blue-400 hover:shadow-md transition-all block"
                                                    title={`Card #${card.id} - ${card.prefix}`}
                                                >
                                                    <Image
                                                        src={getCardThumbnailUrl(card.characterId, card.assetbundleName, true, assetSource)}
                                                        alt={card.prefix}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />

                                                    {/* Attribute Badge - Top Left */}
                                                    <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 drop-shadow-md z-10">
                                                        <Image
                                                            src={attrIcon}
                                                            alt={card.attr}
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>

                                                    {/* Rarity & Star - Top Right (Simplified for small thumbnail) or Bottom? 
                                                       User requested "Corresponding Star Rating".
                                                       In events/[id] it is top-right for rarity number and stars.
                                                       Given 64x64 size, let's put it at the bottom or top-right.
                                                       Events uses: top-right for number + star icon.
                                                    */}
                                                    <div className="absolute top-0.5 right-0.5 z-10">
                                                        <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[12px]">
                                                            {card.cardRarityType === "rarity_birthday" ? (
                                                                <div className="w-2.5 h-2.5 relative">
                                                                    <Image
                                                                        src="/data/icon/birthday.webp"
                                                                        alt="Birthday"
                                                                        fill
                                                                        className="object-contain"
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="text-white text-[7px] font-bold leading-none">{rarityNum}</span>
                                                                    <div className="w-2 h-2 relative">
                                                                        <Image
                                                                            src="/data/icon/star.webp"
                                                                            alt="Star"
                                                                            fill
                                                                            className="object-contain"
                                                                            unoptimized
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Back Button */}
                {/* Back Button */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => {
                            // Strictly mirror mysekai behavior for correct scroll restoration
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
