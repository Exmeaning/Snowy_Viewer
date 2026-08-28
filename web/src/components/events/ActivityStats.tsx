"use client";
import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { TierKLine } from '@/types/prediction';

interface ActivityStatsProps {
    tiers: TierKLine[];
}

interface StatBlockProps {
    title: string;
    data: TierKLine[];
    type: 'active' | 'slacking';
}

function StatBlock({ title, data, type }: StatBlockProps) {
    const { t, formatNumber } = useI18n();

    return (
        <div className="bg-white rounded-xl border border-slate-100 p-3 sm:p-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <h3 className="font-bold text-slate-700 text-xs sm:text-sm uppercase">{title}</h3>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {data.map((tier) => (
                    <div key={tier.Rank} className={`p-2 sm:p-3 rounded-lg text-center border ${type === 'active' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t("page.prediction.activityStats.rank", { rank: tier.Rank })}</div>
                        <div className="text-sm sm:text-base md:text-lg font-black text-slate-800 tabular-nums leading-tight mb-1 truncate" title={formatNumber(tier.CurrentIndex)}>
                            {formatNumber(tier.CurrentIndex)}
                        </div>

                        <div className={`text-[11px] sm:text-xs font-bold ${tier.ChangePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {tier.ChangePct > 0 ? '+' : ''}{tier.ChangePct.toFixed(1)}%
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                            ({formatNumber(tier.Speed)}/h)
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ActivityStats({ tiers }: ActivityStatsProps) {
    const { t } = useI18n();
    // Sort by ChangePct descending for most active
    // Sort by ChangePct ascending for most slacking

    if (!tiers || tiers.length === 0) return null;

    const sorted = [...tiers].sort((a, b) => b.ChangePct - a.ChangePct);
    const mostActive = sorted.slice(0, 3);
    const mostSlacking = [...sorted].reverse().slice(0, 3);

    return (
        <div className="flex flex-col gap-4 h-full">
            <StatBlock
                title={t("page.prediction.activityStats.mostActive")}
                data={mostActive}
                type="active"
            />
            <StatBlock
                title={t("page.prediction.activityStats.mostSlacking")}
                data={mostSlacking}
                type="slacking"
            />
        </div>
    );
}
