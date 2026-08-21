"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import MainLayout from "@/components/MainLayout";
import CardGrid from "@/components/cards/CardGrid";
import CardFilters from "@/components/cards/CardFilters";
import { ICardInfo, CardRarityType, CardAttribute, getRarityNumber, SupportUnit, ISkillInfo } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getCardSkillTypes } from "@/lib/skill";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";

interface ICardSupply {
    id: number;
    cardSupplyType: string;
    assetbundleName?: string;
    name?: string;
}

function CardsContent() {
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();
    const { t } = useI18n();

    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [skills, setSkills] = useState<ISkillInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Initialize filter states from URL params
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [selectedAttrs, setSelectedAttrs] = useState<CardAttribute[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<CardRarityType[]>([]);
    const [selectedSupplyTypes, setSelectedSupplyTypes] = useState<string[]>([]);
    const [selectedSupportUnits, setSelectedSupportUnits] = useState<SupportUnit[]>([]);
    const [selectedSkillTypes, setSelectedSkillTypes] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort states
    const [sortBy, setSortBy] = useState<"id" | "releaseAt" | "rarity">("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination with scroll restore
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "cards",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading,
    });

    // Storage key
    const STORAGE_KEY = "cards_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const chars = searchParams.get("characters");
        const units = searchParams.get("units");
        const attrs = searchParams.get("attrs");
        const rarities = searchParams.get("rarities");
        const supplyTypes = searchParams.get("supplyTypes");
        const supportUnits = searchParams.get("supportUnits");
        const skillTypes = searchParams.get("skillTypes");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        // If URL has params, use them
        const hasUrlParams = chars || units || attrs || rarities || supplyTypes || supportUnits || skillTypes || search || sort || order;

        if (hasUrlParams) {
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (units) setSelectedUnitIds(units.split(","));
            if (attrs) setSelectedAttrs(attrs.split(",") as CardAttribute[]);
            if (rarities) setSelectedRarities(rarities.split(",") as CardRarityType[]);
            if (supplyTypes) setSelectedSupplyTypes(supplyTypes.split(","));
            if (supportUnits) setSelectedSupportUnits(supportUnits.split(",") as SupportUnit[]);
            if (skillTypes) setSelectedSkillTypes(skillTypes.split(","));
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
                    if (filters.units?.length) setSelectedUnitIds(filters.units);
                    if (filters.attrs?.length) setSelectedAttrs(filters.attrs);
                    if (filters.rarities?.length) setSelectedRarities(filters.rarities);
                    if (filters.supplyTypes?.length) setSelectedSupplyTypes(filters.supplyTypes);
                    if (filters.supportUnits?.length) setSelectedSupportUnits(filters.supportUnits);
                    if (filters.skillTypes?.length) setSelectedSkillTypes(filters.skillTypes);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                }
            } catch {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Check for screenshot mode (derived state)
    const isScreenshotMode = searchParams.get("mode") === "screenshot";

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        // Save to sessionStorage
        const filters = {
            characters: selectedCharacters,
            units: selectedUnitIds,
            attrs: selectedAttrs,
            rarities: selectedRarities,
            supplyTypes: selectedSupplyTypes,
            supportUnits: selectedSupportUnits,
            skillTypes: selectedSkillTypes,
            search: searchQuery,
            sortBy,
            sortOrder,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (selectedUnitIds.length > 0) params.set("units", selectedUnitIds.join(","));
        if (selectedAttrs.length > 0) params.set("attrs", selectedAttrs.join(","));
        if (selectedRarities.length > 0) params.set("rarities", selectedRarities.join(","));
        if (selectedSupplyTypes.length > 0) params.set("supplyTypes", selectedSupplyTypes.join(","));
        if (selectedSupportUnits.length > 0) params.set("supportUnits", selectedSupportUnits.join(","));
        if (selectedSkillTypes.length > 0) params.set("skillTypes", selectedSkillTypes.join(","));
        if (searchQuery) params.set("search", searchQuery);
        // Preserve mode parameter (e.g. for screenshot mode)
        if (isScreenshotMode) params.set("mode", "screenshot");

        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        replaceCurrentUrlSearchParams(params);
    }, [selectedCharacters, selectedUnitIds, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, selectedSkillTypes, searchQuery, sortBy, sortOrder, filtersInitialized, isScreenshotMode]);

    // Fetch cards data
    useEffect(() => {
        async function fetchCards() {
            try {
                setIsLoading(true);

                // Fetch cards, supplies, skills and translations in parallel
                const [cardsData, suppliesData, skillsData, translationsData] = await Promise.all([
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    fetchMasterData<ICardSupply[]>("cardSupplies.json").catch(() => [] as ICardSupply[]),
                    fetchMasterData<ISkillInfo[]>("skills.json").catch(() => [] as ISkillInfo[]),
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
                setSkills(skillsData);
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

        const hasVsUnitSelected = selectedUnitIds.includes("vs");

        // Apply character filter
        if (selectedCharacters.length > 0 || (!hasVsUnitSelected && selectedSupportUnits.length > 0)) {
            result = result.filter(card => {
                const matchesSelectedCharacter = selectedCharacters.includes(card.characterId);
                const matchesVirtualSingerShortcut =
                    !hasVsUnitSelected &&
                    card.characterId >= 21 &&
                    selectedSupportUnits.includes(card.supportUnit);

                return matchesSelectedCharacter || matchesVirtualSingerShortcut;
            });
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

        // Apply support unit filter only when VS unit is explicitly selected
        if (hasVsUnitSelected && selectedSupportUnits.length > 0) {
            result = result.filter(card => {
                // Non-virtual singer cards are not affected by supportUnit filter
                if (card.characterId < 21) {
                    return true;
                }
                // Virtual singer cards must match selected supportUnits
                return selectedSupportUnits.includes(card.supportUnit);
            });
        }

        // Apply skill type filter
        if (selectedSkillTypes.length > 0) {
            result = result.filter(card => {
                const normalSkill = skills.find(s => s.id === card.skillId);
                const trainedSkill = card.specialTrainingSkillId
                    ? skills.find(s => s.id === card.specialTrainingSkillId)
                    : undefined;

                const cardSkillTypes = new Set<string>([
                    ...getCardSkillTypes(normalSkill),
                    ...getCardSkillTypes(trainedSkill),
                ]);

                return selectedSkillTypes.some(type => cardSkillTypes.has(type));
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
    }, [cards, skills, selectedCharacters, selectedUnitIds, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSupportUnits, selectedSkillTypes, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);


    // Displayed cards (with pagination)
    const displayedCards = useMemo(() => {
        const limit = isScreenshotMode ? 100 : displayCount;
        return filteredCards.slice(0, limit);
    }, [filteredCards, displayCount, isScreenshotMode]);



    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setSelectedAttrs([]);
        setSelectedRarities([]);
        setSelectedSupplyTypes([]);
        setSelectedSupportUnits([]);
        setSelectedSkillTypes([]);
        setSearchQuery("");
        setSortBy("id");
        setSortOrder("desc");
        resetDisplayCount();
    }, [resetDisplayCount]);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy as "id" | "releaseAt" | "rarity");
        setSortOrder(newSortOrder);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const quickFilterContent = (
        <CardFilters
            selectedCharacters={selectedCharacters}
            onCharacterChange={setSelectedCharacters}
            selectedUnitIds={selectedUnitIds}
            onUnitIdsChange={setSelectedUnitIds}
            selectedAttrs={selectedAttrs}
            onAttrChange={setSelectedAttrs}
            selectedRarities={selectedRarities}
            onRarityChange={setSelectedRarities}
            selectedSupplyTypes={selectedSupplyTypes}
            onSupplyTypeChange={setSelectedSupplyTypes}
            selectedSupportUnits={selectedSupportUnits}
            onSupportUnitChange={setSelectedSupportUnits}
            selectedSkillTypes={selectedSkillTypes}
            onSkillTypeChange={setSelectedSkillTypes}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onReset={resetFilters}
            totalCards={cards.length}
            filteredCards={filteredCards.length}
        />
    );

    useQuickFilter(t("page.cards.filterTitle"), quickFilterContent, [
        selectedCharacters,
        selectedUnitIds,
        selectedAttrs,
        selectedRarities,
        selectedSupplyTypes,
        selectedSupportUnits,
        selectedSkillTypes,
        searchQuery,
        sortBy,
        sortOrder,
        cards.length,
        filteredCards.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                    <span className="hh-label text-miku">{t("page.cards.badge")}</span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.cards.title")} <span className="text-miku">{t("page.cards.titleHighlight")}</span>
                </h1>
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                    {t("page.cards.description")}
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/12 border border-red-500/30 rounded-[var(--hh-radius-lg)] text-red-600 text-sm">
                    <p className="font-bold">{t("common.state.loadingFailed")}</p>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-500 underline hover:no-underline"
                    >
                        {t("common.action.retry")}
                    </button>
                </div>
            )}

            {/* Card Grid */}
            <div className="w-full min-w-0">
                <CardGrid cards={displayedCards} isLoading={isLoading} />

                {/* Screenshot Mode Notice */}
                {isScreenshotMode && (
                    <div className="hh-well mt-8 text-center text-[var(--hh-text-secondary)] text-sm font-medium p-4">
                        {t("page.cards.screenshotModeNotice")}
                    </div>
                )}

                {/* Load More Button */}
                {!isScreenshotMode && !isLoading && displayedCards.length < filteredCards.length && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={loadMore}
                            data-shortcut-load-more="true"
                            className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3 font-bold"
                        >
                            {t("page.cards.loadMore")}
                            <span className="hh-numeric ml-2 text-sm opacity-80">
                                ({displayedCards.length} / {filteredCards.length})
                            </span>
                        </button>
                    </div>
                )}

                {/* All loaded indicator */}
                {!isScreenshotMode && !isLoading && displayedCards.length > 0 && displayedCards.length >= filteredCards.length && (
                    <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm">
                        {t("page.cards.allLoaded", { count: String(filteredCards.length) })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CardsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">Loading cards...</div>}>
                <CardsContent />
            </Suspense>
        </MainLayout>
    );
}
