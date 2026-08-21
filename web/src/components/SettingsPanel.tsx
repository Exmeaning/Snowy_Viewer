"use client";
import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useTheme, CHAR_COLORS } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { HH_DURATION, hhPopoverVariants, hhSheetVariants, hhSpringPanel, springSnappy } from "@/lib/motion";
import { UNIT_DATA, UNIT_ID_LABEL_KEYS } from "@/types/types";
import { useMasterData } from "@/contexts/MasterDataContext";
import { ADS_SETTINGS_VISIBLE } from "@/lib/ads";
import { playHandheldSound } from "@/lib/handheld-sound";
import { MOE_LOGO_URL } from "@/lib/assets";
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

// Hoisted out of the render tree so the three segmented controls all read from
// stable arrays rather than rebuilding an inline literal every render.
const backgroundAnimationOptions = [
    { id: "on", labelKey: "settings.backgroundAnimationBudget.on" },
    { id: "off", labelKey: "settings.backgroundAnimationBudget.off" },
] as const;

const uiSoundOptions = [
    { id: "on", labelKey: "settings.uiSound.on" },
    { id: "off", labelKey: "settings.uiSound.off" },
] as const;

const serverSourceRegions = ["en", "jp", "cn", "tw", "kr"] as const;

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

/**
 * hhPopoverVariants grows downward from the anchor edge. When there is no room
 * below and the dropdown flips above its trigger, the anchor edge is now the
 * bottom one, so the travel has to invert or the panel appears to grow away
 * from the control that opened it. Same damping and duration as the shared
 * preset — only the sign of `y` differs.
 */
const popoverUpwardVariants: Variants = {
    initial: { opacity: 0, y: 6, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { ...hhSpringPanel, duration: HH_DURATION.fast } },
    exit: { opacity: 0, y: 4, scale: 0.98, transition: { type: "tween", duration: 0.1, ease: "easeOut" } },
};

