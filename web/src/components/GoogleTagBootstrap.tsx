"use client";

import { useEffect } from "react";

import {
    ANALYTICS_CONSENT_CHANGED_EVENT,
    isAnalyticsConsentStorageEvent,
    isAnalyticsAllowed,
    readAnalyticsConsent,
} from "@/lib/analyticsConsent";
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

function setGoogleTagDisabled(measurementId: string, disabled: boolean) {
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = disabled;
}

function removeGoogleAnalyticsCookies() {
    try {
        const cookieNames = document.cookie
            .split(";")
            .map((cookie) => cookie.split("=", 1)[0]?.trim())
            .filter((name): name is string => Boolean(name) && (/^_ga(?:_|$)/.test(name) || name === "_gid" || name === "_gat"));
        const labels = window.location.hostname.split(".");
        const registrableDomain = labels.length > 1 ? `.${labels.slice(-2).join(".")}` : undefined;
        const domains = [undefined, window.location.hostname, `.${window.location.hostname}`, registrableDomain];

        for (const name of cookieNames) {
            for (const domain of new Set(domains)) {
                document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
            }
        }
    } catch {
        // Cookie access can be blocked by browser privacy settings.
    }
}

function disableGoogleTag(measurementId?: string) {
    if (measurementId) {
        setGoogleTagDisabled(measurementId, true);
        window.gtag?.("consent", "update", {
            analytics_storage: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
        });
    }
    document.getElementById(GOOGLE_TAG_SCRIPT_ID)?.remove();
    removeGoogleAnalyticsCookies();
    window.__moesekaiGoogleTagInitialized = false;
}

function enableGoogleTag(measurementId: string) {
    if (window.__moesekaiGoogleTagInitialized) return;

    setGoogleTagDisabled(measurementId, false);
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
    };
    window.gtag("consent", "default", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });

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
        const reconcileConsent = () => {
            if (measurementId && isAnalyticsAllowed(readAnalyticsConsent())) {
                enableGoogleTag(measurementId);
            } else {
                disableGoogleTag(measurementId);
            }
        };
        const handleStorage = (event: StorageEvent) => {
            if (isAnalyticsConsentStorageEvent(event)) reconcileConsent();
        };

        reconcileConsent();
        window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, reconcileConsent);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, reconcileConsent);
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    return null;
}
