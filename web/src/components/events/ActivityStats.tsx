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
        <div className="hh-tile p-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="hh-label text-sm text-[var(--hh-text-primary)]">{title}</h3>
            </div>
            <div className="flex gap-2">
                {data.map((tier) => (
                    /* The red wash marks the "most active" block — a semantic
                       heat reading, not decoration, so it keeps its hue. */
                    <div key={tier.Rank} className={`flex-1 p-3 rounded-[var(--hh-radius-md)] text-center border ${type === 'active' ? 'bg-red-500/10 border-red-500/25' : 'bg-[var(--hh-surface-1)] border-[var(--hh-border)]'}`}>
                        <div className="hh-label text-[10px] mb-1">{t("page.prediction.activityStats.rank", { rank: tier.Rank })}</div>
                        <div className="hh-numeric hh-display text-xl font-black text-[var(--hh-text-primary)] leading-none mb-2">{formatNumber(tier.CurrentIndex)}</div>

                        <div className={`hh-numeric text-xs font-bold ${tier.ChangePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {tier.ChangePct > 0 ? '+' : ''}{tier.ChangePct.toFixed(1)}%
                        </div>
                        <div className="hh-numeric text-[10px] text-[var(--hh-text-tertiary)] mt-0.5">
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
