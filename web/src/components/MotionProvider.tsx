"use client";

/**
 * Global reduced-motion policy for every framer-motion tree.
 *
 * `reducedMotion="user"` hands the accessibility downgrade to framer-motion
 * itself: after mount it forces `{ type: false }` on the positional keys
 * (x/y/scale/rotate/skew…) whenever the OS reports
 * `prefers-reduced-motion: reduce`, so those values snap instead of travelling
 * while opacity keeps animating. The state change stays visible, the movement
 * does not happen.
 *
 * Why this must live here rather than in each component: `useReducedMotion()`
 * returns `null` on the server and its real value on the client's first frame,
 * with no effect-based reconciliation. Any component that branches on it *during
 * render* to pick `variants` / `initial` / `animate` therefore emits different
 * inline styles on the server and the client (SSR writes `transform:
 * translateY(-12px)`, the client writes none) and React reports a hydration
 * mismatch. Keeping a single variant set per component and centralising the
 * downgrade here removes the render-time fork entirely.
 *
 * Note this provider deliberately does not change SSR output — `MotionConfig`
 * only records the policy on the visual element, which reads it at mount. That
 * is exactly why it is safe: server and client render the same markup, and the
 * downgrade applies afterwards.
 */

import { MotionConfig } from "framer-motion";

export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
