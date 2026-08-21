"use client";

/**
 * Cursor navigation for one group of selectable items — keyboard and gamepad.
 *
 * This is the input half of the traveling cursor. The visual half lives in
 * `components/handheld/CursorRing.tsx`, which renders the ring inside whichever
 * item is currently selected; this hook decides which item that is.
 *
 * Three decisions here are worth reading before changing anything:
 *
 * 1. THE RING IS AN INPUT-MODE INDICATOR, NOT A HOVER STATE. `isCursorActive`
 *    only flips true once a key or a gamepad has driven the cursor. Pointer
 *    hover still moves the selection (so mouse and cursor stay in sync and the
 *    ring never lands somewhere stale) but never turns the ring on, because a
 *    ring that chases the mouse reads as a rendering bug rather than a cursor.
 *
 * 2. IT MUST NOT SWALLOW KEYS. The app already owns a global shortcut system
 *    (`lib/shortcuts.ts`), a command palette, and per-page list shortcuts. Key
 *    events are ignored inside editable targets, during IME composition, once
 *    someone else has called `preventDefault`, and whenever ctrl/meta/alt is
 *    held. Confirm keys additionally defer to natively activatable elements, so
 *    a focused button gets exactly one activation instead of two.
 *
 * 3. IDLE COST IS ZERO. The Gamepad API can only be read by polling, and a
 *    permanent `requestAnimationFrame` loop on every list page would burn a
 *    frame callback forever for a device almost nobody has attached. The loop
 *    is therefore started by `gamepadconnected` and stopped when the last pad
 *    disappears. Browsers withhold pads until the user actually touches one,
 *    which is the same moment the connect event fires — so gating on the event
 *    costs no functionality.
 *
 * Selection is deliberately decoupled from DOM focus: arrow keys move the ring
 * without stealing focus (which would fight the app's focus management and
 * scroll the page around). `getItemProps` exposes a roving `tabIndex` so the
 * group is still a single tab stop for keyboard users.
 *
 * `onMove` / `onConfirm` / `onCancel` are where `playHandheldSound("cursor")`,
 * `("confirm")` and `("back")` from `lib/handheld-sound.ts` belong — this hook
 * stays silent on its own so it can be used in contexts that want no audio.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { isEditableEventTarget, isKeyboardEventComposing } from "@/lib/shortcuts";

/* ──────────────────────────────────────────────────────────────────────────
   Gamepad tuning
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Held-direction repeat, edge-triggered.
 *
 * 180ms before the first repeat is the important number: a pad reports its
 * state every frame, so without an initial delay one deliberate flick of the
 * stick becomes three or four steps at 60fps. 180ms is longer than any
 * intentional single press and short enough that holding a direction starts
 * moving before it feels stuck. 90ms after that is ~11 steps/second, which
 * keeps up with a held direction without so badly outrunning the 260ms cursor
 * spring that the ring stops reading as one moving object.
 */
const GAMEPAD_REPEAT_DELAY_MS = 180;
const GAMEPAD_REPEAT_INTERVAL_MS = 90;

/**
 * Analog sticks rest at small non-zero values and drift as they wear, so a raw
 * reading would walk the cursor down a menu on its own. 0.5 is half
 * deflection — far above any resting drift, far below a normal push.
 */
const GAMEPAD_STICK_DEADZONE = 0.5;

/** Standard-mapping indices: 0 is the primary face button, 1 the secondary. */
const GAMEPAD_BUTTON_CONFIRM = 0;
const GAMEPAD_BUTTON_CANCEL = 1;
const GAMEPAD_BUTTON_DIRECTION_UP = 12;
const GAMEPAD_BUTTON_DIRECTION_DOWN = 13;
const GAMEPAD_BUTTON_DIRECTION_LEFT = 14;
const GAMEPAD_BUTTON_DIRECTION_RIGHT = 15;

/** Some pads report face buttons as analog floats; treat half-pressed as down. */
const GAMEPAD_BUTTON_THRESHOLD = 0.5;

const GAMEPAD_AXIS_X = 0;
const GAMEPAD_AXIS_Y = 1;

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

export type HandheldCursorDirection = "up" | "down" | "left" | "right";

