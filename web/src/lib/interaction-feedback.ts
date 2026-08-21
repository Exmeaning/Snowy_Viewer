/**
 * Global interaction feedback listener.
 *
 * Attaches a single document-level click listener to automatically dispatch
 * synthesizer audio feedback (via `playHandheldSound`) for buttons, links,
 * switches, tabs, and interactive controls across the application.
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Double-Sound Prevention:
 *    - Explicit sound invocations (e.g. inside `ModalAction`, `Sidebar`, `BaseFilters`,
 *      `SettingsPanel`) execute inside React's synthetic event dispatch (which runs
 *      prior to the native event bubbling to `document`).
 *    - When `playHandheldSound` executes, `getLastSoundPlayedAtMs()` is stamped.
 *    - When this document listener receives the bubbling click, if `performance.now() -
 *      getLastSoundPlayedAtMs() < DEDUP_WINDOW_MS (60ms)`, it skips playback.
 *    - Explicit `data-hh-sound="none"` on an element or any ancestor completely silences it.
 *
 * 2. Sound Semantics:
 *    - Internal / external navigation links (`<a href>`) and file downloads -> "confirm"
 *    - Dismiss / close / cancel buttons (matching aria-label / title / class) -> "back"
 *    - Primary / submit actions -> "confirm"
 *    - Toggles, switches, tabs, checkboxes, generic buttons -> "toggle"
 *    - Custom overrides via `data-hh-sound="confirm|back|toggle|error|launch|cursor"`
 *
 * 3. Exclusion Rules:
 *    - Disabled elements (`disabled`, `aria-disabled="true"`) are silently ignored.
 *    - Text inputs, search fields, textareas, selects, range sliders, and contenteditable
 *      nodes are ignored to prevent typing/scrubbing noise.
 *    - Canvas / 3D rendering viewports (e.g. chart preview, sticker maker, mysekai preview)
 *      and their subtrees are ignored so in-game / interactive clicks do not fire audio.
 *    - Anchor tags without `href` or with empty javascript hrefs are ignored.
 *
 * 4. SSR Safety:
 *    - No `window` or `document` access at module evaluation time.
 */

"use client";

import {
    isHandheldSoundEnabled,
    playHandheldSound,
    getLastSoundPlayedAtMs,
    type HandheldSoundName,
} from "@/lib/handheld-sound";

/** Time window within which an explicit `playHandheldSound` call will suppress delegated click feedback. */
const DEDUP_WINDOW_MS = 60;

/** Regular expression matching aria-labels or titles implying a dismissal/back/close action. */
const CLOSE_OR_BACK_REGEX = /\b(close|cancel|back|dismiss)\b|\u5173\u95ed|\u53d6\u6d88|\u8fd4\u56de/i;

/** Text inputs and editing controls where clicking should remain quiet. */
const TEXT_INPUT_TYPES = new Set([
    "text",
    "search",
    "number",
    "email",
    "password",
    "url",
    "tel",
    "date",
    "datetime-local",
    "month",
    "week",
    "time",
    "range",
]);

/**
 * Validates whether a custom `data-hh-sound` value matches known sound names.
 */
function isValidSoundName(val: string | null): val is HandheldSoundName {
    return val === "cursor"
        || val === "confirm"
        || val === "back"
        || val === "toggle"
        || val === "error"
        || val === "launch";
}

/**
 * Handles document-level click events and synthesizes the appropriate UI feedback.
 */
