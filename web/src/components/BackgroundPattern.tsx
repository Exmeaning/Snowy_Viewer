"use client";

import React, { useEffect, useRef } from "react";
import { useTheme, type BackgroundAnimationBudget } from "@/contexts/ThemeContext";
import styles from "../app/components/BackgroundPattern.module.css";

// --- TYPES ---
type ElementType = "triangle" | "circle" | "dot";

interface Shard {
    type: ElementType;
    baseX: number; // 0..1 (normalized)
    baseY: number; // 0..1 (normalized)
    size: number;  // pixel size
    depth: number; // depth z (0.25..1.3)
    rotation: number;
    rotationSpeed: number;
    vx: number;    // horizontal drift speed
    vy: number;    // vertical drift speed
    alpha: number; // base opacity
    filled: boolean; // filled shape vs outlined ring/hollow shape
    points?: { x: number; y: number }[]; // Only used for triangles
    colorVariant: "theme" | "complementary" | "middle" | "white";
    pushX: number; // mouse repulsion offset X
    pushY: number; // mouse repulsion offset Y
    scaleX?: number;
    skewX?: number;
}

interface HugeTriangle {
    baseX: number;
    baseY: number;
    size: number;
    depth: number;
    rotation: number;
    rotationSpeed: number;
    vx: number;
    vy: number;
    alpha: number;
    points: { x: number; y: number }[];
}

interface NavigatorPerformanceHints extends Navigator {
    connection?: { saveData?: boolean };
    mozConnection?: { saveData?: boolean };
    webkitConnection?: { saveData?: boolean };
    deviceMemory?: number;
}

interface CanvasMetrics {
    width: number;
    height: number;
    dpr: number;
}

interface BackgroundPerformanceProfile {
    maxDpr: number;
    shardCount: number;
    hugeTriangleCount: number;
    idleFps: number;
    activeFps: number;
    canvasEnabled: boolean;
    staticOnly: boolean;
    enableMouseRepulsion: boolean;
    drawGrid: boolean;
}

// --- UTILITIES ---
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 51, g: 204, b: 187 }; // Miku green fallback
}

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number) {
    h /= 360; s /= 100; l /= 100;
    let r = l, g = l, b = l;
    if (s !== 0) {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
}

function matchMediaSafely(query: string) {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia(query).matches;
}

function getBackgroundPerformanceProfile(budget: BackgroundAnimationBudget): BackgroundPerformanceProfile {
    const disabledProfile: BackgroundPerformanceProfile = {
        maxDpr: 1,
        shardCount: 0,
        hugeTriangleCount: 0,
        idleFps: 0,
        activeFps: 0,
        canvasEnabled: false,
        staticOnly: true,
        enableMouseRepulsion: false,
        drawGrid: false,
    };

    if (budget === "off") {
        return disabledProfile;
    }

    // Both visible budgets use the official-site-inspired CSS/DOM parallax as the main layer.
    // Power-save stops here: no full-screen canvas repaint loop.
    if (budget === "power-save") {
        return disabledProfile;
    }

    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return {
            maxDpr: 1.15,
            shardCount: 32,
            hugeTriangleCount: 1,
            idleFps: 12,
            activeFps: 20,
            canvasEnabled: true,
            staticOnly: false,
            enableMouseRepulsion: true,
            drawGrid: true,
        };
    }

    const nav = navigator as NavigatorPerformanceHints;
    const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const reducedMotion = matchMediaSafely("(prefers-reduced-motion: reduce)");
    const coarsePointer = matchMediaSafely("(pointer: coarse)");
    const hardwareConcurrency = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
    const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
    const lowPowerHardware = hardwareConcurrency <= 4 || (deviceMemory !== undefined && deviceMemory <= 4);
    const staticOnly = reducedMotion || saveData;

    return {
        // Full-screen canvas cost scales with DPR squared, so cap it aggressively.
        maxDpr: staticOnly ? 1 : 1.15,
        shardCount: staticOnly ? 24 : 32,
        hugeTriangleCount: 1,
        // The background motion is intentionally subtle; low FPS is visually enough and saves GPU.
        idleFps: 12,
        activeFps: 20,
        canvasEnabled: true,
        staticOnly,
        enableMouseRepulsion: !staticOnly && !coarsePointer && !lowPowerHardware,
        drawGrid: !staticOnly,
    };
}

