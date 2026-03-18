"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import EventGrid from "@/components/events/EventGrid";
import EventFilters from "@/components/events/EventFilters";
import { EVENT_TYPE_TO_FILTER_ID, type EventUnitFilterId } from "@/components/events/EventFilters";
import { IEventInfo, IEventDeckBonus, EventType } from "@/types/events";
import { ICharaUnitInfo } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ActionSet interface for parsing event unit types
interface IActionSet {
    releaseConditionId: number;
    scenarioId?: string;
}

/** Build a map from eventId to raw unit type string (e.g. 'band', 'idol', 'shuffle') */
function buildEventRawUnitMap(actionSets: IActionSet[]): Map<number, string> {
    const map = new Map<number, string>();
    // Hardcoded first few events
    map.set(1, "band");
    map.set(5, "idol");
    map.set(6, "street");
    map.set(9, "shuffle");

    for (const action of actionSets) {
        const rcId = String(action.releaseConditionId);
        if (
            action.scenarioId &&
            (action.scenarioId.includes("areatalk_ev") || action.scenarioId.includes("areatalk_wl")) &&
            rcId.length === 6 &&
            rcId[0] === "1"
        ) {
            const eventId = parseInt(rcId.substring(1, 4), 10) + 1;
            const eventType = action.scenarioId.split("_")[2];
            if (!map.has(eventId)) {
                map.set(eventId, eventType);
            }
        }
    }
    return map;
}

/** Convert raw unit type to filter ID (e.g. 'band' -> 'ln', 'shuffle' -> 'mixed') */
function rawUnitToFilterId(raw: string): EventUnitFilterId {
    return EVENT_TYPE_TO_FILTER_ID[raw] || "mixed";
}

function EventsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();

    const [events, setEvents] = useState<IEventInfo[]>([]);
    const [deckBonuses, setDeckBonuses] = useState<IEventDeckBonus[]>([]);
    const [charaUnits, setCharaUnits] = useState<ICharaUnitInfo[]>([]);
    const [actionSets, setActionSets] = useState<IActionSet[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // Filter states
    const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
    const [selectedEventUnits, setSelectedEventUnits] = useState<EventUnitFilterId[]>([]);
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Sort states
    const [sortBy, setSortBy] = useState<"id" | "startAt">("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination with scroll restore
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "events",
        defaultDisplayCount: 12,
        increment: 12,
        isReady: !isLoading,
    });

    // Storage key
    const STORAGE_KEY = "events_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const types = searchParams.get("types");
        const eventUnits = searchParams.get("eventUnits");
        const chars = searchParams.get("characters");
        const units = searchParams.get("units");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        const hasUrlParams = types || eventUnits || chars || units || search || sort || order;

        if (hasUrlParams) {
            if (types) setSelectedTypes(types.split(",") as EventType[]);
            if (eventUnits) setSelectedEventUnits(eventUnits.split(",") as EventUnitFilterId[]);
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (units) setSelectedUnitIds(units.split(","));
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "id" | "startAt");
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.types?.length) setSelectedTypes(filters.types);
                    if (filters.eventUnits?.length) setSelectedEventUnits(filters.eventUnits);
                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.units?.length) setSelectedUnitIds(filters.units);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
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
            types: selectedTypes,
            eventUnits: selectedEventUnits,
            characters: selectedCharacters,
            units: selectedUnitIds,
            search: searchQuery,
            sortBy,
            sortOrder,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        const params = new URLSearchParams();
        if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
        if (selectedEventUnits.length > 0) params.set("eventUnits", selectedEventUnits.join(","));
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (selectedUnitIds.length > 0) params.set("units", selectedUnitIds.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/events?${queryString}` : "/events";
        router.replace(newUrl, { scroll: false });
    }, [selectedTypes, selectedEventUnits, selectedCharacters, selectedUnitIds, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    // Fetch events data
    useEffect(() => {
        async function fetchEvents() {
            try {
                setIsLoading(true);
                const [data, bonusesData, charaUnitsData, actionSetsData, translationsData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IEventDeckBonus[]>("eventDeckBonuses.json"),
                    fetchMasterData<ICharaUnitInfo[]>("gameCharacterUnits.json"),
                    fetchMasterData<IActionSet[]>("actionSets.json"),
                    loadTranslations(),
                ]);
                setEvents(data);
                setDeckBonuses(bonusesData);
                setCharaUnits(charaUnitsData);
                setActionSets(actionSetsData);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching events:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchEvents();
    }, []);

    // Build a map: eventId -> Set of gameCharacterUnitIds (raw, not collapsed)
    const eventBonusCharMap = useMemo(() => {
        const map = new Map<number, Set<number>>();
        for (const bonus of deckBonuses) {
            if (bonus.gameCharacterUnitId) {
                if (!map.has(bonus.eventId)) {
                    map.set(bonus.eventId, new Set());
                }
                map.get(bonus.eventId)!.add(bonus.gameCharacterUnitId);
            }
        }
        return map;
    }, [deckBonuses]);

    // Build lookup: for each VS base char (21-26), all their gameCharacterUnitIds
    const vsCharAllUnitIds = useMemo(() => {
        const map = new Map<number, number[]>();
        for (const cu of charaUnits) {
            if (cu.gameCharacterId >= 21 && cu.gameCharacterId <= 26) {
                if (!map.has(cu.gameCharacterId)) {
                    map.set(cu.gameCharacterId, []);
                }
                map.get(cu.gameCharacterId)!.push(cu.id);
            }
        }
        return map;
    }, [charaUnits]);

    // Build event unit map: eventId -> filter ID (e.g. 'ln', 'mmj', 'mixed')
    const eventUnitMap = useMemo(() => {
        if (actionSets.length === 0) return new Map<number, string>();
        const rawMap = buildEventRawUnitMap(actionSets);
        const filterMap = new Map<number, string>();
        for (const [eventId, rawType] of rawMap) {
            filterMap.set(eventId, rawUnitToFilterId(rawType));
        }
        return filterMap;
    }, [actionSets]);

    // Filter and sort events
    const filteredEvents = useMemo(() => {
        let result = [...events];

        // Apply type filter
        if (selectedTypes.length > 0) {
            result = result.filter(event => selectedTypes.includes(event.eventType as EventType));
        }

        // Apply event unit (group) filter
        if (selectedEventUnits.length > 0) {
            result = result.filter(event => {
                const unitId = eventUnitMap.get(event.id);
                if (!unitId) return false;
                return selectedEventUnits.includes(unitId as EventUnitFilterId);
            });
        }

        // Apply character filter (intersection: event must have ALL selected characters as bonus)
        if (selectedCharacters.length > 0) {
            result = result.filter(event => {
                const bonusUnitIds = eventBonusCharMap.get(event.id);
                if (!bonusUnitIds) return false;
                return selectedCharacters.every(charId => {
                    if (charId >= 21 && charId <= 26) {
                        // Original VS character: matches any of their gameCharacterUnitIds
                        const allIds = vsCharAllUnitIds.get(charId);
                        return allIds ? allIds.some(id => bonusUnitIds.has(id)) : false;
                    }
                    // Original characters (1-20) or VS sub-unit characters (27+): exact match
                    return bonusUnitIds.has(charId);
                });
            });
        }

        // Apply search query (supports both name, ID, and Chinese translations)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryAsNumber = parseInt(query, 10);

            result = result.filter(event => {
                // Match by ID
                if (event.id === queryAsNumber) return true;
                // Match by Japanese name
                if (event.name.toLowerCase().includes(query)) return true;
                // Match by Chinese name translation
                const chineseName = translations?.events?.name?.[event.name];
                if (chineseName && chineseName.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            result = result.filter(event => event.startAt <= Date.now());
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case "id":
                    comparison = a.id - b.id;
                    break;
                case "startAt":
                    comparison = a.startAt - b.startAt;
                    break;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [events, selectedTypes, selectedEventUnits, eventUnitMap, selectedCharacters, eventBonusCharMap, vsCharAllUnitIds, searchQuery, sortBy, sortOrder, isShowSpoiler, translations]);

    // Displayed events (with pagination)
    const displayedEvents = useMemo(() => {
        return filteredEvents.slice(0, displayCount);
    }, [filteredEvents, displayCount]);

    // Reset filters
    const resetFilters = useCallback(() => {
        setSelectedTypes([]);
        setSelectedEventUnits([]);
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setSearchQuery("");
        setSortBy("id");
        setSortOrder("desc");
        resetDisplayCount();
    }, [resetDisplayCount]);

    // Sort change handler
    const handleSortChange = useCallback((newSortBy: "id" | "startAt", newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const quickFilterContent = (
        <EventFilters
            selectedTypes={selectedTypes}
            onTypeChange={setSelectedTypes}
            selectedEventUnits={selectedEventUnits}
            onEventUnitChange={setSelectedEventUnits}
            selectedCharacters={selectedCharacters}
            onCharacterChange={setSelectedCharacters}
            selectedUnitIds={selectedUnitIds}
            onUnitIdsChange={setSelectedUnitIds}
            charaUnits={charaUnits}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onReset={resetFilters}
            totalEvents={events.length}
            filteredEvents={filteredEvents.length}
        />
    );

    useQuickFilter("活动筛选", quickFilterContent, [
        selectedTypes,
        selectedEventUnits,
        selectedCharacters,
        selectedUnitIds,
        searchQuery,
        sortBy,
        sortOrder,
        events.length,
        filteredEvents.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">活动数据库</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    活动 <span className="text-miku">图鉴</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览并探索世界计划中的所有活动
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
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                {/* Event Grid */}
                <div className="flex-1 min-w-0">
                    <EventGrid events={displayedEvents} isLoading={isLoading} eventUnitMap={eventUnitMap} />

                    {/* Load More Button */}
                    {!isLoading && displayedEvents.length < filteredEvents.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                data-shortcut-load-more="true"
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedEvents.length} / {filteredEvents.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading && displayedEvents.length > 0 && displayedEvents.length >= filteredEvents.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {filteredEvents.length} 个活动
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function EventsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载活动...</div>}>
                <EventsContent />
            </Suspense>
        </MainLayout>
    );
}
