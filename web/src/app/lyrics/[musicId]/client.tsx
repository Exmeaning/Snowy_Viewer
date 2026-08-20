"use client";

import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import LyricText from "@/components/lyrics/LyricText";
import TranslationEditionSelect from "@/components/lyrics/TranslationEditionSelect";
import Link from "@/components/LocalizedLink";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme, AssetSourceType } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl, getMusicVocalAudioUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";
import {
    fetchLyricsDocument,
    getLyricsDisplayLines,
    getLyricsDisplaySegments,
    getLyricsRendition,
    getLyricsRenditions,
    getLyricsSelectedTranslationCredits,
    getLyricsTargetLocale,
    getLyricsTranslationEditions,
    getPublishedLyricsIndexEntry,
    hasFullLyricsVersion,
    resolveLyricsTranslationEdition,
    hasGameLyricsVersion,
    isLyricsUnavailableError,
    type ILyricsAttribution,
    type ILyricsDocument,
    type ILyricsIndexEntry,
    type ILyricsV3ComponentAttribution,
    type LyricsVersion,
} from "@/lib/lyrics";
import { fetchLyricsMusicById } from "@/lib/lyrics-music-source";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import type { IMusicInfo, IMusicVocalInfo, IOutsideCharacter } from "@/types/music";
import { getMusicJacketUrl, MUSIC_CATEGORY_COLORS } from "@/types/music";
type LyricsDisplayAttribution = ILyricsAttribution | ILyricsV3ComponentAttribution;

function getLyricsDisplayAttributions(attributions: readonly LyricsDisplayAttribution[]): LyricsDisplayAttribution[] {
    const seen = new Set<string>();
    return attributions.filter((attribution) => {
        const identity = [
            attribution.provider,
            attribution.title,
            attribution.revisionId,
            attribution.revisionUrl,
            attribution.licenseName,
            attribution.licenseUrl,
        ].join("\u0000");
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
    });
}

