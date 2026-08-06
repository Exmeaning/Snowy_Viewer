"use client";

import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import LyricText from "@/components/lyrics/LyricText";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import {
    fetchLyricsDocument,
    getLyricsDisplayLines,
    getLyricsDisplaySegments,
    getLyricsTargetLocale,
    hasFullLyricsVersion,
    hasGameLyricsVersion,
    isLyricsUnavailableError,
    type ILyricsDocument,
    type LyricsVersion,
} from "@/lib/lyrics";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import type { IMusicInfo, MusicCategoryType } from "@/types/music";
import { getMusicJacketUrl, MUSIC_CATEGORY_COLORS } from "@/types/music";

type RawMusicCategory = MusicCategoryType | { musicCategoryName: MusicCategoryType };

export default function LyricsDetailClient() {
    const params = useParams();
    const searchParams = useSearchParams();
    const musicId = Number(params.musicId);
    const { locale, t, formatDate } = useI18n();
    const { assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();
    const hasValidMusicId = Number.isInteger(musicId) && musicId > 0;
    const requestedVersionParam = searchParams.get("version");
    const requestedVersion: LyricsVersion = requestedVersionParam === "game" ? "game" : "full";
    const [result, setResult] = useState<{
        musicId: number;
        locale: typeof locale;
        music: IMusicInfo | null;
        lyrics: ILyricsDocument | null;
        errorKind: "unavailable" | "failed" | null;
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
                const foundMusic = musics.find((item) => item.id === musicId) ?? null;
                const normalizedMusic = foundMusic
                    ? {
                        ...foundMusic,
                        categories: ((foundMusic.categories ?? []) as unknown as RawMusicCategory[]).map((category) =>
                            typeof category === "object" && category !== null && "musicCategoryName" in category
                                ? category.musicCategoryName
                                : category
                        ),
                    }
                    : null;
                setResult({
                    musicId,
                    locale,
                    music: normalizedMusic,
                    lyrics: document,
                    errorKind: null,
                });
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setResult({
                        musicId,
                        locale,
                        music: null,
                        lyrics: null,
                        errorKind: isLyricsUnavailableError(error) ? "unavailable" : "failed",
                    });
                }
            });
        return () => { cancelled = true; };
    }, [hasValidMusicId, locale, musicId]);

    const currentResult = result?.musicId === musicId && result.locale === locale ? result : null;
    const music = currentResult?.music ?? null;
    const lyrics = currentResult?.lyrics ?? null;
    const errorKind = currentResult?.errorKind ?? null;
    const isLoading = hasValidMusicId && !currentResult;
    const targetLocale = getLyricsTargetLocale(locale);
    const showTargetColumn = Boolean(targetLocale);
    const hasFullVersion = lyrics ? hasFullLyricsVersion(lyrics) : true;
    const hasGameVersion = lyrics ? hasGameLyricsVersion(lyrics) : false;
    const activeVersion: LyricsVersion = requestedVersion === "game" && hasGameVersion
        ? "game"
        : hasFullVersion ? "full" : "game";
    const displayLines = lyrics ? getLyricsDisplayLines(lyrics, activeVersion) : [];
    const translationCredits = lyrics?.version === 2 ? lyrics.translationCredits : undefined;
    const translationCredit = translationCredits?.translation?.trim();
    const proofreadingCredit = translationCredits?.proofreading?.trim();
    const sharedTranslationCredit = translationCredit && translationCredit === proofreadingCredit
        ? translationCredit
        : undefined;

    useEffect(() => {
        if (!lyrics || !requestedVersionParam || (requestedVersionParam === "game" && hasGameVersion)) return;
        const query = new URLSearchParams(searchParams.toString());
        query.delete("version");
        replaceCurrentUrlSearchParams(query);
    }, [hasGameVersion, lyrics, requestedVersionParam, searchParams]);

    useEffect(() => {
        if (music) setDetailName(music.title);
    }, [music, setDetailName]);

    const selectVersion = (version: LyricsVersion) => {
        if (version === "full" && !hasFullVersion || version === "game" && !hasGameVersion) return;
        const query = new URLSearchParams(window.location.search);
        if (version === "game" && hasFullVersion) query.set("version", "game");
        else query.delete("version");
        replaceCurrentUrlSearchParams(query);
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex min-h-[50vh] flex-col items-center justify-center" aria-label={t("page.lyrics.loading")}>
                        <div className="loading-spinner" />
                        <p className="mt-4 text-slate-500 dark:text-slate-400">{t("page.lyrics.loading")}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (errorKind || !lyrics || !music) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div role="alert" className="mx-auto max-w-md text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <svg className="h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-primary-text">
                            {errorKind === "failed" ? t("page.lyrics.error") : t("page.lyrics.notFound")}
                        </h1>
                        <Link href="/lyrics" className="pressable ios-glass-btn ios-glass-btn-primary mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold">
                            <span aria-hidden="true">←</span>
                            {t("page.lyrics.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <header className="mb-8">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            ID: {music.id}
                        </span>
                        {Array.from(new Set(music.categories ?? [])).map((category) => (
                            <span
                                key={category}
                                className="rounded px-2 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: MUSIC_CATEGORY_COLORS[category] }}
                            >
                                {t(`common.musicCategories.${category}`)}
                            </span>
                        ))}
                    </div>
                    <h1 className="break-words text-2xl font-black text-primary-text sm:text-3xl">{music.title}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                        {music.composer && <span>{music.composer}</span>}
                        {music.lyricist && music.lyricist !== music.composer && <span>{music.lyricist}</span>}
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
                    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                        <div className="ios-glass-card overflow-hidden rounded-2xl">
                            <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                                <Image
                                    src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                    alt={music.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1024px) 100vw, 34vw"
                                    unoptimized
                                    priority
                                />
                            </div>
                            <div className="border-t border-slate-100/80 p-5 dark:border-slate-700/60">
                                <dl className="space-y-3 text-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <dt className="text-slate-500 dark:text-slate-400">{t("page.lyrics.revision")}</dt>
                                        <dd className="font-mono font-bold text-primary-text">v{lyrics.revision}</dd>
                                    </div>
                                    <div className="flex items-start justify-between gap-4">
                                        <dt className="text-slate-500 dark:text-slate-400">{t("page.lyrics.updatedAt")}</dt>
                                        <dd className="text-right font-medium text-primary-text">
                                            {formatDate(lyrics.updatedAt, { year: "numeric", month: "short", day: "numeric" })}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <div className="ios-glass-card overflow-hidden rounded-2xl">
                            <div className="border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent px-5 py-4 dark:border-slate-700/60 dark:from-miku/10">
                                <h2 className="flex items-center gap-2 font-bold text-primary-text">
                                    <svg className="h-5 w-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t("page.lyrics.attribution")}
                                </h2>
                            </div>
                            <div className="p-5">
                                {lyrics.version === 1 ? (
                                    <dl className="text-sm">
                                        <div className="space-y-1">
                                            <dt className="font-bold text-primary-text">{t("page.lyrics.translation")}</dt>
                                            <dd className="whitespace-pre-wrap break-words leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                                                {lyrics.attribution}
                                            </dd>
                                        </div>
                                    </dl>
                                ) : translationCredits ? (
                                    <dl className="space-y-4 text-sm">
                                        {sharedTranslationCredit ? (
                                            <div className="space-y-1">
                                                <dt className="font-bold text-primary-text">{t("page.lyrics.translationAndProofreading")}</dt>
                                                <dd className="whitespace-pre-wrap break-words leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                                                    {sharedTranslationCredit}
                                                </dd>
                                            </div>
                                        ) : (
                                            <>
                                                {translationCredit && (
                                                    <div className="space-y-1">
                                                        <dt className="font-bold text-primary-text">{t("page.lyrics.translation")}</dt>
                                                        <dd className="whitespace-pre-wrap break-words leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                                                            {translationCredit}
                                                        </dd>
                                                    </div>
                                                )}
                                                {proofreadingCredit && (
                                                    <div className="space-y-1">
                                                        <dt className="font-bold text-primary-text">{t("page.lyrics.proofreading")}</dt>
                                                        <dd className="whitespace-pre-wrap break-words leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                                                            {proofreadingCredit}
                                                        </dd>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </dl>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {t("page.lyrics.translationCreditsEmpty")}
                                    </p>
                                )}
                            </div>
                            {lyrics.version === 2 && (
                                <>
                                    <div className="border-y border-slate-100/80 bg-slate-50/40 px-5 py-3 dark:border-slate-700/60 dark:bg-slate-900/20">
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            {t("page.lyrics.sourceLicenseTitle")}
                                        </h3>
                                    </div>
                                    <ul className="divide-y divide-slate-100/80 dark:divide-slate-700/60">
                                        {lyrics.attributions.map((attribution) => (
                                            <li key={`${attribution.provider}-${attribution.revisionUrl}`} className="space-y-2 p-5 text-sm">
                                                <div>
                                                    <p className="font-bold text-primary-text">{t(`page.lyrics.attributionProviders.${attribution.provider}`)}</p>
                                                    <p className="mt-0.5 break-words text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">{attribution.title}</p>
                                                </div>
                                                <dl className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                        <dt>{t("page.lyrics.sourceRevision")}</dt>
                                                        <dd>
                                                            <ExternalLink href={attribution.revisionUrl} className="font-mono font-bold text-miku hover:underline">
                                                                {attribution.revisionId}
                                                            </ExternalLink>
                                                        </dd>
                                                    </div>
                                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                        <dt>{t("page.lyrics.sourceLicense")}</dt>
                                                        <dd>
                                                            <ExternalLink href={attribution.licenseUrl} className="font-medium text-miku hover:underline">
                                                                {attribution.licenseName}
                                                            </ExternalLink>
                                                        </dd>
                                                    </div>
                                                </dl>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </aside>

                    <section className="min-w-0">
                        <div className="ios-glass-card overflow-hidden rounded-2xl">
                            <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent px-5 py-4 dark:border-slate-700/60 dark:from-miku/10 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="flex items-center gap-2 font-bold text-primary-text">
                                    <svg className="h-5 w-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    {t("page.lyrics.contentTitle")}
                                </h2>
                                <div role="group" aria-label={t("page.lyrics.versionLabel")} className="inline-flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                                    {hasFullVersion && (
                                        <button
                                            type="button"
                                            aria-pressed={activeVersion === "full"}
                                            onClick={() => selectVersion("full")}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeVersion === "full"
                                                ? "bg-white text-miku shadow-sm dark:bg-slate-700"
                                                : "text-slate-500 hover:text-primary-text dark:text-slate-300"
                                            }`}
                                        >
                                            {t("page.lyrics.versionFull")}
                                        </button>
                                    )}
                                    {hasGameVersion && (
                                        <button
                                            type="button"
                                            aria-pressed={activeVersion === "game"}
                                            onClick={() => selectVersion("game")}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activeVersion === "game"
                                                ? "bg-white text-miku shadow-sm dark:bg-slate-700"
                                                : "text-slate-500 hover:text-primary-text dark:text-slate-300"
                                            }`}
                                        >
                                            {t("page.lyrics.versionGame")}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {displayLines.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 dark:text-slate-400">
                                    {t("page.lyrics.emptyDocument")}
                                </div>
                            ) : (
                                <div>
                                    <div className={`hidden gap-6 border-b border-slate-100 bg-white/30 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/20 md:grid ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                        <span>{t("page.lyrics.japanese")}</span>
                                        {showTargetColumn && (
                                            <span>{targetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}</span>
                                        )}
                                    </div>
                                    <div className="divide-y divide-slate-100/80 dark:divide-slate-700/60">
                                        {displayLines.map((line) => {
                                            const translated = targetLocale ? line[targetLocale] : undefined;
                                            const targetText = translated || line.japanese;
                                            return (
                                                <article
                                                    key={line.id}
                                                    className={`${line.stanzaBreakBefore ? "border-t-8 border-t-slate-100/80 dark:border-t-slate-800/80" : ""} grid grid-cols-1 gap-4 px-5 py-5 md:gap-6 ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}
                                                >
                                                    <div className="min-w-0">
                                                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400 md:hidden">
                                                            {t("page.lyrics.japanese")}
                                                        </span>
                                                        <LyricText
                                                            segments={getLyricsDisplaySegments(line)}
                                                            trailingPerformerIds={"trailingPerformerIds" in line ? line.trailingPerformerIds : undefined}
                                                        />
                                                    </div>
                                                    {showTargetColumn && (
                                                        <div className="min-w-0 border-t border-slate-200/60 pt-4 dark:border-slate-700/60 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                                                            <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400 md:hidden">
                                                                {targetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}
                                                            </span>
                                                            <LyricText text={targetText} performerIds={[]} />
                                                            {!translated && (
                                                                <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                                                    {t("page.lyrics.translationFallback")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/lyrics" className="pressable ios-glass-btn inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-slate-600 hover:text-miku dark:text-slate-300">
                        <span aria-hidden="true">←</span>
                        {t("page.lyrics.backToList")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}
