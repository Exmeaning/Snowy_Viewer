"use client";
import React from "react";
import Link from "@/components/LocalizedLink";
import { ICardInfo, isTrainableCard } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslatedText } from "@/components/common/TranslatedText";
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
    const translatedPrefix = useTranslatedText(card.prefix, "cards", "prefix");

    // Cards that only have trained images (no normal version)
    const TRAINED_ONLY_CARDS = [1167];
    const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);

    // Determine if we should show trained thumbnail (3★+ cards, not birthday, or forced for special cards)
    const showTrainedThumbnail = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

    return (
        <Link
            href={`${hrefPrefix}/${card.id}`}
            className="hh-card-item block h-full flex flex-col select-none cursor-pointer overflow-hidden group"
            data-shortcut-item="true"
        >
            {/* Card Image Container */}
            <div className="w-full relative shrink-0">
                <SekaiCardThumbnail
                    card={card}
                    trained={showTrainedThumbnail}
                    className="w-full"
                />

                {/* Spoiler Badge Overlay */}
                {isSpoiler && (
                    <div className="absolute top-1.5 left-1.5 z-10 pointer-events-none">
                        <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-[var(--hh-radius-xs)] shadow-sm leading-none">
                            {t("common.badge.spoiler")}
                        </span>
                    </div>
                )}
            </div>

            {/* Card Info Footer with uniform fixed-height text slot */}
            <div className="hh-card-footer px-2 py-1.5 flex flex-col justify-between flex-1 min-h-[50px]">
                <div className="h-[27px] flex flex-col justify-start mb-0.5 overflow-hidden">
                    <span className="hh-card-title text-[var(--hh-text-primary)] text-[10px] font-bold truncate leading-tight block">
                        {card.prefix}
                    </span>
                    {translatedPrefix ? (
                        <span className="hh-body text-[var(--hh-text-tertiary)] text-[9px] truncate leading-tight block">
                            {translatedPrefix}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 mt-auto">
                    <p className="hh-body text-[var(--hh-text-tertiary)] text-[9px] truncate leading-tight flex-1">
                        {characterName}
                    </p>
                    <span className="hh-numeric flex-shrink-0 text-[8px] text-[var(--hh-text-tertiary)] bg-[var(--hh-surface-sunken)] px-1 py-0.5 rounded-[var(--hh-radius-xs)] leading-none transition-colors">
                        ID:{card.id}
                    </span>
                </div>
            </div>
        </Link>
    );
}
