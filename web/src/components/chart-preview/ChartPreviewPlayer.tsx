"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import ExternalLink from "@/components/ExternalLink";
import type { HitEvent, PreviewRuntimeConfig, TransportState } from "@/lib/chart-preview/types";
import { AudioTransport } from "@/lib/chart-preview/audioTransport";
import { GlPreviewRenderer } from "@/lib/chart-preview/glRenderer";
import { MmwWasmPreview } from "@/lib/chart-preview/mmwWasm";
import { MmwEffectSystem } from "@/lib/chart-preview/mmwEffectSystem";
import { JudgementEffects } from "@/lib/chart-preview/judgementEffects";
import { JudgementSounds } from "@/lib/chart-preview/judgementSounds";
import { normalizeOffsetMs } from "@/lib/chart-preview/url";

const defaultConfig: PreviewRuntimeConfig = {
    mirror: false,
    flickAnimation: true,
    holdAnimation: true,
    simultaneousLine: true,
    noteSpeed: 10.5,
    holdAlpha: 0.74,
    guideAlpha: 0.5,
    stageOpacity: 1,
    backgroundBrightness: 1,
    effectOpacity: 1,
};

type PreviewState = "init" | "loading" | "ready" | "error";

type WebkitFullscreenDocument = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

const LS_NOTE_SPEED = "chart-preview-note-speed";
const LS_SE_VOLUME = "chart-preview-se-volume";
const LS_BGM_VOLUME = "chart-preview-bgm-volume";
const LS_PLAYBACK_RATE = "chart-preview-playback-rate";
const LS_RENDER_SCALE = "chart-preview-render-scale";

const RENDER_SCALE_OPTIONS = [
    { value: 0.5, label: "50%" },
    { value: 0.75, label: "75%" },
    { value: 1, label: "100%" },
] as const;

function readNumber(key: string, fallback: number): number {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const val = Number(raw);
    return Number.isFinite(val) ? val : fallback;
}

interface ChartPreviewPlayerProps {
    susUrl: string;
    bgmUrl?: string;
    rawOffsetMs?: number | null;
    /** Seconds of filler/silence at the start of the BGM file (from musics.json fillerSec). */
    fillerSec?: number;
    /** If true, skip the leading silence in BGM (default: true when bgmUrl is provided). */
    skipBgmSilence?: boolean;
    onFullscreenChange?: (isFullscreen: boolean) => void;
}

