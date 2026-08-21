"use client";
import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { hhHoverLift, hhTapPress } from "@/lib/motion";
import { FILTER_DRAWER_ID } from "@/components/FilterDrawer";

interface FilterTabHandleProps {
    /** Whether the primary left navigation rail is currently open. */
    isRailOpen: boolean;
}

/**
 * FilterTabHandle — vertical protruding tab on the left sidebar/drawer boundary.
 *
 * Appearance:
 * - Neutral gray container (`bg-[var(--hh-surface-1)]` + `border-[var(--hh-border)]`) matching the left sidebar
 * - Theme accent colored interior SVG icon (`text-[var(--hh-accent)]`)
 * - Deep gray text label (`text-[var(--hh-text-secondary)]`) matching sidebar navigation items
 * - Vertically oriented: Funnel icon + vertical text label + arrow indicator.
 *
 * Positioning:
 * - Positioned at `top-32` to comfortably clear topbar and breadcrumb rows.
 * - When closed: sticks out from the right edge of the sidebar (or screen left edge if sidebar is closed).
 * - When docked drawer is open (>= 1280px): extends past the outer edge of the drawer.
 * - When floating drawer is open (< 1280px): hidden smoothly to prevent overlapping the modal overlay.
 */
export default function FilterTabHandle({ isRailOpen }: FilterTabHandleProps) {
    const { t } = useI18n();
    const { hasFilters, isOpen, isDocked, toggle, filterTitle } = useQuickFilterContext();

    const isVisible = Boolean(hasFilters && (!isOpen || isDocked));

    const label = filterTitle || t("common.filter.title");
    const shortcutLabel = t("common.filter.openQuickFilter");

    // Horizontal left position tracking sidebar and drawer
    const baseRailLeft = isRailOpen ? "left-0 md:left-[var(--hh-rail-w)]" : "left-0";

    const dockedOpenLeft = isRailOpen
        ? "left-0 xl:left-[var(--hh-dual-rail-w)]"
        : "left-0 xl:left-[var(--hh-filter-rail-w)]";

    const leftPositionClass = isOpen && isDocked ? dockedOpenLeft : baseRailLeft;

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    }, [toggle]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    key="filter-vertical-tab"
                    type="button"
                    onClick={handleClick}
                    whileHover={hhHoverLift}
                    whileTap={hhTapPress}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
                    data-hh-sound="none"
                    aria-controls={FILTER_DRAWER_ID}
                    aria-expanded={isOpen}
                    title={shortcutLabel}
                    className={`fixed top-32 ${leftPositionClass} z-[70] touch-manipulation flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-r-[var(--hh-radius-md)] border border-l-0 bg-[var(--hh-surface-1)] border-[var(--hh-border)] shadow-sm hover:bg-[var(--hh-surface-sunken)] hover:border-[var(--hh-border-strong)] cursor-pointer transition-all duration-[var(--hh-dur-panel)] ease-[var(--hh-ease-out)] select-none group`}
                >
                    {/* Theme-colored Funnel glyph */}
                    <svg
                        className={`w-3.5 h-3.5 text-[var(--hh-accent)] group-hover:scale-110 transition-transform duration-[var(--hh-dur-fast)] ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                        />
                    </svg>

                    {/* Vertical text label in deep gray / text-secondary */}
                    <span
                        className="text-[11px] font-medium tracking-wider leading-none [writing-mode:vertical-rl] text-[var(--hh-text-secondary)] group-hover:text-[var(--hh-text-primary)] transition-colors select-none py-1"
                        aria-label={label}
                    >
                        {label}
                    </span>

                    {/* Theme-colored Arrow indicator */}
                    <svg
                        className={`w-3 h-3 text-[var(--hh-accent)] group-hover:translate-x-0.5 transition-transform duration-[var(--hh-dur-fast)] ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
