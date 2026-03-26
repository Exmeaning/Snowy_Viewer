"use client";
import React from 'react';
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
    return (
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-slate-700 text-sm uppercase">{title}</h3>
            </div>
            <div className="flex gap-2">
                {data.map((tier) => (
                    <div key={tier.Rank} className={`flex-1 p-3 rounded-lg text-center border ${type === 'active' ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Rank {tier.Rank}</div>
                        <div className="text-xl font-black text-slate-800 tabular-nums leading-none mb-2">{tier.CurrentIndex}</div>

                        <div className={`text-xs font-bold ${tier.ChangePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {tier.ChangePct > 0 ? '+' : ''}{tier.ChangePct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ({tier.Speed.toLocaleString()}/h)
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ActivityStats({ tiers }: ActivityStatsProps) {
    // Sort by ChangePct descending for most active
    // Sort by ChangePct ascending for most slacking

    if (!tiers || tiers.length === 0) return null;

    const sorted = [...tiers].sort((a, b) => b.ChangePct - a.ChangePct);
    const mostActive = sorted.slice(0, 3);
    const mostSlacking = [...sorted].reverse().slice(0, 3);

    return (
        <div className="flex flex-col gap-4 h-full">
            <StatBlock
                title="最活跃 (ACTIVE)"
                data={mostActive}
                type="active"
            />
            <StatBlock
                title="最摸鱼 (SLACKING)"
                data={mostSlacking}
                type="slacking"
            />
        </div>
    );
}
