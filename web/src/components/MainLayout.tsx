"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainNavbar from "./MainNavbar";
import Sidebar from "./Sidebar";
import MainFooter from "./MainFooter";
import ScrollToTop from "./ScrollToTop";
import QuickFilterButton from "./QuickFilterButton";
import SekaiLoader from "./SekaiLoader";
import BackgroundPattern from "./BackgroundPattern";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePageListShortcuts } from "@/hooks/usePageListShortcuts";
import { useTheme } from "@/contexts/ThemeContext";

function ScreenshotParamsListener({ onChange }: { onChange: (isScreenshot: boolean) => void }) {
    const searchParams = useSearchParams();
    useEffect(() => {
        onChange(searchParams.get("mode") === "screenshot");
    }, [searchParams, onChange]);
    return null;
}

function getHistoryStateObject() {
    return typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state as Record<string, unknown>
        : {};
}

function hasOverlayHistoryState() {
    return Boolean(getHistoryStateObject().moesekaiOverlay);
}

interface MainLayoutProps {
    children: React.ReactNode;
    showLoader?: boolean;
    immersiveMode?: boolean;
}

export default function MainLayout({
    children,
    showLoader = false,
    immersiveMode = false,
}: MainLayoutProps) {
    const router = useRouter();
    const { useTrainedThumbnail, setUseTrainedThumbnail } = useTheme();
    const pageContentRef = useRef<HTMLDivElement>(null);

    // Keep the initial value false to avoid hydration mismatch.
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [hasMounted, setHasMounted] = useState(false);
    const [isScreenshotMode, setIsScreenshotMode] = useState(false);

    // Centralized UI states managed by MainLayout.
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

    // Track whether we pushed a history entry for an overlay, so the mobile
    // back button closes the overlay instead of navigating away.
    const overlayHistoryRef = useRef(false);
    const overlayHistoryArmedRef = useRef(false);
    const overlayHistoryArmRafRef = useRef<number | null>(null);
    const skipNextOverlayHistoryCleanupRef = useRef(false);

    const anyOverlayOpen = isSearchOpen || isSettingsOpen || isShortcutsHelpOpen;

    const cancelOverlayHistoryArm = useCallback(() => {
        if (overlayHistoryArmRafRef.current !== null) {
            cancelAnimationFrame(overlayHistoryArmRafRef.current);
            overlayHistoryArmRafRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (anyOverlayOpen) {
            // Push a sentinel state so the back button can close the overlay.
            if (!overlayHistoryRef.current) {
                window.history.pushState(
                    { ...getHistoryStateObject(), moesekaiOverlay: true },
                    "",
                );
                overlayHistoryRef.current = true;
                overlayHistoryArmedRef.current = false;
                cancelOverlayHistoryArm();
                // Mobile browsers can emit a popstate around URL normalization
                // right after pushState. Arm the listener one frame later to
                // avoid immediately closing the just-opened topbar overlay.
                overlayHistoryArmRafRef.current = requestAnimationFrame(() => {
                    overlayHistoryArmedRef.current = true;
                    overlayHistoryArmRafRef.current = null;
                });
            }
            return;
        }

        if (!overlayHistoryRef.current) return;

        cancelOverlayHistoryArm();
        overlayHistoryArmedRef.current = false;

        const shouldSkipCleanup = skipNextOverlayHistoryCleanupRef.current;
        skipNextOverlayHistoryCleanupRef.current = false;
        overlayHistoryRef.current = false;

        // Search result navigation replaces the overlay sentinel entry with the
        // destination page, so there is no extra history entry to pop here.
        if (!shouldSkipCleanup && hasOverlayHistoryState()) {
            window.history.back();
        }
    }, [anyOverlayOpen, cancelOverlayHistoryArm]);

    useEffect(() => {
        const handlePopState = () => {
            // If an overlay is open and the user pressed back, close it.
            if (overlayHistoryRef.current && overlayHistoryArmedRef.current) {
                overlayHistoryRef.current = false;
                overlayHistoryArmedRef.current = false;
                cancelOverlayHistoryArm();
                skipNextOverlayHistoryCleanupRef.current = false;
                setIsSearchOpen(false);
                setIsSettingsOpen(false);
                setIsShortcutsHelpOpen(false);
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            cancelOverlayHistoryArm();
            window.removeEventListener("popstate", handlePopState);
        };
    }, [cancelOverlayHistoryArm]);

    useEffect(() => {
        if (!immersiveMode) return;

        const raf = requestAnimationFrame(() => {
            setIsSearchOpen(false);
            setIsSettingsOpen(false);
            setIsShortcutsHelpOpen(false);
        });

        return () => cancelAnimationFrame(raf);
    }, [immersiveMode]);

    // Restore sidebar state from sessionStorage after mount.
    // Use two RAF ticks: set position first, then enable transitions.
    useEffect(() => {
        const nextSidebarOpen = isScreenshotMode
            ? false
            : immersiveMode
            ? false
            : (() => {
                const saved = sessionStorage.getItem("sidebar_open");
                if (saved !== null) return saved === "true";
                // Check both window.innerWidth and screen.width to avoid old mobile browsers
                // reporting the layout viewport width through innerWidth.
                const isWideScreen = window.innerWidth >= 768 && screen.width >= 768;
                return isWideScreen;
            })();
        let raf1 = 0;
        let raf2 = 0;

        raf1 = requestAnimationFrame(() => {
            setIsSidebarOpen(nextSidebarOpen);
            raf2 = requestAnimationFrame(() => {
                setHasMounted(true);
            });
        });

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [immersiveMode, isScreenshotMode]);

    const effectiveSidebarOpen = isScreenshotMode || immersiveMode ? false : isSidebarOpen;

    const handleMenuToggle = useCallback(() => {
        if (isScreenshotMode || immersiveMode) return;
        setIsSidebarOpen(prev => {
            const newState = !prev;
            sessionStorage.setItem('sidebar_open', String(newState));
            return newState;
        });
    }, [immersiveMode, isScreenshotMode]);

    const handleSidebarClose = useCallback(() => {
        setIsSidebarOpen(false);
        if (!isScreenshotMode && !immersiveMode) {
            sessionStorage.setItem('sidebar_open', 'false');
        }
    }, [immersiveMode, isScreenshotMode]);

    const handleSearchClose = useCallback(() => {
        setIsSearchOpen(false);
    }, []);

    const handleSearchNavigate = useCallback((href: string) => {
        skipNextOverlayHistoryCleanupRef.current = true;
        setIsSearchOpen(false);
        router.replace(href);
    }, [router]);

    // Keyboard shortcut handlers.
    const shortcutHandlers = useMemo(() => ({
        onToggleSidebar: () => {
            if (isScreenshotMode || immersiveMode) return;
            setIsSidebarOpen(prev => {
                const newState = !prev;
                sessionStorage.setItem('sidebar_open', String(newState));
                return newState;
            });
        },
        onToggleSettings: () => setIsSettingsOpen(prev => !prev),
        onToggleSearch: () => setIsSearchOpen(prev => !prev),
        onToggleShortcutsHelp: () => setIsShortcutsHelpOpen(prev => !prev),
        onToggleTrainedThumbnail: () => setUseTrainedThumbnail(!useTrainedThumbnail),
        onNavigateBack: () => router.back(),
        onNavigateForward: () => window.history.forward(),
        onNavigateHome: () => router.push("/"),
        onNavigateCards: () => router.push("/cards"),
        onNavigateMusic: () => router.push("/music"),
        onNavigateEvents: () => router.push("/events"),
        onNavigateProfile: () => router.push("/profile"),
    }), [router, useTrainedThumbnail, setUseTrainedThumbnail, immersiveMode, isScreenshotMode]);

    const isShortcutScopeLocked = isSearchOpen || isSettingsOpen || isShortcutsHelpOpen || immersiveMode;

    useKeyboardShortcuts(shortcutHandlers, {
        disabled: isShortcutScopeLocked,
    });

    usePageListShortcuts({
        rootRef: pageContentRef,
        disabled: isShortcutScopeLocked,
    });

    return (
        <main className="min-h-screen relative selection:bg-miku selection:text-white font-sans flex flex-col">
            <Suspense fallback={null}>
                <ScreenshotParamsListener onChange={setIsScreenshotMode} />
            </Suspense>

            {/* Loading Animation */}
            {showLoader && <SekaiLoader />}

            {/* Background Pattern */}
            <BackgroundPattern />

            {/* Navbar */}
            {!immersiveMode && (
                <MainNavbar
                    onMenuToggle={handleMenuToggle}
                    isSearchOpen={isSearchOpen}
                    onSearchToggle={() => setIsSearchOpen(prev => !prev)}
                    onSearchClose={handleSearchClose}
                    onSearchNavigate={handleSearchNavigate}
                    isSettingsOpen={isSettingsOpen}
                    onSettingsToggle={() => setIsSettingsOpen(prev => !prev)}
                    onSettingsClose={() => setIsSettingsOpen(false)}
                    onShortcutsHelpToggle={() => setIsShortcutsHelpOpen(prev => !prev)}
                />
            )}

            {/* Layout with Sidebar */}
            <div className={`flex flex-grow relative ${immersiveMode ? "" : "pt-[4.5rem]"}`}>
                {/* Sidebar */}
                {!immersiveMode && (
                    <Sidebar
                        isOpen={effectiveSidebarOpen}
                        onClose={handleSidebarClose}
                        hasMounted={hasMounted}
                        disableKeyboardNavigation={isShortcutScopeLocked}
                    />
                )}

                {/* Main content area */}
                <div ref={pageContentRef} data-shortcut-page-root="true" className={`flex-grow relative z-10 w-full min-w-0 ${hasMounted ? 'transition-all duration-300' : ''} ${effectiveSidebarOpen ? 'md:ml-64' : 'md:ml-0'
                    }`}>
                    {children}
                </div>
            </div>

            {!immersiveMode && (
                <>
                    {/* Footer */}
                    <div className={`relative z-[5] ${hasMounted ? 'transition-all duration-300' : ''} ${effectiveSidebarOpen ? 'md:ml-64' : 'md:ml-0'
                        }`}>
                        <MainFooter />
                    </div>

                    {/* Scroll To Top */}
                    <ScrollToTop />

                    {/* Quick Filter floating button + modal */}
                    <QuickFilterButton />

                    {/* Keyboard Shortcuts Help */}
                    <KeyboardShortcutsHelp isOpen={isShortcutsHelpOpen} onClose={() => setIsShortcutsHelpOpen(false)} />
                </>
            )}
        </main>
    );
}
