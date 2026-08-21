"use client";
import React from "react";
import Link from "@/components/LocalizedLink";
import { ICardInfo, isTrainableCard } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { TranslatedText } from "@/components/common/TranslatedText";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";

interface CardItemProps {
    card: ICardInfo;
    isSpoiler?: boolean;
    hrefPrefix?: string; // default: "/cards"
}

export default function CardItem({ card, isSpoiler, hrefPrefix = "/cards" }: CardItemProps) {
    const { useTrainedThumbnail } = useTheme();
    const { t } = useI18n();
    const characterName = getCharacterName(t, card.characterId);

    // Cards that only have trained images (no normal version)
    const TRAINED_ONLY_CARDS = [1167];
    const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);

    // Determine if we should show trained thumbnail (3★+ cards, not birthday, or forced for special cards)
    const showTrainedThumbnail = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

    return (
        <Link href={`${hrefPrefix}/${card.id}`} className="group hh-press block" data-shortcut-item="true">
            {/* A tile, not a floating card: hover recolors the border instead of
                lifting the item. Hundreds of these paint at once in the grid, so a
                per-item shadow/transform transition is both visually noisy and the
                most expensive thing on the page while scrolling. */}
            <div className="relative cursor-pointer rounded-[var(--hh-radius-lg)] overflow-hidden hh-tile transition-colors hover:border-[var(--hh-accent-line)]">
                {/* Card Image Container */}
                <div className="w-full relative">
                    <SekaiCardThumbnail
                        card={card}
                        trained={showTrainedThumbnail}
                        className="w-full"
                    />
                </div>

                {/* Card Info - Persistent Footer */}
                <div className="px-2 py-1.5 bg-[var(--hh-surface-1)] border-t border-[var(--hh-border)]">
                    {/* Spoiler Badge - inline in footer */}
                    {isSpoiler && (
                        <div className="mb-0.5">
                            <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-[var(--hh-radius-xs)] leading-none">
                                {t("common.badge.spoiler")}
                            </span>
                        </div>
                    )}
                    <div className="mb-0.5">
                        <TranslatedText
                            original={card.prefix}
                            category="cards"
                            field="prefix"
                            originalClassName="text-[var(--hh-text-primary)] text-[10px] font-bold truncate leading-tight group-hover:text-miku block"
                            translationClassName="hh-body text-[var(--hh-text-tertiary)] text-[9px] truncate leading-tight block"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                        <p className="hh-body text-[var(--hh-text-tertiary)] text-[9px] truncate leading-tight flex-1">{characterName}</p>
                        <span className="hh-numeric flex-shrink-0 text-[8px] text-[var(--hh-text-tertiary)] bg-[var(--hh-surface-sunken)] px-1 py-0.5 rounded-[var(--hh-radius-xs)] leading-none">
                            ID:{card.id}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
