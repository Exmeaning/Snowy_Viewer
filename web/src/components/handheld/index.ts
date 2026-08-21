/**
 * Handheld OS — cursor-driven UI primitives.
 *
 * Import surface for the console-style selection layer. `CursorRing` is normally
 * reached through `Tile`; it is re-exported for groups whose items are too
 * custom to be a tile (a table row, a map pin) and therefore host the ring
 * themselves.
 *
 * The hook lives in `@/hooks/useHandheldCursor` — only its types are re-exported
 * here, so that importing a component never pulls the input layer along with it.
 */

export { default as CursorRing } from "./CursorRing";
export { default as Tile } from "./Tile";
export { default as ScreenTransition } from "./ScreenTransition";
export { default as HandheldMark } from "./HandheldMark";
export { default as HandheldEmptyState } from "./HandheldEmptyState";

export type { HandheldTileElement, HandheldTileProps } from "./Tile";
export type { HandheldScreenTransitionProps } from "./ScreenTransition";
export type { HandheldMarkProps, HandheldMarkType } from "./HandheldMark";
export type { HandheldEmptyStateProps } from "./HandheldEmptyState";

export type {
  HandheldCursorApi,
  HandheldCursorDirection,
  HandheldCursorItemProps,
  HandheldCursorOptions,
} from "@/hooks/useHandheldCursor";
