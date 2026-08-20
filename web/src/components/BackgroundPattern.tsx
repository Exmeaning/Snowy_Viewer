"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import styles from "../app/components/BackgroundPattern.module.css";

/**
 * Console home ambient field.
 *
 * What this replaces: a field of ~34 sharp crystal shards. Shards are a graphic;
 * a console home screen is a *lit panel*. So the field is now a handful of very
 * large, very faint radial washes drifting behind the content, plus a hairline
 * geometric grid (owned by the module CSS pseudo-elements). Low contrast is the
 * requirement, not a taste call: this sits under every page in the app and must
 * never compete with a card grid or a ranking table for attention.
 *
 * Softness comes from `radial-gradient`, never from `filter: blur()`. A blurred
 * box costs a full compositor pass per frame; a gradient is painted once into the
 * layer texture and then only translated. That is also why there is no
 * backdrop-filter anywhere in the redesign.
 *
 * Everything about the parallax *engine* below is unchanged and load-bearing:
 * the deterministic PRNG (SSR/client must emit byte-identical markup), the
 * fixed-precision number formatting (same reason), the four CSS custom
 * properties, the rAF inertia loop and the data-scrolling pause flag.
 */

type AmbientLayer = 1 | 2 | 3;

type AmbientShape = {
    layer: AmbientLayer;
    /** wash = large soft radial glow; frame = hairline geometric accent. */
    kind: "wash" | "frame";
    leftPct: number;   // 0..100  (anchor point, wash is centered on it)
    topPct: number;    // 0..100
    /** Wash diameter in vmax; frame edge length in px. */
    size: number;
    color: AmbientColor;
    opacity: number;
    /** Frames only — a slight tilt keeps the texture from reading as UI chrome. */
    rotate: number;
};

type AmbientColor = "theme" | "cyan" | "pink" | "yellow" | "neutral";

/**
 * Per-layer element budget.
 *
 * 15 nodes total, down from ~34 shards. A wash covers a huge area, so a calm
 * field needs far fewer elements than a shard field did — and each one is a
 * single painted gradient rather than an SVG polygon with a non-scaling stroke.
 */
const LAYER_CONFIG: Record<AmbientLayer, { washes: number; frames: number }> = {
    1: { washes: 4, frames: 2 },
    2: { washes: 3, frames: 2 },
    3: { washes: 3, frames: 1 },
};

/**
 * Wash size in vmax and opacity, per layer.
 *
 * Nearer layers (1 has the largest parallax factor) are slightly bigger and
 * slightly stronger, which is what sells the depth ordering. Opacities top out
 * at 0.10 — above roughly 0.12 a wash starts to tint text that sits over it.
 */
const WASH_SPEC: Record<AmbientLayer, { minSize: number; maxSize: number; minOpacity: number; maxOpacity: number }> = {
    1: { minSize: 42, maxSize: 62, minOpacity: 0.07, maxOpacity: 0.10 },
    2: { minSize: 34, maxSize: 52, minOpacity: 0.05, maxOpacity: 0.08 },
    3: { minSize: 28, maxSize: 44, minOpacity: 0.04, maxOpacity: 0.06 },
};

/** Hairline geometric accents. Deliberately near-invisible — texture, not decoration. */
const FRAME_SPEC = { minSize: 96, maxSize: 210, minOpacity: 0.05, maxOpacity: 0.10 };

/** Washes carry theme color; frames stay neutral so they read as etched, not tinted. */
const WASH_COLORS: AmbientColor[] = ["theme", "cyan", "pink", "yellow"];

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
// shapes are generated in MIRROR PAIRS: an even-indexed shape gets `pos`, and the
// following odd-indexed shape gets `100 - pos`. This forced balancing removes the
// subtle left-bias that a deterministic seed otherwise introduces (empirically the
// unpaired version averaged ~47.7 instead of 50).
function edgeBiasLeft(rand: () => number, power = 0.6): number {
    const u = rand();                       // [0,1]
    const v = 2 * u - 1;                    // [-1,1]
    const w = Math.sign(v) * Math.pow(Math.abs(v), power); // edge-concentrated
    return 50 + 50 * w;                     // [0,100]
}

// Module-level slot so every other call within a layer returns the mirror of the
// previous call. Reset per layer in buildAmbientField.
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

function pickWashColor(rand: () => number): AmbientColor {
    return WASH_COLORS[Math.floor(rand() * WASH_COLORS.length)];
}

function buildWash(rand: () => number, layer: AmbientLayer): AmbientShape {
    const spec = WASH_SPEC[layer];
    return {
        layer,
        kind: "wash",
        leftPct: balancedEdgeBiasLeft(rand),
        topPct: rand() * 100,
        size: spec.minSize + rand() * (spec.maxSize - spec.minSize),
        color: pickWashColor(rand),
        opacity: spec.minOpacity + rand() * (spec.maxOpacity - spec.minOpacity),
        rotate: 0,
    };
}

function buildFrame(rand: () => number, layer: AmbientLayer): AmbientShape {
    return {
        layer,
        kind: "frame",
        leftPct: balancedEdgeBiasLeft(rand),
        topPct: rand() * 100,
        size: FRAME_SPEC.minSize + rand() * (FRAME_SPEC.maxSize - FRAME_SPEC.minSize),
        color: "neutral",
        opacity: FRAME_SPEC.minOpacity + rand() * (FRAME_SPEC.maxOpacity - FRAME_SPEC.minOpacity),
        // +/-14deg: enough to read as a loose geometric accent, not enough to look
        // like a tilted card someone forgot to straighten.
        rotate: (rand() * 2 - 1) * 14,
    };
}

