"use client";
import MusicItem from "./MusicItem";
import { IMusicInfo } from "@/types/music";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";

interface MusicGridProps {
    musics: IMusicInfo[];
    isLoading: boolean;
}

// Skeleton component for loading state
function MusicSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                <div className="aspect-square bg-[var(--hh-surface-sunken)]"></div>
                <div className="p-3 space-y-2">
                    <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4"></div>
                    <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/2"></div>
                </div>
            </div>
        </div>
    );
}

export default function MusicGrid({ musics, isLoading }: MusicGridProps) {
    const [now] = useState(() => Date.now());
    const { t } = useI18n();

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 15 }).map((_, i) => (
                    <MusicSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (musics.length === 0) {
        return (
            <div className="hh-well text-center py-16">
                <div className="text-6xl mb-4">🎵</div>
                <h3 className="hh-title text-xl font-bold text-[var(--hh-text-primary)] mb-2">
                    {t("page.music.noResult")}
                </h3>
                <p className="hh-body text-[var(--hh-text-secondary)]">
                    {t("page.music.noResultHint")}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {musics.map((music) => {
                const isSpoiler = music.publishedAt > now;
                return <MusicItem key={music.id} music={music} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
