"use client";
import React from "react";
import { motion, type Variants } from "framer-motion";
import Link from "@/components/LocalizedLink";
import { usePathname } from "next/navigation";
import SettingsPanel from "./SettingsPanel";
import CommandPalette from "./CommandPalette";
import { getPrimaryShortcutLabel } from "@/lib/shortcuts";
import { MOE_LOGO_URL } from "@/lib/assets";
import Breadcrumb from "./Breadcrumb";
import { useI18n } from "@/contexts/I18nContext";
import { stripRouteLocale } from "@/lib/localized-path";
import {
    hhHoverLift,
    hhSpringPanel,
    hhSpringPress,
    hhTapPress,
} from "@/lib/motion";

/**
 * The console status bar drops in from the top edge.
 *
 * Deliberately damped (hhSpringPanel, bounce 0) rather than sprung: this is the
 * same treatment hhRailVariants gives the side rail, only along the other axis.
 * Structural chrome that bounces reads as a notification popping up, not as a
 * piece of hardware powering on.
 *
 * Nothing here animates on exit — the bar is mounted for the whole session.
 *
 * This is the only variant set the bar has. Reduced motion is handled by the
 * global `MotionConfig reducedMotion="user"` in MotionProvider, which snaps `y`
 * after mount instead of animating it — picking a movement-free variant set
 * during render would fork SSR and client markup and break hydration.
 */
const STATUS_BAR_VARIANTS: Variants = {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0, transition: hhSpringPanel },
};

/**
 * Flat console chrome: one hairline border, no radius, no shadow.
 *
 * There is no backdrop-filter anywhere in this bar. The whole point of the
 * Handheld surface system is that hierarchy comes from value steps between
 * opaque surfaces (--hh-surface-1 chrome over --hh-surface-0 ground), so a blur
 * would both contradict the look and reintroduce the per-frame compositor cost
 * the redesign exists to remove.
 */
const ICON_BUTTON_CLASS =
    "hh-press hh-focusable flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--hh-radius-md)] " +
    "border border-[var(--hh-border)] bg-[var(--hh-surface-2)] " +
    "text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent-deep)] " +
    "hover:border-[var(--hh-border-strong)] hover:bg-[var(--hh-surface-3)]";

/** Shortcut hint chip. Sunken well + tertiary text, so it never outranks the icon. */
const KBD_CLASS =
    "items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-[var(--hh-radius-xs)] " +
    "border border-[var(--hh-border)] bg-[var(--hh-surface-sunken)] text-[var(--hh-text-tertiary)]";

interface MainNavbarProps {
    onMenuToggle: () => void;
    isSearchOpen: boolean;
    onSearchToggle: () => void;
    onSearchClose: () => void;
    onSearchNavigate: (href: string) => void;
    isSettingsOpen: boolean;
    onSettingsToggle: () => void;
    onSettingsClose: () => void;
    onShortcutsHelpToggle: () => void;
}

