"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchBgmDurationsData, fetchMasterData } from "@/lib/fetch";
import { getMysekaiRawAssetUrl } from "@/lib/assets";
import { getMysekaiSoundTrackAudioUrl } from "@/lib/mysekai-preview/assets";

// Interface definitions based on masterdata schemas
interface MysekaiMusicSoundTrackCategory {
    id: number;
    name: string;
    assetbundleName: string;
}

interface MysekaiMusicSoundTrackMaster {
    id: number;
    seq: number;
    title: string;
    pronunciation: string;
    musicSoundTrackCategoryId: number;
    assetbundleName: string;
    assetbundleFileName: string;
    isSpoiler?: boolean;
    durationSeconds?: number;
    durationMilliseconds?: number;
    durationSourceKey?: string;
}

interface BgmDurationTrack {
    key: string;
    route: string;
    file_name: string;
    duration_seconds: number;
    duration_milliseconds?: number;
}

interface BgmDurationsResponse {
    generated_at?: string;
    tracks: BgmDurationTrack[];
}

type PlaybackMode = "sequential" | "loop-one" | "shuffle";
type SoundtrackCategoryFilter = number | "spoiler" | null;
type SoundtrackMediaSessionAction = "play" | "pause" | "stop" | "previoustrack" | "nexttrack" | "seekbackward" | "seekforward" | "seekto";

const PLAYBACK_MODES = ["sequential", "loop-one", "shuffle"] as const satisfies readonly PlaybackMode[];

function isPlaybackMode(value: string | null): value is PlaybackMode {
    return PLAYBACK_MODES.includes(value as PlaybackMode);
}

function clampVolume(value: number) {
    if (!Number.isFinite(value)) return 0.5;
    return Math.min(1, Math.max(0, value));
}

const SOUNDTRACK_AUDIO_CACHE_NAME = "soundtrack-audio-v1";
const SPOILER_TRACK_ID_BASE = -1_000_000;
const SPOILER_TRACK_SEQ_BASE = 10_000;
const SPOILER_DURATION_THRESHOLD_SECONDS = 40;
const MYSEKAI_SOUNDTRACK_CATEGORY_ID = 12;
const SCENARIO_SOUNDTRACK_CATEGORY_ID = 13;
const SPOILER_CATEGORY_FILTER = "spoiler" as const;
const SPOILER_CATEGORY_THEME = { from: "#F97316", to: "#C2410C" };
const SOUNDTRACK_INITIAL_LIST_LIMIT = 80;
const SOUNDTRACK_LIST_BATCH_SIZE = 80;
const SOUNDTRACK_LIST_SCROLL_THRESHOLD_PX = 280;
const SOUNDTRACK_PROGRESS_UPDATE_INTERVAL_MS = 500;
const SOUNDTRACK_MEDIA_SEEK_OFFSET_SECONDS = 10;
const SOUNDTRACK_MEDIA_ARTWORK_SIZES = ["96x96", "128x128", "192x192", "256x256", "384x384", "512x512"] as const;

function sanitizeDownloadFileName(value: string) {
    return value
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim() || "soundtrack";
}

function getTrackDownloadFileName(track: MysekaiMusicSoundTrackMaster) {
    const seq = track.seq.toString().padStart(3, "0");
    return `${seq}_${sanitizeDownloadFileName(track.title || track.assetbundleFileName)}.mp3`;
}