function formatTime(value: number) {
    const safe = Math.max(value, 0);
    const minutes = Math.floor(safe / 60);
    const seconds = Math.floor(safe % 60);
    const milliseconds = Math.floor((safe % 1) * 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export default function ChartPreviewPlayer({
    susUrl,
    bgmUrl,
    rawOffsetMs,
    fillerSec = 0,
    skipBgmSilence = true,
    onFullscreenChange,
}: ChartPreviewPlayerProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const effectsCanvasRef = useRef<HTMLCanvasElement>(null);

    const transportRef = useRef<AudioTransport | null>(null);
    const wasmRef = useRef<MmwWasmPreview | null>(null);
    const rendererRef = useRef<GlPreviewRenderer | null>(null);
    const effectsRef = useRef<MmwEffectSystem | null>(null);
    const judgementEffectsRef = useRef<JudgementEffects | null>(null);
    const judgementSoundsRef = useRef<JudgementSounds | null>(null);
    const rafRef = useRef<number>(0);

    const hitEventsRef = useRef<HitEvent[]>([]);
    const nextHitEventIndexRef = useRef(0);
    const previousTimeSecRef = useRef(0);
    const previousTransportStateRef = useRef<TransportState>("idle");
    const normalizedOffsetMsRef = useRef(0);
    const initialStartSecRef = useRef(0);
    const previewReadyRef = useRef(false);
    const rendererReadyRef = useRef(false);
    const configRef = useRef({ ...defaultConfig, noteSpeed: readNumber(LS_NOTE_SPEED, 10.5) });

    const bgmExpectedRef = useRef(false);
    const bgmLoadedRef = useRef(false);

    const [previewState, setPreviewState] = useState<PreviewState>("init");
    const [statusTitle, setStatusTitle] = useState("正在初始化预览");
    const [statusText, setStatusText] = useState("加载 MMW 资源和 WASM 核心中…");
    const [requiresGesture, setRequiresGesture] = useState(false);
    const [bgmLoading, setBgmLoading] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [noteSpeed, setNoteSpeed] = useState(() => readNumber(LS_NOTE_SPEED, 10.5));
    const [seVolume, setSeVolume] = useState(() => readNumber(LS_SE_VOLUME, 0.8));
    const [bgmVolume, setBgmVolume] = useState(() => readNumber(LS_BGM_VOLUME, 0.8));
    const [playbackRate, setPlaybackRate] = useState(() => readNumber(LS_PLAYBACK_RATE, 1));
    const [lowEffects, setLowEffects] = useState(false);
    const [renderScale, setRenderScale] = useState(() => readNumber(LS_RENDER_SCALE, 1));
    const renderScaleRef = useRef(readNumber(LS_RENDER_SCALE, 1));
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [controlsLocked, setControlsLocked] = useState(false);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const ua = navigator.userAgent;
        setIsIOS(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const syncViewport = () => {
            const vv = window.visualViewport;
            setViewport({
                width: Math.round(vv?.width ?? window.innerWidth),
                height: Math.round(vv?.height ?? window.innerHeight),
            });
        };

        syncViewport();

        const visualViewport = window.visualViewport;
        window.addEventListener("resize", syncViewport);
        window.addEventListener("orientationchange", syncViewport);
        visualViewport?.addEventListener("resize", syncViewport);
        visualViewport?.addEventListener("scroll", syncViewport);

        return () => {
            window.removeEventListener("resize", syncViewport);
            window.removeEventListener("orientationchange", syncViewport);
            visualViewport?.removeEventListener("resize", syncViewport);
            visualViewport?.removeEventListener("scroll", syncViewport);
        };
    }, []);

    // Auto-hide controls in fullscreen: show on interaction, hide after 3s idle
    const resetControlsTimer = useCallback(() => {
        if (controlsLocked) return;
        setControlsVisible(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, [controlsLocked]);

    // When entering/exiting fullscreen, reset controls visibility
    useEffect(() => {
        if (isFullscreen) {
            resetControlsTimer();
        } else {
            setControlsVisible(true);
            setControlsLocked(false);
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        }
        return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
    }, [isFullscreen, resetControlsTimer]);

    // When controls are locked, immediately hide them
    useEffect(() => {
        if (controlsLocked) {
            setControlsVisible(false);
            if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        }
    }, [controlsLocked]);

    const handleControlsLockToggle = useCallback(() => {
        setControlsLocked(prev => {
            if (prev) {
                // Unlocking: show controls and start auto-hide timer
                setControlsVisible(true);
                if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
                controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
            }
            return !prev;
        });
    }, []);

    // Fullscreen toggle — always try Fullscreen API first, fallback to CSS overlay
    const handleFullscreenToggle = useCallback(async () => {
        if (!isFullscreen) {
            const wrapper = wrapperRef.current as WebkitFullscreenElement | null;
            if (!wrapper) return;
            try {
                if (wrapper.requestFullscreen) {
                    await wrapper.requestFullscreen();
                } else if (wrapper.webkitRequestFullscreen) {
                    await wrapper.webkitRequestFullscreen();
                } else {
                    throw new Error("Fullscreen API unavailable");
                }
                // Try to lock orientation to landscape (requires fullscreen on mobile)
                try { await (screen.orientation as ScreenOrientation & { lock(o: string): Promise<void> }).lock("landscape"); } catch { /* unsupported or not allowed */ }
            } catch {
                // Fallback: CSS fixed overlay (pseudo fullscreen)
                setIsNativeFullscreen(false);
                setIsFullscreen(true);
            }
        } else {
            // Unlock orientation before exiting fullscreen
            try { screen.orientation.unlock(); } catch { /* ignore */ }
            if (isNativeFullscreen) {
                const fullscreenDocument = document as WebkitFullscreenDocument;
                try {
                    if (document.fullscreenElement) {
                        await document.exitFullscreen();
                    } else if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) {
                        await fullscreenDocument.webkitExitFullscreen();
                    } else {
                        setIsNativeFullscreen(false);
                        setIsFullscreen(false);
                    }
                } catch {
                    setIsNativeFullscreen(false);
                    setIsFullscreen(false);
                }
            } else {
                setIsNativeFullscreen(false);
                setIsFullscreen(false);
            }
        }
    }, [isFullscreen, isNativeFullscreen]);

    // Web fullscreen (CSS-only, no Fullscreen API) — recommended for iOS
    const handleWebFullscreenToggle = useCallback(() => {
        if (!isFullscreen) {
            setIsNativeFullscreen(false);
            setIsFullscreen(true);
        } else {
            setIsNativeFullscreen(false);
            setIsFullscreen(false);
        }
    }, [isFullscreen]);

    // Sync fullscreen state with browser events and unlock orientation on exit
    useEffect(() => {
        const handleChange = () => {
            const fullscreenDocument = document as WebkitFullscreenDocument;
            const fsElement = document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement;
            const active = !!fsElement && fsElement === wrapperRef.current;
            if (!active) {
                try { screen.orientation.unlock(); } catch { /* ignore */ }
            }
            setIsNativeFullscreen(active);
            setIsFullscreen(active);
        };
        document.addEventListener("fullscreenchange", handleChange);
        document.addEventListener("webkitfullscreenchange", handleChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleChange);
            document.removeEventListener("webkitfullscreenchange", handleChange);
        };
    }, []);

    const isPseudoFullscreen = isFullscreen && !isNativeFullscreen;

    // Lock body scroll during pseudo fullscreen
    useEffect(() => {
        if (!isPseudoFullscreen) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [isPseudoFullscreen]);

    // iOS: block all touch-driven scrolling / rubber-band / swipe-back in pseudo fullscreen
    useEffect(() => {
        if (!isPseudoFullscreen) return;
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // Prevent touchmove on the whole document to kill iOS rubber-band & swipe gestures.
        // We allow touchmove only inside elements that genuinely need scrolling (e.g. range inputs).
        const blockTouchMove = (e: TouchEvent) => {
            const target = e.target as HTMLElement | null;
            // Allow range sliders to work normally
            if (target?.tagName === "INPUT" && (target as HTMLInputElement).type === "range") return;
            e.preventDefault();
        };

        // Prevent pull-to-refresh / overscroll on the wrapper itself
        const blockTouchStart = (e: TouchEvent) => {
            // Single-finger touch: if the wrapper is at scroll boundary, prevent to avoid
            // iOS Safari pull-to-refresh / elastic overscroll.
            if (e.touches.length === 1) {
                const el = wrapper;
                if (el.scrollTop <= 0) el.scrollTop = 1;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight) el.scrollTop = el.scrollHeight - el.clientHeight - 1;
            }
        };

        // { passive: false } is required so preventDefault() actually works on iOS
        document.addEventListener("touchmove", blockTouchMove, { passive: false });
        wrapper.addEventListener("touchstart", blockTouchStart, { passive: true });

        // Also set touch-action: none on body to prevent gesture navigation
        const prevTouchAction = document.body.style.touchAction;
        document.body.style.touchAction = "none";

        return () => {
            document.removeEventListener("touchmove", blockTouchMove);
            wrapper.removeEventListener("touchstart", blockTouchStart);
            document.body.style.touchAction = prevTouchAction;
        };
    }, [isPseudoFullscreen]);

    useEffect(() => {
        onFullscreenChange?.(isFullscreen);
    }, [isFullscreen, onFullscreenChange]);

    useEffect(() => {
        return () => {
            onFullscreenChange?.(false);
        };
    }, [onFullscreenChange]);

    useEffect(() => {
        if (!isPseudoFullscreen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            void handleFullscreenToggle();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleFullscreenToggle, isPseudoFullscreen]);

    const updateUi = useCallback(() => {
        const transport = transportRef.current;
        if (!transport) return;
        const snapshot = transport.getSnapshot();
        setIsPlaying(snapshot.state === "playing");
        setCurrentTime(snapshot.currentTimeSec);
        setDuration(snapshot.durationSec);
        setRequiresGesture(snapshot.requiresGesture);
    }, []);

    // Bootstrap
    useEffect(() => {
        if (!canvasRef.current || !effectsCanvasRef.current || !panelRef.current) return;

        const transport = new AudioTransport();
        const wasm = new MmwWasmPreview();
        const renderer = new GlPreviewRenderer(canvasRef.current);
        const effects = new MmwEffectSystem(effectsCanvasRef.current);
        const judgementEffectsInstance = new JudgementEffects(effectsCanvasRef.current);
        const judgementSoundsInstance = new JudgementSounds();

        transportRef.current = transport;
        wasmRef.current = wasm;
        rendererRef.current = renderer;
        effectsRef.current = effects;
        judgementEffectsRef.current = judgementEffectsInstance;
        judgementSoundsRef.current = judgementSoundsInstance;

        transport.setVolume(readNumber(LS_BGM_VOLUME, 0.8));
        judgementSoundsInstance.setVolume(readNumber(LS_SE_VOLUME, 0.8));
        const savedRate = readNumber(LS_PLAYBACK_RATE, 1);
        if (savedRate !== 1) void transport.setPlaybackRate(savedRate);

        const unsubscribe = transport.subscribe(updateUi);

        const emptyFrame = new Float32Array();

        function lowerBoundHitEvent(timeSec: number) {
            const events = hitEventsRef.current;
            let low = 0;
            let high = events.length;
            while (low < high) {
                const mid = (low + high) >> 1;
                if (events[mid].timeSec < timeSec - 0.0001) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            return low;
        }

        function triggerNoteEffects(event: HitEvent) {
            const trigger = {
                x: event.center,
                width: event.width,
                timeSec: performance.now() / 1000,
                untilSec: event.endTimeSec,
            };

            switch (event.kind) {
                case "flick":
                    effects.trigger(event.critical ? "fx_note_critical_flick_aura" : "fx_note_flick_aura", trigger);
                    effects.trigger(event.critical ? "fx_note_critical_flick_gen" : "fx_note_flick_gen", trigger);
                    effects.trigger(event.critical ? "fx_note_critical_flick_flash" : "fx_note_flick_flash", trigger);
                    if (event.critical) effects.trigger("fx_lane_critical_flick", trigger);
                    break;
                case "trace":
                    effects.trigger(event.critical ? "fx_note_critical_trace_aura" : "fx_note_trace_aura", trigger);
                    break;
                case "tick":
                    effects.trigger(event.critical ? "fx_note_critical_long_hold_via_aura" : "fx_note_long_hold_via_aura", trigger);
                    break;
                case "holdLoop":
                    effects.trigger(event.critical ? "fx_note_critical_long_hold_gen" : "fx_note_long_hold_gen", trigger);
                    effects.trigger(event.critical ? "fx_note_critical_long_hold_gen_aura" : "fx_note_hold_aura", trigger);
                    break;
                case "criticalTap":
                    effects.trigger("fx_note_critical_normal_aura", trigger);
                    effects.trigger("fx_note_critical_normal_gen", trigger);
                    effects.trigger("fx_lane_critical", trigger);
                    break;
                default:
                    effects.trigger("fx_note_normal_aura", trigger);
                    effects.trigger("fx_note_normal_gen", trigger);
                    effects.trigger("fx_lane_default", trigger);
                    break;
            }
        }

        function emitHitEvents(fromSec: number, toSec: number) {
            const events = hitEventsRef.current;
            while (nextHitEventIndexRef.current < events.length && events[nextHitEventIndexRef.current].timeSec <= toSec + 0.0001) {
                const event = events[nextHitEventIndexRef.current];
                if (event.timeSec >= fromSec - 0.0001) {
                    triggerNoteEffects(event);
                    judgementEffectsInstance.trigger(event, performance.now() / 1000);
                    judgementSoundsInstance.trigger(
                        transport.getAudioContext(),
                        event,
                        transport.getSnapshot().playbackRate,
                        event.timeSec,
                    );
                }
                nextHitEventIndexRef.current += 1;
            }
        }

        function resumeActiveHoldLoops(currentTimeSec: number) {
            for (const event of hitEventsRef.current) {
                if (event.kind !== "holdLoop" || event.endTimeSec === undefined) continue;
                if (event.timeSec < currentTimeSec - 0.0001 && event.endTimeSec > currentTimeSec + 0.0001) {
                    judgementSoundsInstance.trigger(
                        transport.getAudioContext(),
                        event,
                        transport.getSnapshot().playbackRate,
                        currentTimeSec,
                    );
                }
            }
        }

        function frameLoop() {
            if (!rendererReadyRef.current) {
                rafRef.current = requestAnimationFrame(frameLoop);
                return;
            }
            try {
                const snapshot = transport.getSnapshot();
                const ct = snapshot.currentTimeSec;
                const chartTimeSec = ct + normalizedOffsetMsRef.current / 1000;
                const frame = previewReadyRef.current ? wasm.render(chartTimeSec) : { count: 0, floats: emptyFrame };
                renderer.render(frame.floats, frame.count, configRef.current);

                if (previewReadyRef.current) {
                    if (
                        snapshot.state !== "playing" ||
                        previousTransportStateRef.current !== "playing" ||
                        ct < previousTimeSecRef.current ||
                        ct - previousTimeSecRef.current > 0.25
                    ) {
                        nextHitEventIndexRef.current = lowerBoundHitEvent(ct);
                        if (snapshot.state !== "playing") {
                            effects.reset();
                            judgementEffectsInstance.reset();
                            judgementSoundsInstance.stopAll();
                        } else {
                            resumeActiveHoldLoops(ct);
                        }
                    } else {
                        emitHitEvents(previousTimeSecRef.current, ct);
                    }
                }

                const nowSec = performance.now() / 1000;
                effects.render(nowSec);
                judgementEffectsInstance.render(nowSec);
                previousTimeSecRef.current = ct;
                previousTransportStateRef.current = snapshot.state;
                updateUi();
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown render error";
                setStatusTitle("预览加载失败");
                setStatusText(message);
                setPreviewState("error");
                transport.setError();
                previewReadyRef.current = false;
            }
            rafRef.current = requestAnimationFrame(frameLoop);
        }

        // ResizeObserver
        const panel = panelRef.current;
        const resizeObserver = new ResizeObserver(() => {
            const bounds = panel.getBoundingClientRect();
            const dpr = (window.devicePixelRatio || 1) * renderScaleRef.current;
            renderer.resize(bounds.width, bounds.height, dpr);
            wasm.resize(bounds.width, bounds.height, dpr);
            effects.resize(bounds.width, bounds.height, dpr);
            judgementEffectsInstance.resize(bounds.width, bounds.height, dpr);
        });

        async function bootstrap() {
            try {
                setPreviewState("loading");
                setStatusTitle("正在加载 MMW 资源");
                setStatusText("贴图、着色器和 WASM 模块正在初始化。");

                await Promise.all([
                    wasm.init(),
                    renderer.loadTextures(),
                    effects.load(),
                    judgementSoundsInstance.load(transport.getAudioContext()).catch(() => {
                        setWarningMessage("判定音效加载失败，已静默继续。");
                    }),
                ]);
                rendererReadyRef.current = true;
                resizeObserver.observe(panel);

                setStatusTitle("正在加载谱面");
                setStatusText("正在拉取 SUS 文件。");

                const bgmExpected = !!bgmUrl;
                bgmExpectedRef.current = bgmExpected;
                bgmLoadedRef.current = !bgmUrl;

                const susResponse = await fetch(susUrl);
                if (!susResponse.ok) throw new Error(`Failed to load SUS: ${susResponse.status}`);
                const susText = await susResponse.text();

                const normalizedMs = normalizeOffsetMs(rawOffsetMs ?? null, susText);
                normalizedOffsetMsRef.current = normalizedMs;

                wasm.loadSusText(susText, normalizedMs);
                wasm.setPreviewConfig(configRef.current);

                hitEventsRef.current = wasm.getHitEvents().map((event) => ({
                    ...event,
                    timeSec: event.timeSec - normalizedMs / 1000,
                    endTimeSec: event.endTimeSec === undefined ? undefined : event.endTimeSec - normalizedMs / 1000,
                }));
                nextHitEventIndexRef.current = 0;

                const chartEndTimeSec = wasm.getChartEndTimeSec();
                const minimumDurationSec = Math.max(chartEndTimeSec - normalizedMs / 1000 + 1, 1);
                transport.setDuration(minimumDurationSec);
                transport.setReady();

                const startSec = Math.max(0, -normalizedMs / 1000);
                initialStartSecRef.current = startSec;
                if (startSec > 0.001) {
                    transport.seek(startSec);
                    previousTimeSecRef.current = startSec;
                    nextHitEventIndexRef.current = lowerBoundHitEvent(startSec);
                }

                previewReadyRef.current = true;
                setPreviewState("ready");
                updateUi();

                // Load BGM in background
                if (bgmUrl) {
                    setBgmLoading(true);
                    setWarningMessage("正在加载 BGM…");
                    try {
                        const controller = new AbortController();
                        const timer = window.setTimeout(() => controller.abort(), 30000);
                        const bgmFetchUrl = bgmUrl;
                        const bgmResponse = await fetch(bgmFetchUrl, { signal: controller.signal });
                        window.clearTimeout(timer);
                        if (!bgmResponse.ok) throw new Error(`BGM: ${bgmResponse.status}`);
                        const bgmData = await bgmResponse.arrayBuffer();
                        await Promise.race([
                            transport.setAudioData(bgmData),
                            new Promise<never>((_, reject) => {
                                window.setTimeout(() => reject(new Error("BGM decode timeout.")), 30000);
                            }),
                        ]);
                        // Trim leading silence: game BGM files have ~9s of silence at the start.
                        // We offset the audio so playback aligns with the chart.
                        if (skipBgmSilence && fillerSec > 0) {
                            transport.setBgmOffsetSec(fillerSec);
                        }
                        transport.setDuration(Math.max(transport.getSnapshot().durationSec, minimumDurationSec));
                        bgmLoadedRef.current = true;
                        setBgmLoading(false);
                        setWarningMessage("");
                    } catch (error) {
                        bgmExpectedRef.current = false;
                        bgmLoadedRef.current = false;
                        setBgmLoading(false);
                        setWarningMessage(
                            error instanceof Error
                                ? `${error.message}，已切换为静音预览。`
                                : "BGM 加载失败，已切换为静音预览。"
                        );
                    }
                    updateUi();
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                setStatusTitle("预览加载失败");
                setStatusText(message);
                setPreviewState("error");
                transport.setError();
                updateUi();
            }
        }

        rafRef.current = requestAnimationFrame(frameLoop);
        void bootstrap();

        return () => {
            cancelAnimationFrame(rafRef.current);
            resizeObserver.disconnect();
            unsubscribe();
            transport.stop();
            try { transport.getAudioContext().close(); } catch { /* ignore */ }
            wasm.dispose();
            judgementSoundsInstance.stopAll();
        };
    }, [susUrl, bgmUrl, rawOffsetMs, fillerSec, skipBgmSilence, updateUi]);

    const handlePlayToggle = useCallback(async () => {
        const transport = transportRef.current;
        if (!transport) return;

        if (bgmExpectedRef.current && !bgmLoadedRef.current) {
            setWarningMessage("歌曲仍在加载中，请稍候。");
            return;
        }

        if (transport.getSnapshot().state === "playing") {
            transport.pause();
            return;
        }

        const ok = await transport.play();
        if (!ok) {
            setRequiresGesture(true);
        }
        updateUi();
    }, [updateUi]);

    const handleStop = useCallback(() => {
        const transport = transportRef.current;
        if (!transport) return;
        transport.stop();
        const startSec = initialStartSecRef.current;
        if (startSec > 0.001) {
            transport.seek(startSec);
        }
        const events = hitEventsRef.current;
        let low = 0;
        let high = events.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (events[mid].timeSec < startSec - 0.0001) low = mid + 1;
            else high = mid;
        }
        nextHitEventIndexRef.current = low;
        previousTimeSecRef.current = startSec;
        effectsRef.current?.reset();
        judgementEffectsRef.current?.reset();
        updateUi();
    }, [updateUi]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const transport = transportRef.current;
        if (!transport) return;
        const nextTime = Number(e.target.value);
        transport.seek(nextTime);
        const events = hitEventsRef.current;
        let low = 0;
        let high = events.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (events[mid].timeSec < nextTime - 0.0001) low = mid + 1;
            else high = mid;
        }
        nextHitEventIndexRef.current = low;
        previousTimeSecRef.current = nextTime;
        effectsRef.current?.reset();
        judgementEffectsRef.current?.reset();
        updateUi();
    }, [updateUi]);

    const handleSpeedChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const transport = transportRef.current;
        if (!transport) return;
        const raw = e.target.value;
        if (raw === "") {
            setPlaybackRate(0);
            return;
        }
        const val = Number(raw);
        if (!Number.isFinite(val)) return;
        const clamped = Math.min(Math.max(val, 0.1), 4);
        setPlaybackRate(clamped);
        await transport.setPlaybackRate(clamped);
        try { localStorage.setItem(LS_PLAYBACK_RATE, String(clamped)); } catch { /* quota */ }
        updateUi();
    }, [updateUi]);

    const handleNoteSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Allow empty input while typing
        if (raw === "") {
            setNoteSpeed(0);
            return;
        }
        const val = Number(raw);
        if (!Number.isFinite(val)) return;
        const clamped = Math.min(Math.max(val, 1), 12);
        setNoteSpeed(clamped);
        configRef.current = { ...configRef.current, noteSpeed: clamped };
        wasmRef.current?.setPreviewConfig(configRef.current);
        try { localStorage.setItem(LS_NOTE_SPEED, String(clamped)); } catch { /* quota */ }
    }, []);

    const handleSeVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value) / 100;
        setSeVolume(val);
        judgementSoundsRef.current?.setVolume(val);
        try { localStorage.setItem(LS_SE_VOLUME, String(val)); } catch { /* quota */ }
    }, []);

    const handleBgmVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value) / 100;
        setBgmVolume(val);
        transportRef.current?.setVolume(val);
        try { localStorage.setItem(LS_BGM_VOLUME, String(val)); } catch { /* quota */ }
    }, []);

    const handleLowEffectsToggle = useCallback(() => {
        setLowEffects(prev => {
            const next = !prev;
            configRef.current = { ...configRef.current, effectOpacity: next ? 0.3 : 1 };
            wasmRef.current?.setPreviewConfig(configRef.current);
            return next;
        });
    }, []);

    const handleRenderScaleChange = useCallback((scale: number) => {
        setRenderScale(scale);
        renderScaleRef.current = scale;
        try { localStorage.setItem(LS_RENDER_SCALE, String(scale)); } catch { /* quota */ }
        const panel = panelRef.current;
        if (!panel) return;
        const bounds = panel.getBoundingClientRect();
        const dpr = (window.devicePixelRatio || 1) * scale;
        rendererRef.current?.resize(bounds.width, bounds.height, dpr);
        wasmRef.current?.resize(bounds.width, bounds.height, dpr);
        effectsRef.current?.resize(bounds.width, bounds.height, dpr);
        judgementEffectsRef.current?.resize(bounds.width, bounds.height, dpr);
    }, []);

    const handleUnlock = useCallback(async () => {
        const transport = transportRef.current;
        if (!transport) return;
        await transport.unlock();
        setRequiresGesture(false);
        updateUi();
    }, [updateUi]);

    const showStatus = previewState === "init" || previewState === "loading" || previewState === "error";
    const isCompactControls = isPseudoFullscreen;
    const fullscreenHeight = viewport.height > 0 ? `${viewport.height}px` : "100dvh";
    const wrapperClassName = isPseudoFullscreen
        ? "fixed inset-0 z-[150] bg-black"
        : isNativeFullscreen
            ? "h-full w-full bg-black"
            : "flex flex-col gap-3 w-full";
    const contentClassName = isFullscreen ? "relative h-full w-full bg-black" : "flex flex-col gap-3";
    const panelClassName = `relative overflow-hidden bg-slate-900 ${isFullscreen ? "rounded-none" : "rounded-xl"}`;
    const controlsClassName = isFullscreen
        ? "absolute bottom-0 left-0 right-0 z-30 flex flex-col gap-2.5 border-t border-slate-800 bg-slate-950/92 px-4 pt-3 backdrop-blur-md transition-all duration-300"
        : "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm";
    const timeClassName = `${isCompactControls ? "text-[11px]" : "text-xs"} ml-auto font-mono whitespace-nowrap ${isFullscreen ? "text-slate-400" : "text-slate-500"}`;
    const secondaryButtonClassName = `${isCompactControls ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm"} rounded-lg font-medium transition-colors ${isFullscreen ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`;
    const chipClassName = isFullscreen
        ? "border-slate-700 bg-slate-800/80 hover:bg-slate-700/80"
        : "border-slate-200 bg-slate-50/60 hover:bg-slate-50";
    const fieldTextClassName = `${isFullscreen ? "text-slate-300" : "text-slate-600"} ${isCompactControls ? "text-[11px]" : "text-xs"} font-bold`;
    const fieldInputClassName = isFullscreen
        ? "border-slate-700 bg-slate-800 text-slate-200"
        : "border-slate-200 bg-white text-slate-700";

    return (
        <div
            ref={wrapperRef}
            className={wrapperClassName}
            style={isPseudoFullscreen ? { height: fullscreenHeight, overscrollBehavior: "none", touchAction: "none" } : undefined}
            onPointerMove={isFullscreen ? resetControlsTimer : undefined}
            onPointerDown={isFullscreen ? resetControlsTimer : undefined}
        >
            <div className={contentClassName} style={isPseudoFullscreen ? { minHeight: fullscreenHeight } : undefined}>
                <div
                    className={isFullscreen ? "flex h-full w-full items-center justify-center bg-black" : "w-full"}
                    style={isPseudoFullscreen ? { paddingTop: "env(safe-area-inset-top)" } : isNativeFullscreen ? { padding: 16 } : undefined}
                >
                    <div
                        ref={panelRef}
                        className={panelClassName}
                        style={isFullscreen
                            ? { width: "100%", aspectRatio: "16 / 9", maxWidth: isPseudoFullscreen ? "100%" : "min(100%, 1800px)", maxHeight: "100%", flexShrink: 0 }
                            : { width: "100%", aspectRatio: "16 / 9" }}
                    >
                        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                        <canvas ref={effectsCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

                        {showStatus && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                                <div className={`flex flex-col items-center ${isCompactControls ? "gap-3 p-4" : "gap-4 p-6"}`}>
                                    {previewState !== "error" ? (
                                        <div
                                            className={`chart-preview-logo-fill ${isCompactControls ? "h-10 w-40" : "h-14 w-56 sm:h-16 sm:w-64"}`}
                                            style={{
                                                maskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                                                maskSize: "contain",
                                                maskPosition: "center",
                                                maskRepeat: "no-repeat",
                                                WebkitMaskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                                                WebkitMaskSize: "contain",
                                                WebkitMaskPosition: "center",
                                                WebkitMaskRepeat: "no-repeat",
                                            }}
                                            role="img"
                                            aria-label="Loading"
                                        />
                                    ) : (
                                        <svg className={isCompactControls ? "h-8 w-8 text-red-400" : "h-10 w-10 text-red-400"} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    <div className="text-center">
                                        <div className={`font-medium text-white ${isCompactControls ? "mb-0.5 text-xs" : "mb-1 text-sm"}`}>{statusTitle}</div>
                                        <div className={`text-slate-400 ${isCompactControls ? "text-[10px]" : "text-xs"}`}>{statusText}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {requiresGesture && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                                <div className={`text-center ${isCompactControls ? "p-4" : "p-6"}`}>
                                    <div className={`font-medium text-white ${isCompactControls ? "mb-1 text-sm" : "mb-2 text-lg"}`}>浏览器需要一次点击来启动音频</div>
                                    {!isCompactControls && <div className="mb-4 text-sm text-slate-400">点击后会继续当前播放请求。</div>}
                                    <button
                                        type="button"
                                        onClick={handleUnlock}
                                        className={`rounded-lg bg-miku text-white transition-colors hover:bg-miku/90 ${isCompactControls ? "mt-2 px-4 py-1.5 text-sm" : "px-6 py-2"}`}
                                    >
                                        启动音频
                                    </button>
                                </div>
                            </div>
                        )}

                        {bgmLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                                <div className={`text-center ${isCompactControls ? "p-4" : "p-6"}`}>
                                    <div className={`font-medium text-white ${isCompactControls ? "mb-1 text-sm" : "mb-2 text-lg"}`}>正在加载歌曲</div>
                                    <div className={isCompactControls ? "text-xs text-slate-400" : "text-sm text-slate-400"}>BGM 还没准备好，加载完成后就可以播放。</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lock button — fullscreen only, always visible in top-right corner */}
                {isFullscreen && (
                    <button
                        type="button"
                        onClick={handleControlsLockToggle}
                        className={`absolute top-3 right-3 z-40 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${controlsLocked
                            ? "bg-miku/80 text-white shadow-lg"
                            : "bg-slate-900/50 text-slate-300 hover:bg-slate-900/70"
                            }`}
                        title={controlsLocked ? "解锁控制栏" : "锁定控制栏"}
                    >
                        {controlsLocked ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                )}

                <div
                    className={controlsClassName}
                    style={isFullscreen
                        ? {
                            opacity: controlsVisible ? 1 : 0,
                            pointerEvents: controlsVisible ? "auto" : "none",
                            paddingBottom: isPseudoFullscreen ? "calc(env(safe-area-inset-bottom) + 12px)" : 16,
                        }
                        : undefined}
                >
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePlayToggle}
                            disabled={bgmLoading || previewState !== "ready"}
                            title={isPlaying ? "暂停" : "播放"}
                            className={`${isFullscreen ? "flex h-9 w-9 items-center justify-center rounded-full bg-miku text-white hover:bg-miku/90" : `${isCompactControls ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm"} shrink-0 rounded-lg bg-miku font-medium text-white hover:bg-miku/90`} transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {isPlaying ? (
                                <svg className={isFullscreen ? "h-4 w-4" : "hidden"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                            ) : (
                                <svg className={isFullscreen ? "h-4 w-4" : "hidden"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                            {!isFullscreen && (isPlaying ? "暂停" : "播放")}
                        </button>
                        <button
                            type="button"
                            onClick={handleStop}
                            title="停止"
                            className={`${isFullscreen ? "flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600" : `${secondaryButtonClassName}`} shrink-0 transition-colors`}
                        >
                            {isFullscreen ? (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M6 6h12v12H6z" />
                                </svg>
                            ) : "停止"}
                        </button>
                        <span className={timeClassName}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                        {isFullscreen && (
                            <button
                                type="button"
                                onClick={handleFullscreenToggle}
                                title="退出全屏"
                                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-200 transition-colors hover:bg-slate-600"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9L9 4.5M9 9L4.5 9M9 9L3.75 3.75M9 15L9 19.5M9 15L4.5 15M9 15L3.75 20.25M15 9H19.5M15 9V4.5M15 9L20.25 3.75M15 15H19.5M15 15L15 19.5M15 15L20.25 20.25" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step={0.001}
                        value={Math.min(currentTime, duration || currentTime)}
                        onChange={handleSeek}
                        className={`w-full cursor-pointer accent-miku ${isCompactControls ? "h-1.5" : "h-2"}`}
                    />

                    {!isFullscreen && (
                        <div className={`flex flex-wrap items-center ${isCompactControls ? "gap-1.5" : "gap-2"}`}>
                            <label className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${chipClassName}`}>
                                <span className={fieldTextClassName}>速度</span>
                                <input
                                    type="number"
                                    min={0.1}
                                    max={4}
                                    step={0.05}
                                    value={playbackRate || ""}
                                    onChange={handleSpeedChange}
                                    className={`${isCompactControls ? "w-14" : "w-16"} rounded-lg border px-1.5 py-0.5 text-center text-xs font-medium ${fieldInputClassName}`}
                                />
                            </label>

                            <label className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${chipClassName}`}>
                                <span className={fieldTextClassName}>noteSpeed</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    step={0.1}
                                    value={noteSpeed || ""}
                                    onChange={handleNoteSpeedChange}
                                    className={`${isCompactControls ? "w-12" : "w-14"} rounded-lg border px-1.5 py-0.5 text-center text-xs font-medium ${fieldInputClassName}`}
                                />
                            </label>

                            <label className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${chipClassName}`}>
                                <span className={fieldTextClassName}>打击音量</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(seVolume * 100)}
                                    onChange={handleSeVolumeChange}
                                    className={`${isCompactControls ? "w-14" : "w-16"} cursor-pointer accent-miku`}
                                />
                                <span className="text-[11px] tabular-nums text-slate-500">{Math.round(seVolume * 100)}%</span>
                            </label>

                            <label className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${chipClassName}`}>
                                <span className={fieldTextClassName}>音乐音量</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(bgmVolume * 100)}
                                    onChange={handleBgmVolumeChange}
                                    className={`${isCompactControls ? "w-14" : "w-16"} cursor-pointer accent-miku`}
                                />
                                <span className="text-[11px] tabular-nums text-slate-500">{Math.round(bgmVolume * 100)}%</span>
                            </label>

                            <button
                                type="button"
                                onClick={handleLowEffectsToggle}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${lowEffects
                                    ? "border-transparent bg-white text-slate-800 ring-2 ring-miku shadow-lg"
                                    : `${chipClassName} text-slate-600`}`}
                            >
                                <span className={`${isCompactControls ? "text-[11px]" : "text-xs"} font-bold`}>低特效</span>
                                <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${lowEffects ? "border-miku bg-miku" : "border-slate-300 bg-white"}`}>
                                    {lowEffects && (
                                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            </button>

                            <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 transition-all ${chipClassName}`}>
                                <span className={`${isCompactControls ? "text-[11px]" : "text-xs"} font-bold ${isFullscreen ? "text-slate-300" : "text-slate-600"}`}>画质</span>
                                <div className="flex gap-1">
                                    {RENDER_SCALE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleRenderScaleChange(opt.value)}
                                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all ${renderScale === opt.value
                                                ? "bg-miku text-white shadow-sm"
                                                : `${isFullscreen ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="ml-auto flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleWebFullscreenToggle}
                                    title="网页全屏（iOS 推荐）"
                                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 transition-all hover:bg-slate-50"
                                >
                                    <span className="text-xs font-bold text-slate-600">网页全屏</span>
                                    <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 2h10M7 22h10M2 7v10M22 7v10" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFullscreenToggle}
                                    title="进入全屏"
                                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 transition-all hover:bg-slate-50"
                                >
                                    <span className="text-xs font-bold text-slate-600">全屏</span>
                                    <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75V8.25M3.75 3.75H8.25M3.75 3.75L9 9M3.75 20.25V15.75M3.75 20.25H8.25M3.75 20.25L9 15M20.25 3.75L15.75 3.75M20.25 3.75V8.25M20.25 3.75L15 9M20.25 20.25H15.75M20.25 20.25V15.75M20.25 20.25L15 15" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {warningMessage && <div className={isCompactControls ? "text-[10px] text-amber-500" : "text-xs text-amber-600"}>{warningMessage}</div>}

                    {!isFullscreen && isIOS && (
                        <div className="text-[11px] text-slate-400 italic text-right space-y-0.5">
                            <div>*iOS 设备推荐使用「网页全屏」以更好地屏蔽 Safari 的快捷触摸操作</div>
                            <div>*iOS 的渲染机制可能导致全屏卡顿，建议将画质调至 50% 或 75% 以提升帧率</div>
                        </div>
                    )}

                    {!isFullscreen && (
                        <div className="text-xs text-slate-400">
                            Adapted from{" "}
                            <ExternalLink href="https://github.com/crash5band/MikuMikuWorld" className="text-miku hover:underline">
                                MikuMikuWorld
                            </ExternalLink>{" "}
                            by Crash5b, licensed under MIT. 部分代码来源于{" "}
                            <ExternalLink href="https://github.com/watagashi-uni/" className="text-miku hover:underline">
                                watagashi-uni
                            </ExternalLink>
                            。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
