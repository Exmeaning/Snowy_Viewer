"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { stripRouteLocale } from "@/lib/localized-path";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { useIsXlScreen } from "@/hooks/useMediaQuery";
import { hhRailVariants } from "@/lib/motion";

interface FilterRailProps {
    /**
     * Whether the parent layout allows the rail to be shown
     * (e.g. reflects sidebar open/closed state on desktop).
     */
    isOpen?: boolean;
}

/**
 * FilterRail — The secondary desktop rail for page filters.
 *
 * Architecture & Responsive Strategy:
 * - Rendered side-by-side with Sidebar exclusively at `>= 1280px (xl)`.
 *   Below 1280px, screen real estate is insufficient for dual 18rem rails (36rem total),
 *   so the filter switches to an in-sidebar segmented view (`Sidebar.tsx`), and on mobile
 *   to a floating action drawer (`QuickFilterButton.tsx`).
 * - Mount synchronization: `useIsXlScreen()` uses `useSyncExternalStore` with an SSR fallback
 *   of `false`. This guarantees strict hydration consistency while ensuring `filterContent`
 *   is mounted in exactly ONE DOM location across the entire app at any given moment.
 * - AnimatePresence lifecycle: AnimatePresence must stay permanently mounted while its
 *   child `motion.aside` (keyed with `filter-rail`) mounts and unmounts conditionally.
 *   This ensures exit transitions run smoothly when closing or switching pages.
 * - Sits at `left-[var(--hh-rail-w)]` with a fixed width of `var(--hh-filter-rail-w)` (18rem).
 *   Top alignment follows `--hh-topbar-h` / `--hh-topbar-sub-h` to mirror the status bar geometry.
 * - Damped slide-in animation via `hhRailVariants` (bounce: 0) adhering to the rule that
 *   structural UI stays calm while cursor overshoots.
 */
export default function FilterRail({ isOpen = true }: FilterRailProps) {
    const { t } = useI18n();
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { filterContent, filterTitle, hasFilters, isOpen: isModalOpen } = useQuickFilterContext();
    const isXl = useIsXlScreen();

    const railTopClass = isHome
        ? "top-[var(--hh-topbar-h)]"
        : "top-[calc(var(--hh-topbar-h)+var(--hh-topbar-sub-h))]";

    // Single-mount guarantee: The FilterRail is rendered exclusively at >= 1280px (xl)
    // when page filter content is present AND the quick-filter modal drawer is NOT active.
    // When the modal opens or screen drops below xl, FilterRail relinquishes mounting
    // to prevent duplicate DOM nodes, conflicting shortcut targets, and input focus bugs.
    const shouldShow = Boolean(isOpen && hasFilters && filterContent && isXl && !isModalOpen);

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.aside
                    key="filter-rail"
                    variants={hhRailVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    aria-label={filterTitle || t("common.filter.title")}
                    className={`fixed left-[var(--hh-rail-w)] bottom-0 ${railTopClass} z-[50] w-[var(--hh-filter-rail-w)] flex flex-col overflow-hidden bg-[var(--hh-surface-1)] border-r border-[var(--hh-border)]`}
                >
                    {/* Secondary rail title header */}
                    <div className="h-10 shrink-0 flex items-center px-4 border-b border-[var(--hh-border)]">
                        <span className="hh-label truncate">
                            {filterTitle || t("common.filter.title")}
                        </span>
                    </div>

                    {/* Filter content container */}
                    <div className="flex-grow overflow-y-auto px-3 py-3">
                        {filterContent}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