export type HandheldCursorOptions = {
  /** Number of items in the group. Shrinking it clamps the cursor back inside. */
  count: number;
  /** Grid width. 1 or undefined means a vertical list. */
  columns?: number;
  /** Default true. When false, no listeners are attached and every item is a tab stop. */
  enabled?: boolean;
  /** Wrap at the edges instead of clamping. Default false. */
  loop?: boolean;
  /** First-render selection only; later changes are ignored (use `setIndex`). */
  initialIndex?: number;
  /** Primary button / Enter / Space. */
  onConfirm?: (index: number) => void;
  /** Secondary button / Escape. */
  onCancel?: () => void;
  /** Every cursor move driven by input — the hook-up point for a move sound. */
  onMove?: (index: number) => void;
  /** When true, pointer hover activates the traveling cursor ring. Default false (keys/gamepad only). */
  activateOnPointer?: boolean;
};

export type HandheldCursorItemProps = {
  "data-hh-selected": "true" | "false";
  onPointerEnter: () => void;
  onFocus: () => void;
  tabIndex: number;
};

export type HandheldCursorApi = {
  index: number;
  setIndex: (index: number) => void;
  /** True once keyboard/gamepad drove the cursor — pointer users keep it false
   *  so the ring does not appear on mouse-only interaction. */
  isCursorActive: boolean;
  /** Spread onto each item. Marks the selected one and syncs pointer hover. */
  getItemProps: (index: number) => HandheldCursorItemProps;
};

/* ──────────────────────────────────────────────────────────────────────────
   Pure helpers
   ────────────────────────────────────────────────────────────────────────── */

function clampIndex(value: number, count: number): number {
  if (!Number.isFinite(value) || count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), count - 1);
}

/**
 * Where a direction lands.
 *
 * Movement is flat index arithmetic — ±1 horizontally, ±columns vertically — so
 * running off the end of a grid row continues into the next one, the way a
 * console menu does. Only the ends of the whole group clamp (or wrap).
 */
function resolveTargetIndex(
  currentIndex: number,
  direction: HandheldCursorDirection,
  count: number,
  columns: number,
  loop: boolean
): number {
  if (count <= 0) return 0;

  const step = direction === "left" || direction === "right" ? 1 : columns;
  const delta = direction === "left" || direction === "up" ? -step : step;
  const candidate = currentIndex + delta;

  if (candidate >= 0 && candidate < count) return candidate;
  if (loop) return ((candidate % count) + count) % count;
  return clampIndex(candidate, count);
}

function isGamepadButtonPressed(pad: Gamepad, buttonIndex: number): boolean {
  const button = pad.buttons[buttonIndex];
  if (!button) return false;
  return button.pressed || button.value >= GAMEPAD_BUTTON_THRESHOLD;
}

function readGamepadAxis(pad: Gamepad, axisIndex: number): number {
  const value = pad.axes[axisIndex];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readGamepadDirection(pad: Gamepad): HandheldCursorDirection | null {
  if (isGamepadButtonPressed(pad, GAMEPAD_BUTTON_DIRECTION_UP)) return "up";
  if (isGamepadButtonPressed(pad, GAMEPAD_BUTTON_DIRECTION_DOWN)) return "down";
  if (isGamepadButtonPressed(pad, GAMEPAD_BUTTON_DIRECTION_LEFT)) return "left";
  if (isGamepadButtonPressed(pad, GAMEPAD_BUTTON_DIRECTION_RIGHT)) return "right";

  const x = readGamepadAxis(pad, GAMEPAD_AXIS_X);
  const y = readGamepadAxis(pad, GAMEPAD_AXIS_Y);

  // Dominant axis only: a diagonal push must resolve to one direction, never to
  // one horizontal plus one vertical step in the same frame.
  if (Math.abs(x) >= Math.abs(y)) {
    if (x <= -GAMEPAD_STICK_DEADZONE) return "left";
    if (x >= GAMEPAD_STICK_DEADZONE) return "right";
    return null;
  }
  if (y <= -GAMEPAD_STICK_DEADZONE) return "up";
  if (y >= GAMEPAD_STICK_DEADZONE) return "down";
  return null;
}

/**
 * Enter/Space on a natively activatable element is already an activation, and
 * the app is full of buttons outside any cursor group. Deferring to them keeps
 * a focused control firing once rather than twice, and keeps this hook out of
 * the way of every other keyboard affordance on the page.
 */
function isNativelyActivatableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "button, a[href], input, select, textarea, summary, [role='button'], [role='link'], [role='menuitem'], [role='option'], [role='tab']"
    )
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Hook
   ────────────────────────────────────────────────────────────────────────── */

