"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { IMusicInfo } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getMusicJacketUrl } from "@/lib/assets";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useI18n } from "@/contexts/I18nContext";

export default function LatestMusicTab() {
    const { assetSource, isShowSpoiler } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [musicsData, translationsData] = await Promise.all([
                    fetchMasterData<IMusicInfo[]>("musics.json"),
                    loadTranslations(),
                ]);
                setTranslations(translationsData);

                // Filter and sort by publishedAt
                const now = Date.now();
                const filteredMusics = musicsData
                    .filter(music => isShowSpoiler || music.publishedAt <= now)
                    .sort((a, b) => b.publishedAt - a.publishedAt)
                    .slice(0, 6);

                setMusics(filteredMusics);
                setError(null);
            } catch (err) {
                console.error("Error fetching music data:", err);
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [isShowSpoiler, t]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-square rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
                        <div className="mt-2 h-3 bg-slate-200 rounded w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm text-center">
                <p className="font-bold">{t("page.home.latestMusic.loadFailedTitle")}</p>
                <p>{error}</p>
            </div>
        );
    }

    if (musics.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="font-medium">{t("page.home.latestMusic.noData")}</p>
            </div>
        );
    }

    // Format date helper
    const formatDate = (timestamp: number) => formatLocaleDate(timestamp, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    return (
        <div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {musics.map((music) => {
                    const translatedTitle = translations?.music?.title?.[music.title] || music.title;
                    const now = Date.now();
                    const isSpoiler = music.publishedAt > now;

                    return (
                        <Link key={music.id} href={`/music/${music.id}`} className="group">
                            <div className={`relative rounded-xl overflow-hidden glass-card border border-white/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${isSpoiler ? 'ring-2 ring-amber-400' : ''}`}>
                                {/* Music Jacket */}
                                <div className="aspect-square relative bg-gradient-to-br from-slate-100 to-slate-200">
                                    <Image
                                        src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                        alt={music.title}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                    {/* Spoiler Badge */}
                                    {isSpoiler && (
                                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                                            {t("page.home.latestMusic.newBadge")}
                                        </div>
                                    )}
                                </div>
                                {/* Music Info */}
                                <div className="p-2">
                                    <p className="text-xs text-slate-600 truncate group-hover:text-miku transition-colors font-medium">
                                        {translatedTitle}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                                        {formatDate(music.publishedAt)}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {/* View All Link */}
            <div className="mt-4 text-center">
                <Link href="/music" className="inline-flex items-center gap-1 text-sm text-miku hover:text-miku-dark font-medium transition-colors">
                    {t("page.home.latestMusic.viewAll")}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
