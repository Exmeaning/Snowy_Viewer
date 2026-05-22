"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
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
    colorVariant: "theme" | "complementary" | "white";
    pushX: number; // mouse repulsion offset X
    pushY: number; // mouse repulsion offset Y
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
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// Generate beautiful scalene or isosceles triangle points centered at (0,0)
const generateTrianglePoints = (): { x: number; y: number }[] => {
    // Distribute angles roughly in a circle with random perturbation
    const a1 = Math.random() * (Math.PI * 2 / 3);
    const a2 = Math.PI * 2 / 3 + Math.random() * (Math.PI * 2 / 3);
    const a3 = Math.PI * 4 / 3 + Math.random() * (Math.PI * 2 / 3);

    const r1 = 0.55 + Math.random() * 0.45;
    const r2 = 0.55 + Math.random() * 0.45;
    const r3 = 0.55 + Math.random() * 0.45;

    return [
        { x: Math.cos(a1) * r1, y: Math.sin(a1) * r1 },
        { x: Math.cos(a2) * r2, y: Math.sin(a2) * r2 },
        { x: Math.cos(a3) * r3, y: Math.sin(a3) * r3 }
    ];
};

const MAX_DPR = 1.5;

export default function BackgroundPattern() {
    const { themeColor, resolvedColorScheme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Stable references to keep logical updates highly optimized and avoid re-renders
    const shardsRef = useRef<Shard[]>([]);
    const hugeTrianglesRef = useRef<HugeTriangle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000, active: false, lastActive: 0 });

    const scrollRef = useRef({
        targetY: 0,
        smoothY: 0,
        velocity: 0,
        wind: 0,
        lastSmoothY: 0
    });

    // Core Particle Generation on Mount
    useEffect(() => {
        // 1. Generate Massive Background Structural Triangles (Behind all, slow parallax)
        const hugeTriangles: HugeTriangle[] = [];
        const numHuge = 2;
        for (let i = 0; i < numHuge; i++) {
            hugeTriangles.push({
                baseX: i === 0 ? 0.2 : 0.8,
                baseY: i === 0 ? 0.3 : 0.7,
                size: 600 + Math.random() * 300,
                depth: i === 0 ? 0.05 : 0.1, // extremely slow scroll parallax
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.00015,
                vx: (Math.random() - 0.5) * 0.00005,
                vy: (Math.random() - 0.5) * 0.00005,
                alpha: 0.007 + Math.random() * 0.008, // super faint
                points: generateTrianglePoints()
            });
        }
        hugeTrianglesRef.current = hugeTriangles;

        // 2. Generate Floating Elements (Triangles, Circles, Rings, Dots)
        const shards: Shard[] = [];
        const numFloating = 48;

        for (let i = 0; i < numFloating; i++) {
            // Determine type distribution: 55% Triangles, 28% Circles/Rings, 17% Tiny Dots
            const randType = Math.random();
            let type: ElementType = "triangle";
            let filled = Math.random() < 0.35; // outline-focused, like the official site
            let size = 20 + Math.random() * 35; // standard floating size

            if (randType < 0.55) {
                type = "triangle";
            } else if (randType < 0.83) {
                type = "circle";
            } else {
                type = "dot";
                filled = true;
                size = 3 + Math.random() * 4; // tiny solid dots
            }

            shards.push({
                type,
                baseX: Math.random(),
                baseY: Math.random(),
                size,
                depth: 0.2 + Math.random() * 1.1, // z-layers
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.003,
                vx: (Math.random() - 0.5) * 0.0003,
                vy: (Math.random() - 0.5) * 0.0003,
                // Soft alpha, like the official site
                alpha: type === "dot" 
                    ? 0.15 + Math.random() * 0.2 // Dots are tiny so they can be slightly more visible
                    : 0.03 + Math.random() * 0.09, 
                filled,
                points: type === "triangle" ? generateTrianglePoints() : undefined,
                colorVariant: Math.random() < 0.45 ? "theme" : Math.random() < 0.75 ? "complementary" : "white",
                pushX: 0,
                pushY: 0
            });
        }
        shardsRef.current = shards;
    }, []);

    // Handle Resize & DPI context scale
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            const width = rect.width || window.innerWidth;
            const height = rect.height || window.innerHeight;

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            canvas.width = width * dpr;
            canvas.height = height * dpr;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.imageSmoothingEnabled = true;
            }
        };

        resizeCanvas();

        window.addEventListener("resize", resizeCanvas);
        window.addEventListener("orientationchange", resizeCanvas);

        const resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(() => resizeCanvas())
            : null;
        if (resizeObserver && container) {
            resizeObserver.observe(container);
        }

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            window.removeEventListener("orientationchange", resizeCanvas);
            resizeObserver?.disconnect();
        };
    }, []);

    // Track scroll globally
    useEffect(() => {
        const handleScroll = () => {
            scrollRef.current.targetY = window.scrollY;
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Track mouse globally for magnetic repulsion
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
            mouseRef.current.active = true;
            mouseRef.current.lastActive = performance.now();
        };

        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, []);

    // Core Animation Frame Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId = 0;
        let lastTime = performance.now();

        const tick = () => {
            const now = performance.now();
            const deltaTime = Math.min((now - lastTime) / 16.666, 4); // cap simulation steps
            lastTime = now;

            const rect = canvas.getBoundingClientRect();
            const width = rect.width || window.innerWidth;
            const height = rect.height || window.innerHeight;

            if (width <= 0 || height <= 0) {
                animationFrameId = requestAnimationFrame(tick);
                return;
            }

            // Theme colors
            const isDark = resolvedColorScheme === "dark";
            const themeRgb = hexToRgb(themeColor);
            const hsl = rgbToHsl(themeRgb.r, themeRgb.g, themeRgb.b);

            // Compute Complementary / Hue-shifted dynamic color for pastels
            // Sega website utilizes cyan, magenta, and white. A 150 degree shift creates cyan/pink harmony
            const complementaryHsl = { 
                ...hsl, 
                h: (hsl.h + 150) % 360, 
                s: Math.min(hsl.s + 10, 100), 
                l: isDark ? 65 : 45 
            };
            const complementaryRgb = hslToRgb(complementaryHsl.h, complementaryHsl.s, complementaryHsl.l);

            // Interpolate scrolling for smooth organic lag
            const scroll = scrollRef.current;
            scroll.smoothY += (scroll.targetY - scroll.smoothY) * 0.075 * deltaTime;

            // Scroll velocity and dynamic wind physics
            scroll.velocity = scroll.smoothY - scroll.lastSmoothY;
            scroll.lastSmoothY = scroll.smoothY;

            // wind force decays smoothly
            scroll.wind = scroll.wind * Math.pow(0.92, deltaTime) + (scroll.velocity * 0.08);

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Ambient background tint
            ctx.save();
            const washAlpha = isDark ? 0.012 : 0.006;
            ctx.fillStyle = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${washAlpha})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();

            // 1. DRAW GIGANTIC STRUCTURAL BACKGROUND TRIANGLES (Deep layer)
            hugeTrianglesRef.current.forEach(tri => {
                // Slowly float and rotate
                tri.rotation += tri.rotationSpeed * deltaTime;
                tri.baseX += tri.vx * deltaTime;
                tri.baseY += tri.vy * deltaTime;

                // Wrap coordinate system around viewport
                if (tri.baseX < -0.4) tri.baseX += 1.8;
                if (tri.baseX > 1.4) tri.baseX -= 1.8;
                if (tri.baseY < -0.4) tri.baseY += 1.8;
                if (tri.baseY > 1.4) tri.baseY -= 1.8;

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

                // Structural shapes filled with extremely soft radial-like linear gradient
                const grad = ctx.createLinearGradient(
                    -tri.size * 0.5, -tri.size * 0.5,
                    tri.size * 0.5, tri.size * 0.5
                );
                const triAlpha = tri.alpha;
                grad.addColorStop(0, `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${triAlpha})`);
                grad.addColorStop(1, `rgba(${complementaryRgb.r}, ${complementaryRgb.g}, ${complementaryRgb.b}, ${triAlpha * 0.1})`);

                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();
            });

            // 2. DRAW SUBTLE GRID OF CROSSES
            ctx.save();
            const gridSpacing = 160;
            const gridDepth = 0.15;
            const gridAlpha = isDark ? 0.03 : 0.015;

            const driftOffset = (now * 0.002) % gridSpacing;
            const gridScrollY = (scroll.smoothY * gridDepth) % gridSpacing;
            const gridXOffset = (width / 2) % gridSpacing;
            const gridYOffset = (height / 2 - gridScrollY + driftOffset) % gridSpacing;

            ctx.strokeStyle = `rgba(${themeRgb.r}, ${themeRgb.g}, ${themeRgb.b}, ${gridAlpha})`;
            ctx.lineWidth = 1;

            for (let x = gridXOffset - gridSpacing; x < width + gridSpacing; x += gridSpacing) {
                for (let y = gridYOffset - gridSpacing; y < height + gridSpacing; y += gridSpacing) {
                    ctx.beginPath();
                    ctx.moveTo(x - 3, y);
                    ctx.lineTo(x + 3, y);
                    ctx.moveTo(x, y - 3);
                    ctx.lineTo(x, y + 3);
                    ctx.stroke();
                }
            }
            ctx.restore();

            // 3. DRAW DYNAMIC FLOATING ELEMENTS (Triangles, Circles, Rings, Dots)
            const activeShards = shardsRef.current;
            const mouse = mouseRef.current;
            const isMouseActive = mouse.active && (now - mouse.lastActive < 2000);

            activeShards.forEach(shard => {
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

                // Calculate base render position in canvas pixels
                const shardPxX = shard.baseX * width;
                
                // Add scroll parallax based on depth layers (z value)
                const windDisplacement = scroll.wind * (1.5 - shard.depth) * 0.8;
                const parallaxY = shard.baseY * height - (scroll.smoothY * shard.depth * 0.28) + windDisplacement;
                const shardPxY = (parallaxY % height + height) % height;

                // Proximity Mouse Repulsion
                let pushTargetX = 0;
                let pushTargetY = 0;

                if (isMouseActive) {
                    const dx = shardPxX - mouse.x;
                    const dy = shardPxY - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const triggerRadius = 220;

                    if (dist < triggerRadius && dist > 0) {
                        const repulsionForce = (1 - dist / triggerRadius); // 0 to 1
                        const strength = repulsionForce * 40 * (shard.depth + 0.3);
                        pushTargetX = (dx / dist) * strength;
                        pushTargetY = (dy / dist) * strength;
                    }
                }

                // Smooth rebound animation
                shard.pushX += (pushTargetX - shard.pushX) * 0.08 * deltaTime;
                shard.pushY += (pushTargetY - shard.pushY) * 0.08 * deltaTime;

                const drawX = shardPxX + shard.pushX;
                const drawY = shardPxY + shard.pushY;

                // Edge boundary fading to prevent popping
                const padding = 80;
                const fadeX = Math.min(drawX, width - drawX) / padding;
                const fadeY = Math.min(drawY, height - drawY) / padding;
                const boundaryAlpha = Math.max(0, Math.min(1, Math.min(fadeX, fadeY)));

                if (boundaryAlpha <= 0) return;

                const drawAlpha = shard.alpha * boundaryAlpha;
                const strokeAlpha = drawAlpha * 2.5;

                // Dynamic colors based on variant
                let r1 = themeRgb.r, g1 = themeRgb.g, b1 = themeRgb.b;
                let r2 = complementaryRgb.r, g2 = complementaryRgb.g, b2 = complementaryRgb.b;

                if (shard.colorVariant === "white") {
                    r1 = isDark ? 230 : 255; g1 = isDark ? 245 : 255; b1 = isDark ? 255 : 255;
                    r2 = themeRgb.r; g2 = themeRgb.g; b2 = themeRgb.b;
                } else if (shard.colorVariant === "complementary") {
                    r1 = complementaryRgb.r; g1 = complementaryRgb.g; b1 = complementaryRgb.b;
                    r2 = themeRgb.r; g2 = themeRgb.g; b2 = themeRgb.b;
                }

                // DRAW BY TYPE
                if (shard.type === "triangle" && shard.points) {
                    ctx.save();
                    ctx.translate(drawX, drawY);
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
                        const grad = ctx.createLinearGradient(
                            -shard.size * 0.5, -shard.size * 0.5,
                            shard.size * 0.5, shard.size * 0.5
                        );
                        grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha})`);
                        grad.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, ${drawAlpha * 0.15})`);
                        ctx.fillStyle = grad;
                        ctx.fill();
                    } else {
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${strokeAlpha})`;
                        ctx.stroke();
                    }
                    ctx.restore();

                } else if (shard.type === "circle") {
                    ctx.save();
                    ctx.translate(drawX, drawY);

                    ctx.beginPath();
                    ctx.arc(0, 0, shard.size * 0.5, 0, Math.PI * 2);
                    ctx.closePath();

                    if (shard.filled) {
                        ctx.fillStyle = `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha * 0.65})`;
                        ctx.fill();
                    } else {
                        ctx.lineWidth = 1.2;
                        ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${strokeAlpha})`;
                        ctx.stroke();
                    }
                    ctx.restore();

                } else if (shard.type === "dot") {
                    ctx.save();
                    ctx.translate(drawX, drawY);

                    // Add a tiny twinkle to dots
                    const twinkle = 0.7 + Math.sin(now * 0.005 + shard.baseX * 10) * 0.3;

                    ctx.beginPath();
                    ctx.arc(0, 0, shard.size * 0.5, 0, Math.PI * 2);
                    ctx.closePath();

                    ctx.fillStyle = `rgba(${r1}, ${g1}, ${b1}, ${drawAlpha * twinkle})`;
                    ctx.fill();
                    ctx.restore();
                }
            });

            // Loop animation schedule
            animationFrameId = requestAnimationFrame(tick);
        };

        animationFrameId = requestAnimationFrame(tick);
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [themeColor, resolvedColorScheme]);

    return (
        <div ref={containerRef} className={styles.bgPatternContainer} aria-hidden="true">
            <canvas ref={canvasRef} className={styles.bgPatternCanvas} />
        </div>
    );
}
