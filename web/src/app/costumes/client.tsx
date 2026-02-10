"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection, FilterToggle } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { getCostumeThumbnailUrl, getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES, UNIT_DATA } from "@/types/types";
import {
    ICostumeInfo,
    ISnowyCostumesData,
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES,
} from "@/types/costume";
import { ICardInfo } from "@/types/types"; // Import ICardInfo
import { fetchMasterData } from "@/lib/fetch";
import { useScrollRestore } from "@/hooks/useScrollRestore";

// Unit icon mapping
const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

// ... imports remain the same

// CostumeGroup interface and groupCostumes function are removed as ICostumeInfo is now the group itself.

function CostumesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();

    const [costumes, setCostumes] = useState<ICostumeInfo[]>([]);
    const [allCards, setAllCards] = useState<ICardInfo[]>([]); // Store all cards
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPartType, setSelectedPartType] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState<string | null>(null);
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [onlyRelatedCardCostumes, setOnlyRelatedCardCostumes] = useState(false); // New filter state

    // Sort states
    const [sortBy, setSortBy] = useState<string>("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination with scroll restore
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "costumes",
        defaultDisplayCount: 48,
        increment: 48,
        isReady: !isLoading,
    });

    // Storage key
    const STORAGE_KEY = "costumes_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const partType = searchParams.get("partType");
        const source = searchParams.get("source");
        const rarity = searchParams.get("rarity");
        const gender = searchParams.get("gender");
        const chars = searchParams.get("characters");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");
        const related = searchParams.get("related"); // New param

        const hasUrlParams = partType || source || rarity || gender || chars || search || sort || order || related;

        if (hasUrlParams) {
            if (partType) setSelectedPartType(partType);
            if (source) setSelectedSource(source);
            if (rarity) setSelectedRarity(rarity);
            if (gender) setSelectedGender(gender);
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort);
            if (order) setSortOrder(order as "asc" | "desc");
            if (related) setOnlyRelatedCardCostumes(related === "true");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.partType) setSelectedPartType(filters.partType);
                    if (filters.source) setSelectedSource(filters.source);
                    if (filters.rarity) setSelectedRarity(filters.rarity);
                    if (filters.gender) setSelectedGender(filters.gender);
                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                    if (filters.onlyRelatedCardCostumes !== undefined) setOnlyRelatedCardCostumes(filters.onlyRelatedCardCostumes);
                }
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    }, []);

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        const filters = {
            partType: selectedPartType,
            source: selectedSource,
            rarity: selectedRarity,
            gender: selectedGender,
            characters: selectedCharacters,
            search: searchQuery,
            sortBy,
            sortOrder,
            onlyRelatedCardCostumes,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (selectedPartType) params.set("partType", selectedPartType);
        if (selectedSource) params.set("source", selectedSource);
        if (selectedRarity) params.set("rarity", selectedRarity);
        if (selectedGender) params.set("gender", selectedGender);
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        if (onlyRelatedCardCostumes) params.set("related", "true");

        const queryString = params.toString();
        const newUrl = queryString ? `/costumes?${queryString}` : "/costumes";
        router.replace(newUrl, { scroll: false });
    }, [selectedPartType, selectedSource, selectedRarity, selectedGender, selectedCharacters, searchQuery, sortBy, sortOrder, onlyRelatedCardCostumes, router, filtersInitialized]);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                // Parallel fetch
                const [costumeData, cardList] = await Promise.all([
                    fetchMasterData<ISnowyCostumesData>("snowy_costumes.json"),
                    fetchMasterData<ICardInfo[]>("cards.json")
                ]);

                setCostumes(costumeData.costumes || []);
                setAllCards(cardList || []);
                setError(null);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Filter and sort costumes (Use ICostumeInfo directly)
    const filteredCostumes = useMemo(() => {
        let result = [...costumes];

        // Search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.costumePrefix.toLowerCase().includes(query) ||
                c.designer.toLowerCase().includes(query)
            );
        }

        // Part type filter - Check in partTypes array
        if (selectedPartType) {
            result = result.filter(c => c.partTypes && c.partTypes.includes(selectedPartType));
        }

        // Source filter
        if (selectedSource) {
            result = result.filter(c => c.source === selectedSource);
        }

        // Rarity filter
        if (selectedRarity) {
            result = result.filter(c => c.costume3dRarity === selectedRarity);
        }

        // Gender filter
        if (selectedGender) {
            result = result.filter(c => c.gender === selectedGender);
        }

        // Character filter
        if (selectedCharacters.length > 0) {
            result = result.filter(c =>
                selectedCharacters.some(charId => c.characterIds.includes(charId))
            );
        }

        // Associated Card Filter (New) - only affects "card" source costumes
        if (onlyRelatedCardCostumes && selectedCharacters.length > 0) {
            // Filter costumes that have cardIds containing any card associated with selected characters
            const selectedCharCards = new Set(
                allCards
                    .filter(card => selectedCharacters.includes(card.characterId))
                    .map(card => card.id)
            );

            result = result.filter(c => {
                // If not a card source, always show (unless filtered by other filters)
                if (c.source !== "card") return true;

                // If it is a card source, it MUST be associated with the selected character(s)
                if (!c.cardIds || c.cardIds.length === 0) return false;
                return c.cardIds.some(cid => selectedCharCards.has(cid));
            });
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === "id") {
                return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
            }
            if (sortBy === "publishedAt") {
                return sortOrder === "asc" ? a.publishedAt - b.publishedAt : b.publishedAt - a.publishedAt;
            }
            return 0;
        });

        return result;
    }, [costumes, allCards, searchQuery, selectedPartType, selectedSource, selectedRarity, selectedGender, selectedCharacters, onlyRelatedCardCostumes, sortBy, sortOrder]);

    // No need to group anymore, costumes are already groups.
    const costumeGroups = filteredCostumes;

    // Displayed groups
    const displayedGroups = useMemo(() => {
        return costumeGroups.slice(0, displayCount);
    }, [costumeGroups, displayCount]);

    // Toggle character selection
    const toggleCharacter = (charId: number) => {
        if (selectedCharacters.includes(charId)) {
            setSelectedCharacters(selectedCharacters.filter(c => c !== charId));
        } else {
            setSelectedCharacters([...selectedCharacters, charId]);
        }
    };

    // Handle unit click
    const handleUnitClick = (unitId: string) => {
        const unit = UNIT_DATA.find(u => u.id === unitId);
        if (!unit) return;

        if (selectedUnitIds.includes(unitId)) {
            setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
            const newChars = selectedCharacters.filter(c => !unit.charIds.includes(c));
            setSelectedCharacters(newChars);
        } else {
            setSelectedUnitIds([...selectedUnitIds, unitId]);
            const newChars = [...new Set([...selectedCharacters, ...unit.charIds])];
            setSelectedCharacters(newChars);
        }
    };

    // Reset all filters
    const handleReset = () => {
        setSearchQuery("");
        setSelectedPartType(null);
        setSelectedSource(null);
        setSelectedRarity(null);
        setSelectedGender(null);
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setOnlyRelatedCardCostumes(false);
        resetDisplayCount();
    };

    const hasActiveFilters = !!(searchQuery || selectedPartType || selectedSource || selectedRarity || selectedGender || selectedCharacters.length > 0 || onlyRelatedCardCostumes);

    // Get current units for displaying characters
    const currentUnits = selectedUnitIds.length > 0
        ? UNIT_DATA.filter(u => selectedUnitIds.includes(u.id))
        : [];

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">服装图鉴</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    服装 <span className="text-miku">图鉴</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览游戏中的所有 3D 服装、发饰和发型
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24">
                        <BaseFilters
                            title="筛选服装"
                            filteredCount={costumeGroups.length}
                            totalCount={costumes.length}
                            countUnit="套"
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            searchPlaceholder="搜索服装名称、设计者..."
                            sortOptions={[
                                { id: "id", label: "ID" },
                                { id: "publishedAt", label: "发布时间" },
                            ]}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={(field, order) => {
                                setSortBy(field);
                                setSortOrder(order);
                            }}
                            hasActiveFilters={hasActiveFilters}
                            onReset={handleReset}
                        >
                            {/* Unit Selection */}
                            <FilterSection label="团体">
                                <div className="flex flex-wrap gap-2">
                                    {UNIT_DATA.map(unit => {
                                        const iconName = UNIT_ICONS[unit.id] || "";
                                        return (
                                            <button
                                                key={unit.id}
                                                onClick={() => handleUnitClick(unit.id)}
                                                className={`p-1.5 rounded-xl transition-all ${selectedUnitIds.includes(unit.id)
                                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                                    }`}
                                                title={unit.name}
                                            >
                                                <div className="w-8 h-8 relative">
                                                    <Image
                                                        src={`/data/icon/${iconName}`}
                                                        alt={unit.name}
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </FilterSection>

                            {/* Character Selection */}
                            {(currentUnits.length > 0 || selectedCharacters.length > 0) && (
                                <FilterSection label="角色">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(currentUnits.length > 0
                                            ? currentUnits.flatMap(u => u.charIds)
                                            : [...new Set(selectedCharacters)]
                                        ).map(charId => (
                                            <button
                                                key={charId}
                                                onClick={() => toggleCharacter(charId)}
                                                className={`relative transition-all ${selectedCharacters.includes(charId)
                                                    ? "ring-2 ring-miku scale-110 z-10 rounded-full"
                                                    : "ring-2 ring-transparent hover:ring-slate-200 rounded-full opacity-80 hover:opacity-100"
                                                    }`}
                                                title={CHARACTER_NAMES[charId]}
                                            >
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                                                    <Image
                                                        src={getCharacterIconUrl(charId)}
                                                        alt={CHARACTER_NAMES[charId]}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Related Card Filter Toggle */}
                                    {selectedCharacters.length > 0 && (
                                        <div className="mt-3">
                                            <FilterToggle
                                                selected={onlyRelatedCardCostumes}
                                                onClick={() => setOnlyRelatedCardCostumes(!onlyRelatedCardCostumes)}
                                                label="卡牌服装仅显示该角色关联的服装"
                                            />
                                        </div>
                                    )}
                                </FilterSection>
                            )}

                            {/* Part Type Filter */}
                            <FilterSection label="部位">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedPartType || ""}
                                    onChange={(e) => setSelectedPartType(e.target.value || null)}
                                >
                                    <option value="">全部</option>
                                    {Object.entries(PART_TYPE_NAMES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </FilterSection>

                            {/* Source Filter */}
                            <FilterSection label="来源">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedSource || ""}
                                    onChange={(e) => setSelectedSource(e.target.value || null)}
                                >
                                    <option value="">全部</option>
                                    {Object.entries(SOURCE_NAMES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </FilterSection>

                            {/* Rarity Filter */}
                            <FilterSection label="稀有度">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedRarity || ""}
                                    onChange={(e) => setSelectedRarity(e.target.value || null)}
                                >
                                    <option value="">全部</option>
                                    {Object.entries(RARITY_NAMES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </FilterSection>

                            {/* Gender Filter */}
                            <FilterSection label="性别">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedGender || ""}
                                    onChange={(e) => setSelectedGender(e.target.value || null)}
                                >
                                    <option value="">全部</option>
                                    <option value="female">女性</option>
                                    <option value="male">男性</option>
                                </select>
                            </FilterSection>

                        </BaseFilters>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {displayedGroups.map(costume => {
                                    // Use costumePrefix for image if needed. 
                                    // But typically we want to show the 'body' part or the first available part.
                                    // Let's try to find a body part or hair part to show.
                                    // OR just use costumePrefix? 
                                    // Actually getCostumeThumbnailUrl usually takes assetbundleName.
                                    // We need to pick a representative assetName. 
                                    // Let's look for "body" part, or "hair" part, or just first part.

                                    let assetName = costume.costumePrefix; // Fallback? 
                                    // Ideally find a part.
                                    let repPart;
                                    if (costume.parts["body"] && costume.parts["body"].length > 0) {
                                        repPart = costume.parts["body"][0];
                                    } else if (costume.parts["hair"] && costume.parts["hair"].length > 0) {
                                        repPart = costume.parts["hair"][0];
                                    } else if (costume.parts["head"] && costume.parts["head"].length > 0) {
                                        repPart = costume.parts["head"][0];
                                    } else {
                                        // Take first available
                                        const firstKey = Object.keys(costume.parts)[0];
                                        if (firstKey && costume.parts[firstKey].length > 0) {
                                            repPart = costume.parts[firstKey][0];
                                        }
                                    }

                                    if (repPart) {
                                        assetName = repPart.assetbundleName;
                                    }

                                    // Special case: if assetName is still costumePrefix, it might work if getCostumeThumbnailUrl handles it.
                                    // Or we assume costumePrefix IS the assetbundleName base? 

                                    return (
                                        <Link
                                            href={`/costumes/${costume.costume3dGroupId}`}
                                            key={costume.id}
                                            className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-3 flex flex-col h-full group"
                                        >
                                            <div className="relative aspect-square mb-2 bg-slate-50 rounded-lg overflow-hidden group-hover:bg-slate-100 transition-colors">
                                                <Image
                                                    src={getCostumeThumbnailUrl(assetName, assetSource)}
                                                    alt={costume.name}
                                                    fill
                                                    className="object-contain p-2"
                                                    unoptimized
                                                />
                                                {/* Rarity badge */}

                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <h3 className="font-bold text-sm text-slate-800 mb-1 group-hover:text-miku transition-colors line-clamp-2" title={costume.name}>
                                                    {costume.name}
                                                </h3>
                                                <div className="mt-auto flex flex-wrap gap-1">
                                                    {costume.partTypes.map(pt => (
                                                        <span key={pt} className="text-[10px] px-1.5 py-0.5 bg-miku/10 text-miku rounded font-medium">
                                                            {PART_TYPE_NAMES[pt] || pt}
                                                        </span>
                                                    ))}
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                                        {SOURCE_NAMES[costume.source] || costume.source}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Load More */}
                            {displayedGroups.length < costumeGroups.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedGroups.length} / {costumeGroups.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && costumeGroups.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>没有找到匹配的服装</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CostumesClient() {
    return (
        <MainLayout activeNav="服装">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载服装数据...</div>}>
                <CostumesContent />
            </Suspense>
        </MainLayout>
    );
}
