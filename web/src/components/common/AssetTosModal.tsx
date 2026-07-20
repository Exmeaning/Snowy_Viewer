"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/contexts/I18nContext";

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
        setHasAgreed(true);
        onOpenChange(false);
    }, [onOpenChange]);

    if (!mounted || !open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[300] isolate flex items-center justify-center p-4 sm:p-6 select-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 transform-gpu bg-black/35 backdrop-blur-[8px]"
                onClick={() => {
                    if (hasAgreed) onOpenChange(false);
                }}
            />

            {/* Dialog Container */}
            <div className="relative w-full max-w-lg transform-gpu will-change-transform liquid-glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-dashed border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-r from-miku/5 to-transparent flex-shrink-0">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-miku rounded-full" />
                        {t("page.assetViewer.tos.title")}
                    </h2>
                    {hasAgreed && (
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-1.5 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full transition-colors"
                            aria-label={t("common.action.close")}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed custom-scrollbar">
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                        {t("page.assetViewer.tos.welcome")}
                    </p>

                    <div className="space-y-4">
                        {([1, 2, 3, 4, 5] as const).map((sec) => (
                            <div key={sec}>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    <span className="text-miku">{sec}.</span> {t(`page.assetViewer.tos.sec${sec}Title`)}
                                </h3>
                                <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                    {t(`page.assetViewer.tos.sec${sec}Content`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Footer */}
                <div className="p-4 border-t border-dashed border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end flex-shrink-0">
                    {hasAgreed ? (
                        <button
                            onClick={() => onOpenChange(false)}
                            className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ios-glass-btn"
                        >
                            {t("common.action.close")}
                        </button>
                    ) : (
                        <button
                            disabled={tosCountdown > 0}
                            onClick={handleAgree}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                                tosCountdown > 0
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                    : "ios-glass-btn ios-glass-btn-primary"
                            }`}
                        >
                            {tosCountdown > 0
                                ? `${t("page.assetViewer.tos.agree")} (${tosCountdown}s)`
                                : t("page.assetViewer.tos.agree")}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