export default function MainNavbar({
    onMenuToggle,
    isSearchOpen,
    onSearchToggle,
    onSearchClose,
    onSearchNavigate,
    isSettingsOpen,
    onSettingsToggle,
    onSettingsClose,
    onShortcutsHelpToggle,
}: MainNavbarProps) {
    const pathname = usePathname();
    const isHome = stripRouteLocale(pathname) === "/";
    const { t } = useI18n();

    const sidebarShortcut = getPrimaryShortcutLabel("toggle-sidebar");
    const searchShortcut = getPrimaryShortcutLabel("toggle-search");
    const settingsShortcut = getPrimaryShortcutLabel("toggle-settings");
    const helpShortcut = getPrimaryShortcutLabel("toggle-shortcuts-help");

    // Reduced motion keeps every hover/press *state* (the CSS tint on .hh-press
    // still fires); only the transform is withheld, and that is done by
    // MotionProvider's reducedMotion="user" rather than by swapping the gesture
    // out here.
    const hoverGesture = hhHoverLift;
    const tapGesture = hhTapPress;

    return (
        <nav className="fixed inset-x-0 top-0 z-[100] pointer-events-none">
            {/* Console status bar — flat, opaque, edge-to-edge */}
            <motion.div
                variants={STATUS_BAR_VARIANTS}
                initial="initial"
                animate="animate"
                className="pointer-events-auto px-3 sm:px-5 bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)]"
            >
                {/* Row 1: Logo + buttons — height synced via --hh-topbar-h */}
                <div className="h-[var(--hh-topbar-h)] flex items-center justify-between gap-2">
                    {/* Left: Menu Toggle + Logo + Breadcrumb (desktop) */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {/* Menu Toggle Button */}
                        <motion.button
                            onClick={onMenuToggle}
                            whileHover={hoverGesture}
                            whileTap={tapGesture}
                            className={`${ICON_BUTTON_CLASS} shrink-0`}
                            title={`${t("layout.nav.menu")} (${sidebarShortcut})`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <kbd className={`hidden sm:inline-flex ${KBD_CLASS}`}>
                                {sidebarShortcut}
                            </kbd>
                        </motion.button>

                        {/* Logo */}
                        <Link href="/" className="hh-press hh-focusable flex items-center gap-1.5 shrink-0 rounded-[var(--hh-radius-sm)]" title="Moesekai">
                            <motion.span
                                whileHover={{ scale: 1.04, transition: hhSpringPress }}
                                whileTap={tapGesture}
                                className="block h-7 w-[4.5rem] sm:h-8 sm:w-[5.5rem] bg-[var(--hh-accent)]"
                                style={{
                                    maskImage: `url(${MOE_LOGO_URL})`,
                                    maskSize: "contain",
                                    maskPosition: "center",
                                    maskRepeat: "no-repeat",
                                    WebkitMaskImage: `url(${MOE_LOGO_URL})`,
                                    WebkitMaskSize: "contain",
                                    WebkitMaskPosition: "center",
                                    WebkitMaskRepeat: "no-repeat",
                                }}
                            />
                        </Link>

                        {/* Breadcrumb - desktop inline */}
                        <div className="hidden sm:flex items-center gap-1.5 min-w-0 overflow-visible">
                            <Breadcrumb />
                        </div>
                    </div>

                    {/* Right: Search + Shortcuts Help + Settings */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Search Button */}
                        <motion.button
                            onClick={onSearchToggle}
                            whileHover={hoverGesture}
                            whileTap={tapGesture}
                            className={ICON_BUTTON_CLASS}
                            title={`${t("layout.nav.search")} (${searchShortcut})`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <kbd className={`hidden sm:inline-flex ${KBD_CLASS}`}>
                                {searchShortcut}
                            </kbd>
                        </motion.button>

                        {/* Keyboard Shortcuts Help Button */}
                        <motion.button
                            onClick={onShortcutsHelpToggle}
                            whileHover={hoverGesture}
                            whileTap={tapGesture}
                            className={`${ICON_BUTTON_CLASS} hidden sm:flex`}
                            title={`${t("layout.nav.shortcutsHelp")} (${helpShortcut})`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <rect x="2" y="6" width="20" height="12" rx="2" />
                                <path d="M6 14h0M10 14h4M18 14h0M8 10h0M12 10h0M16 10h0" strokeLinecap="round" />
                            </svg>
                            <kbd className={`hidden lg:inline-flex ${KBD_CLASS}`}>
                                {helpShortcut}
                            </kbd>
                        </motion.button>

                        {/* Settings Button */}
                        <div className="relative">
                            <motion.button
                                id="settings-button"
                                onClick={onSettingsToggle}
                                whileHover={hoverGesture}
                                whileTap={tapGesture}
                                className={ICON_BUTTON_CLASS}
                                title={`${t("layout.nav.settings")} (${settingsShortcut})`}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <kbd className={`hidden lg:inline-flex ${KBD_CLASS}`}>
                                    {settingsShortcut}
                                </kbd>
                            </motion.button>
                            <SettingsPanel isOpen={isSettingsOpen} onClose={onSettingsClose} />
                        </div>
                    </div>
                </div>

                {/* Row 2: Breadcrumb - mobile only, hidden on home page */}
                {!isHome && (
                    <div className="sm:hidden border-t border-[var(--hh-border)]">
                        <div className="h-8 flex items-center gap-1.5 overflow-visible text-xs py-1">
                            <Breadcrumb />
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Command Palette — portalled to <body>, so it is intentionally a
                sibling of the animated bar and never inherits its transform. */}
            <CommandPalette
                isOpen={isSearchOpen}
                onClose={onSearchClose}
                onNavigate={onSearchNavigate}
            />
        </nav>
    );
}