// Generate beautiful non-equilateral scalene/obtuse PJSK crystal shards
const generateTrianglePoints = (): { x: number; y: number }[] => {
    // Perfectly customized coordinates representing elongated artistic world shards seen on official sites!
    // Centered around (0,0), these are highly sharp, dynamic, and non-equilateral offsets.
    return [
        { x: -0.32, y: -0.55 }, // Top-left sharp node
        { x: -0.48, y: 0.50 },  // Long drawn-out base node
        { x: 0.52, y: 0.18 }    // Extended sharp side wing node
    ];
};

type ParallaxShape = {
    layer: 1 | 2 | 3;
    kind: "triangle" | "outlineTriangle" | "circle";
    left: string;
    top: string;
    size: number;
    color: "theme" | "cyan" | "pink" | "yellow" | "white";
    opacity: number;
    rotate: number;
    skewX?: number; // Added to generate beautiful non-equilateral scalene crystals
    scaleX?: number; // Varied width-to-height aspect ratios 
};

const PARALLAX_SHAPES: ParallaxShape[] = [
    // LAYER 1: Deep Background Layer (Delicate smaller shards evenly distributed)
    { layer: 1, kind: "outlineTriangle", left: "5%", top: "8%", size: 60, color: "pink", opacity: 0.14, rotate: -35, skewX: 18, scaleX: 0.5 },
    { layer: 1, kind: "triangle", left: "28%", top: "15%", size: 45, color: "theme", opacity: 0.12, rotate: 55, skewX: -15, scaleX: 0.4 },
    { layer: 1, kind: "outlineTriangle", left: "52%", top: "25%", size: 70, color: "yellow", opacity: 0.15, rotate: 30, skewX: 12, scaleX: 0.45 },
    { layer: 1, kind: "triangle", left: "78%", top: "12%", size: 50, color: "cyan", opacity: 0.12, rotate: -45, skewX: -10, scaleX: 0.38 },
    { layer: 1, kind: "outlineTriangle", left: "92%", top: "22%", size: 65, color: "pink", opacity: 0.15, rotate: 28, skewX: -12, scaleX: 0.48 },
    
    { layer: 1, kind: "triangle", left: "12%", top: "42%", size: 55, color: "theme", opacity: 0.14, rotate: -38, skewX: 15, scaleX: 0.42 },
    { layer: 1, kind: "outlineTriangle", left: "35%", top: "48%", size: 60, color: "white", opacity: 0.18, rotate: -25, skewX: 10, scaleX: 0.5 },
    { layer: 1, kind: "triangle", left: "62%", top: "38%", size: 40, color: "pink", opacity: 0.15, rotate: 15, skewX: -8, scaleX: 0.45 },
    { layer: 1, kind: "outlineTriangle", left: "85%", top: "52%", size: 75, color: "cyan", opacity: 0.14, rotate: 42, skewX: 14, scaleX: 0.4 },

    { layer: 1, kind: "outlineTriangle", left: "8%", top: "72%", size: 65, color: "yellow", opacity: 0.16, rotate: 25, skewX: -12, scaleX: 0.48 },
    { layer: 1, kind: "triangle", left: "22%", top: "82%", size: 50, color: "pink", opacity: 0.15, rotate: -18, skewX: 8, scaleX: 0.52 },
    { layer: 1, kind: "outlineTriangle", left: "48%", top: "68%", size: 55, color: "theme", opacity: 0.15, rotate: 60, skewX: -15, scaleX: 0.44 },
    { layer: 1, kind: "triangle", left: "72%", top: "78%", size: 45, color: "white", opacity: 0.18, rotate: -32, skewX: 10, scaleX: 0.4 },
    { layer: 1, kind: "outlineTriangle", left: "90%", top: "88%", size: 70, color: "yellow", opacity: 0.14, rotate: 18, skewX: -8, scaleX: 0.46 },

    // LAYER 2: Middle-Parallax Layer (Beautiful float dynamics)
    { layer: 2, kind: "outlineTriangle", left: "18%", top: "18%", size: 55, color: "pink", opacity: 0.20, rotate: 22, skewX: -6, scaleX: 0.52 },
    { layer: 2, kind: "triangle", left: "42%", top: "8%", size: 35, color: "cyan", opacity: 0.18, rotate: 38, skewX: 8, scaleX: 0.45 },
    { layer: 2, kind: "outlineTriangle", left: "68%", top: "18%", size: 50, color: "theme", opacity: 0.18, rotate: -15, skewX: 12, scaleX: 0.48 },
    
    { layer: 2, kind: "outlineTriangle", left: "4%", top: "55%", size: 40, color: "white", opacity: 0.22, rotate: -40, skewX: -10, scaleX: 0.4 },
    { layer: 2, kind: "outlineTriangle", left: "26%", top: "62%", size: 50, color: "yellow", opacity: 0.20, rotate: 48, skewX: 15, scaleX: 0.45 },
    { layer: 2, kind: "triangle", left: "55%", top: "58%", size: 35, color: "pink", opacity: 0.22, rotate: -28, skewX: -8, scaleX: 0.5 },
    { layer: 2, kind: "outlineTriangle", left: "78%", top: "65%", size: 45, color: "theme", opacity: 0.20, rotate: 35, skewX: 10, scaleX: 0.42 },

    { layer: 2, kind: "outlineTriangle", left: "15%", top: "95%", size: 50, color: "cyan", opacity: 0.18, rotate: -22, skewX: 14, scaleX: 0.46 },
    { layer: 2, kind: "triangle", left: "38%", top: "88%", size: 38, color: "pink", opacity: 0.22, rotate: 18, skewX: -10, scaleX: 0.52 },
    { layer: 2, kind: "outlineTriangle", left: "60%", top: "92%", size: 48, color: "white", opacity: 0.22, rotate: -35, skewX: 8, scaleX: 0.44 },
    { layer: 2, kind: "triangle", left: "84%", top: "96%", size: 42, color: "yellow", opacity: 0.18, rotate: 40, skewX: -12, scaleX: 0.48 },

    // LAYER 3: Forefront Layer (Floating close-up shards)
    { layer: 3, kind: "outlineTriangle", left: "10%", top: "30%", size: 38, color: "theme", opacity: 0.24, rotate: 12, skewX: -5, scaleX: 0.5 },
    { layer: 3, kind: "triangle", left: "32%", top: "28%", size: 28, color: "white", opacity: 0.22, rotate: -22, skewX: 6, scaleX: 0.46 },
    { layer: 3, kind: "outlineTriangle", left: "58%", top: "32%", size: 42, color: "cyan", opacity: 0.24, rotate: 45, skewX: -8, scaleX: 0.42 },
    { layer: 3, kind: "triangle", left: "80%", top: "30%", size: 30, color: "pink", opacity: 0.24, rotate: -15, skewX: 10, scaleX: 0.48 },

    { layer: 3, kind: "outlineTriangle", left: "20%", top: "75%", size: 40, color: "yellow", opacity: 0.24, rotate: 32, skewX: 12, scaleX: 0.45 },
    { layer: 3, kind: "triangle", left: "45%", top: "72%", size: 25, color: "theme", opacity: 0.22, rotate: -42, skewX: -6, scaleX: 0.52 },
    { layer: 3, kind: "outlineTriangle", left: "65%", top: "76%", size: 38, color: "white", opacity: 0.24, rotate: 18, skewX: 8, scaleX: 0.4 },
    { layer: 3, kind: "triangle", left: "88%", top: "74%", size: 32, color: "cyan", opacity: 0.24, rotate: -28, skewX: -10, scaleX: 0.46 },
];