function FloatingDropdown({ isOpen, triggerRect, onClose, children, maxHeight = 260 }: FloatingDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);

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
                        // Click-outside catcher for the dropdown. All five call sites
                        // pass a bare `setExpandedDropdown(null)` with no sound of
                        // their own, so dismissing by clicking away was silent while
                        // picking an option was audible.
                        data-hh-click
                        data-hh-sound="back"
                    />
                    <motion.div
                        ref={dropdownRef}
                        style={style}
                        onClick={(e) => e.stopPropagation()}
                        variants={openUpwards ? popoverUpwardVariants : hhPopoverVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="hh-float overflow-hidden will-change-transform"
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

/**
 * A labelled segmented control for one setting whose value is a small closed
 * set (appearance mode, background animation, UI sound).
 *
 * These three were authored as three copies of the same 30-line block, which is
 * how they drifted apart in the first place. Sharing one component is also what
 * guarantees the traveling slab behaves identically in all of them.
 *
 * The active slab is accent-filled rather than the neutral surface used by the
 * panel's tab strip: a tab says "you are looking here" while these say "this is
 * the value in force", and the accent is how the rest of the app already marks a
 * committed choice (.hh-chip-active, the active nav row).
 */
function SegmentedSetting({
    sectionTitle,
    options,
    selectedId,
    onSelect,
    layoutId,
}: {
    sectionTitle: string;
    options: readonly { id: string; labelKey: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    layoutId: string;
}) {
    const { t } = useI18n();
    return (
        <div>
            <div className="hh-label mb-2">{sectionTitle}</div>
            <div className="hh-segment relative" role="tablist" aria-label={sectionTitle}>
                {options.map((option) => {
                    const isSelected = selectedId === option.id;
                    return (
                        <button
                            key={option.id}
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => onSelect(option.id)}
                            className={`hh-segment-item relative cursor-pointer ${
                                isSelected
                                    ? "text-[var(--hh-text-on-accent)]"
                                    : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                            }`}
                        >
                            {isSelected && (
                                <motion.div
                                    layoutId={layoutId}
                                    className="absolute inset-0 rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent)]"
                                    transition={springSnappy}
                                />
                            )}
                            <span className="relative z-10">{t(option.labelKey)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * A settings row that opens a {@link FloatingDropdown} — theme colour, UI
 * language, server source, asset source. All four were the same 20-line button
 * with a different leading glyph and label.
 */
function DropdownSettingRow({
    sectionTitle,
    valueLabel,
    isExpanded,
    onToggle,
    swatchColor,
    ariaHasPopup,
    children,
}: {
    sectionTitle: string;
    valueLabel: string;
    isExpanded: boolean;
    onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
    /** Solid colour dot for the theme picker; omitted rows get the accent ring. */
    swatchColor?: string;
    ariaHasPopup?: boolean;
    /** Extra content below the trigger, e.g. the machine-translation notice. */
    children?: React.ReactNode;
}) {
    return (
        <div>
            <div className="hh-label mb-2">{sectionTitle}</div>
            <button
                onClick={onToggle}
                className="hh-press w-full px-3 py-2 bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] rounded-[var(--hh-radius-md)] flex items-center justify-between hover:border-[var(--hh-border-strong)]"
                aria-haspopup={ariaHasPopup ? "listbox" : undefined}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {swatchColor ? (
                        <span
                            className="w-4 h-4 rounded-[var(--hh-radius-full)] border border-[var(--hh-border-hairline)]"
                            style={{ backgroundColor: swatchColor }}
                        />
                    ) : (
                        <span className="w-4 h-4 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent-wash-strong)] flex items-center justify-center">
                            <span className="w-2 h-2 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)]" />
                        </span>
                    )}
                    <span className="text-sm font-semibold text-[var(--hh-text-primary)]">{valueLabel}</span>
                </div>
                <svg
                    className={`w-4 h-4 text-[var(--hh-text-tertiary)] transition-transform duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {children}
        </div>
    );
}

/** A label + switch row, separated from its neighbours by a hairline. */
function ToggleSettingRow({
    icon,
    label,
    checked,
    onChange,
    shortcutHint,
    withDivider = true,
}: {
    icon: React.ReactNode;
    label: string;
    checked: boolean;
    onChange: () => void;
    shortcutHint?: string;
    withDivider?: boolean;
}) {
    return (
        <div className={`flex items-center justify-between py-2 ${withDivider ? "border-b border-[var(--hh-border-hairline)]" : ""}`}>
            <div className="flex items-center gap-2">
                <span className="text-[var(--hh-accent)]">{icon}</span>
                <span className="text-sm font-medium text-[var(--hh-text-primary)]">{label}</span>
                {shortcutHint && (
                    <kbd className="hidden sm:inline-block min-w-[1.5rem] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--hh-text-secondary)] bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-center shadow-[var(--hh-shadow-tile)]">
                        {shortcutHint}
                    </kbd>
                )}
            </div>
            <button
                onClick={() => {
                    playHandheldSound("toggle");
                    onChange();
                }}
                className={`hh-press hh-switch ${checked ? "hh-switch-active" : ""}`}
                role="switch"
                aria-checked={checked}
                aria-label={label}
            >
                <span className="hh-switch-thumb" />
            </button>
        </div>
    );
}

/** A selectable row inside a {@link FloatingDropdown}. */
function DropdownOptionRow({
    onClick,
    isSelected,
    swatchColor,
    label,
    role,
}: {
    onClick: () => void;
    isSelected: boolean;
    swatchColor?: string;
    label: string;
    role?: "option";
}) {
    return (
        <button
            onClick={onClick}
            role={role}
            aria-selected={role === "option" ? isSelected : undefined}
            className={`hh-press w-full px-3 py-2 rounded-[var(--hh-radius-md)] text-xs font-semibold flex items-center gap-2 ${
                isSelected
                    ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                    : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
            }`}
        >
            <span
                className={`w-3 h-3 rounded-[var(--hh-radius-full)] shrink-0 border border-[var(--hh-border-hairline)] ${
                    swatchColor ? "" : isSelected ? "bg-[var(--hh-text-on-accent)]" : "bg-[var(--hh-border-strong)]"
                }`}
                style={swatchColor ? { backgroundColor: swatchColor } : undefined}
            />
            <span className="truncate">{label}</span>
            {isSelected && (
                <svg className="w-3.5 h-3.5 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            )}
        </button>
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
        handheldSoundEnabled,
        setHandheldSoundEnabled,
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
            playHandheldSound("back");
            onClose();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Single entry point for all four dropdown triggers (theme colour, language,
    // server source, asset source), so opening or closing any of them clicks once.
    const handleToggleDropdown = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
        playHandheldSound("toggle");
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
        playHandheldSound("confirm");
        onClose();
        window.location.href = "/about";
    };

    // Get current asset line label
    const currentAssetLabel = assetLineOptions.find((opt) => opt.value === assetSource)?.labelKey ?? "settings.assetSource.main";

    // Dismissing the panel — scrim, header button and the About link all route
    // through here so "leaving" always sounds the same.
    const handleCloseWithSound = () => {
        playHandheldSound("back");
        onClose();
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-3 sm:p-4">
                    {/* Scrim — flat dim, no blur. */}
                    <motion.div
                        className="absolute inset-0 hh-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springSnappy}
                        onClick={handleCloseWithSound}
                    />

                    {/* Dialog — auto-fits the active tab's height. */}
                    <motion.div
                        id="settings-panel-content"
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="settings-panel-title"
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md transform-gpu will-change-transform hh-float overflow-hidden flex flex-col my-auto z-10"
                        variants={hhSheetVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {/* Title bar */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] shrink-0">
                            <h3
                                id="settings-panel-title"
                                className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2 text-sm sm:text-base"
                            >
                                <svg className="w-4 h-4 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t("settings.title")}
                            </h3>
                            {/* Settings apply the moment they are touched, so
                                there is nothing to commit and no OK/Cancel pair
                                to render — the only exit is dismissal. */}
                            <button
                                onClick={handleCloseWithSound}
                                className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                aria-label={t("common.action.close")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Tab strip — a segmented control: a sunken trough with
                            one solid slab riding in it. The slab travels via
                            layoutId, which is the same "one cursor moves"
                            gesture the rest of the shell uses.

                            The wrapper is load-bearing. .hh-segment carries
                            `flex: 1 1 auto` for its intended home in the side
                            rail's *row*; as a direct child of this column panel
                            that same grow factor would stretch the strip
                            vertically to eat the whole dialog. handheld-os.css
                            is unlayered, so a Tailwind shrink-0 on the control
                            itself cannot override it — putting a plain block
                            between them makes the control not a flex item at
                            all, which is the actual fix. */}
                        <div className="mx-4 mt-4 shrink-0">
                        <div className="hh-segment relative" role="tablist" aria-label={t("settings.title")}>
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => {
                                            playHandheldSound("cursor");
                                            setActiveTab(tab.id);
                                            setExpandedDropdown(null);
                                            setTriggerRect(null);
                                        }}
                                        className={`hh-segment-item relative flex items-center justify-center gap-1.5 cursor-pointer ${
                                            isActive
                                                ? "text-[var(--hh-text-primary)]"
                                                : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                        }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeSettingsTabPill"
                                                className="absolute inset-0 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-2)] shadow-[var(--hh-shadow-tile)]"
                                                transition={springSnappy}
                                            />
                                        )}
                                        <span className="relative z-10 flex items-center justify-center gap-1.5">
                                            {/* Four segments share one panel width, so on the
                                                narrowest phones the glyph is what gets dropped:
                                                the label is the thing that has to survive, and
                                                translated labels ("ビジュアル") are wider than
                                                the English ones this was sized against. */}
                                            <span className="hidden sm:inline-flex">{tab.icon}</span>
                                            <span className="truncate">{t(tab.labelKey)}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        </div>

                        {/* Tab body — auto-heights to the active tab so the panel
                            never carries a dead gap under a short tab. */}
                        <div className="p-5 overflow-y-auto max-h-[60vh] min-h-[220px]">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={springSnappy}
                                    className="space-y-4"
                                >
                                    {/* TAB 1: VISUAL */}
                                    {activeTab === "visual" && (
                                        <div className="space-y-4">
                                            <SegmentedSetting
                                                sectionTitle={t("settings.appearance.sectionTitle")}
                                                options={appearanceOptions}
                                                selectedId={colorSchemePreference}
                                                layoutId="activeAppearancePill"
                                                onSelect={(id) => {
                                                    playHandheldSound("toggle");
                                                    setColorSchemePreference(id as typeof colorSchemePreference);
                                                }}
                                            />

                                            <SegmentedSetting
                                                sectionTitle={t("settings.backgroundAnimationBudget.sectionTitle")}
                                                options={backgroundAnimationOptions}
                                                selectedId={backgroundAnimationBudget}
                                                layoutId="activeBgAnimPill"
                                                onSelect={(id) => {
                                                    playHandheldSound("toggle");
                                                    setBackgroundAnimationBudget(id as "on" | "off");
                                                }}
                                            />

                                            <div>
                                                <SegmentedSetting
                                                    sectionTitle={t("settings.uiSound.sectionTitle")}
                                                    options={uiSoundOptions}
                                                    selectedId={handheldSoundEnabled ? "on" : "off"}
                                                    layoutId="activeUiSoundPill"
                                                    onSelect={(id) => {
                                                        const nextEnabled = id === "on";
                                                        setHandheldSoundEnabled(nextEnabled);
                                                        // Let the user hear what they just turned on.
                                                        if (nextEnabled) playHandheldSound("toggle");
                                                    }}
                                                />
                                                <p className="hh-body mt-2 text-[11px] text-[var(--hh-text-secondary)]">
                                                    {handheldSoundEnabled
                                                        ? t("settings.uiSound.onDescription")
                                                        : t("settings.uiSound.offDescription")}
                                                </p>
                                            </div>

                                            <DropdownSettingRow
                                                sectionTitle={t("settings.themeColor.sectionTitle")}
                                                valueLabel={getCharacterName(t, Number(themeCharId), "short")}
                                                isExpanded={expandedDropdown === "theme"}
                                                onToggle={(e) => handleToggleDropdown("theme", e)}
                                                swatchColor={CHAR_COLORS[themeCharId] || "#33CCBB"}
                                            />

                                            <DropdownSettingRow
                                                sectionTitle={t("settings.uiLanguage.sectionTitle")}
                                                valueLabel={currentLanguageLabel}
                                                isExpanded={expandedDropdown === "language"}
                                                onToggle={(e) => handleToggleDropdown("language", e)}
                                                ariaHasPopup
                                            >
                                                {locale !== "zh-CN" && (
                                                    // Advisory, not destructive: the alert accent is a fixed
                                                    // structural constant, so a wash of it reads as a caution
                                                    // strip without needing its own amber palette.
                                                    <p className="hh-body mt-1.5 flex items-start gap-1.5 rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] px-2 py-1.5 text-[10px] text-[var(--hh-text-secondary)]">
                                                        <span className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-[var(--hh-radius-full)] bg-[var(--hh-accent-alert)] text-[8px] font-bold text-white">!</span>
                                                        <span>{t("settings.uiLanguage.machineTranslationNotice")}</span>
                                                    </p>
                                                )}
                                            </DropdownSettingRow>
                                        </div>
                                    )}

                                    {/* TAB 2: CONTENT */}
                                    {activeTab === "content" && (
                                        <div className="space-y-4">
                                            <ToggleSettingRow
                                                label={t("settings.showSpoiler.label")}
                                                checked={isShowSpoiler}
                                                onChange={() => setShowSpoiler(!isShowSpoiler)}
                                                icon={
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                }
                                            />

                                            <ToggleSettingRow
                                                label={t("settings.trainedThumbnail.label")}
                                                checked={useTrainedThumbnail}
                                                onChange={() => setUseTrainedThumbnail(!useTrainedThumbnail)}
                                                shortcutHint="]"
                                                icon={
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                }
                                            />

                                            <ToggleSettingRow
                                                label={t("settings.translation.label")}
                                                checked={useLLMTranslation}
                                                onChange={() => setUseLLMTranslation(!useLLMTranslation)}
                                                // The ads row below is conditional, so this one keeps its
                                                // hairline only while something follows it.
                                                withDivider={ADS_SETTINGS_VISIBLE}
                                                icon={
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                                    </svg>
                                                }
                                            />

                                            {ADS_SETTINGS_VISIBLE && (
                                                <ToggleSettingRow
                                                    label={t("settings.ads.label")}
                                                    checked={showAds}
                                                    onChange={() => setShowAds(!showAds)}
                                                    withDivider={false}
                                                    icon={
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                                        </svg>
                                                    }
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* TAB 3: DATA */}
                                    {activeTab === "data" && (
                                        <div className="space-y-4">
                                            <DropdownSettingRow
                                                sectionTitle={t("settings.serverSource.sectionTitle")}
                                                valueLabel={t(`settings.serverSource.${serverSource}`)}
                                                isExpanded={expandedDropdown === "serverSource"}
                                                onToggle={(e) => handleToggleDropdown("serverSource", e)}
                                            />

                                            <DropdownSettingRow
                                                sectionTitle={t("settings.assetSource.sectionTitle")}
                                                valueLabel={t(currentAssetLabel)}
                                                isExpanded={expandedDropdown === "asset"}
                                                onToggle={(e) => handleToggleDropdown("asset", e)}
                                            />

                                            {/* Data Version & Refresh */}
                                            <div>
                                                <div className="hh-label mb-2">
                                                    {t("settings.dataVersion.sectionTitle")}
                                                </div>
                                                <div className="space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-[var(--hh-text-secondary)]">{t("settings.dataVersion.cloudVersion")}:</span>
                                                        <span className="hh-numeric text-xs font-mono text-[var(--hh-text-primary)]">
                                                            {isLoading ? t("settings.dataVersion.checking") : (cloudVersion || t("settings.dataVersion.loadFailed"))}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-[var(--hh-text-secondary)]">{t("settings.dataVersion.localCacheVersion")}:</span>
                                                        {/* A stale cache is the one state worth colouring: it
                                                            is the reason the refresh button below exists. */}
                                                        <span className={`hh-numeric text-xs font-mono ${(localVersion && localVersion !== cloudVersion) ? "text-[var(--hh-accent-alert)] font-bold" : "text-[var(--hh-text-primary)]"}`}>
                                                            {localVersion ? (
                                                                localVersion === cloudVersion ? (
                                                                    <span className="flex items-center gap-1">
                                                                        {localVersion}
                                                                        <svg className="w-3 h-3 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    </span>
                                                                ) : localVersion
                                                            ) : t("settings.dataVersion.noCache")}
                                                        </span>
                                                    </div>

                                                    {/* The one committing action in the whole panel, so it
                                                        is the one primary slab. .hh-press already handles
                                                        the disabled dim, so no disabled: palette is needed. */}
                                                    <button
                                                        onClick={() => {
                                                            playHandheldSound("confirm");
                                                            forceRefreshData();
                                                        }}
                                                        disabled={isRefreshing || isLoading}
                                                        className="hh-btn hh-btn-primary hh-press w-full text-xs"
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
                                            <div className="hh-well p-5 flex flex-col items-center text-center space-y-3">
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
                                                    <h4 className="hh-title text-base text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent)] transition-colors mt-1">
                                                        Moesekai Viewer
                                                    </h4>
                                                </a>

                                                <p className="hh-body text-xs text-[var(--hh-text-secondary)]">
                                                    {t("settings.about.projectDescription")}
                                                </p>

                                                <a
                                                    href="/about"
                                                    onClick={handleNavigateAbout}
                                                    className="hh-btn hh-btn-primary hh-press w-full text-xs mt-2 cursor-pointer"
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

                        {/* Status strip — the panel's bottom chrome, matching the
                            title bar's surface so the body reads as inset between
                            two rails. */}
                        <div className="border-t border-[var(--hh-border)] bg-[var(--hh-surface-1)] px-4 py-2.5 shrink-0">
                            <div className="flex items-center justify-center">
                                <span className="text-[10px] font-medium text-[var(--hh-text-tertiary)]">
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
                                    <div className="hh-label px-2 pt-1 pb-1">
                                        {t(unit.labelKey)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        {unit.charIds.map((charId) => (
                                            // The character's own colour is the swatch, which is
                                            // the one place a non-token colour is the content
                                            // rather than decoration.
                                            <DropdownOptionRow
                                                key={charId}
                                                isSelected={themeCharId === String(charId)}
                                                swatchColor={CHAR_COLORS[String(charId)]}
                                                label={getCharacterName(t, charId, "short")}
                                                onClick={() => {
                                                    playHandheldSound("confirm");
                                                    setThemeCharacter(String(charId));
                                                    setExpandedDropdown(null);
                                                }}
                                            />
                                        ))}
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
                            {languageOptions.map((option) => (
                                <DropdownOptionRow
                                    key={option.id}
                                    role="option"
                                    isSelected={locale === option.id}
                                    label={option.label}
                                    onClick={() => {
                                        playHandheldSound("confirm");
                                        setLocale(option.id);
                                        if (option.id !== "zh-CN") {
                                            setUseLLMTranslation(false);
                                        }
                                        setExpandedDropdown(null);
                                    }}
                                />
                            ))}
                        </div>
                    </FloatingDropdown>

                    <FloatingDropdown
                        isOpen={expandedDropdown === "serverSource"}
                        triggerRect={triggerRect}
                        onClose={() => setExpandedDropdown(null)}
                        maxHeight={220}
                    >
                        <div className="space-y-1">
                            {serverSourceRegions.map((region) => (
                                <DropdownOptionRow
                                    key={region}
                                    isSelected={serverSource === region}
                                    label={t(`settings.serverSource.${region}`)}
                                    onClick={() => {
                                        playHandheldSound("confirm");
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
                                />
                            ))}
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
                                return (
                                    <DropdownOptionRow
                                        key={option.key}
                                        isSelected={assetSource === optionValue}
                                        label={t(option.labelKey)}
                                        onClick={() => {
                                            playHandheldSound("confirm");
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
                                    />
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
