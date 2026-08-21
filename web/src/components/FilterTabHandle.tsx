"use client";
import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { stripRouteLocale } from "@/lib/localized-path";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { FILTER_DRAWER_ID } from "@/components/FilterDrawer";

interface FilterTabHandleProps {
    /** Whether the primary left navigation sidebar is currently open. */
    isSidebarOpen: boolean;
}

/**
 * FilterTabHandle — vertical pull tab riding the left sidebar / drawer boundary.
 *
 * Appearance:
 * - A rounded capsule in the same floating-island material as the sidebar and
 *   the drawer (`island-panel material-thick`), with only its right half's
 *   corners rounded so it reads as protruding from the panel beside it.
 * - Accent-colored funnel and chevron glyphs, neutral vertical text label.
 *
 * Positioning:
 * - Sits below the sidebar's top offset so it never collides with the header or
 *   the breadcrumb row that non-home pages grow below `sm`.
 * - Closed: hugs the sidebar's right edge, or the viewport's left gutter when
 *   the sidebar is collapsed.
 * - Docked drawer open (`>= 1024px`): moves out past the drawer's outer edge.
 * - Floating drawer open (`< 1024px`): hidden, because the drawer covers this
 *   area and its own close button is the correct affordance there.
 *
 * This is the only filter entry point on phones, so the hit area is padded out
 * to comfortably clear the 44pt minimum touch target.
 */
export default function FilterTabHandle({ isSidebarOpen }: FilterTabHandleProps) {
    const { t } = useI18n();
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { hasFilters, isOpen, isDocked, toggle, filterTitle } = useQuickFilterContext();

    const isVisible = Boolean(hasFilters && (!isOpen || isDocked));

    const label = filterTitle || t("common.filter.title");
    const shortcutLabel = t("common.filter.openQuickFilter");

    // Closed / floating position.
    //
    // The tab is meant to read as protruding *from* whatever panel is at the left
    // edge, so it butts directly against that panel's trailing edge with no gap —
    // `--sidebar-edge`, not `--beside-sidebar`. (The drawer itself does use the
    // gapped variant, because two full panels touching looks like one clipped
    // panel; a small tab touching its panel looks attached, which is the point.)
    //
    // Below `md` the sidebar overlays content rather than displacing it, so the
    // handle hides there instead of floating on top of it.
    const baseLeftClass = isSidebarOpen
        ? "hidden md:flex left-0 md:left-[var(--sidebar-edge)]"
        : "flex left-0";

    // Docked and open: ride the drawer's outer edge instead, again flush.
    const dockedOpenLeftClass = isSidebarOpen
        ? "flex left-0 lg:left-[calc(var(--beside-sidebar)+var(--filter-drawer-w))]"
        : "flex left-0 lg:left-[calc(var(--filter-drawer-w)+1rem)]";

    const leftPositionClass = isOpen && isDocked ? dockedOpenLeftClass : baseLeftClass;

    // Vertical placement mirrors the drawer's own top edge (plus a small drop so
    // the tab reads as attached to the panel's upper body rather than to its
    // header). Derived from the same `isHome` breakpoint expression the sidebar
    // and drawer use, so all three move together when the breadcrumb row
    // appears on narrow non-home pages.
    const verticalPositionClass = isHome
        ? "top-[7rem] sm:top-[7.5rem]"
        : "top-[9rem] sm:top-[7.5rem]";

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
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
                    aria-controls={FILTER_DRAWER_ID}
                    aria-expanded={isOpen}
                    title={shortcutLabel}
                    className={`fixed ${verticalPositionClass} ${leftPositionClass} z-[70] pressable touch-manipulation flex-col items-center justify-center gap-1.5 py-4 px-2.5 min-h-[44px] material-thick rounded-r-2xl border-l-0 cursor-pointer select-none group`}
                >
                    {/* Accent funnel glyph */}
                    <svg
                        className={`w-3.5 h-3.5 text-miku group-hover:scale-110 transition-transform duration-[var(--duration-fast)] ${isOpen ? "rotate-90" : ""}`}
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

                    {/* Vertical text label. `whitespace-nowrap` is load-bearing: in
                        vertical writing mode the label wraps into a *second column*
                        rather than a second line, which reads as a rendering fault
                        and doubles the tab's width. */}
                    <span
                        className="text-[11px] font-medium tracking-wider leading-none whitespace-nowrap [writing-mode:vertical-rl] text-[var(--text-muted)] group-hover:text-[var(--text-strong)] transition-colors select-none py-1"
                        aria-label={label}
                    >
                        {label}
                    </span>

                    {/* Accent chevron, flipped to point back toward the panel when open */}
                    <svg
                        className={`w-3 h-3 text-miku group-hover:translate-x-0.5 transition-transform duration-[var(--duration-fast)] ${isOpen ? "rotate-180" : ""}`}
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
