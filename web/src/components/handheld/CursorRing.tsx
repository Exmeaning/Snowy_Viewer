"use client";

/**
 * The traveling cursor.
 *
 * In a console home menu there is exactly **one** selection ring per group, and
 * it physically travels between targets. That single detail carries more of the
 * console feel than any other piece of motion in the system, because it implies
 * a persistent object the user is moving — not a set of independent targets
 * lighting up in turn.
 *
 * The travel is free: framer-motion's shared-layout animation handles it. When
 * the ring unmounts from item A and mounts inside item B under the same
 * `layoutId`, it interpolates position and size between the two. So the ring is
 * rendered *inside the selected item only*, and moving the selection is the
 * whole animation.
 *
 * Requirements for the travel to work, all of which are easy to break:
 *
 * 1. Every item in a group must be a positioning context (`relative`), since
 *    the ring is `absolute; inset: 0`.
 * 2. `groupId` must be stable and unique per group. Two grids sharing a groupId
 *    make the ring fly across the page between them.
 * 3. Only one item per group may render the ring at a time. Two mounted rings
 *    with one layoutId is undefined behavior.
 */

import { motion, useReducedMotion } from "framer-motion";

import { hhSpringCursor, reducedMotionFade } from "@/lib/motion";

type CursorRingProps = {
  /** Stable identifier for the navigation group this cursor belongs to. */
  groupId: string;
  /** Extra classes — typically a radius override to match the host item. */
  className?: string;
};

export default function CursorRing({ groupId, className }: CursorRingProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      // Shared layout identity: this is what makes the ring travel rather than
      // disappear here and reappear there.
      layoutId={`hh-cursor-${groupId}`}
      // Reduced motion: the ring still marks the selection, it just cross-fades
      // instead of flying. Dropping it entirely would remove the only visible
      // indication of where the selection is.
      layout={prefersReducedMotion ? false : "position"}
      initial={prefersReducedMotion ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={prefersReducedMotion ? reducedMotionFade : hhSpringCursor}
      className={`hh-cursor-ring ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
