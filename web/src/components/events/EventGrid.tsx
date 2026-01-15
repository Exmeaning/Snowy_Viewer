"use client";
import EventItem from "./EventItem";
import { IEventInfo } from "@/types/events";

interface EventGridProps {
    events: IEventInfo[];
    isLoading?: boolean;
}

// Skeleton loading component
function EventSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden animate-pulse">
            <div className="aspect-[16/9] bg-slate-200" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-16" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
        </div>
    );
}

export default function EventGrid({ events, isLoading = false }: EventGridProps) {
    // Show skeletons while loading
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-600 mb-2">没有找到活动</h3>
                <p className="text-slate-500 text-sm">尝试调整筛选条件</p>
            </div>
        );
    }

    const now = Date.now();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {events.map(event => {
                const isSpoiler = event.startAt > now;
                return <EventItem key={event.id} event={event} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
