"use client";

import Link from "@/components/LocalizedLink";
import { useCallback, useEffect, useState } from "react";

import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme, type ServerSourceType } from "@/contexts/ThemeContext";
import {
    type BaijingActiveRankingsResponse,
    type BaijingRankingEntry,
    type BaijingRankingSnapshot,
    type BaijingServer,
    getActiveRankingsUrl,
    getEntryThumbnailUrl,
    getRankTone,
    getTabTypeLabel,
} from "@/lib/mysekai-preview/baijing";

function RankingSkeleton() {
    return (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)] p-3">
                    <div className="aspect-[4/3] animate-pulse rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)]" />
                    <div className="mt-4 space-y-2 px-1 pb-2">
                        <div className="h-4 w-2/3 animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-3 w-full animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-3 w-1/2 animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ server }: { server: BaijingServer }) {
    const { t } = useI18n();

    return (
        <div className="hh-well border-dashed p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-2)] text-[var(--hh-text-tertiary)]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10.5 12 4l9 6.5M5 10v8.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V10M8 20v-6h8v6" />
                </svg>
            </div>
            <h3 className="hh-title mt-4 text-lg text-[var(--hh-text-primary)]">{t("page.mysekaiPreview.top.emptyTitle", { server: server.toUpperCase() })}</h3>
            <p className="hh-body mx-auto mt-2 max-w-md text-sm text-[var(--hh-text-secondary)]">
                {t("page.mysekaiPreview.top.emptyDescription")}
            </p>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    const { t } = useI18n();

    return (
        <div className="rounded-[var(--hh-radius-lg)] border border-red-500/30 bg-red-500/12 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="hh-title text-lg text-red-600">{t("page.mysekaiPreview.top.loadFailedTitle")}</h3>
                    <p className="mt-1 text-sm text-red-600/80">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="hh-press hh-focusable rounded-[var(--hh-radius-md)] bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600"
                >
                    {t("page.mysekaiPreview.top.reload")}
                </button>
            </div>
        </div>
    );
}

function HeartIcon({ className = "" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11.995 20.545a1.1 1.1 0 0 1-.672-.23C8.924 18.46 6.94 16.79 5.367 15.19 3.549 13.34 2.5 11.54 2.5 9.53 2.5 6.63 4.85 4.4 7.69 4.4c1.61 0 3.13.75 4.305 2.01C13.17 5.15 14.69 4.4 16.3 4.4c2.84 0 5.2 2.23 5.2 5.13 0 2.01-1.05 3.81-2.867 5.66-1.573 1.6-3.557 3.27-5.956 5.125a1.1 1.1 0 0 1-.682.23Z" />
        </svg>
    );
}

