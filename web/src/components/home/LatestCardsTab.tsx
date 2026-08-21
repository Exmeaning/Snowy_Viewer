"use client";
import { useState, useEffect, type CSSProperties } from "react";
import Link from "@/components/LocalizedLink";
import { ICardInfo } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import CardItem from "@/components/cards/CardItem";
import { useI18n } from "@/contexts/I18nContext";

export default function LatestCardsTab() {
    const { isShowSpoiler } = useTheme();
    const { t } = useI18n();
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
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler, t]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-square rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-sunken)]" />
                        <div className="mt-2 h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="hh-tile hh-tile-tint p-6 rounded-[var(--hh-radius-lg)] text-red-600 text-sm text-center"
                style={{ "--hh-tint": "var(--hh-accent-alert)" } as CSSProperties}
            >
                <p className="font-bold">{t("page.home.latestCards.loadFailedTitle")}</p>
                <p>{error}</p>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="hh-well p-8 text-center text-[var(--hh-text-tertiary)]">
                <p className="font-medium">{t("page.home.latestCards.noData")}</p>
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
                    {t("page.home.latestCards.viewAll")}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