function buildAmbientField(): AmbientShape[] {
    const shapes: AmbientShape[] = [];
    // Distinct seed per layer keeps distributions visually independent yet stable.
    let layerSeed = 0x9e3779b9;

    for (const layer of [1, 2, 3] as const) {
        const { washes, frames } = LAYER_CONFIG[layer];
        const rand = mulberry32(layerSeed);
        layerSeed = (layerSeed + 0x85ebca6b) | 0;
        // Reset the mirror-pair state at the start of each layer so pairing does
        // not leak across layers (an odd count leaves one unpaired shape, which
        // is fine -- a single shape contributes negligible asymmetry).
        edgeBiasPendingMirror = null;

        // Washes are emitted BEFORE frames on purpose: the mobile density rules in
        // the module CSS trim each layer with nth-child, so generation order
        // decides what survives on a phone. The washes are the design; the frames
        // are the garnish, and the garnish is what goes first.
        for (let i = 0; i < washes; i++) shapes.push(buildWash(rand, layer));
        for (let i = 0; i < frames; i++) shapes.push(buildFrame(rand, layer));
    }

    return shapes;
}

const AMBIENT_FIELD: AmbientShape[] = buildAmbientField();

function driftClassName(layer: AmbientLayer) {
    return layer === 1
        ? styles.shapeFloat1
        : layer === 2
            ? styles.shapeFloat2
            : styles.shapeFloat3;
}

function shapeColor(shape: AmbientShape) {
    switch (shape.color) {
        case "theme":
            return "rgb(var(--color-miku-rgb, 51, 204, 187))";
        case "cyan":
            return "rgb(var(--color-miku-rgb, 119, 238, 227))";
        case "pink":
            return "rgb(var(--color-comp-rgb, 255, 117, 168))";
        case "yellow":
            return "rgb(var(--color-mid-rgb, 255, 229, 138))";
        case "neutral":
            // Follows the neutral ramp, so the hairline texture stays legible in
            // both themes without a second hardcoded color.
            return "var(--hh-text-tertiary)";
    }
}

function renderAmbientShapes(layer: AmbientLayer, shapes: AmbientShape[]) {
    return shapes.filter((shape) => shape.layer === layer).map((shape, index) => {
        const color = shapeColor(shape);
        const isWash = shape.kind === "wash";
        // Washes are centered on their anchor so a wash near an edge bleeds off it
        // symmetrically instead of hanging off to one side.
        const half = shape.size / 2;

        return (
            // OUTER wrapper: owns POSITION (left/top/size) + drift animation
            // (transform: translate3d/scale only).
            <span
                key={`${layer}-${index}`}
                className={`${styles.shapeFloat} ${driftClassName(layer)}`}
                style={{
                    // Format to fixed precision so SSR and client serialize identical
                    // strings. Raw numbers (e.g. width: 31.42343393340707) get truncated
                    // differently when SSR HTML is parsed vs when React holds the value
                    // in memory, causing hydration mismatches on every element. Strings
                    // with fixed precision are emitted verbatim on both sides.
                    left: `${shape.leftPct.toFixed(4)}%`,
                    top: `${shape.topPct.toFixed(4)}%`,
                    width: isWash ? `${shape.size.toFixed(2)}vmax` : `${shape.size.toFixed(2)}px`,
                    height: isWash ? `${shape.size.toFixed(2)}vmax` : `${shape.size.toFixed(2)}px`,
                    marginLeft: isWash ? `${(-half).toFixed(2)}vmax` : `${(-half).toFixed(2)}px`,
                    marginTop: isWash ? `${(-half).toFixed(2)}vmax` : `${(-half).toFixed(2)}px`,
                }}
            >
                {/* INNER visual: the wash gradient or the hairline frame. Splitting
                    the two means the drift keyframes on the wrapper can never
                    overwrite a frame's rotation. */}
                <span
                    className={`${styles.shape} ${isWash ? styles.shapeWash : styles.shapeFrame}`}
                    style={{
                        color,
                        opacity: Number(shape.opacity.toFixed(4)),
                        transform: isWash ? undefined : `rotate(${shape.rotate.toFixed(2)}deg)`,
                    }}
                />
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
     * The whole background is a single CSS field (no canvas, no per-frame JS paint).
     * While scrolling we write 4 compositor CSS variables to move the parallax layers
     * and pause the drift animations (via the data-scrolling attribute) so they don't
     * compete with the compositor -- this keeps scrolling smooth on mobile.
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
        // Debounce timer: resumes drift animations a short while after scrolling stops.
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
            // User is actively scrolling -> pause drift animations (debounced resume).
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

    // Build the field only while animation is enabled. The "off" path keeps the
    // static gradient but avoids creating the animated nodes at all.
    const ambientShapes = React.useMemo(() => AMBIENT_FIELD, []);
    const layer1Elements = React.useMemo(
        () => isAnimationEnabled ? renderAmbientShapes(1, ambientShapes) : null,
        [isAnimationEnabled, ambientShapes]
    );
    const layer2Elements = React.useMemo(
        () => isAnimationEnabled ? renderAmbientShapes(2, ambientShapes) : null,
        [isAnimationEnabled, ambientShapes]
    );
    const layer3Elements = React.useMemo(
        () => isAnimationEnabled ? renderAmbientShapes(3, ambientShapes) : null,
        [isAnimationEnabled, ambientShapes]
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
