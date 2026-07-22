"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import MainLayout from "@/components/MainLayout";
import LyricText from "@/components/lyrics/LyricText";
import Link from "@/components/LocalizedLink";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { fetchLyricsDocument, getLyricsTargetLocale, type ILyricsDocument } from "@/lib/lyrics";
import type { IMusicInfo } from "@/types/music";
import { getMusicJacketUrl } from "@/types/music";

export default function LyricsDetailClient() {
    const params = useParams();
    const musicId = Number(params.musicId);
    const { locale, t } = useI18n();
    const { assetSource } = useTheme();
    const hasValidMusicId = Number.isInteger(musicId) && musicId > 0;
    const [result, setResult] = useState<{
        musicId: number;
        locale: typeof locale;
        music: IMusicInfo | null;
        lyrics: ILyricsDocument | null;
        error: string | null;
    } | null>(null);

    useEffect(() => {
        if (!hasValidMusicId) return;
        let cancelled = false;
        Promise.all([
            fetchMasterData<IMusicInfo[]>("musics.json"),
            fetchLyricsDocument(musicId),
        ])
            .then(([musics, document]) => {
                if (cancelled) return;
                setResult({
                    musicId,
                    locale,
                    music: musics.find((item) => item.id === musicId) ?? null,
                    lyrics: document,
                    error: null,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setResult({
                        musicId,
                        locale,
                        music: null,
                        lyrics: null,
                        error: t("page.lyrics.error"),
                    });
                }
            });
        return () => { cancelled = true; };
    }, [hasValidMusicId, locale, musicId, t]);

    const currentResult = result?.musicId === musicId && result.locale === locale ? result : null;
    const music = currentResult?.music ?? null;
    const lyrics = currentResult?.lyrics ?? null;
    const error = currentResult?.error ?? null;
    const isLoading = hasValidMusicId && !currentResult;
    const targetLocale = getLyricsTargetLocale(locale);
    const showTargetColumn = Boolean(targetLocale);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/lyrics" className="ios-glass-btn mb-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-slate-500 hover:text-miku">
                    <span aria-hidden="true">←</span>
                    {t("page.lyrics.backToList")}
                </Link>

                {isLoading ? (
                    <div className="flex min-h-[50vh] items-center justify-center" aria-label={t("page.lyrics.loading")}>
                        <div className="loading-spinner" />
                    </div>
                ) : error || !lyrics || !music ? (
                    <div role="alert" className="ios-glass-card rounded-2xl p-10 text-center">
                        <h1 className="text-xl font-bold text-primary-text">{t("page.lyrics.notFound")}</h1>
                        {error && <p className="mt-2 break-words text-sm text-red-600 dark:text-red-300">{error}</p>}
                    </div>
                ) : (
                    <>
                        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl shadow-lg">
                                <Image src={getMusicJacketUrl(music.assetbundleName, assetSource)} alt={music.title} fill className="object-cover" unoptimized />
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs font-mono text-slate-400">#{music.id}</span>
                                <h1 className="break-words text-2xl sm:text-3xl font-black text-primary-text">{music.title}</h1>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{music.lyricist}</p>
                            </div>
                        </header>

                        {lyrics.attribution && (
                            <aside className="ios-glass-card mb-6 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-primary-text">{t("page.lyrics.attribution")}: </span>
                                <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{lyrics.attribution}</span>
                            </aside>
                        )}

                        {lyrics.lines.length === 0 ? (
                            <div className="ios-glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-slate-400">
                                {t("page.lyrics.emptyDocument")}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className={`hidden md:grid gap-4 px-4 text-xs font-bold uppercase tracking-wide text-slate-400 ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                    <span>{t("page.lyrics.japanese")}</span>
                                    {showTargetColumn && <span>{targetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}</span>}
                                </div>
                                {lyrics.lines.map((line) => {
                                    const translated = targetLocale ? line[targetLocale] : undefined;
                                    const targetText = translated || line.japanese;
                                    const performerIds = [...new Set(line.segments.flatMap((segment) => segment.performerIds))];
                                    return (
                                        <article
                                            key={line.id}
                                            className={`ios-glass-card grid grid-cols-1 gap-3 rounded-2xl p-4 md:gap-6 ${line.stanzaBreakBefore ? "mt-8" : ""} ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}
                                        >
                                            <div className="min-w-0">
                                                <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400 md:hidden">{t("page.lyrics.japanese")}</span>
                                                <div className="space-y-1">
                                                    {line.segments.map((segment, index) => (
                                                        <LyricText key={`${line.id}-${index}`} text={segment.text} performerIds={segment.performerIds} />
                                                    ))}
                                                </div>
                                            </div>
                                            {showTargetColumn && (
                                                <div className="min-w-0 border-t border-slate-200/60 pt-3 dark:border-slate-700/60 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                                                    <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400 md:hidden">
                                                        {targetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}
                                                    </span>
                                                    <LyricText text={targetText} performerIds={performerIds} />
                                                    {!translated && (
                                                        <span className="mt-1 block text-[10px] text-slate-400">{t("page.lyrics.sourceFallback")}</span>
                                                    )}
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
