"use client";

/**
 * One selectable tile.
 *
 * A tile is the smallest unit the traveling cursor can land on: a real button
 * that carries the flat `.hh-tile` surface, acknowledges a press with a dip, and
 * hosts the cursor ring while it is the selected item of its group.
 *
 * Two things are load-bearing and easy to break:
 *
 * 1. `relative` is not decoration. The ring is `position: absolute; inset: 0`,
 *    so a tile that is not a positioning context lets the ring escape to the
 *    nearest ancestor that is — usually the whole grid.
 *
 * 2. The ring renders only when the tile is BOTH selected and the group's cursor
 *    is active. Exactly one tile per `groupId` may render it: two mounted rings
 *    sharing one `layoutId` is undefined behavior in shared-layout animation.
 *
 * Pair with `useHandheldCursor`, whose `getItemProps(index)` supplies the
 * selection data attribute, the pointer/focus sync and the roving tab index.
 */

import { motion, useReducedMotion } from "framer-motion";
import type {
  AriaAttributes,
  AriaRole,
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";

import { hhHoverLift, hhSpringPress, hhSpringSelect, hhTapPress } from "@/lib/motion";

import CursorRing from "./CursorRing";

/**
 * Mirrors `--hh-select-scale` in app/handheld-os.css.
 *
 * The duplication is deliberate. `.hh-selected` already sets this scale in CSS,
 * but once framer-motion has animated this element's transform even once it
 * keeps writing the inline value — `transform: none` at rest — which silently
 * erases the CSS selection lift the first time a tile is hovered. Driving the
 * same value through `animate` makes the lift survive; the two must stay equal.
 */
const HH_SELECT_SCALE = 1.045;

/**
 * Anchors are absent on purpose. Per the repo's linking rules, off-site links go
 * through `components/ExternalLink.tsx` and internal navigation through the
 * router's link component, so a link tile is one of those wrapping a tile
 * rendered `as="div"` — never a hand-rolled `<a>` here.
 */
export type HandheldTileElement = "button" | "div" | "li";

export type HandheldTileProps = AriaAttributes & {
  /** Navigation group this tile belongs to. Must match its siblings' groupId. */
  groupId: string;
  /** Is this the group's current item? */
  selected: boolean;
  /** Is the group's cursor being driven by keyboard/gamepad right now? */
  cursorActive: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
  children?: ReactNode;
  /** Defaults to a real `<button>`; non-button tags leave a11y to the caller. */
  as?: HandheldTileElement;
  /** Extra classes for the ring itself — typically a radius override. */
  ringClassName?: string;
  disabled?: boolean;
  id?: string;
  role?: AriaRole;
  style?: CSSProperties;
  tabIndex?: number;
  title?: string;
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  "data-hh-selected"?: "true" | "false";
};

export default function Tile({
  groupId,
  selected,
  cursorActive,
  onClick,
  className,
  children,
  as = "button",
  ringClassName,
  disabled = false,
  ...rest
}: HandheldTileProps) {
  const prefersReducedMotion = useReducedMotion();

  const tileClassName = ["hh-tile", "hh-focusable", "relative", selected ? "hh-selected" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  // Reduced motion: no transform gestures at all. The tile still changes
  // surface, border and shadow through `.hh-tile` / `.hh-selected`, so every
  // state remains visible — only the travel and the dip go away.
  const useGestures = !prefersReducedMotion && !disabled;

  const sharedProps = {
    // Set from `selected` so a tile is correct on its own; `getItemProps` spread
    // through `rest` overrides it with the identical value.
    "data-hh-selected": selected ? ("true" as const) : ("false" as const),
    ...rest,
    className: tileClassName,
    onClick: disabled ? undefined : onClick,
    animate: prefersReducedMotion ? undefined : { scale: selected ? HH_SELECT_SCALE : 1, transition: hhSpringSelect },
    whileHover: useGestures ? hhHoverLift : undefined,
    whileTap: useGestures ? hhTapPress : undefined,
    // Applies to the return from hover/press; `animate` carries its own.
    transition: hhSpringPress,
  };

  const content = (
    <>
      {children}
      {selected && cursorActive ? <CursorRing groupId={groupId} className={ringClassName} /> : null}
    </>
  );

  // One branch per tag rather than a computed component: `motion.create()` at
  // render time would produce a new component type on every render and remount
  // the subtree, and a union of motion components cannot be spread type-safely.
  if (as === "div") {
    return <motion.div {...sharedProps}>{content}</motion.div>;
  }
  if (as === "li") {
    return <motion.li {...sharedProps}>{content}</motion.li>;
  }
  return (
    <motion.button type="button" disabled={disabled} {...sharedProps}>
      {content}
    </motion.button>
  );
}
