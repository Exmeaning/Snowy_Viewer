"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getDisplayCombos, SHORTCUT_GROUP_ORDER, SHORTCUTS } from "@/lib/shortcuts";

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

const shortcutGroups = SHORTCUT_GROUP_ORDER
    .map((groupTitle) => {
        const shortcuts = SHORTCUTS
            .filter((shortcut) => shortcut.group === groupTitle)
            .map((shortcut) => ({
                ...shortcut,
                displayCombos: getDisplayCombos(shortcut.combos),
            }));

        return {
            title: groupTitle,
            shortcuts,
        };
    })
    .filter((group) => group.shortcuts.length > 0);

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setMounted(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // Prevent body scroll & close on Escape
    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = "unset";
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[min(20vh,8rem)] px-4">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
                            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <rect x="2" y="6" width="20" height="12" rx="2" />
                                    <path d="M6 14h0M10 14h4M18 14h0M8 10h0M12 10h0M16 10h0" strokeLinecap="round" />
                                </svg>
                                键盘快捷键
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-y-auto flex-1 px-5 py-3">
                            {shortcutGroups.map((group) => (
                                <div key={group.title} className="mb-4 last:mb-0">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        {group.title}
                                    </h3>
                                    <div className="space-y-1.5">
                                        {group.shortcuts.map((shortcut) => (
                                            <div
                                                key={shortcut.id}
                                                className="flex items-center justify-between py-1.5"
                                            >
                                                <span className="text-sm text-slate-600">
                                                    {shortcut.description}
                                                </span>
                                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                                    {shortcut.displayCombos.map((combo, comboIndex) => (
                                                        <React.Fragment key={`${shortcut.id}-${combo.combo}`}>
                                                            {comboIndex > 0 && (
                                                                <span className="text-[10px] text-slate-300 mx-0.5">or</span>
                                                            )}

                                                            {combo.steps.map((step, stepIndex) => (
                                                                <React.Fragment key={`${shortcut.id}-${combo.combo}-step-${stepIndex}`}>
                                                                    {stepIndex > 0 && (
                                                                        <span className="text-[10px] text-slate-300 mx-0.5">then</span>
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
                            移动端已禁用快捷键 · 输入框与中文输入法组合状态下自动停用 · ⌘ 即 Ctrl（Windows）/ Command（Mac）
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
