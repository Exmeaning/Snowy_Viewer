"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useI18n } from "@/contexts/I18nContext";
import { hhSheetVariants, springSnappy } from "@/lib/motion";
import { playHandheldSound } from "@/lib/handheld-sound";

export const ASSET_TOS_STORAGE_KEY = "asset-viewer-tos-agreed";

/**
 * Shared Terms-of-Service gate for asset-related pages (asset browser,
 * asset version changelog). Agreement is stored once under a common
 * localStorage key so users only have to accept it a single time.
 */
export default function AssetTosModal({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useI18n();
    const [tosCountdown, setTosCountdown] = useState(10);
    const [hasAgreed, setHasAgreed] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Load agreement status on mount; force the modal open for new users
    useEffect(() => {
        setMounted(true);
        if (typeof window === "undefined") return;
        const agreed = localStorage.getItem(ASSET_TOS_STORAGE_KEY);
        if (agreed === "true") {
            setHasAgreed(true);
        } else {
            onOpenChange(true);
        }
        // Only run once on mount: onOpenChange is expected to be a state setter
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Countdown timer while the modal is open and not yet agreed
    useEffect(() => {
        if (!open) return;
        if (hasAgreed) {
            setTosCountdown(0);
            return;
        }
        setTosCountdown(10);
        const timer = setInterval(() => {
            setTosCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [open, hasAgreed]);

    const handleAgree = useCallback(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(ASSET_TOS_STORAGE_KEY, "true");
        }
        playHandheldSound("confirm");
        setHasAgreed(true);
        onOpenChange(false);
    }, [onOpenChange]);

    // Leaving is one gesture regardless of which affordance was used.
    const handleDismiss = useCallback(() => {
        playHandheldSound("back");
        onOpenChange(false);
    }, [onOpenChange]);

    if (!mounted) return null;

    return createPortal(
        // AnimatePresence rather than Tailwind's animate-in: the enter and exit
        // now travel the same damped path as every other dialog, instead of a
        // one-way zoom that snapped away on close.
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[300] isolate flex items-center justify-center p-4 sm:p-6 select-none">
                    {/* Scrim — flat dim, no blur. */}
                    <motion.div
                        className="absolute inset-0 hh-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springSnappy}
                        onClick={() => {
                            // Before agreeing, the scrim is inert: this is a gate,
                            // and a gate you can tap past is not a gate.
                            if (hasAgreed) handleDismiss();
                        }}
                    />

                    {/* Dialog */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="asset-tos-title"
                        className="relative w-full max-w-lg transform-gpu will-change-transform hh-float overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh]"
                        variants={hhSheetVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                    >
                        {/* Title bar */}
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] flex-shrink-0">
                            <h2
                                id="asset-tos-title"
                                className="hh-title text-sm sm:text-base text-[var(--hh-text-primary)] flex items-center gap-2 min-w-0"
                            >
                                <span className="w-[3px] h-4 shrink-0 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]" />
                                <span className="truncate">{t("page.assetViewer.tos.title")}</span>
                            </h2>
                            {hasAgreed && (
                                <button
                                    onClick={handleDismiss}
                                    className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                    aria-label={t("common.action.close")}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {/* Body */}
                        <div className="hh-body flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-[var(--hh-text-secondary)] custom-scrollbar">
                            <p className="font-semibold text-[var(--hh-text-primary)]">
                                {t("page.assetViewer.tos.welcome")}
                            </p>

                            <div className="space-y-4">
                                {([1, 2, 3, 4, 5] as const).map((sec) => (
                                    <div key={sec}>
                                        <h3 className="hh-title font-semibold text-[var(--hh-text-primary)] flex items-center gap-1.5">
                                            <span className="text-[var(--hh-accent)]">{sec}.</span> {t(`page.assetViewer.tos.sec${sec}Title`)}
                                        </h3>
                                        <p className="pl-4 mt-0.5 text-[var(--hh-text-secondary)]">
                                            {t(`page.assetViewer.tos.sec${sec}Content`)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Action bar — the whole point of this dialog is the
                            answer it collects, so the affirmative slab is the
                            primary object here, not a corner glyph. */}
                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--hh-border)] bg-[var(--hh-surface-1)] flex-shrink-0">
                            {hasAgreed ? (
                                <button onClick={handleDismiss} className="hh-btn hh-press text-sm">
                                    {t("common.action.close")}
                                </button>
                            ) : (
                                <button
                                    disabled={tosCountdown > 0}
                                    onClick={handleAgree}
                                    className="hh-btn hh-btn-primary hh-press text-sm"
                                >
                                    {tosCountdown > 0
                                        ? `${t("page.assetViewer.tos.agree")} (${tosCountdown}s)`
                                        : t("page.assetViewer.tos.agree")}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
