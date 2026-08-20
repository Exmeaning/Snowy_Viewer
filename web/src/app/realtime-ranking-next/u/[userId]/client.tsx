"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import PlayerHonorPreview from "@/components/realtime-ranking/PlayerHonorPreview";
import { useI18n } from "@/contexts/I18nContext";
import { type AssetSourceType } from "@/contexts/ThemeContext";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";
import { fetchRealtimeRankingMasterData } from "@/lib/realtime-ranking-next-api";
import {
    RealtimeRankingMasterData,
    RealtimeRankingRegion,
    isRealtimeRankingRegion,
} from "@/types/realtime-ranking-next";
import {
    getEffectiveLine,
    useRealtimeRankingLine,
} from "@/lib/realtime-ranking-line";
import ScoreLineChart, { ScoreSeries } from "../../_components/charts/ScoreLineChart";
import ChurnHeatmap from "../../_components/charts/ChurnHeatmap";
import SpeedGauge from "../../_components/charts/SpeedGauge";
import RecentChangesFeed from "../../_components/RecentChangesFeed";
import ChangeTime from "../../_components/ChangeTime";
import { useUserDetail, NearbyEntry } from "../../_hooks/useUserDetail";
import { fmtSpeed } from "../../_lib/board-utils";

const EMPTY_MASTER_DATA: RealtimeRankingMasterData = {
    cards: [],
    honors: [],
    honorGroups: [],
    bondsHonors: [],
    bondsHonorWords: [],
    gameCharaUnits: [],
};

const TIER_COLORS = ["#33CCBB", "#f59e0b", "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#ef4444"];

/* The detail page is eight instances of the same object: a tile holding one
   readout. Naming it once keeps the surface, radius and padding identical
   across all of them — they had already drifted apart by a padding step. */
const PANEL = "hh-tile rounded-[var(--hh-radius-lg)] p-5";
const PANEL_TIGHT = "hh-tile rounded-[var(--hh-radius-lg)] p-4";
/* Section heading inside a tile. */
const PANEL_TITLE = "hh-title mb-3 text-sm font-semibold text-[var(--hh-text-primary)]";
/* Empty state inside a tile: a dashed well, not a filled surface. */
const PANEL_EMPTY = "rounded-[var(--hh-radius-md)] border border-dashed border-[var(--hh-border)] px-3 py-6 text-center text-xs text-[var(--hh-text-tertiary)]";

