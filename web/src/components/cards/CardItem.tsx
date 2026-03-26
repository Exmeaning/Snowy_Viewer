"use client";
import React from "react";
import Link from "next/link";
import { ICardInfo, CHARACTER_NAMES, isTrainableCard, getRarityNumber, RARITY_DISPLAY } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { TranslatedText } from "@/components/common/TranslatedText";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";

interface CardItemProps {
    card: ICardInfo;
    isSpoiler?: boolean;
}

export default function CardItem({ card, isSpoiler }: CardItemProps) {
    const { useTrainedThumbnail } = useTheme();
    const characterName = CHARACTER_NAMES[card.characterId] || `Character ${card.characterId}`;

    // Cards that only have trained images (no normal version)
    const TRAINED_ONLY_CARDS = [1167];
    const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);

    // Determine if we should show trained thumbnail (3★+ cards, not birthday, or forced for special cards)
    const showTrainedThumbnail = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

    return (
        <Link href={`/cards/${card.id}`} className="group block" data-shortcut-item="true">
            <div className="relative cursor-pointer rounded-xl overflow-hidden transition-all bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-xl hover:-translate-y-1">
                {/* Card Image Container */}
                <div className="w-full relative">
                    <SekaiCardThumbnail
                        card={card}
                        trained={showTrainedThumbnail}
                        className="w-full"
                    />
                </div>

                {/* Card Info - Persistent Footer */}
                <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                    {/* Spoiler Badge - inline in footer */}
                    {isSpoiler && (
                        <div className="mb-0.5">
                            <span className="inline-block px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded leading-none">
                                剧透
                            </span>
                        </div>
                    )}
                    <div className="mb-0.5">
                        <TranslatedText
                            original={card.prefix}
                            category="cards"
                            field="prefix"
                            originalClassName="text-slate-800 text-[10px] font-bold truncate leading-tight group-hover:text-miku transition-colors block"
                            translationClassName="text-slate-400 text-[9px] truncate leading-tight block"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                        <p className="text-slate-400 text-[9px] truncate leading-tight flex-1">{characterName}</p>
                        <span className="flex-shrink-0 text-[8px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded leading-none font-mono">
                            ID:{card.id}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
