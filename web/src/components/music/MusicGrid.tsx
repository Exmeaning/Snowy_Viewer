"use client";
import MusicItem from "./MusicItem";
import { IMusicInfo } from "@/types/music";

interface MusicGridProps {
    musics: IMusicInfo[];
    isLoading: boolean;
}

// Skeleton component for loading state
function MusicSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="rounded-xl overflow-hidden bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="aspect-square bg-slate-200 dark:bg-slate-700"></div>
                <div className="p-3 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
            </div>
        </div>
    );
}

export default function MusicGrid({ musics, isLoading }: MusicGridProps) {
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
            <div className="text-center py-16">
                <div className="text-6xl mb-4">🎵</div>
                <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400 mb-2">
                    没有找到匹配的音乐
                </h3>
                <p className="text-slate-500 dark:text-slate-500">
                    尝试调整筛选条件
                </p>
            </div>
        );
    }

    const now = Date.now();

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {musics.map((music) => {
                const isSpoiler = music.publishedAt > now;
                return <MusicItem key={music.id} music={music} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
