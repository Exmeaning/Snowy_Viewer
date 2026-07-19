"use client";

import Link from "@/components/LocalizedLink";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import MainLayout from "@/components/MainLayout";
import MysekaiScenePreview from "@/components/mysekai-preview/MysekaiScenePreview";
import { useI18n } from "@/contexts/I18nContext";
import { replaceAssetSourceRegion, type AssetSourceType, useTheme } from "@/contexts/ThemeContext";
import {
    type BaijingRankingEntry,
    type BaijingRoomResponse,
    getEntryThumbnailUrl,
    getRankTone,
    getRoomUrl,
    getTabTypeLabel,
    normalizeBaijingServer,
} from "@/lib/mysekai-preview/baijing";

function HeartIcon({ className = "" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.995 20.545a1.1 1.1 0 0 1-.672-.23C8.924 18.46 6.94 16.79 5.367 15.19 3.549 13.34 2.5 11.54 2.5 9.53 2.5 6.63 4.85 4.4 7.69 4.4c1.61 0 3.13.75 4.305 2.01C13.17 5.15 14.69 4.4 16.3 4.4c2.84 0 5.2 2.23 5.2 5.13 0 2.01-1.05 3.81-2.867 5.66-1.573 1.6-3.557 3.27-5.956 5.125a1.1 1.1 0 0 1-.682.23Z" />
        </svg>
    );
}

function DetailStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className={`rounded-2xl border px-4 py-3 shadow-sm backdrop-blur ${accent ? "border-rose-100 bg-rose-50/80 text-rose-500" : "border-white/70 bg-white/68 text-slate-700"}`}>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-black">
                {accent && <HeartIcon className="h-4 w-4" />}
                <span>{value}</span>
            </div>
        </div>
    );
}

