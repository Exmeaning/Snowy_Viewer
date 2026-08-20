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
 */

import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { hhReducedVariants, hhScreenVariants } from "@/lib/motion";

export type HandheldScreenTransitionProps = {
  children: ReactNode;
  className?: string;
};

export default function ScreenTransition({ children, className }: HandheldScreenTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  // Reduced motion keeps the fade and drops the travel: the screen still marks
  // that it changed, it just does not move to say so.
  const variants = useMemo(
    () => (prefersReducedMotion ? hhReducedVariants() : hhScreenVariants),
    [prefersReducedMotion]
  );

  return (
    <motion.div variants={variants} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}