// Vocal Audio Player Component aligned with /music/[id]
function VocalPlayer({
    vocal,
    fillerSec,
    assetSource,
    outsideCharacters,
    downloadLabel,
    getCharacterLabel,
}: {
    vocal: IMusicVocalInfo;
    fillerSec: number;
    assetSource: AssetSourceType;
    outsideCharacters: Record<number, string>;
    downloadLabel: string;
    getCharacterLabel: (characterId: number) => string;
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrl = getMusicVocalAudioUrl(vocal.assetbundleName, assetSource);

    const togglePlay = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.onplay = () => setIsPlaying(true);
            audioRef.current.onpause = () => setIsPlaying(false);
            audioRef.current.onloadedmetadata = () => {
                if (audioRef.current) setDuration(audioRef.current.duration);
            };
            audioRef.current.ontimeupdate = () => {
                if (audioRef.current) {
                    setProgress(audioRef.current.currentTime);
                }
            };

            if (fillerSec > 0) {
                audioRef.current.currentTime = fillerSec;
            }
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setProgress(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="px-5 py-4 hover:bg-[var(--hh-surface-3)] transition-colors group">
            <div className="flex items-center gap-4">
                <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className={`hh-press hh-focusable shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isPlaying
                        ? "bg-[var(--hh-text-primary)] text-[var(--hh-surface-2)]"
                        : "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                    }`}
                >
                    {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm font-bold text-primary-text truncate">
                            <TranslatedText
                                original={vocal.caption}
                                category="music"
                                field="vocalCaption"
                                originalClassName="truncate block"
                                translationClassName="text-xs text-[var(--hh-text-tertiary)] truncate block font-normal"
                            />
                        </div>
                        <a
                            href={audioUrl}
                            download={`${vocal.caption}.mp3`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-deep)] hover:bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] transition-colors"
                            title={downloadLabel}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </a>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                        {vocal.characters?.map((chara) => {
                            const isGameChar = chara.characterType === "game_character";
                            const charName = isGameChar
                                ? getCharacterLabel(chara.characterId)
                                : outsideCharacters[chara.characterId] || `Guest ${chara.characterId}`;
                            const hasIcon = isGameChar && chara.characterId <= 26;

                            return hasIcon ? (
                                <div
                                    key={chara.id}
                                    className="w-6 h-6 rounded-full overflow-hidden bg-[var(--hh-surface-sunken)] ring-1 ring-[var(--hh-border)]"
                                    title={charName}
                                >
                                    <Image
                                        src={getCharacterIconUrl(chara.characterId)}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <span
                                    key={chara.id}
                                    className="text-[10px] px-2 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] rounded-[var(--hh-radius-xs)]"
                                >
                                    {charName}
                                </span>
                            );
                        })}
                    </div>

                    {duration > 0 && (
                        /* Tabular time codes: the elapsed side reflows every second and
                           would otherwise shift the seek bar's left edge. */
                        <div className="hh-numeric flex items-center gap-2 text-xs text-[var(--hh-text-tertiary)]">
                            <span>{formatTime(progress)}</span>
                            <input
                                type="range"
                                min={0}
                                max={duration}
                                step={0.1}
                                value={progress}
                                onChange={handleSeek}
                                className="flex-1 h-1 bg-[var(--hh-surface-inset)] rounded-[var(--hh-radius-xs)] appearance-none cursor-pointer accent-[var(--hh-accent)]"
                            />
                            <span>{formatTime(duration)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LyricsDetailClient() {
    const params = useParams();
    const searchParams = useSearchParams();
    const musicId = Number(params.musicId);
    const { locale, t, formatDate } = useI18n();
    const { assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();
    const hasValidMusicId = Number.isInteger(musicId) && musicId > 0;
    const searchParamString = searchParams.toString();
    const requestedVersionParams = searchParams.getAll("version");
    const requestedVersionParam = requestedVersionParams.length === 1 ? requestedVersionParams[0] : null;
    const requestedVersion: LyricsVersion = requestedVersionParam === "game" ? "game" : "full";
    const requestedRenditionParams = searchParams.getAll("rendition");
    const requestedRenditionParamCount = requestedRenditionParams.length;
    const requestedRenditionKey = requestedRenditionParamCount === 1 ? requestedRenditionParams[0] : null;
    const requestedTranslationParams = searchParams.getAll("translation");
    const requestedTranslationEditionKey = requestedTranslationParams.length === 1 ? requestedTranslationParams[0] : null;
    const [result, setResult] = useState<{
        musicId: number;
        locale: typeof locale;
        music: IMusicInfo | null;
        publication: ILyricsIndexEntry | null;
        lyrics: ILyricsDocument | null;
        errorKind: "unavailable" | "not-found" | "failed" | null;
    } | null>(null);
    const [vocals, setVocals] = useState<IMusicVocalInfo[]>([]);
    const [outsideCharacters, setOutsideCharacters] = useState<Record<number, string>>({});

    useEffect(() => {
        if (!hasValidMusicId) return;
        let cancelled = false;
        Promise.all([
            fetchLyricsMusicById(musicId),
            getPublishedLyricsIndexEntry(musicId),
            fetchLyricsDocument(musicId).then(
                (document) => ({ document, error: null as unknown }),
                (error: unknown) => ({ document: null, error }),
            ),
            fetchMasterData<IMusicVocalInfo[]>("musicVocals.json").catch(() => []),
            fetchMasterData<IOutsideCharacter[]>("outsideCharacters.json").catch(() => [] as IOutsideCharacter[]),
        ])
            .then(([music, publication, detail, vocalsData, outsideCharsData]) => {
                if (cancelled) return;
                const errorKind = detail.error
                    ? isLyricsUnavailableError(detail.error) ? publication ? "unavailable" : "not-found" : "failed"
                    : null;
                setResult({
                    musicId,
                    locale,
                    music,
                    publication,
                    lyrics: detail.document,
                    errorKind,
                });
                setVocals((vocalsData || []).filter((v) => v.musicId === musicId));
                // Build outside character name map
                const outsideCharMap: Record<number, string> = {};
                for (const oc of outsideCharsData) {
                    outsideCharMap[oc.id] = oc.name;
                }
                setOutsideCharacters(outsideCharMap);
            })
            .catch(() => {
                if (!cancelled) {
                    setResult({
                        musicId,
                        locale,
                        music: null,
                        publication: null,
                        lyrics: null,
                        errorKind: "failed",
                    });
                }
            });
        return () => { cancelled = true; };
    }, [hasValidMusicId, locale, musicId]);

    const currentResult = result?.musicId === musicId && result.locale === locale ? result : null;
    const music = currentResult?.music ?? null;
    const lyrics = currentResult?.lyrics ?? null;
    const publication = currentResult?.publication ?? null;
    const errorKind = currentResult?.errorKind ?? null;
    const isLoading = hasValidMusicId && !currentResult;
    const targetLocale = getLyricsTargetLocale(locale);
    // Public v4 currently carries zh-CN editions only. Other UI locales must
    // remain genuinely source-only instead of relabeling Japanese fallback text.
    const displayTargetLocale = lyrics?.version === 4 && targetLocale !== "zh-CN" ? null : targetLocale;
    const hasRenditionDimension = lyrics?.version === 3 || lyrics?.version === 4;
    const renditions = lyrics && hasRenditionDimension ? [...getLyricsRenditions(lyrics)] : [];
    const activeRendition = lyrics && hasRenditionDimension
        ? getLyricsRendition(lyrics, requestedRenditionKey)
        : null;
    const versionSource = activeRendition ?? lyrics;
    const hasFullVersion = versionSource ? hasFullLyricsVersion(versionSource) : true;
    const hasGameVersion = versionSource ? hasGameLyricsVersion(versionSource) : false;
    const activeVersion: LyricsVersion = requestedVersion === "game" && hasGameVersion
        ? "game"
        : hasFullVersion ? "full" : "game";
    const translationEditions = lyrics ? [...getLyricsTranslationEditions(lyrics, locale)] : [];
    const activeTranslationEdition = lyrics
        ? resolveLyricsTranslationEdition(lyrics, locale, requestedTranslationEditionKey)
        : null;
    const activeTranslationEditionKey = activeTranslationEdition?.key ?? null;
    const displayLines = lyrics
        ? getLyricsDisplayLines(lyrics, activeVersion, activeRendition?.key, activeTranslationEditionKey, locale)
        : [];
    const hasTargetTranslation = displayTargetLocale
        ? displayLines.some((line) => Boolean(line[displayTargetLocale]?.trim()))
        : false;
    const showTargetColumn = Boolean(displayTargetLocale && hasTargetTranslation);
    const translationCredits = lyrics
        ? getLyricsSelectedTranslationCredits(lyrics, activeRendition?.key, activeTranslationEditionKey, locale)
        : undefined;
    const attributions = getLyricsDisplayAttributions(
        activeRendition?.provenance
            ?? ((lyrics?.version === 1 || lyrics?.version === 2) ? (lyrics.attributions ?? []) : []),
    );
    const translationCredit = translationCredits?.translation?.trim();
    const proofreadingCredit = translationCredits?.proofreading?.trim();
    const sharedTranslationCredit = translationCredit && translationCredit === proofreadingCredit
        ? translationCredit
        : undefined;

    useEffect(() => {
        if (!lyrics) return;
        const query = new URLSearchParams(searchParamString);

        const canonicalizeSingleValue = (key: string, canonicalValue: string | null) => {
            const values = query.getAll(key);
            if (canonicalValue === null) {
                if (values.length > 0) query.delete(key);
                return;
            }
            if (values.length !== 1 || values[0] !== canonicalValue) {
                query.delete(key);
                query.set(key, canonicalValue);
            }
        };

        if (hasRenditionDimension && activeRendition) {
            if (requestedRenditionParamCount > 1
                || requestedRenditionParamCount === 1 && requestedRenditionKey !== activeRendition.key) {
                canonicalizeSingleValue("rendition", activeRendition.key);
            }
        } else {
            canonicalizeSingleValue("rendition", null);
        }

        const canonicalVersionParam = activeVersion === "game" && hasFullVersion ? "game" : null;
        canonicalizeSingleValue("version", canonicalVersionParam);

        const canonicalTranslationParam = lyrics.version === 4
            && activeTranslationEdition
            && activeTranslationEdition.key !== lyrics.defaultTranslationEditionKey
            ? activeTranslationEdition.key
            : null;
        canonicalizeSingleValue("translation", canonicalTranslationParam);

        if (query.toString() !== searchParamString) replaceCurrentUrlSearchParams(query);
    }, [
        activeRendition,
        activeTranslationEdition,
        activeVersion,
        hasFullVersion,
        hasRenditionDimension,
        lyrics,
        requestedRenditionKey,
        requestedRenditionParamCount,
        searchParamString,
    ]);

    useEffect(() => {
        if (music) setDetailName(music.title);
    }, [music, setDetailName]);

    const selectRendition = (renditionKey: string) => {
        const rendition = renditions.find((item) => item.key === renditionKey);
        if (!rendition) return;
        const query = new URLSearchParams(window.location.search);
        query.delete("rendition");
        query.set("rendition", renditionKey);
        query.delete("version");
        if (activeVersion === "game" && hasGameLyricsVersion(rendition) && hasFullLyricsVersion(rendition)) {
            query.set("version", "game");
        }
        replaceCurrentUrlSearchParams(query);
    };

    const selectVersion = (version: LyricsVersion) => {
        if (version === "full" && !hasFullVersion || version === "game" && !hasGameVersion) return;
        const query = new URLSearchParams(window.location.search);
        query.delete("version");
        if (version === "game" && hasFullVersion) query.set("version", "game");
        replaceCurrentUrlSearchParams(query);
    };

    const selectTranslationEdition = (editionKey: string) => {
        if (!lyrics || lyrics.version !== 4 || !translationEditions.some((edition) => edition.key === editionKey)) return;
        const query = new URLSearchParams(window.location.search);
        query.delete("translation");
        if (editionKey !== lyrics.defaultTranslationEditionKey) query.set("translation", editionKey);
        replaceCurrentUrlSearchParams(query);
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex min-h-[50vh] flex-col items-center justify-center" aria-label={t("page.lyrics.loading")}>
                        <div className="loading-spinner" />
                        <p className="mt-4 text-[var(--hh-text-secondary)]">{t("page.lyrics.loading")}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (!music || publication?.state === "satisfied_no_lyrics") {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div role="alert" className="mx-auto max-w-md text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15">
                            <svg className="h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-primary-text">
                            {errorKind === "failed" ? t("page.lyrics.error") : t("page.lyrics.notFound")}
                        </h1>
                        <Link href="/lyrics" className="hh-btn hh-btn-primary hh-press mt-5 inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] px-6 py-3 font-bold">
                            <span aria-hidden="true">←</span>
                            {t("page.lyrics.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    // Upstream failures and index-published-but-missing documents stay on the
    // error boundary; only a plain unpublished lookup renders the in-progress card.
    if (!lyrics && errorKind !== "not-found") {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div role="alert" className="mx-auto max-w-md text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15">
                            <svg className="h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h1 className="mb-2 text-2xl font-bold text-primary-text">
                            {errorKind === "failed" ? t("page.lyrics.error") : t("page.lyrics.notFound")}
                        </h1>
                        <Link href="/lyrics" className="hh-btn hh-btn-primary hh-press mt-5 inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] px-6 py-3 font-bold">
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
                        <span className="hh-numeric inline-flex w-fit items-center gap-1.5 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-3 py-1 font-mono text-xs text-[var(--hh-text-secondary)]">
                            ID: {music.id}
                        </span>
                        {Array.from(new Set(music.categories ?? [])).map((category) => (
                            <span
                                key={category}
                                className="rounded-[var(--hh-radius-xs)] px-2 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: MUSIC_CATEGORY_COLORS[category] }}
                            >
                                {t(`common.musicCategories.${category}`)}
                            </span>
                        ))}
                        <Link
                            href={`/music/${music.id}`}
                            className="hh-press inline-flex items-center gap-1 rounded-[var(--hh-radius-sm)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-2.5 py-0.5 text-xs font-bold text-[var(--hh-accent-deep)] hover:bg-[var(--hh-accent-wash-strong)]"
                        >
                            <span>{t("page.music.goToMusicDetail")}</span>
                            <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                    <h1 className="hh-display break-words text-2xl text-primary-text sm:text-3xl">{music.title}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--hh-text-secondary)]">
                        {music.composer && <span>{music.composer}</span>}
                        {music.lyricist && music.lyricist !== music.composer && <span>{music.lyricist}</span>}
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
                    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                        {/* Music Jacket Card */}
                        <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
                            <div className="relative aspect-square bg-[var(--hh-surface-sunken)]">
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
                            <div className="border-t border-[var(--hh-border)] p-5">
                                {lyrics ? (
                                    <dl className="space-y-3 text-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-[var(--hh-text-secondary)]">{t("page.lyrics.revision")}</dt>
                                            <dd className="hh-numeric font-mono font-bold text-primary-text">v{lyrics.revision}</dd>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-[var(--hh-text-secondary)]">{t("page.lyrics.updatedAt")}</dt>
                                            <dd className="text-right font-medium text-primary-text">
                                                {formatDate(lyrics.updatedAt, { year: "numeric", month: "short", day: "numeric" })}
                                            </dd>
                                        </div>
                                    </dl>
                                ) : (
                                    <dl className="space-y-3 text-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-[var(--hh-text-secondary)]">{t("page.lyrics.versionLabel")}</dt>
                                            <dd className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                                                {t("page.lyrics.inProgressBadge")}
                                            </dd>
                                        </div>
                                    </dl>
                                )}
                            </div>
                        </div>

                        {/* Vocal Versions Audio Player Card */}
                        {vocals.length > 0 && (
                            <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
                                <div className="border-b border-[var(--hh-border)] bg-[var(--hh-accent-wash)] px-5 py-4">
                                    <h2 className="flex items-center gap-2 font-bold text-primary-text">
                                        <svg className="h-5 w-5 text-[var(--hh-accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        {t("page.music.vocalVersions", { seconds: Math.round((music.fillerSec || 0) * 10) / 10 })}
                                    </h2>
                                </div>
                                <div className="divide-y divide-[var(--hh-border-hairline)] max-h-80 overflow-y-auto">
                                    {vocals.map((vocal) => (
                                        <VocalPlayer
                                            key={vocal.id}
                                            vocal={vocal}
                                            fillerSec={music.fillerSec}
                                            assetSource={assetSource}
                                            outsideCharacters={outsideCharacters}
                                            downloadLabel={t("page.music.downloadAudio")}
                                            getCharacterLabel={(characterId) => getCharacterName(t, characterId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attribution Card */}
                        {lyrics && (
                            <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
                                <div className="border-b border-[var(--hh-border)] bg-[var(--hh-accent-wash)] px-5 py-4">
                                    <h2 className="flex items-center gap-2 font-bold text-primary-text">
                                        <svg className="h-5 w-5 text-[var(--hh-accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t("page.lyrics.attribution")}
                                    </h2>
                                </div>
                                <div className="p-5">
                                    {lyrics.version === 1 ? (
                                        lyrics.attribution ? (
                                            <dl className="text-sm">
                                                <div className="space-y-1">
                                                    <dt className="font-bold text-primary-text">{t("page.lyrics.translation")}</dt>
                                                    <dd className="whitespace-pre-wrap break-words leading-relaxed text-[var(--hh-text-secondary)] [overflow-wrap:anywhere]">
                                                        {lyrics.attribution}
                                                    </dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <p className="text-sm text-[var(--hh-text-secondary)]">
                                                {t("page.lyrics.translationCreditsEmpty")}
                                            </p>
                                        )
                                    ) : translationCredits ? (
                                        <dl className="space-y-4 text-sm">
                                            {sharedTranslationCredit ? (
                                                <div className="space-y-1">
                                                    <dt className="font-bold text-primary-text">{t("page.lyrics.translationAndProofreading")}</dt>
                                                    <dd className="whitespace-pre-wrap break-words leading-relaxed text-[var(--hh-text-secondary)] [overflow-wrap:anywhere]">
                                                        {sharedTranslationCredit}
                                                    </dd>
                                                </div>
                                            ) : (
                                                <>
                                                    {translationCredit && (
                                                        <div className="space-y-1">
                                                            <dt className="font-bold text-primary-text">{t("page.lyrics.translation")}</dt>
                                                            <dd className="whitespace-pre-wrap break-words leading-relaxed text-[var(--hh-text-secondary)] [overflow-wrap:anywhere]">
                                                                {translationCredit}
                                                            </dd>
                                                        </div>
                                                    )}
                                                    {proofreadingCredit && (
                                                        <div className="space-y-1">
                                                            <dt className="font-bold text-primary-text">{t("page.lyrics.proofreading")}</dt>
                                                            <dd className="whitespace-pre-wrap break-words leading-relaxed text-[var(--hh-text-secondary)] [overflow-wrap:anywhere]">
                                                                {proofreadingCredit}
                                                            </dd>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </dl>
                                    ) : (
                                        <p className="text-sm text-[var(--hh-text-secondary)]">
                                            {t("page.lyrics.translationCreditsEmpty")}
                                        </p>
                                    )}
                                </div>
                                {attributions.length > 0 && (
                                    <>
                                        <div className="border-y border-[var(--hh-border)] bg-[var(--hh-surface-1)] px-5 py-3">
                                            <h3 className="hh-label">
                                                {t("page.lyrics.sourceLicenseTitle")}
                                            </h3>
                                        </div>
                                        <ul className="divide-y divide-[var(--hh-border-hairline)]">
                                            {attributions.map((attribution) => (
                                                <li key={`${attribution.provider}-${attribution.revisionUrl}-${"component" in attribution ? attribution.component : "legacy"}`} className="space-y-2 p-5 text-sm">
                                                    <div>
                                                        <p className="font-bold text-primary-text">{t(`page.lyrics.attributionProviders.${attribution.provider}`)}</p>
                                                        <p className="mt-0.5 break-words text-[var(--hh-text-secondary)] [overflow-wrap:anywhere]">{attribution.title}</p>
                                                    </div>
                                                    <dl className="space-y-1.5 text-xs text-[var(--hh-text-secondary)]">
                                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                            <dt>{t("page.lyrics.sourceRevision")}</dt>
                                                            <dd>
                                                                <ExternalLink href={attribution.revisionUrl} className="hh-numeric font-mono font-bold text-[var(--hh-accent-deep)] hover:underline">
                                                                    {attribution.revisionId}
                                                                </ExternalLink>
                                                            </dd>
                                                        </div>
                                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                            <dt>{t("page.lyrics.sourceLicense")}</dt>
                                                            <dd>
                                                                <ExternalLink href={attribution.licenseUrl} className="font-medium text-[var(--hh-accent-deep)] hover:underline">
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
                        )}
                    </aside>

                    <section className="min-w-0">
                        {!lyrics ? (
                            <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)] p-8 sm:p-12 text-center">
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--hh-accent-wash)] text-[var(--hh-accent-deep)]">
                                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-sm)] mb-3">
                                    <span className="text-[var(--hh-accent-deep)] text-xs font-bold tracking-wider">{t("page.lyrics.inProgressBadge")}</span>
                                </div>
                                <h2 className="hh-title text-2xl text-primary-text mb-3">{t("page.lyrics.draftTitle")}</h2>
                                <p className="hh-body max-w-md mx-auto text-[var(--hh-text-secondary)] text-sm mb-8">
                                    {t("page.lyrics.draftDescription")}
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-4">
                                    <Link
                                        href={`/music/${music.id}`}
                                        className="hh-btn hh-press inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] px-5 py-2.5 text-sm font-bold"
                                    >
                                        <span>{t("page.music.goToMusicDetail")}</span>
                                        <span aria-hidden="true">→</span>
                                    </Link>
                                    <Link
                                        href="/lyrics"
                                        className="hh-btn hh-btn-primary hh-press inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] px-5 py-2.5 text-sm font-bold"
                                    >
                                        <span aria-hidden="true">←</span>
                                        <span>{t("page.lyrics.backToList")}</span>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
                                <div className="flex flex-col gap-3 border-b border-[var(--hh-border)] bg-[var(--hh-accent-wash)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                                <h2 className="flex shrink-0 items-center gap-2 font-bold text-primary-text">
                                    <svg className="h-5 w-5 text-[var(--hh-accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    {t("page.lyrics.contentTitle")}
                                </h2>
                                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                                    {translationEditions.length > 1 && activeTranslationEdition && lyrics.version === 4 && (
                                        <TranslationEditionSelect
                                            options={translationEditions.map((edition) => ({
                                                key: edition.key,
                                                label: edition.label,
                                                isDefault: edition.key === lyrics.defaultTranslationEditionKey,
                                            }))}
                                            value={activeTranslationEdition.key}
                                            onChange={selectTranslationEdition}
                                            label={t("page.lyrics.translationEditionLabel")}
                                            currentLabel={t("page.lyrics.translationEditionCurrent", { label: activeTranslationEdition.label })}
                                            defaultLabel={t("page.lyrics.translationEditionDefault")}
                                            listLabel={t("page.lyrics.translationEditionListLabel")}
                                            className="w-full sm:w-64"
                                        />
                                    )}
                                    {renditions.length > 1 && (
                                        /* Hand-rolled segmented trough rather than .hh-segment:
                                           that class declares `width: 100%; flex: 1 1 auto` for the
                                           side rail, which would stretch this control inside the
                                           header's flex row and cannot wrap. The visual spec —
                                           sunken trough, hairline border, 8px shell / 5px items —
                                           is reproduced here so both read as the same object. */
                                        <div role="group" aria-label={t("page.lyrics.renditionLabel")} className="flex max-w-full flex-wrap gap-[2px] rounded-[var(--hh-radius-md)] border border-[var(--hh-border-hairline)] bg-[var(--hh-surface-sunken)] p-[3px]">
                                            {renditions.map((rendition) => (
                                                <button
                                                    key={rendition.key}
                                                    type="button"
                                                    aria-pressed={activeRendition?.key === rendition.key}
                                                    onClick={() => selectRendition(rendition.key)}
                                                    className={`rounded-[var(--hh-radius-sm)] px-3 py-1.5 text-xs font-bold transition-colors ${activeRendition?.key === rendition.key
                                                        ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]"
                                                        : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                                    }`}
                                                >
                                                    {rendition.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {hasFullVersion && hasGameVersion ? (
                                        <div role="group" aria-label={t("page.lyrics.versionLabel")} className="inline-flex w-fit gap-[2px] rounded-[var(--hh-radius-md)] border border-[var(--hh-border-hairline)] bg-[var(--hh-surface-sunken)] p-[3px]">
                                            <button
                                                type="button"
                                                aria-pressed={activeVersion === "full"}
                                                onClick={() => selectVersion("full")}
                                                className={`rounded-[var(--hh-radius-sm)] px-3 py-1.5 text-xs font-bold transition-colors ${activeVersion === "full"
                                                    ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]"
                                                    : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                                }`}
                                            >
                                                {t("page.lyrics.versionFull")}
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={activeVersion === "game"}
                                                onClick={() => selectVersion("game")}
                                                className={`rounded-[var(--hh-radius-sm)] px-3 py-1.5 text-xs font-bold transition-colors ${activeVersion === "game"
                                                    ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]"
                                                    : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                                }`}
                                            >
                                                {t("page.lyrics.versionGame")}
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center rounded-[var(--hh-radius-md)] bg-[var(--hh-accent-wash)] px-3 py-1.5 text-xs font-bold text-[var(--hh-accent-deep)]">
                                            {activeVersion === "game" ? t("page.lyrics.versionGame") : t("page.lyrics.versionFull")}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {displayLines.length === 0 ? (
                                <div className="p-10 text-center text-[var(--hh-text-secondary)]">
                                    {t("page.lyrics.emptyDocument")}
                                </div>
                            ) : (
                                <div>
                                    <div className={`hh-label hidden gap-6 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] px-5 py-3 md:grid ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                        <span>{t("page.lyrics.japanese")}</span>
                                        {showTargetColumn && (
                                            <span>{displayTargetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}</span>
                                        )}
                                    </div>
                                    {/* Lyric lines are a high-density list: hairline row rules, no
                                        per-row elevation. */}
                                    <div className="divide-y divide-[var(--hh-border-hairline)]">
                                        {displayLines.map((line) => {
                                            const translated = displayTargetLocale ? line[displayTargetLocale] : undefined;
                                            const targetText = translated || line.japanese;
                                            return (
                                                <article
                                                    key={line.id}
                                                    className={`${line.stanzaBreakBefore ? "border-t-8 border-t-[var(--hh-surface-sunken)]" : ""} grid grid-cols-1 gap-4 px-5 py-5 md:gap-6 ${showTargetColumn ? "md:grid-cols-2" : "md:grid-cols-1"}`}
                                                >
                                                    <div className="min-w-0">
                                                        <span className="hh-label mb-2 block md:hidden">
                                                            {t("page.lyrics.japanese")}
                                                        </span>
                                                        <LyricText
                                                            segments={getLyricsDisplaySegments(line)}
                                                            trailingPerformerIds={"trailingPerformerIds" in line ? line.trailingPerformerIds : undefined}
                                                            performers={activeRendition?.performers}
                                                        />
                                                    </div>
                                                    {showTargetColumn && (
                                                        <div className="min-w-0 border-t border-[var(--hh-border)] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                                                            <span className="hh-label mb-2 block md:hidden">
                                                                {displayTargetLocale === "zh-CN" ? t("page.lyrics.chinese") : t("page.lyrics.english")}
                                                            </span>
                                                            <LyricText text={targetText} performerIds={[]} />
                                                            {!translated && (
                                                                <span className="mt-2 inline-flex rounded-[var(--hh-radius-xs)] border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
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
                    )}
                </section>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/lyrics" className="hh-btn hh-press inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] px-6 py-3 font-bold">
                        <span aria-hidden="true">←</span>
                        {t("page.lyrics.backToList")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

