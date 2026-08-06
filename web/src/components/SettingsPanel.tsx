"use client";
import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTheme, CHAR_COLORS } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { getMotionTransition } from "@/lib/motion";
import { UNIT_DATA, UNIT_ID_LABEL_KEYS } from "@/types/types";
import { useMasterData } from "@/contexts/MasterDataContext";
import { ADS_SETTINGS_VISIBLE } from "@/lib/ads";
import { MOE_LOGO_URL } from "@/lib/assets";
import {
    getShortcutById,
    isEditableEventTarget,
    isKeyboardEventComposing,
    matchesShortcutCombo,
    parseShortcutCombos,
} from "@/lib/shortcuts";
import { getCharacterName, SUPPORTED_UI_LOCALES, UI_LOCALE_LABELS } from "@/lib/i18n";
import AnalyticsConsentControl from "@/components/AnalyticsConsentControl";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = "visual" | "content" | "data" | "about";

// Group characters by unit for better organization (derived from UNIT_DATA)
const unitGroups = UNIT_DATA.map(u => ({ id: u.id, labelKey: UNIT_ID_LABEL_KEYS[u.id] ?? `common.units.${u.id}`, charIds: u.charIds, color: u.color }));

const SETTINGS_TOGGLE_COMBO = parseShortcutCombos(
    getShortcutById("toggle-settings")?.combos ?? []
)[0] ?? [];
const CLOSE_OVERLAY_COMBOS = parseShortcutCombos(
    getShortcutById("close-overlay")?.combos ?? []
);

const appearanceOptions = [
    { id: "system", labelKey: "settings.appearance.system" },
    { id: "light", labelKey: "settings.appearance.light" },
    { id: "dark", labelKey: "settings.appearance.dark" },
] as const;

const assetLineOptions = [
    {
        key: "main",
        labelKey: "settings.assetSource.main",
        value: "main",
    },
    {
        key: "overseas",
        labelKey: "settings.assetSource.overseas",
        value: "overseas",
    },
] as const;

