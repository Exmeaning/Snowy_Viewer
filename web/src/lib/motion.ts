/**
 * Motion vocabulary — Handheld OS.
 *
 * The console feel comes from one rule: **overshoot is a privilege, not a
 * default.** Exactly one thing in the system is allowed to spring past its
 * target and settle back — the selection cursor. Everything structural
 * (screens, panels, sheets, rails) is critically damped and simply arrives.
 *
 * That split is what separates "fluid" from "bouncy". A UI where everything
 * springs reads as toy-like and, worse, as slow — because overshoot extends
 * the time before a thing looks finished. A UI where nothing springs reads as
 * stiff. Console system UIs put the elasticity exclusively on the cursor, so
 * the pointer feels alive while the furniture stays calm.
 *
 * Timing ladder (the second half of "not stiff"):
 *
 *   press      ~90ms   acknowledge — must beat conscious perception
 *   cursor     ~260ms  travel with overshoot — the signature motion
 *   fast       ~160ms  hover, tint, small state changes
 *   screen     ~240ms  route/screen change, damped
 *   panel      ~300ms  sheets and large panels, damped
 *   stagger      34ms  per-item delay in a grid cascade
 *
 * Nothing in the system is slower than 300ms. Stiffness is usually diagnosed
 * as "not enough animation" when the real cause is *too much duration* — a
 * 500ms ease feels more sluggish than no animation at all. Short and shaped
 * beats long and smooth.
 *
 * The legacy Apple-era exports (springSnappy, springSoft, springSheet,
 * springMomentum, getMotionTransition, projectMomentum, rubberband) are kept
 * with identical names and signatures — 16 modules import them — but their
 * values are retuned to this ladder, so every existing call site inherits the
 * new feel without an edit.
 */

import type { Transition, Variants } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────
   Durations — single source of truth, mirrored by the CSS --hh-dur-* tokens
   in app/handheld-os.css. Keep the two in sync; CSS owns pure-CSS
   transitions, this owns spring/variant motion.
   ────────────────────────────────────────────────────────────────────────── */

export const HH_DURATION = {
  press: 0.09,
  cursor: 0.26,
  fast: 0.16,
  screen: 0.24,
  panel: 0.3,
} as const;

/** Per-item delay in a staggered grid cascade (seconds). */
export const HH_STAGGER_STEP = 0.034;

/** Press highlight in ms, for callers driving CSS/timeouts rather than springs. */
export const pressDurationMs = 90;

/* ──────────────────────────────────────────────────────────────────────────
   Springs
   ────────────────────────────────────────────────────────────────────────── */

/**
 * The cursor. The only preset with real overshoot.
 *
 * bounce 0.28 is deliberately near the top of the usable range: below ~0.2 the
 * overshoot stops being legible and the cursor reads as a plain slide; above
 * ~0.35 it visibly wobbles and starts to feel imprecise, which is fatal for
 * something whose whole job is to point at one thing. 0.28 lands one clear
 * overshoot-and-settle.
 */
export const hhSpringCursor: Transition = {
  type: "spring",
  bounce: 0.28,
  duration: HH_DURATION.cursor,
};

/** Selection scale/lift on the item under the cursor — matches cursor travel. */
export const hhSpringSelect: Transition = {
  type: "spring",
  bounce: 0.22,
  duration: HH_DURATION.cursor,
};

/** Press acknowledgment. Fast enough to feel mechanical rather than animated. */
export const hhSpringPress: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.press,
};

/** Structural motion — screens, panels, rails. Damped: arrives, never wobbles. */
export const hhSpringPanel: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.panel,
};

/** Screen/route change. Damped and slightly quicker than a panel. */
export const hhTweenScreen: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.screen,
};

/* ── Legacy names, retuned onto the ladder above ────────────────────────── */

/** Critically damped UI settle — menus, modals, chrome, toggles. */
export const springSnappy: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.screen,
};

/** Slightly slower critical settle — large panels / layout shifts. */
export const springSoft: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.panel,
};

/** Sheet / drawer. Damped: sheets are furniture, and furniture doesn't bounce. */
export const springSheet: Transition = {
  type: "spring",
  bounce: 0,
  duration: HH_DURATION.panel,
};

/**
 * Momentum / flick handoff — under-damped, pass the release velocity.
 * This keeps real bounce because the user's own gesture supplied the energy;
 * damping a thrown object is what feels wrong, not the bounce.
 */