function shapeClassName(shape: ParallaxShape) {
    const animationClass = shape.layer === 1
        ? styles.shapeFloat1
        : shape.layer === 2
            ? styles.shapeFloat2
            : styles.shapeFloat3;

    if (shape.kind === "outlineTriangle") return `${styles.shape} ${styles.shapeOutlineTriangle} ${animationClass}`;
    if (shape.kind === "circle") return `${styles.shape} ${styles.shapeCircle} ${animationClass}`;
    return `${styles.shape} ${styles.shapeTriangle} ${animationClass}`;
}

function shapeColor(shape: ParallaxShape) {
    switch (shape.color) {
        case "theme":
            return "rgb(var(--color-miku-rgb, 51, 204, 187))";
        case "cyan":
            return "rgb(var(--color-miku-rgb, 119, 238, 227))";
        case "pink":
            return "rgb(var(--color-comp-rgb, 255, 117, 168))";
        case "yellow":
            return "rgb(var(--color-mid-rgb, 255, 229, 138))";
        case "white":
            return "#ffffff";
    }
}

function renderParallaxShapes(layer: ParallaxShape["layer"]) {
    return PARALLAX_SHAPES.filter((shape) => shape.layer === layer).map((shape, index) => {
        // Enhance rotation and scale dynamics to guarantee crisp, non-equilateral, elongated scalene world shards
        const skewX = shape.skewX !== undefined ? `skewX(${shape.skewX}deg) ` : "";
        const scaleX = shape.scaleX !== undefined ? `scaleX(${shape.scaleX}) ` : "";
        const scaleY = shape.scaleX !== undefined ? `scaleY(${shape.scaleX * 1.5}) ` : ""; // Make it extremely elongated vertically!
        
        return (
            <span
                key={`${layer}-${index}`}
                className={shapeClassName(shape)}
                style={{
                    left: shape.left,
                    top: shape.top,
                    width: shape.size,
                    height: shape.size,
                    color: shapeColor(shape),
                    opacity: shape.opacity,
                    // Inject skew and aspect ratios to create magnificent, non-equilateral official crystal triangular elements!
                    transform: `${scaleX}${scaleY}${skewX}rotate(${shape.rotate}deg)`,
                }}
            />
        );
    });
}

