"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import MainLayout from "@/components/MainLayout";
import { useTheme, type ServerSourceType } from "@/contexts/ThemeContext";
import {
    type BaijingActiveRankingsResponse,
    type BaijingRankingEntry,
    type BaijingRankingSnapshot,
    type BaijingServer,
    formatFullDateTime,
    formatNumber,
    getActiveRankingsUrl,
    getEntryThumbnailUrl,
    getRankTone,
    getTabTypeLabel,
} from "@/lib/mysekai-preview/baijing";

function RankingSkeleton() {
    return (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 p-3 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
                    <div className="aspect-[4/3] animate-pulse rounded-[1.35rem] bg-slate-100" />
                    <div className="mt-4 space-y-2 px-1 pb-2">
                        <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ server }: { server: BaijingServer }) {
    return (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/55 p-8 text-center shadow-lg shadow-slate-900/5 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10.5 12 4l9 6.5M5 10v8.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V10M8 20v-6h8v6" />
                </svg>
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-700">{server.toUpperCase()} 当前没有开放中的百景排行</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                等有新的百景活动开放后，这里会自动显示 TOP 投稿和缩略图预览。
            </p>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="rounded-[2rem] border border-red-200/70 bg-red-50/80 p-6 shadow-lg shadow-red-900/5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-black text-red-700">百景数据加载失败</h3>
                    <p className="mt-1 text-sm text-red-600/80">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-2xl bg-red-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                >
                    重新加载
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
    const [imageFailed, setImageFailed] = useState(false);
    const thumbnailUrl = getEntryThumbnailUrl(server, entry);
    const href = `/mysekai-preview/ranking?server=${server}&competitionId=${competitionId}&rank=${entry.rank}`;

    return (
        <Link
            href={href}
            data-shortcut-item="true"
            className="group block h-full overflow-hidden rounded-[1.85rem] border border-white/60 bg-white/72 p-3 text-left shadow-lg shadow-slate-900/5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-miku/35 hover:shadow-2xl active:scale-[0.99]"
        >
            <div className="aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
                {thumbnailUrl && !imageFailed ? (
                    <img
                        src={thumbnailUrl}
                        alt={entry.title || `Rank ${entry.rank}`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                        </svg>
                    </div>
                )}
            </div>

            <div className="px-1 pb-1 pt-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-2xl px-3 py-1.5 text-sm font-black shadow-lg ${getRankTone(entry.rank)}`}>
                        #{entry.rank}
                    </span>
                    <span className="rounded-2xl border border-miku/15 bg-miku/8 px-3 py-1.5 text-[11px] font-black text-miku">
                        {getTabTypeLabel(entry.tabType)}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-2xl bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-500 ring-1 ring-rose-100">
                        <HeartIcon className="h-3.5 w-3.5" />
                        <span className="text-slate-400">点赞量</span>
                        <span>{formatNumber(entry.reviewCount)}</span>
                    </span>
                </div>

                <h3 className="line-clamp-2 min-h-[2.5rem] text-base font-black leading-snug text-slate-800 transition group-hover:text-miku">
                    {entry.title || "未命名布局"}
                </h3>
                <div className="mt-2 min-w-0">
                    <div className="truncate text-sm font-black text-slate-700">{entry.ownerUserName || "未知玩家"}</div>
                    <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400">UID {entry.ownerUserId || "-"}</div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500">
                    {entry.comment || "作者没有留下说明。"}
                </p>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50/85 px-3 py-2 text-[11px] font-bold text-slate-400 transition group-hover:bg-miku/8 group-hover:text-miku">
                    <span>进入 3D 预览</span>
                    <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" />
                    </svg>
                </div>
            </div>
        </Link>
    );
}

export default function MysekaiPreviewClient() {
    const { serverSource, setServerSource } = useTheme();
    const [server, setServer] = useState<BaijingServer>(serverSource);
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
        setServer(serverSource);
    }, [serverSource]);

    useEffect(() => {
        void loadRankings(server);
    }, [loadRankings, server]);

    const handleServerChange = (nextServer: BaijingServer) => {
        setServer(nextServer);
        setServerSource(nextServer as ServerSourceType);
    };

    return (
        <MainLayout>
            <div className="container mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-miku/30 bg-miku/5 px-4 py-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-miku">MySekai Housing Competition</span>
                    </div>
                    <h1 className="text-3xl font-black text-primary-text sm:text-4xl">
                        烤森 <span className="text-miku">百景</span>
                    </h1>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                        查看当前开放的 MySekai 百景 TOP 投稿排行，点击作品即可进入对应 3D 布局预览。
                    </p>
                </div>

                <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-full border border-miku/25 bg-miku/8 px-4 py-2 text-sm font-bold text-miku shadow-sm sm:w-fit sm:justify-start">
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
                    <span>排行由 Moesekai 实验室探索得出，可能具有延迟或数据不准确，请勿作为百景投票标准。</span>
                </div>

                <section className="mb-6 rounded-[2rem] border border-white/60 bg-white/65 p-3 shadow-xl shadow-slate-900/5 backdrop-blur-2xl sm:p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-2xl bg-miku px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-miku/20">
                                TOP 排行
                            </span>
                            <span className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-500">
                                {loading ? "读取中…" : `${formatNumber(rankings.length)} 个活动`}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Server</span>
                            {(["jp", "cn"] as BaijingServer[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleServerChange(item)}
                                    className={`rounded-2xl px-4 py-2.5 text-sm font-black transition active:scale-95 ${server === item
                                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                        : "border border-slate-200 bg-white/75 text-slate-500 hover:border-miku/30 hover:text-miku"
                                        }`}
                                >
                                    {item.toUpperCase()}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => void loadRankings(server)}
                                className="rounded-2xl border border-slate-200 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-500 transition hover:border-miku/30 hover:text-miku active:scale-95"
                            >
                                刷新
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
                                <div key={snapshot.competition.id} className="rounded-[2rem] border border-white/60 bg-white/55 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-2xl sm:p-5">
                                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-2xl font-black text-slate-800">{snapshot.competition.name || `百景活动 #${snapshot.competition.id}`}</h2>
                                                <span className="rounded-full bg-miku/10 px-3 py-1 text-xs font-black text-miku ring-1 ring-miku/20">
                                                    #{snapshot.competition.id}
                                                </span>
                                            </div>
                                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                                                {snapshot.competition.description || "暂无活动说明。"}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-400">
                                                <span className="rounded-full bg-slate-100/80 px-3 py-1">投稿 {formatFullDateTime(snapshot.competition.submitStartAt)} - {formatFullDateTime(snapshot.competition.submitEndAt)}</span>
                                                <span className="rounded-full bg-slate-100/80 px-3 py-1">汇总 {formatFullDateTime(snapshot.competition.aggregateAt)}</span>
                                                <span className="rounded-full bg-slate-100/80 px-3 py-1">快照 {formatFullDateTime(snapshot.snapshotGeneratedAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-center">
                                            <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                                                <div className="text-[10px] font-bold text-slate-400">总投稿</div>
                                                <div className="text-lg font-black text-slate-700">{formatNumber(snapshot.totalUniqueEntries)}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                                                <div className="text-[10px] font-bold text-slate-400">TOP</div>
                                                <div className="text-lg font-black text-slate-700">{formatNumber(entries.length)}</div>
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