const tabs: { id: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
    {
        id: "visual",
        labelKey: "settings.sections.visual",
        icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        ),
    },
    {
        id: "content",
        labelKey: "settings.sections.content",
        icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        ),
    },
    {
        id: "data",
        labelKey: "settings.sections.data",
        icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
        ),
    },
    {
        id: "about",
        labelKey: "settings.sections.about",
        icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

interface FloatingDropdownProps {
    isOpen: boolean;
    triggerRect: DOMRect | null;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: number;
}

function FloatingDropdown({ isOpen, triggerRect, onClose, children, maxHeight = 260 }: FloatingDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prefersReducedMotion = useReducedMotion();
    const transition = getMotionTransition("snappy", { reducedMotion: !!prefersReducedMotion });

    useEffect(() => {
        if (!isOpen) return;

        const handleScroll = (e: Event) => {
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
                return;
            }
            onClose();
        };

        const handleResize = () => onClose();

        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleResize);
        };
    }, [isOpen, onClose]);

    const spaceBelow = triggerRect ? window.innerHeight - triggerRect.bottom : 0;
    const openUpwards = triggerRect ? (spaceBelow < maxHeight + 20 && triggerRect.top > maxHeight) : false;

    const style: React.CSSProperties = triggerRect ? {
        position: "fixed",
        left: triggerRect.left,
        width: triggerRect.width,
        zIndex: 300,
        ...(openUpwards
            ? { bottom: window.innerHeight - triggerRect.top + 6 }
            : { top: triggerRect.bottom + 6 }),
    } : {};

    return createPortal(
        <AnimatePresence>
            {isOpen && triggerRect && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[299]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                    />
                    <motion.div
                        ref={dropdownRef}
                        style={style}
                        onClick={(e) => e.stopPropagation()}
                        initial={prefersReducedMotion ? { opacity: 0 } : {
                            opacity: 0,
                            scale: 0.95,
                            y: openUpwards ? 8 : -8,
                        }}
                        animate={prefersReducedMotion ? { opacity: 1 } : {
                            opacity: 1,
                            scale: 1,
                            y: 0,
                        }}
                        exit={prefersReducedMotion ? { opacity: 0 } : {
                            opacity: 0,
                            scale: 0.95,
                            y: openUpwards ? 8 : -8,
                        }}
                        transition={transition}
                        className="liquid-glass-modal rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-700/80 will-change-transform"
                    >
                        <div style={{ maxHeight }} className="overflow-y-auto p-2">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const {
        themeCharId,
        setThemeCharacter,
        colorSchemePreference,
        setColorSchemePreference,
        isShowSpoiler,
        setShowSpoiler,
        useTrainedThumbnail,
        setUseTrainedThumbnail,
        assetSource,
        setAssetSource,
        useLLMTranslation,
        setUseLLMTranslation,
        showAds,
        setShowAds,
        backgroundAnimationBudget,
        setBackgroundAnimationBudget,
        serverSource,
        setServerSource,
    } = useTheme();
    const { locale, setLocale, t } = useI18n();
    const { cloudVersion, localVersion, isLoading, isRefreshing, forceRefreshData } = useMasterData();
    const [activeTab, setActiveTab] = useState<SettingsTab>("visual");
    const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);
    const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
    const languageOptions = SUPPORTED_UI_LOCALES.map((id) => ({ id, label: UI_LOCALE_LABELS[id] }));
    const currentLanguageLabel = UI_LOCALE_LABELS[locale];
    const panelRef = useRef<HTMLDivElement>(null);

    const [mounted, setMounted] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    const overlayTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });
    const panelTransition = getMotionTransition("soft", {
        reducedMotion: !!prefersReducedMotion,
    });

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setMounted(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // Prevent body scroll while preserving any existing overflow override.
    useEffect(() => {
        if (!isOpen) return;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousBodyOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || isKeyboardEventComposing(event)) return;
            if (isEditableEventTarget(event.target)) return;

            const shouldCloseByEscape = CLOSE_OVERLAY_COMBOS.some((combo) =>
                matchesShortcutCombo(event, combo)
            );
            const shouldCloseByToggle = matchesShortcutCombo(event, SETTINGS_TOGGLE_COMBO);

            if (!shouldCloseByEscape && !shouldCloseByToggle) return;

            event.preventDefault();
            onClose();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleToggleDropdown = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (expandedDropdown === id) {
            setExpandedDropdown(null);
            setTriggerRect(null);
        } else {
            setTriggerRect(event.currentTarget.getBoundingClientRect());
            setExpandedDropdown(id);
        }
    };

    const handleNavigateAbout = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
        window.location.href = "/about";
    };

    // Get current asset line label
    const currentAssetLabel = assetLineOptions.find((opt) => opt.value === assetSource)?.labelKey ?? "settings.assetSource.main";

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-3 sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 transform-gpu bg-black/45 backdrop-blur-[8px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={overlayTransition}
                        onClick={onClose}
                    />

                    {/* Dialog - Auto-fits active content height cleanly */}
                    <motion.div
                        id="settings-panel-content"
                        ref={panelRef}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md transform-gpu will-change-transform liquid-glass-modal rounded-3xl overflow-hidden flex flex-col shadow-2xl my-auto z-10"
                        initial={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.96, y: 12 }
                        }
                        animate={
                            prefersReducedMotion
                                ? { opacity: 1 }
                                : { opacity: 1, scale: 1, y: 0 }
                        }
                        exit={
                            prefersReducedMotion
                                ? { opacity: 0 }
                                : { opacity: 0, scale: 0.96, y: 12 }
                        }
                        transition={panelTransition}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/50 dark:border-slate-800/60 bg-gradient-to-r from-miku/10 to-transparent shrink-0">
                            <h3 className="type-title font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                                <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t("settings.title")}
                            </h3>
                            <button
                                onClick={onClose}
                                className="pressable p-1.5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg"
                                aria-label={t("common.action.close")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Navigation Tabs Bar */}
                        <div className="flex bg-slate-200/40 dark:bg-slate-900/60 p-1 mx-5 mt-4 rounded-2xl gap-1 shrink-0 border border-slate-200/50 dark:border-slate-800/60 relative">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setExpandedDropdown(null);
                                            setTriggerRect(null);
                                        }}
                                        className={`relative flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5 select-none ${
                                            isActive
                                                ? "text-miku dark:text-miku"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeSettingsTabPill"
                                                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/40 dark:border-slate-700/60"
                                                transition={overlayTransition}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center justify-center gap-1.5">
                                            {tab.icon}
                                            <span>{t(tab.labelKey)}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tab Content Body - Auto content height without giant empty bottom gap */}
                        <div className="p-5 overflow-y-auto max-h-[60vh] min-h-[220px]">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeTab}
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(4px)" }}
                                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
                                    transition={overlayTransition}
                                    className="space-y-4"
                                >
                                    {/* TAB 1: VISUAL */}
                                    {activeTab === "visual" && (
                                        <div className="space-y-4">
                                            {/* Appearance Mode Segmented Control */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.appearance.sectionTitle")}
                                                </div>
                                                <div className="flex bg-slate-100 dark:bg-slate-900/60 rounded-xl p-1 border border-slate-200/50 dark:border-slate-800/60 relative">
                                                    {appearanceOptions.map((option) => {
                                                        const isSelected = colorSchemePreference === option.id;
                                                        return (
                                                            <button
                                                                key={option.id}
                                                                onClick={() => setColorSchemePreference(option.id)}
                                                                className={`relative flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors duration-150 select-none ${
                                                                    isSelected
                                                                        ? "text-white"
                                                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                                                }`}
                                                            >
                                                                {isSelected && (
                                                                    <motion.div
                                                                        layoutId="activeAppearancePill"
                                                                        className="absolute inset-0 bg-miku rounded-lg shadow-sm"
                                                                        transition={overlayTransition}
                                                                    />
                                                                )}
                                                                <span className="relative z-10">{t(option.labelKey)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Background Animation Segmented Control */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.backgroundAnimationBudget.sectionTitle")}
                                                </div>
                                                <div className="flex bg-slate-100 dark:bg-slate-900/60 rounded-xl p-1 border border-slate-200/50 dark:border-slate-800/60 relative">
                                                    {[
                                                        { id: "on", labelKey: "settings.backgroundAnimationBudget.on" },
                                                        { id: "off", labelKey: "settings.backgroundAnimationBudget.off" },
                                                    ].map((option) => {
                                                        const isSelected = backgroundAnimationBudget === option.id;
                                                        return (
                                                            <button
                                                                key={option.id}
                                                                onClick={() => setBackgroundAnimationBudget(option.id as "on" | "off")}
                                                                className={`relative flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors duration-150 select-none ${
                                                                    isSelected
                                                                        ? "text-white"
                                                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                                                }`}
                                                            >
                                                                {isSelected && (
                                                                    <motion.div
                                                                        layoutId="activeBgAnimPill"
                                                                        className="absolute inset-0 bg-miku rounded-lg shadow-sm"
                                                                        transition={overlayTransition}
                                                                    />
                                                                )}
                                                                <span className="relative z-10">{t(option.labelKey)}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Theme Color Dropdown */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.themeColor.sectionTitle")}
                                                </div>
                                                <button
                                                    onClick={(e) => handleToggleDropdown("theme", e)}
                                                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-4 h-4 rounded-full"
                                                            style={{ backgroundColor: CHAR_COLORS[themeCharId] || "#33CCBB" }}
                                                        />
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                            {getCharacterName(t, Number(themeCharId), "short")}
                                                        </span>
                                                    </div>
                                                    <svg
                                                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedDropdown === "theme" ? "rotate-180" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Interface Language Dropdown */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.uiLanguage.sectionTitle")}
                                                </div>
                                                <button
                                                    onClick={(e) => handleToggleDropdown("language", e)}
                                                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                                                    aria-haspopup="listbox"
                                                    aria-expanded={expandedDropdown === "language"}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-4 h-4 rounded-full bg-miku/20 flex items-center justify-center">
                                                            <span className="w-2 h-2 rounded-full bg-miku" />
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentLanguageLabel}</span>
                                                    </div>
                                                    <svg
                                                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedDropdown === "language" ? "rotate-180" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                {locale !== "zh-CN" && (
                                                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 dark:border-amber-900/30 px-2 py-1.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-500">
                                                        <span className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/50 text-[8px] font-black text-amber-700 dark:text-amber-500">!</span>
                                                        <span>{t("settings.uiLanguage.machineTranslationNotice")}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: CONTENT */}
                                    {activeTab === "content" && (
                                        <div className="space-y-4">
                                            {/* Spoiler Toggle */}
                                            <div className="flex items-center justify-between py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.showSpoiler.label")}</span>
                                                </div>
                                                <button
                                                    onClick={() => setShowSpoiler(!isShowSpoiler)}
                                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isShowSpoiler ? 'bg-miku' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <motion.span
                                                        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow"
                                                        animate={{ x: isShowSpoiler ? 20 : 0 }}
                                                        transition={overlayTransition}
                                                    />
                                                </button>
                                            </div>

                                            {/* Trained Thumbnail Toggle */}
                                            <div className="flex items-center justify-between py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.trainedThumbnail.label")}</span>
                                                    <kbd className="hidden sm:inline-block min-w-[1.5rem] px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 rounded border border-slate-200/50 dark:border-slate-700/40 text-center shadow-sm">]</kbd>
                                                </div>
                                                <button
                                                    onClick={() => setUseTrainedThumbnail(!useTrainedThumbnail)}
                                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useTrainedThumbnail ? 'bg-miku' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <motion.span
                                                        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow"
                                                        animate={{ x: useTrainedThumbnail ? 20 : 0 }}
                                                        transition={overlayTransition}
                                                    />
                                                </button>
                                            </div>

                                            {/* LLM Translation Toggle */}
                                            <div className="flex items-center justify-between py-2 border-b border-slate-200/40 dark:border-slate-800/40">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                                    </svg>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.translation.label")}</span>
                                                </div>
                                                <button
                                                    onClick={() => setUseLLMTranslation(!useLLMTranslation)}
                                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useLLMTranslation ? 'bg-miku' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                >
                                                    <motion.span
                                                        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow"
                                                        animate={{ x: useLLMTranslation ? 20 : 0 }}
                                                        transition={overlayTransition}
                                                    />
                                                </button>
                                            </div>

                                            {ADS_SETTINGS_VISIBLE && (
                                                <div className="flex items-center justify-between py-2">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                                        </svg>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("settings.ads.label")}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowAds(!showAds)}
                                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showAds ? 'bg-miku' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                    >
                                                        <motion.span
                                                            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow"
                                                            animate={{ x: showAds ? 20 : 0 }}
                                                            transition={overlayTransition}
                                                        />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Privacy and analytics consent */}
                                            <div className="border-t border-slate-200/40 pt-4 dark:border-slate-800/40">
                                                <div className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.analytics.sectionTitle")}
                                                </div>
                                                <AnalyticsConsentControl />
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 3: DATA */}
                                    {activeTab === "data" && (
                                        <div className="space-y-4">
                                            {/* Server Source / Region Select */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.serverSource.sectionTitle")}
                                                </div>
                                                <button
                                                    onClick={(e) => handleToggleDropdown("serverSource", e)}
                                                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-4 h-4 rounded-full bg-miku/20 flex items-center justify-center">
                                                            <span className="w-2 h-2 rounded-full bg-miku" />
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t(`settings.serverSource.${serverSource}`)}</span>
                                                    </div>
                                                    <svg
                                                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedDropdown === "serverSource" ? "rotate-180" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Asset Source Dropdown */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.assetSource.sectionTitle")}
                                                </div>
                                                <button
                                                    onClick={(e) => handleToggleDropdown("asset", e)}
                                                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-4 h-4 rounded-full bg-miku/20 flex items-center justify-center">
                                                            <span className="w-2 h-2 rounded-full bg-miku" />
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t(currentAssetLabel)}</span>
                                                    </div>
                                                    <svg
                                                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedDropdown === "asset" ? "rotate-180" : ""}`}
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Data Version & Refresh */}
                                            <div>
                                                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {t("settings.dataVersion.sectionTitle")}
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-500 dark:text-slate-450">{t("settings.dataVersion.cloudVersion")}:</span>
                                                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                                                            {isLoading ? t("settings.dataVersion.checking") : (cloudVersion || t("settings.dataVersion.loadFailed"))}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-slate-500 dark:text-slate-450">{t("settings.dataVersion.localCacheVersion")}:</span>
                                                        <span className={`text-xs font-mono ${(localVersion && localVersion !== cloudVersion) ? "text-amber-500 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                                                            {localVersion ? (
                                                                localVersion === cloudVersion ? (
                                                                    <span className="flex items-center gap-1">
                                                                        {localVersion}
                                                                        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </span>
                                                                ) : localVersion
                                                            ) : t("settings.dataVersion.noCache")}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={forceRefreshData}
                                                        disabled={isRefreshing || isLoading}
                                                        className="w-full px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 disabled:from-slate-300 dark:disabled:from-slate-700 disabled:to-slate-400 dark:disabled:to-slate-800 disabled:text-slate-500 dark:disabled:text-slate-650 rounded-xl transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {isRefreshing ? (
                                                            <>
                                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                {t("settings.refresh.refreshing")}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                </svg>
                                                                {t("settings.refresh.idle")}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 4: ABOUT */}
                                    {activeTab === "about" && (
                                        <div className="space-y-4">
                                            <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/30 flex flex-col items-center text-center space-y-3">
                                                {/* Dynamic Theme Mapped SVG Logo & Title as Hyperlink */}
                                                <a
                                                    href="/about"
                                                    onClick={handleNavigateAbout}
                                                    className="group flex flex-col items-center cursor-pointer"
                                                >
                                                    <div
                                                        className="h-9 w-32 bg-miku transition-transform duration-200 group-hover:scale-105 my-1"
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
                                                        role="img"
                                                        aria-label="Moesekai Logo"
                                                    />
                                                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 group-hover:text-miku transition-colors mt-1">
                                                        Moesekai Viewer
                                                    </h4>
                                                </a>

                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    {t("settings.about.projectDescription")}
                                                </p>

                                                <a
                                                    href="/about"
                                                    onClick={handleNavigateAbout}
                                                    className="pressable w-full px-4 py-2.5 text-xs font-bold text-white bg-miku hover:bg-miku-dark rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors mt-2 cursor-pointer"
                                                >
                                                    <span>{t("settings.about.viewDetails")}</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer with version - Fixed at bottom */}
                        <div className="border-t border-slate-200/50 dark:border-slate-800/60 px-4 py-2.5 shrink-0 bg-white/40 dark:bg-slate-950/40">
                            <div className="flex items-center justify-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                    {t("settings.footer.version")}
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* PORTAL DROPDOWNS: Rendered completely outside modal at z-[300] to eliminate any clipping */}
                    <FloatingDropdown
                        isOpen={expandedDropdown === "theme"}
                        triggerRect={triggerRect}
                        onClose={() => setExpandedDropdown(null)}
                        maxHeight={260}
                    >
                        <div className="space-y-3">
                            {unitGroups.map((unit) => (
                                <div key={unit.id}>
                                    <div className="px-2 pt-1 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {t(unit.labelKey)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {unit.charIds.map((charId) => {
                                            const isSelected = themeCharId === String(charId);
                                            const color = CHAR_COLORS[String(charId)];
                                            const name = getCharacterName(t, charId, "short");
                                            return (
                                                <button
                                                    key={charId}
                                                    onClick={() => {
                                                        setThemeCharacter(String(charId));
                                                        setExpandedDropdown(null);
                                                    }}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                                        isSelected
                                                            ? "bg-miku/15 text-miku font-bold"
                                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                                                    }`}
                                                >
                                                    <span
                                                        className="w-3 h-3 rounded-full shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span style={{ color: isSelected ? color : undefined }}>
                                                        {name}
                                                    </span>
                                                    {isSelected && (
                                                        <svg className="w-3.5 h-3.5 ml-auto text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FloatingDropdown>

                    <FloatingDropdown
                        isOpen={expandedDropdown === "language"}
                        triggerRect={triggerRect}
                        onClose={() => setExpandedDropdown(null)}
                        maxHeight={200}
                    >
                        <div className="space-y-1" role="listbox" aria-label={t("settings.uiLanguage.label")}>
                            {languageOptions.map((option) => {
                                const isSelected = locale === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setLocale(option.id);
                                            if (option.id !== "zh-CN") {
                                                setUseLLMTranslation(false);
                                            }
                                            setExpandedDropdown(null);
                                        }}
                                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                            isSelected
                                                ? "bg-miku/10 text-miku"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        <span
                                            className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? "bg-miku" : "bg-slate-300"}`}
                                        />
                                        <span>{option.label}</span>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 ml-auto text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </FloatingDropdown>

                    <FloatingDropdown
                        isOpen={expandedDropdown === "serverSource"}
                        triggerRect={triggerRect}
                        onClose={() => setExpandedDropdown(null)}
                        maxHeight={220}
                    >
                        <div className="space-y-1">
                            {(["en", "jp", "cn", "tw", "kr"] as const).map((region) => {
                                const isSelected = serverSource === region;
                                return (
                                    <button
                                        key={region}
                                        onClick={() => {
                                            setExpandedDropdown(null);
                                            if (serverSource !== region) {
                                                setServerSource(region);
                                                setTimeout(() => {
                                                    const url = new URL(window.location.href);
                                                    url.searchParams.set('_refresh', Date.now().toString());
                                                    window.location.href = url.toString();
                                                }, 100);
                                            }
                                        }}
                                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                            isSelected
                                                ? "bg-miku/10 text-miku"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}
                                    >
                                        <span
                                            className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? "bg-miku" : "bg-slate-300"}`}
                                        />
                                        <span>{t(`settings.serverSource.${region}`)}</span>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 ml-auto text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </FloatingDropdown>

                    <FloatingDropdown
                        isOpen={expandedDropdown === "asset"}
                        triggerRect={triggerRect}
                        onClose={() => setExpandedDropdown(null)}
                        maxHeight={160}
                    >
                        <div className="space-y-1">
                            {assetLineOptions.map((option) => {
                                const optionValue = option.value;
                                const isSelected = assetSource === optionValue;

                                return (
                                    <button
                                        key={option.key}
                                        onClick={() => {
                                            setExpandedDropdown(null);
                                            if (assetSource !== optionValue) {
                                                setAssetSource(optionValue);
                                                setTimeout(() => {
                                                    const url = new URL(window.location.href);
                                                    url.searchParams.set('_refresh', Date.now().toString());
                                                    window.location.href = url.toString();
                                                }, 100);
                                            }
                                        }}
                                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                            isSelected
                                                ? "bg-miku/10 text-miku"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                        }`}
                                    >
                                        <span
                                            className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? "bg-miku" : "bg-slate-300"}`}
                                        />
                                        <span>{t(option.labelKey)}</span>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 ml-auto text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </FloatingDropdown>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
