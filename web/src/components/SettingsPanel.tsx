"use client";
import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme, CHAR_COLORS, type BackgroundAnimationBudget } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { UNIT_DATA, UNIT_ID_LABEL_KEYS } from "@/types/types";
import { useMasterData } from "@/contexts/MasterDataContext";
import { ADS_SETTINGS_VISIBLE } from "@/lib/ads";
import {
    getShortcutById,
    isEditableEventTarget,
    isKeyboardEventComposing,
    matchesShortcutCombo,
    parseShortcutCombos,
} from "@/lib/shortcuts";
import { getCharacterName, SUPPORTED_UI_LOCALES, UI_LOCALE_LABELS } from "@/lib/i18n";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

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

const backgroundAnimationBudgetOptions: { id: BackgroundAnimationBudget; labelKey: string; descriptionKey: string }[] = [
    {
        id: "performance",
        labelKey: "settings.backgroundAnimationBudget.performance",
        descriptionKey: "settings.backgroundAnimationBudget.performanceDescription",
    },
    {
        id: "power-save",
        labelKey: "settings.backgroundAnimationBudget.powerSave",
        descriptionKey: "settings.backgroundAnimationBudget.powerSaveDescription",
    },
    {
        id: "off",
        labelKey: "settings.backgroundAnimationBudget.off",
        descriptionKey: "settings.backgroundAnimationBudget.offDescription",
    },
];

