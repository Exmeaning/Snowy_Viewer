"use client";

import { useEffect } from "react";
import { initGlobalInteractionFeedback } from "@/lib/interaction-feedback";

/**
 * Client component that mounts the global interaction sound feedback listener.
 * This is a zero-markup client component placed in the root layout.
 */
export default function InteractionFeedbackRegistrar() {
    useEffect(() => {
        return initGlobalInteractionFeedback();
    }, []);

    return null;
}
