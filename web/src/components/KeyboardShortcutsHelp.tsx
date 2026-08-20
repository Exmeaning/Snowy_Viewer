"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getDisplayCombos, SHORTCUT_GROUP_ORDER, SHORTCUTS } from "@/lib/shortcuts";
import { useI18n } from "@/contexts/I18nContext";
import { hhPopoverVariants, springSnappy } from "@/lib/motion";

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
                    {/* Scrim — flat dim, no blur. */}
                    <motion.div
                        className="absolute inset-0 hh-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springSnappy}
                        onClick={onClose}
                    />

                    {/* Dialog — anchored under the top chrome that opened it, so
                        it grows from its trigger edge rather than the viewport
                        centre. hhPopoverVariants is that exact path. */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="shortcuts-help-title"
                        className="relative w-full max-w-md transform-gpu will-change-transform hh-float overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[70vh]"
                        variants={hhPopoverVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {/* Title bar */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                            <h2
                                id="shortcuts-help-title"
                                className="hh-title text-sm text-[var(--hh-text-primary)] flex items-center gap-2"
                            >
                                <svg className="w-4 h-4 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="2" y="6" width="20" height="12" rx="2" />
                                    <path d="M6 14h0M10 14h4M18 14h0M8 10h0M12 10h0M16 10h0" strokeLinecap="round" />
                                </svg>
                                {t("shortcuts.title")}
                            </h2>
                            {/* Reference sheet, not a question: there is nothing
                                to confirm, so close is the only action and an
                                A/B bar would be noise. */}
                            <button
                                onClick={onClose}
                                className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                aria-label={t("common.action.close")}
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
                                    <h3 className="hh-label mb-2">
                                        {t(group.titleKey)}
                                    </h3>
                                    <div className="space-y-1.5">
                                        {group.shortcuts.map((shortcut) => (
                                            <div
                                                key={shortcut.id}
                                                className="flex items-center justify-between py-1.5"
                                            >
                                                <span className="hh-body text-sm text-[var(--hh-text-secondary)]">
                                                    {t(`shortcuts.entries.${shortcut.id}`)}
                                                </span>
                                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                                    {shortcut.displayCombos.map((combo, comboIndex) => (
                                                        <React.Fragment key={`${shortcut.id}-${combo.combo}`}>
                                                            {comboIndex > 0 && (
                                                                <span className="text-[10px] text-[var(--hh-text-tertiary)] mx-0.5">{t("common.separator.or")}</span>
                                                            )}

                                                            {combo.steps.map((step, stepIndex) => (
                                                                <React.Fragment key={`${shortcut.id}-${combo.combo}-step-${stepIndex}`}>
                                                                    {stepIndex > 0 && (
                                                                        <span className="text-[10px] text-[var(--hh-text-tertiary)] mx-0.5">{t("common.separator.then")}</span>
                                                                    )}

                                                                    {step.keys.map((key, keyIndex) => (
                                                                        <React.Fragment key={`${shortcut.id}-${combo.combo}-step-${stepIndex}-key-${keyIndex}`}>
                                                                            {keyIndex > 0 && (
                                                                                <span className="text-[10px] text-[var(--hh-text-tertiary)] mx-0.5">+</span>
                                                                            )}
                                                                            {/* Keycaps are physical objects: raised
                                                                                slab on the panel, not a tinted chip. */}
                                                                            <kbd className="hh-numeric min-w-[1.5rem] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--hh-text-secondary)] bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-center shadow-[var(--hh-shadow-tile)]">
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

                        {/* Footer hint strip */}
                        <div className="px-5 py-2.5 border-t border-[var(--hh-border)] bg-[var(--hh-surface-1)] text-[11px] text-[var(--hh-text-tertiary)] text-center">
                            {t("shortcuts.footer")}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
