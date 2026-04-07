"use client";

import AdUnit from "@/components/AdUnit";
import { useTheme } from "@/contexts/ThemeContext";
import { DETAIL_FEED_AD } from "@/lib/ads";

interface DetailPageAdCardProps {
    hidden?: boolean;
}

export default function DetailPageAdCard({ hidden = false }: DetailPageAdCardProps) {
    const { showAds } = useTheme();

    if (hidden || !showAds) return null;

    return (
        <div className="moesekai-ad-slot bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 to-transparent">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    广告
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
