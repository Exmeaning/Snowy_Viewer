"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchVersionInfoNoCache, MASTERDATA_VERSION_KEY, clearCacheBypassFlag, setCacheBypassFlag } from "@/lib/fetch";
import { clearAllCache } from "@/lib/masterdata-cache";

// Circuit breaker: prevent infinite refresh loops
const REFRESH_COUNT_KEY = "masterdata-refresh-count";
const REFRESH_TS_KEY = "masterdata-refresh-ts";
const MAX_REFRESHES = 2;          // max refreshes allowed within the time window
const REFRESH_WINDOW_MS = 15_000; // 15 seconds

/** Read current refresh state from sessionStorage, resetting if outside the time window */
function getRefreshState(): { count: number } {
    const now = Date.now();
    const ts = parseInt(sessionStorage.getItem(REFRESH_TS_KEY) || "0", 10);
    const count = parseInt(sessionStorage.getItem(REFRESH_COUNT_KEY) || "0", 10);
    return { count: now - ts > REFRESH_WINDOW_MS ? 0 : count };
}

function isRefreshAllowed(): boolean {
    if (typeof window === "undefined") return false;
    return getRefreshState().count < MAX_REFRESHES;
}

function recordRefresh(): void {
    if (typeof window === "undefined") return;
    const { count } = getRefreshState();
    sessionStorage.setItem(REFRESH_COUNT_KEY, String(count + 1));
    sessionStorage.setItem(REFRESH_TS_KEY, String(Date.now()));
}

interface MasterDataContextType {
    cloudVersion: string | null;
    localVersion: string | null;
    isLoading: boolean;
    isRefreshing: boolean;
    forceRefreshData: () => void;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
    const [cloudVersion, setCloudVersion] = useState<string | null>(null);
    const [localVersion, setLocalVersion] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Check version on mount and handle refresh param
    useEffect(() => {
        let aborted = false;

        async function init() {
            // Check if we just refreshed (via _refresh param)
            const url = new URL(window.location.href);
            const justRefreshed = url.searchParams.has('_refresh');

            // If this is a refresh landing, clean the URL immediately regardless of outcome
            if (justRefreshed) {
                url.searchParams.delete('_refresh');
                window.history.replaceState({}, '', url.toString());

                // Circuit breaker: if we've refreshed too many times recently, bail out
                if (!isRefreshAllowed()) {
                    console.warn("[MasterData] Refresh circuit breaker triggered — skipping refresh to prevent loop");
                    clearCacheBypassFlag();
                    // Still try to load normally with whatever version we have
                    const storedVersion = localStorage.getItem(MASTERDATA_VERSION_KEY);
                    if (!aborted) {
                        if (storedVersion) setLocalVersion(storedVersion);
                        setIsLoading(false);
                    }
                    return;
                }

                recordRefresh();
                setCacheBypassFlag();
            }

            try {
                // Fetch cloud version (no cache)
                const versionInfo = await fetchVersionInfoNoCache();
                if (aborted) return;

                const cloud = versionInfo.dataVersion;
                setCloudVersion(cloud);

                // Store the version after successful refresh
                if (justRefreshed) {
                    // Clear all IndexedDB cache on force refresh
                    await clearAllCache();
                    if (aborted) return;
                    localStorage.setItem(MASTERDATA_VERSION_KEY, cloud);
                    setLocalVersion(cloud);
                } else {
                    const storedVersion = localStorage.getItem(MASTERDATA_VERSION_KEY);
                    // If cloud version differs from stored version, clear stale cache
                    if (storedVersion && storedVersion !== cloud) {
                        console.log(`[MasterData] Version changed: ${storedVersion} → ${cloud}, clearing cache...`);
                        await clearAllCache();
                        if (aborted) return;
                        localStorage.setItem(MASTERDATA_VERSION_KEY, cloud);
                        setLocalVersion(cloud);
                    } else if (!storedVersion) {
                        // First visit, store the version
                        localStorage.setItem(MASTERDATA_VERSION_KEY, cloud);
                        setLocalVersion(cloud);
                    } else {
                        setLocalVersion(storedVersion);
                    }
                }
            } catch (e) {
                if (aborted) return;
                console.warn("Failed to fetch cloud version:", e);
                // On failure, clear the bypass flag so we don't leave stale state
                clearCacheBypassFlag();
                // Fall back to stored version if available
                const storedVersion = localStorage.getItem(MASTERDATA_VERSION_KEY);
                if (storedVersion) setLocalVersion(storedVersion);
            } finally {
                if (!aborted) setIsLoading(false);
            }
        }
        init();
        return () => { aborted = true; };
    }, []);

    // Clear cache bypass flag after page has fully loaded (delayed cleanup)
    useEffect(() => {
        if (!isLoading) {
            // Wait a bit for other components to finish fetching, then clear the flag
            const timer = setTimeout(() => {
                clearCacheBypassFlag();
            }, 5000); // 5 seconds should be enough for all data to load
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    // Force refresh: reload page with cache bypass
    const forceRefreshData = useCallback(() => {
        if (!isRefreshAllowed()) {
            console.warn("[MasterData] Refresh blocked by circuit breaker");
            return;
        }
        setIsRefreshing(true);
        const url = new URL(window.location.href);
        url.searchParams.set('_refresh', Date.now().toString());
        window.location.href = url.toString();
    }, []);

    return (
        <MasterDataContext.Provider
            value={{
                cloudVersion,
                localVersion,
                isLoading,
                isRefreshing,
                forceRefreshData,
            }}
        >
            {children}
        </MasterDataContext.Provider>
    );
}

export function useMasterData() {
    const context = useContext(MasterDataContext);
    if (context === undefined) {
        throw new Error("useMasterData must be used within a MasterDataProvider");
    }
    return context;
}
