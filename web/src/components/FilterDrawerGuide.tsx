"use client";
import React, { useCallback, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilterContext, FILTER_DRAWER_HINT_STORAGE_KEY } from "@/contexts/QuickFilterContext";
import { hhSpringPanel, hhHoverLift, hhTapPress } from "@/lib/motion";
import { playHandheldSound } from "@/lib/handheld-sound";

const HINT_CHANGE_EVENT = "moesekai_filter_drawer_hint_change";

function readHintSeen(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return localStorage.getItem(FILTER_DRAWER_HINT_STORAGE_KEY) === "true";
    } catch {
        return true;
    }
}

function subscribeHint(callback: () => void) {
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

/**
 * FilterDrawerGuide — first-run coach mark for the filter drawer.
 *
 * Positioned cleanly below the vertical tab handle (top-48) to avoid any visual overlap.
 */
export default function FilterDrawerGuide() {
    const { t } = useI18n();
    const { hasFilters, isOpen } = useQuickFilterContext();

    const hasSeenHint = useSyncExternalStore(
        subscribeHint,
        readHintSeen,
        () => true
    );

    const dismiss = useCallback(() => {
        playHandheldSound("confirm");
        writeHintSeen();
    }, []);

    // Dismiss automatically if the user explicitly interacted and opened the drawer.
    React.useEffect(() => {
        if (isOpen && !hasSeenHint) {
            writeHintSeen();
        }
    }, [isOpen, hasSeenHint]);

    const isVisible = hasFilters && !hasSeenHint;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.aside
                    variants={{
                        initial: { opacity: 0, y: -8, scale: 0.96 },
                        animate: { opacity: 1, y: 0, scale: 1, transition: hhSpringPanel },
                        exit: { opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.15 } },
                    }}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    role="status"
                    aria-live="polite"
                    className="fixed left-3 sm:left-6 md:left-[calc(var(--hh-rail-w)+1rem)] top-48 z-[68] max-w-xs sm:max-w-sm p-3.5 rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-2)] border border-[var(--hh-accent)] shadow-[var(--hh-shadow-float)] flex flex-col gap-2.5"
                >
                    <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-[var(--hh-radius-md)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-grow">
                            <h4 className="text-xs font-bold text-[var(--hh-text-primary)]">
                                {t("common.filter.drawerHintTitle")}
                            </h4>
                            <p className="text-xs text-[var(--hh-text-secondary)] mt-0.5 leading-relaxed">
                                {t("common.filter.drawerHintBody")}
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <motion.button
                            type="button"
                            onClick={dismiss}
                            whileHover={hhHoverLift}
                            whileTap={hhTapPress}
                            className="hh-press hh-focusable text-xs font-semibold px-3 py-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] cursor-pointer"
                        >
                            {t("common.filter.drawerHintDismiss")}
                        </motion.button>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
