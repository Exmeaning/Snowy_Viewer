"use client";
import VirtualLiveItem from "./VirtualLiveItem";
import { IVirtualLiveInfo } from "@/types/virtualLive";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface VirtualLiveGridProps {
    virtualLives: IVirtualLiveInfo[];
    isLoading?: boolean;
}

// Skeleton loading component
function VirtualLiveSkeleton() {
    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden animate-pulse">
            <div className="aspect-[16/5] bg-[var(--hh-surface-sunken)]" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-16" />
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/2" />
            </div>
        </div>
    );
}

export default function VirtualLiveGrid({ virtualLives, isLoading = false }: VirtualLiveGridProps) {
    const [now] = useState(() => Date.now());
    const { t } = useI18n();

    // Show skeletons while loading
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <VirtualLiveSkeleton key={i} />
                ))}
            </div>
        );
    }

    // Empty state
    if (virtualLives.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[var(--hh-surface-sunken)] flex items-center justify-center">
                    <svg className="w-12 h-12 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <h3 className="hh-title text-lg font-bold text-[var(--hh-text-primary)] mb-2">{t("page.live.noResult")}</h3>
                <p className="hh-body text-[var(--hh-text-secondary)] text-sm">{t("page.live.noResultHint")}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {virtualLives.map(virtualLive => {
                const isSpoiler = virtualLive.startAt > now;
                return <VirtualLiveItem key={virtualLive.id} virtualLive={virtualLive} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
