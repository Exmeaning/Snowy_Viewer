"use client";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import EventGrid from "@/components/events/EventGrid";
import EventFilters from "@/components/events/EventFilters";
import { useEventListData } from "@/hooks/useEventListData";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";

function EventsContent() {
    const { t } = useI18n();
    const data = useEventListData({ storageKey: "events", basePath: "/events" });

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

    useQuickFilter(t("page.events.filterTitle"), quickFilterContent, [
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
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.events.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.events.title")} <span className="text-miku">{t("page.events.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.events.description")}
                </p>
            </div>

            {/* Error State */}
            {data.error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("common.state.loadingFailed")}</p>
                    <p>{data.error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-500 underline hover:no-underline"
                    >
                        {t("common.action.retry")}
                    </button>
                </div>
            )}

            {/* Event Grid. Filters live in the global FilterDrawer (registered
                above via useQuickFilter), so the page body is a single column. */}
            <div className="min-w-0">
                <EventGrid events={data.displayedEvents} isLoading={data.isLoading} eventUnitMap={data.eventUnitMap} eventBannerCharMap={data.eventBannerCharMap} eventBonusAttrMap={data.eventBonusAttrMap} eventStoryIds={data.eventStoryIds} />

                {/* Load More Button */}
                {!data.isLoading && data.displayedEvents.length < data.filteredEvents.length && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={data.loadMore}
                            data-shortcut-load-more="true"
                            className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                        >
                            {t("page.events.loadMore")}
                            <span className="ml-2 text-sm opacity-80 type-caption">
                                ({data.displayedEvents.length} / {data.filteredEvents.length})
                            </span>
                        </button>
                    </div>
                )}

                {/* All loaded indicator */}
                {!data.isLoading && data.displayedEvents.length > 0 && data.displayedEvents.length >= data.filteredEvents.length && (
                    <div className="mt-8 text-center text-slate-400 text-sm">
                        {t("page.events.allLoaded", { count: data.filteredEvents.length })}
                    </div>
                )}
            </div>
        </div>
    );
}

function EventsLoadingFallback() {
    const { t } = useI18n();
    return <div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.events.loadingFallback")}</div>;
}

export default function EventsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<EventsLoadingFallback />}>
                <EventsContent />
            </Suspense>
        </MainLayout>
    );
}
