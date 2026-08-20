"use client";

/**
 * Screen entrance.
 *
 * Wraps a screen's content so it rises into place instead of appearing. The
 * whole console feel of a route change is this one short, damped move —
 * deliberately not a bounce, because structural surfaces that wobble read as
 * toy-like and, worse, as slow.
 *
 * There is no `AnimatePresence` and no exit animation on purpose. The App Router
 * unmounts the previous route's tree before the next one commits, so an exit
 * variant here would never get a frame to play: it would be dead code that
 * looks like a feature. Exits belong to things this component does not own —
 * sheets, popovers and modals, which stay mounted long enough to animate out.
 *
 * There is likewise only one variant set. Reduced motion keeps the fade and
 * drops the travel, but that is done globally by MotionProvider
 * (`reducedMotion="user"`), which snaps positional values after mount. Choosing
 * a movement-free variant set during render would make the server emit a
 * transform the client's first frame does not, which React reports as a
 * hydration mismatch.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { hhScreenVariants } from "@/lib/motion";

export type HandheldScreenTransitionProps = {
  children: ReactNode;
  className?: string;
};

export default function ScreenTransition({ children, className }: HandheldScreenTransitionProps) {
  return (
    <motion.div variants={hhScreenVariants} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}
