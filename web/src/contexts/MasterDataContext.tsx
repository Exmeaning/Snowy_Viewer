"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchVersionInfoNoCache, MASTERDATA_VERSION_KEY, clearCacheBypassFlag, setCacheBypassFlag } from "@/lib/fetch";

interface MasterDataContextType {
    cloudVersion: string | null;
    isLoading: boolean;
    isRefreshing: boolean;
    forceRefreshData: () => void;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
    const [cloudVersion, setCloudVersion] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Check version on mount and handle refresh param
    useEffect(() => {
        async function init() {
            try {
                // Check if we just refreshed (via _refresh param)
                const url = new URL(window.location.href);
                const justRefreshed = url.searchParams.has('_refresh');

                // IMPORTANT: Set sessionStorage flag BEFORE cleaning URL
                // This ensures other components can detect cache bypass mode
                if (justRefreshed) {
                    setCacheBypassFlag();
                    // Now clean up the URL (visual cleanup only)
                    url.searchParams.delete('_refresh');
                    window.history.replaceState({}, '', url.toString());
                }

                // Fetch cloud version (no cache)
                const versionInfo = await fetchVersionInfoNoCache();
                const cloud = versionInfo.dataVersion;
                setCloudVersion(cloud);

                // Store the version after successful refresh
                if (justRefreshed) {
                    localStorage.setItem(MASTERDATA_VERSION_KEY, cloud);
                }
            } catch (e) {
                console.warn("Failed to fetch cloud version:", e);
            } finally {
                setIsLoading(false);
            }
        }
        init();

        // Clean up cache bypass flag after initial page load (give time for data to load)
        // This runs on unmount or when user navigates away
        return () => {
            // Don't clear on unmount - we want the flag to persist during the refresh
        };
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
        setIsRefreshing(true);
        const url = new URL(window.location.href);
        url.searchParams.set('_refresh', Date.now().toString());
        window.location.href = url.toString();
    }, []);

    return (
        <MasterDataContext.Provider
            value={{
                cloudVersion,
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
