"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import CardGrid from "@/components/cards/CardGrid";
import CardFilters from "@/components/cards/CardFilters";
import { ICardInfo, CardRarityType, CardAttribute, getRarityNumber } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";

// Master data URL (Japanese server)
const CARDS_DATA_URL = "https://sekaimaster.exmeaning.com/master/cards.json";
const CARD_SUPPLIES_URL = "https://sekaimaster.exmeaning.com/master/cardSupplies.json";

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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Initialize filter states from URL params
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedAttrs, setSelectedAttrs] = useState<CardAttribute[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<CardRarityType[]>([]);
    const [selectedSupplyTypes, setSelectedSupplyTypes] = useState<string[]>([]);
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
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        // If URL has params, use them
        const hasUrlParams = chars || attrs || rarities || supplyTypes || search || sort || order;

        if (hasUrlParams) {
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (attrs) setSelectedAttrs(attrs.split(",") as CardAttribute[]);
            if (rarities) setSelectedRarities(rarities.split(",") as CardRarityType[]);
            if (supplyTypes) setSelectedSupplyTypes(supplyTypes.split(","));
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

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        // Save to sessionStorage
        const filters = {
            characters: selectedCharacters,
            attrs: selectedAttrs,
            rarities: selectedRarities,
            supplyTypes: selectedSupplyTypes,
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
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/cards?${queryString}` : "/cards";
        router.replace(newUrl, { scroll: false });
    }, [selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    // Fetch cards data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 卡牌";
        async function fetchCards() {
            try {
                setIsLoading(true);

                // Fetch both cards and supplies in parallel
                const [cardsResponse, suppliesResponse] = await Promise.all([
                    fetch(CARDS_DATA_URL),
                    fetch(CARD_SUPPLIES_URL)
                ]);

                if (!cardsResponse.ok) {
                    throw new Error("Failed to fetch cards data");
                }

                // Supplies are optional, but we need them for filtering
                let suppliesData: ICardSupply[] = [];
                if (suppliesResponse.ok) {
                    suppliesData = await suppliesResponse.json();
                } else {
                    console.warn("Failed to fetch card supplies");
                }

                // Create a map of supply ID to supply type
                const supplyTypeMap = new Map<number, string>();
                suppliesData.forEach(supply => {
                    supplyTypeMap.set(supply.id, supply.cardSupplyType);
                });

                const cardsData: ICardInfo[] = await cardsResponse.json();

                // Enhance card data with mapped supply type
                const enhancedCards = cardsData.map(card => ({
                    ...card,
                    cardSupplyType: supplyTypeMap.get(card.cardSupplyId) || "normal" // Fallback to normal
                }));

                setCards(enhancedCards);
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

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(card =>
                card.prefix.toLowerCase().includes(query) ||
                card.cardSkillName.toLowerCase().includes(query)
            );
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
    }, [cards, selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, searchQuery, sortBy, sortOrder, isShowSpoiler]);

    // Displayed cards (with pagination)
    const displayedCards = useMemo(() => {
        return filteredCards.slice(0, displayCount);
    }, [filteredCards, displayCount]);

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

                    {/* Load More Button */}
                    {!isLoading && displayedCards.length < filteredCards.length && (
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
                    {!isLoading && displayedCards.length > 0 && displayedCards.length >= filteredCards.length && (
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
