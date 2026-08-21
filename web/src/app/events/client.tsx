"use client";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import PageHeader from "@/components/common/PageHeader";
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
            <PageHeader
                badge={t("page.events.badge")}
                title={t("page.events.title")}
                titleHighlight={t("page.events.titleHighlight")}
                description={t("page.events.description")}
            />

            {/* Error State */}
            {data.error && (
                <div className="mb-6 p-4 bg-red-500/12 border border-red-500/30 rounded-[var(--hh-radius-lg)] text-red-600 text-sm">
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

            {/* Event Grid */}
            <div className="w-full min-w-0">
                <EventGrid events={data.displayedEvents} isLoading={data.isLoading} eventUnitMap={data.eventUnitMap} eventBannerCharMap={data.eventBannerCharMap} eventBonusAttrMap={data.eventBonusAttrMap} eventStoryIds={data.eventStoryIds} />

                {/* Load More Button */}
                {!data.isLoading && data.displayedEvents.length < data.filteredEvents.length && (
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={data.loadMore}
                            data-shortcut-load-more="true"
                            className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3 font-bold"
                        >
                            {t("page.events.loadMore")}
                            <span className="hh-numeric ml-2 text-sm opacity-80">
                                ({data.displayedEvents.length} / {data.filteredEvents.length})
                            </span>
                        </button>
                    </div>
                )}

                {/* All loaded indicator */}
                {!data.isLoading && data.displayedEvents.length > 0 && data.displayedEvents.length >= data.filteredEvents.length && (
                    <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm">
                        {t("page.events.allLoaded", { count: data.filteredEvents.length })}
                    </div>
                )}
            </div>
        </div>
    );
}

function EventsLoadingFallback() {
    const { t } = useI18n();
    return <div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.events.loadingFallback")}</div>;
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
