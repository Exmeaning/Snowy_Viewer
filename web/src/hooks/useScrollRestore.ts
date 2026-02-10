"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface UseScrollRestoreOptions {
    storageKey: string;           // Storage key prefix
    defaultDisplayCount: number;  // Default display count
    increment: number;            // Increment amount for load more
    isReady?: boolean;            // Whether content is ready to restore scroll (optional, default true)
}

interface UseScrollRestoreReturn {
    displayCount: number;
    setDisplayCount: React.Dispatch<React.SetStateAction<number>>;
    loadMore: () => void;
    resetDisplayCount: () => void;
    isRestoring: boolean;
}

/**
 * Custom hook to save and restore scroll position and display count.
 * Solves the problem of returning to list pages after viewing details.
 * 
 * Key features:
 * - Saves scroll position and displayCount to sessionStorage
 * - Restores displayCount immediately on mount
 * - Waits for isReady=true before restoring scroll position
 * - Uses ref to track scroll position for SPA navigation (where window.scrollY is 0 on cleanup)
 * 
 * Usage:
 * ```tsx
 * const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
 *     storageKey: "cards",
 *     defaultDisplayCount: 30,
 *     increment: 30,
 *     isReady: !isLoading, // Pass loading state
 * });
 * ```
 */
export function useScrollRestore({
    storageKey,
    defaultDisplayCount,
    increment,
    isReady = true, // Default to true for backward compatibility
}: UseScrollRestoreOptions): UseScrollRestoreReturn {
    const SCROLL_KEY = `${storageKey}_scroll`;
    const COUNT_KEY = `${storageKey}_displayCount`;

    // Initialize displayCount from sessionStorage or use default
    const [displayCount, setDisplayCount] = useState<number>(() => {
        if (typeof window === "undefined") return defaultDisplayCount;
        try {
            const saved = sessionStorage.getItem(COUNT_KEY);
            if (saved) {
                const count = parseInt(saved, 10);
                if (!isNaN(count) && count >= defaultDisplayCount) {
                    return count;
                }
            }
        } catch {
            // sessionStorage not available
        }
        return defaultDisplayCount;
    });

    const [isRestoring, setIsRestoring] = useState(true);
    const hasRestoredScroll = useRef(false);
    const pendingScrollY = useRef<number | null>(null);
    // Track the last known scroll position for SPA navigation
    // This is crucial because window.scrollY may be 0 when cleanup runs during Next.js navigation
    const lastScrollY = useRef<number>(0);

    // On mount, check if we have a saved scroll position
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const savedScroll = sessionStorage.getItem(SCROLL_KEY);
            if (savedScroll) {
                const scrollY = parseInt(savedScroll, 10);
                if (!isNaN(scrollY) && scrollY > 0) {
                    pendingScrollY.current = scrollY;
                }
            }
        } catch {
            // sessionStorage not available
        }
    }, [SCROLL_KEY]);

    // Save displayCount whenever it changes
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            sessionStorage.setItem(COUNT_KEY, String(displayCount));
        } catch {
            // sessionStorage not available
        }
    }, [displayCount, COUNT_KEY]);

    // Save scroll position continuously and before leaving
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Save to sessionStorage (using ref value which is always up-to-date)
        const saveScrollPosition = () => {
            try {
                // Use ref value instead of window.scrollY because window may be at 0 during cleanup
                const scrollToSave = lastScrollY.current;
                if (scrollToSave > 0) {
                    sessionStorage.setItem(SCROLL_KEY, String(scrollToSave));
                }
            } catch {
                // sessionStorage not available
            }
        };

        // Track scroll position in ref (this always reflects current scroll)
        const handleScroll = () => {
            lastScrollY.current = window.scrollY;
            // Only save periodically AFTER scroll restoration is complete
            // This prevents overwriting the saved position with 0 during initial mount
            if (hasRestoredScroll.current) {
                saveScrollPosition();
            }
        };

        // Initialize with current scroll position
        lastScrollY.current = window.scrollY;

        // Save on beforeunload (full page navigation/reload)
        window.addEventListener("beforeunload", saveScrollPosition);

        // Track scroll continuously
        window.addEventListener("scroll", handleScroll, { passive: true });

        // For SPA navigation: intercept link clicks and save before navigation
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            if (link && link.href && !link.target && !link.download) {
                // This is an internal link click - save immediately
                // Always save here even during restore, because user is actively navigating away
                lastScrollY.current = window.scrollY;
                saveScrollPosition();
            }
        };
        document.addEventListener("click", handleClick, { capture: true });

        return () => {
            window.removeEventListener("beforeunload", saveScrollPosition);
            window.removeEventListener("scroll", handleScroll);
            document.removeEventListener("click", handleClick, { capture: true });
            // Save on cleanup (route change) - use ref value
            // Only save if scroll restoration is already complete, to avoid
            // overwriting the saved position with 0 during re-mounts
            if (hasRestoredScroll.current) {
                saveScrollPosition();
            }
        };
    }, [SCROLL_KEY]);

    // Restore scroll position ONLY when isReady becomes true
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isReady) return; // Wait for content to be ready
        if (hasRestoredScroll.current) return; // Already restored
        if (pendingScrollY.current === null) {
            // No scroll to restore
            setIsRestoring(false);
            hasRestoredScroll.current = true;
            return;
        }

        const targetScrollY = pendingScrollY.current;

        // Use multiple rAF to ensure content is fully rendered
        // This allows React to complete rendering and DOM to update
        const restoreScroll = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        window.scrollTo({
                            top: targetScrollY,
                            behavior: "instant",
                        });
                        // Update our ref to reflect the restored position
                        lastScrollY.current = targetScrollY;
                        setIsRestoring(false);
                        hasRestoredScroll.current = true;
                        pendingScrollY.current = null;
                    });
                });
            });
        };

        // Additional delay to ensure images and other content have loaded
        const timer = setTimeout(restoreScroll, 150);
        return () => clearTimeout(timer);
    }, [isReady]);

    // Load more handler
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + increment);
    }, [increment]);

    // Reset handler
    const resetDisplayCount = useCallback(() => {
        setDisplayCount(defaultDisplayCount);
        // Clear saved scroll position on reset
        try {
            sessionStorage.removeItem(SCROLL_KEY);
            sessionStorage.setItem(COUNT_KEY, String(defaultDisplayCount));
        } catch {
            // sessionStorage not available
        }
        // Reset refs
        lastScrollY.current = 0;
        // Scroll to top on reset
        window.scrollTo({ top: 0, behavior: "instant" });
    }, [defaultDisplayCount, SCROLL_KEY, COUNT_KEY]);

    return {
        displayCount,
        setDisplayCount,
        loadMore,
        resetDisplayCount,
        isRestoring,
    };
}
