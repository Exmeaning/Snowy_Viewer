"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { getGoogleTagMeasurementId } from "@/lib/googleTag";

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

export default function GoogleTagBootstrap() {
    const pathname = usePathname();
    const isInitialRender = useRef(true);

    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        if (typeof window === "undefined") return;

        const measurementId = getGoogleTagMeasurementId(window.location.hostname);
        if (measurementId && window.gtag) {
            const pagePath = pathname + window.location.search;
            window.gtag("config", measurementId, {
                page_path: pagePath,
            });
        }
    }, [pathname]);

    return null;
}