export function useHandheldCursor(options: HandheldCursorOptions): HandheldCursorApi {
  const {
    count,
    columns,
    enabled = true,
    loop = false,
    initialIndex = 0,
    onConfirm,
    onCancel,
    onMove,
    activateOnPointer = false,
  } = options;
  const columnCount = Math.max(1, Math.trunc(columns ?? 1));

  const [index, setIndexState] = useState(() => clampIndex(initialIndex, count));
  const [isCursorActive, setIsCursorActive] = useState(false);

  /**
   * The navigation source of truth. State drives rendering, but a held
   * direction can step faster than React commits, so every move reads and
   * writes this ref synchronously — otherwise two steps inside one commit would
   * both start from the same stale index.
   */
  const indexRef = useRef(index);

  /**
   * Latest options, so the key listener and the polling loop can be attached
   * once instead of re-subscribing every time a parent re-renders with fresh
   * inline callbacks. Written in an effect rather than during render so a
   * discarded concurrent render cannot publish values that never committed.
   */
  const optionsRef = useRef({ count, columnCount, loop, onConfirm, onCancel, onMove, activateOnPointer });
  useEffect(() => {
    optionsRef.current = { count, columnCount, loop, onConfirm, onCancel, onMove, activateOnPointer };
  });

  const gamepadInputRef = useRef({
    direction: null as HandheldCursorDirection | null,
    nextRepeatAtMs: 0,
    confirmHeld: false,
    cancelHeld: false,
  });

  const commitIndex = useCallback(
    (rawIndex: number, fromCursorInput: boolean, notifyMove: boolean) => {
      const current = optionsRef.current;

      // A key press at the end of the list still counts as cursor input: the
      // ring has to appear even when it cannot move, or the press looks ignored.
      if (fromCursorInput) setIsCursorActive(true);

      const nextIndex = clampIndex(rawIndex, current.count);
      if (nextIndex === indexRef.current) return;

      indexRef.current = nextIndex;
      setIndexState(nextIndex);
      if (notifyMove) current.onMove?.(nextIndex);
    },
    []
  );

  const moveCursor = useCallback(
    (direction: HandheldCursorDirection) => {
      const current = optionsRef.current;
      const nextIndex = resolveTargetIndex(
        indexRef.current,
        direction,
        current.count,
        current.columnCount,
        current.loop
      );
      commitIndex(nextIndex, true, true);
    },
    [commitIndex]
  );

  const confirm = useCallback(() => {
    setIsCursorActive(true);
    optionsRef.current.onConfirm?.(indexRef.current);
  }, []);

  const cancel = useCallback(() => {
    optionsRef.current.onCancel?.();
  }, []);

  /** A shorter list must not leave the cursor pointing past its end. */
  useEffect(() => {
    const clamped = clampIndex(indexRef.current, count);
    if (clamped === indexRef.current) return;
    indexRef.current = clamped;
    setIndexState(clamped);
  }, [count]);

  /* ── Keyboard ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/meta/alt combinations belong to the global shortcut system and to
      // the browser; never claim one.
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isKeyboardEventComposing(event)) return;
      if (isEditableEventTarget(event.target)) return;

      const current = optionsRef.current;
      // An empty group owns no keys — not even Escape, which other layers want.
      if (current.count <= 0) return;

      switch (event.key) {
        case "ArrowLeft":
          moveCursor("left");
          break;
        case "ArrowRight":
          moveCursor("right");
          break;
        case "ArrowUp":
          moveCursor("up");
          break;
        case "ArrowDown":
          moveCursor("down");
          break;
        case "Home":
          commitIndex(0, true, true);
          break;
        case "End":
          commitIndex(current.count - 1, true, true);
          break;
        case "Enter":
        case " ":
        // Legacy key name still emitted by a few embedded browsers.
        case "Spacebar":
          // Auto-repeat must not fire a burst of confirms.
          if (event.repeat) return;
          if (isNativelyActivatableTarget(event.target)) return;
          confirm();
          break;
        case "Escape":
          // No preventDefault: Escape also closes overlays and clears list
          // focus elsewhere in the app, and both should still see it.
          cancel();
          return;
        default:
          return;
      }

      // Reached only by a handled navigation/confirm key: stop the page from
      // scrolling on arrows and Space, and stop Enter/Space from also
      // synthesizing a click on whatever happens to be focused.
      event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, moveCursor, commitIndex, confirm, cancel]);

  /* ── Gamepad ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    if (typeof navigator.getGamepads !== "function") return;

    let frameId: number | null = null;

    const readPads = (): readonly (Gamepad | null)[] =>
      typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];

    const resetInput = () => {
      gamepadInputRef.current = {
        direction: null,
        nextRepeatAtMs: 0,
        confirmHeld: false,
        cancelHeld: false,
      };
    };

    const poll = () => {
      const nowMs = performance.now();

      let direction: HandheldCursorDirection | null = null;
      let confirmPressed = false;
      let cancelPressed = false;

      for (const pad of readPads()) {
        if (!pad) continue;
        direction = direction ?? readGamepadDirection(pad);
        confirmPressed = confirmPressed || isGamepadButtonPressed(pad, GAMEPAD_BUTTON_CONFIRM);
        cancelPressed = cancelPressed || isGamepadButtonPressed(pad, GAMEPAD_BUTTON_CANCEL);
      }

      const input = gamepadInputRef.current;

      if (direction === null) {
        input.direction = null;
      } else if (direction !== input.direction) {
        // Edge: a new direction always steps once immediately, then waits out
        // the initial delay before it starts repeating.
        input.direction = direction;
        input.nextRepeatAtMs = nowMs + GAMEPAD_REPEAT_DELAY_MS;
        moveCursor(direction);
      } else if (nowMs >= input.nextRepeatAtMs) {
        input.nextRepeatAtMs = nowMs + GAMEPAD_REPEAT_INTERVAL_MS;
        moveCursor(direction);
      }

      // Buttons are edge-triggered only — holding one must not re-fire.
      if (confirmPressed && !input.confirmHeld) confirm();
      input.confirmHeld = confirmPressed;

      if (cancelPressed && !input.cancelHeld) cancel();
      input.cancelHeld = cancelPressed;

      frameId = requestAnimationFrame(poll);
    };

    const start = () => {
      if (frameId !== null) return;
      resetInput();
      frameId = requestAnimationFrame(poll);
    };

    const stop = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      resetInput();
    };

    const handleConnected = () => {
      start();
    };

    const handleDisconnected = () => {
      if (readPads().some((pad) => pad !== null)) return;
      stop();
    };

    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleDisconnected);

    // A pad already visible at mount — because something else on the page woke
    // it earlier this session — would otherwise wait for a connect event that
    // has already been and gone.
    if (readPads().some((pad) => pad !== null)) start();

    return () => {
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
      stop();
    };
  }, [enabled, moveCursor, confirm, cancel]);

  /* ── Item props ───────────────────────────────────────────────────────── */

  const setIndex = useCallback(
    (nextIndex: number) => {
      // Programmatic moves are not input: they neither reveal the ring nor
      // fire a move sound, so restoring state from a URL stays silent.
      commitIndex(nextIndex, false, false);
    },
    [commitIndex]
  );

  const getItemProps = useCallback(
    (itemIndex: number): HandheldCursorItemProps => ({
      "data-hh-selected": itemIndex === index ? "true" : "false",
      onPointerEnter: () => {
        commitIndex(itemIndex, optionsRef.current.activateOnPointer, true);
      },
      // Focus follows clicks as well as tabbing, so it syncs the selection
      // without announcing itself as cursor input.
      onFocus: () => {
        commitIndex(itemIndex, false, false);
      },
      // Roving tab stop: the group is one stop for keyboard users while arrow
      // keys move inside it. With navigation disabled every item goes back to
      // being individually tabbable.
      tabIndex: !enabled || itemIndex === index ? 0 : -1,
    }),
    [index, enabled, commitIndex]
  );

  return { index, setIndex, isCursorActive, getItemProps };
}
