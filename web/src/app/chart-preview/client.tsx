"use client";

import React, { useState, useEffect, useMemo, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import dynamic from "next/dynamic";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getMusicScoreUrl, getMusicVocalAudioUrl, getMusicJacketUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import MusicSelector from "@/components/deck-recommend/MusicSelector";
import type { IMusicInfo, IMusicVocalInfo, IMusicDifficultyInfo, MusicDifficultyType } from "@/types/music";

const ChartPreviewPlayer = dynamic(
    () => import("@/components/chart-preview/ChartPreviewPlayer"),
    { ssr: false }
);

const DIFFICULTIES: { value: MusicDifficultyType; color: string }[] = [
    { value: "easy", color: "#34d399" },
    { value: "normal", color: "#38bdf8" },
    { value: "hard", color: "#fbbf24" },
    { value: "expert", color: "#f87171" },
    { value: "master", color: "#a855f7" },
    { value: "append", color: "#f472b6" },
];

function ChartPreviewInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
    const { t } = useI18n();
    const getDifficultyLabel = useCallback((difficulty: MusicDifficultyType) => {
        return t(`page.chartPreview.difficulties.${difficulty}`);
    }, [t]);
    const formatNoteCount = useCallback((count: number) => {
        return t("page.chartPreview.noteCount", { count: count.toLocaleString() });
    }, [t]);
    const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

    // URL params (custom URL mode - legacy)
    const urlSus = searchParams.get("sus");
    const urlBgm = searchParams.get("bgm");
    const urlOffset = searchParams.get("offset");

    // URL params (song selection mode)
    const urlMode = searchParams.get("mode");
    const urlMusicId = searchParams.get("musicId");
    const urlDifficulty = searchParams.get("difficulty");
    const urlPreview = searchParams.get("preview");
    const urlFrom = searchParams.get("from");
    const urlVocalId = searchParams.get("vocalId");

    // Vocals for BGM lookup
    const [vocals, setVocals] = useState<IMusicVocalInfo[]>([]);
    // Music data for song info display
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicDifficulties, setMusicDifficulties] = useState<IMusicDifficultyInfo[]>([]);

    // UI states
    const [selectedMusicId, setSelectedMusicId] = useState<string>(urlMusicId || "");
    const [selectedDifficulty, setSelectedDifficulty] = useState<MusicDifficultyType>(
        (urlDifficulty as MusicDifficultyType) || "master"
    );
    const [selectedVocalId, setSelectedVocalId] = useState<number | null>(
        urlVocalId ? Number(urlVocalId) : null
    );
    const [previewActive, setPreviewActive] = useState(urlPreview === "true");
    const [mode, setMode] = useState<"song" | "url">(urlSus ? "url" : (urlMode === "url" ? "url" : "song"));

    // Custom URL mode
    const [customSus, setCustomSus] = useState("");
    const [customBgm, setCustomBgm] = useState("");
    const [customOffset, setCustomOffset] = useState("");
    const [paramsInitialized, setParamsInitialized] = useState(false);

    useEffect(() => {
        if (!previewActive) {
             
            setIsPlayerFullscreen(false);
        }
    }, [previewActive]);

    // Load vocals, musics, and difficulties data
    useEffect(() => {
        if (urlSus) {
             
            setPreviewActive(true);
             
            setParamsInitialized(true);
            return;
        }
        Promise.all([
            fetchMasterData<IMusicVocalInfo[]>("musicVocals.json"),
            fetchMasterData<IMusicInfo[]>("musics.json"),
            fetchMasterData<IMusicDifficultyInfo[]>("musicDifficulties.json"),
        ])
            .then(([vocalsData, musicsData, diffsData]) => {
                setVocals(vocalsData);
                setMusics(musicsData);
                setMusicDifficulties(diffsData);
            })
            .catch(() => { })
            .finally(() => {
                // Auto-enter preview if URL has musicId + preview=true
                if (urlMusicId && urlPreview === "true") {
                    setPreviewActive(true);
                }
                setParamsInitialized(true);
            });
    }, [urlSus, urlMusicId, urlPreview]);

    // Sync state to URL (skip for legacy sus mode)
    useEffect(() => {
        if (!paramsInitialized || urlSus) return;

        const params = new URLSearchParams();
        if (mode !== "song") params.set("mode", mode);
        if (selectedMusicId) params.set("musicId", selectedMusicId);
        if (selectedDifficulty !== "master") params.set("difficulty", selectedDifficulty);
        if (previewActive) params.set("preview", "true");
        if (urlFrom) params.set("from", urlFrom);
        if (selectedVocalId !== null) params.set("vocalId", String(selectedVocalId));
        replaceCurrentUrlSearchParams(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, selectedMusicId, selectedDifficulty, selectedVocalId, previewActive, paramsInitialized, urlSus, router]);

    // Get first vocal for BGM
    const musicIdNum = selectedMusicId ? Number(selectedMusicId) : null;

    // Available difficulties for the selected song
    const availableDifficulties = useMemo(() => {
        if (!musicIdNum) return [];
        const DIFF_ORDER: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];
        return musicDifficulties
            .filter((d) => d.musicId === musicIdNum)
            .sort((a, b) => DIFF_ORDER.indexOf(a.musicDifficulty) - DIFF_ORDER.indexOf(b.musicDifficulty));
    }, [musicDifficulties, musicIdNum]);

    // Available vocals for the selected song
    const availableVocals = useMemo(() => {
        if (!musicIdNum) return [];
        return vocals.filter((v) => v.musicId === musicIdNum);
    }, [vocals, musicIdNum]);

    // Auto-correct difficulty & vocal when song changes
    useEffect(() => {
        if (availableDifficulties.length > 0) {
            const hasCurrent = availableDifficulties.some((d) => d.musicDifficulty === selectedDifficulty);
            if (!hasCurrent) {
                const master = availableDifficulties.find((d) => d.musicDifficulty === "master");
                 
                setSelectedDifficulty(master ? "master" : availableDifficulties[availableDifficulties.length - 1].musicDifficulty);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableDifficulties]);

    // Reset vocal selection when song changes
    useEffect(() => {
         
        setSelectedVocalId(null);
    }, [musicIdNum]);

    const selectedVocal = useMemo(() => {
        if (!musicIdNum) return null;
        if (selectedVocalId !== null) {
            const match = availableVocals.find((v) => v.id === selectedVocalId);
            if (match) return match;
        }
        return availableVocals[0] ?? null;
    }, [availableVocals, musicIdNum, selectedVocalId]);

    // Compute URLs for song mode
    const songSusUrl = useMemo(() => {
        if (!musicIdNum) return null;
        return getMusicScoreUrl(musicIdNum, selectedDifficulty, assetSource);
    }, [musicIdNum, selectedDifficulty, assetSource]);

    const songBgmUrl = useMemo(() => {
        if (!selectedVocal) return null;
        return getMusicVocalAudioUrl(selectedVocal.assetbundleName, assetSource);
    }, [selectedVocal, assetSource]);

    // Selected music info for header display
    const selectedMusic = useMemo(() => {
        if (!musicIdNum) return null;
        return musics.find((m) => m.id === musicIdNum) ?? null;
    }, [musics, musicIdNum]);

    const selectedDiffInfo = useMemo(() => {
        if (!musicIdNum) return null;
        return musicDifficulties.find(
            (d) => d.musicId === musicIdNum && d.musicDifficulty === selectedDifficulty
        ) ?? null;
    }, [musicDifficulties, musicIdNum, selectedDifficulty]);

    // Determine active SUS/BGM URLs
    let activeSusUrl: string | null = null;
    let activeBgmUrl: string | undefined = undefined;
    let activeOffset: number | null = null;
    let activeCoverUrl: string | null = null;
    let activeTitle: string | null = null;
    let activeDifficulty: string | null = null;
    let activeComposer: string | null = null;
    let activeLyricist: string | null = null;
    let activeArranger: string | null = null;
    let activeVocal: string | null = null;

    if (urlSus) {
        activeSusUrl = urlSus;
        activeBgmUrl = urlBgm ?? undefined;
        activeOffset = urlOffset ? Number.parseFloat(urlOffset) : null;
        activeCoverUrl = searchParams.get("cover");
        activeTitle = searchParams.get("title");
        activeDifficulty = searchParams.get("difficulty");
        activeComposer = searchParams.get("composer");
        activeLyricist = searchParams.get("lyricist");
        activeArranger = searchParams.get("arranger");
        activeVocal = searchParams.get("vocal");
    } else if (mode === "url" && previewActive) {
        activeSusUrl = customSus || null;
        activeBgmUrl = customBgm || undefined;
        activeOffset = customOffset ? Number.parseFloat(customOffset) : null;
    } else if (mode === "song" && previewActive) {
        activeSusUrl = songSusUrl;
        activeBgmUrl = songBgmUrl ?? undefined;
        if (selectedMusic) {
            activeCoverUrl = getMusicJacketUrl(selectedMusic.assetbundleName, assetSource);
            activeTitle = selectedMusic.title;
            activeDifficulty = selectedDifficulty.toUpperCase();
            activeComposer = selectedMusic.composer ?? null;
            activeLyricist = selectedMusic.lyricist ?? null;
            activeArranger = selectedMusic.arranger ?? null;
        }
    }

    const handleStartPreview = () => {
        if (mode === "song" && !selectedMusicId) return;
        if (mode === "url" && !customSus) return;
        setPreviewActive(true);
    };

    const handleBack = () => {
        setPreviewActive(false);
    };

    const renderHeader = (showDescription = false) => (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                <span className="hh-label text-miku">{t("page.chartPreview.badge")}</span>
            </div>
            <h1 className="hh-display text-3xl sm:text-4xl text-primary-text">
                {t("page.chartPreview.title")} <span className="text-miku">{t("page.chartPreview.titleHighlight")}</span>
            </h1>
            {showDescription && (
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                    {t("page.chartPreview.description")}
                </p>
            )}
        </div>
    );

    // URL mode: auto-start (legacy sus param)
    if (urlSus && previewActive) {
        return (
            <MainLayout immersiveMode={isPlayerFullscreen}>
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    {renderHeader()}
                    <ChartPreviewPlayer
                        susUrl={activeSusUrl!}
                        bgmUrl={activeBgmUrl}
                        rawOffsetMs={activeOffset}
                        fillerSec={selectedMusic?.fillerSec}
                        onFullscreenChange={setIsPlayerFullscreen}
                        coverUrl={activeCoverUrl}
                        title={activeTitle}
                        difficulty={activeDifficulty}
                        composer={activeComposer}
                        lyricist={activeLyricist}
                        arranger={activeArranger}
                        vocal={activeVocal}
                    />
                </div>
            </MainLayout>
        );
    }

    // Preview active (song or custom URL mode)
    if (previewActive && activeSusUrl) {
        const diffInfo = DIFFICULTIES.find((d) => d.value === selectedDifficulty);
        return (
            <MainLayout immersiveMode={isPlayerFullscreen}>
                <div className="container mx-auto px-4 sm:px-6 py-8">
                    <div className="flex items-center gap-2 mb-4">
                        {urlFrom ? (
                            <>
                                <button
                                    onClick={() => router.back()}
                                    className="hh-press hh-focusable shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--hh-accent)] text-miku rounded-[var(--hh-radius-md)] font-bold hover:bg-[var(--hh-accent)] hover:text-[var(--hh-text-on-accent)] text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    {t("page.chartPreview.backPrevious")}
                                </button>
                                <button
                                    onClick={handleBack}
                                    className="hh-press hh-focusable shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--hh-border)] text-[var(--hh-text-secondary)] rounded-[var(--hh-radius-md)] font-bold hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)] text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
                                    </svg>
                                    {t("page.chartPreview.previewHome")}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleBack}
                                className="hh-press hh-focusable shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--hh-accent)] text-miku rounded-[var(--hh-radius-md)] font-bold hover:bg-[var(--hh-accent)] hover:text-[var(--hh-text-on-accent)] text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {t("page.chartPreview.back")}
                            </button>
                        )}
                        {selectedMusic ? (
                            <>
                                <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-[var(--hh-radius-md)] overflow-hidden relative bg-[var(--hh-surface-sunken)]">
                                    <Image
                                        src={getMusicJacketUrl(selectedMusic.assetbundleName, assetSource)}
                                        alt={selectedMusic.title}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h1 className="hh-title text-base sm:text-xl text-primary-text truncate">
                                        {selectedMusic.title}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {diffInfo && (
                                            <span
                                                className="shrink-0 px-2 py-0.5 rounded-[var(--hh-radius-sm)] text-[10px] font-bold text-white"
                                                style={{ backgroundColor: diffInfo.color }}
                                            >
                                                {getDifficultyLabel(diffInfo.value)}
                                            </span>
                                        )}
                                        {selectedDiffInfo && (
                                            <span className="hh-numeric text-xs text-[var(--hh-text-secondary)] truncate">
                                                {t("page.chartPreview.levelLabel", { level: selectedDiffInfo.playLevel })} · {formatNoteCount(selectedDiffInfo.totalNoteCount)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <h1 className="hh-title text-xl sm:text-2xl text-primary-text truncate min-w-0 flex-1">
                                {selectedMusicId ? t("page.chartPreview.previewTitleWithId", { id: selectedMusicId }) : t("page.chartPreview.metadataTitle")}
                            </h1>
                        )}
                    </div>
                    {/* Vocal switcher in preview mode */}
                    {availableVocals.length > 1 && (
                        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                            <span className="hh-label shrink-0">{t("page.chartPreview.vocalVersion")}</span>
                            {availableVocals.map((v) => {
                                const isActive = selectedVocal?.id === v.id;
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVocalId(v.id)}
                                        className={`hh-press hh-focusable shrink-0 px-2.5 py-1 rounded-[var(--hh-radius-sm)] text-xs font-medium ${isActive
                                                ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                                : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)]"
                                            }`}
                                    >
                                        {v.caption}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <ChartPreviewPlayer
                        key={`${activeSusUrl}-${activeBgmUrl}`}
                        susUrl={activeSusUrl}
                        bgmUrl={activeBgmUrl}
                        rawOffsetMs={activeOffset}
                        fillerSec={selectedMusic?.fillerSec}
                        onFullscreenChange={setIsPlayerFullscreen}
                        coverUrl={activeCoverUrl}
                        title={activeTitle}
                        difficulty={activeDifficulty}
                        composer={activeComposer}
                        lyricist={activeLyricist}
                        arranger={activeArranger}
                        vocal={activeVocal}
                    />
                </div>
            </MainLayout>
        );
    }

    // Selection UI
    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Page Header */}
                {renderHeader(true)}

                {/* Mode Tabs */}
                <div className="flex gap-2 mb-6 justify-center">
                    <button
                        onClick={() => setMode("song")}
                        className={`hh-press hh-focusable flex items-center gap-2 px-5 py-2.5 rounded-[var(--hh-radius-md)] font-medium text-sm whitespace-nowrap border ${mode === "song"
                                ? "border-[var(--hh-accent-deep)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        {t("page.chartPreview.selectSong")}
                    </button>
                    <button
                        onClick={() => setMode("url")}
                        className={`hh-press hh-focusable flex items-center gap-2 px-5 py-2.5 rounded-[var(--hh-radius-md)] font-medium text-sm whitespace-nowrap border ${mode === "url"
                                ? "border-[var(--hh-accent-deep)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {t("page.chartPreview.customUrl")}
                    </button>
                </div>

                {mode === "song" ? (
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Music Selector (reused from deck-recommend) */}
                        <MusicSelector
                            selectedMusicId={selectedMusicId}
                            onSelect={setSelectedMusicId}
                            showRecommendations={false}
                        />

                        {/* Difficulty Selector */}
                        <div>
                            <label className="hh-label block mb-2 text-center">
                                {t("page.chartPreview.difficulty")}
                            </label>
                            {availableDifficulties.length > 0 ? (
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {availableDifficulties.map((diff) => {
                                        const meta = DIFFICULTIES.find((d) => d.value === diff.musicDifficulty);
                                        if (!meta) return null;
                                        return (
                                            <button
                                                key={diff.musicDifficulty}
                                                onClick={() => setSelectedDifficulty(diff.musicDifficulty)}
                                                className={`hh-press hh-focusable flex flex-col items-center px-4 py-2 rounded-[var(--hh-radius-md)] ${selectedDifficulty === diff.musicDifficulty
                                                        ? "bg-[var(--hh-surface-2)]"
                                                        : "border border-transparent hover:bg-[var(--hh-surface-sunken)]"
                                                    }`}
                                                style={
                                                    selectedDifficulty === diff.musicDifficulty
                                                        ? { borderColor: meta.color, boxShadow: `0 0 0 2px ${meta.color}` }
                                                        : {}
                                                }
                                            >
                                                <span
                                                    className="text-[10px] font-bold uppercase"
                                                    style={{ color: meta.color }}
                                                >
                                                    {getDifficultyLabel(meta.value)}
                                                </span>
                                                <span
                                                    className="hh-numeric text-lg font-bold"
                                                    style={{ color: meta.color }}
                                                >
                                                    {diff.playLevel}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {DIFFICULTIES.map((d) => (
                                        <button
                                            key={d.value}
                                            onClick={() => setSelectedDifficulty(d.value)}
                                            className={`hh-press hh-focusable flex flex-col items-center px-4 py-2 rounded-[var(--hh-radius-md)] ${selectedDifficulty === d.value
                                                    ? "bg-[var(--hh-surface-2)]"
                                                    : "border border-transparent hover:bg-[var(--hh-surface-sunken)]"
                                                }`}
                                            style={
                                                selectedDifficulty === d.value
                                                    ? { borderColor: d.color, boxShadow: `0 0 0 2px ${d.color}` }
                                                    : {}
                                            }
                                        >
                                            <span
                                                className="text-xs font-bold uppercase"
                                                style={{ color: d.color }}
                                            >
                                                {getDifficultyLabel(d.value)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vocal Selector */}
                        {availableVocals.length > 1 && (
                            <div>
                                <label className="hh-label block mb-2 text-center">
                                    {t("page.chartPreview.vocalVersion")}
                                </label>
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {availableVocals.map((v) => {
                                        const isSelected = selectedVocal?.id === v.id;
                                        return (
                                            <button
                                                key={v.id}
                                                onClick={() => setSelectedVocalId(v.id)}
                                                className={`hh-press hh-focusable px-3 py-1.5 rounded-[var(--hh-radius-sm)] text-xs font-medium ${isSelected
                                                        ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                                        : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)]"
                                                    }`}
                                            >
                                                {v.caption}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Start Button */}
                        <button
                            onClick={handleStartPreview}
                            disabled={!selectedMusicId}
                            className="hh-press hh-focusable w-full py-3 border border-[var(--hh-accent-deep)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-md)] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t("page.chartPreview.startPreview")}
                            {selectedMusicId && (
                                <span className="hh-numeric ml-2 text-sm opacity-80">
                                    {t("page.chartPreview.startPreviewSuffix", { id: selectedMusicId, difficulty: getDifficultyLabel(selectedDifficulty) })}
                                </span>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="max-w-2xl mx-auto">
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    {t("page.chartPreview.customChartUrl")}
                                </h2>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">SUS URL *</label>
                                    <input
                                        type="text"
                                        placeholder="https://..."
                                        value={customSus}
                                        onChange={(e) => setCustomSus(e.target.value)}
                                        className="hh-input w-full px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.chartPreview.bgmUrlOptional")}</label>
                                    <input
                                        type="text"
                                        placeholder="https://..."
                                        value={customBgm}
                                        onChange={(e) => setCustomBgm(e.target.value)}
                                        className="hh-input w-full px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.chartPreview.offsetOptional")}</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={customOffset}
                                        onChange={(e) => setCustomOffset(e.target.value)}
                                        className="hh-input w-full px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={handleStartPreview}
                                    disabled={!customSus}
                                    className="hh-press hh-focusable w-full py-3 border border-[var(--hh-accent-deep)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-md)] font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t("page.chartPreview.startPreview")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function ChartPreviewFallback() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku">{t("page.chartPreview.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl text-primary-text">
                        {t("page.chartPreview.title")} <span className="text-miku">{t("page.chartPreview.titleHighlight")}</span>
                    </h1>
                </div>
                <div className="text-sm text-[var(--hh-text-tertiary)] py-8 text-center">{t("page.chartPreview.loading")}</div>
            </div>
        </MainLayout>
    );
}

export default function ChartPreviewContent() {
    return (
        <Suspense fallback={<ChartPreviewFallback />}>
            <ChartPreviewInner />
        </Suspense>
    );
}
