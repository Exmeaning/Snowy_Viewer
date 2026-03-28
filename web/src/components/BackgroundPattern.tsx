"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import styles from '../app/components/BackgroundPattern.module.css';
import { useTheme } from '@/contexts/ThemeContext';
import {
    loadBackgroundPatternWasm,
    type BackgroundPatternRendererInstance,
} from '@/lib/background-pattern/wasm';

const PATTERN_IMAGE_URL = '/loading.webp';
const MAX_DEVICE_PIXEL_RATIO = 1.5;

async function loadPatternImage() {
    const image = new Image();
    image.decoding = 'async';
    image.src = PATTERN_IMAGE_URL;

    if (typeof image.decode === 'function') {
        try {
            await image.decode();
            return image;
        } catch {
            // Fall back to onload below for browsers that reject decode() early.
        }
    }

    if (image.complete) {
        return image;
    }

    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Failed to load background pattern image.'));
    });

    return image;
}

function getViewportSize(container: HTMLDivElement | null) {
    if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return {
                width: Math.max(rect.width, 1),
                height: Math.max(rect.height, 1),
            };
        }
    }

    return {
        width: Math.max(window.innerWidth, 1),
        height: Math.max(window.innerHeight, 1),
    };
}

function getPatternDevicePixelRatio() {
    return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}

const BackgroundPattern = () => {
    const { isPowerSaving, themeColor } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<BackgroundPatternRendererInstance | null>(null);
    const animationFrameRef = useRef(0);
    const resizeFrameRef = useRef(0);
    const lastTimestampRef = useRef(0);
    const lastResizeStateRef = useRef<{ width: number; height: number; dpr: number } | null>(null);
    const themeColorRef = useRef(themeColor);

    const stopAnimation = useCallback(() => {
        if (!animationFrameRef.current) {
            return;
        }

        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
    }, []);

    const resizeRenderer = useCallback(() => {
        const renderer = rendererRef.current;
        if (!renderer) {
            return;
        }

        const { width, height } = getViewportSize(containerRef.current);
        const dpr = getPatternDevicePixelRatio();
        const nextState = {
            width: Math.round(width * 100) / 100,
            height: Math.round(height * 100) / 100,
            dpr,
        };
        const previousState = lastResizeStateRef.current;

        if (
            previousState &&
            previousState.width === nextState.width &&
            previousState.height === nextState.height &&
            previousState.dpr === nextState.dpr
        ) {
            return;
        }

        renderer.resize(nextState.width, nextState.height, nextState.dpr);
        lastResizeStateRef.current = nextState;
    }, []);

    const renderStaticFrame = useCallback(() => {
        const renderer = rendererRef.current;
        if (!renderer) {
            return;
        }

        renderer.render(0);
    }, []);

    const syncAnimationState = useCallback(() => {
        const renderer = rendererRef.current;
        if (!renderer) {
            return;
        }

        stopAnimation();

        const shouldAnimate = !isPowerSaving && !document.hidden;
        if (!shouldAnimate) {
            renderStaticFrame();
            return;
        }

        const frame = (timestamp: number) => {
            const activeRenderer = rendererRef.current;
            if (!activeRenderer) {
                return;
            }

            lastTimestampRef.current = timestamp;
            activeRenderer.render(timestamp);
            animationFrameRef.current = requestAnimationFrame(frame);
        };

        animationFrameRef.current = requestAnimationFrame(frame);
    }, [isPowerSaving, renderStaticFrame, stopAnimation]);

    useEffect(() => {
        themeColorRef.current = themeColor;

        const renderer = rendererRef.current;
        if (!renderer) {
            return;
        }

        renderer.set_theme_color(themeColor);
        renderer.render(animationFrameRef.current ? lastTimestampRef.current : 0);
    }, [themeColor]);

    useEffect(() => {
        let disposed = false;

        const initialize = async () => {
            try {
                const canvas = canvasRef.current;
                if (!canvas) {
                    return;
                }

                const [{ BackgroundPatternRenderer }, patternImage] = await Promise.all([
                    loadBackgroundPatternWasm(),
                    loadPatternImage(),
                ]);

                if (disposed || !canvasRef.current) {
                    return;
                }

                const renderer = new BackgroundPatternRenderer(canvasRef.current, patternImage, themeColorRef.current);
                rendererRef.current = renderer;
                resizeRenderer();
                renderer.render(0);
                syncAnimationState();
            } catch (error) {
                console.error('Failed to initialize Rust background pattern renderer.', error);
            }
        };

        initialize();

        return () => {
            disposed = true;
            stopAnimation();

            if (resizeFrameRef.current) {
                cancelAnimationFrame(resizeFrameRef.current);
                resizeFrameRef.current = 0;
            }

            rendererRef.current?.free();
            rendererRef.current = null;
            lastResizeStateRef.current = null;
        };
    }, [resizeRenderer, stopAnimation, syncAnimationState]);

    useEffect(() => {
        syncAnimationState();
    }, [syncAnimationState]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            syncAnimationState();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [syncAnimationState]);

    useEffect(() => {
        const handleResize = () => {
            if (resizeFrameRef.current) {
                cancelAnimationFrame(resizeFrameRef.current);
            }

            resizeFrameRef.current = requestAnimationFrame(() => {
                resizeRenderer();
                if (!animationFrameRef.current) {
                    renderStaticFrame();
                }
            });
        };

        handleResize();

        const container = containerRef.current;
        const resizeObserver =
            container && typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => handleResize())
                : null;

        resizeObserver?.observe(container);
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            if (resizeFrameRef.current) {
                cancelAnimationFrame(resizeFrameRef.current);
                resizeFrameRef.current = 0;
            }
        };
    }, [renderStaticFrame, resizeRenderer]);

    return (
        <div ref={containerRef} className={styles.bgPatternContainer} aria-hidden="true">
            <canvas ref={canvasRef} className={styles.bgPatternCanvas} />
        </div>
    );
};

export default BackgroundPattern;
