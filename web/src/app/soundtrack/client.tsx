"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
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
}

type PlaybackMode = "sequential" | "loop-one" | "shuffle";

const PLAYBACK_MODES = ["sequential", "loop-one", "shuffle"] as const satisfies readonly PlaybackMode[];

function isPlaybackMode(value: string | null): value is PlaybackMode {
    return PLAYBACK_MODES.includes(value as PlaybackMode);
}

function clampVolume(value: number) {
    if (!Number.isFinite(value)) return 0.5;
    return Math.min(1, Math.max(0, value));
}

const SOUNDTRACK_AUDIO_CACHE_NAME = "soundtrack-audio-v1";

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

// Color schemes matching each category group
const CATEGORY_THEMES: Record<number, { from: string; to: string; shadow: string; bgGlow: string; text: string }> = {
    1: { from: "#00E5CF", to: "#007D85", shadow: "shadow-cyan-500/20", bgGlow: "from-cyan-950/20 to-teal-950/20", text: "text-miku" }, // Unit overview
    2: { from: "#FF45A4", to: "#7D1BFF", shadow: "shadow-fuchsia-500/20", bgGlow: "from-fuchsia-950/20 to-purple-950/20", text: "text-fuchsia-400" }, // Virtual Singer
    3: { from: "#33A2FF", to: "#102E7A", shadow: "shadow-blue-500/20", bgGlow: "from-blue-950/20 to-indigo-950/20", text: "text-blue-400" }, // Leo/need
    4: { from: "#52FF45", to: "#EBE81B", shadow: "shadow-green-500/20", bgGlow: "from-emerald-950/20 to-lime-950/20", text: "text-green-400" }, // MORE MORE JUMP!
    5: { from: "#FF6E1A", to: "#A60E0E", shadow: "shadow-orange-500/20", bgGlow: "from-orange-950/20 to-red-950/20", text: "text-orange-400" }, // Vivid BAD SQUAD
    6: { from: "#FFDF00", to: "#FF5E00", shadow: "shadow-yellow-500/20", bgGlow: "from-yellow-950/20 to-amber-950/20", text: "text-yellow-400" }, // Wonderlands x Showtime
    7: { from: "#C655FF", to: "#1F0F3D", shadow: "shadow-purple-500/20", bgGlow: "from-purple-950/20 to-slate-950/20", text: "text-purple-400" }, // Nightcord
    11: { from: "#00E5CF", to: "#007D85", shadow: "shadow-teal-500/20", bgGlow: "from-teal-950/20 to-cyan-950/20", text: "text-miku" }, // In-game
    12: { from: "#00CCBB", to: "#006655", shadow: "shadow-cyan-500/20", bgGlow: "from-emerald-950/25 to-teal-950/25", text: "text-teal-400" }, // Mysekai
    13: { from: "#94A3B8", to: "#334155", shadow: "shadow-slate-500/10", bgGlow: "from-slate-950/20 to-slate-900/20", text: "text-slate-400" }, // Scenario
    14: { from: "#38BDF8", to: "#0369A1", shadow: "shadow-sky-500/20", bgGlow: "from-sky-950/20 to-blue-950/20", text: "text-sky-400" }, // Live
    15: { from: "#F43F5E", to: "#9F1239", shadow: "shadow-rose-500/20", bgGlow: "from-rose-950/20 to-pink-950/20", text: "text-rose-400" }, // Virtual Live
    16: { from: "#F59E0B", to: "#B45309", shadow: "shadow-amber-500/20", bgGlow: "from-amber-950/20 to-yellow-950/20", text: "text-amber-400" }, // Gacha
    20: { from: "#64748B", to: "#1E293B", shadow: "shadow-slate-500/10", bgGlow: "from-slate-950/20 to-zinc-950/20", text: "text-slate-400" }, // Other
    30: { from: "#EC4899", to: "#BE185D", shadow: "shadow-pink-500/20", bgGlow: "from-pink-950/20 to-rose-950/20", text: "text-pink-400" }, // Collaboration
};

