"use client";
import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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

/**
 * FilterDrawerGuide — first-run modal dialog introducing the left-side filter drawer.
 *
 * Appears once on pages that register filter controls, guiding users to click the
 * tab handle on the left edge to open filters.
 */
export default function FilterDrawerGuide() {
    const { t } = useI18n();
    const { hasFilters, open: openFilterDrawer } = useQuickFilterContext();
    const prefersReducedMotion = useReducedMotion();

    const overlayTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });
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

    const handleOpenDrawer = useCallback(() => {
        writeHintSeen();
        openFilterDrawer();
    }, [openFilterDrawer]);

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

    // Prevent body scroll while modal is up
    useEffect(() => {
        if (!isVisible) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isVisible]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-4 sm:p-6 select-none">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 transform-gpu bg-black/40 backdrop-blur-[8px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={overlayTransition}
                        onClick={dismiss}
                    />

                    {/* Modal Dialog */}
                    <motion.div
                        className="relative w-full max-w-md transform-gpu will-change-transform liquid-glass-modal rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-miku/30 p-6 sm:p-7 gap-5 text-slate-800 dark:text-slate-100"
                        initial={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.94, y: 16 }
                        }
                        animate={
                            prefersReducedMotion
                                ? { opacity: 1 }
                                : { opacity: 1, scale: 1, y: 0 }
                        }
                        exit={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.94, y: 16 }
                        }
                        transition={dialogTransition}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="filter-drawer-guide-title"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-miku to-miku-dark text-white flex items-center justify-center shadow-md shadow-miku/20 shrink-0">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-miku/15 text-miku mb-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-miku animate-pulse" />
                                        <span>NEW</span>
                                    </div>
                                    <h3 id="filter-drawer-guide-title" className="text-base font-bold type-title text-slate-800 dark:text-slate-100">
                                        {t("common.filter.drawerHintTitle")}
                                    </h3>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismiss}
                                className="pressable p-2 -mr-1.5 -mt-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full transition-colors cursor-pointer"
                                aria-label={t("common.action.close")}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Feature Preview Spotlight Banner */}
                        <div className="relative overflow-hidden rounded-2xl border border-miku/30 bg-gradient-to-br from-miku/10 via-miku/5 to-transparent p-4 flex items-center gap-4">
                            {/* Stylized Tab Graphic */}
                            <div className="relative flex items-center justify-center shrink-0">
                                <div className="w-9 h-14 rounded-r-xl border border-l-0 border-miku/60 bg-white/80 dark:bg-slate-900/80 shadow-sm flex flex-col items-center justify-center gap-1 py-1.5 px-1">
                                    <svg className="w-4 h-4 text-miku animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    <div className="w-1.5 h-1.5 rounded-full bg-miku" />
                                </div>
                                <span className="absolute -left-1 w-11 h-16 rounded-r-xl border border-miku/40 animate-ping pointer-events-none opacity-30" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-miku flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 animate-pulse shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span>{t("common.filter.drawerHintTag")}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                    {t("common.filter.drawerHintBody")}
                                </p>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-dashed border-slate-200/60 dark:border-slate-700/40">
                            <button
                                type="button"
                                onClick={dismiss}
                                className="pressable px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white island-pill-hover cursor-pointer"
                            >
                                {t("common.filter.drawerHintDismiss")}
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenDrawer}
                                className="pressable px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-miku hover:bg-miku-dark shadow-md shadow-miku/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span>{t("common.filter.drawerHintActionOpen")}</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
