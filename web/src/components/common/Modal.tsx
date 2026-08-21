"use client";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { getMotionTransition, hhSheetVariants } from "@/lib/motion";
import { playHandheldSound, type HandheldSoundName } from "@/lib/handheld-sound";

/**
 * One declarative button in the dialog's action bar.
 *
 * The variant decides both the button treatment and the sound, which is what keeps
 * "confirm" and "cancel" audibly distinct across dialogs.
 */
export interface ModalAction {
    label: string;
    onClick?: () => void;
    /**
     * "primary" is the affirmative slab, "danger" the destructive one, and
     * "neutral" (default) everything else — cancel, dismiss, secondary jumps.
     */
    variant?: "neutral" | "primary" | "danger";
    disabled?: boolean;
    /**
     * Overrides the variant's default cue. Affirmative variants sound
     * `confirm`, neutral ones sound `back`, matching the shell's convention
     * that leaving and committing are different gestures.
     */
    sound?: HandheldSoundName;
    /** Runs {@link ModalProps.onClose} after `onClick`. Default: false. */
    closeOnClick?: boolean;
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    /** Modal width preset. Default: "md" */
    size?: "sm" | "md" | "lg" | "xl";
    /** Optional action buttons shown in header, left of close */
    headerActions?: React.ReactNode;
    /**
     * Declarative buttons for the bottom action bar, laid out trailing-aligned.
     * Omit for a display-only dialog: the bar is not rendered at all, so every
     * existing call site keeps its current geometry.
     */
    actions?: ModalAction[];
    /**
     * Free-form content for the leading side of the action bar — a hint line,
     * a checkbox, a counter. Rendered next to {@link actions}; either one alone
     * is enough to bring the bar up.
     */
    footer?: React.ReactNode;
    /** Whether to sync modal open state to browser history. Default: true */
    syncHistory?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-5xl",
};

const actionVariantClasses: Record<NonNullable<ModalAction["variant"]>, string> = {
    neutral: "hh-btn",
    primary: "hh-btn hh-btn-primary",
    danger: "hh-btn hh-btn-danger",
};

/** Committing sounds different from backing out. */
function defaultActionSound(variant: NonNullable<ModalAction["variant"]>): HandheldSoundName {
    return variant === "neutral" ? "back" : "confirm";
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    headerActions,
    actions,
    footer,
    syncHistory = true,
}: ModalProps) {
    const { t } = useI18n();
    const [mounted, setMounted] = useState(false);
    const titleId = useId();
    // Curve only — never the animated values, which must match between server
    // and client. MotionProvider handles the transform downgrade after mount.
    const prefersReducedMotion = useReducedMotion();
    const overlayTransition = getMotionTransition("snappy", {
        reducedMotion: !!prefersReducedMotion,
    });

    // Keep a stable ref to onClose so the history effect doesn't re-run
    // when the parent passes a new inline callback on every render.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    const stableOnClose = useCallback(() => onCloseRef.current(), []);

    // Every dismissal path — glyph, scrim, Escape, hardware back — is the same
    // gesture, so they share one cue instead of only the button having sound.
    const dismiss = useCallback(() => {
        playHandheldSound("back");
        onCloseRef.current();
    }, []);

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
            if (e.key === "Escape") {
                e.preventDefault();
                playHandheldSound("back");
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

    const hasActionBar = (actions && actions.length > 0) || !!footer;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-center justify-center p-4 sm:p-6">
                    {/* Scrim — flat dim, no blur. Layers separate by value, and
                        dropping backdrop-filter is what makes an open dialog
                        free to composite on phones. */}
                    <motion.div
                        className="absolute inset-0 hh-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={overlayTransition}
                        onClick={dismiss}
                    />

                    {/* Dialog — unified single-ground shell on Surface-1 */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className={`relative w-full ${sizeClasses[size]} transform-gpu will-change-transform bg-[var(--hh-surface-1)] border border-[var(--hh-border)] rounded-[var(--hh-radius-xl)] shadow-[var(--hh-shadow-float)] overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh]`}
                        variants={hhSheetVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {/* Title bar — integrated with Surface-1 baseplate and hairline separator */}
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--hh-border-hairline)] bg-[var(--hh-surface-1)] flex-shrink-0">
                            <h2
                                id={titleId}
                                className="hh-title text-sm sm:text-base text-[var(--hh-text-primary)] flex items-center gap-2 min-w-0"
                            >
                                <span className="w-[3px] h-4 shrink-0 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]" />
                                <span className="truncate">{title}</span>
                            </h2>
                            <div className="flex items-center gap-1 shrink-0">
                                {headerActions}
                                <button
                                    onClick={dismiss}
                                    className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
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

                        {/* Body — scrollable on unified Surface-1 background */}
                        <div className="flex-1 overflow-y-auto hh-scrollbar p-5 text-[var(--hh-text-primary)] bg-[var(--hh-surface-1)]">
                            {children}
                        </div>

                        {/* Action bar — rendered with hairline separator */}
                        {hasActionBar && (
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-[var(--hh-border-hairline)] bg-[var(--hh-surface-1)] flex-shrink-0">
                                {/* Rendered only when supplied: an always-present
                                    empty div would still be a flex child and
                                    would push the buttons off the trailing edge
                                    that `ml-auto` is aiming for. */}
                                {footer && (
                                    <div className="hh-body min-w-0 text-xs text-[var(--hh-text-secondary)]">
                                        {footer}
                                    </div>
                                )}
                                {actions && actions.length > 0 && (
                                    <div className="flex items-center gap-2 ml-auto">
                                        {actions.map((action, index) => {
                                            const variant = action.variant ?? "neutral";
                                            return (
                                                <button
                                                    key={`${action.label}-${index}`}
                                                    type="button"
                                                    disabled={action.disabled}
                                                    onClick={() => {
                                                        playHandheldSound(
                                                            action.sound ?? defaultActionSound(variant)
                                                        );
                                                        action.onClick?.();
                                                        if (action.closeOnClick) onCloseRef.current();
                                                    }}
                                                    className={`${actionVariantClasses[variant]} hh-press text-sm`}
                                                >
                                                    {action.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
