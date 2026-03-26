"use client";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import EventGrid from "@/components/events/EventGrid";
import EventFilters from "@/components/events/EventFilters";
import { useEventListData } from "@/hooks/useEventListData";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

function StoryEventListContent() {
    const data = useEventListData({ storageKey: "story_event", basePath: "/story/event" });

    const quickFilterContent = (
        <EventFilters
            selectedTypes={data.selectedTypes}
            onTypeChange={data.setSelectedTypes}
            selectedEventUnits={data.selectedEventUnits}
            onEventUnitChange={data.setSelectedEventUnits}
            selectedCharacters={data.selectedCharacters}
            onCharacterChange={data.setSelectedCharacters}
            selectedUnitIds={data.selectedUnitIds}
            onUnitIdsChange={data.setSelectedUnitIds}
            charaUnits={data.charaUnits}
            selectedBannerChars={data.selectedBannerChars}
            onBannerCharsChange={data.setSelectedBannerChars}
            selectedBannerUnitIds={data.selectedBannerUnitIds}
            onBannerUnitIdsChange={data.setSelectedBannerUnitIds}
            selectedBonusAttr={data.selectedBonusAttr}
            onBonusAttrChange={data.setSelectedBonusAttr}
            searchQuery={data.searchQuery}
            onSearchChange={data.setSearchQuery}
            sortBy={data.sortBy}
            sortOrder={data.sortOrder}
            onSortChange={data.handleSortChange}
            onReset={data.resetFilters}
            totalEvents={data.events.length}
            filteredEvents={data.filteredEvents.length}
        />
    );

    useQuickFilter("活动剧情筛选", quickFilterContent, [
        data.selectedTypes,
        data.selectedEventUnits,
        data.selectedCharacters,
        data.selectedUnitIds,
        data.selectedBannerChars,
        data.selectedBannerUnitIds,
        data.selectedBonusAttr,
        data.searchQuery,
        data.sortBy,
        data.sortOrder,
        data.events.length,
        data.filteredEvents.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">剧情阅读</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    活动 <span className="text-miku">剧情</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">选择活动并阅读剧情</p>
            </div>

            {data.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{data.error}</p>
                    <button onClick={() => window.location.reload()} className="mt-2 text-red-500 underline hover:no-underline">重试</button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <EventGrid
                        events={data.displayedEvents}
                        isLoading={data.isLoading}
                        basePath="/story/event"
                        eventUnitMap={data.eventUnitMap}
                        eventBannerCharMap={data.eventBannerCharMap}
                        eventBonusAttrMap={data.eventBonusAttrMap}
                        eventStoryIds={data.eventStoryIds}
                    />
                    {!data.isLoading && data.displayedEvents.length < data.filteredEvents.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={data.loadMore}
                                data-shortcut-load-more="true"
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({data.displayedEvents.length} / {data.filteredEvents.length})
                                </span>
                            </button>
                        </div>
                    )}
                    {!data.isLoading && data.displayedEvents.length > 0 && data.displayedEvents.length >= data.filteredEvents.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {data.filteredEvents.length} 个活动
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StoryEventListClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载活动剧情...</div>}>
                <StoryEventListContent />
            </Suspense>
        </MainLayout>
    );
}
