"use client";
import VirtualLiveItem from "./VirtualLiveItem";
import { IVirtualLiveInfo } from "@/types/virtualLive";

interface VirtualLiveGridProps {
    virtualLives: IVirtualLiveInfo[];
    isLoading?: boolean;
}

// Skeleton loading component
function VirtualLiveSkeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden animate-pulse">
            <div className="aspect-[16/5] bg-slate-200" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-16" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
        </div>
    );
}

export default function VirtualLiveGrid({ virtualLives, isLoading = false }: VirtualLiveGridProps) {
    // Show skeletons while loading
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-600 mb-2">没有找到演唱会</h3>
                <p className="text-slate-500 text-sm">尝试调整筛选条件</p>
            </div>
        );
    }

    const now = Date.now();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {virtualLives.map(virtualLive => {
                const isSpoiler = virtualLive.startAt > now;
                return <VirtualLiveItem key={virtualLive.id} virtualLive={virtualLive} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
