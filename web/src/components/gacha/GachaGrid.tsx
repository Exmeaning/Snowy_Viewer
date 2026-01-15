"use client";
import React from "react";
import GachaItem from "./GachaItem";
import { IGachaInfo } from "@/types/types";

interface GachaGridProps {
    gachas: IGachaInfo[];
    isLoading?: boolean;
}

// Skeleton component for loading state
function GachaSkeleton() {
    return (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-100 animate-pulse">
            <div className="aspect-[16/9] bg-slate-100" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
        </div>
    );
}

export default function GachaGrid({ gachas, isLoading = false }: GachaGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <GachaSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (gachas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="font-bold">没有找到扭蛋</p>
                <p className="text-sm">尝试调整筛选条件</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gachas.map((gacha) => (
                <GachaItem key={gacha.id} gacha={gacha} />
            ))}
        </div>
    );
}