function RankingCard({
    server,
    competitionId,
    entry,
}: {
    server: BaijingServer;
    competitionId: number;
    entry: BaijingRankingEntry;
}) {
    const { t, formatNumber } = useI18n();
    const [imageFailed, setImageFailed] = useState(false);
    const thumbnailUrl = getEntryThumbnailUrl(server, entry);
    const href = `/mysekai-preview/ranking?server=${server}&competitionId=${competitionId}&rank=${entry.rank}`;

    return (
        <Link
            href={href}
            data-shortcut-item="true"
            className="hh-tile hh-press group block h-full overflow-hidden rounded-[var(--hh-radius-lg)] p-3 text-left hover:border-[var(--hh-accent-line)]"
        >
            <div className="aspect-[4/3] overflow-hidden rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)]">
                {thumbnailUrl && !imageFailed ? (
                    <img
                        src={thumbnailUrl}
                        alt={entry.title || `Rank ${entry.rank}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--hh-text-tertiary)]">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                        </svg>
                    </div>
                )}
            </div>

            <div className="px-1 pb-1 pt-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`hh-numeric rounded-[var(--hh-radius-sm)] px-3 py-1.5 text-sm font-bold ${getRankTone(entry.rank)}`}>
                        #{entry.rank}
                    </span>
                    <span className="rounded-[var(--hh-radius-sm)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-3 py-1.5 text-[11px] font-bold text-miku">
                        {getTabTypeLabel(entry.tabType, t)}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--hh-radius-sm)] border border-rose-500/25 bg-rose-500/12 px-3 py-1.5 text-[11px] font-bold text-rose-500">
                        <HeartIcon className="h-3.5 w-3.5" />
                        <span className="text-[var(--hh-text-tertiary)]">{t("page.mysekaiPreview.common.likes")}</span>
                        <span className="hh-numeric">{formatNumber(Number(entry.reviewCount || 0))}</span>
                    </span>
                </div>

                <h3 className="hh-title line-clamp-2 min-h-[2.5rem] text-base text-[var(--hh-text-primary)] transition group-hover:text-miku">
                    {entry.title || t("page.mysekaiPreview.common.unnamedLayout")}
                </h3>
                <div className="mt-2 min-w-0">
                    <div className="truncate text-sm font-bold text-[var(--hh-text-primary)]">{entry.ownerUserName || t("page.mysekaiPreview.common.unknownPlayer")}</div>
                    <div className="hh-numeric mt-0.5 truncate text-[11px] font-medium text-[var(--hh-text-tertiary)]">UID {entry.ownerUserId || "-"}</div>
                </div>
                <p className="hh-body mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-[var(--hh-text-secondary)]">
                    {entry.comment || t("page.mysekaiPreview.common.noComment")}
                </p>
                <div className="mt-4 flex items-center justify-between rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] px-3 py-2 text-[11px] font-bold text-[var(--hh-text-tertiary)] transition group-hover:bg-[var(--hh-accent-wash)] group-hover:text-miku">
                    <span>{t("page.mysekaiPreview.top.enterPreview")}</span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                    </svg>
                </div>
            </div>
        </Link>
    );
}

export default function MysekaiPreviewClient() {
    const { t, formatNumber, formatDate } = useI18n();
    const { serverSource, setServerSource } = useTheme();
    const [server, setServer] = useState<BaijingServer>(serverSource === "cn" ? "cn" : "jp");
    const [rankings, setRankings] = useState<BaijingRankingSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRankings = useCallback(async (targetServer: BaijingServer) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${getActiveRankingsUrl(targetServer)}?_ts=${Date.now()}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const data = await response.json() as BaijingActiveRankingsResponse;
            const nextRankings = (data.rankings || []).map((snapshot) => ({
                ...snapshot,
                server: (snapshot.server || targetServer) as BaijingServer,
                top100: Array.isArray(snapshot.top100) ? snapshot.top100 : [],
            }));
            setRankings(nextRankings);
        } catch (loadError) {
            setRankings([]);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setServer(serverSource === "cn" ? "cn" : "jp");
    }, [serverSource]);

    useEffect(() => {
        void loadRankings(server);
    }, [loadRankings, server]);

    const handleServerChange = (nextServer: BaijingServer) => {
        setServer(nextServer);
        setServerSource(nextServer as ServerSourceType);
    };

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

    return (
        <MainLayout>
            <div className="container mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-4 py-2">
                        <span className="hh-label text-miku">{t("page.mysekaiPreview.badges.top")}</span>
                    </div>
                    <h1 className="hh-display text-3xl text-primary-text sm:text-4xl">
                        {t("page.mysekaiPreview.top.title")} <span className="text-miku">{t("page.mysekaiPreview.top.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body mx-auto mt-2 max-w-2xl text-sm text-[var(--hh-text-secondary)] sm:text-base">
                        {t("page.mysekaiPreview.top.description")}
                    </p>
                </div>

                <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-4 py-2 text-sm font-bold text-miku sm:w-fit sm:justify-start">
                    <div
                        className="h-6 w-6 shrink-0 bg-miku"
                        style={{
                            maskImage: "url(/miku.webp)",
                            maskSize: "contain",
                            maskRepeat: "no-repeat",
                            maskPosition: "center",
                            WebkitMaskImage: "url(/miku.webp)",
                            WebkitMaskSize: "contain",
                            WebkitMaskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                        }}
                    />
                    <span>{t("page.mysekaiPreview.top.disclaimer")}</span>
                </div>

                <section className="hh-panel mb-6 p-3 sm:p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-[var(--hh-radius-md)] bg-[var(--hh-accent)] px-4 py-2.5 text-sm font-bold text-[var(--hh-text-on-accent)]">
                                {t("page.mysekaiPreview.common.topRanking")}
                            </span>
                            <span className="rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] px-4 py-2.5 text-sm font-bold text-[var(--hh-text-secondary)]">
                                {loading ? t("page.mysekaiPreview.common.loading") : t("page.mysekaiPreview.common.activityCount", { count: formatNumber(rankings.length) })}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="hh-label px-2">Server</span>
                            {(["jp", "cn"] as BaijingServer[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleServerChange(item)}
                                    className={`hh-press hh-focusable rounded-[var(--hh-radius-md)] border px-4 py-2.5 text-sm font-bold ${server === item
                                        ? "border-[var(--hh-accent)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                        : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                                        }`}
                                >
                                    {item.toUpperCase()}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => void loadRankings(server)}
                                className="hh-press hh-focusable rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] px-4 py-2.5 text-sm font-bold text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                            >
                                {t("page.mysekaiPreview.top.refresh")}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    {loading ? (
                        <RankingSkeleton />
                    ) : error ? (
                        <ErrorState message={error} onRetry={() => void loadRankings(server)} />
                    ) : rankings.length === 0 ? (
                        <EmptyState server={server} />
                    ) : (
                        rankings.map((snapshot) => {
                            const entries = snapshot.top100 || [];
                            return (
                                <div key={snapshot.competition.id} className="hh-panel p-4 sm:p-5">
                                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="hh-title text-2xl text-[var(--hh-text-primary)]">{snapshot.competition.name || t("page.mysekaiPreview.common.activityWithId", { id: snapshot.competition.id })}</h2>
                                                <span className="hh-numeric rounded-[var(--hh-radius-sm)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-3 py-1 text-xs font-bold text-miku">
                                                    #{snapshot.competition.id}
                                                </span>
                                            </div>
                                            <p className="hh-body mt-2 max-w-3xl text-sm text-[var(--hh-text-secondary)]">
                                                {snapshot.competition.description || t("page.mysekaiPreview.common.noCompetitionDescription")}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-[var(--hh-text-tertiary)]">
                                                <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-3 py-1">{t("page.mysekaiPreview.common.submission")} {formatBaijingDate(snapshot.competition.submitStartAt)} - {formatBaijingDate(snapshot.competition.submitEndAt)}</span>
                                                <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-3 py-1">{t("page.mysekaiPreview.common.aggregate")} {formatBaijingDate(snapshot.competition.aggregateAt)}</span>
                                                <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-3 py-1">{t("page.mysekaiPreview.common.snapshot")} {formatBaijingDate(snapshot.snapshotGeneratedAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-center">
                                            <div className="hh-tile rounded-[var(--hh-radius-lg)] px-4 py-3">
                                                <div className="hh-label">{t("page.mysekaiPreview.common.totalEntries")}</div>
                                                <div className="hh-numeric text-lg font-bold text-[var(--hh-text-primary)]">{formatNumber(Number(snapshot.totalUniqueEntries || 0))}</div>
                                            </div>
                                            <div className="hh-tile rounded-[var(--hh-radius-lg)] px-4 py-3">
                                                <div className="hh-label">{t("page.mysekaiPreview.common.topCount")}</div>
                                                <div className="hh-numeric text-lg font-bold text-[var(--hh-text-primary)]">{formatNumber(entries.length)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {entries.length === 0 ? (
                                        <EmptyState server={server} />
                                    ) : (
                                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                            {entries.map((entry) => (
                                                <RankingCard
                                                    key={`${snapshot.competition.id}-${entry.rank}-${entry.key || entry.ownerUserId || "entry"}`}
                                                    server={server}
                                                    competitionId={Number(snapshot.competition.id)}
                                                    entry={entry}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </section>
            </div>
        </MainLayout>
    );
}
