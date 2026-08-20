"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { ChurnScoreChangeV2 } from "@/types/realtime-ranking-next";

interface RecentChangesFeedProps {
    changes: ChurnScoreChangeV2[];
    /** Max rows to keep in the scroll list. */
    limit?: number;
}

function useRelativeTime(ts: number, now: number, t: ReturnType<typeof useI18n>["t"]): string {
    const sec = Math.max(0, Math.floor((now - ts) / 1000));
    if (sec < 5) return t("page.realtimeRankingNext.detail.feed.justNow");
    if (sec < 60) return t("page.realtimeRankingNext.detail.feed.secondsAgo", { seconds: sec });
    const m = Math.floor(sec / 60);
    if (m < 60) return t("page.realtimeRankingNext.detail.feed.minutesAgo", { minutes: m });
    const h = Math.floor(m / 60);
    return t("page.realtimeRankingNext.detail.feed.hoursAgo", { hours: h });
}

function FeedRow({ change, now }: { change: ChurnScoreChangeV2; now: number }) {
    const { t, formatNumber } = useI18n();
    const rel = useRelativeTime(change.t, now, t);
    const positive = change.delta >= 0;
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -12, height: 0 }}
            animate={{ opacity: 1, x: 0, height: "auto" }}
            exit={{ opacity: 0, x: 12, height: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="flex items-center justify-between gap-2 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] px-3 py-1.5"
        >
            <span className="flex items-center gap-1.5 text-xs">
                <span className={`text-[10px] ${positive ? "text-emerald-600" : "text-rose-500"}`}>{positive ? "▲" : "▼"}</span>
                <span className={`hh-numeric font-bold ${positive ? "text-emerald-600" : "text-rose-500"}`}>
                    {positive ? "+" : ""}{formatNumber(change.delta)}
                </span>
            </span>
            <span className="hh-numeric shrink-0 text-[10px] text-[var(--hh-text-tertiary)]">{rel}</span>
        </motion.div>
    );
}

export default function RecentChangesFeed({ changes, limit = 30 }: RecentChangesFeedProps) {
    const { t, formatNumber } = useI18n();
    const [now, setNow] = useState(() => Date.now());

    // Tick once a second so relative times stay fresh.
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // Newest first, capped.
    const sorted = [...changes].sort((a, b) => b.t - a.t).slice(0, limit);

    // Sum of positive deltas within the last hour.
    const cutoff = now - 3_600_000;
    const total1h = changes
        .filter((c) => c.t >= cutoff && c.delta > 0)
        .reduce((acc, c) => acc + c.delta, 0);
    const count1h = changes.filter((c) => c.t >= cutoff && c.delta > 0).length;

    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="hh-title text-sm font-semibold text-[var(--hh-text-primary)]">{t("page.realtimeRankingNext.detail.feed.title")}</h2>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-miku/10 px-2 py-0.5 font-bold text-miku">
                        +{formatNumber(total1h)}
                    </span>
                    <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-2 py-0.5 font-bold text-[var(--hh-text-secondary)]">
                        ×{count1h}
                    </span>
                </div>
            </div>
            {sorted.length === 0 ? (
                <div className="rounded-[var(--hh-radius-md)] border border-dashed border-[var(--hh-border)] px-3 py-6 text-center text-xs text-[var(--hh-text-tertiary)]">
                    {t("page.realtimeRankingNext.detail.feed.empty")}
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    className="max-h-72 space-y-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--hh-border-strong)]"
                >
                    <AnimatePresence initial={false}>
                        {sorted.map((c) => (
                            <FeedRow key={`${c.t}-${c.delta}`} change={c} now={now} />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