function UserDetailContent() {
    const { t, formatNumber } = useI18n();
    const params = useParams();
    const searchParams = useSearchParams();

    const userId = decodeURIComponent(String(params.userId ?? ""));
    const regionParam = searchParams.get("region");
    const region: RealtimeRankingRegion = isRealtimeRankingRegion(regionParam) ? regionParam : "cn";
    const wlParam = searchParams.get("wl");
    const worldLinkCharacterId = wlParam && /^\d+$/.test(wlParam) ? Number(wlParam) : null;

    const line = useRealtimeRankingLine();
    const effectiveLine = getEffectiveLine(line, region);
    const effectiveAssetSource = useMemo<AssetSourceType>(
        () => `${effectiveLine === "global" ? "overseas" : "main"}-${region}` as AssetSourceType,
        [effectiveLine, region],
    );

    const [masterData, setMasterData] = useState<RealtimeRankingMasterData>(EMPTY_MASTER_DATA);
    useEffect(() => {
        let cancelled = false;
        fetchRealtimeRankingMasterData(region)
            .then((d) => { if (!cancelled) setMasterData(d); })
            .catch(() => { if (!cancelled) setMasterData(EMPTY_MASTER_DATA); });
        return () => { cancelled = true; };
    }, [region]);

    const { data, isLoading, isRefreshing, updatedAt, error, refresh } = useUserDetail({ region, userId, worldLinkCharacterId });

    const backHref = useMemo(() => {
        const p = new URLSearchParams();
        p.set("region", region);
        return `/realtime-ranking-next?${p.toString()}`;
    }, [region]);

    // Build chart series: self + tier gradient lines (reference, dashed).
    const series = useMemo<ScoreSeries[]>(() => {
        const result: ScoreSeries[] = [];
        if (data.selfSeries.length > 0) {
            result.push({
                name: data.self?.displayName || t("page.realtimeRankingNext.detail.you"),
                color: "#33CCBB",
                points: data.selfSeries,
            });
        }
        // Add the two closest tier reference lines.
        const selfRank = data.self?.rank ?? 0;
        const sortedTiers = [...data.tierGradient]
            .filter((g) => g.points.length > 0)
            .sort((a, b) => Math.abs(a.tier - selfRank) - Math.abs(b.tier - selfRank))
            .slice(0, 2);
        sortedTiers.forEach((g, i) => {
            result.push({
                name: `T${g.tier}`,
                color: TIER_COLORS[(i + 1) % TIER_COLORS.length],
                points: g.points,
                dashed: true,
            });
        });
        return result;
    }, [data.selfSeries, data.tierGradient, data.self, t]);

    const leaderCard = data.self?.leaderCardId
        ? masterData.cards.find((c) => c.id === data.self?.leaderCardId)
        : undefined;
    const derivedCharacterId = data.self?.leaderCharacterId ?? leaderCard?.characterId;
    const isTrained = data.self?.leaderCardDefaultImage === "special_training";
    const masterRank = data.self?.leaderCardMasterRank ?? 0;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 py-8 sm:px-6">
                {/* Back link */}
                <div className="mb-4 flex items-center gap-2 text-sm">
                    <Link href={backHref} className="hh-focusable inline-flex items-center gap-1 font-bold text-[var(--hh-text-secondary)] transition-colors hover:text-miku">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        {t("page.realtimeRankingNext.detail.back")}
                    </Link>
                    {worldLinkCharacterId != null && (
                        <span className="rounded-[var(--hh-radius-sm)] bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            WL · {getCharacterName(t, worldLinkCharacterId)}
                        </span>
                    )}

                    {/* Live indicator + manual refresh */}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-2.5 py-1 text-[11px] font-bold text-[var(--hh-text-secondary)]">
                            <motion.span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                                animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <LiveAgeLabel updatedAt={updatedAt} />
                        </span>
                        <button
                            onClick={refresh}
                            disabled={isRefreshing}
                            className="hh-press hh-focusable inline-flex items-center gap-1 rounded-[var(--hh-radius-md)] bg-miku px-3 py-1 text-[11px] font-bold text-[var(--hh-text-on-accent)] transition-colors hover:bg-miku-dark disabled:opacity-60"
                        >
                            {isRefreshing ? (
                                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                                    {t("page.realtimeRankingNext.refreshing")}
                                </motion.span>
                            ) : (
                                t("page.realtimeRankingNext.refresh")
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-[var(--hh-radius-lg)] border border-red-500/30 bg-red-500/12 p-4 text-sm text-red-600">
                        {t("page.realtimeRankingNext.loadFailed")}
                    </div>
                )}

                {isLoading && !data.self ? (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-10 text-center text-[var(--hh-text-secondary)]">
                        {t("page.realtimeRankingNext.loading")}
                    </div>
                ) : !data.self ? (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-10 text-center text-[var(--hh-text-secondary)]">
                        {t("page.realtimeRankingNext.detail.notFound")}
                    </div>
                ) : (
                    /*
                     * Layout:
                     *  - Desktop (lg+): two columns. Left = player card / speed / heatmap / curve.
                     *    Right = nearby ranking / tier gradient / recent changes feed.
                     *  - Mobile: single column. The two column wrappers use `display: contents`
                     *    so every card becomes a direct grid child and `order-*` controls the
                     *    vertical sequence: score → speed → nearby → gradient → heatmap → curve.
                     */
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
                        {/* Left column (desktop) */}
                        <div className="contents lg:col-span-7 lg:block">
                            {/* Player card */}
                            <div className={`order-1 ${PANEL}`}>
                                <div className="flex items-start gap-4">
                                    <div className="w-20 shrink-0 sm:w-24">
                                        {leaderCard ? (
                                            <SekaiCardThumbnail card={leaderCard} trained={isTrained} mastery={masterRank} width={96} className="w-full" assetSource={effectiveAssetSource} />
                                        ) : derivedCharacterId ? (
                                            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                                                <Image src={getCharacterIconUrl(derivedCharacterId)} alt="" fill className="object-cover" unoptimized />
                                            </div>
                                        ) : (
                                            <div className="flex aspect-square w-full items-center justify-center rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)]">
                                                <span className="hh-numeric text-sm font-bold text-[var(--hh-text-tertiary)]">#{data.self.rank}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-miku px-2 py-0.5 text-xs font-bold text-[var(--hh-text-on-accent)]">#{data.self.rank}</span>
                                            {data.parking && (
                                                <span className="rounded-[var(--hh-radius-sm)] bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                                    {t("page.realtimeRankingNext.detail.parkingNow")}
                                                </span>
                                            )}
                                        </div>
                                        <h1 className="hh-display mt-1.5 truncate text-xl text-[var(--hh-text-primary)]">{data.self.displayName}</h1>
                                        {data.self.signature && (
                                            <p className="mt-0.5 truncate text-xs text-[var(--hh-text-tertiary)]">{data.self.signature}</p>
                                        )}
                                        <div className="mt-2">
                                            <PlayerHonorPreview honors={data.self.honors} masterData={masterData} assetSource={effectiveAssetSource} compact />
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                            <div className="hh-numeric hh-display text-2xl text-[var(--hh-text-primary)]">
                                                {formatNumber(data.self.score)}
                                                <span className="ml-1 text-xs font-bold text-[var(--hh-text-tertiary)]">P</span>
                                            </div>
                                            <LastChangeBadge changes={data.selfChurn?.recent_score_changes ?? []} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Speed gauge */}
                            <div className={`order-2 ${PANEL} lg:mt-6`}>
                                <h2 className={PANEL_TITLE}>{t("page.realtimeRankingNext.detail.speedTitle")}</h2>
                                <SpeedGauge churnEntry={data.selfChurn} />
                            </div>

                            {/* Heatmap */}
                            <div className={`order-5 ${PANEL} lg:mt-6`}>
                                <ChurnHeatmap hourlyChurn={data.selfChurn?.hourly_churn ?? []} churn48h={data.selfChurn?.churn_48h} />
                            </div>

                            {/* Score curve */}
                            <div className={`order-6 ${PANEL} lg:mt-6`}>
                                <h2 className={`${PANEL_TITLE} mb-2`}>{t("page.realtimeRankingNext.detail.curveTitle")}</h2>
                                <ScoreLineChart series={series} height={300} />
                            </div>

                            {/* Parking periods */}
                            {data.selfChurn?.parking_periods && data.selfChurn.parking_periods.length > 0 && (
                                <div className={`order-8 ${PANEL} lg:mt-6`}>
                                    <h2 className={PANEL_TITLE}>{t("page.realtimeRankingNext.detail.parkingTitle")}</h2>
                                    <div className="space-y-1.5">
                                        {data.selfChurn.parking_periods.slice(-8).reverse().map((p, i) => {
                                            const start = p.start_time ?? p.since_ms;
                                            const dur = p.duration_s;
                                            return (
                                                <div key={i} className="flex items-center justify-between rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] px-3 py-1.5 text-xs">
                                                    <span className="hh-numeric text-[var(--hh-text-secondary)]">
                                                        {start ? new Date(start).toLocaleString() : "—"}
                                                    </span>
                                                    <span className="hh-numeric font-bold text-[var(--hh-text-primary)]">
                                                        {dur != null ? `${Math.round(dur / 60)}m` : t("page.realtimeRankingNext.detail.parkingOngoing")}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right column (desktop) */}
                        <div className="contents lg:col-span-5 lg:block">
                            {/* Nearby ranking */}
                            <div className={`order-3 ${PANEL_TIGHT}`}>
                                <h2 className={PANEL_TITLE}>{t("page.realtimeRankingNext.detail.nearbyTitle")}</h2>
                                {data.nearby.length === 0 ? (
                                    <div className={PANEL_EMPTY}>
                                        {t("page.realtimeRankingNext.detail.nearbyEmpty")}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {data.nearby.map((e) => (
                                            <NearbyRow key={e.userId} entry={e} region={region} worldLinkCharacterId={worldLinkCharacterId} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tier gradient */}
                            <div className={`order-4 ${PANEL_TIGHT} lg:mt-6`}>
                                <h2 className={PANEL_TITLE}>{t("page.realtimeRankingNext.detail.gradientTitle")}</h2>
                                {data.tierGradient.every((g) => g.score == null) ? (
                                    <div className={PANEL_EMPTY}>
                                        {t("page.realtimeRankingNext.detail.gradientEmpty")}
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            {data.tierGradient.map((g) => {
                                                const ahead = g.gapToSelf != null && g.gapToSelf > 0; // tier is ahead of self
                                                return (
                                                    <div key={g.tier} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-x-2 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] px-3 py-2 text-xs">
                                                        <span className="hh-numeric font-bold text-[var(--hh-text-secondary)]">T{g.tier}</span>
                                                        <span className="hh-numeric text-right text-[var(--hh-text-secondary)]">
                                                            {g.score != null ? formatNumber(g.score) : "—"}
                                                        </span>
                                                        <span className="hh-numeric w-12 text-right text-[10px] font-bold text-miku">
                                                            {g.speed1h != null ? `${fmtSpeed(g.speed1h)}/h` : ""}
                                                        </span>
                                                        <span className={`hh-numeric w-24 text-right text-[10px] font-bold ${ahead ? "text-rose-500" : "text-emerald-600"}`}>
                                                            {g.gapToSelf != null ? `${ahead ? "+" : ""}${formatNumber(g.gapToSelf)}` : ""}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-[10px] text-[var(--hh-text-tertiary)]">
                                            {t("page.realtimeRankingNext.detail.gradientHint")}
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Recent score changes (live scrolling feed) */}
                            <div className={`order-7 ${PANEL} lg:mt-6`}>
                                <RecentChangesFeed changes={data.selfChurn?.recent_score_changes ?? []} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function LastChangeBadge({ changes }: { changes: { t: number; delta: number }[] }) {
    const { t, formatNumber } = useI18n();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    if (changes.length === 0) return null;
    // Latest change by timestamp.
    const last = changes.reduce((acc, c) => (c.t > acc.t ? c : acc), changes[0]);
    const positive = last.delta >= 0;

    const sec = Math.max(0, Math.floor((now - last.t) / 1000));
    const rel = sec < 5
        ? t("page.realtimeRankingNext.detail.feed.justNow")
        : sec < 60
            ? t("page.realtimeRankingNext.detail.feed.secondsAgo", { seconds: sec })
            : sec < 3600
                ? t("page.realtimeRankingNext.detail.feed.minutesAgo", { minutes: Math.floor(sec / 60) })
                : t("page.realtimeRankingNext.detail.feed.hoursAgo", { hours: Math.floor(sec / 3600) });

    return (
        <motion.span
            key={`${last.t}-${last.delta}`}
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 22 }}
            className={`hh-numeric inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] px-1.5 py-0.5 text-xs font-bold ${
                positive
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-rose-500/15 text-rose-700"
            }`}
            title={t("page.realtimeRankingNext.detail.lastChange")}
        >
            <span className="text-[10px]">{positive ? "▲" : "▼"}</span>
            <span>{positive ? "+" : ""}{formatNumber(last.delta)}</span>
            <span className="font-medium opacity-60">{rel}</span>
        </motion.span>
    );
}

function LiveAgeLabel({ updatedAt }: { updatedAt: number | null }) {
    const { t } = useI18n();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    if (updatedAt == null) return <span>{t("page.realtimeRankingNext.detail.live")}</span>;
    const sec = Math.max(0, Math.floor((now - updatedAt) / 1000));
    return <span className="hh-numeric">{t("page.realtimeRankingNext.detail.updatedAgo", { seconds: sec })}</span>;
}

function NearbyRow({ entry, region, worldLinkCharacterId }: {
    entry: NearbyEntry;
    region: RealtimeRankingRegion;
    worldLinkCharacterId: number | null;
}) {
    const { t, formatNumber } = useI18n();
    const href = useMemo(() => {
        const p = new URLSearchParams();
        p.set("region", region);
        if (worldLinkCharacterId != null) p.set("wl", String(worldLinkCharacterId));
        return `/realtime-ranking-next/u/${encodeURIComponent(entry.userId)}?${p.toString()}`;
    }, [entry.userId, region, worldLinkCharacterId]);

    // Latest score change from churn (same source/口径 as the main board feed).
    const last = entry.recentChanges.length > 0
        ? entry.recentChanges.reduce((acc, c) => (c.t > acc.t ? c : acc), entry.recentChanges[0])
        : null;
    const delta = last?.delta ?? 0;

    const content = (
        <div className={`flex items-center gap-2 rounded-[var(--hh-radius-md)] px-2.5 py-1.5 text-xs transition-colors ${
            entry.isSelf
                ? "bg-miku/10 ring-1 ring-miku/30"
                : "hover:bg-[var(--hh-surface-sunken)]"
        }`}>
            <span className={`hh-numeric w-8 shrink-0 text-center font-bold ${entry.isSelf ? "text-miku" : "text-[var(--hh-text-secondary)]"}`}>#{entry.rank}</span>
            <span className="hh-numeric min-w-0 flex-1 font-bold text-[var(--hh-text-primary)]">{formatNumber(entry.score)}</span>
            {entry.isSelf ? (
                <span className="shrink-0 text-[10px] font-bold text-miku">{t("page.realtimeRankingNext.detail.you")}</span>
            ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                    {delta !== 0 ? (
                        <span className={`hh-numeric inline-flex items-center gap-0.5 rounded-[var(--hh-radius-sm)] px-1 py-0.5 text-[10px] font-bold ${
                            delta > 0
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-rose-500/15 text-rose-700"
                        }`}>
                            <span className="text-[8px]">{delta > 0 ? "▲" : "▼"}</span>
                            {delta > 0 ? "+" : ""}{formatNumber(delta)}
                        </span>
                    ) : (
                        <span className="text-[10px] text-[var(--hh-text-tertiary)]">—</span>
                    )}
                    <ChangeTime changedAt={last?.t} />
                </div>
            )}
        </div>
    );

    if (entry.isSelf) return content;
    return <Link href={href} className="hh-focusable block">{content}</Link>;
}

export default function UserDetailClient() {
    const { t } = useI18n();
    return (
        <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.realtimeRankingNext.loading")}</div>}>
            <UserDetailContent />
        </Suspense>
    );
}
