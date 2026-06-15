"use client";

import { useI18n } from "@/contexts/I18nContext";
import { ChurnHourlyEntryV2 } from "@/types/realtime-ranking-next";
import { getCurrentHourKey } from "../../_lib/board-utils";

interface ChurnHeatmapProps {
    hourlyChurn: ChurnHourlyEntryV2[];
    churn48h?: number;
}

interface Cell {
    hour: number;
    count: number;
    isCurrentHour: boolean;
    localLabel: string;
}

/** Expand hourly churn into the last 48 hours, newest first. */
function buildGrid(hourlyChurn: ChurnHourlyEntryV2[]): Cell[] {
    const currentHourKey = getCurrentHourKey();
    const now = new Date();
    const map = new Map<string, number>();
    for (const h of hourlyChurn) map.set(h.hour, h.count);

    const grid: Cell[] = [];
    for (let i = 0; i < 48; i++) {
        const d = new Date(now);
        d.setUTCHours(d.getUTCHours() - i);
        d.setUTCMinutes(0, 0, 0);
        const key = d.toISOString().replace(/\.\d{3}Z$/, "Z");
        const local = new Date(d);
        grid.push({
            hour: local.getHours(),
            count: map.get(key) ?? 0,
            isCurrentHour: key === currentHourKey,
            localLabel: `${local.getMonth() + 1}/${local.getDate()} ${local.getHours()}:00`,
        });
    }
    return grid;
}

function cellColor(count: number, isCurrentHour: boolean): string {
    if (count === 0) return "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";
    if (isCurrentHour) return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
    if (count >= 30) return "bg-rose-300 text-rose-900 dark:bg-rose-500/40 dark:text-rose-100";
    if (count >= 20) return "bg-rose-200 text-rose-800 dark:bg-rose-500/30 dark:text-rose-200";
    if (count >= 10) return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
    return "bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400";
}

export default function ChurnHeatmap({ hourlyChurn, churn48h }: ChurnHeatmapProps) {
    const { t } = useI18n();
    const grid = buildGrid(hourlyChurn);
    const row1 = grid.slice(0, 24);
    const row2 = grid.slice(24, 48);
    const total = churn48h ?? grid.reduce((acc, c) => acc + c.count, 0);

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t("page.realtimeRankingNext.detail.heatmapTitle")}
                </span>
                <span className="text-xs font-black text-miku">
                    48H {total}
                </span>
            </div>
            <div className="space-y-1">
                {[row1, row2].map((row, ri) => (
                    <div key={ri} className="flex gap-px">
                        {row.map((cell, i) => (
                            <div
                                key={`${ri}-${i}`}
                                title={`${cell.localLabel} · ${cell.count}`}
                                className={`flex-1 min-w-[14px] rounded-sm py-1 text-center text-[8px] font-bold ${cellColor(cell.count, cell.isCurrentHour)}`}
                            >
                                {cell.count > 0 ? `${cell.count}${cell.isCurrentHour ? "*" : ""}` : ""}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500">
                <span>{t("page.realtimeRankingNext.detail.heatmapNewest")}</span>
                <span>{t("page.realtimeRankingNext.detail.heatmapOldest")}</span>
            </div>
        </div>
    );
}
