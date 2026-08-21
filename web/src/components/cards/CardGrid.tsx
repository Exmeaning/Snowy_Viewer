"use client";
import React from "react";
import { ICardInfo } from "@/types/types";
import CardItem from "./CardItem";
import { useI18n } from "@/contexts/I18nContext";
import { HandheldEmptyState } from "@/components/handheld";

interface CardGridProps {
    cards: ICardInfo[];
    isLoading?: boolean;
    hrefPrefix?: string;
}

// Loading skeleton component
function CardSkeleton() {
    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden animate-pulse flex flex-col">
            <div className="aspect-square bg-[var(--hh-surface-sunken)]" />
            <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between min-h-[50px]">
                <div className="space-y-1">
                    <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                    <div className="h-2.5 bg-[var(--hh-surface-1)] rounded-[var(--hh-radius-xs)] w-1/2" />
                </div>
                <div className="flex justify-between items-center pt-1">
                    <div className="h-2.5 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/3" />
                    <div className="h-2.5 bg-[var(--hh-surface-1)] rounded-[var(--hh-radius-xs)] w-1/4" />
                </div>
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
            <HandheldEmptyState
                title={t("page.cards.noResult")}
                description={t("page.cards.noResultHint")}
                className="my-12"
            />
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
