"use client";
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUpcomingBirthdays, isVirtualSinger } from "@/lib/birthdays";
import { ICardInfo, CHAR_COLORS } from "@/types/types";
import { fetchMasterData } from "@/lib/fetch";
import { getCardFullUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

// Simple helper to hex to rgb
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export default function BirthdaySection() {
    const { assetSource } = useTheme();
    // Get all upcoming birthdays
    const allUpcoming = useMemo(() => getUpcomingBirthdays(), []);
    // Filter for today
    const todayBirthdays = useMemo(() => allUpcoming.filter(b => b.isToday), [allUpcoming]);

    // State for birthday cards
    const [birthdayCards, setBirthdayCards] = useState<Record<number, ICardInfo | null>>({});

    // Fetch birthday cards for today's celebrating characters
    useEffect(() => {
        if (todayBirthdays.length === 0) return;

        async function fetchBirthdayCards() {
            try {
                const allCards = await fetchMasterData<ICardInfo[]>("cards.json");

                const cardMap: Record<number, ICardInfo | null> = {};

                todayBirthdays.forEach(char => {
                    // Filter cards for this character
                    const charCards = allCards.filter(c => c.characterId === char.id);

                    // Try to find "birthday" rarity cards first
                    let targetCards = charCards.filter(c => c.cardRarityType === "rarity_birthday");

                    // If no birthday card found (e.g. new char), fallback to highest rarity
                    if (targetCards.length === 0) {
                        targetCards = charCards;
                    }

                    // Sort by releaseAt descending (latest first), then by ID descending
                    targetCards.sort((a, b) => {
                        if (b.releaseAt !== a.releaseAt || b.releaseAt === undefined || a.releaseAt === undefined) return (b.id) - (a.id);
                        return b.releaseAt - a.releaseAt;
                    });

                    // Pick the latest one
                    if (targetCards.length > 0) {
                        cardMap[char.id] = targetCards[0];
                    } else {
                        cardMap[char.id] = null;
                    }
                });

                setBirthdayCards(cardMap);
            } catch (error) {
                console.error("Failed to fetch birthday cards", error);
            }
        }

        fetchBirthdayCards();
    }, [todayBirthdays]);

    // Display top 6 birthdays
    const displayBirthdays = allUpcoming.slice(0, 6);

    if (allUpcoming.length === 0) return null;

    return (
        <div className="w-full max-w-5xl animate-fade-in-up">
            {/* Today's Birthday/Anniversary Celebration */}
            {todayBirthdays.length > 0 && (
                <div className="mb-8">
                    {todayBirthdays.map((birthday) => {
                        const card = birthdayCards[birthday.id];
                        const charColor = CHAR_COLORS[birthday.id.toString()] || "#ff66cc"; // Fallback to pink

                        // Use card image if available
                        // Birthday cards only have 'normal' (untrained) version
                        const isBirthdayRarity = card?.cardRarityType === "rarity_birthday";

                        const cardImageUrl = card
                            ? getCardFullUrl(
                                card.characterId,
                                card.assetbundleName,
                                isBirthdayRarity ? false : true, // Birthday cards: normal, Others: trained
                                assetSource
                            )
                            : null;

                        return (
                            <div
                                key={birthday.id}
                                className="relative overflow-hidden border rounded-2xl p-0 flex flex-col md:flex-row items-center shadow-sm hover:shadow-md transition-all duration-300 min-h-[200px]"
                                style={{
                                    borderColor: `${charColor}40`, // 25% opacity
                                    backgroundColor: `${charColor}08`, // Very light tint
                                }}
                            >

                                {/* Card Background / Image Area */}
                                {cardImageUrl ? (
                                    <div className="absolute inset-0 w-full h-full z-0 opacity-100">
                                        {/* We show the full card art on the right side, fading to left */}
                                        <div
                                            className="absolute right-0 top-0 w-3/4 md:w-1/2 h-full"
                                            style={{ maskImage: 'linear-gradient(to left, black 60%, transparent)' }}
                                        >
                                            <Image
                                                src={cardImageUrl}
                                                alt={birthday.name}
                                                fill
                                                className="object-cover object-top opacity-90 sepia-0"
                                                unoptimized
                                            />
                                        </div>
                                        {/* Gradient Overlay to ensure text readability */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Fallback Decorative Background Elements */}
                                        <div
                                            className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                                            style={{ backgroundColor: `${charColor}30` }}
                                        ></div>
                                        <div
                                            className="absolute top-10 -left-10 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                                            style={{ backgroundColor: `${charColor}20` }}
                                        ></div>
                                    </>
                                )}

                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 w-full">
                                    <div
                                        className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 animate-bounce-slow bg-white rounded-full p-1 shadow-md"
                                        style={{ boxShadow: `0 4px 6px -1px ${charColor}40` }}
                                    >
                                        <Image
                                            src={`https://assets.exmeaning.com/character_icons/chr_ts_${birthday.id}.png`}
                                            alt={birthday.name}
                                            fill
                                            className="object-contain rounded-full"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="text-center md:text-left">
                                        <h3
                                            className="text-3xl font-black mb-2 drop-shadow-sm"
                                            style={{ color: charColor }}
                                        >
                                            {isVirtualSinger(birthday.id) ? "纪念日快乐" : "生日快乐"}，{birthday.name}！
                                        </h3>
                                        <p className="text-slate-600 font-medium text-sm md:text-base max-w-lg">
                                            今天是 {birthday.month}月{birthday.day}日，为{birthday.name}送上祝福吧！
                                            {card && card.cardRarityType === "rarity_birthday" && (
                                                <span
                                                    className="block text-xs mt-2 px-2 py-1 rounded-full w-fit mx-auto md:mx-0 font-bold border"
                                                    style={{
                                                        borderColor: `${charColor}40`,
                                                        backgroundColor: `${charColor}15`,
                                                        color: charColor
                                                    }}
                                                >
                                                    🎉 {card.prefix}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upcoming Birthdays List */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 rounded-full bg-miku"></div>
                    <h2 className="text-xl font-bold text-primary-text opacity-80">即将到来的生日/纪念日</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {displayBirthdays.map((birthday, index) => (
                        <Link
                            key={birthday.id}
                            href={`/character/${birthday.id}`}
                            className={`
                                group relative p-3 rounded-xl transition-all duration-300 flex flex-col items-center gap-2
                                border backdrop-blur-sm
                                ${birthday.isToday
                                    ? "bg-gradient-to-br from-miku/10 to-white/80 border-miku/40 shadow-miku/20 shadow-md transform hover:-translate-y-1"
                                    : "bg-white/40 hover:bg-white/70 border-white/50 hover:border-miku/30 transform hover:-translate-y-1 hover:shadow-lg"
                                }
                                ${index < 2 ? "flex" : (index < 3 ? "hidden sm:flex" : "hidden lg:flex")} 
                            `}
                        >
                            <div className="relative w-14 h-14 transition-transform duration-300 group-hover:scale-110">
                                <Image
                                    src={`https://assets.exmeaning.com/character_icons/chr_ts_${birthday.id}.png`}
                                    alt={birthday.name}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                                {birthday.isToday && (
                                    <div className="absolute -top-1 -right-1 bg-miku text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse z-10">
                                        TODAY
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                <div className={`text-sm font-bold truncate ${birthday.isToday ? "text-miku" : "text-slate-700 group-hover:text-miku"}`}>
                                    {birthday.name}
                                </div>
                                <div className={`text-xs mt-0.5 ${birthday.isToday ? "text-miku/80 font-bold" : "text-slate-400"}`}>
                                    {birthday.month}月{birthday.day}日
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
