"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import CostumeFilters from "@/components/costumes/CostumeFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { getCostumeThumbnailUrl } from "@/lib/assets";
import {
    ICostumeInfo,
    IMoeCostumeData,
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES,
} from "@/types/costume";
import { ICardInfo } from "@/types/types"; // Import ICardInfo
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ... imports remain the same

// CostumeGroup interface and groupCostumes function are removed as ICostumeInfo is now the group itself.

function CostumesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource, isShowSpoiler } = useTheme();
    const { t } = useTranslation();

    const [costumes, setCostumes] = useState<ICostumeInfo[]>([]);
    const [allCards, setAllCards] = useState<ICardInfo[]>([]); // Store all cards
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPartTypes, setSelectedPartTypes] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
    const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
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
        const partTypes = searchParams.get("partTypes");
        const sources = searchParams.get("sources");
        const rarities = searchParams.get("rarities");
        const genders = searchParams.get("genders");
        const chars = searchParams.get("characters");
        const units = searchParams.get("units");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");
        const related = searchParams.get("related"); // New param

        const hasUrlParams = partTypes || sources || rarities || genders || chars || units || search || sort || order || related;

        if (hasUrlParams) {
            if (partTypes) setSelectedPartTypes(partTypes.split(","));
            if (sources) setSelectedSources(sources.split(","));
            if (rarities) setSelectedRarities(rarities.split(","));
            if (genders) setSelectedGenders(genders.split(","));
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (units) setSelectedUnitIds(units.split(","));
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort);
            if (order) setSortOrder(order as "asc" | "desc");
            if (related) setOnlyRelatedCardCostumes(related === "true");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    // Handle migration or previous single-value format if needed, but assuming new format or empty
                    if (filters.partTypes?.length) setSelectedPartTypes(filters.partTypes); else if (filters.partType) setSelectedPartTypes([filters.partType]);
                    if (filters.sources?.length) setSelectedSources(filters.sources); else if (filters.source) setSelectedSources([filters.source]);
                    if (filters.rarities?.length) setSelectedRarities(filters.rarities); else if (filters.rarity) setSelectedRarities([filters.rarity]);
                    if (filters.genders?.length) setSelectedGenders(filters.genders); else if (filters.gender) setSelectedGenders([filters.gender]);

                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.units?.length) setSelectedUnitIds(filters.units);
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
            partTypes: selectedPartTypes,
            sources: selectedSources,
            rarities: selectedRarities,
            genders: selectedGenders,
            characters: selectedCharacters,
            units: selectedUnitIds,
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
        if (selectedPartTypes.length > 0) params.set("partTypes", selectedPartTypes.join(","));
        if (selectedSources.length > 0) params.set("sources", selectedSources.join(","));
        if (selectedRarities.length > 0) params.set("rarities", selectedRarities.join(","));
        if (selectedGenders.length > 0) params.set("genders", selectedGenders.join(","));
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (selectedUnitIds.length > 0) params.set("units", selectedUnitIds.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        if (onlyRelatedCardCostumes) params.set("related", "true");

        const queryString = params.toString();
        const newUrl = queryString ? `/costumes?${queryString}` : "/costumes";
        router.replace(newUrl, { scroll: false });
    }, [selectedPartTypes, selectedSources, selectedRarities, selectedGenders, selectedCharacters, selectedUnitIds, searchQuery, sortBy, sortOrder, onlyRelatedCardCostumes, router, filtersInitialized]);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                // Parallel fetch
                const [costumeData, cardList] = await Promise.all([
                    fetchMasterData<IMoeCostumeData>("moe_costume.json"),
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
            result = result.filter(c => {
                const translatedName = t("costumes", "name", c.name);
                return c.name.toLowerCase().includes(query) ||
                    c.designer.toLowerCase().includes(query) ||
                    (translatedName && translatedName.toLowerCase().includes(query));
            });
        }

        // Part type filter - Check in partTypes array
        if (selectedPartTypes.length > 0) {
            result = result.filter(c => c.partTypes && c.partTypes.some(pt => selectedPartTypes.includes(pt)));
        }

        // Source filter
        if (selectedSources.length > 0) {
            result = result.filter(c => selectedSources.includes(c.source));
        }

        // Rarity filter
        if (selectedRarities.length > 0) {
            result = result.filter(c => selectedRarities.includes(c.costume3dRarity));
        }

        // Gender filter
        if (selectedGenders.length > 0) {
            result = result.filter(c => selectedGenders.includes(c.gender));
        }

        // Character filter
        if (selectedCharacters.length > 0) {
            result = result.filter(c =>
                selectedCharacters.some(charId => c.characterIds.includes(charId))
            );
        }

        // Associated Card Filter
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

        // Spoiler filter
        const now = Date.now();
        if (!isShowSpoiler) {
            result = result.filter(c =>
                (c.publishedAt || 0) <= now
            );
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === "id") {
                return sortOrder === "asc" ? a.costumeNumber - b.costumeNumber : b.costumeNumber - a.costumeNumber;
            }
            if (sortBy === "publishedAt") {
                return sortOrder === "asc" ? (a.publishedAt || 0) - (b.publishedAt || 0) : (b.publishedAt || 0) - (a.publishedAt || 0);
            }
            return 0;
        });

        return result;
    }, [costumes, allCards, searchQuery, selectedPartTypes, selectedSources, selectedRarities, selectedGenders, selectedCharacters, onlyRelatedCardCostumes, sortBy, sortOrder, isShowSpoiler]);

    const displayedGroups = useMemo(() => {
        return filteredCostumes.slice(0, displayCount);
    }, [filteredCostumes, displayCount]);

    // Reset all filters
    const handleReset = () => {
        setSearchQuery("");
        setSelectedPartTypes([]);
        setSelectedSources([]);
        setSelectedRarities([]);
        setSelectedGenders([]);
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setOnlyRelatedCardCostumes(false);
        resetDisplayCount();
    };

    const quickFilterContent = (
        <CostumeFilters
            selectedCharacters={selectedCharacters}
            onCharacterChange={setSelectedCharacters}
            selectedUnitIds={selectedUnitIds}
            onUnitIdsChange={setSelectedUnitIds}
            selectedPartTypes={selectedPartTypes}
            onPartTypeChange={setSelectedPartTypes}
            selectedSources={selectedSources}
            onSourceChange={setSelectedSources}
            selectedRarities={selectedRarities}
            onRarityChange={setSelectedRarities}
            selectedGenders={selectedGenders}
            onGenderChange={setSelectedGenders}
            onlyRelatedCardCostumes={onlyRelatedCardCostumes}
            onOnlyRelatedCardCostumesChange={setOnlyRelatedCardCostumes}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
            }}
            onReset={handleReset}
            totalCount={costumes.length}
            filteredCount={filteredCostumes.length}
        />
    );

    useQuickFilter("服装筛选", quickFilterContent, [
        selectedCharacters,
        selectedUnitIds,
        selectedPartTypes,
        selectedSources,
        selectedRarities,
        selectedGenders,
        onlyRelatedCardCostumes,
        searchQuery,
        sortBy,
        sortOrder,
        costumes.length,
        filteredCostumes.length,
    ]);

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
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
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
                            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                {displayedGroups.map(costume => {
                                    let assetName = "";
                                    let repPart;
                                    if (costume.parts["body"] && costume.parts["body"].length > 0) {
                                        repPart = costume.parts["body"][0];
                                    } else if (costume.parts["hair"] && costume.parts["hair"].length > 0) {
                                        repPart = costume.parts["hair"][0];
                                    } else if (costume.parts["head"] && costume.parts["head"].length > 0) {
                                        repPart = costume.parts["head"][0];
                                    } else {
                                        const firstKey = Object.keys(costume.parts)[0];
                                        if (firstKey && costume.parts[firstKey].length > 0) {
                                            repPart = costume.parts[firstKey][0];
                                        }
                                    }

                                    if (repPart) {
                                        assetName = repPart.assetbundleName;
                                    }

                                    const now = Date.now();
                                    const isSpoiler = (costume.publishedAt || 0) > now;

                                    return (
                                        <Link
                                            href={`/costumes/${costume.costumeNumber}`}
                                            key={costume.costumeNumber}
                                            data-shortcut-item="true"
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
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                {isSpoiler && (
                                                    <div className="mb-1">
                                                        <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded leading-none">
                                                            剧透
                                                        </span>
                                                    </div>
                                                )}
                                                <h3 className="font-bold text-sm text-slate-800 mb-1 group-hover:text-miku transition-colors" title={costume.name}>
                                                    <TranslatedText
                                                        original={costume.name}
                                                        category="costumes"
                                                        field="name"
                                                        originalClassName="block"
                                                        translationClassName="text-xs font-medium text-slate-400 block"
                                                    />
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
                            {displayedGroups.length < filteredCostumes.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedGroups.length} / {filteredCostumes.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && filteredCostumes.length === 0 && (
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
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载服装数据...</div>}>
                <CostumesContent />
            </Suspense>
        </MainLayout>
    );
}
