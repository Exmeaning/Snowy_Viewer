"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { StorySnippet } from "@/components/story/StorySnippet";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { IProcessedScenarioData, SnippetAction } from "@/types/story";

// How many actions ahead of the active line we preload assets for in autoplay mode.
const PRELOAD_AHEAD = 6;

interface StoryReaderProps {
    scenarioData: IProcessedScenarioData | null;
    isLoading: boolean;
    error: string | null;
    missingPaths?: string[];
    endLabel?: string;
    translationSource?: "official_cn" | "llm" | "human";
    storyType?: "event" | "unit" | "card" | "area" | "self" | "special";
    storyId?: number;
}

export function StoryReader({
    scenarioData,
    isLoading,
    error,
    missingPaths,
    endLabel,
    translationSource,
    storyType,
    storyId,
}: StoryReaderProps) {
    const { useLLMTranslation } = useTheme();
    const { t } = useI18n();

    // Autoplay Player States
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [playbackProgress, setPlaybackProgress] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [isScrollLocked, setIsScrollLocked] = useState(true);

    // Refs to avoid self-triggering the engine effect.
    // The current <audio> for voiced dialogue is held in a ref (not state) so that
    // creating/destroying it does not re-run the playback engine effect.
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Background Immersion States
    const [activeBgUrl, setActiveBgUrl] = useState<string | null>(null);
    const [immersionMode, setImmersionMode] = useState(true);
    // Mirror of activeBgUrl for the background-sync effect to compare without
    // adding activeBgUrl to its dependency array (which would cause a loop).
    const activeBgUrlRef = useRef<string | null>(null);

    // Tracks asset URLs already preloaded during autoplay, to avoid duplicate fetches.
    const preloadedUrlsRef = useRef<Set<string>>(new Set());

    // Extract all backgrounds and their indices
    const bgList = useMemo(() => {
        if (!scenarioData) return [];
        return scenarioData.actions
            .map((act, idx) => {
                if (act.type === SnippetAction.SpecialEffect && act.seType === "ChangeBackground" && act.resource) {
                    return { index: idx, url: act.resource };
                }
                return null;
            })
            .filter(Boolean) as { index: number; url: string }[];
    }, [scenarioData]);

    // Autoplay Core engine
    // NOTE: dependency array intentionally omits `audio`/`activeBgUrl`/`bgList`/
    // `immersionMode`. Those are managed via refs / separate effects so this engine
    // never re-runs because of its own state writes (which previously caused
    // activeIndex to spin to the end of the story).
    useEffect(() => {
        if (!isPlaying || activeIndex < 0 || !scenarioData || activeIndex >= scenarioData.actions.length) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            return;
        }

        const action = scenarioData.actions[activeIndex];

        // 1. Smoothly scroll active dialogue card into viewport center
        if (isScrollLocked) {
            const activeEl = document.getElementById(`snippet-${activeIndex}`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }

        // Helper to advance to the next line with a hard stop at the end.
        const advance = () => {
            setActiveIndex(prev => {
                if (!scenarioData) return prev;
                if (prev >= scenarioData.actions.length - 1) {
                    setIsPlaying(false);
                    setPlaybackProgress(0);
                    return prev;
                }
                setPlaybackProgress(0);
                return prev + 1;
            });
        };

        // 2. Dialogue player trigger
        if (action.type === SnippetAction.Talk) {
            if (action.voice) {
                // Voiced dialogue — hold the Audio in a ref, NOT state, so this
                // effect doesn't re-run when the audio is created.
                const newAudio = new Audio(action.voice);
                newAudio.playbackRate = speed;

                const handleTimeUpdate = () => {
                    if (newAudio.duration) {
                        setPlaybackProgress((newAudio.currentTime / newAudio.duration) * 100);
                    }
                };

                const handleEnded = () => {
                    setPlaybackProgress(100);
                    setTimeout(() => {
                        advance();
                    }, 350 / speed);
                };

                const handleError = () => {
                    setPlaybackProgress(100);
                    setTimeout(() => {
                        advance();
                    }, 500 / speed);
                };

                newAudio.addEventListener("timeupdate", handleTimeUpdate);
                newAudio.addEventListener("ended", handleEnded);
                newAudio.addEventListener("error", handleError);

                audioRef.current = newAudio;
                newAudio.play().catch(() => {
                    // Blocked autoplay browser safety fallback
                    setTimeout(() => {
                        advance();
                    }, 1200 / speed);
                });

                return () => {
                    newAudio.removeEventListener("timeupdate", handleTimeUpdate);
                    newAudio.removeEventListener("ended", handleEnded);
                    newAudio.removeEventListener("error", handleError);
                    newAudio.pause();
                    if (audioRef.current === newAudio) {
                        audioRef.current = null;
                    }
                };
            } else {
                // Non-voiced dialogue (monologues / narration)
                Promise.resolve().then(() => {
                    setPlaybackProgress(0);
                });
                const textLen = action.body?.length || 12;
                const duration = Math.max(1800, textLen * 95) / speed;

                const start = Date.now();
                const timer = setInterval(() => {
                    const elapsed = Date.now() - start;
                    const pct = Math.min(100, (elapsed / duration) * 100);
                    setPlaybackProgress(pct);
                    if (pct >= 100) {
                        clearInterval(timer);
                        advance();
                    }
                }, 50);

                return () => clearInterval(timer);
            }
        } else if (
            action.type === SnippetAction.SpecialEffect &&
            (action.seType === "FullScreenText" || action.seType === "Telop")
        ) {
            // Fullscreen story slides
            Promise.resolve().then(() => {
                setPlaybackProgress(0);
            });
            const textLen = action.body?.length || 15;
            const duration = Math.max(2500, textLen * 110) / speed;

            const start = Date.now();
            const timer = setInterval(() => {
                const elapsed = Date.now() - start;
                const pct = Math.min(100, (elapsed / duration) * 100);
                setPlaybackProgress(pct);
                if (pct >= 100) {
                    clearInterval(timer);
                    advance();
                }
            }, 50);

            return () => clearInterval(timer);
        } else {
            // Skip other BGM change/sound effects immediately
            const timer = setTimeout(() => {
                advance();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isPlaying, activeIndex, speed, scenarioData, isScrollLocked]);

    // Dynamic background sync during autoplay. Kept separate from the engine effect
    // so background changes never interrupt/restart the current line's playback.
    useEffect(() => {
        if (!isPlaying || !immersionMode || bgList.length === 0) return;
        const closestBg = [...bgList].reverse().find(bg => bg.index <= activeIndex);
        if (closestBg && activeBgUrlRef.current !== closestBg.url) {
            activeBgUrlRef.current = closestBg.url;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveBgUrl(closestBg.url);
        }
    }, [isPlaying, activeIndex, immersionMode, bgList]);

    // Preload assets for upcoming lines while autoplay is active, so that voiced
    // dialogue and background changes start without a download stall.
    useEffect(() => {
        if (!isPlaying || !scenarioData || activeIndex < 0) return;
        const actions = scenarioData.actions;
        const end = Math.min(actions.length, activeIndex + 1 + PRELOAD_AHEAD);
        const preloaded = preloadedUrlsRef.current;
        for (let i = activeIndex + 1; i < end; i++) {
            const act = actions[i];
            if (!act) continue;
            if (act.type === SnippetAction.Talk && act.voice && !preloaded.has(act.voice)) {
                preloaded.add(act.voice);
                const a = new Audio();
                a.preload = "auto";
                a.src = act.voice;
                // Some browsers won't fetch without load() when not in the DOM.
                a.load();
            } else if (
                act.type === SnippetAction.SpecialEffect &&
                act.seType === "ChangeBackground" &&
                act.resource &&
                !preloaded.has(act.resource)
            ) {
                preloaded.add(act.resource);
                const img = new Image();
                img.src = act.resource;
            }
        }
    }, [isPlaying, activeIndex, scenarioData]);

    // Manual scroll listener to sync background slides
    useEffect(() => {
        if (isPlaying || !immersionMode || bgList.length === 0) return;

        const handleScroll = () => {
            const viewportMiddle = window.innerHeight / 2;
            let currentBg: string | null = null;

            for (const bg of bgList) {
                const el = document.getElementById(`snippet-${bg.index}`);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top < viewportMiddle) {
                        currentBg = bg.url;
                    }
                }
            }

            if (currentBg && activeBgUrlRef.current !== currentBg) {
                activeBgUrlRef.current = currentBg;
                setActiveBgUrl(currentBg);
            }
        };

        window.addEventListener("scroll", handleScroll);
        handleScroll();

        return () => window.removeEventListener("scroll", handleScroll);
    }, [isPlaying, immersionMode, bgList]);

    // Handle manual player commands
    const togglePlay = () => {
        if (activeIndex === -1) {
            setActiveIndex(0);
        }
        setIsPlaying(prev => !prev);
    };

    const handleStop = () => {
        setIsPlaying(false);
        setActiveIndex(-1);
        setPlaybackProgress(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };

    const handlePrev = () => {
        if (activeIndex > 0) {
            setPlaybackProgress(0);
            setActiveIndex(prev => prev - 1);
        }
    };

    const handleNext = () => {
        if (scenarioData && activeIndex < scenarioData.actions.length - 1) {
            setPlaybackProgress(0);
            setActiveIndex(prev => prev + 1);
        }
    };

    const toggleSpeed = () => {
        const speedOptions = [1, 1.25, 1.5, 2];
        const nextIdx = (speedOptions.indexOf(speed) + 1) % speedOptions.length;
        setSpeed(speedOptions[nextIdx]);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="loading-spinner mb-4" />
                <p className="text-[var(--hh-text-secondary)] font-semibold">{t("page.story.reader.loading")}</p>
            </div>
        );
    }

    if (missingPaths && missingPaths.length > 0) {
        return (
            <div className="hh-panel p-5 text-sm">
                <p className="hh-title text-amber-600 mb-2">{t("page.story.reader.assetMissingTitle")}</p>
                <p className="text-[var(--hh-text-secondary)] mb-3">
                    {t("page.story.reader.assetMissingDescription")}
                </p>
                <ul className="space-y-1">
                    {missingPaths.map((p) => (
                        <li key={p} className="font-mono text-xs bg-[var(--hh-surface-sunken)] px-3 py-1.5 rounded-[var(--hh-radius-sm)] break-all text-[var(--hh-text-primary)]">
                            {p}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (error) {
        return (
            <div className="hh-panel p-4 text-sm">
                <p className="hh-title text-red-500">{t("common.state.loadingFailed")}</p>
                <p className="text-[var(--hh-text-secondary)]">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="hh-btn hh-press mt-3 px-4 py-2 text-xs"
                >
                    {t("common.action.retry")}
                </button>
            </div>
        );
    }

    if (!scenarioData) return null;

    return (
        <div className="max-w-4xl mx-auto relative pb-20">
            {/* Ambient background layer. The blur here is the effect itself — the
                scene art is deliberately defocused so it reads as atmosphere
                behind the dialogue rather than as a competing image, so this
                subtree opts out of the global backdrop/blur flattening. The
                bottom gradient is functional: it fades the art into the page
                surface so dialogue tiles near the bottom keep their contrast. */}
            {activeBgUrl && immersionMode && (
                <div className="hh-allow-blur fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out opacity-20">
                    <img
                        src={activeBgUrl}
                        alt=""
                        className="w-full h-full object-cover blur-md scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--hh-surface-0)]" />
                </div>
            )}

            {/* Top Autoplay Onboarding Header Banner */}
            {activeIndex === -1 && (
                <div className="hh-tile p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in relative z-10">
                    <div>
                        <h3 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)]" />
                            {t("page.story.reader.autoplay")} Mode
                        </h3>
                        <p className="hh-body text-xs text-[var(--hh-text-secondary)] mt-1">
                            {t("page.story.reader.autoplayHint")}
                        </p>
                    </div>
                    <button
                        onClick={togglePlay}
                        className="hh-btn hh-btn-primary hh-press text-sm px-6 py-2.5 shrink-0"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                        {t("page.story.reader.autoplay")}
                    </button>
                </div>
            )}

            {scenarioData.characters.length > 0 && (
                <div className="hh-panel mb-6 p-4 relative z-10">
                    <h3 className="hh-label mb-3">{t("page.story.reader.charactersTitle")}</h3>
                    <div className="flex flex-wrap gap-2">
                        {scenarioData.characters.map((char) => (
                            <span
                                key={char.id}
                                className="hh-chip"
                            >
                                {char.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Dialogue list with IDs to anchor scroll tracking */}
            <div className="space-y-2 relative z-10">
                {scenarioData.actions.map((action, index) => (
                    <div key={index} id={`snippet-${index}`}>
                        <StorySnippet 
                            action={action} 
                            index={index} 
                            activeIndex={activeIndex} 
                            playbackProgress={playbackProgress} 
                        />
                    </div>
                ))}
            </div>

            {scenarioData.actions.length > 0 && (
                <div className="text-center py-10 text-[var(--hh-text-tertiary)] relative z-10">
                    <p>— {endLabel ?? t("page.story.reader.defaultEndLabel")} —</p>
                    {useLLMTranslation && (translationSource === "llm" || translationSource === "human") && (
                        <p className="text-xs mt-2.5 italic">
                            {t("page.story.reader.translationCredit", {
                                source: translationSource === "human"
                                    ? (storyType === "event" && storyId !== undefined && storyId <= 198
                                        ? t("page.story.reader.translationSources.aiPolished")
                                        : t("page.story.reader.translationSources.human"))
                                    : t("page.story.reader.translationSources.ai"),
                            })}
                        </p>
                    )}
                </div>
            )}

            {/* Floating dialogue audio player. It sits over the scrolling story,
                so the surface must be fully opaque — a translucent bar would let
                dialogue text read through the transport controls. */}
            {activeIndex >= 0 && (
                <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-50 animate-fade-in">
                    <div className="hh-float py-3 px-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            {/* Prev */}
                            <button
                                onClick={handlePrev}
                                disabled={activeIndex <= 0}
                                className="hh-press hh-focusable p-2 rounded-[var(--hh-radius-md)] text-[var(--hh-text-secondary)] disabled:opacity-30 disabled:pointer-events-none hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            {/* Play/Pause */}
                            <button
                                onClick={togglePlay}
                                className="hh-press hh-focusable w-10 h-10 bg-[var(--hh-accent)] border border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-md)] flex items-center justify-center shrink-0"
                            >
                                {isPlaying ? (
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                        <rect x="6" y="5" width="4" height="14" rx="1" />
                                        <rect x="14" y="5" width="4" height="14" rx="1" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                                        <path d="M8 5.14v14l11-7-11-7z" />
                                    </svg>
                                )}
                            </button>

                            {/* Next */}
                            <button
                                onClick={handleNext}
                                disabled={activeIndex >= scenarioData.actions.length - 1}
                                className="hh-press hh-focusable p-2 rounded-[var(--hh-radius-md)] text-[var(--hh-text-secondary)] disabled:opacity-30 disabled:pointer-events-none hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Player Metadata & mini-scroller */}
                        <div className="flex-1 min-w-0 text-center px-1">
                            <span className="hh-label">Voicing Playback</span>
                            <div className="hh-numeric text-xs font-bold text-[var(--hh-text-primary)] truncate mt-0.5">
                                Dialogue Line {activeIndex + 1} / {scenarioData.actions.length}
                            </div>
                        </div>

                        {/* Side Player Modifiers */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Speed */}
                            <button
                                onClick={toggleSpeed}
                                className="hh-press hh-focusable hh-numeric px-2 py-1 rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] text-[10px] font-bold text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                title="Playback Speed"
                            >
                                {speed}x
                            </button>

                            {/* Scroll Lock */}
                            <button
                                onClick={() => setIsScrollLocked(prev => !prev)}
                                className={`hh-press hh-focusable p-2 rounded-[var(--hh-radius-md)] border ${
                                    isScrollLocked
                                        ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                                        : "border-transparent text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                }`}
                                title={t("page.story.reader.autoScroll")}
                            >
                                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>

                            {/* Immersion Mode */}
                            <button
                                onClick={() => setImmersionMode(prev => !prev)}
                                className={`hh-press hh-focusable p-2 rounded-[var(--hh-radius-md)] border ${
                                    immersionMode
                                        ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                                        : "border-transparent text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                }`}
                                title={t("page.story.reader.immersionMode")}
                            >
                                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>

                            {/* Close Stop */}
                            <button
                                onClick={handleStop}
                                className="hh-press hh-focusable p-2 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-alert)] hover:bg-[var(--hh-surface-sunken)]"
                                title="Close Player"
                            >
                                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StoryReader;
