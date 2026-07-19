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
import { localizePathForBrowser } from "@/lib/localized-path";
import DetailSeoSummary from "@/components/seo/DetailSeoSummary";
import { useDetailSeoSummary } from "@/contexts/DetailSeoSummaryContext";

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
    const detailSeoSummary = useDetailSeoSummary();
    const { useTrainedThumbnail, setUseTrainedThumbnail, backgroundAnimationBudget } = useTheme();
    const pageContentRef = useRef<HTMLDivElement>(null);
    const shouldShowAmbientBlobs = backgroundAnimationBudget === "on";
    const shouldAnimateAmbientBlobs = shouldShowAmbientBlobs;

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

    // Mark overlays on <html> so CSS can pause heavy background animations and
    // tone down backdrop blur on mobile while an overlay is present. This is the
    // main lever for keeping the "open settings panel" interaction smooth on phones:
    // a live blurred backdrop (liquid-glass-modal, 28px blur) sitting on top of a
    // continuously animating background forces the compositor to re-run the blur
    // every frame. Freezing the background while an overlay is up removes that
    // per-frame cost entirely.
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.dataset.overlayOpen = anyOverlayOpen ? "true" : "false";
        return () => {
            // Only clear when we were the ones to set it.
            if (document.documentElement.dataset.overlayOpen === "true") {
                document.documentElement.dataset.overlayOpen = "false";
            }
        };
    }, [anyOverlayOpen]);

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
        router.replace(localizePathForBrowser(href));
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
        onNavigateHome: () => router.push(localizePathForBrowser("/")),
        onNavigateCards: () => router.push(localizePathForBrowser("/cards")),
        onNavigateMusic: () => router.push(localizePathForBrowser("/music")),
        onNavigateEvents: () => router.push(localizePathForBrowser("/events")),
        onNavigateProfile: () => router.push(localizePathForBrowser("/profile")),
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

            {/* iOS 26 Ambient Colorful Glowing Blobs */}
            {shouldShowAmbientBlobs && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
                    <div
                        className={`absolute top-1/4 left-10 w-72 h-72 rounded-full pointer-events-none ${shouldAnimateAmbientBlobs ? "animate-float-blob-1 will-change-transform" : ""}`}
                        style={{ backgroundColor: "rgba(var(--color-miku-rgb, 51, 204, 187), 0.10)", filter: shouldAnimateAmbientBlobs ? "blur(90px)" : "blur(72px)" }}
                    />
                    <div
                        className={`absolute bottom-1/3 right-10 w-96 h-96 rounded-full pointer-events-none ${shouldAnimateAmbientBlobs ? "animate-float-blob-2 will-change-transform" : ""}`}
                        style={{ backgroundColor: "rgba(var(--color-comp-rgb, 255, 117, 168), 0.10)", filter: shouldAnimateAmbientBlobs ? "blur(100px)" : "blur(76px)" }}
                    />
                    <div
                        className={`absolute top-2/3 left-1/3 w-80 h-80 rounded-full pointer-events-none ${shouldAnimateAmbientBlobs ? "animate-float-blob-1 will-change-transform" : ""}`}
                        style={{ backgroundColor: "rgba(var(--color-mid-rgb, 255, 229, 138), 0.07)", filter: shouldAnimateAmbientBlobs ? "blur(90px)" : "blur(72px)" }}
                    />
                </div>
            )}

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
            <div className={`flex flex-grow relative ${immersiveMode ? "" : "pt-[5.5rem]"}`}>
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
                <div ref={pageContentRef} data-shortcut-page-root="true" className={`flex-grow relative z-10 w-full min-w-0 ${hasMounted ? 'transition-all duration-300' : ''} ${effectiveSidebarOpen ? 'md:ml-[18rem]' : 'md:ml-0'
                    }`}>
                    {children}
                    {detailSeoSummary && (
                        <DetailSeoSummary
                            title={detailSeoSummary.title}
                            description={detailSeoSummary.description}
                        />
                    )}
                </div>
            </div>

            {!immersiveMode && (
                <>
                    {/* Footer */}
                    <div className={`relative z-[5] ${hasMounted ? 'transition-all duration-300' : ''} ${effectiveSidebarOpen ? 'md:ml-[18rem]' : 'md:ml-0'
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
