/**
 * Pointer & touch driven focus feedback engine.
 *
 * Implements the handheld console cursor feel driven by mouse hover and touch
 * positions without React re-renders or frame drops.
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Zero React State Churn:
 *    - All tracking is delegated at the document level via passive `pointerover`
 *      and `touchstart`/`touchmove` listeners.
 *    - No `mousemove` React state dispatching or continuous polling loops.
 *    - The visual focus state is written straight to the DOM as `data-hh-focused="true"`
 *      so that element traversal never triggers React render cycles.
 *
 * 2. Strict Audio Throttling & Rhythmic Cadence:
 *    - Moving across a 30-item grid could fire 30 events in 200ms.
 *    - To prevent noise fatigue, `playHandheldSound("cursor")` is throttled to
 *      a cadence window (`CURSOR_SOUND_THROTTLE_MS = 100ms`).
 *    - Internal element transitions (e.g. hovering from a button's icon to its text label)
 *      are filtered out via `closest()` container equality comparison.
 *    - Silence escape hatches (`data-hh-sound="none"` and `data-hh-cursor-sound="false"`)
 *      are strictly honored.
 *
 * 3. Touch Support & Cleanup:
 *    - On touch devices, `touchstart` and `touchmove` resolve the element under the
 *      finger via `elementFromPoint` to provide instant tactile acoustic feedback.
 *    - `pointerover` skips `pointerType === "touch"` to prevent racing with touchmove.
 *    - `touchend` and `touchcancel` clear the focus mark immediately so items do not
 *      remain falsely highlighted after finger lift.
 */

import { playHandheldSound } from "./handheld-sound";

/** Minimum interval between pointer-induced cursor sound blips (ms). */
const CURSOR_SOUND_THROTTLE_MS = 100;

/** Interactive selector query for elements that participate in cursor focus. */
const FOCUSABLE_SELECTOR = [
    ".hh-tile",
    ".hh-card-item",
    ".hh-interactive-card",
    "[data-shortcut-item='true']",
    ".hh-btn",
    ".hh-chip",
    ".hh-segment-item",
    ".hh-dock-btn",
    ".hh-focusable",
    "[role='button']",
    "[role='tab']",
    "[data-hh-focus='true']",
    "button:not([disabled])",
    "a[href]",
    "input[type='checkbox']",
    "input[type='radio']",
    "select",
    "summary",
].join(", ");

let lastCursorSoundTimeMs = 0;
let currentFocusedElement: Element | null = null;

/**
 * Mark of the element the pointer is currently resting on.
 *
 * An attribute rather than a class so it can never collide with Tailwind
 * utilities, and rather than React state so pointer movement never re-renders.
 * The visual treatment lives in handheld-os.css under [data-hh-focused].
 */
const FOCUSED_ATTR = "data-hh-focused";

/**
 * Move the focus mark to a new element.
 *
 * Written straight to the DOM: hover is a high-frequency signal, and routing it
 * through React would mean a re-render per element crossed. Clearing the
 * previous element first keeps exactly one focus mark alive at a time.
 */
function setFocusMark(next: Element | null) {
    if (currentFocusedElement === next) return;
    currentFocusedElement?.removeAttribute(FOCUSED_ATTR);
    next?.setAttribute(FOCUSED_ATTR, "true");
    currentFocusedElement = next;
}

function handlePointerOver(event: PointerEvent) {
    // Touch generates pointerover too, but touch focus is driven by
    // handleTouchMove so the two do not fight over the same mark.
    if (event.pointerType === "touch") return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const focusable = target.closest(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.closest("[data-hh-focus='false']")) {
        setFocusMark(null);
        return;
    }
    if (focusable === currentFocusedElement) return;

    setFocusMark(focusable);

    // Honor silence escape hatches
    if (focusable.closest("[data-hh-sound='none']") || focusable.closest("[data-hh-cursor-sound='false']")) {
        return;
    }

    const now = performance.now();
    if (now - lastCursorSoundTimeMs >= CURSOR_SOUND_THROTTLE_MS) {
        lastCursorSoundTimeMs = now;
        playHandheldSound("cursor");
    }
}

function handlePointerLeaveDocument() {
    setFocusMark(null);
}

function handleTouchMove(event: TouchEvent) {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) {
        setFocusMark(null);
        return;
    }

    const focusable = target.closest(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.closest("[data-hh-focus='false']")) {
        setFocusMark(null);
        return;
    }
    if (focusable === currentFocusedElement) return;

    setFocusMark(focusable);

    if (focusable.closest("[data-hh-sound='none']") || focusable.closest("[data-hh-cursor-sound='false']")) {
        return;
    }

    const now = performance.now();
    if (now - lastCursorSoundTimeMs >= CURSOR_SOUND_THROTTLE_MS) {
        lastCursorSoundTimeMs = now;
        playHandheldSound("cursor");
    }
}

/** Release the focus mark once the finger lifts, so nothing stays lit. */
function handleTouchEnd() {
    setFocusMark(null);
}

/**
 * Initializes global pointer and touch driven focus feedback.
 * Returns an unmount / cleanup callback.
 */
export function initPointerFocusFeedback(): () => void {
    if (typeof document === "undefined") return () => undefined;

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeaveDocument, { passive: true });
    document.addEventListener("touchstart", handleTouchMove, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
        document.removeEventListener("pointerover", handlePointerOver);
        document.removeEventListener("pointerleave", handlePointerLeaveDocument);
        document.removeEventListener("touchstart", handleTouchMove);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
        document.removeEventListener("touchcancel", handleTouchEnd);
        setFocusMark(null);
    };
}
