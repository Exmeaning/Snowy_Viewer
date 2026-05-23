"use client";

import { useEffect, useRef, useCallback } from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";

interface AudioSpectrumVisualizerProps {
    /** Ref to the <audio> element that is the playback source */
    audioRef: React.RefObject<HTMLAudioElement | null>;
    /** Theme gradient colors from the current track's category */
    themeColors: { from: string; to: string };
    /** Whether audio is currently playing — used to toggle the analyzer on/off */
    isPlaying: boolean;
    /** Height of the visualizer canvas in pixels */
    height?: number;
    /** Whether the current color scheme is dark mode */
    isDark?: boolean;
}

const GRADIENT_NAME = "trackTheme";

/**
 * Real-time audio spectrum visualizer powered by audiomotion-analyzer.
 *
 * Uses the Web Audio API (AnalyserNode) to analyze frequency data from the
 * connected <audio> element and renders a performant Canvas-based spectrum.
 *
 * Key design decisions:
 * - The analyzer instance is stored in a ref to avoid React re-render cycles.
 * - We lazily connect the audio source on first play to respect browser
 *   autoplay policies (AudioContext must be resumed after user gesture).
 * - Gradient colors are updated dynamically when the track category changes.
 * - The canvas uses transparent background (bgAlpha: 0) to blend with the
 *   card's backdrop-blur and glassmorphism styling.
 */
export function AudioSpectrumVisualizer({
    audioRef,
    themeColors,
    isPlaying,
    height = 80,
    isDark: _isDark = true,
}: AudioSpectrumVisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);
    const connectedRef = useRef(false);

    // Lazily connect the audio source — must happen after a user gesture
    // so the AudioContext can be resumed by the browser.
    const ensureConnected = useCallback(() => {
        const analyzer = analyzerRef.current;
        const audio = audioRef.current;
        if (!analyzer || !audio || connectedRef.current) return;

        try {
            analyzer.connectInput(audio);
            connectedRef.current = true;
        } catch (err) {
            console.warn("[AudioSpectrumVisualizer] Failed to connect audio source:", err);
        }
    }, [audioRef]);

    // Initialize the analyzer instance (once)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Prevent double-init in React StrictMode
        if (analyzerRef.current) return;

        try {
            const analyzer = new AudioMotionAnalyzer(container, {
                // Don't auto-connect a source — we do it lazily on first play
                height,
                ansiBands: false,
                showScaleX: false,
                showScaleY: false,
                bgAlpha: 0,
                overlay: true,
                mode: 10,            // Line / Area Graph — smooth fluid neon soundwave!
                lineWidth: 2.5,      // sleek glowing curve outline
                fillAlpha: 0.2,      // elegant translucent glassmorphic area fill
                reflexRatio: 0,      // single directional wave, no retro reflection bars
                smoothing: 0.8,      // high smoothing for fluid liquid-like movement
                fftSize: 2048,       // 75% fewer Fourier computations, snappy and low CPU/GPU load!
                minFreq: 2000,        // cuts off heavy low-end bass (below 2000Hz) to make the wave extremely light and dynamic
                maxFreq: 12000,      // focus on the audible active music spectrum
                weightingFilter: "", // flat response: avoids boosting silent floor noise
                minDecibels: -75,    // cleanly cuts off Web Audio silent floor to 0 height
                maxDecibels: -25,    // default visual ceiling
                // IMPORTANT: connect to destination so audio remains audible after we
                // intercept the <audio> element with a MediaElementSource. Once
                // connectInput() runs, the element no longer outputs to speakers on
                // its own — the AnalyserNode graph must complete the path.
                connectSpeakers: true,
                showPeaks: false,    // disabled for continuous line curve mode
            });

            // Register initial gradient
            analyzer.registerGradient(GRADIENT_NAME, {
                colorStops: [
                    themeColors.to,
                    themeColors.from,
                ],
            });
            analyzer.setOptions({ gradient: GRADIENT_NAME });

            analyzerRef.current = analyzer;
        } catch (err) {
            console.warn("[AudioSpectrumVisualizer] Failed to initialize analyzer:", err);
        }

        return () => {
            if (analyzerRef.current) {
                try {
                    analyzerRef.current.destroy();
                } catch { /* ignore */ }
                analyzerRef.current = null;
                connectedRef.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Connect audio source and toggle analyzer when playback state changes
    useEffect(() => {
        if (isPlaying) {
            ensureConnected();
        }

        const analyzer = analyzerRef.current;
        if (!analyzer) return;

        // Resume/suspend the AudioContext to save CPU when paused/inactive
        const ctx = analyzer.audioCtx;
        if (isPlaying) {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
        } else {
            if (ctx.state === "running") {
                ctx.suspend().catch(() => {});
            }
        }
    }, [isPlaying, ensureConnected]);

    // Dynamically update gradient colors when theme changes
    useEffect(() => {
        const analyzer = analyzerRef.current;
        if (!analyzer) return;

        try {
            analyzer.registerGradient(GRADIENT_NAME, {
                colorStops: [
                    themeColors.to,
                    themeColors.from,
                ],
            });
            analyzer.setOptions({ gradient: GRADIENT_NAME });
        } catch (err) {
            console.warn("[AudioSpectrumVisualizer] Failed to update gradient:", err);
        }
    }, [themeColors]);

    // Update canvas dimensions if height changes
    useEffect(() => {
        const analyzer = analyzerRef.current;
        if (!analyzer) return;
        analyzer.setOptions({ height });
    }, [height]);

    return (
        <div
            ref={containerRef}
            className="w-full overflow-hidden rounded-xl"
            style={{
                height,
                // Hide completely when paused to keep the card minimalist and avoid static "barcode" shapes
                opacity: isPlaying ? 1 : 0,
                transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: isPlaying ? "auto" : "none",
            }}
        />
    );
}