function normalizeAssetPath(value: string) {
    return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeAudioKey(value: string) {
    return normalizeAssetPath(value).replace(/\?.*$/, "");
}

function getTrackAudioKey(track: MysekaiMusicSoundTrackMaster) {
    const assetbundleName = normalizeAssetPath(track.assetbundleName);
    const fileName = String(track.assetbundleFileName || assetbundleName.split("/").pop() || "").trim();
    return fileName ? `${assetbundleName}/${fileName}.mp3` : "";
}

function getSpoilerTrackId(key: string) {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return SPOILER_TRACK_ID_BASE - (hash % 900_000);
}

function stripAudioExtension(fileName: string) {
    return fileName.replace(/\.(mp3|wav|ogg)$/i, "");
}

function humanizeSpoilerTrackName(fileName: string) {
    return stripAudioExtension(fileName)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildSpoilerTrackFromDuration(entry: BgmDurationTrack, index: number): MysekaiMusicSoundTrackMaster | null {
    const key = normalizeAudioKey(entry.key);
    if (!key || !key.toLowerCase().endsWith(".mp3")) return null;

    const extensionlessKey = key.replace(/\.mp3$/i, "");
    const slashIndex = extensionlessKey.lastIndexOf("/");
    if (slashIndex <= 0) return null;

    const assetbundleName = extensionlessKey.slice(0, slashIndex);
    const assetbundleFileName = extensionlessKey.slice(slashIndex + 1);
    const displayName = humanizeSpoilerTrackName(entry.file_name || assetbundleFileName) || assetbundleFileName;
    const categoryId = assetbundleName.startsWith("mysekai/sound/bgm/")
        ? MYSEKAI_SOUNDTRACK_CATEGORY_ID
        : SCENARIO_SOUNDTRACK_CATEGORY_ID;

    return {
        id: getSpoilerTrackId(key),
        seq: SPOILER_TRACK_SEQ_BASE + index,
        title: displayName,
        pronunciation: assetbundleFileName,
        musicSoundTrackCategoryId: categoryId,
        assetbundleName,
        assetbundleFileName,
        isSpoiler: true,
        durationSeconds: entry.duration_seconds,
        durationMilliseconds: entry.duration_milliseconds,
        durationSourceKey: key,
    };
}

function buildSpoilerTracksFromDurations(
    durationData: BgmDurationsResponse | null,
    masterTracks: MysekaiMusicSoundTrackMaster[]
) {
    if (!durationData?.tracks?.length) return [];

    const masterAudioKeys = new Set(masterTracks.map(getTrackAudioKey).filter(Boolean));
    return durationData.tracks
        .filter((entry) => {
            const key = normalizeAudioKey(entry.key);
            return entry.duration_seconds > SPOILER_DURATION_THRESHOLD_SECONDS && !masterAudioKeys.has(key);
        })
        .map((entry, index) => buildSpoilerTrackFromDuration(entry, index))
        .filter((track): track is MysekaiMusicSoundTrackMaster => track !== null);
}

function getDisplayTrackTitle(track: MysekaiMusicSoundTrackMaster | null, t: (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string) {
    if (!track) return t("page.soundtrack.emptyTrack");
    if (!track.isSpoiler) return track.title;
    return t("page.soundtrack.spoiler.unlistedTitle", { name: track.title });
}

function getTrackSearchText(track: MysekaiMusicSoundTrackMaster) {
    return [
        track.title,
        track.pronunciation,
        track.assetbundleName,
        track.assetbundleFileName,
        track.durationSourceKey,
    ].filter(Boolean).join(" ").toLowerCase();
}

function triggerDirectDownload(url: string, fileName: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function triggerBlobDownload(blob: Blob, fileName: string) {
    const objectUrl = URL.createObjectURL(blob);
    triggerDirectDownload(objectUrl, fileName);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

async function readAudioBlobFromCache(url: string): Promise<Blob | null> {
    if (!("caches" in window)) return null;

    try {
        const response = await window.caches.match(url);
        if (!response) return null;

        const blob = await response.blob();
        return blob.size > 0 ? blob : null;
    } catch (err) {
        console.warn("Failed to read soundtrack audio cache:", err);
        return null;
    }
}

async function storeAudioBlobInCache(url: string, blob: Blob) {
    if (!("caches" in window) || blob.size === 0) return;

    try {
        const cache = await window.caches.open(SOUNDTRACK_AUDIO_CACHE_NAME);
        await cache.put(url, new Response(blob, {
            headers: { "Content-Type": blob.type || "audio/mpeg" },
        }));
    } catch (err) {
        console.warn("Failed to store soundtrack audio cache:", err);
    }
}

interface SoundtrackMediaSessionActionDetails {
    seekOffset?: number;
    seekTime?: number;
    fastSeek?: boolean;
}

type SoundtrackMediaSessionActionHandler = (details?: SoundtrackMediaSessionActionDetails) => void;

interface SoundtrackMediaSessionPositionState {
    duration: number;
    playbackRate?: number;
    position: number;
}

interface SoundtrackMediaSessionArtwork {
    src: string;
    sizes?: string;
    type?: string;
}

interface SoundtrackMediaMetadataInit {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: SoundtrackMediaSessionArtwork[];
}

interface SoundtrackMediaSessionLike {
    metadata: unknown | null;
    playbackState: "none" | "paused" | "playing";
    setActionHandler?: (action: SoundtrackMediaSessionAction, handler: SoundtrackMediaSessionActionHandler | null) => void;
    setPositionState?: (state?: SoundtrackMediaSessionPositionState) => void;
}

interface SoundtrackMediaMetadataConstructor {
    new(init?: SoundtrackMediaMetadataInit): unknown;
}

function getSoundtrackMediaSession() {
    if (typeof navigator === "undefined") return null;
    return (navigator as Navigator & { mediaSession?: SoundtrackMediaSessionLike }).mediaSession ?? null;
}

function createSoundtrackMediaMetadata(init: SoundtrackMediaMetadataInit) {
    if (typeof window === "undefined") return null;
    const MediaMetadataConstructor = (window as Window & { MediaMetadata?: SoundtrackMediaMetadataConstructor }).MediaMetadata;
    if (!MediaMetadataConstructor) return null;

    try {
        return new MediaMetadataConstructor(init);
    } catch (err) {
        console.warn("Failed to create soundtrack media metadata:", err);
        return null;
    }
}

function setSoundtrackMediaSessionActionHandler(
    mediaSession: SoundtrackMediaSessionLike,
    action: SoundtrackMediaSessionAction,
    handler: SoundtrackMediaSessionActionHandler | null,
) {
    if (!mediaSession.setActionHandler) return;

    try {
        mediaSession.setActionHandler(action, handler);
    } catch {
        // Some platforms intentionally expose only a subset of Media Session actions.
    }
}

function setSoundtrackMediaSessionMetadata(mediaSession: SoundtrackMediaSessionLike, metadata: unknown | null) {
    try {
        mediaSession.metadata = metadata;
    } catch (err) {
        console.warn("Failed to update soundtrack media metadata:", err);
    }
}

function setSoundtrackMediaSessionPlaybackState(
    mediaSession: SoundtrackMediaSessionLike,
    playbackState: SoundtrackMediaSessionLike["playbackState"],
) {
    try {
        mediaSession.playbackState = playbackState;
    } catch (err) {
        console.warn("Failed to update soundtrack media playback state:", err);
    }
}

// Per-category identity colors. Only the two ramp stops survive the flat
// redesign: `from` tints controls and progress on dark surfaces, `to` is the
// deeper stop used for text on light ones. The old glow/shadow/text-class
// fields went away with the ambient gradients they fed.
const CATEGORY_THEMES: Record<number, { from: string; to: string }> = {
    1: { from: "#00E5CF", to: "#007D85" }, // Unit overview
    2: { from: "#FF45A4", to: "#7D1BFF" }, // Virtual Singer
    3: { from: "#33A2FF", to: "#102E7A" }, // Leo/need
    4: { from: "#52FF45", to: "#EBE81B" }, // MORE MORE JUMP!
    5: { from: "#FF6E1A", to: "#A60E0E" }, // Vivid BAD SQUAD
    6: { from: "#FFDF00", to: "#FF5E00" }, // Wonderlands x Showtime
    7: { from: "#C655FF", to: "#1F0F3D" }, // Nightcord
    11: { from: "#00E5CF", to: "#007D85" }, // In-game
    12: { from: "#00CCBB", to: "#006655" }, // Mysekai
    13: { from: "#94A3B8", to: "#334155" }, // Scenario
    14: { from: "#38BDF8", to: "#0369A1" }, // Live
    15: { from: "#F43F5E", to: "#9F1239" }, // Virtual Live
    16: { from: "#F59E0B", to: "#B45309" }, // Gacha
    20: { from: "#64748B", to: "#1E293B" }, // Other
    30: { from: "#EC4899", to: "#BE185D" }, // Collaboration
};

const DEFAULT_THEME = { from: "#00CCBB", to: "#1E293B" };

// Readable text color for a category. On light surfaces the bright end of a
// ramp is unusable as text, so the deep stop is used — with two hand-picked
// overrides for the categories whose deep stop is still a highlighter color.
function getCategoryTextColor(categoryId: number | undefined, isDark: boolean) {
    const theme = (categoryId !== undefined ? CATEGORY_THEMES[categoryId] : undefined) ?? DEFAULT_THEME;
    if (isDark) return theme.from;
    if (categoryId === 4) return "#15803d"; // Deep emerald green
    if (categoryId === 6) return "#c2410c"; // Deep sunset orange
    return theme.to;
}

function SoundtrackContent() {
    const { t, formatNumber } = useI18n();
    const { assetSource, resolvedColorScheme, isShowSpoiler, backgroundAnimationBudget } = useTheme();
    const isDark = resolvedColorScheme === "dark";
    const isPerformanceVisuals = backgroundAnimationBudget === "on";
    const shouldAnimateIdleUi = isPerformanceVisuals;
    const searchParams = useSearchParams();

    // Data states
    const [tracks, setTracks] = useState<MysekaiMusicSoundTrackMaster[]>([]);
    const [categories, setCategories] = useState<MysekaiMusicSoundTrackCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Audio Ref
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playRequestIdRef = useRef(0);
    const lastProgressUpdateRef = useRef(0);
    const currentTimeRef = useRef(0);
    const playNextRef = useRef<() => void>(() => {});

    // Audio states
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasActivatedAudio, setHasActivatedAudio] = useState(false);
    const [playbackRestartNonce, setPlaybackRestartNonce] = useState(0);
    const [currentTrack, setCurrentTrack] = useState<MysekaiMusicSoundTrackMaster | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("sequential");
    const [showVolumePopup, setShowVolumePopup] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadHint, setDownloadHint] = useState<string | null>(null);
    const [shareHint, setShareHint] = useState<string | null>(null);
    const [durationWarning, setDurationWarning] = useState<string | null>(null);

    // Filter & Search states
    const [selectedCategoryId, setSelectedCategoryId] = useState<SoundtrackCategoryFilter>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"seq" | "title">("seq");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [visibleTrackLimit, setVisibleTrackLimit] = useState(SOUNDTRACK_INITIAL_LIST_LIMIT);

    const setVolumeAndPersist = useCallback((nextVolume: number) => {
        const clampedVolume = clampVolume(nextVolume);
        setVolume(clampedVolume);
        localStorage.setItem("soundtrack-volume", clampedVolume.toString());
    }, []);

    // Load initial volume from localStorage (Client only)
    useEffect(() => {
        const savedVolume = localStorage.getItem("soundtrack-volume");
        if (savedVolume !== null) {
            setVolume(clampVolume(parseFloat(savedVolume)));
        }
        const savedMode = localStorage.getItem("soundtrack-playback-mode");
        if (isPlaybackMode(savedMode)) {
            setPlaybackMode(savedMode);
        }
    }, []);

    // Close volume popup when clicking anywhere outside
    useEffect(() => {
        if (!showVolumePopup) return;
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(".volume-container")) {
                setShowVolumePopup(false);
            }
        };
        document.addEventListener("click", handleOutsideClick);
        return () => document.removeEventListener("click", handleOutsideClick);
    }, [showVolumePopup]);



    // Fetch masterdata
    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            try {
                setIsLoading(true);
                setDurationWarning(null);
                const [tracksData, categoriesData, durationData] = await Promise.all([
                    fetchMasterData<MysekaiMusicSoundTrackMaster[]>("musicSoundTracks.json"),
                    fetchMasterData<MysekaiMusicSoundTrackCategory[]>("musicSoundTrackCategories.json"),
                    fetchBgmDurationsData<BgmDurationsResponse>().catch((err) => {
                        console.warn("Failed to load BGM duration data:", err);
                        return null;
                    }),
                ]);

                if (cancelled) return;

                if (!durationData) {
                    setDurationWarning(t("page.soundtrack.spoiler.durationLoadFailed"));
                }

                // Sort categories and tracks initially
                const sortedCategories = [...categoriesData].sort((a, b) => a.id - b.id);
                setCategories(sortedCategories);

                const spoilerTracks = buildSpoilerTracksFromDurations(durationData, tracksData);
                const sortedTracks = [...tracksData, ...spoilerTracks].sort((a, b) => a.seq - b.seq);
                setTracks(sortedTracks);

                const nextSearchQuery = searchParams.get("search") ?? "";
                const nextSortBy = searchParams.get("sort") === "title" ? "title" : "seq";
                const nextSortOrder = searchParams.get("order") === "desc" ? "desc" : "asc";
                const visibleTracks = isShowSpoiler ? sortedTracks : sortedTracks.filter(track => !track.isSpoiler);

                // Set default track on first load, restoring from URL first and sessionStorage second.
                // Restore filters from searchParams
                const urlCat = searchParams.get("category");
                const nextCategoryId = (() => {
                    if (!urlCat) return null;
                    if (urlCat === SPOILER_CATEGORY_FILTER) return isShowSpoiler ? SPOILER_CATEGORY_FILTER : null;
                    const parsedCat = parseInt(urlCat, 10);
                    return !Number.isNaN(parsedCat) && sortedCategories.some(c => c.id === parsedCat)
                        ? parsedCat
                        : null;
                })();
                setSelectedCategoryId(nextCategoryId);

                const restoreCandidates = visibleTracks.filter((track) => {
                    if (nextCategoryId === SPOILER_CATEGORY_FILTER && !track.isSpoiler) return false;
                    if (typeof nextCategoryId === "number" && track.musicSoundTrackCategoryId !== nextCategoryId) return false;
                    if (nextSearchQuery.trim() && !getTrackSearchText(track).includes(nextSearchQuery.toLowerCase().trim())) return false;
                    return true;
                }).sort((a, b) => {
                    let comparison = 0;
                    if (nextSortBy === "seq") comparison = a.seq - b.seq;
                    else comparison = a.title.localeCompare(b.title, "ja-JP");
                    return nextSortOrder === "asc" ? comparison : -comparison;
                });

                // Set default track on first load, restoring from URL first and sessionStorage second.
                const urlTrackIdStr = searchParams.get("track");
                const savedTrackIdStr = sessionStorage.getItem("soundtrack-current-track-id");
                const restoreTrackIdStr = urlTrackIdStr ?? savedTrackIdStr;
                const restoredTrackId = restoreTrackIdStr ? parseInt(restoreTrackIdStr, 10) : NaN;
                const matchedTrack = Number.isNaN(restoredTrackId)
                    ? null
                    : visibleTracks.find(t => t.id === restoredTrackId) ?? null;
                setCurrentTrack(matchedTrack ?? restoreCandidates[0] ?? visibleTracks[0] ?? null);

                setSearchQuery(nextSearchQuery);
                setSortBy(nextSortBy);
                setSortOrder(nextSortOrder);

                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load soundtracks masterdata:", err);
                setError(err instanceof Error ? err.message : t("page.soundtrack.errors.fetchFailed"));
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }
        loadData();

        return () => {
            cancelled = true;
        };
    }, [searchParams, t, isShowSpoiler]);

    useEffect(() => {
        currentTimeRef.current = currentTime;
    }, [currentTime]);

    // Track audio source URL (correctly resolving Mysekai paths too)
    const selectedAudioUrl = useMemo(() => {
        if (!currentTrack) return "";
        return getMysekaiSoundTrackAudioUrl(currentTrack.assetbundleName, currentTrack.assetbundleFileName, assetSource) || "";
    }, [currentTrack, assetSource]);
    const audioUrl = hasActivatedAudio ? selectedAudioUrl : "";

    // Sync volume state to audio element
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = clampVolume(volume);
        }
    }, [volume]);

    // Save current track ID to sessionStorage for state restoration
    useEffect(() => {
        if (currentTrack) {
            sessionStorage.setItem("soundtrack-current-track-id", currentTrack.id.toString());
        }
    }, [currentTrack]);

    useEffect(() => {
        setDownloadHint(null);
        setShareHint(null);
    }, [selectedAudioUrl]);

    // Explicitly swap/restart the single audio element source so old tracks are stopped before a new one loads.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        playRequestIdRef.current += 1;
        audio.pause();
        setCurrentTime(0);
        setDuration(0);
        setAudioError(null);

        if (!audioUrl) {
            if (audio.hasAttribute("src") || audio.currentSrc) {
                audio.removeAttribute("src");
                audio.load();
            }
            setIsPlaying(false);
            return;
        }

        if (audio.src !== audioUrl) {
            audio.src = audioUrl;
            audio.load();
        }
        audio.currentTime = 0;

        return () => {
            playRequestIdRef.current += 1;
            audio.pause();
        };
    }, [audioUrl, playbackRestartNonce]);

    // Declaratively control audio playback and ignore stale play() promises from rapid track switches.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (!audioUrl || !isPlaying) {
            playRequestIdRef.current += 1;
            audio.pause();
            return;
        }

        let retryTimer: number | null = null;
        const requestId = playRequestIdRef.current + 1;
        playRequestIdRef.current = requestId;

        const tryPlay = (allowAbortRetry: boolean) => {
            audio.play()
                .then(() => {
                    if (playRequestIdRef.current === requestId) {
                        setAudioError(null);
                    }
                })
                .catch(err => {
                    if (playRequestIdRef.current !== requestId) return;

                    const isAbort = err instanceof DOMException && err.name === "AbortError";
                    if (isAbort && allowAbortRetry) {
                        retryTimer = window.setTimeout(() => {
                            if (playRequestIdRef.current === requestId && isPlaying && audioUrl) {
                                tryPlay(false);
                            }
                        }, 80);
                        return;
                    }
                    if (isAbort) return;

                    console.warn("Audio play prevented or errored:", err);
                    setIsPlaying(false);
                    setAudioError(t("page.soundtrack.errors.audioPlayFailed"));
                });
        };

        tryPlay(true);

        return () => {
            if (retryTimer !== null) {
                window.clearTimeout(retryTimer);
            }
        };
    }, [isPlaying, audioUrl, playbackRestartNonce, t]);

    // Stop playback when leaving the route/component to avoid orphaned audio.
    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            playRequestIdRef.current += 1;
            if (!audio) return;
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        };
    }, []);

    // Category dictionary for quick mapping
    const categoryMap = useMemo(() => {
        return new Map(categories.map(c => [c.id, c]));
    }, [categories]);

    const spoilerTrackCount = useMemo(() => tracks.filter(track => track.isSpoiler).length, [tracks]);
    const selectedCategoryLabel = selectedCategoryId === SPOILER_CATEGORY_FILTER
        ? t("page.soundtrack.spoiler.categoryName")
        : selectedCategoryId !== null
            ? categoryMap.get(selectedCategoryId)?.name || t("page.soundtrack.categoryFallback")
            : t("page.soundtrack.allCategory");

    // Filtered and Sorted Tracks
    const filteredTracks = useMemo(() => {
        let result = tracks;

        // 1. Hide spoiler-only supplemental tracks unless the global spoiler setting is enabled.
        if (!isShowSpoiler) {
            result = result.filter(t => !t.isSpoiler);
        }

        // 2. Filter by category
        if (selectedCategoryId === SPOILER_CATEGORY_FILTER) {
            result = result.filter(t => t.isSpoiler);
        } else if (selectedCategoryId !== null) {
            result = result.filter(t => t.musicSoundTrackCategoryId === selectedCategoryId);
        }

        // 3. Filter by search query (fuzzy search title, pronunciation, asset key, or file name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(t => getTrackSearchText(t).includes(query));
        }

        // 4. Sort
        result = [...result];
        result.sort((a, b) => {
            let comparison = 0;
            if (sortBy === "seq") {
                comparison = a.seq - b.seq;
            } else if (sortBy === "title") {
                comparison = a.title.localeCompare(b.title, "ja-JP");
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return result;
    }, [tracks, selectedCategoryId, searchQuery, sortBy, sortOrder, isShowSpoiler]);

    const displayedTracks = useMemo(() => {
        return filteredTracks.slice(0, visibleTrackLimit);
    }, [filteredTracks, visibleTrackLimit]);

    const hasMoreTracks = visibleTrackLimit < filteredTracks.length;

    useEffect(() => {
        setVisibleTrackLimit(SOUNDTRACK_INITIAL_LIST_LIMIT);
    }, [selectedCategoryId, searchQuery, sortBy, sortOrder, isShowSpoiler]);

    const handlePlaylistScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        if (!hasMoreTracks) return;

        const target = event.currentTarget;
        const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (distanceToBottom > SOUNDTRACK_LIST_SCROLL_THRESHOLD_PX) return;

        setVisibleTrackLimit(limit => Math.min(limit + SOUNDTRACK_LIST_BATCH_SIZE, filteredTracks.length));
    }, [filteredTracks.length, hasMoreTracks]);

    const updateTrackUrlParam = useCallback((track: MysekaiMusicSoundTrackMaster | null) => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (track) url.searchParams.set("track", track.id.toString());
        else url.searchParams.delete("track");
        window.history.replaceState({}, "", url.toString());
    }, []);

    // Sync states to URL query parameters
    const handleFilterChange = useCallback((catId: SoundtrackCategoryFilter, search: string, sort: "seq" | "title", order: "asc" | "desc") => {
        const url = new URL(window.location.href);

        if (catId !== null) url.searchParams.set("category", catId.toString());
        else url.searchParams.delete("category");

        if (search) url.searchParams.set("search", search);
        else url.searchParams.delete("search");

        if (sort !== "seq") url.searchParams.set("sort", sort);
        else url.searchParams.delete("sort");

        if (order !== "asc") url.searchParams.set("order", order);
        else url.searchParams.delete("order");

        if (currentTrack) url.searchParams.set("track", currentTrack.id.toString());
        else url.searchParams.delete("track");

        window.history.replaceState({}, "", url.toString());
    }, [currentTrack]);

    useEffect(() => {
        if (isShowSpoiler || selectedCategoryId !== SPOILER_CATEGORY_FILTER) return;

        setSelectedCategoryId(null);
        handleFilterChange(null, searchQuery, sortBy, sortOrder);
    }, [handleFilterChange, isShowSpoiler, selectedCategoryId, searchQuery, sortBy, sortOrder]);

    useEffect(() => {
        if (!currentTrack) return;
        if (isShowSpoiler || !currentTrack.isSpoiler) return;

        const fallbackTrack = filteredTracks[0] ?? tracks.find(track => !track.isSpoiler) ?? null;
        setCurrentTrack(fallbackTrack);
        updateTrackUrlParam(fallbackTrack);
        setIsPlaying(false);
    }, [currentTrack, filteredTracks, tracks, isShowSpoiler, updateTrackUrlParam]);

    // Update active category
    const selectCategory = (catId: SoundtrackCategoryFilter) => {
        setSelectedCategoryId(catId);
        handleFilterChange(catId, searchQuery, sortBy, sortOrder);
    };

    // Update search query
    const handleSearch = (query: string) => {
        setSearchQuery(query);
        handleFilterChange(selectedCategoryId, query, sortBy, sortOrder);
    };

    // Toggle sorting parameters
    const toggleSort = (field: "seq" | "title") => {
        let newOrder: "asc" | "desc" = "asc";
        if (sortBy === field) {
            newOrder = sortOrder === "asc" ? "desc" : "asc";
        }
        setSortBy(field);
        setSortOrder(newOrder);
        handleFilterChange(selectedCategoryId, searchQuery, field, newOrder);
    };

    // Theme values for currently active track
    const currentCategory = currentTrack
        ? categoryMap.get(currentTrack.musicSoundTrackCategoryId) ?? null
        : null;

    const currentArtworkUrl = useMemo(() => {
        if (!currentTrack) return "";
        const jacketName = currentCategory?.assetbundleName ?? "jacket_s_soundtrack_1";
        return getMysekaiRawAssetUrl(
            `music_record_soundtrack/jacket/${jacketName}/${jacketName}.webp`,
            assetSource,
        );
    }, [assetSource, currentCategory, currentTrack]);

    const currentTheme = useMemo(() => {
        if (!currentTrack) return DEFAULT_THEME;
        return CATEGORY_THEMES[currentTrack.musicSoundTrackCategoryId] ?? DEFAULT_THEME;
    }, [currentTrack]);

    // High contrast adaptive icon color
    const iconColor = useMemo(
        () => getCategoryTextColor(currentTrack?.musicSoundTrackCategoryId, isDark),
        [isDark, currentTrack],
    );

    const syncCurrentTime = useCallback((force = false) => {
        const audio = audioRef.current;
        if (!audio) return;

        const now = performance.now();
        if (!force && now - lastProgressUpdateRef.current < SOUNDTRACK_PROGRESS_UPDATE_INTERVAL_MS) return;

        lastProgressUpdateRef.current = now;
        const nextTime = audio.currentTime;
        setCurrentTime(prevTime => {
            const safeNextTime = Number.isFinite(nextTime) ? nextTime : 0;
            return Math.abs(prevTime - safeNextTime) > 0.2 ? safeNextTime : prevTime;
        });
    }, []);

    const startPlayback = useCallback(() => {
        if (!selectedAudioUrl) return;
        setHasActivatedAudio(true);
        setIsPlaying(true);
    }, [selectedAudioUrl]);

    const pausePlayback = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const stopPlayback = useCallback(() => {
        setIsPlaying(false);
        syncCurrentTime(true);
    }, [syncCurrentTime]);

    // Audio handlers
    const togglePlay = () => {
        if (isPlaying) {
            pausePlayback();
            return;
        }
        startPlayback();
    };

    const handleTimeUpdate = () => {
        syncCurrentTime();
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const nextDuration = audioRef.current.duration;
            setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }
    };

    const getSeekableDuration = useCallback(() => {
        const audioDuration = audioRef.current?.duration;
        if (typeof audioDuration === "number" && Number.isFinite(audioDuration) && audioDuration > 0) {
            return audioDuration;
        }
        const trackDuration = currentTrack?.durationSeconds ?? duration;
        return Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 0;
    }, [currentTrack, duration]);

    const seekToTime = useCallback((time: number, fastSeek = false) => {
        if (!Number.isFinite(time)) return;

        const audio = audioRef.current;
        const seekableDuration = getSeekableDuration();
        const nextTime = seekableDuration > 0
            ? Math.min(seekableDuration, Math.max(0, time))
            : Math.max(0, time);

        if (audio) {
            if (fastSeek && typeof audio.fastSeek === "function") {
                try {
                    audio.fastSeek(nextTime);
                } catch {
                    audio.currentTime = nextTime;
                }
            } else {
                audio.currentTime = nextTime;
            }
        }
        currentTimeRef.current = nextTime;
        setCurrentTime(nextTime);
    }, [getSeekableDuration]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        seekToTime(val);
    };

    const handleVerticalVolumePointer = (event: React.PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const nextVolume = 1 - (event.clientY - rect.top) / rect.height;
        setVolumeAndPersist(nextVolume);
    };

    const cyclePlaybackMode = () => {
        let nextMode: PlaybackMode;
        if (playbackMode === "sequential") {
            nextMode = "loop-one";
        } else if (playbackMode === "loop-one") {
            nextMode = "shuffle";
        } else {
            nextMode = "sequential";
        }
        setPlaybackMode(nextMode);
        localStorage.setItem("soundtrack-playback-mode", nextMode);
    };

    const getPlaybackList = useCallback(() => (
        filteredTracks.length > 0
            ? filteredTracks
            : tracks.filter(track => isShowSpoiler || !track.isSpoiler)
    ), [filteredTracks, tracks, isShowSpoiler]);

    const pickRandomTrack = useCallback((activeList: MysekaiMusicSoundTrackMaster[]) => {
        if (activeList.length <= 1 || !currentTrack) return activeList[0];

        const candidates = activeList.filter(track => track.id !== currentTrack.id);
        return candidates[Math.floor(Math.random() * candidates.length)] ?? activeList[0];
    }, [currentTrack]);

    // Audio navigation methods
    const playNext = useCallback(() => {
        if (tracks.length === 0 || !currentTrack) return;

        const activeList = getPlaybackList();
        if (activeList.length === 0) return;

        let nextTrack: MysekaiMusicSoundTrackMaster;

        if (playbackMode === "shuffle") {
            nextTrack = pickRandomTrack(activeList);
        } else {
            const currentIndex = activeList.findIndex(t => t.id === currentTrack.id);
            if (currentIndex !== -1 && currentIndex < activeList.length - 1) {
                nextTrack = activeList[currentIndex + 1];
            } else {
                // Loop to start
                nextTrack = activeList[0];
            }
        }

        const isRestartingSameTrack = nextTrack.id === currentTrack.id;
        setCurrentTrack(nextTrack);
        updateTrackUrlParam(nextTrack);
        setHasActivatedAudio(true);
        setIsPlaying(true);
        if (isRestartingSameTrack) {
            setPlaybackRestartNonce(nonce => nonce + 1);
        }
    }, [currentTrack, getPlaybackList, pickRandomTrack, playbackMode, tracks.length, updateTrackUrlParam]);

    useEffect(() => {
        playNextRef.current = playNext;
    }, [playNext]);

    const playPrevious = useCallback(() => {
        if (tracks.length === 0 || !currentTrack) return;

        const activeList = getPlaybackList();
        if (activeList.length === 0) return;

        let prevTrack: MysekaiMusicSoundTrackMaster;

        if (playbackMode === "shuffle") {
            prevTrack = pickRandomTrack(activeList);
        } else {
            const currentIndex = activeList.findIndex(t => t.id === currentTrack.id);
            if (currentIndex > 0) {
                prevTrack = activeList[currentIndex - 1];
            } else {
                // Loop to end
                prevTrack = activeList[activeList.length - 1];
            }
        }

        const isRestartingSameTrack = prevTrack.id === currentTrack.id;
        setCurrentTrack(prevTrack);
        updateTrackUrlParam(prevTrack);
        setHasActivatedAudio(true);
        setIsPlaying(true);
        if (isRestartingSameTrack) {
            setPlaybackRestartNonce(nonce => nonce + 1);
        }
    }, [currentTrack, getPlaybackList, pickRandomTrack, playbackMode, tracks.length, updateTrackUrlParam]);

    useEffect(() => {
        const mediaSession = getSoundtrackMediaSession();
        if (!mediaSession) return;

        if (!currentTrack) {
            setSoundtrackMediaSessionMetadata(mediaSession, null);
            return;
        }

        const title = getDisplayTrackTitle(currentTrack, t);
        const categoryName = currentCategory?.name || "Soundtrack";
        const artist = currentTrack.pronunciation || categoryName;
        const metadata = createSoundtrackMediaMetadata({
            title,
            artist,
            album: categoryName,
            artwork: currentArtworkUrl
                ? SOUNDTRACK_MEDIA_ARTWORK_SIZES.map(size => ({
                    src: currentArtworkUrl,
                    sizes: size,
                    type: "image/webp",
                }))
                : undefined,
        });

        if (metadata) {
            setSoundtrackMediaSessionMetadata(mediaSession, metadata);
        }
    }, [currentArtworkUrl, currentCategory, currentTrack, t]);

    useEffect(() => {
        const mediaSession = getSoundtrackMediaSession();
        if (!mediaSession) return;

        setSoundtrackMediaSessionPlaybackState(
            mediaSession,
            audioUrl ? isPlaying ? "playing" : "paused" : "none",
        );
    }, [audioUrl, isPlaying]);

    useEffect(() => {
        const mediaSession = getSoundtrackMediaSession();
        if (!mediaSession?.setPositionState) return;

        const positionDuration = getSeekableDuration();
        if (!audioUrl || positionDuration <= 0) {
            try {
                mediaSession.setPositionState();
            } catch {
                // Some browsers require a full position state or do not support clearing.
            }
            return;
        }

        try {
            mediaSession.setPositionState({
                duration: positionDuration,
                playbackRate: audioRef.current?.playbackRate || 1,
                position: Math.min(positionDuration, Math.max(0, currentTime)),
            });
        } catch (err) {
            console.warn("Failed to update soundtrack media position:", err);
        }
    }, [audioUrl, currentTime, duration, getSeekableDuration]);

    useEffect(() => {
        const mediaSession = getSoundtrackMediaSession();
        if (!mediaSession) return;

        setSoundtrackMediaSessionActionHandler(mediaSession, "play", startPlayback);
        setSoundtrackMediaSessionActionHandler(mediaSession, "pause", pausePlayback);
        setSoundtrackMediaSessionActionHandler(mediaSession, "stop", stopPlayback);
        setSoundtrackMediaSessionActionHandler(mediaSession, "previoustrack", playPrevious);
        setSoundtrackMediaSessionActionHandler(mediaSession, "nexttrack", playNext);
        setSoundtrackMediaSessionActionHandler(mediaSession, "seekbackward", (details) => {
            const offset = details?.seekOffset ?? SOUNDTRACK_MEDIA_SEEK_OFFSET_SECONDS;
            const audioTime = audioRef.current?.currentTime;
            const baseTime = typeof audioTime === "number" && Number.isFinite(audioTime) ? audioTime : currentTimeRef.current;
            seekToTime(baseTime - offset);
        });
        setSoundtrackMediaSessionActionHandler(mediaSession, "seekforward", (details) => {
            const offset = details?.seekOffset ?? SOUNDTRACK_MEDIA_SEEK_OFFSET_SECONDS;
            const audioTime = audioRef.current?.currentTime;
            const baseTime = typeof audioTime === "number" && Number.isFinite(audioTime) ? audioTime : currentTimeRef.current;
            seekToTime(baseTime + offset);
        });
        setSoundtrackMediaSessionActionHandler(mediaSession, "seekto", (details) => {
            if (typeof details?.seekTime !== "number") return;
            seekToTime(details.seekTime, Boolean(details.fastSeek));
        });

        return () => {
            (["play", "pause", "stop", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"] as const).forEach((action) => {
                setSoundtrackMediaSessionActionHandler(mediaSession, action, null);
            });
        };
    }, [pausePlayback, playNext, playPrevious, seekToTime, startPlayback, stopPlayback]);

    useEffect(() => {
        const mediaSession = getSoundtrackMediaSession();
        return () => {
            if (!mediaSession) return;
            setSoundtrackMediaSessionMetadata(mediaSession, null);
            setSoundtrackMediaSessionPlaybackState(mediaSession, "none");
        };
    }, []);

    const handleEnded = useCallback(() => {
        if (playbackMode === "loop-one") {
            const audio = audioRef.current;
            if (!audio) return;

            const requestId = playRequestIdRef.current + 1;
            playRequestIdRef.current = requestId;
            audio.currentTime = 0;
            audio.play().catch(err => {
                if (playRequestIdRef.current !== requestId) return;
                console.error("Replay blocked:", err);
                setIsPlaying(false);
                setAudioError(t("page.soundtrack.errors.loopReplayFailed"));
            });
        } else {
            playNextRef.current();
        }
    }, [playbackMode, t]);

    const handleTrackSelect = (track: MysekaiMusicSoundTrackMaster) => {
        setCurrentTrack(track);
        updateTrackUrlParam(track);
        setHasActivatedAudio(true);
        setIsPlaying(true);
    };

    const handleDownloadCurrentTrack = async () => {
        if (!currentTrack || !selectedAudioUrl || isDownloading) return;

        const downloadUrl = selectedAudioUrl;
        const fileName = getTrackDownloadFileName(currentTrack);
        setIsDownloading(true);
        setDownloadHint(null);
        setShareHint(null);

        try {
            const cachedBlob = await readAudioBlobFromCache(downloadUrl);
            if (cachedBlob) {
                triggerBlobDownload(cachedBlob, fileName);
                setDownloadHint(t("page.soundtrack.download.cachedHint"));
                return;
            }

            const response = await fetch(downloadUrl, { cache: "force-cache" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            if (blob.size === 0) {
                throw new Error("EMPTY_AUDIO_BLOB");
            }

            await storeAudioBlobInCache(downloadUrl, blob);
            triggerBlobDownload(blob, fileName);
            setDownloadHint(t("page.soundtrack.download.cachedAndStartedHint"));
        } catch (err) {
            console.warn("Soundtrack download fallback to direct link:", err);
            triggerDirectDownload(downloadUrl, fileName);
            setDownloadHint(t("page.soundtrack.download.directHint"));
        } finally {
            setIsDownloading(false);
        }
    };

    const buildCurrentTrackShareUrl = useCallback(() => {
        if (!currentTrack || typeof window === "undefined") return "";
        const url = new URL(window.location.href);
        url.searchParams.set("track", currentTrack.id.toString());
        if (selectedCategoryId !== null) url.searchParams.set("category", selectedCategoryId.toString());
        else url.searchParams.delete("category");
        if (searchQuery) url.searchParams.set("search", searchQuery);
        else url.searchParams.delete("search");
        if (sortBy !== "seq") url.searchParams.set("sort", sortBy);
        else url.searchParams.delete("sort");
        if (sortOrder !== "asc") url.searchParams.set("order", sortOrder);
        else url.searchParams.delete("order");
        return url.toString();
    }, [currentTrack, selectedCategoryId, searchQuery, sortBy, sortOrder]);

    const handleShareCurrentTrack = useCallback(async () => {
        if (!currentTrack) return;

        const url = buildCurrentTrackShareUrl();
        if (!url) return;

        setDownloadHint(null);
        setShareHint(null);

        const title = getDisplayTrackTitle(currentTrack, t);
        try {
            if (navigator.share) {
                await navigator.share({
                    title,
                    text: t("page.soundtrack.share.nativeText", { title }),
                    url,
                });
                setShareHint(t("page.soundtrack.share.sharedHint"));
                return;
            }

            await navigator.clipboard.writeText(url);
            setShareHint(t("page.soundtrack.share.copiedHint"));
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            console.warn("Failed to share soundtrack URL:", err);
            setShareHint(t("page.soundtrack.share.failedHint"));
        }
    }, [buildCurrentTrackShareUrl, currentTrack, t]);

    // Format seconds into MM:SS
    const formatTime = (time: number) => {
        if (!Number.isFinite(time)) return "00:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const displayDuration = currentTrack?.durationSeconds ?? duration;
    // Flat opaque surfaces: the player is the page's structural panel, the toolbar
    // and the volume popover are a tile and a floating layer sitting on top of it.
    const playerCardClassName = "hh-panel relative overflow-hidden rounded-[var(--hh-radius-xl)] p-6 sm:p-8";
    const toolbarClassName = "flex flex-col sm:flex-row gap-4 items-center justify-between rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] p-4";
    const volumePopoverCardClassName = "hh-float flex flex-col items-center gap-3 rounded-[var(--hh-radius-xl)] p-4";

    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    return (
        <div className="relative w-full text-[var(--hh-text-primary)] select-none">
            {/* Embedded styles for spinning CD animations to ensure smooth pause/resumes */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin-cd {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-cd-spin {
                    animation: spin-cd 30s linear infinite;
                    will-change: transform;
                }
                .custom-slider-thumb::-webkit-slider-thumb {
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: ${currentTheme.from};
                    cursor: pointer;
                    transition: transform 0.15s ease-in-out;
                }
                .custom-slider-thumb::-webkit-slider-thumb:hover {
                    transform: scale(1.3);
                }

                .vertical-volume-hitbox {
                    touch-action: none;
                }
                /* Hide scrollbars completely while remaining scrollable */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                /* Thin modern elegant custom scrollbar for playlist */
                .custom-playlist-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-playlist-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-playlist-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'};
                    border-radius: 99px;
                }
                .custom-playlist-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'};
                }
            `}} />

            {/* Hidden HTML5 Audio Element */}
            <audio
                ref={audioRef}
                preload="metadata"
                crossOrigin="anonymous"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleLoadedMetadata}
                onEnded={handleEnded}
                onError={(e) => {
                    console.error("Audio playback error:", e);
                    setAudioError(t("page.soundtrack.errors.audioLoadFailed"));
                    setIsPlaying(false);
                }}
            />

            <div className="container mx-auto px-4 sm:px-6 py-8 relative z-10 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-[var(--hh-border)] pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-sm)] mb-2">
                            <span className={`w-1.5 h-1.5 rounded-full bg-[var(--hh-accent)] ${shouldAnimateIdleUi ? "animate-pulse" : ""}`} />
                            <span className="hh-label text-[var(--hh-accent-deep)]">{t("page.soundtrack.badge")}</span>
                        </div>
                        <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)]">
                            {t("page.soundtrack.title")} <span className="text-[var(--hh-accent-deep)]">{t("page.soundtrack.titleHighlight")}</span>
                        </h1>
                    </div>
                    <p className="hh-body text-[var(--hh-text-secondary)] text-sm max-w-md md:text-right hidden sm:block">
                        {t("page.soundtrack.description")}
                    </p>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Music player panel */}
                    <div className="lg:col-span-5 w-full">
                        <div className={playerCardClassName}>
                            
                            {/* Accent rule marking the panel's top edge */}
                            <div
                                className="absolute top-0 inset-x-0 h-[2px]"
                                style={{ background: currentTheme.from }}
                            />

                            {/* Album Art - Rotating CD */}
                            <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto mb-8 flex items-center justify-center">
                                {/* Vinyl Track Body. The disc depicts physical media, so it stays
                                    dark in both themes rather than following the surface ramp. */}
                                <div className="relative w-full h-full rounded-full bg-neutral-950 p-[6px] border border-neutral-800 flex items-center justify-center select-none">
                                    {/* Concentric Grooves */}
                                    <div className="absolute inset-2 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-6 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-12 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-20 rounded-full border border-neutral-900/60 pointer-events-none" />

                                    {/* Center spinning core */}
                                    <div className={`relative w-4/5 h-4/5 rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center ${isPlaying ? "animate-cd-spin" : ""}`}>
                                        
                                        {/* Center Jacket Image */}
                                        {currentTrack && (
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={(() => {
                                                        const jacketName = categoryMap.get(currentTrack.musicSoundTrackCategoryId)?.assetbundleName ?? "jacket_s_soundtrack_1";
                                                        return getMysekaiRawAssetUrl(
                                                            `music_record_soundtrack/jacket/${jacketName}/${jacketName}.webp`,
                                                            assetSource
                                                        );
                                                    })()}
                                                    alt={currentTrack.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                    priority
                                                />
                                                {/* Matte Overlay */}
                                                <div className="absolute inset-0 bg-black/10" />
                                            </div>
                                        )}

                                        {/* CD Hole Trim */}
                                        <div className="absolute w-12 h-12 rounded-full bg-neutral-950 border-4 border-neutral-800/80 flex items-center justify-center z-20">
                                            <div className="w-4 h-4 rounded-full bg-neutral-950" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Song Meta Info */}
                            <div className="text-center mb-6 px-2">
                                <div key={currentTrack?.id || "empty"} className="transition-opacity duration-200">
                                    <h3 className="hh-title text-xl text-[var(--hh-text-primary)] truncate max-w-full">
                                        {getDisplayTrackTitle(currentTrack, t)}
                                    </h3>
                                    <p className="text-[var(--hh-text-secondary)] text-xs mt-1 truncate">
                                        {currentTrack?.pronunciation || t("page.soundtrack.pronunciationLoading")}
                                    </p>
                                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                        <div className="px-3 py-1 bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] rounded-[var(--hh-radius-sm)] text-[10px] font-bold text-[var(--hh-text-secondary)]">
                                            {currentTrack ? (categoryMap.get(currentTrack.musicSoundTrackCategoryId)?.name || "BGM") : "..."}
                                        </div>
                                        {currentTrack?.isSpoiler && (
                                            <span className="px-3 py-1 bg-orange-500/10 border border-orange-400/30 rounded-[var(--hh-radius-sm)] text-[10px] font-bold text-orange-600 dark:text-orange-300">
                                                {t("common.badge.spoiler")}
                                            </span>
                                        )}
                                        {currentTrack && Number.isFinite(displayDuration) && displayDuration > 0 && (
                                            <span className="hh-numeric px-3 py-1 bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] rounded-[var(--hh-radius-sm)] text-[10px] font-mono font-bold text-[var(--hh-text-secondary)]" title={t("page.soundtrack.durationLabel")}>
                                                {formatTime(displayDuration)}
                                            </span>
                                        )}
                                        <button
                                            onClick={handleDownloadCurrentTrack}
                                            disabled={!currentTrack || !selectedAudioUrl || isDownloading}
                                            className="hh-press hh-focusable inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[10px] font-bold text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                            title={isDownloading ? t("page.soundtrack.download.preparingTitle") : t("page.soundtrack.download.currentTitle")}
                                        >
                                            {isDownloading ? (
                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                    <path d="M12 3v12" />
                                                    <path d="M7 10l5 5 5-5" />
                                                    <path d="M5 21h14" />
                                                </svg>
                                            )}
                                            <span>{isDownloading ? t("page.soundtrack.download.preparing") : t("page.soundtrack.download.button")}</span>
                                        </button>
                                        <button
                                            onClick={handleShareCurrentTrack}
                                            disabled={!currentTrack}
                                            className="hh-press hh-focusable inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[10px] font-bold text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)] disabled:cursor-not-allowed disabled:opacity-40"
                                            title={t("page.soundtrack.share.currentTitle")}
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <circle cx="18" cy="5" r="3" />
                                                <circle cx="6" cy="12" r="3" />
                                                <circle cx="18" cy="19" r="3" />
                                                <path d="M8.59 13.51l6.83 3.98" />
                                                <path d="M15.41 6.51L8.59 10.49" />
                                            </svg>
                                            <span>{t("page.soundtrack.share.button")}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {audioError && (
                                <div className="mb-4 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-alert)]/45 bg-[var(--hh-accent-alert)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--hh-accent-alert)] dark:text-rose-300">
                                    {audioError}
                                </div>
                            )}
                            {(downloadHint || shareHint || durationWarning) && !audioError && (
                                <div className="mb-4 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-3 py-2 text-center text-xs font-medium text-[var(--hh-accent-deep)]">
                                    {downloadHint || shareHint || durationWarning}
                                </div>
                            )}

                            {/* Custom Slider / Progress Bar */}
                            <div className="mb-6">
                                <input
                                    type="range"
                                    min="0"
                                    max={duration || 100}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    onPointerDown={() => syncCurrentTime(true)}
                                    className="w-full h-1 rounded-[var(--hh-radius-xs)] appearance-none cursor-pointer hover:h-1.5 transition-all outline-none custom-slider-thumb"
                                    style={{
                                        background: `linear-gradient(to right, ${currentTheme.from} 0%, ${currentTheme.from} ${progressPercent}%, var(--hh-surface-inset) ${progressPercent}%, var(--hh-surface-inset) 100%)`
                                    }}
                                />
                                {/* Time codes are tabular: without tabular-nums the digits change
                                    width every second and the whole row jitters during playback. */}
                                <div className="hh-numeric flex justify-between items-center text-[10px] font-mono text-[var(--hh-text-secondary)] mt-2">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Player Controls */}
                            <div className="flex items-center justify-between gap-2 max-w-sm mx-auto mb-6 px-4">
                                
                                {/* Playback Mode (Cycle Button) */}
                                <button
                                    onClick={cyclePlaybackMode}
                                    className={`hh-press hh-focusable p-2.5 rounded-[var(--hh-radius-md)] border ${
                                        playbackMode === "sequential"
                                            ? "border-transparent text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-sunken)]"
                                            : ""
                                    }`}
                                    style={
                                        playbackMode !== "sequential"
                                            ? {
                                                  background: `${currentTheme.from}18`,
                                                  borderColor: `${currentTheme.from}40`,
                                                  color: iconColor
                                              }
                                            : undefined
                                    }
                                    title={
                                        playbackMode === "sequential"
                                            ? t("page.soundtrack.playbackModes.sequential")
                                            : playbackMode === "loop-one"
                                            ? t("page.soundtrack.playbackModes.loopOne")
                                            : t("page.soundtrack.playbackModes.shuffle")
                                    }
                                >
                                    {playbackMode === "sequential" && (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polyline points="17 1 21 5 17 9" />
                                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                            <polyline points="7 23 3 19 7 15" />
                                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                        </svg>
                                    )}
                                    {playbackMode === "loop-one" && (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polyline points="17 1 21 5 17 9" />
                                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                            <polyline points="7 23 3 19 7 15" />
                                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                            <path d="M11 10h1v4" strokeWidth="2.5" />
                                            <path d="M10 14h3" strokeWidth="2" />
                                        </svg>
                                    )}
                                    {playbackMode === "shuffle" && (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polyline points="16 3 21 3 21 8" />
                                            <line x1="4" y1="20" x2="21" y2="3" />
                                            <polyline points="21 16 21 21 16 21" />
                                            <line x1="15" y1="15" x2="21" y2="21" />
                                            <line x1="4" y1="4" x2="9" y2="9" />
                                        </svg>
                                    )}
                                </button>

                                {/* Playback Navigation & Action Group */}
                                <div className="flex items-center gap-3">
                                    {/* Prev Button */}
                                    <button
                                        onClick={playPrevious}
                                        className="hh-press hh-focusable p-2.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] border border-transparent"
                                        title={t("page.soundtrack.controls.previous")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polygon points="19 20 9 12 19 4 19 20"/>
                                            <line x1="5" y1="19" x2="5" y2="5"/>
                                        </svg>
                                    </button>

                                    {/* Play / Pause. Round because it depicts a physical transport
                                        button, which is the one shape the radius ladder exempts. */}
                                    <button
                                        onClick={togglePlay}
                                        className="hh-press hh-focusable w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold flex-shrink-0 border"
                                        style={{
                                            background: `${currentTheme.from}1a`,
                                            borderColor: `${currentTheme.from}40`
                                        }}
                                        title={isPlaying ? t("page.soundtrack.controls.pause") : t("page.soundtrack.controls.play")}
                                    >
                                        {isPlaying ? (
                                            <svg 
                                                className="w-6 h-6" 
                                                viewBox="0 0 24 24"
                                                style={{
                                                    color: iconColor,
                                                    fill: iconColor
                                                }}
                                            >
                                                <rect x="5" y="4" width="4" height="16" rx="1" />
                                                <rect x="15" y="4" width="4" height="16" rx="1" />
                                            </svg>
                                        ) : (
                                            <svg 
                                                className="w-6 h-6 ml-1" 
                                                viewBox="0 0 24 24"
                                                style={{
                                                    color: iconColor,
                                                    fill: iconColor
                                                }}
                                            >
                                                <path d="M5.5 3a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 002.307 1.28L21.3 13.28a1.5 1.5 0 000-2.56L6.307 3.22A1.5 1.5 0 005.5 3z" />
                                            </svg>
                                        )}
                                    </button>

                                    {/* Next Button */}
                                    <button
                                        onClick={playNext}
                                        className="hh-press hh-focusable p-2.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] border border-transparent"
                                        title={t("page.soundtrack.controls.next")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polygon points="5 4 15 12 5 20 5 4"/>
                                            <line x1="19" y1="5" x2="19" y2="19"/>
                                        </svg>
                                    </button>
                                </div>

                                {/* Volume (Popover Dropup Trigger) */}
                                <div 
                                    className="relative group flex items-center justify-center volume-container"
                                    onMouseEnter={() => setShowVolumePopup(true)}
                                    onMouseLeave={() => setShowVolumePopup(false)}
                                >
                                    {/* Vertical Volume Popover Dropup Wrapper (Bridges the Gap) */}
                                    <div 
                                        className={`absolute bottom-full left-1/2 -translate-x-1/2 pb-3 transition-all duration-300 z-30 ${
                                            showVolumePopup 
                                                ? "opacity-100 translate-y-0 pointer-events-auto" 
                                                : "opacity-0 translate-y-2 pointer-events-none"
                                        }`}
                                    >
                                        {/* Vertical Volume Popover Dropup Card (Actual Styled Content) */}
                                        <div 
                                            className={volumePopoverCardClassName}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="hh-numeric text-[10px] font-mono font-bold text-[var(--hh-text-secondary)]">
                                                {`${Math.round(volume * 100)}%`}
                                            </span>
                                            <div
                                                className="h-28 w-8 flex items-center justify-center relative vertical-volume-hitbox cursor-pointer"
                                                role="slider"
                                                tabIndex={0}
                                                aria-label={t("page.soundtrack.controls.volume")}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={Math.round(volume * 100)}
                                                onPointerDown={(event) => {
                                                    event.currentTarget.setPointerCapture(event.pointerId);
                                                    handleVerticalVolumePointer(event);
                                                }}
                                                onPointerMove={(event) => {
                                                    if (event.buttons !== 1) return;
                                                    handleVerticalVolumePointer(event);
                                                }}
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => {
                                                    const step = event.shiftKey ? 0.1 : 0.05;
                                                    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(volume + step);
                                                    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(volume - step);
                                                    } else if (event.key === "PageUp") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(volume + 0.1);
                                                    } else if (event.key === "PageDown") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(volume - 0.1);
                                                    } else if (event.key === "Home") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(0);
                                                    } else if (event.key === "End") {
                                                        event.preventDefault();
                                                        setVolumeAndPersist(1);
                                                    }
                                                }}
                                            >
                                                <div className="h-24 w-1.5 bg-[var(--hh-surface-inset)] rounded-full relative overflow-hidden flex items-end pointer-events-none">
                                                    <div
                                                        className="w-full rounded-full transition-all duration-75"
                                                        style={{
                                                            height: `${volume * 100}%`,
                                                            background: currentTheme.from
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowVolumePopup(!showVolumePopup);
                                        }}
                                        className="hh-press hh-focusable p-2.5 rounded-[var(--hh-radius-md)] border border-transparent text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-sunken)]"
                                        title={t("page.soundtrack.controls.volumeAdjust")}
                                    >
                                        {volume === 0 ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                <line x1="22" y1="9" x2="16" y2="15" />
                                                <line x1="16" y1="9" x2="22" y2="15" />
                                            </svg>
                                        ) : volume < 0.4 ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Categories & Playlist */}
                    <div className="lg:col-span-7 flex flex-col gap-6 w-full">

                        {/* Category Cards Filter Carousel */}
                        <div className="w-full">
                            <h4 className="hh-title text-sm text-[var(--hh-text-primary)] mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-[var(--hh-accent-deep)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l5.178-5.178a2.25 2.25 0 000-3.182l-9.581-9.58a2.25 2.25 0 00-1.591-.659z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                </svg>
                                {t("page.soundtrack.filters.categoryTitle")}
                            </h4>
                            
                            {/* Horizontal sliding categories list (scrollbars hidden via no-scrollbar) */}
                            <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
                                {/* "ALL" Card */}
                                <button
                                    onClick={() => selectCategory(null)}
                                    className={`hh-press relative flex-shrink-0 w-24 h-16 rounded-[var(--hh-radius-lg)] overflow-hidden border text-left flex flex-col justify-between p-2.5 ${
                                        selectedCategoryId === null
                                            ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]"
                                            : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] hover:border-[var(--hh-border-strong)]"
                                    }`}
                                >
                                    <span className="hh-label">ALL</span>
                                    <span className={`text-xs font-bold ${selectedCategoryId === null ? "text-[var(--hh-accent-deep)]" : "text-[var(--hh-text-primary)]"}`}>{t("page.soundtrack.allCategory")}</span>
                                </button>

                                {/* Spoiler-only supplemental BGM category */}
                                {isShowSpoiler && (
                                    <button
                                        onClick={() => selectCategory(SPOILER_CATEGORY_FILTER)}
                                        className={`hh-press relative flex-shrink-0 w-32 h-16 rounded-[var(--hh-radius-lg)] overflow-hidden border text-left flex flex-col justify-between p-2.5 ${
                                            selectedCategoryId === SPOILER_CATEGORY_FILTER
                                                ? "bg-[var(--hh-surface-3)]"
                                                : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] hover:border-[var(--hh-border-strong)]"
                                        }`}
                                        style={{
                                            borderColor: selectedCategoryId === SPOILER_CATEGORY_FILTER ? SPOILER_CATEGORY_THEME.from : undefined,
                                        }}
                                    >
                                        <span className="text-[8px] font-bold text-orange-600 dark:text-orange-300 tracking-wider relative z-10">
                                            {t("common.badge.spoiler")} · <span className="hh-numeric">{formatNumber(spoilerTrackCount)}</span>
                                        </span>
                                        <span className="text-xs font-bold text-[var(--hh-text-primary)] relative z-10 block truncate max-w-full">
                                            {t("page.soundtrack.spoiler.categoryName")}
                                        </span>
                                    </button>
                                )}

                                {/* List of Categories */}
                                {categories.map(cat => {
                                    const active = selectedCategoryId === cat.id;
                                    const theme = CATEGORY_THEMES[cat.id] ?? DEFAULT_THEME;
                                    
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => selectCategory(cat.id)}
                                            className={`hh-press relative flex-shrink-0 w-32 h-16 rounded-[var(--hh-radius-lg)] overflow-hidden border text-left flex flex-col justify-between p-2.5 ${
                                                active
                                                    ? "bg-[var(--hh-surface-3)]"
                                                    : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] hover:border-[var(--hh-border-strong)]"
                                            }`}
                                            style={{
                                                borderColor: active ? theme.from : undefined
                                            }}
                                        >
                                            {/* Jacket artwork behind the label, kept faint so the
                                                text stays the primary read. */}
                                            {isPerformanceVisuals && (
                                                <div className="absolute inset-0 opacity-15 dark:opacity-20">
                                                    <Image
                                                        src={getMysekaiRawAssetUrl(`music_record_soundtrack/jacket/${cat.assetbundleName}/${cat.assetbundleName}.webp`, assetSource)}
                                                        alt={cat.name}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}

                                            {/* Category Indicator Tag */}
                                            <span className="hh-numeric text-[8px] font-bold text-[var(--hh-text-secondary)] tracking-wider relative z-10">
                                                CAT #{cat.id}
                                            </span>
                                            
                                            {/* Name */}
                                            <span className="text-xs font-bold text-[var(--hh-text-primary)] relative z-10 block truncate max-w-full">
                                                {cat.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Search and Sort Toolbar */}
                        <div className={toolbarClassName}>
                            
                            {/* Fuzzy Search Box */}
                            <div className="relative w-full sm:w-72">
                                <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--hh-text-tertiary)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    data-shortcut-search="true"
                                    type="text"
                                    placeholder={t("page.soundtrack.filters.searchPlaceholder")}
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="hh-input w-full py-2.5 pl-10 pr-4 text-xs"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearch("")}
                                        className="absolute right-3.5 top-3.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Sort Actions */}
                            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                                <button
                                    onClick={() => toggleSort("seq")}
                                    className={`hh-press hh-focusable px-4 py-2 rounded-[var(--hh-radius-md)] text-xs font-bold flex items-center gap-1.5 border ${
                                        sortBy === "seq"
                                            ? ""
                                            : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)] border-[var(--hh-border)]"
                                    }`}
                                    style={
                                        sortBy === "seq"
                                            ? {
                                                  background: `${currentTheme.from}15`,
                                                  borderColor: `${currentTheme.from}30`,
                                                  color: iconColor
                                              }
                                            : undefined
                                    }
                                >
                                    {t("page.soundtrack.filters.sortBySeq")}
                                    {sortBy === "seq" && (
                                        <span className="text-[10px]">
                                            {sortOrder === "asc" ? "▲" : "▼"}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => toggleSort("title")}
                                    className={`hh-press hh-focusable px-4 py-2 rounded-[var(--hh-radius-md)] text-xs font-bold flex items-center gap-1.5 border ${
                                        sortBy === "title"
                                            ? ""
                                            : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)] border-[var(--hh-border)]"
                                    }`}
                                    style={
                                        sortBy === "title"
                                            ? {
                                                  background: `${currentTheme.from}15`,
                                                  borderColor: `${currentTheme.from}30`,
                                                  color: iconColor
                                              }
                                            : undefined
                                    }
                                >
                                    {t("page.soundtrack.filters.sortByTitle")}
                                    {sortBy === "title" && (
                                        <span className="text-[10px]">
                                            {sortOrder === "asc" ? "▲" : "▼"}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Playlist Box */}
                        <div className="hh-well relative rounded-[var(--hh-radius-xl)] overflow-hidden flex-1 flex flex-col min-h-[420px] max-h-[560px]">
                            
                            {/* Inner Scroll container with custom light/dark adaptive thin scrollbar */}
                            <div className="overflow-y-auto flex-1 p-3 custom-playlist-scrollbar" onScroll={handlePlaylistScroll}>
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-80 gap-3">
                                        <div className="loading-spinner loading-spinner-sm" />
                                        <p className="text-[var(--hh-text-secondary)] text-xs">{t("page.soundtrack.states.loading")}</p>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center h-80 text-center p-6 border-2 border-dashed border-[var(--hh-accent-alert)]/40 rounded-[var(--hh-radius-lg)] m-3">
                                        <svg className="w-10 h-10 text-[var(--hh-accent-alert)] mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                        </svg>
                                        <p className="text-[var(--hh-accent-alert)] font-bold text-sm">{t("page.soundtrack.states.loadFailedTitle")}</p>
                                        <p className="text-[var(--hh-text-tertiary)] text-xs mt-1">{error}</p>
                                    </div>
                                ) : filteredTracks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-80 text-center p-6 border-2 border-dashed border-[var(--hh-border)] rounded-[var(--hh-radius-lg)] m-3">
                                        <svg className="w-10 h-10 text-[var(--hh-text-tertiary)] mb-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <circle cx="10" cy="18" r="3" />
                                            <path d="M13 18V5l7-1.5v10" />
                                            <circle cx="20" cy="14" r="2" />
                                            <path d="M3 5h5" />
                                            <path d="M3 9h3" />
                                        </svg>
                                        <p className="text-[var(--hh-text-primary)] font-bold text-sm">{t("page.soundtrack.states.noResultsTitle")}</p>
                                        <p className="text-[var(--hh-text-tertiary)] text-xs mt-1">{t("page.soundtrack.states.noResultsDescription")}</p>
                                    </div>
                                ) : (
                                    /* Rows are separated by hairlines rather than gaps and shadows:
                                       a few hundred individually elevated rows is both visually
                                       noisy and expensive to composite while scrolling. */
                                    <div className="flex flex-col rounded-[var(--hh-radius-lg)] overflow-hidden border border-[var(--hh-border-hairline)] bg-[var(--hh-surface-2)]">
                                        {displayedTracks.map((track, trackIndex) => {
                                            const isActive = currentTrack?.id === track.id;
                                            const trackTheme = CATEGORY_THEMES[track.musicSoundTrackCategoryId] ?? DEFAULT_THEME;
                                            const trackTextColor = getCategoryTextColor(track.musicSoundTrackCategoryId, isDark);
                                            
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => handleTrackSelect(track)}
                                                    className={`group w-full flex items-center justify-between p-3.5 text-left transition-colors ${
                                                        trackIndex > 0 ? "border-t border-[var(--hh-border-hairline)]" : ""
                                                    } ${
                                                        isActive
                                                            ? "bg-[var(--hh-accent-wash)]"
                                                            : "hover:bg-[var(--hh-surface-3)]"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                        {/* Play Index or Active equalizer indicator */}
                                                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                                                            {isActive && isPlaying ? (
                                                                // Miniature EQ Wave
                                                                <div className="flex items-end gap-0.5 h-3">
                                                                    <div className="w-0.75 h-2 animate-pulse rounded-sm" style={{ backgroundColor: trackTheme.from, animationDuration: "0.5s" }} />
                                                                    <div className="w-0.75 h-3 animate-pulse rounded-sm" style={{ backgroundColor: trackTheme.from, animationDuration: "0.8s" }} />
                                                                    <div className="w-0.75 h-1 animate-pulse rounded-sm" style={{ backgroundColor: trackTheme.from, animationDuration: "0.3s" }} />
                                                                </div>
                                                            ) : (
                                                                /* Track numbers are tabular so the index column stays
                                                                   a straight edge down a few hundred rows. */
                                                                <span
                                                                    className="hh-numeric font-mono text-xs font-bold"
                                                                    style={{ color: isActive ? trackTextColor : "var(--hh-text-secondary)" }}
                                                                >
                                                                    {track.seq.toString().padStart(3, "0")}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Cover thumbnail */}
                                                        <div className="relative w-10 h-10 rounded-[var(--hh-radius-sm)] overflow-hidden flex-shrink-0 border border-[var(--hh-border)]">
                                                            <Image
                                                                src={(() => {
                                                                    const jacketName = categoryMap.get(track.musicSoundTrackCategoryId)?.assetbundleName ?? "jacket_s_soundtrack_1";
                                                                    return getMysekaiRawAssetUrl(
                                                                        `music_record_soundtrack/jacket/${jacketName}/${jacketName}.webp`,
                                                                        assetSource
                                                                    );
                                                                })()}
                                                                alt={track.title}
                                                                fill
                                                                className="object-cover"
                                                                sizes="40px"
                                                                loading="lazy"
                                                                unoptimized
                                                            />
                                                            {/* Hover play affordance. White-on-dark is correct here:
                                                                the scrim sits over arbitrary jacket artwork. */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                 <svg className="w-4 h-4 text-white fill-white" viewBox="0 0 24 24">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        {/* Titles */}
                                                        <div className="min-w-0 flex-1">
                                                            <h5
                                                                className="text-sm font-bold truncate transition-colors"
                                                                style={{ color: isActive ? trackTextColor : "var(--hh-text-primary)" }}
                                                            >
                                                                {getDisplayTrackTitle(track, t)}
                                                            </h5>
                                                            <p className="text-[var(--hh-text-tertiary)] text-[10px] truncate mt-0.5 font-sans font-medium">
                                                                {track.pronunciation}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Right info: category tag, spoiler badge, duration, and action hint */}
                                                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-[var(--hh-radius-xs)] text-[9px] font-bold border bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border-[var(--hh-border)] max-w-[80px] truncate">
                                                            {categoryMap.get(track.musicSoundTrackCategoryId)?.name || "BGM"}
                                                        </span>
                                                        {track.isSpoiler && (
                                                            <span className="px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[9px] font-bold bg-orange-500 text-white">
                                                                {t("common.badge.spoiler")}
                                                            </span>
                                                        )}
                                                        {track.durationSeconds !== undefined && (
                                                            <span className="hh-numeric hidden sm:inline-block px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[9px] font-mono font-bold bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border border-[var(--hh-border)]">
                                                                {formatTime(track.durationSeconds)}
                                                            </span>
                                                        )}
                                                        
                                                        {/* Simple chevron indicating interactive row */}
                                                        <svg className={`w-4 h-4 transition-transform ${isActive ? "text-[var(--hh-text-primary)]" : "text-[var(--hh-text-tertiary)] group-hover:text-[var(--hh-text-secondary)] group-hover:translate-x-0.5"}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        {hasMoreTracks && (
                                            <div className="flex justify-center py-3 border-t border-[var(--hh-border-hairline)]">
                                                <button
                                                    type="button"
                                                    onClick={() => setVisibleTrackLimit(limit => Math.min(limit + SOUNDTRACK_LIST_BATCH_SIZE, filteredTracks.length))}
                                                    className="hh-numeric hh-press hh-focusable rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] px-4 py-1.5 text-[10px] font-bold text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)]"
                                                >
                                                    {formatNumber(Math.min(visibleTrackLimit, filteredTracks.length))} / {formatNumber(filteredTracks.length)}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Playlist footer statistics */}
                            <div className="hh-label bg-[var(--hh-surface-1)] border-t border-[var(--hh-border)] py-3 px-6 text-center">
                                {t("page.soundtrack.footer", {
                                    shown: formatNumber(filteredTracks.length),
                                    total: formatNumber(tracks.length),
                                    category: selectedCategoryLabel,
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SoundtrackClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={
                <div className="flex h-[80vh] w-full items-center justify-center bg-[var(--hh-surface-0)] text-[var(--hh-text-secondary)] select-none">
                    <div className="flex flex-col items-center gap-3">
                        <div className="loading-spinner loading-spinner-sm" />
                        <p className="text-xs">{t("page.soundtrack.states.suspenseLoading")}</p>
                    </div>
                </div>
            }>
                <SoundtrackContent />
            </Suspense>
        </MainLayout>
    );
}
