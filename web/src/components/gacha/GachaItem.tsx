"use client";
import React, { useState } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { IGachaInfo } from "@/types/types";
import { getGachaLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useI18n } from "@/contexts/I18nContext";

interface GachaItemProps {
    gacha: IGachaInfo;
}

export default function GachaItem({ gacha }: GachaItemProps) {
    const { isShowSpoiler, assetSource } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const [now] = useState(() => Date.now());
    const isUnreleased = gacha.startAt > now;
    const isOngoing = gacha.startAt <= now && gacha.endAt >= now;
    const logoUrl = getGachaLogoUrl(gacha.assetbundleName, assetSource);

    const formatDate = (timestamp: number) => formatLocaleDate(timestamp, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    return (
        <Link href={`/gacha/${gacha.id}`} className="group hh-press block" data-shortcut-item="true">
            {/* Tile semantics: hover recolors the border rather than lifting. */}
            <div className="relative rounded-[var(--hh-radius-lg)] overflow-hidden hh-tile transition-colors hover:border-[var(--hh-accent-line)]">
                {/* Logo Image */}
                <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)]">
                    <Image
                        src={logoUrl}
                        alt={gacha.name}
                        fill
                        className="object-contain p-2"
                        unoptimized
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='112' viewBox='0 0 200 112'%3E%3Crect fill='%23f1f5f9' width='200' height='112'/%3E%3Ctext x='100' y='56' text-anchor='middle' fill='%2394a3b8' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
                        }}
                    />

                    {/* Status Badges — amber "upcoming" / green "ongoing" are
                        semantic status colors and stay. */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {isUnreleased && isShowSpoiler && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-[var(--hh-radius-sm)]">
                                {t("common.badge.spoiler")}
                            </span>
                        )}
                        {isOngoing && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-[var(--hh-radius-sm)] animate-pulse">
                                {t("common.badge.ongoing")}
                            </span>
                        )}
                    </div>

                    {/* ID Badge — opaque plate replaces the blurred /50 tint. */}
                    <div className="absolute bottom-2 left-2">
                        <span className="hh-badge-on-media hh-numeric px-2 py-0.5 text-[10px]">
                            #{gacha.id}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-3">
                    <h3 className="hh-title text-sm font-bold text-[var(--hh-text-primary)] group-hover:text-miku transition-colors">
                        <TranslatedText
                            original={gacha.name}
                            category="gacha"
                            field="name"
                            originalClassName="block"
                            translationClassName="text-xs font-medium text-[var(--hh-text-tertiary)] block"
                        />
                    </h3>
                    <div className="hh-numeric mt-1 text-xs text-[var(--hh-text-tertiary)] space-y-0.5">
                        <p>{formatDate(gacha.startAt)} ~ {formatDate(gacha.endAt)}</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