const assetLineOptions = [
    {
        key: "main",
        labelKey: "settings.assetSource.main",
        jp: "main-jp",
        cn: "main-cn",
    },
    {
        key: "backup",
        labelKey: "settings.assetSource.backup",
        jp: "backup-jp",
        cn: "backup-cn",
    },
    {
        key: "overseas",
        labelKey: "settings.assetSource.overseas",
        jp: "overseas-jp",
        cn: "overseas-cn",
    },
    {
        key: "overseas-backup",
        labelKey: "settings.assetSource.overseasBackup",
        jp: "overseas-backup-jp",
        cn: "overseas-backup-cn",
    },
] as const;

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
    const [expandedDropdown, setExpandedDropdown] = React.useState<string | null>(null);
    const languageOptions = SUPPORTED_UI_LOCALES.map((id) => ({ id, label: UI_LOCALE_LABELS[id] }));
    const currentLanguageLabel = UI_LOCALE_LABELS[locale];
    const panelRef = useRef<HTMLDivElement>(null);

    const [mounted, setMounted] = useState(false);
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

    // Get current asset line label
    const currentAssetLabel = assetLineOptions.find((opt) => {
        const val = serverSource === "cn" ? opt.cn : opt.jp;
        return val === assetSource;
    })?.labelKey ?? "settings.assetSource.main";

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-3 sm:p-4">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 transform-gpu bg-black/35 backdrop-blur-[8px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        id="settings-panel-content"
                        ref={panelRef}
                        className="relative w-full max-w-md transform-gpu will-change-transform liquid-glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-1.5rem)] max-h-[calc(100dvh-1.5rem)] sm:max-h-[80vh] shadow-2xl"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/50 dark:border-slate-800/30 bg-gradient-to-r from-miku/10 to-transparent shrink-0">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                                <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t("settings.title")}
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                                aria-label={t("common.action.close")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-5 overflow-y-auto flex-1">
                {/* Appearance Mode - Segmented Control */}
                <div>
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.appearance.sectionTitle")}</span>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1">
                        {appearanceOptions.map((option) => {
                            const isSelected = colorSchemePreference === option.id;

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => setColorSchemePreference(option.id)}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${isSelected
                                        ? "bg-miku text-white shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        }`}
                                >
                                    {t(option.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* UI Language */}
                <div className="mt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                            {t("settings.uiLanguage.sectionTitle")}
                        </span>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setExpandedDropdown(expandedDropdown === "language" ? null : "language")}
                            className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                            aria-haspopup="listbox"
                            aria-expanded={expandedDropdown === "language"}
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-miku/20 flex items-center justify-center">
                                    <span className="w-2 h-2 rounded-full bg-miku" />
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{currentLanguageLabel}</span>
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

                        <div
                            className={`absolute top-full left-0 w-full mt-2 liquid-glass-modal rounded-xl overflow-hidden z-[1100] transition-all duration-200 origin-top transform ${expandedDropdown === "language"
                                ? "opacity-100 scale-100 visible"
                                : "opacity-0 scale-95 invisible pointer-events-none"
                                }`}
                            role="listbox"
                            aria-label={t("settings.uiLanguage.label")}
                        >
                            <div className="p-2 space-y-1">
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
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isSelected
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
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {t("settings.uiLanguage.description")}
                    </p>
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 dark:border-amber-900/30 px-2 py-1.5 text-[10px] leading-relaxed text-amber-700 dark:text-amber-500">
                        <span className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/50 text-[8px] font-black text-amber-700 dark:text-amber-500">!</span>
                        <span>{t("settings.uiLanguage.machineTranslationNotice")}</span>
                    </p>
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4" />

                {/* Theme Color */}
                <div className="mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.themeColor.sectionTitle")}</span>
                </div>

                {/* Character Selection Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setExpandedDropdown(expandedDropdown === "theme" ? null : "theme")}
                        className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <span
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: CHAR_COLORS[themeCharId] || "#33CCBB" }}
                            />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
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

                    {/* Dropdown Menu */}
                    <div
                        className={`absolute top-full left-0 w-full mt-2 liquid-glass-modal rounded-xl overflow-hidden z-[1100] transition-all duration-200 origin-top transform ${expandedDropdown === "theme"
                            ? "opacity-100 scale-100 visible"
                            : "opacity-0 scale-95 invisible pointer-events-none"
                            }`}
                    >
                        <div className="max-h-60 overflow-y-auto p-2 space-y-3">
                            {unitGroups.map((unit) => (
                                <div key={unit.id}>
                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md z-10">
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
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isSelected
                                                        ? "bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200"
                                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30"
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
                    </div>
                </div>

                {/* Background Animation Budget */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                            {t("settings.backgroundAnimationBudget.sectionTitle")}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {backgroundAnimationBudgetOptions.map((option) => {
                            const isSelected = backgroundAnimationBudget === option.id;

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => setBackgroundAnimationBudget(option.id)}
                                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${isSelected
                                        ? "bg-miku text-white shadow-sm"
                                        : "bg-slate-100/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                                        }`}
                                    title={t(option.descriptionKey)}
                                >
                                    {t(option.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {t(backgroundAnimationBudgetOptions.find((option) => option.id === backgroundAnimationBudget)?.descriptionKey ?? "settings.backgroundAnimationBudget.powerSaveDescription")}
                    </p>
                </div>

                {/* Content Display */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.contentDisplay.sectionTitle")}</span>
                    </div>

                    {/* Spoiler Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t("settings.showSpoiler.label")}</span>
                        </div>
                        <button
                            onClick={() => setShowSpoiler(!isShowSpoiler)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isShowSpoiler ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isShowSpoiler ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {t("settings.showSpoiler.description")}
                    </p>

                    {/* Trained Thumbnail Toggle */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t("settings.trainedThumbnail.label")}</span>
                            <kbd className="hidden sm:inline-block min-w-[1.5rem] px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 rounded border border-slate-200/50 dark:border-slate-700/40 text-center shadow-sm">]</kbd>
                        </div>
                        <button
                            onClick={() => setUseTrainedThumbnail(!useTrainedThumbnail)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useTrainedThumbnail ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useTrainedThumbnail ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {t("settings.trainedThumbnail.description")}
                    </p>

                    {/* LLM Translation Toggle */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{t("settings.translation.label")}</span>
                        </div>
                        <button
                            onClick={() => setUseLLMTranslation(!useLLMTranslation)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useLLMTranslation ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useLLMTranslation ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        {t("settings.translation.description")}
                    </p>

                    {ADS_SETTINGS_VISIBLE && (
                        <>
                            {/* Ads Toggle */}
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{t("settings.ads.label")}</span>
                                </div>
                                <button
                                    onClick={() => setShowAds(!showAds)}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showAds ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${showAds ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                                {t("settings.ads.description")}
                            </p>
                        </>
                    )}
                </div>


                {/* Asset Source - Themed Dropdown */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.assetSource.sectionTitle")}</span>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setExpandedDropdown(expandedDropdown === "asset" ? null : "asset")}
                            className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40 rounded-xl flex items-center justify-between hover:border-miku/50 transition-all group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-miku/20 flex items-center justify-center">
                                    <span className="w-2 h-2 rounded-full bg-miku" />
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t(currentAssetLabel)}</span>
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

                        {/* Asset Dropdown Menu */}
                        <div
                            className={`absolute top-full left-0 w-full mt-2 liquid-glass-modal rounded-xl overflow-hidden z-[1100] transition-all duration-200 origin-top transform ${expandedDropdown === "asset"
                                ? "opacity-100 scale-100 visible"
                                : "opacity-0 scale-95 invisible pointer-events-none"
                                }`}
                        >
                            <div className="p-2 space-y-1">
                                {assetLineOptions.map((option) => {
                                    const optionValue = serverSource === "cn" ? option.cn : option.jp;
                                    const isSelected = assetSource === optionValue;

                                    return (
                                        <button
                                            key={`${option.key}-${serverSource}`}
                                            onClick={() => {
                                                setAssetSource(optionValue);
                                                setExpandedDropdown(null);
                                            }}
                                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${isSelected
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
                        </div>
                    </div>
                </div>

                {/* Server Source */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.serverSource.sectionTitle")}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                if (serverSource !== "jp") {
                                    setServerSource("jp");
                                    // Trigger page refresh to reload data from new server
                                    setTimeout(() => {
                                        const url = new URL(window.location.href);
                                        url.searchParams.set('_refresh', Date.now().toString());
                                        window.location.href = url.toString();
                                    }, 100);
                                }
                            }}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${serverSource === "jp"
                                ? "bg-rose-500 text-white shadow-md ring-2 ring-rose-300"
                                : "bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                        >
                            {t("settings.serverSource.jp")}
                        </button>
                        <button
                            onClick={() => {
                                if (serverSource !== "cn") {
                                    setServerSource("cn");
                                    // Trigger page refresh to reload data from new server
                                    setTimeout(() => {
                                        const url = new URL(window.location.href);
                                        url.searchParams.set('_refresh', Date.now().toString());
                                        window.location.href = url.toString();
                                    }, 100);
                                }
                            }}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${serverSource === "cn"
                                ? "bg-red-600 text-white shadow-md ring-2 ring-red-400"
                                : "bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                }`}
                        >
                            {t("settings.serverSource.cn")}
                        </button>
                    </div>
                </div>

                {/* Version Info & Cache */}
                <div className="border-t border-slate-200/50 dark:border-slate-800/30 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{t("settings.dataVersion.sectionTitle")}</span>
                    </div>
                    <div className="space-y-3">
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

                        {/* Cache status indicator */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/20 rounded-lg">
                            <div className={`w-2 h-2 rounded-full ${localVersion && localVersion === cloudVersion ? "bg-green-400" : localVersion ? "bg-amber-400" : "bg-slate-300"}`} />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {localVersion && localVersion === cloudVersion
                                    ? t("settings.dataVersion.cached")
                                    : localVersion
                                        ? t("settings.dataVersion.stale")
                                        : t("settings.dataVersion.firstVisit")}
                            </span>
                        </div>

                        <button
                            onClick={forceRefreshData}
                            disabled={isRefreshing || isLoading}
                            className="w-full px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 disabled:from-slate-300 dark:disabled:from-slate-700 disabled:to-slate-400 dark:disabled:to-slate-800 disabled:text-slate-500 dark:disabled:text-slate-650 rounded-lg transition-all flex items-center justify-center gap-2"
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

            {/* Footer with version - Fixed at bottom */}
            <div className="border-t border-slate-200/50 dark:border-slate-800/30 px-4 py-2.5 shrink-0 bg-white/40 dark:bg-slate-950/40">
                <div className="flex items-center justify-center">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {t("settings.footer.version")}
                    </span>
                </div>
            </div>
        </motion.div>
    </div>
)}
</AnimatePresence>,
document.body
);
}
