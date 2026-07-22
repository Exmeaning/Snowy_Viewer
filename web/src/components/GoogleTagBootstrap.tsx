"use client";

import { useEffect } from "react";

import { getGoogleTagMeasurementId } from "@/lib/googleTag";

declare global {
    interface Window {
        __moesekaiGoogleTagInitialized?: boolean;
        dataLayer?: unknown[][];
        gtag?: (...args: unknown[]) => void;
    }
}

export default function GoogleTagBootstrap() {
    useEffect(() => {
        const measurementId = getGoogleTagMeasurementId(window.location.hostname);
        if (!measurementId || window.__moesekaiGoogleTagInitialized) return;

        window.__moesekaiGoogleTagInitialized = true;

        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer ?? [];
        window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
            window.dataLayer?.push(args);
        };
        window.gtag("js", new Date());
        window.gtag("config", measurementId);
    }, []);

    return null;
}
