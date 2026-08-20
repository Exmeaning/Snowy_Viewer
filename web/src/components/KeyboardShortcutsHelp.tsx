"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getDisplayCombos, SHORTCUT_GROUP_ORDER, SHORTCUTS } from "@/lib/shortcuts";
import { useI18n } from "@/contexts/I18nContext";
import { getMotionTransition } from "@/lib/motion";

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

const SHORTCUT_GROUP_LABEL_KEYS: Record<string, string> = {
    navigation: "shortcuts.groups.navigation",
    interface: "shortcuts.groups.interface",
    search: "shortcuts.groups.search",
    other: "shortcuts.groups.other",
};

const shortcutGroups = SHORTCUT_GROUP_ORDER
    .map((groupTitle) => {
        const shortcuts = SHORTCUTS
            .filter((shortcut) => shortcut.group === groupTitle)
            .map((shortcut) => ({
                ...shortcut,
                displayCombos: getDisplayCombos(shortcut.combos),
            }));

        return {
            titleKey: SHORTCUT_GROUP_LABEL_KEYS[groupTitle] ?? groupTitle,
            shortcuts,
        };
    })
    .filter((group) => group.shortcuts.length > 0);

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
    const [mounted, setMounted] = useState(false);
    const { t } = useI18n();
    // Curve only — never the animated values, which must match between server
    // and client. MotionProvider handles the transform downgrade after mount.
    const prefersReducedMotion = useReducedMotion();
    const overlayTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });
    const panelTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setMounted(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // Prevent body scroll & close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-start justify-center px-3 pt-4 sm:px-4 sm:pt-[min(20vh,8rem)]">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 transform-gpu bg-black/35 backdrop-blur-[8px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={overlayTransition}
                        onClick={onClose}
                    />

                    {/* Dialog — source-anchored from top chrome */}
                    <motion.div
                        className="relative w-full max-w-md transform-gpu will-change-transform liquid-glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[70vh]"
                        initial={{ opacity: 0, scale: 0.97, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -12 }}
                        transition={panelTransition}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/40">
                            <h2 className="text-sm type-title font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="2" y="6" width="20" height="12" rx="2" />
                                    <path d="M6 14h0M10 14h4M18 14h0M8 10h0M12 10h0M16 10h0" strokeLinecap="round" />
                                </svg>
                                {t("shortcuts.title")}
                            </h2>
                            <button
                                onClick={onClose}
                                className="pressable p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1 px-5 py-3">
                            {shortcutGroups.map((group) => (
                                <div key={group.titleKey} className="mb-4 last:mb-0">
                                    <h3 className="text-xs type-caption font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        {t(group.titleKey)}
                                    </h3>
                                    <div className="space-y-1.5">
                                        {group.shortcuts.map((shortcut) => (
                                            <div
                                                key={shortcut.id}
                                                className="flex items-center justify-between py-1.5"
                                            >
                                                <span className="text-sm type-body text-slate-600 dark:text-slate-300">
                                                    {t(`shortcuts.entries.${shortcut.id}`)}
                                                </span>
                                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                                    {shortcut.displayCombos.map((combo, comboIndex) => (
                                                        <React.Fragment key={`${shortcut.id}-${combo.combo}`}>
                                                            {comboIndex > 0 && (
                                                                <span className="text-[10px] text-slate-300 mx-0.5">{t("common.separator.or")}</span>
                                                            )}

                                                            {combo.steps.map((step, stepIndex) => (
                                                                <React.Fragment key={`${shortcut.id}-${combo.combo}-step-${stepIndex}`}>
                                                                    {stepIndex > 0 && (
                                                                        <span className="text-[10px] text-slate-300 mx-0.5">{t("common.separator.then")}</span>
                                                                    )}

                                                                    {step.keys.map((key, keyIndex) => (
                                                                        <React.Fragment key={`${shortcut.id}-${combo.combo}-step-${stepIndex}-key-${keyIndex}`}>
                                                                            {keyIndex > 0 && (
                                                                                <span className="text-[10px] text-slate-300 mx-0.5">+</span>
                                                                            )}
                                                                            <kbd className="min-w-[1.5rem] px-1.5 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded border border-slate-200 text-center shadow-sm">
                                                                                {key}
                                                                            </kbd>
                                                                        </React.Fragment>
                                                                    ))}
                                                                </React.Fragment>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                            {t("shortcuts.footer")}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
