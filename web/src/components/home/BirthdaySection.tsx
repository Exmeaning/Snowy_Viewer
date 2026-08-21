"use client";
import React, { useMemo } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { getUpcomingBirthdays } from "@/lib/birthdays";
import { getCharacterIconUrl } from "@/lib/assets";
import { useI18n } from "@/contexts/I18nContext";

export default function BirthdaySection() {
    const { t, formatDate } = useI18n();
    // Get all upcoming birthdays
    const allUpcoming = useMemo(() => getUpcomingBirthdays(), []);

    // Display top 6 birthdays
    const displayBirthdays = allUpcoming.slice(0, 6);

    if (allUpcoming.length === 0) return null;

    return (
        <div className="w-full max-w-5xl animate-fade-in-up">
            {/* Upcoming Birthdays List */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-1 rounded-full bg-miku"></div>
                    <h2 className="hh-title text-xl font-bold text-[var(--hh-text-primary)]">{t("page.home.sections.upcomingBirthdays")}</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {displayBirthdays.map((birthday, index) => (
                        <Link
                            key={birthday.id}
                            href={`/character/${birthday.id}`}
                            // Today's birthday gets an accent-filled tile; the rest are
                            // plain tiles that tint their border on hover. No lift and no
                            // icon zoom — these sit in a grid and should stay put.
                            className={`
                                hh-tile hh-press group relative p-3 rounded-[var(--hh-radius-lg)] transition-colors flex flex-col items-center gap-2
                                ${birthday.isToday
                                    ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent-line)]"
                                    : "hover:border-[var(--hh-accent-line)]"
                                }
                                ${index < 2 ? "flex" : (index < 3 ? "hidden sm:flex" : "hidden lg:flex")}
                            `}
                        >
                            <div className="relative w-14 h-14">
                                <Image
                                    src={getCharacterIconUrl(birthday.id)}
                                    alt={birthday.name}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                                {birthday.isToday && (
                                    <div className="absolute -top-1 -right-1 bg-miku text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[var(--hh-radius-sm)] animate-pulse z-10">
                                        {t("page.home.birthdays.today")}
                                    </div>
                                )}
                            </div>
                            <div className="text-center w-full">
                                <div className={`text-sm font-bold truncate ${birthday.isToday ? "text-miku" : "text-[var(--hh-text-primary)] group-hover:text-miku"}`}>
                                    {birthday.name}
                                </div>
                                <div className={`hh-numeric text-xs mt-0.5 ${birthday.isToday ? "text-miku font-bold" : "text-[var(--hh-text-tertiary)]"}`}>
                                    {formatDate(new Date(2000, birthday.month - 1, birthday.day), { month: "long", day: "numeric" })}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
