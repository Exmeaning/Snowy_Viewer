"use client";

import AdUnit from "@/components/AdUnit";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { DETAIL_FEED_AD } from "@/lib/ads";

interface DetailPageAdCardProps {
    hidden?: boolean;
}

export default function DetailPageAdCard({ hidden = false }: DetailPageAdCardProps) {
    const { showAds } = useTheme();
    const { t } = useI18n();

    if (hidden || !showAds) return null;

    return (
        <div className="moesekai-ad-slot hh-tile overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                <h2 className="hh-title font-bold text-[var(--hh-text-primary)] flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    {t("settings.ads.title")}
                </h2>
            </div>
            <div className="max-h-[400px] overflow-hidden">
                <AdUnit
                    adClient={DETAIL_FEED_AD.client}
                    adSlot={DETAIL_FEED_AD.slot}
                    adLayoutKey={DETAIL_FEED_AD.layoutKey}
                />
            </div>
        </div>
    );
}
