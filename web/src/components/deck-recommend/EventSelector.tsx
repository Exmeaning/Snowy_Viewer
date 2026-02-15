"use client";
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { IEventInfo, EventType } from "@/types/events";
import { fetchMasterData } from "@/lib/fetch";
import { getEventLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import SelectorModal from "./SelectorModal";
import EventFilters from "@/components/events/EventFilters";
import EventItem from "@/components/events/EventItem";

interface EventSelectorProps {
    selectedEventId: string;
    onSelect: (eventId: string) => void;
}

export default function EventSelector({ selectedEventId, onSelect }: EventSelectorProps) {
    const { assetSource } = useTheme();
    const [events, setEvents] = useState<IEventInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    // Filters state
    const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "startAt">("startAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Load events on mount
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchMasterData<IEventInfo[]>("events.json"),
            loadTranslations()
        ])
            .then(([eventsData, translationsData]) => {
                setEvents(eventsData);
                setTranslations(translationsData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load events or translations", err);
                setLoading(false);
            });
    }, []);

    // Filter events
    const filteredEvents = useMemo(() => {
        let result = [...events];

        // Type filter
        if (selectedTypes.length > 0) {
            result = result.filter(e => selectedTypes.includes(e.eventType));
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => {
                // Match by ID
                if (e.id.toString().includes(q)) return true;
                // Match by Japanese name
                if (e.name.toLowerCase().includes(q)) return true;
                // Match by Chinese name translation
                const chineseName = translations?.events?.name?.[e.name];
                if (chineseName && chineseName.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // Sort
        result.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        return result;
    }, [events, selectedTypes, searchQuery, sortBy, sortOrder, translations]);

    // Get currently selected event object
    const selectedEvent = useMemo(() => {
        if (!selectedEventId) return null;
        return events.find(e => e.id.toString() === selectedEventId) || null;
    }, [events, selectedEventId]);

    const handleSelect = (event: IEventInfo) => {
        onSelect(event.id.toString());
        setModalOpen(false);
    };

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
                                src={getEventLogoUrl(selectedEvent.assetbundleName, assetSource)}
                                alt={selectedEvent.name}
                                fill
                                className="object-contain p-1"
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
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={setSortBy as any}
                        onReset={() => {
                            setSelectedTypes([]);
                            setSearchQuery("");
                            setSortBy("startAt");
                            setSortOrder("desc");
                        }}
                        totalEvents={events.length}
                        filteredEvents={filteredEvents.length}
                    />

                    {loading ? (
                        <div className="py-20 text-center text-slate-400">加载中...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredEvents.slice(0, 50).map(event => (
                                <div
                                    key={event.id}
                                    onClick={() => handleSelect(event)}
                                    className="cursor-pointer"
                                >
                                    {/* We wrap EventItem in a div to capture click, and pass a dummy basePath to avoid navigation if we clicked the link inside (though EventItem wraps in Link, we might need to prevent default or just rely on the wrapper if we can make EventItem not a Link? EventItem IS a Link... so we might need a custom renderer or just use EventItem's visual part. 
                                    
                                    Actually, EventItem returns a Link. Clicking it will navigate. We should probably NOT use EventItem directly if it forces navigation, or we should accept that it navigates. But we want to SELECT, not navigate.
                                    
                                    I should probably duplicate the visual part of EventItem or make EventItem accept an onClick and disable Link.
                                    EventItem source checks: it wraps everything in <Link>.
                                    
                                    I will copy the visual structure of EventItem into a local component or simplified version for selection to avoid navigation.
                                    */}
                                    <EventSelectionItem event={event} translations={translations} />
                                </div>
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

// Simplified EventItem for selection (no Link)
function EventSelectionItem({ event, translations }: { event: IEventInfo, translations: TranslationData | null }) {
    const { assetSource } = useTheme();
    const logoUrl = getEventLogoUrl(event.assetbundleName, assetSource);

    return (
        <div className="group bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all hover:shadow-md hover:ring-miku/50 active:scale-[0.98]">
            <div className="relative aspect-[16/9] bg-slate-50 overflow-hidden">
                <Image
                    src={logoUrl}
                    alt={event.name}
                    fill
                    className="object-contain p-2"
                    unoptimized
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/50 text-white text-[10px] font-mono">
                    #{event.id}
                </div>
            </div>
            <div className="p-3">
                <h3 className="font-bold text-slate-700 text-sm line-clamp-1 mb-0.5 group-hover:text-miku transition-colors">
                    {event.name}
                </h3>
                {translations?.events?.name?.[event.name] && (
                    <div className="text-xs text-slate-500 line-clamp-1 mb-1">
                        {translations.events.name[event.name]}
                    </div>
                )}
                <div className="text-xs text-slate-400">
                    {new Date(event.startAt).toLocaleDateString()}
                </div>
            </div>
        </div>
    );
}