function MissingParamsState() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <div className="container mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/60 p-8 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
                    <h1 className="text-2xl font-black text-slate-800">{t("page.mysekaiPreview.ranking.missingParamsTitle")}</h1>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">
                        {t("page.mysekaiPreview.ranking.missingParamsDescription")}
                    </p>
                    <Link href="/mysekai-preview" className="mt-6 inline-flex rounded-2xl bg-miku px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-miku/20 transition hover:-translate-y-0.5 active:scale-95">
                        {t("page.mysekaiPreview.ranking.backToRanking")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

function RankingPreviewInner() {
    const searchParams = useSearchParams();
    const { t, formatDate, formatNumber } = useI18n();
    const { assetSource } = useTheme();
    const server = normalizeBaijingServer(searchParams.get("server"));
    const competitionId = Number(searchParams.get("competitionId"));
    const rank = Number(searchParams.get("rank"));
    const [metaState, setMetaState] = useState<{
        roomUrl: string;
        entry: BaijingRankingEntry | null;
        error: string | null;
        resolved: boolean;
    }>({ roomUrl: "", entry: null, error: null, resolved: false });

    const hasRequiredParams = Number.isFinite(competitionId) && competitionId > 0 && Number.isFinite(rank) && rank > 0;
    const roomUrl = hasRequiredParams ? getRoomUrl(server, competitionId, rank) : "";
    const previewAssetSource = useMemo<AssetSourceType>(() => replaceAssetSourceRegion(assetSource, server), [assetSource, server]);
    const activeMetaState = metaState.roomUrl === roomUrl ? metaState : null;
    const entry = activeMetaState?.entry ?? null;
    const metaError = activeMetaState?.error ?? null;
    const metaLoading = hasRequiredParams && !activeMetaState?.resolved;
    const thumbnailUrl = entry ? getEntryThumbnailUrl(server, entry) : "";
    const formatBaijingDate = (timestamp?: number) => {
        if (!timestamp) return t("page.mysekaiPreview.common.notProvided");
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return t("page.mysekaiPreview.common.notProvided");
        return formatDate(date, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    useEffect(() => {
        if (!hasRequiredParams) return;
        let cancelled = false;

        fetch(`${roomUrl}?_ts=${Date.now()}`, { cache: "no-store" })
            .then((response) => {
                if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
                return response.json() as Promise<BaijingRoomResponse>;
            })
            .then((data) => {
                if (cancelled) return;
                setMetaState({
                    roomUrl,
                    entry: data.meta?.entry ? { ...data.meta.entry, rank: data.meta.entry.rank || rank } : null,
                    error: null,
                    resolved: true,
                });
            })
            .catch((error) => {
                if (cancelled) return;
                setMetaState({
                    roomUrl,
                    entry: null,
                    error: error instanceof Error ? error.message : String(error),
                    resolved: true,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [hasRequiredParams, roomUrl, rank]);

    if (!hasRequiredParams) return <MissingParamsState />;

    return (
        <MainLayout>
            <div className="container mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-6">
                    <Link href={`/mysekai-preview?server=${server}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-4 py-2 text-sm font-black text-slate-500 shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:border-miku/30 hover:text-miku active:scale-95">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
                        </svg>
                        {t("page.mysekaiPreview.ranking.backToRanking")}
                    </Link>
                </div>

                <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/60 bg-white/64 p-5 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-6 lg:p-7">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                        <div className="min-w-0">
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <span className={`rounded-2xl px-3 py-1.5 text-sm font-black shadow-lg ${getRankTone(rank)}`}>#{rank}</span>
                                <span className="rounded-2xl border border-miku/15 bg-miku/8 px-3 py-1.5 text-[11px] font-black text-miku">
                                    {entry ? getTabTypeLabel(entry.tabType, t) : t("page.mysekaiPreview.common.baijingTop")}
                                </span>
                                <span className="rounded-2xl bg-slate-100/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                                    {server.toUpperCase()} · {t("page.mysekaiPreview.ranking.activityStat")} #{competitionId}
                                </span>
                            </div>
                            <h1 className="line-clamp-2 text-3xl font-black tracking-tight text-primary-text sm:text-4xl lg:text-5xl">
                                {entry?.title || (metaLoading ? t("page.mysekaiPreview.ranking.loadingEntry") : t("page.mysekaiPreview.ranking.layoutPreviewTitle"))}
                            </h1>
                            <p className="mt-3 text-sm font-bold text-slate-500">
                                {entry ? `${entry.ownerUserName || t("page.mysekaiPreview.common.unknownPlayer")} · UID ${entry.ownerUserId || "-"}` : t("page.mysekaiPreview.ranking.entryInfoPending")}
                            </p>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                                {entry?.comment || t("page.mysekaiPreview.ranking.defaultComment")}
                            </p>
                            {metaError && (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-bold text-amber-700">
                                    {t("page.mysekaiPreview.ranking.metaLoadFailed", { message: metaError })}
                                </div>
                            )}
                            <div className="mt-5 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
                                <DetailStat label={t("page.mysekaiPreview.ranking.serverStat")} value={server.toUpperCase()} />
                                <DetailStat label={t("page.mysekaiPreview.ranking.activityStat")} value={`#${competitionId}`} />
                                <DetailStat label={t("page.mysekaiPreview.ranking.rankStat")} value={`#${rank}`} />
                                <DetailStat label={t("page.mysekaiPreview.common.likes")} value={entry ? formatNumber(Number(entry.reviewCount || 0)) : "-"} accent />
                            </div>
                            {entry?.submittedAt && (
                                <div className="mt-3 text-xs font-bold text-slate-400">
                                    {t("page.mysekaiPreview.common.submittedAt", { time: formatBaijingDate(entry.submittedAt) })}
                                </div>
                            )}
                        </div>

                        <div className="order-first lg:order-none">
                            <div className="aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-slate-100 shadow-xl shadow-slate-900/8">
                                {thumbnailUrl ? (
                                    <img src={thumbnailUrl} alt={entry?.title || t("page.mysekaiPreview.ranking.thumbnailAlt")} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
                                        {metaLoading ? t("page.mysekaiPreview.ranking.loadingThumbnail") : t("page.mysekaiPreview.common.noImage")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/65 p-4 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-5">
                    <MysekaiScenePreview
                        key={`${server}-${competitionId}-${rank}`}
                        defaultLayoutUrl={roomUrl}
                        assetSourceOverride={previewAssetSource}
                        persistOptionsEnabled={false}
                        showLayoutUrlInput={false}
                        headerTitle={`#${rank} ${entry?.title || t("page.mysekaiPreview.ranking.layoutFallback")}`}
                        headerBadge={t("page.mysekaiPreview.common.baijingTop")}
                        headerNote=""
                        heightClassName="h-[min(76vh,760px)] min-h-[560px]"
                        compact
                    />
                </section>
            </div>
        </MainLayout>
    );
}

function RankingPreviewFallback() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <div className="container mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
                <div className="rounded-[2rem] border border-white/60 bg-white/65 p-8 text-sm font-bold text-slate-400 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
                    {t("page.mysekaiPreview.ranking.suspenseLoading")}
                </div>
            </div>
        </MainLayout>
    );
}

export default function MysekaiRankingPreviewClient() {
    return (
        <Suspense fallback={<RankingPreviewFallback />}>
            <RankingPreviewInner />
        </Suspense>
    );
}
