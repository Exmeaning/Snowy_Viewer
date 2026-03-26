"use client";
import { useEffect, useRef } from "react";

/**
 * Lightweight scroll position save/restore for list pages without pagination.
 * Saves to sessionStorage on navigation away, restores when isReady becomes true.
 */
export function useSimpleScrollRestore(storageKey: string, isReady: boolean) {
    const SCROLL_KEY = `${storageKey}_scroll`;
    const lastScrollY = useRef(0);
    const hasRestored = useRef(false);

    // Save scroll on scroll + link click + cleanup
    useEffect(() => {
        if (typeof window === "undefined") return;

        const save = () => {
            if (lastScrollY.current > 0) {
                try { sessionStorage.setItem(SCROLL_KEY, String(lastScrollY.current)); } catch { /* ignore */ }
            }
        };

        const onScroll = () => { lastScrollY.current = window.scrollY; };
        const onClick = (e: MouseEvent) => {
            const link = (e.target as HTMLElement).closest("a");
            if (link && link.href && !link.target && !link.download) {
                lastScrollY.current = window.scrollY;
                save();
            }
        };

        lastScrollY.current = window.scrollY;
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("beforeunload", save);
        document.addEventListener("click", onClick, { capture: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("beforeunload", save);
            document.removeEventListener("click", onClick, { capture: true });
            if (hasRestored.current) save();
        };
    }, [SCROLL_KEY]);

    // Restore scroll when content is ready
    useEffect(() => {
        if (!isReady || hasRestored.current) return;
        hasRestored.current = true;

        try {
            const saved = sessionStorage.getItem(SCROLL_KEY);
            if (!saved) return;
            const y = parseInt(saved, 10);
            if (isNaN(y) || y <= 0) return;

            const restore = () => requestAnimationFrame(() => requestAnimationFrame(() => {
                window.scrollTo({ top: y, behavior: "instant" });
                lastScrollY.current = y;
            }));
            const t = setTimeout(restore, 150);
            return () => clearTimeout(t);
        } catch { /* ignore */ }
    }, [isReady, SCROLL_KEY]);
}
