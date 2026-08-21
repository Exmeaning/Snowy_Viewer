"use client";
import React from "react";
import { ICardInfo } from "@/types/types";
import CardItem from "./CardItem";
import { useI18n } from "@/contexts/I18nContext";

interface CardGridProps {
    cards: ICardInfo[];
    isLoading?: boolean;
    hrefPrefix?: string;
}

// Loading skeleton component
function CardSkeleton() {
    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden animate-pulse">
            <div className="aspect-[4/5] bg-[var(--hh-surface-sunken)]" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/2" />
            </div>
        </div>
    );
}

export default function CardGrid({ cards, isLoading = false, hrefPrefix }: CardGridProps) {
    const [now] = React.useState(() => Date.now());
    const { t } = useI18n();

    if (isLoading) {
        return (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="hh-well flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-16 h-16 text-[var(--hh-text-tertiary)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-[var(--hh-text-secondary)] font-medium">{t("page.cards.noResult")}</p>
                <p className="hh-body text-[var(--hh-text-tertiary)] text-sm mt-1">{t("page.cards.noResultHint")}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
            {cards.map((card) => {
                const isSpoiler = (card.releaseAt || card.archivePublishedAt || 0) > now;
                return <CardItem key={card.id} card={card} isSpoiler={isSpoiler} hrefPrefix={hrefPrefix} />;
            })}
        </div>
    );
}
