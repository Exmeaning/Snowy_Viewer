"use client";
import React, { useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { stripRouteLocale } from "@/lib/localized-path";
import { useQuickFilterContext } from "@/contexts/QuickFilterContext";
import { useI18n } from "@/contexts/I18nContext";
import { hhRailVariants, hhSpringPanel, HH_DURATION } from "@/lib/motion";

/**
 * Stable id shared by the trigger's `aria-controls` and the drawer's `id`.
 *
 * A constant rather than `useId()` because the two ends live in different
 * components (`FilterButton` in the status bar, this drawer near the end of the
 * layout) and would otherwise each mint their own value. The pairing is only
 * ever one-to-one — there is a single drawer per document — so a literal is
 * both correct and inspectable in devtools.
 */
export const FILTER_DRAWER_ID = "hh-filter-drawer";

/** Scrim fade. Damped and shorter than the panel, so dismissal never lags. */
const SCRIM_TRANSITION = { ...hhSpringPanel, duration: HH_DURATION.fast } as const;

/**
 * FilterDrawer — the single home for every page's filter panel.
 *
 * This replaces three mutually exclusive presentations (desktop sub-rail,
 * in-sidebar segmented tab, mobile bottom sheet) with one drawer that changes
 * only its *anchoring*, never its content or its interaction model. The old
 * split meant a user who resized a window met a different filter UI three
 * times, and each variant needed its own single-mount guard.
 *
 * Geometry:
 * - Slides in from the left, flush against the navigation rail's right edge
 *   (`left: --hh-rail-w` when the rail is open, `0` when it is collapsed).
 *   Left rather than right because the rail already trained the user that
 *   system furniture lives on that edge; a right-hand drawer would read as a
 *   detail inspector.
 * - `>= 1280px (xl)`: docked. The drawer sits *beside* the content, which is
 *   pushed over by `--hh-dual-rail-w` (see MainLayout). No scrim, no focus
 *   trap — it is a permanent panel, not a modal, so the grid stays operable
 *   while filters are visible. Layout stability beats the extra content width.
 * - `< 1280px`: floating. There is not enough room to squeeze both a filter
 *   panel and a readable grid, so the drawer overlays the content with a scrim
 *   and behaves modally (focus moves in, Escape closes, background scroll
 *   locks). Phones and tablets get the exact same treatment — one style, as
 *   requested — with the drawer simply spanning the full width below `sm`.
 *
 * Single-mount guarantee: this component is the ONLY consumer that renders
 * `filterContent`. There is no CSS-hidden second copy anywhere, so
 * `data-shortcut-filters` and `data-shortcut-search` resolve to exactly one
 * element and `usePageListShortcuts` can never target an invisible panel.
 *
 * Motion is `hhRailVariants` (bounce 0): the drawer is structural furniture and
 * arrives without wobble.
 */
export default function FilterDrawer({ isRailOpen }: { isRailOpen: boolean }) {
    const { t } = useI18n();
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { filterContent, filterTitle, hasFilters, isOpen, isDocked, close } = useQuickFilterContext();
    const titleId = useId();

    const panelRef = useRef<HTMLDivElement>(null);

    // Whether the drawer is behaving modally. Docked drawers are ordinary page
    // furniture and must NOT trap focus or eat Escape.
    const isModal = isOpen && hasFilters && !isDocked;

    const shouldShow = Boolean(hasFilters && filterContent && isOpen);

    // Top edge tracks the status bar, which grows a breadcrumb row on non-home
    // pages below `sm`. Same expression as Sidebar so the two never disagree.
    const drawerTopClass = isHome
        ? "top-[var(--hh-topbar-h)]"
        : "top-[calc(var(--hh-topbar-h)+var(--hh-topbar-sub-h))]";

    // The drawer is anchored to the rail's trailing edge, so it has to follow
    // the rail in and out rather than assuming it is always there.
    const drawerLeftClass = isRailOpen ? "md:left-[var(--hh-rail-w)]" : "md:left-0";

    // Focus management, floating mode only.
    //
    // Moving focus into the panel is what makes the drawer reachable for
    // keyboard and screen-reader users the moment it opens; returning it to the
    // trigger on close is what stops focus falling back to <body> and losing
    // the user's place in the page. The trigger is looked up by
    // `aria-controls` so this component does not need a ref threaded through
    // the whole layout.
    useEffect(() => {
        if (!isModal) return;

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
            // Only reclaim focus if it is still inside the drawer we are
            // closing. If the user has since clicked elsewhere, yanking focus
            // back to the trigger would be a hijack.
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

    // Background scroll lock, floating mode only. A drawer that overlays the
    // grid must not let a stray wheel gesture scroll the list behind it; a
    // docked drawer deliberately leaves the page scrollable.
    useEffect(() => {
        if (!isModal) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isModal]);

    const handleScrimClick = useCallback(() => {
        close();
    }, [close]);

    const resolvedTitle = filterTitle || t("common.filter.title");

    return (
        <>
            {/* Scrim — floating mode only, and never on a docked drawer, which
                would otherwise dim a page the user is still meant to read.
                Flat dim, no backdrop blur, matching every other overlay. */}
            <AnimatePresence>
                {isModal && (
                    <motion.div
                        key="filter-drawer-scrim"
                        className={`fixed inset-x-0 bottom-0 ${drawerTopClass} hh-scrim z-[58]`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={SCRIM_TRANSITION}
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
                        variants={hhRailVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        id={FILTER_DRAWER_ID}
                        /* Docked: a labelled complementary region, discoverable
                           via landmark navigation. Floating: a real dialog, so
                           assistive tech announces the modal boundary that the
                           scrim and focus trap imply visually. */
                        role={isModal ? "dialog" : "complementary"}
                        aria-modal={isModal ? true : undefined}
                        aria-labelledby={titleId}
                        className={`fixed left-0 bottom-0 ${drawerTopClass} ${drawerLeftClass} z-[59] w-full sm:w-[var(--hh-filter-rail-w)] flex flex-col overflow-hidden bg-[var(--hh-surface-1)] border-r border-[var(--hh-border)]`}
                    >
                        <div
                            ref={panelRef}
                            tabIndex={-1}
                            className="flex flex-col h-full min-h-0 outline-none"
                        >
                            {/* Header: title plus collapse button */}
                            <div className="h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-[var(--hh-border)]">
                                <span id={titleId} className="hh-label truncate px-1">
                                    {resolvedTitle}
                                </span>
                                <button
                                    type="button"
                                    onClick={close}
                                    className="hh-press hh-focusable shrink-0 p-1 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)] cursor-pointer"
                                    title={t("common.filter.collapse")}
                                    aria-label={t("common.action.close")}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* The one and only mount point for page filters. */}
                            <div className="flex-grow min-h-0 overflow-y-auto px-3 py-3">
                                {filterContent}
                            </div>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
