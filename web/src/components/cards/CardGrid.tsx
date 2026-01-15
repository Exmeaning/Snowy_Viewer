"use client";
import React from "react";
import { ICardInfo } from "@/types/types";
import CardItem from "./CardItem";

interface CardGridProps {
    cards: ICardInfo[];
    isLoading?: boolean;
}

// Loading skeleton component
function CardSkeleton() {
    return (
        <div className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse">
            <div className="aspect-[4/5] bg-gradient-to-br from-slate-100 to-slate-200" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
        </div>
    );
}

export default function CardGrid({ cards, isLoading = false }: CardGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-slate-400 font-medium">没有找到符合条件的卡牌</p>
                <p className="text-slate-300 text-sm mt-1">尝试调整筛选条件</p>
            </div>
        );
    }

    const now = Date.now();

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
            {cards.map((card) => {
                const isSpoiler = (card.releaseAt || card.archivePublishedAt || 0) > now;
                return <CardItem key={card.id} card={card} isSpoiler={isSpoiler} />;
            })}
        </div>
    );
}
