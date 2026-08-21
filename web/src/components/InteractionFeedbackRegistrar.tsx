"use client";

import { useEffect } from "react";
import { initGlobalInteractionFeedback } from "@/lib/interaction-feedback";
import { initPointerFocusFeedback } from "@/lib/pointer-focus";

/**
 * Mounts the two document-level feedback layers.
 *
 * Both are installed here rather than in their own components because they are
 * peers: one turns a *click* into sound, the other turns *hover/touch* into a
 * travelling focus highlight. Keeping them in one place makes it obvious that
 * the pair exists and that neither may hold React state — they write to the DOM
 * directly so pointer movement never triggers a re-render.
 *
 * Zero markup: this renders null and only owns the listener lifecycles.
 */
export default function InteractionFeedbackRegistrar() {
    useEffect(() => {
        const teardownInteraction = initGlobalInteractionFeedback();
        const teardownPointerFocus = initPointerFocusFeedback();
        return () => {
            teardownInteraction();
            teardownPointerFocus();
        };
    }, []);

    return null;
}
