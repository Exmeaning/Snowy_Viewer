"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import styles from "../app/components/BackgroundPattern.module.css";

type ParallaxShape = {
    layer: 1 | 2 | 3;
    kind: "triangle" | "outlineTriangle" | "circle";
    variant?: "large-faint" | "small-bold"; // only meaningful for triangles
    leftPct: number;   // 0..100  (positioning)
    topPct: number;    // 0..100  (positioning)
    size: number;
    color: "theme" | "cyan" | "pink" | "yellow" | "white";
    opacity: number;
    rotate: number;
    skewX: number;     // sharp, non-equilateral scalene silhouette
    scaleX: number;    // varied width-to-height aspect ratio
    scaleY: number;    // elongated vertically, like official crystal shards
    // For triangles only: SVG transform applied to the inner <g> (around shape center).
    // SVG transform syntax: scale(x,y) skewX(deg) rotate(deg), all unitless.
    svgTransform: string;
};

// Layer config: count per layer.
// ~34 shards total provides an elegant official-site feel while keeping GPU
// compositor overhead and memory footprint lightweight across all devices.
const LAYER_CONFIG: Record<ParallaxShape["layer"], { count: number }> = {
    1: { count: 14 },
    2: { count: 12 },
    3: { count: 8 },
};

// Two explicit triangle archetypes (no random opacity/size mixing):
//   large-faint : big shard, high transparency -> soft ambient depth.
//   small-bold  : small shard, low transparency -> crisp visible accents.
const TRIANGLE_VARIANTS = [
    { variant: "large-faint" as const, minSize: 60, maxSize: 95, minOpacity: 0.08, maxOpacity: 0.13 },
    { variant: "small-bold" as const, minSize: 22, maxSize: 38, minOpacity: 0.30, maxOpacity: 0.48 },
];
// Roughly 2/3 of triangles are large-faint (fills the field), 1/3 are small-bold (accents).
const TRIANGLE_VARIANT_SPLIT = 0.67;

// Outline vs filled split, and color palette.
const TRIANGLE_OUTLINE_RATIO = 0.5; // 50% outline triangles, 50% filled
const SHAPE_COLORS: ParallaxShape["color"][] = ["theme", "cyan", "pink", "yellow", "white"];

// Triangle silhouette as SVG polygon points (in a 0..100 viewBox).
// A sharp, elongated scalene crystal.
const TRIANGLE_POLYGON_POINTS = "10,0 0,100 100,85";