function handleDocumentClick(event: MouseEvent): void {
    try {
        // Fast path: if sound is disabled, do nothing.
        if (!isHandheldSoundEnabled()) return;

        // Dedup: if an explicit playHandheldSound() occurred during this gesture, skip delegation.
        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (nowMs - getLastSoundPlayedAtMs() < DEDUP_WINDOW_MS) return;

        const target = event.target as HTMLElement | null;
        if (!target || typeof target.closest !== "function") return;

        // Subtree-level mute: elements inside [data-hh-sound="none"] or <canvas> are completely silent.
        if (target.closest("[data-hh-sound='none']") || target.closest("canvas")) {
            return;
        }

        // Ignore clicks directly on editable inputs / textareas / sliders.
        const inputTarget = target.closest("input, textarea, select, [contenteditable='true']");
        if (inputTarget) {
            if (inputTarget.tagName === "TEXTAREA" || inputTarget.tagName === "SELECT" || inputTarget.getAttribute("contenteditable") === "true") {
                return;
            }
            if (inputTarget instanceof HTMLInputElement) {
                const inputType = (inputTarget.type || "text").toLowerCase();
                if (TEXT_INPUT_TYPES.has(inputType)) {
                    return;
                }
            }
        }

        // Find the nearest interactive ancestor.
        const interactiveEl = target.closest<HTMLElement>(
            "button, a[href], [role='button'], [role='switch'], [role='tab'], [role='option'], [role='menuitem'], summary, input[type='button'], input[type='submit'], input[type='reset'], input[type='checkbox'], input[type='radio'], [data-hh-click], .hh-press"
        );
        if (!interactiveEl) return;

        // If the interactive element itself or its subtree is explicitly silenced.
        if (interactiveEl.closest("[data-hh-sound='none']")) return;

        // Disabled elements should produce no sound.
        if (
            interactiveEl.hasAttribute("disabled") ||
            interactiveEl.getAttribute("aria-disabled") === "true" ||
            interactiveEl.classList.contains("disabled")
        ) {
            return;
        }

        // 1. Check for explicit sound name override on the element.
        const explicitSound = interactiveEl.getAttribute("data-hh-sound");
        if (explicitSound === "none") return;
        if (isValidSoundName(explicitSound)) {
            playHandheldSound(explicitSound);
            return;
        }

        // 2. Navigation links (<a href>).
        if (interactiveEl.tagName === "A" && interactiveEl.hasAttribute("href")) {
            const href = interactiveEl.getAttribute("href") ?? "";
            // Ignore pure anchor fragments or javascript pseudo-links.
            if (!href || href === "#" || href.startsWith("javascript:")) return;

            // All meaningful link navigations (internal routes, external URLs, file downloads) play "confirm".
            playHandheldSound("confirm");
            return;
        }

        // 3. Close / back / cancel controls.
        const ariaLabel = interactiveEl.getAttribute("aria-label") || "";
        const title = interactiveEl.getAttribute("title") || "";
        if (CLOSE_OR_BACK_REGEX.test(ariaLabel) || CLOSE_OR_BACK_REGEX.test(title)) {
            playHandheldSound("back");
            return;
        }

        // 4. Role-based inference.
        const role = interactiveEl.getAttribute("role");
        if (role === "tab" || role === "switch" || role === "option" || role === "menuitem") {
            playHandheldSound("toggle");
            return;
        }

        // 5. Checkbox / Radio inputs.
        if (interactiveEl instanceof HTMLInputElement && (interactiveEl.type === "checkbox" || interactiveEl.type === "radio")) {
            playHandheldSound("toggle");
            return;
        }

        // 6. Primary / submit action buttons.
        if (
            interactiveEl.getAttribute("type") === "submit" ||
            interactiveEl.getAttribute("data-action") === "confirm" ||
            interactiveEl.classList.contains("hh-btn-primary") ||
            interactiveEl.classList.contains("ios-glass-btn-primary")
        ) {
            playHandheldSound("confirm");
            return;
        }

        // 7. Default for buttons, summary disclosure, and generic clickables.
        playHandheldSound("toggle");
    } catch {
        // Global listener is purely decorative — swallow any exception to protect page execution.
    }
}

/**
 * Initializes the global interaction feedback listener on the document.
 * Returns an unmount / cleanup callback.
 */
export function initGlobalInteractionFeedback(): () => void {
    if (typeof document === "undefined") return () => undefined;

    // Use bubble phase so child element handlers and React SyntheticEvent handlers
    // fire first, allowing explicit playHandheldSound() to stamp the dedup timestamp.
    document.addEventListener("click", handleDocumentClick, { passive: true });

    return () => {
        document.removeEventListener("click", handleDocumentClick);
    };
}
