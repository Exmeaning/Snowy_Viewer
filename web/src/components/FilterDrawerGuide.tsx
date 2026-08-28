"use client";
import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { stripRouteLocale } from "@/lib/localized-path";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilterContext, FILTER_DRAWER_HINT_STORAGE_KEY } from "@/contexts/QuickFilterContext";
import { getMotionTransition } from "@/lib/motion";

const HINT_CHANGE_EVENT = "moesekai_filter_drawer_hint_change";

/**
 * Default to "already seen" whenever storage is unavailable (SSR, private mode,
 * blocked storage). A coach mark that fails open would be shown to everyone on
 * every visit, which is far worse than never showing it at all.
 */
function readHintSeen(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return localStorage.getItem(FILTER_DRAWER_HINT_STORAGE_KEY) === "true";
    } catch {
        return true;
    }
}

function subscribeHint(callback: () => void) {
    // `storage` only fires in *other* tabs, so it keeps duplicated tabs in sync;
    // the custom event covers same-tab writes, which `storage` never reports.
    const handleStorage = (e: StorageEvent) => {
        if (e.key === FILTER_DRAWER_HINT_STORAGE_KEY) callback();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(HINT_CHANGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(HINT_CHANGE_EVENT, callback);
    };
}

function writeHintSeen() {
    try {
        localStorage.setItem(FILTER_DRAWER_HINT_STORAGE_KEY, "true");
    } catch {
        // Ignored.
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(HINT_CHANGE_EVENT));
    }
}

const emptySubscribe = () => () => {};

interface FilterDrawerGuideProps {
    isSidebarOpen?: boolean;
}

/**
 * FilterDrawerGuide — non-intrusive floating coach mark anchored next to the left-side filter tab.
 *
 * Appears once on pages that register filter controls, informing users that filters
 * have moved to the left edge with a simple "Got it" button.
 */
export default function FilterDrawerGuide({ isSidebarOpen = false }: FilterDrawerGuideProps) {
    const { t } = useI18n();
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { hasFilters, isOpen, isDocked } = useQuickFilterContext();
    const prefersReducedMotion = useReducedMotion();

    const dialogTransition = getMotionTransition("soft", {
        reducedMotion: !!prefersReducedMotion,
    });

    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    const hasSeenHint = useSyncExternalStore(
        subscribeHint,
        readHintSeen,
        () => true
    );

    const dismiss = useCallback(() => {
        writeHintSeen();
    }, []);

    const isVisible = Boolean(mounted && hasFilters && !hasSeenHint);

    // Close on Escape key
    useEffect(() => {
        if (!isVisible) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                dismiss();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isVisible, dismiss]);

    if (!mounted) return null;

    // Anchor position right next to the filter tab handle or docked drawer
    const isDockedOpen = isOpen && isDocked;
    const baseLeftClass = isDockedOpen
        ? (isSidebarOpen
            ? "left-14 lg:left-[calc(var(--beside-sidebar)+var(--filter-drawer-w)+3.25rem)]"
            : "left-14 lg:left-[calc(var(--filter-drawer-w)+4.25rem)]")
        : (isSidebarOpen
            ? "left-14 md:left-[calc(var(--sidebar-edge)+3.25rem)]"
            : "left-14 sm:left-16");

    const verticalPositionClass = isHome
        ? "top-[7rem] sm:top-[7.5rem]"
        : "top-[9rem] sm:top-[7.5rem]";

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <aside
                    aria-label={t("common.filter.drawerHintTitle")}
                    className={`fixed ${verticalPositionClass} ${baseLeftClass} z-[85] pointer-events-none max-w-[calc(100vw-4.5rem)] sm:max-w-xs select-none`}
                >
                    <motion.div
                        className="pointer-events-auto relative island-panel material-thick rounded-2xl shadow-2xl border border-miku/40 p-4 flex flex-col gap-2.5 text-slate-800 dark:text-slate-100 transform-gpu will-change-transform"
                        initial={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, x: -10, scale: 0.96 }
                        }
                        animate={
                            prefersReducedMotion
                                ? { opacity: 1 }
                                : { opacity: 1, x: 0, scale: 1 }
                        }
                        exit={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, x: -10, scale: 0.96 }
                        }
                        transition={dialogTransition}
                        role="region"
                        aria-live="polite"
                    >
                        {/* Left beak pointer indicating the tab handle */}
                        <div
                            className="absolute -left-1.5 top-5 w-3 h-3 rotate-45 border-l border-b border-miku/40 bg-white/95 dark:bg-slate-900/95 pointer-events-none"
                            aria-hidden="true"
                        />

                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 relative z-10">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-miku/15 text-miku flex items-center justify-center shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                </div>
                                <h3 className="text-xs sm:text-sm font-bold type-title text-slate-800 dark:text-slate-100 truncate">
                                    {t("common.filter.drawerHintTitle")}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={dismiss}
                                className="pressable p-1 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full transition-colors cursor-pointer shrink-0"
                                aria-label={t("common.action.close")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body description */}
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed relative z-10">
                            {t("common.filter.drawerHintBody")}
                        </p>

                        {/* Dismiss button */}
                        <div className="flex items-center justify-end pt-1 relative z-10">
                            <button
                                type="button"
                                onClick={dismiss}
                                className="pressable px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-miku hover:bg-miku-dark shadow-sm shadow-miku/20 transition-colors cursor-pointer"
                            >
                                {t("common.filter.drawerHintDismiss")}
                            </button>
                        </div>
                    </motion.div>
                </aside>
            )}
        </AnimatePresence>,
        document.body
    );
}
