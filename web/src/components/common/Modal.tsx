"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { getMotionTransition } from "@/lib/motion";
import { isKeyboardEventComposing } from "@/lib/shortcuts";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    /** Modal width preset. Default: "md" */
    size?: "sm" | "md" | "lg" | "xl";
    /** Optional action buttons shown in header, left of close */
    headerActions?: React.ReactNode;
    /** Whether to sync modal open state to browser history. Default: true */
    syncHistory?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-5xl",
};

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    headerActions,
    syncHistory = true,
}: ModalProps) {
    const { t } = useI18n();
    const [mounted, setMounted] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    const overlayTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });
    const dialogTransition = getMotionTransition("soft", {
        reducedMotion: !!prefersReducedMotion,
    });

    // Keep a stable ref to onClose so the history effect doesn't re-run
    // when the parent passes a new inline callback on every render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    const stableOnClose = useCallback(() => onCloseRef.current(), []);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setMounted(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    // Prevent body scroll, close on Escape, and optionally sync with browser back button
    useEffect(() => {
        if (!isOpen) return;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        let didPushHistory = false;
        let rafId: number | null = null;

        const handlePopState = () => {
            stableOnClose();
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !e.defaultPrevented && !isKeyboardEventComposing(e)) {
                e.preventDefault();
                stableOnClose();
            }
        };

        if (syncHistory) {
            // Push a history entry so pressing back closes the modal instead of navigating away
            const hasModalState = window.history.state?.modal;
            if (!hasModalState) {
                window.history.pushState({ modal: true }, "");
                didPushHistory = true;
            }

            // Delay listener registration by a frame so any popstate triggered
            // by the pushState above (e.g. Next.js trailingSlash normalisation)
            // is ignored.
            rafId = requestAnimationFrame(() => {
                window.addEventListener("popstate", handlePopState);
            });
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            document.body.style.overflow = previousBodyOverflow;
            if (syncHistory) {
                window.removeEventListener("popstate", handlePopState);

                // Clean up the history entry we pushed (if modal is closing while still on our state)
                if (didPushHistory && window.history.state?.modal) {
                    window.history.back();
                }
            }
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, stableOnClose, syncHistory]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop — dim to focus; materialize with blur when motion allowed */}
                    <motion.div
                        className="absolute inset-0 transform-gpu bg-black/35 backdrop-blur-[8px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={overlayTransition}
                        onClick={onClose}
                    />

                    {/* Dialog — enter/exit same path; critical spring by default */}
                    <motion.div
                        className={`relative w-full ${sizeClasses[size]} transform-gpu will-change-transform liquid-glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh]`}
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
                        transition={dialogTransition}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-dashed border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-r from-miku/5 to-transparent flex-shrink-0">
                            <h2 className="text-base type-title font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-miku rounded-full" />
                                {title}
                            </h2>
                            <div className="flex items-center gap-1.5">
                                {headerActions}
                                <button
                                    onClick={onClose}
                                    className="pressable p-1.5 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full"
                                    aria-label={t("common.action.close")}
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Body — scrollable */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
