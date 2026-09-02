"use client";
import { useEffect } from "react";

/**
 * Registers the Service Worker for image asset caching (production only).
 * In dev the worker is skipped and any previously registered instance is
 * unregistered, so an old build can never be pinned by stale SW state.
 */
export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker
                .getRegistrations()
                .then((registrations) => {
                    for (const reg of registrations) {
                        reg.unregister().catch(() => {});
                    }
                })
                .catch(() => {});
            return;
        }
        navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => {
                console.log("[SW] Registered, scope:", reg.scope);
            })
            .catch((err) => {
                console.warn("[SW] Registration failed:", err);
            });
    }, []);

    return null;
}
