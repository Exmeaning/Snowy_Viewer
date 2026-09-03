"use client";
import React from "react";
import Link from "@/components/LocalizedLink";
import { ICardInfo, isTrainableCard, getCardDefaultTrainedStatus } from "@/types/types";
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

    // Show trained thumbnail if the card's default art is after_training
    // (e.g. cards 1167 / 1458-1463 that have no normal art),
    // or when the user setting is on and the card is trainable.
    const showTrainedThumbnail = getCardDefaultTrainedStatus(card) ||
        (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

    return (
        <Link href={`${hrefPrefix}/${card.id}`} className="group pressable block" data-shortcut-item="true">
            <div className="relative cursor-pointer rounded-xl overflow-hidden ios-glass-card ios-glass-card-interactive">
                {/* Card Image Container */}
                <div className="w-full relative">
                    <SekaiCardThumbnail
                        card={card}
                        trained={showTrainedThumbnail}
                        className="w-full"
                    />
                </div>

                {/* Card Info - Persistent Footer */}
                <div className="px-2 py-1.5 bg-slate-50/30 dark:bg-slate-900/30 border-t border-slate-200/50 dark:border-slate-800">
                    {/* Spoiler Badge - inline in footer */}
                    {isSpoiler && (
                        <div className="mb-0.5">
                            <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded leading-none">
                                {t("common.badge.spoiler")}
                            </span>
                        </div>
                    )}
                    <div className="mb-0.5">
                        <TranslatedText
                            original={card.prefix}
                            category="cards"
                            field="prefix"
                            originalClassName="text-slate-800 dark:text-slate-200 text-[10px] type-on-glass font-bold truncate leading-tight group-hover:text-miku block"
                            translationClassName="text-slate-400 dark:text-slate-500 text-[9px] type-caption truncate leading-tight block"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                        <p className="text-slate-400 dark:text-slate-500 text-[9px] type-caption truncate leading-tight flex-1">{characterName}</p>
                        <span className="flex-shrink-0 text-[8px] text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 ios-glass-tab px-1 py-0.5 rounded leading-none font-mono">
                            ID:{card.id}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
