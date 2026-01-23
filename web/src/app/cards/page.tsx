"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import CardGrid from "@/components/cards/CardGrid";
import CardFilters from "@/components/cards/CardFilters";
import { ICardInfo, CardRarityType, CardAttribute, getRarityNumber, SupportUnit } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";

interface ICardSupply {
    id: number;
    cardSupplyType: string;
    assetbundleName?: string;
    name?: string;
}

function CardsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Initialize filter states from URL params
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedAttrs, setSelectedAttrs] = useState<CardAttribute[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<CardRarityType[]>([]);
    const [selectedSupplyTypes, setSelectedSupplyTypes] = useState<string[]>([]);
    const [selectedSupportUnits, setSelectedSupportUnits] = useState<SupportUnit[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort states
    const [sortBy, setSortBy] = useState<"id" | "releaseAt" | "rarity">("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [displayCount, setDisplayCount] = useState(30);

    // Storage key
    const STORAGE_KEY = "cards_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const chars = searchParams.get("characters");
        const attrs = searchParams.get("attrs");
        const rarities = searchParams.get("rarities");
        const supplyTypes = searchParams.get("supplyTypes");
        const supportUnits = searchParams.get("supportUnits");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        // If URL has params, use them
        const hasUrlParams = chars || attrs || rarities || supplyTypes || supportUnits || search || sort || order;

        if (hasUrlParams) {
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (attrs) setSelectedAttrs(attrs.split(",") as CardAttribute[]);
            if (rarities) setSelectedRarities(rarities.split(",") as CardRarityType[]);
            if (supplyTypes) setSelectedSupplyTypes(supplyTypes.split(","));
            if (supportUnits) setSelectedSupportUnits(supportUnits.split(",") as SupportUnit[]);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "id" | "releaseAt" | "rarity");
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            // Fallback to sessionStorage
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.attrs?.length) setSelectedAttrs(filters.attrs);
                    if (filters.rarities?.length) setSelectedRarities(filters.rarities);
                    if (filters.supplyTypes?.length) setSelectedSupplyTypes(filters.supplyTypes);
                    if (filters.supportUnits?.length) setSelectedSupportUnits(filters.supportUnits);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                }
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    }, []); // Only run once on mount

    // Check for screenshot mode (derived state)
    const isScreenshotMode = searchParams.get("mode") === "screenshot";

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        // Save to sessionStorage
        const filters = {
            characters: selectedCharacters,
            attrs: selectedAttrs,
            rarities: selectedRarities,
            supplyTypes: selectedSupplyTypes,
            supportUnits: selectedSupportUnits,
            search: searchQuery,
            sortBy,
            sortOrder,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (selectedAttrs.length > 0) params.set("attrs", selectedAttrs.join(","));
        if (selectedRarities.length > 0) params.set("rarities", selectedRarities.join(","));
        if (selectedSupplyTypes.length > 0) params.set("supplyTypes", selectedSupplyTypes.join(","));
        if (selectedSupportUnits.length > 0) params.set("supportUnits", selectedSupportUnits.join(","));
        if (searchQuery) params.set("search", searchQuery);
        // Preserve mode parameter (e.g. for screenshot mode)
        if (isScreenshotMode) params.set("mode", "screenshot");

        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/cards?${queryString}` : "/cards";
        router.replace(newUrl, { scroll: false });
    }, [selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, searchQuery, sortBy, sortOrder, router, filtersInitialized, isScreenshotMode]);

    // Fetch cards data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 卡牌";
        async function fetchCards() {
            try {
                setIsLoading(true);

                // Fetch both cards and supplies in parallel with compression headers
                const [cardsData, suppliesData, translationsData] = await Promise.all([
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    fetchMasterData<ICardSupply[]>("cardSupplies.json").catch(() => [] as ICardSupply[]),
                    loadTranslations(),
                ]);

                // Create a map of supply ID to supply type
                const supplyTypeMap = new Map<number, string>();
                suppliesData.forEach(supply => {
                    supplyTypeMap.set(supply.id, supply.cardSupplyType);
                });

                // Enhance card data with mapped supply type
                const enhancedCards = cardsData.map(card => ({
                    ...card,
                    cardSupplyType: supplyTypeMap.get(card.cardSupplyId) || "normal" // Fallback to normal
                }));

                setCards(enhancedCards);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching cards:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchCards();
    }, []);

    // Filter and sort cards
    const filteredCards = useMemo(() => {
        let result = [...cards];

        // Apply character filter
        if (selectedCharacters.length > 0) {
            result = result.filter(card => selectedCharacters.includes(card.characterId));
        }

        // Apply attribute filter
        if (selectedAttrs.length > 0) {
            result = result.filter(card => selectedAttrs.includes(card.attr));
        }

        // Apply rarity filter
        if (selectedRarities.length > 0) {
            result = result.filter(card => selectedRarities.includes(card.cardRarityType));
        }

        // Apply supply type filter
        if (selectedSupplyTypes.length > 0) {
            result = result.filter(card => selectedSupplyTypes.includes(card.cardSupplyType));
        }

        // Apply support unit filter (only for virtual singer cards, non-VS cards pass through)
        if (selectedSupportUnits.length > 0) {
            result = result.filter(card => {
                // Non-virtual singer cards are not affected by supportUnit filter
                if (card.characterId < 21) {
                    return true;
                }
                // Virtual singer cards must match selected supportUnits
                return selectedSupportUnits.includes(card.supportUnit);
            });
        }

        // Apply search query (supports both name, ID, and Chinese translations)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryAsNumber = parseInt(query, 10);

            result = result.filter(card => {
                // Match by ID
                if (card.id === queryAsNumber) return true;
                // Match by Japanese prefix
                if (card.prefix.toLowerCase().includes(query)) return true;
                // Match by Chinese prefix translation
                const chinesePrefix = translations?.cards?.prefix?.[card.prefix];
                if (chinesePrefix && chinesePrefix.toLowerCase().includes(query)) return true;
                // Match by skill name
                if (card.cardSkillName.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // Spoiler filter
        const now = Date.now();
        if (!isShowSpoiler) {
            result = result.filter(card =>
                (card.releaseAt || card.archivePublishedAt || 0) <= now
            );
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "id":
                    comparison = a.id - b.id;
                    break;
                case "releaseAt":
                    comparison = (a.releaseAt || 0) - (b.releaseAt || 0);
                    break;
                case "rarity":
                    comparison = getRarityNumber(a.cardRarityType) - getRarityNumber(b.cardRarityType);
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [cards, selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);


    // Displayed cards (with pagination)
    const displayedCards = useMemo(() => {
        const limit = isScreenshotMode ? 100 : displayCount;
        return filteredCards.slice(0, limit);
    }, [filteredCards, displayCount, isScreenshotMode]);

    // Load more handler
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 30);
    }, []);

    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedCharacters([]);
        setSelectedAttrs([]);
        setSelectedRarities([]);
        setSelectedSupplyTypes([]);
        setSelectedSupportUnits([]);
        setSearchQuery("");
        setSortBy("id");
        setSortOrder("desc");
        setDisplayCount(30);
    }, []);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: "id" | "releaseAt" | "rarity", newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        setDisplayCount(30);
    }, []);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">卡牌数据库</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    卡牌 <span className="text-miku">图鉴</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览并探索世界计划中的所有卡牌
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-500 underline hover:no-underline"
                    >
                        重试
                    </button>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel on Large Screens */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24">
                        <CardFilters
                            selectedCharacters={selectedCharacters}
                            onCharacterChange={setSelectedCharacters}
                            selectedAttrs={selectedAttrs}
                            onAttrChange={setSelectedAttrs}
                            selectedRarities={selectedRarities}
                            onRarityChange={setSelectedRarities}
                            selectedSupplyTypes={selectedSupplyTypes}
                            onSupplyTypeChange={setSelectedSupplyTypes}
                            selectedSupportUnits={selectedSupportUnits}
                            onSupportUnitChange={setSelectedSupportUnits}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={handleSortChange}
                            onReset={resetFilters}
                            totalCards={cards.length}
                            filteredCards={filteredCards.length}
                        />
                    </div>
                </div>

                {/* Card Grid */}
                <div className="flex-1 min-w-0">
                    <CardGrid cards={displayedCards} isLoading={isLoading} />

                    {/* Screenshot Mode Notice */}
                    {isScreenshotMode && (
                        <div className="mt-8 text-center text-slate-500 text-sm font-medium p-4 bg-slate-50 rounded-xl border border-slate-100">
                            该模式下默认仅显示前 100 张相关卡牌
                        </div>
                    )}

                    {/* Load More Button */}
                    {!isScreenshotMode && !isLoading && displayedCards.length < filteredCards.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedCards.length} / {filteredCards.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isScreenshotMode && !isLoading && displayedCards.length > 0 && displayedCards.length >= filteredCards.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {filteredCards.length} 张卡牌
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CardsPage() {
    return (
        <MainLayout activeNav="卡牌">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载卡牌...</div>}>
                <CardsContent />
            </Suspense>
        </MainLayout>
    );
}
