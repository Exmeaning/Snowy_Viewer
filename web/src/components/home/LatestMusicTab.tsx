"use client";
import { useState, useEffect, type CSSProperties } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import { IMusicInfo } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getMusicJacketUrl } from "@/lib/assets";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";
import { HandheldEmptyState } from "@/components/handheld";

export default function LatestMusicTab() {
    const { assetSource, isShowSpoiler } = useTheme();
    const { t, formatDate: formatLocaleDate } = useI18n();
    const { t: translateMasterText } = useTranslation();
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const musicsData = await fetchMasterData<IMusicInfo[]>("musics.json");

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
                        <div className="aspect-square rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-sunken)]" />
                        <div className="mt-2 h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="hh-tile hh-tile-tint p-6 rounded-[var(--hh-radius-lg)] text-red-600 text-sm text-center"
                style={{ "--hh-tint": "var(--hh-accent-alert)" } as CSSProperties}
            >
                <p className="font-bold">{t("page.home.latestMusic.loadFailedTitle")}</p>
                <p>{error}</p>
            </div>
        );
    }

    if (musics.length === 0) {
        return (
            <HandheldEmptyState
                title={t("page.home.latestMusic.noData")}
            />
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
                    const translatedTitle = translateMasterText("music", "title", music.title) ?? music.title;
                    const now = Date.now();
                    const isSpoiler = music.publishedAt > now;

                    return (
                        <Link key={music.id} href={`/music/${music.id}`} className="group hh-press">
                            {/* Amber outline marks an unreleased entry — a semantic
                                warning, so it keeps its hue. */}
                            <div className={`hh-tile relative rounded-[var(--hh-radius-lg)] overflow-hidden transition-colors ${isSpoiler ? 'border-amber-400' : 'hover:border-[var(--hh-accent-line)]'}`}>
                                {/* Music Jacket */}
                                <div className="aspect-square relative bg-[var(--hh-surface-sunken)]">
                                    <Image
                                        src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                        alt={music.title}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                    {/* Spoiler Badge */}
                                    {isSpoiler && (
                                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-[var(--hh-radius-xs)]">
                                            {t("page.home.latestMusic.newBadge")}
                                        </div>
                                    )}
                                </div>
                                {/* Music Info */}
                                <div className="p-2">
                                    <p className="text-xs text-[var(--hh-text-secondary)] truncate group-hover:text-miku transition-colors font-medium">
                                        {translatedTitle}
                                    </p>
                                    <p className="hh-numeric text-[10px] text-[var(--hh-text-tertiary)] mt-0.5 hidden sm:block">
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
