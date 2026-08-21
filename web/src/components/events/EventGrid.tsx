"use client";
import EventItem from "./EventItem";
import { IEventInfo } from "@/types/events";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface EventGridProps {
    events: IEventInfo[];
    isLoading?: boolean;
    basePath?: string;
    eventUnitMap?: Map<number, string>;
    eventBannerCharMap?: Map<number, number>;
    eventBonusAttrMap?: Map<number, string>;
    eventStoryIds?: Set<number>;
}

// Skeleton loading component
function EventSkeleton() {
    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden animate-pulse">
            <div className="aspect-[16/9] bg-[var(--hh-surface-sunken)]" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-16" />
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/2" />
            </div>
        </div>
    );
}

export default function EventGrid({ events, isLoading = false, basePath = "/events", eventUnitMap, eventBannerCharMap: _eventBannerCharMap, eventBonusAttrMap, eventStoryIds }: EventGridProps) {
    const [now] = useState(() => Date.now());
    const { t } = useI18n();

    // Show skeletons while loading
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <EventSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Empty state
    if (events.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--hh-surface-sunken)] flex items-center justify-center">
                    <svg className="w-12 h-12 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="hh-title text-lg font-bold text-[var(--hh-text-primary)] mb-2">{t("page.events.noResult")}</h3>
                <p className="hh-body text-[var(--hh-text-secondary)] text-sm">{t("page.events.noResultHint")}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {events.map(event => {
                const isSpoiler = event.startAt > now;
                return <EventItem key={event.id} event={event} isSpoiler={isSpoiler} basePath={basePath} unitType={eventUnitMap?.get(event.id)} bonusAttr={eventBonusAttrMap?.get(event.id)} eventStoryIds={eventStoryIds} />;
            })}
        </div>
    );
}