export default function BackgroundPattern() {
    const { themeColor, resolvedColorScheme, backgroundAnimationBudget } = useTheme();
    const isPerformanceBudget = backgroundAnimationBudget === "performance";
    const isPowerSaveBudget = backgroundAnimationBudget === "power-save";
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Stable references to keep logical updates highly optimized and avoid re-renders
    const shardsRef = useRef<Shard[]>([]);
    const hugeTrianglesRef = useRef<HugeTriangle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000, active: false, lastActive: 0 });
    const metricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1 });
    const performanceProfileRef = useRef<BackgroundPerformanceProfile | null>(null);
    const renderOnceRef = useRef<(() => void) | null>(null);

    const scrollRef = useRef({
        targetY: 0,
        smoothY: 0,
        velocity: 0,
        wind: 0,
        lastSmoothY: 0
    });

    // Core Particle Generation on mount and budget changes.
    useEffect(() => {
        const profile = getBackgroundPerformanceProfile(backgroundAnimationBudget);
        performanceProfileRef.current = profile;

        // 1. Generate Massive Background Structural Triangles (Behind all, slow parallax)
        const hugeTriangles: HugeTriangle[] = [];
        for (let i = 0; i < profile.hugeTriangleCount; i++) {
            hugeTriangles.push({
                baseX: i === 0 ? 0.2 : 0.8,
                baseY: i === 0 ? 0.3 : 0.7,
                size: 320 + Math.random() * 160,
                depth: i === 0 ? 0.05 : 0.1, // extremely slow scroll parallax
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.0001,
                vx: (Math.random() - 0.5) * 0.000035,
                vy: (Math.random() - 0.5) * 0.000035,
                alpha: 0.006 + Math.random() * 0.008, // extremely faint background structure
                points: generateTrianglePoints()
            });
        }
        hugeTrianglesRef.current = hugeTriangles;

        // 2. Generate Floating Elements (Triangles, Circles, Rings, Dots)
        const shards: Shard[] = [];

        for (let i = 0; i < profile.shardCount; i++) {
            // Determine type distribution: 55% Triangles, 28% Circles/Rings, 17% Tiny Dots
            const randType = Math.random();
            let type: ElementType = "triangle";
            let filled = Math.random() < 0.35; // outline-focused, like the official site
            let size = 22 + Math.random() * 38; // standard floating size

            if (randType < 0.55) {
                type = "triangle";
            } else if (randType < 0.83) {
                type = "circle";
            } else {
                type = "dot";
                filled = true;
                size = 3 + Math.random() * 4; // tiny solid dots
            }

            // Distort the generated triangle in canvas mode so we NEVER render ordinary equilateral triangles!
            // Beautiful aspect scale ratio & skew matches static DOM layers.
            const scaleX = type === "triangle" ? 0.6 + Math.random() * 0.2 : 1;
            const skewX = type === "triangle" ? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10) : 0;

            // Evenly distribute across the entire screen width for uniform harmony!
            const baseX = Math.random();

            shards.push({
                type,
                baseX,
                baseY: Math.random(),
                size,
                depth: 0.2 + Math.random() * 1.1, // z-layers
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.002,
                vx: (Math.random() - 0.5) * 0.0001, // slow down drift velocity for higher static consistency
                vy: (Math.random() - 0.5) * 0.0001,
                // Soft alpha, like the official site
                alpha: type === "dot"
                    ? 0.28 + Math.random() * 0.24 // Dots are tiny so they can be slightly more visible
                    : 0.12 + Math.random() * 0.16, // Slightly clearer alpha limits for large devices
                filled,
                points: type === "triangle" ? generateTrianglePoints() : undefined,
                colorVariant: Math.random() < 0.40 ? "theme" : Math.random() < 0.70 ? "complementary" : Math.random() < 0.85 ? "middle" : "white",
                pushX: 0,
                pushY: 0,
                scaleX,
                skewX
            });
        }
        // Scale down standard floating sizes slightly to make canvas crystals ultra-delicate and elegant
        shards.forEach(shard => {
            if (shard.type !== "dot") {
                shard.size = shard.size * 0.8;
            }
        });
        shardsRef.current = shards;
    }, [backgroundAnimationBudget]);

    // Handle Resize & DPI context scale
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !isPerformanceBudget) return;

        const resizeCanvas = () => {
            const profile = getBackgroundPerformanceProfile(backgroundAnimationBudget);
            performanceProfileRef.current = profile;

            const rect = container.getBoundingClientRect();
            const width = Math.max(1, Math.round(rect.width || window.innerWidth));
            const height = Math.max(1, Math.round(rect.height || window.innerHeight));
            const dpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
            const pixelWidth = Math.max(1, Math.round(width * dpr));
            const pixelHeight = Math.max(1, Math.round(height * dpr));

            if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
            if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.imageSmoothingEnabled = true;
            }

            metricsRef.current = { width, height, dpr };
            if (profile.staticOnly && profile.shardCount === 0 && profile.hugeTriangleCount === 0) {
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            } else {
                renderOnceRef.current?.();
            }
        };

        let resizeFrameId = 0;
        const scheduleResize = () => {
            if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
            resizeFrameId = requestAnimationFrame(() => {
                resizeFrameId = 0;
                resizeCanvas();
            });
        };

        resizeCanvas();

        window.addEventListener("resize", scheduleResize);
        window.addEventListener("orientationchange", scheduleResize);

        const resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => scheduleResize())
            : null;
        if (resizeObserver && container) {
            resizeObserver.observe(container);
        }

        return () => {
            window.removeEventListener("resize", scheduleResize);
            window.removeEventListener("orientationchange", scheduleResize);
            resizeObserver?.disconnect();
            if (resizeFrameId) cancelAnimationFrame(resizeFrameId);
        };
    }, [backgroundAnimationBudget, isPerformanceBudget]);

    // Track scroll globally. Performance keeps the existing smooth tick; power-save only updates on scroll.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || backgroundAnimationBudget === "off") return;

        const profile = getBackgroundPerformanceProfile(backgroundAnimationBudget);
        performanceProfileRef.current = profile;
        let frameId = 0;
        let scroll2 = window.scrollY;
        let timer: ReturnType<typeof setInterval> | null = null;

        const writeOffsets = (scrollValue: number, mode: "performance" | "power-save") => {
            const layer1Factor = mode === "performance" ? 0.4 : 0.30;
            const layer2Factor = mode === "performance" ? 0.22 : 0.16;
            const layer3Factor = mode === "performance" ? 0.09 : 0.07;
            const baseFactor = mode === "performance" ? 0.04 : 0.035;

            container.style.setProperty("--bg-layer-1-y", `${-scrollValue * layer1Factor}px`);
            container.style.setProperty("--bg-layer-2-y", `${-scrollValue * layer2Factor}px`);
            container.style.setProperty("--bg-layer-3-y", `${-scrollValue * layer3Factor}px`);
            container.style.setProperty("--bg-base-y", `${-scrollValue * baseFactor}px`);
        };

        const readScroll = () => {
            frameId = 0;
            scrollRef.current.targetY = window.scrollY;

            if (isPowerSaveBudget) {
                // Official-site style: mutate only a few compositor transforms when scrolling; idle cost is zero.
                writeOffsets(scrollRef.current.targetY, "power-save");
            }
        };

        const updateTick = () => {
            const scroll = scrollRef.current.targetY;
            // 8-frame smooth lag damping! Just like official PJSK:
            // scroll2 += Math.floor(((scroll - scroll2)/8)*10000)/10000;
            scroll2 += (scroll - scroll2) / 8;
            writeOffsets(scroll2, "performance");
        };

        const scheduleScroll = () => {
            if (frameId) return;
            frameId = requestAnimationFrame(readScroll);
        };

        readScroll();
        writeOffsets(scrollRef.current.targetY, isPowerSaveBudget ? "power-save" : "performance");
        window.addEventListener("scroll", scheduleScroll, { passive: true });

        if (isPerformanceBudget) {
            // Keep the current smooth parallax behavior for performance mode.
            timer = setInterval(updateTick, 24);
        }

        return () => {
            window.removeEventListener("scroll", scheduleScroll);
            if (frameId) cancelAnimationFrame(frameId);
            if (timer) clearInterval(timer);
        };
    }, [backgroundAnimationBudget, isPerformanceBudget, isPowerSaveBudget]);

    // Track mouse globally for magnetic repulsion when the device is likely powerful enough.
    useEffect(() => {
        const profile = getBackgroundPerformanceProfile(backgroundAnimationBudget);
        performanceProfileRef.current = profile;
        if (!profile.enableMouseRepulsion) return;

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
            mouseRef.current.active = true;
            mouseRef.current.lastActive = performance.now();
        };

        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        document.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [backgroundAnimationBudget]);

    // Core Animation Frame Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isPerformanceBudget) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const profile = getBackgroundPerformanceProfile(backgroundAnimationBudget);
        performanceProfileRef.current = profile;
        if (!profile.canvasEnabled) return;

        let animationFrameId = 0;
        let lastStepTime = performance.now();
        let lastRenderTime = 0;
        let running = false;

        // Theme colors are stable for this effect run; keep them out of the hot frame path.
        const isDark = resolvedColorScheme === "dark";
        const themeRgb = hexToRgb(themeColor);
        const hsl = rgbToHsl(themeRgb.r, themeRgb.g, themeRgb.b);
        const complementaryHsl = {
            h: (hsl.h + 150) % 360,
            s: Math.max(30, Math.min(hsl.s, 85)),
            l: hsl.l
        };
        const complementaryRgb = hslToRgb(complementaryHsl.h, complementaryHsl.s, complementaryHsl.l);

        const midHsl = {
            h: (hsl.h + 60) % 360,
            s: Math.max(30, Math.min(hsl.s, 80)),
            l: hsl.l
        };
        const midRgb = hslToRgb(midHsl.h, midHsl.s, midHsl.l);

        const washAlpha = isDark ? 0.018 : 0.01;
        const gridAlpha = isDark ? 0.06 : 0.035;

        const renderScene = (now = performance.now(), force = false) => {
            const metrics = metricsRef.current;
            const width = metrics.width || Math.max(1, canvas.clientWidth || window.innerWidth);
            const height = metrics.height || Math.max(1, canvas.clientHeight || window.innerHeight);
            const dpr = metrics.dpr || 1;

            if (width <= 0 || height <= 0) return;

            if (profile.staticOnly && profile.shardCount === 0 && profile.hugeTriangleCount === 0) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }

            const scroll = scrollRef.current;
            const mouse = mouseRef.current;
            const isMouseActive = profile.enableMouseRepulsion && mouse.active && (now - mouse.lastActive < 900);
            const isScrollSettling = Math.abs(scroll.targetY - scroll.smoothY) > 0.6 || Math.abs(scroll.wind) > 0.08;
            const targetFps = isMouseActive || isScrollSettling ? profile.activeFps : profile.idleFps;

            if (!force && now - lastRenderTime < 1000 / targetFps) {
                return;
            }

            const deltaTime = force ? 1 : Math.min((now - lastStepTime) / 16.666, 6); // cap simulation steps
            lastStepTime = now;
            lastRenderTime = now;

            if (profile.staticOnly) {
                scroll.velocity = 0;
                scroll.wind = 0;
                scroll.smoothY = scroll.targetY;
                scroll.lastSmoothY = scroll.smoothY;
            } else {
                // Interpolate scrolling for smooth organic lag
                scroll.smoothY += (scroll.targetY - scroll.smoothY) * 0.075 * deltaTime;

                // Scroll velocity and dynamic wind physics
                scroll.velocity = scroll.smoothY - scroll.lastSmoothY;
                scroll.lastSmoothY = scroll.smoothY;

                // wind force decays smoothly
                scroll.wind = scroll.wind * Math.pow(0.9, deltaTime) + (scroll.velocity * 0.07);
            }

            // Clear canvas in device pixels, then draw in logical CSS pixels.
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Ambient background tint
            ctx.fillStyle = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${washAlpha})`;
            ctx.fillRect(0, 0, width, height);

            // 1. DRAW GIGANTIC STRUCTURAL BACKGROUND TRIANGLES (Deep layer)
            for (const tri of hugeTrianglesRef.current) {
                if (!profile.staticOnly) {
                    // Slowly float and rotate
                    tri.rotation += tri.rotationSpeed * deltaTime;
                    tri.baseX += tri.vx * deltaTime;
                    tri.baseY += tri.vy * deltaTime;

                    // Wrap coordinate system around viewport
                    if (tri.baseX < -0.4) tri.baseX += 1.8;
                    if (tri.baseX > 1.4) tri.baseX -= 1.8;
                    if (tri.baseY < -0.4) tri.baseY += 1.8;
                    if (tri.baseY > 1.4) tri.baseY -= 1.8;
                }

                const tx = tri.baseX * width;
                const ty = (tri.baseY * height - scroll.smoothY * tri.depth * 0.2) % height;
                const drawY = ty < -tri.size ? ty + height + tri.size : ty;

                ctx.save();
                ctx.translate(tx, drawY);
                ctx.rotate(tri.rotation);

                ctx.beginPath();
                tri.points.forEach((pt, index) => {
                    const px = pt.x * tri.size;
                    const py = pt.y * tri.size;
                    if (index === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.closePath();

                // Solid low-alpha fill avoids per-frame gradient allocation.
                ctx.fillStyle = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${tri.alpha * (isDark ? 1.25 : 1.8)})`;
                ctx.fill();
                ctx.restore();
            }

            // 2. DRAW SUBTLE GRID OF CROSSES
            if (profile.drawGrid) {
                const gridSpacing = 170;
                const gridDepth = 0.15;
                const driftOffset = profile.staticOnly ? 0 : (now * 0.0012) % gridSpacing;
                const gridScrollY = (scroll.smoothY * gridDepth) % gridSpacing;
                const gridXOffset = (width / 2) % gridSpacing;
                const gridYOffset = (height / 2 - gridScrollY + driftOffset) % gridSpacing;

                ctx.strokeStyle = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${gridAlpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();

                for (let x = gridXOffset - gridSpacing; x < width + gridSpacing; x += gridSpacing) {
                    for (let y = gridYOffset - gridSpacing; y < height + gridSpacing; y += gridSpacing) {
                        ctx.moveTo(x - 3, y);
                        ctx.lineTo(x + 3, y);
                        ctx.moveTo(x, y - 3);
                        ctx.lineTo(x, y + 3);
                    }
                }

                ctx.stroke();
            }

            // 3. DRAW DYNAMIC FLOATING ELEMENTS (Triangles, Circles, Rings, Dots)
            for (const shard of shardsRef.current) {
                if (!profile.staticOnly) {
                    // Apply drifting
                    shard.baseX += shard.vx * deltaTime;
                    shard.baseY += shard.vy * deltaTime;
                    if (shard.type === "triangle") {
                        shard.rotation += shard.rotationSpeed * deltaTime;
                    }

                    // Wrap coordinate system around viewport
                    if (shard.baseX < -0.15) shard.baseX += 1.3;
                    if (shard.baseX > 1.15) shard.baseX -= 1.3;
                    if (shard.baseY < -0.15) shard.baseY += 1.3;
                    if (shard.baseY > 1.15) shard.baseY -= 1.3;
                }

                // Calculate base render position in canvas pixels
                const shardPxX = shard.baseX * width;

                // Add scroll parallax based on depth layers (z value)
                const windDisplacement = scroll.wind * (1.5 - shard.depth) * 0.7;
                const parallaxY = shard.baseY * height - (scroll.smoothY * shard.depth * 0.24) + windDisplacement;
                const shardPxY = (parallaxY % height + height) % height;

                // Proximity Mouse Repulsion
                let pushTargetX = 0;
                let pushTargetY = 0;

                if (isMouseActive) {
                    const dx = shardPxX - mouse.x;
                    const dy = shardPxY - mouse.y;
                    const distanceSquared = dx * dx + dy * dy;
                    const triggerRadius = 190;
                    const triggerRadiusSquared = triggerRadius * triggerRadius;

                    if (distanceSquared < triggerRadiusSquared && distanceSquared > 0) {
                        const dist = Math.sqrt(distanceSquared);
                        const repulsionForce = (1 - dist / triggerRadius); // 0 to 1
                        const strength = repulsionForce * 28 * (shard.depth + 0.3);
                        pushTargetX = (dx / dist) * strength;
                        pushTargetY = (dy / dist) * strength;
                    }
                }

                // Smooth rebound animation
                shard.pushX += (pushTargetX - shard.pushX) * 0.075 * deltaTime;
                shard.pushY += (pushTargetY - shard.pushY) * 0.075 * deltaTime;

                const drawX = shardPxX + shard.pushX;
                const drawY = shardPxY + shard.pushY;

                // Edge boundary fading to prevent popping
                const padding = 80;
                const fadeX = Math.min(drawX, width - drawX) / padding;
                const fadeY = Math.min(drawY, height - drawY) / padding;
                const boundaryAlpha = clamp01(Math.min(fadeX, fadeY));

                if (boundaryAlpha <= 0) continue;

                const visibilityBoost = isDark ? 1.2 : 1.75;
                const drawAlpha = Math.min(shard.alpha * boundaryAlpha * visibilityBoost, shard.type === "dot" ? 0.65 : 0.28);
                const strokeAlpha = Math.min(drawAlpha * 2.1, 0.5);

                // Dynamic colors based on variant
                let r1 = themeRgb.r, g1 = themeRgb.g, b1 = themeRgb.b;

                if (shard.colorVariant === "white") {
                    r1 = isDark ? 230 : 255; g1 = isDark ? 245 : 255; b1 = 255;
                } else if (shard.colorVariant === "complementary") {
                    r1 = complementaryRgb.r; g1 = complementaryRgb.g; b1 = complementaryRgb.b;
                } else if (shard.colorVariant === "middle") {
                    r1 = midRgb.r; g1 = midRgb.g; b1 = midRgb.b;
                }

                // DRAW BY TYPE
                if (shard.type === "triangle" && shard.points) {
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    
                    // Apply scale & skew transform to Canvas rendering context to exactly mimic non-equilateral DOM elements!
                    if (shard.scaleX !== undefined) {
                        ctx.scale(shard.scaleX, 1);
                    }
                    if (shard.skewX !== undefined) {
                        ctx.transform(1, 0, Math.tan(shard.skewX * Math.PI / 180), 1, 0, 0);
                    }
                    ctx.rotate(shard.rotation);

                    ctx.beginPath();
                    shard.points.forEach((pt, index) => {
                        const px = pt.x * shard.size;
                        const py = pt.y * shard.size;
                        if (index === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.closePath();

                    if (shard.filled) {
                        ctx.fillStyle = `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha})`;
                        ctx.fill();
                    } else {
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${strokeAlpha})`;
                        ctx.stroke();
                    }
                    ctx.restore();

                } else if (shard.type === "circle") {
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, shard.size * 0.5, 0, Math.PI * 2);
                    ctx.closePath();

                    if (shard.filled) {
                        ctx.fillStyle = `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha * 0.65})`;
                        ctx.fill();
                    } else {
                        ctx.lineWidth = 1.2;
                        ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${strokeAlpha})`;
                        ctx.stroke();
                    }

                } else if (shard.type === "dot") {
                    // Add a tiny twinkle to dots, only while animating.
                    const twinkle = profile.staticOnly ? 0.85 : 0.75 + Math.sin(now * 0.0035 + shard.baseX * 10) * 0.25;

                    ctx.beginPath();
                    ctx.arc(drawX, drawY, shard.size * 0.5, 0, Math.PI * 2);
                    ctx.closePath();

                    ctx.fillStyle = `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha * twinkle})`;
                    ctx.fill();
                }
            }
        };

        renderOnceRef.current = () => renderScene(performance.now(), true);
        renderOnceRef.current();

        const stop = () => {
            running = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = 0;
            }
        };

        const tick = (now: number) => {
            animationFrameId = 0;
            if (!running) return;

            renderScene(now);
            animationFrameId = requestAnimationFrame(tick);
        };

        const start = () => {
            if (running || profile.staticOnly) return;
            running = true;
            lastStepTime = performance.now();
            lastRenderTime = 0;
            animationFrameId = requestAnimationFrame(tick);
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else {
                start();
                renderOnceRef.current?.();
            }
        };

        if (!profile.staticOnly) {
            start();
            document.addEventListener("visibilitychange", handleVisibilityChange);
        }

        return () => {
            stop();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            renderOnceRef.current = null;
        };
    }, [themeColor, resolvedColorScheme, backgroundAnimationBudget, isPerformanceBudget]);

    const layer1Elements = React.useMemo(() => renderParallaxShapes(1), []);
    const layer2Elements = React.useMemo(() => renderParallaxShapes(2), []);
    const layer3Elements = React.useMemo(() => renderParallaxShapes(3), []);

    return (
        <div
            ref={containerRef}
            className={styles.bgPatternContainer}
            data-budget={backgroundAnimationBudget}
            aria-hidden="true"
        >
            {(isPerformanceBudget || isPowerSaveBudget) && (
                <>
                    <div className={`${styles.parallaxLayer} ${styles.parallaxLayer1}`}>
                        {layer1Elements}
                    </div>
                    <div className={`${styles.parallaxLayer} ${styles.parallaxLayer2}`}>
                        {layer2Elements}
                    </div>
                    <div className={`${styles.parallaxLayer} ${styles.parallaxLayer3}`}>
                        {layer3Elements}
                    </div>
                    {isPerformanceBudget && <canvas ref={canvasRef} className={styles.bgPatternCanvas} />}
                </>
            )}
        </div>
    );
}
