"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SettingsPanel from "./SettingsPanel";
import CommandPalette from "./CommandPalette";
import { getPrimaryShortcutLabel } from "@/lib/shortcuts";
import { MOE_LOGO_URL } from "@/lib/assets";
import Breadcrumb from "./Breadcrumb";
import { useI18n } from "@/contexts/I18nContext";

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
    const isHome = pathname === "/";
    const { t } = useI18n();

    const sidebarShortcut = getPrimaryShortcutLabel("toggle-sidebar");
    const searchShortcut = getPrimaryShortcutLabel("toggle-search");
    const settingsShortcut = getPrimaryShortcutLabel("toggle-settings");
    const helpShortcut = getPrimaryShortcutLabel("toggle-shortcuts-help");

    return (
        <nav className="fixed top-0 w-full z-[100] border-b border-slate-200/50 dark:border-slate-800/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.25)]">
            <div className="absolute inset-0 bg-white/45 dark:bg-slate-900/40 backdrop-blur-2xl -z-10" />
            {/* Row 1: Logo + buttons */}
            <div className="container mx-auto px-4 sm:px-6 h-[3.5rem] sm:h-[4.5rem] flex items-center justify-between">
                {/* Left: Menu Toggle + Logo + Breadcrumb (desktop) */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {/* Menu Toggle Button */}
                    <button
                        onClick={onMenuToggle}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-miku dark:hover:text-miku ios-glass-btn rounded-xl shrink-0"
                        title={`${t("layout.nav.menu")} (${sidebarShortcut})`}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                            {sidebarShortcut}
                        </kbd>
                    </button>

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity shrink-0">
                        <div
                            className="h-8 w-[5rem] sm:h-10 sm:w-[6.1rem] bg-miku transition-colors"
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
                <div className="flex items-center gap-1 shrink-0">
                    {/* Search Button */}
                    <button
                        onClick={onSearchToggle}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-slate-400 hover:text-miku dark:hover:text-miku ios-glass-btn rounded-xl"
                        title={`${t("layout.nav.search")} (${searchShortcut})`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                            {searchShortcut}
                        </kbd>
                    </button>

                    {/* Keyboard Shortcuts Help Button */}
                    <button
                        onClick={onShortcutsHelpToggle}
                        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-slate-400 hover:text-miku dark:hover:text-miku ios-glass-btn rounded-xl"
                        title={`${t("layout.nav.shortcutsHelp")} (${helpShortcut})`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="2" y="6" width="20" height="12" rx="2" />
                            <path d="M6 14h0M10 14h4M18 14h0M8 10h0M12 10h0M16 10h0" strokeLinecap="round" />
                        </svg>
                        <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                            {helpShortcut}
                        </kbd>
                    </button>

                    {/* Settings Button */}
                    <div className="relative">
                        <button
                            id="settings-button"
                            onClick={onSettingsToggle}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-400 hover:text-miku dark:hover:text-miku ios-glass-btn rounded-xl"
                            title={`${t("layout.nav.settings")} (${settingsShortcut})`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                                {settingsShortcut}
                            </kbd>
                        </button>
                        <SettingsPanel isOpen={isSettingsOpen} onClose={onSettingsClose} />
                    </div>
                </div>

                {/* Command Palette */}
                <CommandPalette
                    isOpen={isSearchOpen}
                    onClose={onSearchClose}
                    onNavigate={onSearchNavigate}
                />
            </div>

            {/* Row 2: Breadcrumb - mobile only, hidden on home page */}
            {!isHome && (
                <div className="sm:hidden border-t border-slate-200/50 dark:border-slate-800/30">
                    <div className="container mx-auto px-4 h-8 flex items-center gap-1.5 overflow-visible text-xs">
                        <Breadcrumb />
                    </div>
                </div>
            )}
        </nav>
    );
}
