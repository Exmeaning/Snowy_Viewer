"use client";
import { useEffect } from "react";

/**
 * Registers the Service Worker for image asset caching.
 * This is a client-only component with no visual output.
 */
export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    console.log("[SW] Registered, scope:", reg.scope);
                })
                .catch((err) => {
                    console.warn("[SW] Registration failed:", err);
                });
        }
    }, []);

    return null;
}
