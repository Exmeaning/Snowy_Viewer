"use client";

import { useEffect } from "react";

import { getGoogleTagMeasurementId } from "@/lib/googleTag";

const GOOGLE_TAG_SCRIPT_ID = "moesekai-google-tag";

declare global {
    interface Window {
        __moesekaiGoogleTagInitialized?: boolean;
        __moesekaiGoogleTagLoaded?: boolean;
        dataLayer?: unknown[][];
        gtag?: (...args: unknown[]) => void;
    }
}

function enableGoogleTag(measurementId: string) {
    if (window.__moesekaiGoogleTagInitialized) return;

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
    };

    if (!window.__moesekaiGoogleTagLoaded && !document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id = GOOGLE_TAG_SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.addEventListener("load", () => {
            window.__moesekaiGoogleTagLoaded = true;
        }, { once: true });
        document.head.appendChild(script);
    }

    window.gtag("js", new Date());
    window.gtag("config", measurementId);
    window.__moesekaiGoogleTagInitialized = true;
}

export default function GoogleTagBootstrap() {
    useEffect(() => {
        const measurementId = getGoogleTagMeasurementId(window.location.hostname);
        if (measurementId) enableGoogleTag(measurementId);
    }, []);

    return null;
}
