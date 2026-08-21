"use client";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { IVirtualLiveInfo, VIRTUAL_LIVE_TYPE_COLORS, getVirtualLiveStatus, VIRTUAL_LIVE_STATUS_DISPLAY, VirtualLiveType } from "@/types/virtualLive";
import { getVirtualLiveBannerUrl } from "@/lib/assets";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";

interface VirtualLiveItemProps {
    virtualLive: IVirtualLiveInfo;
    isSpoiler?: boolean;
}

export default function VirtualLiveItem({ virtualLive, isSpoiler }: VirtualLiveItemProps) {
    const { assetSource } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const bannerUrl = getVirtualLiveBannerUrl(virtualLive.assetbundleName, assetSource);
    const status = getVirtualLiveStatus(virtualLive);
    const statusDisplay = VIRTUAL_LIVE_STATUS_DISPLAY[status];

    // Format dates
    const formatDate = (timestamp: number) => formatLocaleDate(timestamp, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <Link href={`/live/${virtualLive.id}`} className="group hh-press block" data-shortcut-item="true">
            {/* Tile semantics: border-tint on hover, no lift and no banner zoom. */}
            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden transition-colors hover:border-[var(--hh-accent-line)]">
                {/* Banner Image */}
                <div className="relative aspect-[16/7] bg-[var(--hh-surface-sunken)] overflow-hidden">
                    <Image
                        src={bannerUrl}
                        alt={virtualLive.name}
                        fill
                        className="object-contain"
                        unoptimized
                    />

                    {/* Status Badge — status color is semantic and stays as-is. */}
                    <div
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-[var(--hh-radius-sm)] text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: statusDisplay.color }}
                    >
                        {t(`common.status.${status}`)}
                    </div>

                    {/* Type Badge — live-type color is semantic and stays as-is. */}
                    <div
                        className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 rounded-[var(--hh-radius-sm)] text-[10px] sm:text-xs font-bold text-white"
                        style={{ backgroundColor: VIRTUAL_LIVE_TYPE_COLORS[virtualLive.virtualLiveType as VirtualLiveType] || "#9E9E9E" }}
                    >
                        {t(`common.virtualLiveTypes.${virtualLive.virtualLiveType}`)}
                    </div>

                    {/* Spoiler Badge */}
                    {isSpoiler && (
                        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 sm:px-2 py-0.5 bg-orange-500 rounded-[var(--hh-radius-sm)] text-[10px] sm:text-xs font-bold text-white">
                            {t("common.badge.spoiler")}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-2.5 sm:p-4">
                    {/* ID Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <span className="hh-numeric px-1.5 sm:px-2 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] text-[10px] sm:text-xs rounded-[var(--hh-radius-sm)]">
                            #{virtualLive.id}
                        </span>
                    </div>

                    {/* Name */}
                    <h3 className="hh-title font-bold text-[var(--hh-text-primary)] text-xs sm:text-sm mb-1.5 sm:mb-2 group-hover:text-miku">
                        <TranslatedText
                            original={virtualLive.name}
                            category="virtualLive"
                            field="name"
                            originalClassName=""
                            translationClassName="hh-body text-xs font-medium text-[var(--hh-text-tertiary)] mt-0.5"
                        />
                    </h3>

                    {/* Date Range */}
                    <div className="hh-body text-[10px] sm:text-xs text-[var(--hh-text-secondary)] space-y-0.5 hidden sm:block">
                        <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="hh-numeric">{formatDate(virtualLive.startAt)}</span>
                            <span>~</span>
                            <span className="hh-numeric">{formatDate(virtualLive.endAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
