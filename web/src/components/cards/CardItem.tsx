"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ICardInfo, RARITY_TO_STARS, CHARACTER_NAMES, ATTR_COLORS, isTrainableCard, getRarityNumber, RARITY_DISPLAY } from "@/types/types";
import { getCardThumbnailUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

interface CardItemProps {
    card: ICardInfo;
    isSpoiler?: boolean;
}

export default function CardItem({ card, isSpoiler }: CardItemProps) {
    const { useTrainedThumbnail, assetSource } = useTheme();
    const rarityNum = getRarityNumber(card.cardRarityType);
    const rarityInfo = RARITY_DISPLAY[rarityNum] || RARITY_DISPLAY[4];
    const characterName = CHARACTER_NAMES[card.characterId] || `Character ${card.characterId}`;

    // Cards that only have trained images (no normal version)
    const TRAINED_ONLY_CARDS = [1167];
    const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);

    // Determine if we should show trained thumbnail (3★+ cards, not birthday, or forced for special cards)
    const showTrainedThumbnail = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

    let attrIconName = "";
    switch (card.attr) {
        case "cool": attrIconName = "Cool.webp"; break;
        case "cute": attrIconName = "cute.webp"; break;
        case "happy": attrIconName = "Happy.webp"; break;
        case "mysterious": attrIconName = "Mysterious.webp"; break;
        case "pure": attrIconName = "Pure.webp"; break;
    }

    return (
        <Link href={`/cards/${card.id}`} className="group block">
            <div className="relative cursor-pointer rounded-xl overflow-hidden transition-all bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-xl hover:-translate-y-1">
                {/* Card Image Container */}
                <div className="aspect-square w-full bg-slate-50 p-2 relative">
                    <div className="w-full h-full relative rounded-lg overflow-hidden shadow-inner">
                        <Image
                            src={getCardThumbnailUrl(card.characterId, card.assetbundleName, showTrainedThumbnail, assetSource)}
                            alt={card.prefix}
                            fill
                            className="object-cover"
                            unoptimized
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23f0f0f0' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3E...%3C/text%3E%3C/svg%3E";
                            }}
                        />
                    </div>

                    {/* Attribute Badge - Top Left (Smaller) */}
                    <div className="absolute top-1.5 left-1.5 w-5 h-5 drop-shadow-md z-10">
                        <Image
                            src={`/data/icon/${attrIconName}`}
                            alt={card.attr}
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>

                    {/* Spoiler Badge - Bottom Left */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 left-1.5 z-10">
                            <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded shadow-sm">
                                剧透
                            </span>
                        </div>
                    )}

                    {/* Rarity Badge - Top Right (Compact Bubble) */}
                    <div className="absolute top-1.5 right-1.5 z-10">
                        <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1.5 py-0.5 flex items-center gap-0.5 min-h-[18px]">
                            {card.cardRarityType === "rarity_birthday" ? (
                                <div className="w-3.5 h-3.5 relative">
                                    <Image
                                        src="/data/icon/birthday.webp"
                                        alt="Birthday"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <>
                                    <span className="text-white text-[9px] font-bold leading-none mt-[1.5px]">{rarityNum}</span>
                                    <div className="w-3 h-3 relative">
                                        <Image
                                            src="/data/icon/star.webp"
                                            alt="Star"
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Card Info - Persistent Footer */}
                <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-slate-800 text-[10px] font-bold truncate leading-tight group-hover:text-miku transition-colors flex-1">{card.prefix}</p>
                        {/* ID Bubble */}
                        <span className="flex-shrink-0 text-[8px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded leading-none font-mono">
                            ID:{card.id}
                        </span>
                    </div>
                    <p className="text-slate-400 text-[9px] truncate leading-tight">{characterName}</p>
                </div>
            </div>
        </Link>
    );
}
