"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
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

/** Seconds to skip at the start of BGM (game songs have ~9s silence). */
const BGM_SKIP_SEC = 9;

interface ChartPreviewPlayerProps {
    susUrl: string;
    bgmUrl?: string;
    rawOffsetMs?: number | null;
    /** If true, skip the leading silence in BGM (default: true when bgmUrl is provided). */
    skipBgmSilence?: boolean;
}

function formatTime(value: number) {
    const safe = Math.max(value, 0);
    const minutes = Math.floor(safe / 60);
    const seconds = Math.floor(safe % 60);
    const milliseconds = Math.floor((safe % 1) * 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export default function ChartPreviewPlayer({ susUrl, bgmUrl, rawOffsetMs, skipBgmSilence = true }: ChartPreviewPlayerProps) {
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
    const configRef = useRef({ ...defaultConfig });

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
    const [noteSpeed, setNoteSpeed] = useState(10.5);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [lowEffects, setLowEffects] = useState(false);

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
            const dpr = window.devicePixelRatio || 1;
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
                        if (skipBgmSilence) {
                            transport.setBgmOffsetSec(BGM_SKIP_SEC);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [susUrl, bgmUrl, rawOffsetMs]);

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

    const handleSpeedChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const transport = transportRef.current;
        if (!transport) return;
        const rate = Number(e.target.value);
        setPlaybackRate(rate);
        await transport.setPlaybackRate(rate);
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
    }, []);

    const handleLowEffectsToggle = useCallback(() => {
        setLowEffects(prev => {
            const next = !prev;
            configRef.current = { ...configRef.current, effectOpacity: next ? 0.3 : 1 };
            wasmRef.current?.setPreviewConfig(configRef.current);
            return next;
        });
    }, []);

    const handleUnlock = useCallback(async () => {
        const transport = transportRef.current;
        if (!transport) return;
        await transport.unlock();
        setRequiresGesture(false);
        updateUi();
    }, [updateUi]);

    const showStatus = previewState === "init" || previewState === "loading" || previewState === "error";

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Preview panel */}
            <div ref={panelRef} className="relative w-full bg-slate-900 rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                <canvas ref={effectsCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                {/* Status overlay */}
                {showStatus && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center p-6 gap-4">
                            {previewState !== "error" ? (
                                <div
                                    className="h-14 w-56 sm:h-16 sm:w-64 chart-preview-logo-fill"
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
                                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <div className="text-center">
                                <div className="text-white text-sm font-medium mb-1">{statusTitle}</div>
                                <div className="text-slate-400 text-xs">{statusText}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Audio unlock overlay */}
                {requiresGesture && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
                        <div className="text-center p-6">
                            <div className="text-white text-lg font-medium mb-2">浏览器需要一次点击来启动音频</div>
                            <div className="text-slate-400 text-sm mb-4">点击后会继续当前播放请求。</div>
                            <button
                                onClick={handleUnlock}
                                className="px-6 py-2 bg-miku text-white rounded-lg hover:bg-miku/90 transition-colors"
                            >
                                启动音频
                            </button>
                        </div>
                    </div>
                )}

                {/* BGM loading overlay */}
                {bgmLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-10">
                        <div className="text-center p-6">
                            <div className="text-white text-lg font-medium mb-2">正在加载歌曲</div>
                            <div className="text-slate-400 text-sm">BGM 还没准备好，加载完成后就可以播放。</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
                {/* Playback buttons + time */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handlePlayToggle}
                        disabled={bgmLoading || previewState !== "ready"}
                        className="shrink-0 px-4 py-1.5 bg-miku text-white rounded-lg text-sm font-medium hover:bg-miku/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPlaying ? "暂停" : "播放"}
                    </button>
                    <button
                        onClick={handleStop}
                        className="shrink-0 px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
                    >
                        停止
                    </button>
                    <span className="ml-auto text-xs text-slate-500 font-mono whitespace-nowrap">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>

                {/* Progress bar - own row */}
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.001}
                    value={Math.min(currentTime, duration || currentTime)}
                    onChange={handleSeek}
                    className="w-full h-2 accent-miku cursor-pointer"
                />

                {/* Settings */}
                <div className="flex items-center gap-2 flex-wrap text-sm">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
                        <span className="text-xs font-bold text-slate-600">速度</span>
                        <select
                            value={playbackRate}
                            onChange={handleSpeedChange}
                            className="px-1.5 py-0.5 rounded-lg border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                        >
                            <option value={0.25}>0.25x</option>
                            <option value={0.5}>0.5x</option>
                            <option value={0.75}>0.75x</option>
                            <option value={1}>1x</option>
                            <option value={1.25}>1.25x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2x</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
                        <span className="text-xs font-bold text-slate-600">noteSpeed</span>
                        <input
                            type="number"
                            min={1}
                            max={12}
                            step={0.1}
                            value={noteSpeed || ""}
                            onChange={handleNoteSpeedChange}
                            className="w-14 px-1.5 py-0.5 rounded-lg border border-slate-200 text-xs bg-white text-center font-medium text-slate-700"
                        />
                    </label>
                    <button
                        onClick={handleLowEffectsToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all border ${lowEffects
                            ? "ring-2 ring-miku shadow-lg bg-white border-transparent"
                            : "hover:bg-slate-50 border-slate-200 bg-slate-50/50"
                        }`}
                    >
                        <span className={`text-xs font-bold ${lowEffects ? "text-slate-800" : "text-slate-600"}`}>
                            低特效
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${lowEffects ? "bg-miku border-miku" : "border-slate-300 bg-white"}`}>
                            {lowEffects && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                </div>

                {/* Warning */}
                {warningMessage && (
                    <div className="text-xs text-amber-600">{warningMessage}</div>
                )}

                <div className="text-xs text-slate-400">
                    Adapted from{" "}
                    <a href="https://github.com/crash5band/MikuMikuWorld" target="_blank" rel="noreferrer" className="text-miku hover:underline">
                        MikuMikuWorld
                    </a>{" "}
                    by Crash5b, licensed under MIT.
                </div>
            </div>
        </div>
    );
}
