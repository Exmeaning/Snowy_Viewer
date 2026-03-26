"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ICardInfo } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import CardItem from "@/components/cards/CardItem";

export default function LatestCardsTab() {
    const { isShowSpoiler } = useTheme();
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                // We don't need translations here as CardItem handles it internally
                const cardsData = await fetchMasterData<ICardInfo[]>("cards.json");

                // Filter and sort by releaseAt
                const now = Date.now();
                const filteredCards = cardsData
                    .filter(card => isShowSpoiler || (card.releaseAt || card.archivePublishedAt || 0) <= now)
                    .sort((a, b) => (b.releaseAt || 0) - (a.releaseAt || 0))
                    .slice(0, 6);

                setCards(filteredCards);
                setError(null);
            } catch (err) {
                console.error("Error fetching cards data:", err);
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-square rounded-xl bg-slate-100" />
                        <div className="mt-2 h-3 bg-slate-100 rounded w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm text-center">
                <p className="font-bold">加载卡牌失败</p>
                <p>{error}</p>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-medium">暂无卡牌数据</p>
            </div>
        );
    }

    return (
        <div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {cards.map((card) => {
                    const now = Date.now();
                    const isSpoiler = (card.releaseAt || card.archivePublishedAt || 0) > now;
                    return <CardItem key={card.id} card={card} isSpoiler={isSpoiler} />;
                })}
            </div>
            {/* View All Link */}
            <div className="mt-4 text-center">
                <Link href="/cards" className="inline-flex items-center gap-1 text-sm text-miku hover:text-miku-dark font-medium transition-colors">
                    查看全部卡牌
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
