"use client";
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { IEventInfo, IEventDeckBonus, EventType, EVENT_TYPE_NAMES, EVENT_TYPE_COLORS, getEventStatus, EVENT_STATUS_DISPLAY } from "@/types/events";
import { ICharaUnitInfo, UNIT_DATA, UNIT_ICON_FILES, CardAttribute, ATTR_ICON_PATHS, ATTR_NAMES } from "@/types/types";
import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import { getEventLogoUrl, getEventStoryBannerUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { TranslatedText } from "@/components/common/TranslatedText";
import SelectorModal from "./SelectorModal";
import EventFilters, { type EventUnitFilterId } from "@/components/events/EventFilters";
import { IActionSet, IEventStory, buildEventRawUnitMap, rawUnitToFilterId, buildEventBannerCharMap } from "@/lib/eventUnit";

// Build unit icon mapping from UNIT_DATA (same as EventItem)
const EVENT_UNIT_ICON: Record<string, { icon: string; name: string }> = Object.fromEntries(
    UNIT_DATA.filter(u => UNIT_ICON_FILES[u.id]).map(u => [u.id, { icon: UNIT_ICON_FILES[u.id], name: u.name }])
);

interface EventSelectorProps {
    selectedEventId: string;
    onSelect: (eventId: string, eventType?: string) => void;
    onEventTypeChange?: (eventType: string | null) => void;
}

export default function EventSelector({ selectedEventId, onSelect, onEventTypeChange }: EventSelectorProps) {
    const { assetSource, isShowSpoiler } = useTheme();
    const [events, setEvents] = useState<IEventInfo[]>([]);
    const [deckBonuses, setDeckBonuses] = useState<IEventDeckBonus[]>([]);
    const [charaUnits, setCharaUnits] = useState<ICharaUnitInfo[]>([]);
    const [actionSetsForUnitMap, setActionSetsForUnitMap] = useState<IActionSet[]>([]);
    const [eventStories, setEventStories] = useState<IEventStory[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    // Filters state
    const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
    const [selectedEventUnits, setSelectedEventUnits] = useState<EventUnitFilterId[]>([]);
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [selectedBannerChars, setSelectedBannerChars] = useState<number[]>([]);
    const [selectedBannerUnitIds, setSelectedBannerUnitIds] = useState<string[]>([]);
    const [selectedBonusAttr, setSelectedBonusAttr] = useState<CardAttribute | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "startAt">("startAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Load all data on mount
    useEffect(() => {
        Promise.all([
            fetchMasterData<IEventInfo[]>("events.json"),
            fetchMasterData<IEventDeckBonus[]>("eventDeckBonuses.json"),
            fetchMasterData<ICharaUnitInfo[]>("gameCharacterUnits.json"),
            fetchMasterDataForServer<IActionSet[]>("jp", "actionSets.json"),
            fetchMasterData<IEventStory[]>("eventStories.json"),
            loadTranslations(),
        ])
            .then(([eventsData, bonusesData, charaUnitsData, actionSetsForUnitMapData, eventStoriesData, translationsData]) => {
                setEvents(eventsData);
                setDeckBonuses(bonusesData);
                setCharaUnits(charaUnitsData);
                setActionSetsForUnitMap(actionSetsForUnitMapData);
                setEventStories(eventStoriesData);
                setTranslations(translationsData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load events data", err);
                setLoading(false);
            });
    }, []);

    // Derived maps — same logic as useEventListData
    const eventBonusCharMap = useMemo(() => {
        const map = new Map<number, Set<number>>();
        for (const bonus of deckBonuses) {
            if (bonus.gameCharacterUnitId) {
                if (!map.has(bonus.eventId)) map.set(bonus.eventId, new Set());
                map.get(bonus.eventId)!.add(bonus.gameCharacterUnitId);
            }
        }
        return map;
    }, [deckBonuses]);

    const vsCharAllUnitIds = useMemo(() => {
        const map = new Map<number, number[]>();
        for (const cu of charaUnits) {
            if (cu.gameCharacterId >= 21 && cu.gameCharacterId <= 26) {
                if (!map.has(cu.gameCharacterId)) map.set(cu.gameCharacterId, []);
                map.get(cu.gameCharacterId)!.push(cu.id);
            }
        }
        return map;
    }, [charaUnits]);

    const eventUnitMap = useMemo(() => {
        if (actionSetsForUnitMap.length === 0) return new Map<number, string>();
        const rawMap = buildEventRawUnitMap(actionSetsForUnitMap);
        const filterMap = new Map<number, string>();
        for (const [eventId, rawType] of rawMap) {
            filterMap.set(eventId, rawUnitToFilterId(rawType));
        }
        return filterMap;
    }, [actionSetsForUnitMap]);

    const eventBannerCharMapDerived = useMemo(() => {
        if (eventStories.length === 0 || charaUnits.length === 0) return new Map<number, number>();
        return buildEventBannerCharMap(eventStories, charaUnits);
    }, [eventStories, charaUnits]);

    const eventBonusAttrMap = useMemo(() => {
        const map = new Map<number, string>();
        for (const bonus of deckBonuses) {
            if (bonus.cardAttr && !bonus.gameCharacterUnitId) {
                map.set(bonus.eventId, bonus.cardAttr);
            }
        }
        return map;
    }, [deckBonuses]);

    const eventStoryIds = useMemo(() => new Set(eventStories.map(s => s.eventId)), [eventStories]);

    // Filter events — same logic as useEventListData
    const filteredEvents = useMemo(() => {
        let result = [...events];

        if (selectedTypes.length > 0) {
            result = result.filter(e => selectedTypes.includes(e.eventType as EventType));
        }

        if (selectedEventUnits.length > 0) {
            result = result.filter(e => {
                const uid = eventUnitMap.get(e.id);
                return uid ? selectedEventUnits.includes(uid as EventUnitFilterId) : false;
            });
        }

        if (selectedCharacters.length > 0) {
            result = result.filter(e => {
                const bonusUnitIds = eventBonusCharMap.get(e.id);
                if (!bonusUnitIds) return false;
                return selectedCharacters.every(charId => {
                    if (charId >= 21 && charId <= 26) {
                        const allIds = vsCharAllUnitIds.get(charId);
                        return allIds ? allIds.some(id => bonusUnitIds.has(id)) : false;
                    }
                    return bonusUnitIds.has(charId);
                });
            });
        }

        if (selectedBannerChars.length > 0) {
            result = result.filter(e => {
                if (e.eventType === "world_bloom") return false;
                const bannerCharId = eventBannerCharMapDerived.get(e.id);
                return bannerCharId !== undefined && selectedBannerChars.includes(bannerCharId);
            });
        }

        if (selectedBonusAttr) {
            result = result.filter(e => eventBonusAttrMap.get(e.id) === selectedBonusAttr);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const qNum = parseInt(q, 10);
            result = result.filter(e => {
                if (e.id === qNum) return true;
                if (e.name.toLowerCase().includes(q)) return true;
                const cn = translations?.events?.name?.[e.name];
                if (cn && cn.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        if (!isShowSpoiler) {
            result = result.filter(e => e.startAt <= Date.now());
        }

        result.sort((a, b) => {
            const cmp = sortBy === "startAt" ? a.startAt - b.startAt : a.id - b.id;
            return sortOrder === "asc" ? cmp : -cmp;
        });

        return result;
    }, [events, selectedTypes, selectedEventUnits, eventUnitMap, selectedCharacters, eventBonusCharMap, vsCharAllUnitIds, selectedBannerChars, eventBannerCharMapDerived, selectedBonusAttr, eventBonusAttrMap, searchQuery, sortBy, sortOrder, translations, isShowSpoiler]);

    // Get currently selected event object
    const selectedEvent = useMemo(() => {
        if (!selectedEventId) return null;
        return events.find(e => e.id.toString() === selectedEventId) || null;
    }, [events, selectedEventId]);

    // Notify parent of event type when selected event resolves (including initial load)
    useEffect(() => {
        onEventTypeChange?.(selectedEvent?.eventType ?? null);
    }, [selectedEvent, onEventTypeChange]);

    const handleSelect = (event: IEventInfo) => {
        onSelect(event.id.toString(), event.eventType);
        setModalOpen(false);
    };

    const handleReset = () => {
        setSelectedTypes([]);
        setSelectedEventUnits([]);
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setSelectedBannerChars([]);
        setSelectedBannerUnitIds([]);
        setSelectedBonusAttr(null);
        setSearchQuery("");
        setSortBy("startAt");
        setSortOrder("desc");
    };

    // Thumbnail for the trigger button
    const selectedEventThumbnail = useMemo(() => {
        if (!selectedEvent) return "";
        const hasStoryBanner = eventStoryIds.has(selectedEvent.id);
        return hasStoryBanner
            ? getEventStoryBannerUrl(selectedEvent.assetbundleName, assetSource)
            : getEventLogoUrl(selectedEvent.assetbundleName, assetSource);
    }, [selectedEvent, eventStoryIds, assetSource]);

    const selectedEventHasStoryBanner = selectedEvent ? eventStoryIds.has(selectedEvent.id) : false;

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                活动ID <span className="text-red-400">*</span>
            </label>

            <button
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-miku/50 transition-all text-left shadow-sm group"
            >
                {selectedEvent ? (
                    <>
                        <div className="relative w-16 aspect-video bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                            <Image
                                src={selectedEventThumbnail}
                                alt={selectedEvent.name}
                                fill
                                className={`object-contain ${selectedEventHasStoryBanner ? "" : "p-1"}`}
                                unoptimized
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 rounded-md">
                                    #{selectedEvent.id}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(selectedEvent.startAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="text-sm font-bold text-slate-700 truncate group-hover:text-miku transition-colors">
                                {selectedEvent.name}
                            </div>
                            {translations?.events?.name?.[selectedEvent.name] && (
                                <div className="text-xs text-slate-400 truncate">
                                    {translations.events.name[selectedEvent.name]}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="text-slate-400 text-sm">点击选择活动...</span>
                    </>
                )}
                <div className="text-slate-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </div>
            </button>

            <SelectorModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title="选择活动"
            >
                <div className="space-y-6">
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
                        selectedBannerChars={selectedBannerChars}
                        onBannerCharsChange={setSelectedBannerChars}
                        selectedBannerUnitIds={selectedBannerUnitIds}
                        onBannerUnitIdsChange={setSelectedBannerUnitIds}
                        selectedBonusAttr={selectedBonusAttr}
                        onBonusAttrChange={setSelectedBonusAttr}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={(nextSortBy, nextSortOrder) => {
                            setSortBy(nextSortBy);
                            setSortOrder(nextSortOrder);
                        }}
                        onReset={handleReset}
                        totalEvents={events.length}
                        filteredEvents={filteredEvents.length}
                    />

                    {loading ? (
                        <div className="py-20 text-center text-slate-400">加载中...</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {filteredEvents.slice(0, 50).map(event => (
                                <EventSelectionItem
                                    key={event.id}
                                    event={event}
                                    isSpoiler={event.startAt > Date.now()}
                                    unitType={eventUnitMap.get(event.id)}
                                    bonusAttr={eventBonusAttrMap.get(event.id)}
                                    eventStoryIds={eventStoryIds}
                                    onClick={() => handleSelect(event)}
                                />
                            ))}
                            {filteredEvents.length > 50 && (
                                <div className="col-span-full py-4 text-center text-slate-400 text-sm">
                                    仅显示前 50 个结果，请使用搜索精确查找
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SelectorModal>
        </div>
    );
}

// EventItem-style card for selection (div instead of Link)
function EventSelectionItem({
    event,
    isSpoiler,
    unitType,
    bonusAttr,
    eventStoryIds,
    onClick,
}: {
    event: IEventInfo;
    isSpoiler?: boolean;
    unitType?: string;
    bonusAttr?: string;
    eventStoryIds?: Set<number>;
    onClick: () => void;
}) {
    const { assetSource } = useTheme();
    const hasEventStoryBanner = eventStoryIds ? eventStoryIds.has(event.id) : true;
    const thumbnailUrl = hasEventStoryBanner
        ? getEventStoryBannerUrl(event.assetbundleName, assetSource)
        : getEventLogoUrl(event.assetbundleName, assetSource);
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div
            onClick={onClick}
            className="group block cursor-pointer"
        >
            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:ring-miku/30">
                {/* Event Thumbnail */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                    <Image
                        src={thumbnailUrl}
                        alt={event.name}
                        fill
                        className={`object-contain transition-transform duration-300 group-hover:scale-105 ${hasEventStoryBanner ? "" : "p-4"}`}
                        unoptimized
                    />

                    {/* Status Badge */}
                    <div
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {statusDisplay.label}
                    </div>

                    {/* Event Type Badge */}
                    <div
                        className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                    >
                        {EVENT_TYPE_NAMES[event.eventType as EventType]}
                    </div>

                    {/* Spoiler Badge */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 sm:px-2 py-0.5 bg-orange-500 rounded-full text-[10px] sm:text-xs font-bold text-white shadow">
                            剧透
                        </div>
                    )}
                </div>

                {/* Event Info */}
                <div className="p-2.5 sm:p-4">
                    {/* ID Badge + Unit Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] sm:text-xs font-mono rounded-full">
                            #{event.id}
                        </span>
                        {unitType && (
                            EVENT_UNIT_ICON[unitType] ? (
                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center" title={EVENT_UNIT_ICON[unitType].name}>
                                    <Image
                                        src={`/data/icon/${EVENT_UNIT_ICON[unitType].icon}`}
                                        alt={EVENT_UNIT_ICON[unitType].name}
                                        width={16}
                                        height={16}
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full" title="混合">混</span>
                            )
                        )}
                        {bonusAttr && ATTR_ICON_PATHS[bonusAttr as keyof typeof ATTR_ICON_PATHS] && (
                            <div className="w-5 h-5 flex items-center justify-center" title={ATTR_NAMES[bonusAttr as keyof typeof ATTR_NAMES]}>
                                <Image
                                    src={`/data/icon/${ATTR_ICON_PATHS[bonusAttr as keyof typeof ATTR_ICON_PATHS]}`}
                                    alt={ATTR_NAMES[bonusAttr as keyof typeof ATTR_NAMES] || bonusAttr}
                                    width={16}
                                    height={16}
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>

                    {/* Event Name */}
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm mb-1.5 sm:mb-2 group-hover:text-miku transition-colors">
                        <TranslatedText
                            original={event.name}
                            category="events"
                            field="name"
                            originalClassName=""
                            translationClassName="text-xs font-medium text-slate-400 mt-0.5"
                        />
                    </h3>

                    {/* Date Range */}
                    <div className="text-[10px] sm:text-xs text-slate-500 space-y-0.5 hidden sm:block">
                        <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{formatDate(event.startAt)}</span>
                            <span>~</span>
                            <span>{formatDate(event.aggregateAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
