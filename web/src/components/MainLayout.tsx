"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import MainNavbar from "./MainNavbar";
import Sidebar from "./Sidebar";
import FilterRail from "./FilterRail";
import MainFooter from "./MainFooter";
import ScrollToTop from "./ScrollToTop";
import QuickFilterButton from "./QuickFilterButton";
import SekaiLoader from "./SekaiLoader";
import BackgroundPattern from "./BackgroundPattern";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePageListShortcuts } from "@/hooks/usePageListShortcuts";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { localizePathForBrowser, stripRouteLocale } from "@/lib/localized-path";
import { hhScreenVariants } from "@/lib/motion";
import DetailSeoSummary from "@/components/seo/DetailSeoSummary";
import { useDetailSeoSummary } from "@/contexts/DetailSeoSummaryContext";
import { playHandheldSound, unlockHandheldAudio } from "@/lib/handheld-sound";

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
    const pathname = usePathname();
    const detailSeoSummary = useDetailSeoSummary();
    const { useTrainedThumbnail, setUseTrainedThumbnail, backgroundAnimationBudget } = useTheme();
    const pageContentRef = useRef<HTMLDivElement>(null);
    const shouldShowAmbientDrift = backgroundAnimationBudget === "on";
    const isHome = stripRouteLocale(pathname) === "/";

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

    // Open the audio path on the first real gesture of the session.
    //
    // Browsers refuse to start an AudioContext outside a user gesture, and a
    // context created cold stays "suspended" — the first blip after that is
    // swallowed while it resumes. Doing it here, once, on whichever of these
    // three fires first, means the sound switch works on the very first click
    // after the user flips it on. All three are removed together so a pointer
    // gesture does not leave a dangling key listener behind.
    useEffect(() => {
        const events: readonly (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
        // `once: true` only retires the listener that actually fired, so the
        // handler removes its siblings itself.
        const options: AddEventListenerOptions = { once: true, capture: true };

        const handleFirstGesture = () => {
            for (const eventName of events) {
                window.removeEventListener(eventName, handleFirstGesture, options);
            }
            unlockHandheldAudio();
        };

        for (const eventName of events) {
            window.addEventListener(eventName, handleFirstGesture, options);
        }

        return () => {
            for (const eventName of events) {
                window.removeEventListener(eventName, handleFirstGesture, options);
            }
        };
    }, []);

    // Mark overlays on <html> so CSS can pause heavy background animations while
    // an overlay is present. This is the main lever for keeping the "open
    // settings panel" interaction smooth on phones: the ambient drift layers
    // animate continuously, and running them under a full-screen overlay makes
    // the compositor redraw the background every frame for something the user
    // cannot see. Freezing them while an overlay is up removes that cost.
    //
    // The guard used to also dial backdrop blur down on touch devices; that half
    // is gone because the flat redesign has no backdrop-filter left to reduce.
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

    const { hasFilters } = useQuickFilterContext();
    const effectiveSidebarOpen = isScreenshotMode || immersiveMode ? false : isSidebarOpen;

    const layoutOffsetClass = effectiveSidebarOpen
        ? (hasFilters ? 'md:ml-[var(--hh-rail-w)] xl:ml-[var(--hh-dual-rail-w)]' : 'md:ml-[var(--hh-rail-w)]')
        : 'md:ml-0';

    const handleMenuToggle = useCallback(() => {
        if (isScreenshotMode || immersiveMode) return;
        playHandheldSound("toggle");
        setIsSidebarOpen(prev => {
            const newState = !prev;
            sessionStorage.setItem('sidebar_open', String(newState));
            return newState;
        });
    }, [immersiveMode, isScreenshotMode]);

    const handleSidebarClose = useCallback(() => {
        playHandheldSound("back");
        setIsSidebarOpen(false);
        if (!isScreenshotMode && !immersiveMode) {
            sessionStorage.setItem('sidebar_open', 'false');
        }
    }, [immersiveMode, isScreenshotMode]);

    const handleSearchClose = useCallback(() => {
        playHandheldSound("back");
        setIsSearchOpen(false);
    }, []);

    const handleSearchNavigate = useCallback((href: string) => {
        playHandheldSound("confirm");
        skipNextOverlayHistoryCleanupRef.current = true;
        setIsSearchOpen(false);
        router.replace(localizePathForBrowser(href));
    }, [router]);

    // Keyboard shortcut handlers.
    const shortcutHandlers = useMemo(() => ({
        onToggleSidebar: () => {
            if (isScreenshotMode || immersiveMode) return;
            playHandheldSound("toggle");
            setIsSidebarOpen(prev => {
                const newState = !prev;
                sessionStorage.setItem('sidebar_open', String(newState));
                return newState;
            });
        },
        onToggleSettings: () => {
            playHandheldSound("toggle");
            setIsSettingsOpen(prev => !prev);
        },
        onToggleSearch: () => {
            playHandheldSound("toggle");
            setIsSearchOpen(prev => !prev);
        },
        onToggleShortcutsHelp: () => {
            playHandheldSound("toggle");
            setIsShortcutsHelpOpen(prev => !prev);
        },
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

            {/* Ambient drift — two very wide, very faint washes.
                Softness comes from a radial-gradient, not from filter: blur().
                A 90px blur on a 24rem box is a full-screen compositor pass every
                frame; the gradient is free, and the flat/opaque design has no use
                for a real blur anyway. Gated on the animation budget exactly as
                before, and .hh-drift-* is already frozen by the
                [data-overlay-open="true"] guard in globals.css and by
                prefers-reduced-motion in handheld-os.css. */}
            {shouldShowAmbientDrift && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
                    <div
                        className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full hh-drift-a will-change-transform"
                        style={{
                            background:
                                "radial-gradient(circle closest-side, rgba(var(--color-miku-rgb, 51, 204, 187), 0.12), transparent 100%)",
                        }}
                    />
                    <div
                        className="absolute -bottom-48 -right-40 w-[46rem] h-[46rem] rounded-full hh-drift-b will-change-transform"
                        style={{
                            background:
                                "radial-gradient(circle closest-side, rgba(var(--color-comp-rgb, 255, 117, 168), 0.09), transparent 100%)",
                        }}
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

            {/* Layout with Sidebar & FilterRail */}
            {/* Content clears the console status bar via --hh-topbar-h and --hh-topbar-sub-h.
                Sidebar.tsx and FilterRail.tsx offset against the same CSS variables. */}
            <div className={`flex flex-grow relative ${immersiveMode ? "" : isHome ? "pt-[var(--hh-topbar-h)]" : "pt-[calc(var(--hh-topbar-h)+var(--hh-topbar-sub-h))]"}`}>
                {/* Sidebar & Filter Rail */}
                {!immersiveMode && (
                    <>
                        <Sidebar
                            isOpen={effectiveSidebarOpen}
                            onClose={handleSidebarClose}
                            hasMounted={hasMounted}
                            disableKeyboardNavigation={isShortcutScopeLocked}
                        />
                        <FilterRail isOpen={effectiveSidebarOpen} />
                    </>
                )}

                {/* Main content area. The ref stays on this stable wrapper so the
                    page-list shortcut root never changes identity; the screen
                    transition lives on the keyed child inside it. */}
                <div ref={pageContentRef} data-shortcut-page-root="true" className={`flex-grow relative z-10 w-full min-w-0 ${hasMounted ? 'transition-all duration-300' : ''} ${layoutOffsetClass}`}>
                    {/* Screen change. MainLayout is mounted per page, so this already
                        remounts on every route change; the key is belt-and-braces in
                        case a shared layout ever hoists MainLayout above the router.
                        There is no exit variant because the App Router unmounts the
                        old tree before an exit could play. The final state is y: 0, at
                        which point framer-motion writes `transform: none`, so nothing
                        is left holding a containing block over fixed page content. */}
                    <motion.div
                        key={pathname}
                        variants={hhScreenVariants}
                        initial="initial"
                        animate="animate"
                        className="w-full min-w-0"
                    >
                        {children}

                        {/* SEO text accordion summary */}
                        {detailSeoSummary && (
                            <DetailSeoSummary
                                title={detailSeoSummary.title}
                                description={detailSeoSummary.description}
                            />
                        )}
                    </motion.div>
                </div>
            </div>

            {!immersiveMode && (
                <>
                    {/* Footer */}
                    <div className={`relative z-[5] ${hasMounted ? 'transition-all duration-300' : ''} ${layoutOffsetClass}`}>
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
