"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";

/**
 * Floating action button + Modal for the Quick Filter.
 * Renders a filter-funnel icon above the ScrollToTop button to
 * let users open the page's filter panel without scrolling.
 *
 * Only visible when a page has registered filter content via
 * `useQuickFilter()`.
 */
export default function QuickFilterButton() {
    const { t } = useI18n();
    const { filterContent, filterTitle, isOpen, open, close } = useQuickFilterContext();
    const [isVisible, setIsVisible] = useState(false);
    const [isTapAnimating, setIsTapAnimating] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);

    // Ref to manage the release-delay timer so we can cancel it on re-press
    const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearReleaseTimer = useCallback(() => {
        if (releaseTimerRef.current !== null) {
            clearTimeout(releaseTimerRef.current);
            releaseTimerRef.current = null;
        }
    }, []);

    const handleOpen = () => {
        // Keep interaction active through the action
        clearReleaseTimer();
        setIsInteracting(true);

        setIsTapAnimating(true);
        window.setTimeout(() => setIsTapAnimating(false), 280);

        window.setTimeout(() => open(), 120);

        // Delayed deactivation after action animation completes
        releaseTimerRef.current = setTimeout(() => {
            setIsInteracting(false);
        }, 400);
    };

    const handlePressStart = () => {
        clearReleaseTimer();
        setIsInteracting(true);
    };

    const handlePressEnd = () => {
        // Delay the release so the visual state persists briefly (matches PC hover feel)
        clearReleaseTimer();
        releaseTimerRef.current = setTimeout(() => {
            setIsInteracting(false);
        }, 400);
    };

    useEffect(() => {
        const toggleVisibility = () => {
            setIsVisible(window.scrollY > 300);
        };

        window.addEventListener("scroll", toggleVisibility);
        toggleVisibility();

        return () => window.removeEventListener("scroll", toggleVisibility);
    }, []);

    // Clean up timer on unmount
    useEffect(() => {
        return () => clearReleaseTimer();
    }, [clearReleaseTimer]);

    // Don't render anything if no page has registered filters
    if (!filterContent) return null;

    return (
        <>
            {/* Floating button */}
            <button
                onClick={handleOpen}
                onPointerDown={handlePressStart}
                onPointerUp={handlePressEnd}
                onPointerLeave={handlePressEnd}
                onPointerCancel={handlePressEnd}
                /* Same recipe as ScrollToTop, which sits directly below it: a
                   genuinely circular floating control, opaque face, 1px border,
                   no lift on hover. `--hh-shadow-float` (not `-floating`) is the
                   real token name — the previous spelling resolved to nothing, so
                   the button had no elevation at all. */
                className={`hh-press hh-focusable fixed bottom-[6.5rem] right-8 p-3 rounded-[var(--hh-radius-full)] border shadow-[var(--hh-shadow-float)] transition-[opacity,transform,background-color,border-color,color] duration-[var(--hh-dur-screen)] ease-[var(--hh-ease-out)] z-[100] group md:hidden ${isInteracting
                    ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                    : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-accent)] hover:border-[var(--hh-accent-deep)] hover:text-[var(--hh-text-on-accent)]"
                    } ${isVisible
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 translate-y-10 scale-90 pointer-events-none"
                    }`}
                aria-label={t("common.filter.openQuickFilter")}
            >
                <svg
                    className={`w-6 h-6 transition-transform duration-[var(--hh-dur-screen)] ease-[var(--hh-ease-out)] ${isTapAnimating ? "quick-filter-icon-tap" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                </svg>
            </button>

            {/* Modal overlay with the page's filter content */}
            <Modal
                isOpen={isOpen}
                onClose={close}
                title={filterTitle}
                size="md"
            >
                <div className="quick-filter-modal-content">
                    {filterContent}
                </div>
            </Modal>
        </>
    );
}