// Tiny deterministic PRNG (mulberry32) so SSR and client emit identical arrays
// -> no hydration mismatch. No Math.random() in the hot path.
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return function next() {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Map a uniform [0,1] sample to a [0,100] position that is DENSE near the edges
// (0 and 100) and SPARSE in the center (50) -- keeps the central content area
// visually clear while still covering the whole width. Power < 1 pushes mass
// outward; 0.6 gives a gentle, natural-looking spread.
//
// To guarantee exact LEFT/RIGHT symmetry regardless of the PRNG seed's quirks,
// shards are generated in MIRROR PAIRS: an even-indexed shard gets `pos`, and the
// following odd-indexed shard gets `100 - pos`. This forced balancing removes the
// subtle left-bias that a deterministic seed otherwise introduces (empirically the
// unpaired version averaged ~47.7 instead of 50).
function edgeBiasLeft(rand: () => number, power = 0.6): number {
    const u = rand();                       // [0,1]
    const v = 2 * u - 1;                    // [-1,1]
    const w = Math.sign(v) * Math.pow(Math.abs(v), power); // edge-concentrated
    return 50 + 50 * w;                     // [0,100]
}

// Module-level slot so every other call within a layer returns the mirror of the
// previous call. Reset per layer in buildParallaxShapes.
let edgeBiasPendingMirror: number | null = null;

function balancedEdgeBiasLeft(rand: () => number): number {
    if (edgeBiasPendingMirror !== null) {
        const mirror = edgeBiasPendingMirror;
        edgeBiasPendingMirror = null;
        return mirror;
    }
    const pos = edgeBiasLeft(rand);
    edgeBiasPendingMirror = 100 - pos;
    return pos;
}

function pickColor(rand: () => number): ParallaxShape["color"] {
    return SHAPE_COLORS[Math.floor(rand() * SHAPE_COLORS.length)];
}

function buildTriangle(rand: () => number, layer: ParallaxShape["layer"], cfg: typeof TRIANGLE_VARIANTS[number]): ParallaxShape {
    const color = pickColor(rand);
    const size = cfg.minSize + rand() * (cfg.maxSize - cfg.minSize);
    const opacity = cfg.minOpacity + rand() * (cfg.maxOpacity - cfg.minOpacity);
    const rotate = (rand() * 2 - 1) * 50;
    const skewX = (rand() < 0.5 ? -1 : 1) * (6 + rand() * 12);
    const scaleX = 0.38 + rand() * 0.16;
    const scaleY = scaleX * (1.3 + rand() * 0.4);

    return {
        layer,
        kind: rand() < TRIANGLE_OUTLINE_RATIO ? "outlineTriangle" : "triangle",
        variant: cfg.variant,
        leftPct: balancedEdgeBiasLeft(rand),
        topPct: rand() * 100,
        size,
        color,
        opacity,
        rotate,
        skewX,
        scaleX,
        scaleY,
        // SVG transform (unitless). Order mirrors the old CSS: scale -> skew -> rotate.
        svgTransform: `scale(${scaleX.toFixed(3)} ${scaleY.toFixed(3)}) skewX(${skewX.toFixed(2)}) rotate(${rotate.toFixed(2)})`,
    };
}

function buildCircle(rand: () => number, layer: ParallaxShape["layer"], sizeRange: { min: number; max: number }, opacityRange: { min: number; max: number }): ParallaxShape {
    const size = sizeRange.min + rand() * (sizeRange.max - sizeRange.min);
    const opacity = opacityRange.min + rand() * (opacityRange.max - opacityRange.min);

    return {
        layer,
        kind: "circle",
        leftPct: balancedEdgeBiasLeft(rand),
        topPct: rand() * 100,
        size,
        color: pickColor(rand),
        opacity,
        rotate: 0,
        skewX: 0,
        scaleX: 1,
        scaleY: 1,
        // Circles don't use SVG; this is unused for them but kept for type completeness.
        svgTransform: "",
    };
}

function buildParallaxShapes(): ParallaxShape[] {
    const shapes: ParallaxShape[] = [];
    // Distinct seed per layer keeps distributions visually independent yet stable.
    let layerSeed = 0x9e3779b9;

    // Circle size/opacity grow slightly with each parallax layer (closer = a touch bolder).
    const CIRCLE_SIZE: Record<ParallaxShape["layer"], { min: number; max: number }> = {
        1: { min: 8, max: 14 },
        2: { min: 7, max: 12 },
        3: { min: 6, max: 10 },
    };
    const CIRCLE_OPACITY: Record<ParallaxShape["layer"], { min: number; max: number }> = {
        1: { min: 0.10, max: 0.18 },
        2: { min: 0.14, max: 0.24 },
        3: { min: 0.20, max: 0.32 },
    };

    for (const layer of [1, 2, 3] as const) {
        const { count } = LAYER_CONFIG[layer];
        const rand = mulberry32(layerSeed);
        layerSeed = (layerSeed + 0x85ebca6b) | 0;
        // Reset the mirror-pair state at the start of each layer so pairing does
        // not leak across layers (an odd count leaves one unpaired shard, which
        // is fine -- a single shard contributes negligible asymmetry).
        edgeBiasPendingMirror = null;

        for (let i = 0; i < count; i++) {
            const rKind = rand();
            if (rKind < 0.8) {
                // Triangle: choose archetype by the explicit split.
                const cfg = rand() < TRIANGLE_VARIANT_SPLIT ? TRIANGLE_VARIANTS[0] : TRIANGLE_VARIANTS[1];
                shapes.push(buildTriangle(rand, layer, cfg));
            } else {
                shapes.push(buildCircle(rand, layer, CIRCLE_SIZE[layer], CIRCLE_OPACITY[layer]));
            }
        }
    }

    return shapes;
}

const PARALLAX_SHAPES: ParallaxShape[] = buildParallaxShapes();

function shapeFloatClassName(layer: ParallaxShape["layer"]) {
    return layer === 1
        ? styles.shapeFloat1
        : layer === 2
            ? styles.shapeFloat2
            : styles.shapeFloat3;
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

function renderParallaxShapes(layer: ParallaxShape["layer"], shapes: ParallaxShape[]) {
    return shapes.filter((shape) => shape.layer === layer).map((shape, index) => {
        const color = shapeColor(shape);
        const isCircle = shape.kind === "circle";

        return (
            // OUTER wrapper: owns POSITION (left/top/size) + float animation (transform: translate3d).
            <span
                key={`${layer}-${index}`}
                suppressHydrationWarning
                className={`${styles.shapeFloat} ${shapeFloatClassName(layer)}`}
                style={{
                    // Format to fixed precision so SSR and client serialize identical
                    // strings. Raw numbers (e.g. width: 31.42343393340707) get truncated
                    // differently when SSR HTML is parsed vs when React holds the value
                    // in memory, causing hydration mismatches on every shard. Strings
                    // with fixed precision are emitted verbatim on both sides.
                    left: `${shape.leftPct.toFixed(4)}%`,
                    top: `${shape.topPct.toFixed(4)}%`,
                    width: `${shape.size.toFixed(2)}px`,
                    height: `${shape.size.toFixed(2)}px`,
                }}
            >
                {isCircle ? (
                    // Circles stay perfect circles via border-radius (never deformed).
                    <span
                        suppressHydrationWarning
                        className={`${styles.shape} ${styles.shapeCircle}`}
                        style={{ color, opacity: shape.opacity.toFixed(4) }}
                    />
                ) : (
                    // Triangles are drawn with an SVG <polygon>. This is robust on every
                    // mobile browser (no clip-path -> no "square" degeneration). The inner
                    // <g> carries the bespoke skew/scale/rotate so the float keyframes on
                    // the wrapper never overwrite the silhouette.
                    <svg
                        suppressHydrationWarning
                        className={styles.shapeSvg}
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        style={{ color, opacity: shape.opacity.toFixed(4) }}
                    >
                        <g transform={`translate(50 50) ${shape.svgTransform} translate(-50 -50)`}>
                            {shape.kind === "outlineTriangle" ? (
                                // non-scaling-stroke keeps the outline a constant ~1.4 screen
                                // pixels thick at any shard size -> a thin, crisp crystal shell
                                // (matching the original outline weight, not a thick band).
                                <polygon
                                    points={TRIANGLE_POLYGON_POINTS}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.4}
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ) : (
                                <polygon points={TRIANGLE_POLYGON_POINTS} fill="currentColor" />
                            )}
                        </g>
                    </svg>
                )}
            </span>
        );
    });
}

export default function BackgroundPattern() {
    const { backgroundAnimationBudget } = useTheme();
    const isAnimationEnabled = backgroundAnimationBudget === "on";
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef({
        targetY: 0,
        smoothY: 0,
        lastSmoothY: 0
    });

    /*
     * Scroll-driven parallax + scroll-aware animation pausing.
     *
     * The whole background is now a single CSS/SVG shard field (no canvas, no rAF).
     * While scrolling we write 4 compositor CSS variables to move the parallax layers
     * and pause shard float animations (via the data-scrolling attribute) so they don't
     * compete with the compositor -- this keeps scrolling smooth and, on mobile,
     * prevents clip-path/layer-loss rendering glitches.
     *
     * Idling cost is effectively zero: when not scrolling there is no interval/timer.
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isAnimationEnabled) return;

        let readFrameId = 0;       // coalesces scroll events into one rAF read
        let inertiaRafId = 0;      // rAF-driven inertia loop
        let inertiaTicks = 0;      // safety: hard cap how long inertia can run after scroll stops
        const INERTIA_MAX_TICKS = 90; // ~1.5s @ 60fps ceiling; stops runaway loops on throttled browsers
        let isScrolling = false;
        // Debounce timer: resumes shard animations a short while after scrolling stops.
        let resumeTimer: ReturnType<typeof setTimeout> | null = null;
        const RESUME_DELAY_MS = 220;

        const setScrolling = (value: boolean) => {
            if (isScrolling === value) return;
            isScrolling = value;
            container.dataset.scrolling = value ? "true" : "false";
        };

        const markScrolling = () => {
            setScrolling(true);
            if (resumeTimer) clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => {
                resumeTimer = null;
                setScrolling(false);
            }, RESUME_DELAY_MS);
        };

        const writeOffsets = (scrollValue: number) => {
            const layer1Factor = 0.30;
            const layer2Factor = 0.16;
            const layer3Factor = 0.07;
            const baseFactor = 0.035;

            container.style.setProperty("--bg-layer-1-y", `${-scrollValue * layer1Factor}px`);
            container.style.setProperty("--bg-layer-2-y", `${-scrollValue * layer2Factor}px`);
            container.style.setProperty("--bg-layer-3-y", `${-scrollValue * layer3Factor}px`);
            container.style.setProperty("--bg-base-y", `${-scrollValue * baseFactor}px`);
        };

        // rAF-driven inertia: eases smoothY toward target, aligned to the browser's
        // refresh rate. Self-stops once settled OR after a tick ceiling (so a
        // throttled/hidden tab can never leave it spinning). rAF auto-pauses when the
        // tab is hidden, unlike setInterval which keeps firing and piling up work.
        const inertiaStep = () => {
            inertiaRafId = 0;
            inertiaTicks++;
            const target = scrollRef.current.targetY;
            const delta = target - scrollRef.current.smoothY;
            if (Math.abs(delta) < 0.6 || inertiaTicks >= INERTIA_MAX_TICKS) {
                scrollRef.current.smoothY = target;
                writeOffsets(scrollRef.current.smoothY);
                return; // settled (or safety cap hit) -> stop the loop
            }
            scrollRef.current.smoothY += delta * 0.22; // ~3-frame ease toward target
            writeOffsets(scrollRef.current.smoothY);
            inertiaRafId = requestAnimationFrame(inertiaStep);
        };

        const startInertia = () => {
            if (inertiaRafId) return; // already running
            inertiaTicks = 0;
            inertiaRafId = requestAnimationFrame(inertiaStep);
        };

        const readScroll = () => {
            readFrameId = 0;
            scrollRef.current.targetY = window.scrollY;
            // User is actively scrolling -> pause shard animations (debounced resume).
            markScrolling();
            // Kick off the inertia loop only while scrolling.
            startInertia();
        };

        const scheduleScroll = () => {
            if (readFrameId) return;
            readFrameId = requestAnimationFrame(readScroll);
        };

        readScroll();
        // Initialize offsets (snap immediately on first paint).
        scrollRef.current.smoothY = scrollRef.current.targetY;
        writeOffsets(scrollRef.current.smoothY);
        window.addEventListener("scroll", scheduleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", scheduleScroll);
            if (readFrameId) cancelAnimationFrame(readFrameId);
            if (inertiaRafId) cancelAnimationFrame(inertiaRafId);
            if (resumeTimer) clearTimeout(resumeTimer);
        };
    }, [isAnimationEnabled]);

    // Build the shard field only while animation is enabled. The "off" path keeps
    // the static gradient but avoids creating 120 animated SVG/span nodes.
    const parallaxShapes = React.useMemo(() => PARALLAX_SHAPES, []);
    const layer1Elements = React.useMemo(
        () => isAnimationEnabled ? renderParallaxShapes(1, parallaxShapes) : null,
        [isAnimationEnabled, parallaxShapes]
    );
    const layer2Elements = React.useMemo(
        () => isAnimationEnabled ? renderParallaxShapes(2, parallaxShapes) : null,
        [isAnimationEnabled, parallaxShapes]
    );
    const layer3Elements = React.useMemo(
        () => isAnimationEnabled ? renderParallaxShapes(3, parallaxShapes) : null,
        [isAnimationEnabled, parallaxShapes]
    );

    return (
        <div
            ref={containerRef}
            className={styles.bgPatternContainer}
            data-budget={backgroundAnimationBudget}
            aria-hidden="true"
        >
            {isAnimationEnabled && (
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
                </>
            )}
        </div>
    );
}
