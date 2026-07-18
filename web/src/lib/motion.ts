/**
 * Apple-inspired motion presets for Framer Motion.
 * Defaults are critically damped (no bounce). Use momentum springs only when
 * the gesture itself carried velocity (flick / drag release).
 *
 * Mapping (WWDC Designing Fluid Interfaces → Motion spring API):
 * - damping ratio 1.0 ≈ bounce 0
 * - damping ratio ~0.8 ≈ bounce ~0.15–0.2
 * - response (seconds) ≈ duration
 */

import type { Transition } from "framer-motion";

/** Critically damped UI settle — menus, modals, chrome, toggles */
export const springSnappy: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.32,
};

/** Slightly slower critical settle — large panels / layout shifts */
export const springSoft: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.42,
};

/** Sheet / drawer style — slight bounce only when physically thrown */
export const springSheet: Transition = {
  type: "spring",
  bounce: 0.15,
  duration: 0.36,
};

/** Momentum / flick handoff — under-damped, use with release velocity */
export const springMomentum: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.4,
};

/** Instant press highlight (CSS-friendly ms) */
export const pressDurationMs = 100;

/** Opacity cross-fade when prefers-reduced-motion */
export const reducedMotionFade: Transition = {
  type: "tween",
  duration: 0.18,
  ease: "easeOut",
};

export type MotionPresetName = "snappy" | "soft" | "sheet" | "momentum";

const PRESETS: Record<MotionPresetName, Transition> = {
  snappy: springSnappy,
  soft: springSoft,
  sheet: springSheet,
  momentum: springMomentum,
};

/** Pick a spring preset; falls back to reduced-motion fade when requested. */
export function getMotionTransition(
  name: MotionPresetName = "snappy",
  options?: { reducedMotion?: boolean; velocity?: number }
): Transition {
  if (options?.reducedMotion) {
    return reducedMotionFade;
  }
  const base = PRESETS[name] ?? springSnappy;
  if (typeof options?.velocity === "number" && Number.isFinite(options.velocity)) {
    return { ...base, velocity: options.velocity };
  }
  return base;
}

/**
 * Apple scroll-style momentum projection (exponential decay).
 * Returns how far motion would coast from release velocity (px).
 */
export function projectMomentum(
  initialVelocityPxPerSec: number,
  decelerationRate = 0.998
): number {
  if (!Number.isFinite(initialVelocityPxPerSec) || decelerationRate >= 1 || decelerationRate <= 0) {
    return 0;
  }
  return ((initialVelocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Rubber-band resistance past a boundary (Apple sample form). */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55
): number {
  if (!dimension) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