const DEFAULT_THEME = { from: "#00CCBB", to: "#1E293B", shadow: "shadow-slate-500/10", bgGlow: "from-slate-950/20 to-zinc-950/20", text: "text-slate-400" };

function SoundtrackContent() {
    const { t, formatNumber } = useI18n();
    const { assetSource, resolvedColorScheme } = useTheme();
    const isDark = resolvedColorScheme === "dark";
    const searchParams = useSearchParams();

    // Data states
    const [tracks, setTracks] = useState<MysekaiMusicSoundTrackMaster[]>([]);
    const [categories, setCategories] = useState<MysekaiMusicSoundTrackCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Audio Ref
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playRequestIdRef = useRef(0);

    // Audio states
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<MysekaiMusicSoundTrackMaster | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("sequential");
    const [showVolumePopup, setShowVolumePopup] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadHint, setDownloadHint] = useState<string | null>(null);

    // Filter & Search states
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"seq" | "title">("seq");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
                const [tracksData, categoriesData] = await Promise.all([
                    fetchMasterData<MysekaiMusicSoundTrackMaster[]>("musicSoundTracks.json"),
                    fetchMasterData<MysekaiMusicSoundTrackCategory[]>("musicSoundTrackCategories.json"),
                ]);

                if (cancelled) return;

                // Sort categories and tracks initially
                const sortedCategories = [...categoriesData].sort((a, b) => a.id - b.id);
                setCategories(sortedCategories);

                const sortedTracks = [...tracksData].sort((a, b) => a.seq - b.seq);
                setTracks(sortedTracks);

                // Set default track on first load, or restore from sessionStorage
                const savedTrackIdStr = sessionStorage.getItem("soundtrack-current-track-id");
                if (savedTrackIdStr) {
                    const savedTrackId = parseInt(savedTrackIdStr, 10);
                    const matchedTrack = sortedTracks.find(t => t.id === savedTrackId);
                    if (matchedTrack) {
                        setCurrentTrack(matchedTrack);
                    } else if (sortedTracks.length > 0) {
                        setCurrentTrack(sortedTracks[0]);
                    }
                } else if (sortedTracks.length > 0) {
                    setCurrentTrack(sortedTracks[0]);
                }

                // Restore filters from searchParams
                const urlCat = searchParams.get("category");
                if (urlCat) {
                    const parsedCat = parseInt(urlCat, 10);
                    if (!Number.isNaN(parsedCat) && sortedCategories.some(c => c.id === parsedCat)) {
                        setSelectedCategoryId(parsedCat);
                    } else {
                        setSelectedCategoryId(null);
                    }
                } else {
                    setSelectedCategoryId(null);
                }

                setSearchQuery(searchParams.get("search") ?? "");
                setSortBy(searchParams.get("sort") === "title" ? "title" : "seq");
                setSortOrder(searchParams.get("order") === "desc" ? "desc" : "asc");

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
    }, [searchParams, t]);

    // Generate stable animation heights and durations for the visualizer to prevent twitching & excessive renders
    const visualizerHeights = useMemo(() => {
        return Array.from({ length: 14 }).map(() => {
            const h1 = Math.random() * 28 + 6;
            const h2 = Math.random() * 12 + 6;
            const h3 = Math.random() * 32 + 8;
            return [8, h1, h2, h3, 8];
        });
    }, []);

    const visualizerDurations = useMemo(() => {
        return Array.from({ length: 14 }).map(() => Math.random() * 0.7 + 0.5);
    }, []);

    // Track audio source URL (correctly resolving Mysekai paths too)
    const audioUrl = useMemo(() => {
        if (!currentTrack) return "";
        return getMysekaiSoundTrackAudioUrl(currentTrack.assetbundleName, currentTrack.assetbundleFileName, assetSource) || "";
    }, [currentTrack, assetSource]);

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
    }, [audioUrl]);

    // Explicitly swap the single audio element source so old tracks are stopped before a new one loads.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        playRequestIdRef.current += 1;
        audio.pause();
        setCurrentTime(0);
        setDuration(0);
        setAudioError(null);

        if (!audioUrl) {
            audio.removeAttribute("src");
            audio.load();
            setIsPlaying(false);
            return;
        }

        if (audio.src !== audioUrl) {
            audio.src = audioUrl;
        }
        audio.currentTime = 0;
        audio.load();

        return () => {
            playRequestIdRef.current += 1;
            audio.pause();
        };
    }, [audioUrl]);

    // Declaratively control audio playback and ignore stale play() promises from rapid track switches.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (!audioUrl || !isPlaying) {
            playRequestIdRef.current += 1;
            audio.pause();
            return;
        }

        const requestId = playRequestIdRef.current + 1;
        playRequestIdRef.current = requestId;

        audio.play()
            .then(() => {
                if (playRequestIdRef.current === requestId) {
                    setAudioError(null);
                }
            })
            .catch(err => {
                if (playRequestIdRef.current !== requestId) return;

                const isAbort = err instanceof DOMException && err.name === "AbortError";
                if (isAbort) return;

                console.warn("Audio play prevented or errored:", err);
                setIsPlaying(false);
                setAudioError(t("page.soundtrack.errors.audioPlayFailed"));
            });
    }, [isPlaying, audioUrl, t]);

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

    // Filtered and Sorted Tracks
    const filteredTracks = useMemo(() => {
        let result = [...tracks];

        // 1. Filter by category
        if (selectedCategoryId !== null) {
            result = result.filter(t => t.musicSoundTrackCategoryId === selectedCategoryId);
        }

        // 2. Filter by search query (fuzzy search title or pronunciation)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(t => 
                t.title.toLowerCase().includes(query) || 
                t.pronunciation.toLowerCase().includes(query)
            );
        }

        // 3. Sort
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
    }, [tracks, selectedCategoryId, searchQuery, sortBy, sortOrder]);

    // Sync states to URL query parameters
    const handleFilterChange = (catId: number | null, search: string, sort: "seq" | "title", order: "asc" | "desc") => {
        const url = new URL(window.location.href);
        
        if (catId !== null) url.searchParams.set("category", catId.toString());
        else url.searchParams.delete("category");

        if (search) url.searchParams.set("search", search);
        else url.searchParams.delete("search");

        if (sort !== "seq") url.searchParams.set("sort", sort);
        else url.searchParams.delete("sort");

        if (order !== "asc") url.searchParams.set("order", order);
        else url.searchParams.delete("order");

        window.history.replaceState({}, "", url.toString());
    };

    // Update active category
    const selectCategory = (catId: number | null) => {
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
    const currentTheme = useMemo(() => {
        if (!currentTrack) return DEFAULT_THEME;
        return CATEGORY_THEMES[currentTrack.musicSoundTrackCategoryId] ?? DEFAULT_THEME;
    }, [currentTrack]);

    // High contrast adaptive icon color
    const iconColor = useMemo(() => {
        if (isDark) return currentTheme.from;
        // Special accessibility color fallbacks for ultra-bright categories in light mode
        if (currentTrack?.musicSoundTrackCategoryId === 4) return "#15803d"; // Deep emerald green
        if (currentTrack?.musicSoundTrackCategoryId === 6) return "#c2410c"; // Deep sunset orange
        return currentTheme.to;
    }, [isDark, currentTheme, currentTrack]);

    // Audio handlers
    const togglePlay = () => {
        if (!audioUrl) return;
        setIsPlaying(prev => !prev);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const nextTime = audioRef.current.currentTime;
            setCurrentTime(Number.isFinite(nextTime) ? nextTime : 0);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const nextDuration = audioRef.current.duration;
            setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (audioRef.current && Number.isFinite(val)) {
            audioRef.current.currentTime = val;
            setCurrentTime(val);
        }
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

    const getPlaybackList = () => filteredTracks.length > 0 ? filteredTracks : tracks;

    const pickRandomTrack = (activeList: MysekaiMusicSoundTrackMaster[]) => {
        if (activeList.length <= 1 || !currentTrack) return activeList[0];

        const candidates = activeList.filter(track => track.id !== currentTrack.id);
        return candidates[Math.floor(Math.random() * candidates.length)] ?? activeList[0];
    };

    // Audio navigation methods
    const playNext = () => {
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

        setCurrentTrack(nextTrack);
        setIsPlaying(true);
    };

    const playPrevious = () => {
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

        setCurrentTrack(prevTrack);
        setIsPlaying(true);
    };

    const handleEnded = () => {
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
            playNext();
        }
    };

    const handleTrackSelect = (track: MysekaiMusicSoundTrackMaster) => {
        setCurrentTrack(track);
        setIsPlaying(true);
    };

    const handleDownloadCurrentTrack = async () => {
        if (!currentTrack || !audioUrl || isDownloading) return;

        const fileName = getTrackDownloadFileName(currentTrack);
        setIsDownloading(true);
        setDownloadHint(null);

        try {
            const cachedBlob = await readAudioBlobFromCache(audioUrl);
            if (cachedBlob) {
                triggerBlobDownload(cachedBlob, fileName);
                setDownloadHint(t("page.soundtrack.download.cachedHint"));
                return;
            }

            const response = await fetch(audioUrl, { cache: "force-cache" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            if (blob.size === 0) {
                throw new Error("EMPTY_AUDIO_BLOB");
            }

            await storeAudioBlobInCache(audioUrl, blob);
            triggerBlobDownload(blob, fileName);
            setDownloadHint(t("page.soundtrack.download.cachedAndStartedHint"));
        } catch (err) {
            console.warn("Soundtrack download fallback to direct link:", err);
            triggerDirectDownload(audioUrl, fileName);
            setDownloadHint(t("page.soundtrack.download.directHint"));
        } finally {
            setIsDownloading(false);
        }
    };

    // Format seconds into MM:SS
    const formatTime = (time: number) => {
        if (!Number.isFinite(time)) return "00:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Calculate dynamic ambient background colors based on current track category
    const ambientBgGlow = useMemo(() => {
        const rawGlow = currentTheme.bgGlow;
        if (isDark) return rawGlow;
        // Replace -950/20 or -900/20 with -200/25 or -200/25 for beautiful light ambient glow
        return rawGlow.replace(/-950/g, "-200").replace(/-900/g, "-200");
    }, [currentTheme, isDark]);

    return (
        <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white select-none transition-colors duration-1000">
            {/* Embedded styles for spinning CD animations to ensure smooth pause/resumes */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin-cd {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-cd-spin {
                    animation: spin-cd 20s linear infinite;
                }
                .play-state-paused {
                    animation-play-state: paused;
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

                /* Soundtrack-specific overrides to bypass global !important rules */
                .soundtrack-bg-container {
                    background-color: ${isDark ? '#08111b' : '#f8fafc'} !important;
                }
                .soundtrack-card-bg {
                    background-color: ${isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.7)'} !important;
                }
                .soundtrack-panel-bg {
                    background-color: ${isDark ? 'rgba(8, 17, 27, 0.8)' : 'rgba(241, 245, 249, 0.5)'} !important;
                }
                .soundtrack-cat-active {
                    background-color: ${isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)'} !important;
                }
                .soundtrack-cat-inactive {
                    background-color: ${isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)'} !important;
                }
                .soundtrack-input-bg {
                    background-color: ${isDark ? 'rgba(8, 17, 27, 0.8)' : '#f1f5f9'} !important;
                }
                .soundtrack-btn-inactive {
                    background-color: ${isDark ? 'rgba(8, 17, 27, 0.6)' : '#f1f5f9'} !important;
                }
                .soundtrack-playlist-bg {
                    background-color: ${isDark ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.5)'} !important;
                }
                .soundtrack-row-active {
                    background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)'} !important;
                }
                .soundtrack-row-inactive {
                    background-color: ${isDark ? 'rgba(15, 23, 42, 0.1)' : 'rgba(248, 250, 252, 0.5)'} !important;
                }
                .soundtrack-footer-bg {
                    background-color: ${isDark ? '#08111b' : '#f1f5f9'} !important;
                }
            `}} />

            {/* Hidden HTML5 Audio Element */}
            <audio
                ref={audioRef}
                preload="metadata"
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

            {/* Ambient Lighting Layers */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${ambientBgGlow} opacity-70 filter blur-3xl pointer-events-none transition-all duration-1000`} />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-miku/10 filter blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 filter blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 sm:px-6 py-8 relative z-10 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-slate-200 dark:border-white/5 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 border border-miku/30 bg-miku/10 rounded-full mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-miku animate-pulse" />
                            <span className="text-miku text-[10px] font-bold tracking-widest uppercase">{t("page.soundtrack.badge")}</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-white">
                            {t("page.soundtrack.title")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-miku to-cyan-400">{t("page.soundtrack.titleHighlight")}</span>
                        </h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md md:text-right hidden sm:block">
                        {t("page.soundtrack.description")}
                    </p>
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Premium Music Player (Glass Card) */}
                    <div className="lg:col-span-5 w-full">
                        <div className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-white/10 p-6 sm:p-8 shadow-xl dark:shadow-2xl transition-all duration-1000">
                            
                            {/* Accent Glow Overlay */}
                            <div 
                                className="absolute top-0 inset-x-0 h-[2px] opacity-60" 
                                style={{ background: `linear-gradient(to right, transparent, ${currentTheme.from}, transparent)` }}
                            />

                            {/* Album Art - Rotating CD */}
                            <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto mb-8 flex items-center justify-center">
                                {/* CD Case Shadow */}
                                <div className="absolute inset-0 bg-black/20 dark:bg-black/40 rounded-full filter blur-xl scale-95 pointer-events-none" />

                                {/* Vinyl Track Body */}
                                <div className="relative w-full h-full rounded-full bg-neutral-950 p-[6px] border border-slate-800 shadow-inner flex items-center justify-center select-none">
                                    {/* Concentric Grooves */}
                                    <div className="absolute inset-2 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-6 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-12 rounded-full border border-neutral-900/60 pointer-events-none" />
                                    <div className="absolute inset-20 rounded-full border border-neutral-900/60 pointer-events-none" />

                                    {/* Light Reflection highlights */}
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-60 mix-blend-overlay pointer-events-none z-10" />
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-bl from-white/0 via-white/5 to-white/0 opacity-60 mix-blend-overlay pointer-events-none z-10" />

                                    {/* Center spinning core */}
                                    <div className={`relative w-4/5 h-4/5 rounded-full overflow-hidden bg-neutral-900 flex items-center justify-center animate-cd-spin ${isPlaying ? "" : "play-state-paused"}`}>
                                        
                                        {/* Center Jacket Image */}
                                        {currentTrack && (
                                            <div className="relative w-full h-full">
                                                <Image
                                                    src={getMysekaiRawAssetUrl(
                                                        `music_record_soundtrack/jacket/${categoryMap.get(currentTrack.musicSoundTrackCategoryId)?.assetbundleName ?? "jacket_s_soundtrack_1"}.webp`,
                                                        assetSource
                                                    )}
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
                                        <div className="absolute w-12 h-12 rounded-full bg-neutral-950 border-4 border-neutral-800/80 shadow-md flex items-center justify-center z-20">
                                            <div className="w-4 h-4 rounded-full bg-slate-950 shadow-inner" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Visualizer Bars (Equalizer) */}
                            <div className="h-8 flex items-end justify-center gap-1.5 mb-6 overflow-hidden">
                                {Array.from({ length: 14 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1 rounded-full"
                                        style={{
                                            background: `linear-gradient(to top, ${currentTheme.from}, ${currentTheme.to})`,
                                            boxShadow: `0 0 8px ${currentTheme.from}40`
                                        }}
                                        animate={{
                                            height: isPlaying ? visualizerHeights[i] : 4
                                        }}
                                        transition={{
                                            repeat: isPlaying ? Infinity : 0,
                                            duration: isPlaying ? visualizerDurations[i] : 0.2,
                                            ease: "easeInOut"
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Song Meta Info */}
                            <div className="text-center mb-6 px-2">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentTrack?.id || "empty"}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <h3 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white truncate max-w-full">
                                            {currentTrack?.title || t("page.soundtrack.emptyTrack")}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 truncate">
                                            {currentTrack?.pronunciation || t("page.soundtrack.pronunciationLoading")}
                                        </p>
                                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                            <div className="px-3 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                {currentTrack ? (categoryMap.get(currentTrack.musicSoundTrackCategoryId)?.name || "BGM") : "..."}
                                            </div>
                                            <button
                                                onClick={handleDownloadCurrentTrack}
                                                disabled={!currentTrack || !audioUrl || isDownloading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-500 dark:text-slate-300 transition-all hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {audioError && (
                                <div className="mb-4 rounded-xl border border-rose-300/60 bg-rose-50/80 px-3 py-2 text-center text-xs font-medium text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                                    {audioError}
                                </div>
                            )}
                            {downloadHint && !audioError && (
                                <div className="mb-4 rounded-xl border border-miku/30 bg-miku/10 px-3 py-2 text-center text-xs font-medium text-teal-700 dark:text-miku">
                                    {downloadHint}
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
                                    className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-miku hover:h-1.5 transition-all outline-none custom-slider-thumb"
                                    style={{
                                        background: `linear-gradient(to right, ${currentTheme.from} 0%, ${currentTheme.from} ${(currentTime / (duration || 1)) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} ${(currentTime / (duration || 1)) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 100%)`
                                    }}
                                />
                                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-2">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Player Controls */}
                            <div className="flex items-center justify-between gap-2 max-w-sm mx-auto mb-6 px-4">
                                
                                {/* Playback Mode (Cycle Button) */}
                                <button
                                    onClick={cyclePlaybackMode}
                                    className={`p-2.5 rounded-full transition-all duration-300 border active:scale-95 ${
                                        playbackMode === "sequential"
                                            ? "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border-transparent"
                                            : ""
                                    }`}
                                    style={
                                        playbackMode !== "sequential"
                                            ? {
                                                  background: `${currentTheme.from}18`,
                                                  borderColor: `${currentTheme.from}40`,
                                                  color: iconColor,
                                                  boxShadow: `0 4px 12px ${currentTheme.from}15`
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
                                        className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all active:scale-95 border border-transparent"
                                        title={t("page.soundtrack.controls.previous")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <polygon points="19 20 9 12 19 4 19 20"/>
                                            <line x1="5" y1="19" x2="5" y2="5"/>
                                        </svg>
                                    </button>

                                    {/* Play / Pause */}
                                    <button
                                        onClick={togglePlay}
                                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold hover:scale-105 transition-all active:scale-95 flex-shrink-0 border"
                                        style={{
                                            background: isDark 
                                                ? `linear-gradient(135deg, ${currentTheme.from}22, ${currentTheme.to}12)`
                                                : `linear-gradient(135deg, ${currentTheme.from}15, ${currentTheme.to}0a)`,
                                            borderColor: `${currentTheme.from}40`,
                                            boxShadow: isDark
                                                ? `0 8px 24px ${currentTheme.from}15, inset 0 1px 0 rgba(255,255,255,0.05)`
                                                : `0 8px 24px ${currentTheme.from}10, inset 0 1px 0 rgba(255,255,255,0.4)`
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
                                        className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all active:scale-95 border border-transparent"
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
                                            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-xl flex flex-col items-center gap-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
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
                                                <div className="h-24 w-1.5 bg-slate-200 dark:bg-white/10 rounded-full relative overflow-hidden flex items-end pointer-events-none">
                                                    <div
                                                        className="w-full rounded-full transition-all duration-75"
                                                        style={{
                                                            height: `${volume * 100}%`,
                                                            background: currentTheme.from,
                                                            boxShadow: `0 0 8px ${currentTheme.from}60`
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
                                        className="p-2.5 rounded-full transition-all duration-300 border border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 active:scale-95"
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
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4 text-miku" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                                    className={`relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden border transition-all text-left flex flex-col justify-between p-2.5 ${
                                        selectedCategoryId === null
                                            ? "border-miku bg-miku/10 shadow-lg shadow-miku/5"
                                            : "border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-white/20 hover:scale-[1.02]"
                                    }`}
                                >
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">ALL</span>
                                    <span className={`text-xs font-bold ${selectedCategoryId === null ? "text-miku" : "text-slate-800 dark:text-white"}`}>{t("page.soundtrack.allCategory")}</span>
                                </button>

                                {/* List of Categories */}
                                {categories.map(cat => {
                                    const active = selectedCategoryId === cat.id;
                                    const theme = CATEGORY_THEMES[cat.id] ?? DEFAULT_THEME;
                                    
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => selectCategory(cat.id)}
                                            className={`relative flex-shrink-0 w-32 h-16 rounded-xl overflow-hidden border transition-all text-left flex flex-col justify-between p-2.5 group ${
                                                active
                                                    ? "bg-white/90 dark:bg-slate-900/80 shadow-lg"
                                                    : "border-slate-200 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-white/20 hover:scale-[1.02]"
                                            }`}
                                            style={{
                                                borderColor: active ? theme.from : undefined,
                                                boxShadow: active ? `0 4px 14px ${theme.from}25` : undefined
                                            }}
                                        >
                                            {/* Blurred Image Background */}
                                            <div className="absolute inset-0 opacity-15 dark:opacity-20 filter blur-xs group-hover:scale-105 transition-transform duration-500">
                                                <Image
                                                    src={getMysekaiRawAssetUrl(`music_record_soundtrack/jacket/${cat.assetbundleName}.webp`, assetSource)}
                                                    alt={cat.name}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            </div>

                                            {/* Category Indicator Tag */}
                                            <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                                                CAT #{cat.id}
                                            </span>
                                            
                                            {/* Name */}
                                            <span className={`text-xs font-bold ${active ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-white"} relative z-10 block truncate max-w-full`}>
                                                {cat.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Search and Sort Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-white/5 p-4">
                            
                            {/* Fuzzy Search Box */}
                            <div className="relative w-full sm:w-72">
                                <svg className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    data-shortcut-search="true"
                                    type="text"
                                    placeholder={t("page.soundtrack.filters.searchPlaceholder")}
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-miku/50 focus:ring-1 focus:ring-miku/50 transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearch("")}
                                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
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
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                                        sortBy === "seq"
                                            ? ""
                                            : "bg-slate-100 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-white/5"
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
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                                        sortBy === "title"
                                            ? ""
                                            : "bg-slate-100 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white border-slate-200 dark:border-white/5"
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
                        <div className="relative rounded-3xl bg-white/50 dark:bg-slate-900/20 border border-slate-200 dark:border-white/5 overflow-hidden flex-1 flex flex-col min-h-[420px] max-h-[560px]">
                            
                            {/* Inner Scroll container with custom light/dark adaptive thin scrollbar */}
                            <div className="overflow-y-auto flex-1 p-3 custom-playlist-scrollbar">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-80 gap-3">
                                        <div className="loading-spinner loading-spinner-sm" />
                                        <p className="text-slate-500 dark:text-slate-400 text-xs">{t("page.soundtrack.states.loading")}</p>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center h-80 text-center p-6 border-2 border-dashed border-rose-200 dark:border-rose-500/20 rounded-2xl m-3">
                                        <svg className="w-10 h-10 text-rose-400 dark:text-rose-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                        </svg>
                                        <p className="text-rose-600 dark:text-rose-300 font-bold text-sm">{t("page.soundtrack.states.loadFailedTitle")}</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{error}</p>
                                    </div>
                                ) : filteredTracks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-80 text-center p-6 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl m-3">
                                        <svg className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v1.5a2.25 2.25 0 001.713 2.185l.09.025a.75.75 0 01.05 1.488l-.05.012a2.25 2.25 0 01-1.723 2.2 4.5 4.5 0 00-2.822 2.624L15 13.5M9 9v1.5M9 9H7.5A2.25 2.25 0 005.25 11.25v6.75a2.25 2.25 0 002.25 2.25H9A2.25 2.25 0 0011.25 18v-6.75A2.25 2.25 0 009 9zM15 13.5v1.5m0-1.5H13.5a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25H15a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25z" />
                                        </svg>
                                        <p className="text-slate-700 dark:text-slate-400 font-bold text-sm">{t("page.soundtrack.states.noResultsTitle")}</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{t("page.soundtrack.states.noResultsDescription")}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        {filteredTracks.map((track) => {
                                            const isActive = currentTrack?.id === track.id;
                                            const trackTheme = CATEGORY_THEMES[track.musicSoundTrackCategoryId] ?? DEFAULT_THEME;
                                            
                                            return (
                                                <button
                                                    key={track.id}
                                                    onClick={() => handleTrackSelect(track)}
                                                    className={`group w-full flex items-center justify-between p-3.5 rounded-2xl text-left border transition-all ${
                                                        isActive
                                                            ? "bg-white/80 dark:bg-white/5 border-slate-300 dark:border-white/10 shadow-sm"
                                                            : "bg-slate-50/50 dark:bg-slate-900/10 border-transparent hover:bg-white/60 dark:hover:bg-white/5"
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
                                                                <span className={`font-mono text-xs ${isActive ? trackTheme.text : "text-slate-500"} font-bold`}>
                                                                    {track.seq.toString().padStart(3, "0")}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Cover thumbnail */}
                                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-white/5">
                                                            <Image
                                                                src={getMysekaiRawAssetUrl(
                                                                    `music_record_soundtrack/jacket/${categoryMap.get(track.musicSoundTrackCategoryId)?.assetbundleName ?? "jacket_s_soundtrack_1"}.webp`,
                                                                    assetSource
                                                                )}
                                                                alt={track.title}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                            {/* Hover Play Arrow Overlay */}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                 <svg className="w-4 h-4 text-white fill-white" viewBox="0 0 24 24">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        {/* Titles */}
                                                        <div className="min-w-0 flex-1">
                                                            <h5 className={`text-sm font-bold truncate transition-colors ${isActive ? trackTheme.text : "text-slate-800 dark:text-white group-hover:text-miku"}`}>
                                                                {track.title}
                                                            </h5>
                                                            <p className="text-slate-500 text-[10px] truncate mt-0.5 font-sans font-medium">
                                                                {track.pronunciation}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Right info: category tag & duration placeholder */}
                                                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                                                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 max-w-[80px] truncate">
                                                            {categoryMap.get(track.musicSoundTrackCategoryId)?.name || "BGM"}
                                                        </span>
                                                        
                                                        {/* Simple chevron indicating interactive row */}
                                                        <svg className={`w-4 h-4 transition-transform ${isActive ? "text-slate-800 dark:text-white" : "text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-300 group-hover:translate-x-0.5"}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                                        </svg>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Playlist footer statistics */}
                            <div className="bg-slate-100/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-white/5 py-3 px-6 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {t("page.soundtrack.footer", {
                                    shown: formatNumber(filteredTracks.length),
                                    total: formatNumber(tracks.length),
                                    category: selectedCategoryId !== null
                                        ? categoryMap.get(selectedCategoryId)?.name || t("page.soundtrack.categoryFallback")
                                        : t("page.soundtrack.allCategory"),
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
                <div className="flex h-[80vh] w-full items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 select-none">
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
