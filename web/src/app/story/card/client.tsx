"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import CardGrid from "@/components/cards/CardGrid";
import CardFilters from "@/components/cards/CardFilters";
import { ICardInfo, CardRarityType, CardAttribute, getRarityNumber, SupportUnit } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

interface ICardSupply {
    id: number;
    cardSupplyType: string;
    assetbundleName?: string;
    name?: string;
}

function StoryCardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [selectedAttrs, setSelectedAttrs] = useState<CardAttribute[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<CardRarityType[]>([]);
    const [selectedSupplyTypes, setSelectedSupplyTypes] = useState<string[]>([]);
    const [selectedSupportUnits, setSelectedSupportUnits] = useState<SupportUnit[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [sortBy, setSortBy] = useState<"id" | "releaseAt" | "rarity">("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "story_cards",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading,
    });

    const STORAGE_KEY = "story_cards_filters";

    useEffect(() => {
        const chars = searchParams.get("characters");
        const units = searchParams.get("units");
        const attrs = searchParams.get("attrs");
        const rarities = searchParams.get("rarities");
        const supplyTypes = searchParams.get("supplyTypes");
        const supportUnits = searchParams.get("supportUnits");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        const hasUrlParams = chars || units || attrs || rarities || supplyTypes || supportUnits || search || sort || order;

        if (hasUrlParams) {
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (units) setSelectedUnitIds(units.split(","));
            if (attrs) setSelectedAttrs(attrs.split(",") as CardAttribute[]);
            if (rarities) setSelectedRarities(rarities.split(",") as CardRarityType[]);
            if (supplyTypes) setSelectedSupplyTypes(supplyTypes.split(","));
            if (supportUnits) setSelectedSupportUnits(supportUnits.split(",") as SupportUnit[]);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "id" | "releaseAt" | "rarity");
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.units?.length) setSelectedUnitIds(filters.units);
                    if (filters.attrs?.length) setSelectedAttrs(filters.attrs);
                    if (filters.rarities?.length) setSelectedRarities(filters.rarities);
                    if (filters.supplyTypes?.length) setSelectedSupplyTypes(filters.supplyTypes);
                    if (filters.supportUnits?.length) setSelectedSupportUnits(filters.supportUnits);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                }
            } catch { /* ignore */ }
        }
        setFiltersInitialized(true);
    }, []);

    useEffect(() => {
        if (!filtersInitialized) return;

        const filters = {
            characters: selectedCharacters, units: selectedUnitIds,
            attrs: selectedAttrs, rarities: selectedRarities,
            supplyTypes: selectedSupplyTypes, supportUnits: selectedSupportUnits,
            search: searchQuery, sortBy, sortOrder,
        };
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch { /* ignore */ }

        const params = new URLSearchParams();
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (selectedUnitIds.length > 0) params.set("units", selectedUnitIds.join(","));
        if (selectedAttrs.length > 0) params.set("attrs", selectedAttrs.join(","));
        if (selectedRarities.length > 0) params.set("rarities", selectedRarities.join(","));
        if (selectedSupplyTypes.length > 0) params.set("supplyTypes", selectedSupplyTypes.join(","));
        if (selectedSupportUnits.length > 0) params.set("supportUnits", selectedSupportUnits.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const qs = params.toString();
        router.replace(qs ? `/story/card?${qs}` : "/story/card", { scroll: false });
    }, [selectedCharacters, selectedUnitIds, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    useEffect(() => {
        async function fetchCards() {
            try {
                setIsLoading(true);
                const [cardsData, suppliesData, translationsData] = await Promise.all([
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    fetchMasterData<ICardSupply[]>("cardSupplies.json").catch(() => [] as ICardSupply[]),
                    loadTranslations(),
                ]);
                const supplyTypeMap = new Map<number, string>();
                suppliesData.forEach(s => supplyTypeMap.set(s.id, s.cardSupplyType));
                const enhancedCards = cardsData.map(card => ({
                    ...card,
                    cardSupplyType: supplyTypeMap.get(card.cardSupplyId) || "normal",
                }));
                setCards(enhancedCards);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchCards();
    }, []);

    const filteredCards = useMemo(() => {
        let result = [...cards];
        if (selectedCharacters.length > 0) result = result.filter(c => selectedCharacters.includes(c.characterId));
        if (selectedAttrs.length > 0) result = result.filter(c => selectedAttrs.includes(c.attr));
        if (selectedRarities.length > 0) result = result.filter(c => selectedRarities.includes(c.cardRarityType));
        if (selectedSupplyTypes.length > 0) result = result.filter(c => selectedSupplyTypes.includes(c.cardSupplyType));
        if (selectedSupportUnits.length > 0) {
            result = result.filter(c => c.characterId < 21 || selectedSupportUnits.includes(c.supportUnit));
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const qNum = parseInt(q, 10);
            result = result.filter(c => {
                if (c.id === qNum) return true;
                if (c.prefix.toLowerCase().includes(q)) return true;
                const cn = translations?.cards?.prefix?.[c.prefix];
                if (cn && cn.toLowerCase().includes(q)) return true;
                if (c.cardSkillName.toLowerCase().includes(q)) return true;
                return false;
            });
        }
        const now = Date.now();
        if (!isShowSpoiler) result = result.filter(c => (c.releaseAt || c.archivePublishedAt || 0) <= now);
        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === "id") cmp = a.id - b.id;
            else if (sortBy === "releaseAt") cmp = (a.releaseAt || 0) - (b.releaseAt || 0);
            else if (sortBy === "rarity") cmp = getRarityNumber(a.cardRarityType) - getRarityNumber(b.cardRarityType);
            return sortOrder === "asc" ? cmp : -cmp;
        });
        return result;
    }, [cards, selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);

    const displayedCards = useMemo(() => filteredCards.slice(0, displayCount), [filteredCards, displayCount]);

    const resetFilters = useCallback(() => {
        setSelectedCharacters([]); setSelectedUnitIds([]); setSelectedAttrs([]);
        setSelectedRarities([]); setSelectedSupplyTypes([]); setSelectedSupportUnits([]);
        setSearchQuery(""); setSortBy("id"); setSortOrder("desc");
        resetDisplayCount();
    }, [resetDisplayCount]);

    const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy as "id" | "releaseAt" | "rarity");
        setSortOrder(newSortOrder);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const quickFilterContent = (
        <CardFilters
            selectedCharacters={selectedCharacters} onCharacterChange={setSelectedCharacters}
            selectedUnitIds={selectedUnitIds} onUnitIdsChange={setSelectedUnitIds}
            selectedAttrs={selectedAttrs} onAttrChange={setSelectedAttrs}
            selectedRarities={selectedRarities} onRarityChange={setSelectedRarities}
            selectedSupplyTypes={selectedSupplyTypes} onSupplyTypeChange={setSelectedSupplyTypes}
            selectedSupportUnits={selectedSupportUnits} onSupportUnitChange={setSelectedSupportUnits}
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            sortBy={sortBy} sortOrder={sortOrder} onSortChange={handleSortChange}
            onReset={resetFilters}
            totalCards={cards.length} filteredCards={filteredCards.length}
        />
    );

    useQuickFilter("卡牌筛选", quickFilterContent, [
        selectedCharacters, selectedUnitIds, selectedAttrs, selectedRarities,
        selectedSupplyTypes, selectedSupportUnits, searchQuery, sortBy, sortOrder,
        cards.length, filteredCards.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <StoryPageHeader storyKey="card" />

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p><p>{error}</p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <CardGrid cards={displayedCards} isLoading={isLoading} hrefPrefix="/story/card" />
                    {!isLoading && displayedCards.length < filteredCards.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">({displayedCards.length} / {filteredCards.length})</span>
                            </button>
                        </div>
                    )}
                    {!isLoading && displayedCards.length > 0 && displayedCards.length >= filteredCards.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">已显示全部 {filteredCards.length} 张卡牌</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StoryCardListClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载卡牌...</div>}>
                <StoryCardContent />
            </Suspense>
        </MainLayout>
    );
}