export const springMomentum: Transition = {
  type: "spring",
  bounce: 0.2,
  duration: 0.4,
};

/** Opacity cross-fade for prefers-reduced-motion. */
export const reducedMotionFade: Transition = {
  type: "tween",
  duration: 0.14,
  ease: "easeOut",
};

/* ──────────────────────────────────────────────────────────────────────────
   Variants

   Each set is a complete initial/animate/exit triple so callers can hand it
   straight to a motion component and get a correct enter *and* exit. Exits are
   consistently shorter than entrances: leaving should never make the user wait
   for the thing they already dismissed.
   ────────────────────────────────────────────────────────────────────────── */

/** Screen / route content. A short rise — no horizontal slide, no bounce. */
export const hhScreenVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: hhTweenScreen },
  exit: { opacity: 0, y: -6, transition: { ...hhTweenScreen, duration: HH_DURATION.fast } },
};

/** Bottom sheet / modal. Rises from the edge with a faint scale. */
export const hhSheetVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: hhSpringPanel },
  exit: { opacity: 0, y: 12, scale: 0.99, transition: { ...hhSpringPanel, duration: HH_DURATION.fast } },
};

/** Side rail. Slides in from the left edge. */
export const hhRailVariants: Variants = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0, transition: hhSpringPanel },
  exit: { opacity: 0, x: -10, transition: { ...hhSpringPanel, duration: HH_DURATION.fast } },
};

/** Dropdown / popover. Grows from its anchor edge. */
export const hhPopoverVariants: Variants = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...hhSpringPanel, duration: HH_DURATION.fast } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { type: "tween", duration: 0.1, ease: "easeOut" } },
};

/**
 * Grid tile. `custom` is the item index, which drives the cascade delay.
 *
 * The cascade is capped at 12 steps (~0.41s): past that the delay stops
 * reading as one gesture and starts reading as a queue the user is waiting on,
 * which is exactly the stiffness this whole file exists to avoid. Long lists
 * keep a cascade at the top and arrive together below the cap.
 */
export const hhTileVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...hhTweenScreen,
      delay: Math.min(index, 12) * HH_STAGGER_STEP,
    },
  }),
  exit: { opacity: 0, scale: 0.98, transition: { type: "tween", duration: 0.1, ease: "easeOut" } },
};

/** Parent for `staggerChildren`-driven cascades. */
export const hhStaggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: HH_STAGGER_STEP,
      delayChildren: 0.02,
    },
  },
};

/** Child of {@link hhStaggerContainer}. */
export const hhStaggerItem: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: hhTweenScreen },
};

/* ──────────────────────────────────────────────────────────────────────────
   Interaction gestures — hand straight to whileHover / whileTap
   ────────────────────────────────────────────────────────────────────────── */

/** Tile hover: lift and brighten. */
export const hhHoverLift = { y: -2, scale: 1.012, transition: hhSpringPress } as const;

/** Press: dip. */
export const hhTapPress = { scale: 0.965, transition: hhSpringPress } as const;

/** Confirm: the launch gesture — dip hard, then overshoot back. */
export const hhTapConfirm = { scale: 0.94, transition: hhSpringPress } as const;

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

export type MotionPresetName =
  | "snappy"
  | "soft"
  | "sheet"
  | "momentum"
  | "cursor"
  | "select"
  | "press"
  | "panel"
  | "screen";

const PRESETS: Record<MotionPresetName, Transition> = {
  snappy: springSnappy,
  soft: springSoft,
  sheet: springSheet,
  momentum: springMomentum,
  cursor: hhSpringCursor,
  select: hhSpringSelect,
  press: hhSpringPress,
  panel: hhSpringPanel,
  screen: hhTweenScreen,
};

/** Pick a preset; falls back to a cross-fade when reduced motion is requested. */
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
 * Strip travel and overshoot from a variant set for reduced-motion callers.
 *
 * Deliberately keeps opacity: the state change still needs to be visible, and
 * a cursor that vanishes entirely is less accessible, not more. Only the
 * movement goes away.
 */
export function hhReducedVariants(): Variants {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: reducedMotionFade },
    exit: { opacity: 0, transition: reducedMotionFade },
  };
}

/**
 * Momentum projection from a release velocity (px), exponential decay.
 * Used to predict where a flick would coast to.
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

/** Rubber-band resistance past a boundary. */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55
): number {
  if (!dimension) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
