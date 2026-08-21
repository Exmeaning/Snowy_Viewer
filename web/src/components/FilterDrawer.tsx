"use client";
import React, { useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { stripRouteLocale } from "@/lib/localized-path";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { filterDrawerVariants } from "@/lib/motion";
import { FilterDrawerContext } from "@/components/common/BaseFilters";

/**
 * Stable id shared by the trigger's `aria-controls` and the drawer's `id`.
 *
 * A constant rather than `useId()` because the two ends live in different
 * components (`FilterTabHandle` at the left edge, this drawer near the end of
 * the layout) and would otherwise each mint their own value. The pairing is
 * only ever one-to-one — there is a single drawer per document — so a literal
 * is both correct and inspectable in devtools.
 */
export const FILTER_DRAWER_ID = "filter-drawer";

/** Scrim fade. Shorter than the panel, so dismissal never lags behind. */
const SCRIM_TRANSITION = { type: "tween", duration: 0.18, ease: "easeOut" } as const;

interface FilterDrawerProps {
    /** Whether the primary left navigation sidebar is currently open. */
    isSidebarOpen: boolean;
}

/**
 * FilterDrawer — the single home for every page's filter panel.
 *
 * Geometry:
 * - A floating rounded island in the same visual language as `Sidebar`: it
 *   tracks the sidebar's top offset expression exactly, and parks either just
 *   right of the sidebar (`--sidebar-w`, the same offset the content area uses)
 *   or against the viewport's left gutter when the sidebar is collapsed.
 * - `>= 1024px (lg)`: docked. The drawer sits beside the content, which is
 *   pushed over by `--dual-rail-w` (see MainLayout). No scrim, no focus trap —
 *   it is permanent page furniture, not a modal, so the grid stays operable
 *   while filters are visible. Layout stability beats the extra content width.
 * - `< 1024px`: floating. There is not enough room to squeeze both a filter
 *   panel and the grid side-by-side, so the drawer behaves modally: a scrim
 *   dims the page behind it, focus moves to the panel, Escape dismisses, and
 *   page scroll is locked.
 */
export default function FilterDrawer({ isSidebarOpen }: FilterDrawerProps) {
    const { t } = useI18n();
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { filterContent, filterTitle, hasFilters, isOpen, isDocked, close } = useQuickFilterContext();
    const titleId = useId();

    const panelRef = useRef<HTMLDivElement>(null);
    const mountTimeRef = useRef<number>(0);

    // Whether the drawer is behaving modally. Docked drawers are ordinary page
    // furniture and must NOT trap focus or eat Escape.
    const isModal = Boolean(isOpen && hasFilters && !isDocked);
    const shouldShow = Boolean(hasFilters && filterContent && isOpen);

    // Track modal open timestamp to guard against click-through on mobile.
    useEffect(() => {
        if (isModal) {
            mountTimeRef.current = Date.now();
        }
    }, [isModal]);

    // Top edge tracks the header, which grows a breadcrumb row on non-home
    // pages below `sm`. Same expression as Sidebar so the two never disagree.
    const drawerTopClass = isHome ? "top-[5rem]" : "top-[7rem]";

    // Vertical extent.
    //
    // On phones the panel stretches to a bottom gutter that mirrors its own top
    // offset, exactly like the sidebar does at that size — filter lists are long,
    // so the height is worth taking, but the island still must not touch the
    // screen edge on any side.
    //
    // From `md` up the height becomes a *max* rather than a fixed value, so a
    // short filter panel stays compact instead of stretching down the whole
    // screen. Bottom values match Sidebar's `h-[calc(100vh-6rem/8rem)]`, whose
    // trailing gutter is the same as its leading one.
    const drawerVerticalClass = isHome
        ? "h-[calc(100vh-6rem)] sm:h-[calc(100vh-6.5rem)]"
        : "h-[calc(100vh-8rem)] sm:h-[calc(100vh-6.5rem)]";

    // Horizontal placement.
    //
    // From `md` up, an open sidebar means the drawer docks just past the
    // island's visual trailing edge with a gutter between them
    // (`--beside-sidebar`); anchoring to `--sidebar-w` instead would land the
    // drawer *inside* the island, and anchoring to `--sidebar-edge` with no gap
    // would leave the two panels touching.
    //
    // Below `md` the sidebar overlays content rather than sitting beside it, so
    // there is nothing to clear and the drawer spans the width. It still keeps
    // the same `0.75rem` gutter the sidebar uses at that size, so all four of
    // its edges are inset consistently and it reads as the same kind of floating
    // island as every other panel — going truly edge-to-edge would single it out
    // as the one surface that touches the screen.
    const drawerLeftClass = isSidebarOpen
        ? "left-3 right-3 md:right-auto md:left-[var(--beside-sidebar)]"
        : "left-3 right-3 md:right-auto md:left-4";

    // Width follows from the insets on phones; fixed rail width once docked.
    const drawerWidthClass = "md:w-[var(--filter-drawer-w)]";

    // Focus management, floating mode only.
    useEffect(() => {
        if (!isModal) return;

        // Skip autofocus on touch devices to avoid virtual keyboard / viewport jump.
        if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
            return;
        }

        const panel = panelRef.current;

        // One frame late: the panel is mounted by AnimatePresence in the same
        // commit, and focusing a node mid-enter transition makes some browsers
        // scroll the (still off-screen) panel into view.
        const raf = requestAnimationFrame(() => {
            if (!panel) return;
            if (panel.contains(document.activeElement)) return;
            panel.focus({ preventScroll: true });
        });

        return () => {
            cancelAnimationFrame(raf);
            // Only reclaim focus if it is still inside the drawer we are closing.
            const activeInPanel = panel?.contains(document.activeElement) ?? false;
            if (!activeInPanel) return;
            const trigger = document.querySelector<HTMLElement>(
                `[aria-controls="${FILTER_DRAWER_ID}"]`
            );
            trigger?.focus({ preventScroll: true });
        };
    }, [isModal]);

    // Escape closes, floating mode only. Registered in the capture phase so the
    // drawer wins over page-level list shortcuts that also listen for Escape.
    useEffect(() => {
        if (!isModal) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };

        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener("keydown", handleKeyDown, true);
    }, [isModal, close]);

    // Background scroll lock, floating mode only.
    useEffect(() => {
        if (!isModal) return;
        // Skip locking body overflow on touch devices to prevent full-page layout reflow and viewport flicker.
        // The modal scrim and drawer content with `overscroll-contain` already prevent background scrolling natively.
        if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isModal]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const hasRestoredRef = useRef(false);
    // Scroll restoration for the filter drawer per route.
    const cleanPathname = stripRouteLocale(pathname);
    const scrollStorageKey = `filter_drawer_scroll:${cleanPathname}`;

    // Restore scroll position when drawer opens and content is mounted (once per open)
    useEffect(() => {
        if (!isOpen) {
            hasRestoredRef.current = false;
            return;
        }

        if (hasRestoredRef.current || !filterContent) return;

        const saved = sessionStorage.getItem(scrollStorageKey);
        if (saved) {
            const top = parseInt(saved, 10);
            if (!Number.isNaN(top) && top > 0) {
                requestAnimationFrame(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = top;
                    }
                });
            }
        }
        hasRestoredRef.current = true;
    }, [isOpen, scrollStorageKey, filterContent]);

    // Save scroll position on user scrolling
    const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop;
        sessionStorage.setItem(scrollStorageKey, String(top));
    }, [scrollStorageKey]);

    const scrimPointerDownRef = useRef(false);

    const handleScrimPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            scrimPointerDownRef.current = true;
        }
    }, []);

    const handleScrimClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent click-through / ghost clicks from triggers that just opened the modal.
        if (Date.now() - mountTimeRef.current < 400) {
            scrimPointerDownRef.current = false;
            return;
        }
        // Both halves of the gesture must have landed on the scrim itself:
        // a drag that started inside the panel must never dismiss it.
        if (scrimPointerDownRef.current && e.target === e.currentTarget) {
            scrimPointerDownRef.current = false;
            e.preventDefault();
            e.stopPropagation();
            close();
        }
        scrimPointerDownRef.current = false;
    }, [close]);

    const resolvedTitle = filterTitle || t("common.filter.title");

    return (
        <>
            {/* Scrim — floating mode only, and never on a docked drawer */}
            <AnimatePresence>
                {isModal && (
                    <motion.div
                        key="filter-drawer-scrim"
                        className="fixed inset-0 filter-scrim z-[75] transform-gpu will-change-[opacity] touch-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={SCRIM_TRANSITION}
                        onPointerDown={handleScrimPointerDown}
                        onClick={handleScrimClick}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* AnimatePresence stays permanently mounted while the keyed child
                comes and goes, which is what lets the exit transition run when
                the drawer closes or the page navigates away. */}
            <AnimatePresence>
                {shouldShow && (
                    <motion.aside
                        key="filter-drawer"
                        variants={filterDrawerVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        id={FILTER_DRAWER_ID}
                        role={isModal ? "dialog" : "complementary"}
                        aria-modal={isModal ? true : undefined}
                        aria-labelledby={titleId}
                        className={`fixed ${drawerTopClass} sm:top-[5.5rem] ${drawerVerticalClass} ${drawerLeftClass} ${drawerWidthClass} ${isModal ? "z-[80]" : "z-[58]"} filter-drawer-panel material-thick rounded-3xl overflow-hidden flex flex-col transform-gpu will-change-transform`}
                    >
                        <div
                            ref={panelRef}
                            tabIndex={-1}
                            className="flex flex-col flex-1 min-h-0 outline-none"
                        >
                            {/* Header: title plus collapse button */}
                            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-soft)]">
                                <span
                                    id={titleId}
                                    className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]"
                                >
                                    {resolvedTitle}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        close();
                                    }}
                                    className="pressable shrink-0 p-1.5 rounded-full text-[var(--text-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] cursor-pointer"
                                    title={t("common.filter.collapse")}
                                    aria-label={t("common.action.close")}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* The one and only mount point for page filters.
                                `data-filter-drawer-body` is the hook BaseFilters
                                uses to detect it is inside the drawer and drop its
                                own redundant collapse chrome. */}
                            <FilterDrawerContext.Provider value={true}>
                                <div
                                    ref={scrollRef}
                                    data-filter-drawer-body="true"
                                    onScroll={handleBodyScroll}
                                    className="flex-grow min-h-0 overflow-y-auto overscroll-contain p-4"
                                >
                                    {filterContent}
                                </div>
                            </FilterDrawerContext.Provider>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
