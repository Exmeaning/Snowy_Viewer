"use client";
import { Suspense } from "react";

import MainLayout from "@/components/MainLayout";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";
import EventGrid from "@/components/events/EventGrid";
import EventFilters from "@/components/events/EventFilters";
import { useEventListData } from "@/hooks/useEventListData";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";

function StoryEventListContent() {
    const { t } = useI18n();
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

    useQuickFilter(t("page.story.event.filterTitle"), quickFilterContent, [
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
        t,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <StoryPageHeader storyKey="event" />

            {data.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("common.state.loadingFailed")}</p>
                    <p>{data.error}</p>
                    <button onClick={() => window.location.reload()} className="mt-2 text-red-500 underline hover:no-underline">{t("common.action.retry")}</button>
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
                                className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                            >
                                {t("page.story.event.loadMore")}
                                <span className="ml-2 text-sm opacity-80">
                                    ({data.displayedEvents.length} / {data.filteredEvents.length})
                                </span>
                            </button>
                        </div>
                    )}
                    {!data.isLoading && data.displayedEvents.length > 0 && data.displayedEvents.length >= data.filteredEvents.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            {t("page.story.event.allLoaded", { count: data.filteredEvents.length })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StoryEventListClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.story.event.loadingFallback")}</div>}>
                <StoryEventListContent />
            </Suspense>
        </MainLayout>
    );
}
