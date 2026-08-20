"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import { useI18n } from "@/contexts/I18nContext";
import { copyImageFromUrl, saveImageFromUrl } from "@/lib/imageActions";

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    imageUrl: string;
    alt: string;
    fileName: string;
    size?: "sm" | "md" | "lg" | "xl";
}

export default function ImagePreviewModal({
    isOpen,
    onClose,
    title,
    imageUrl,
    alt,
    fileName,
    size = "xl",
}: ImagePreviewModalProps) {
    const { t } = useI18n();
    const [isCopying, setIsCopying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [saveClickCount, setSaveClickCount] = useState(0);
    const copyResetTimerRef = useRef<number | null>(null);
    const saveResetTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (copyResetTimerRef.current) {
                window.clearTimeout(copyResetTimerRef.current);
            }
            if (saveResetTimerRef.current) {
                window.clearTimeout(saveResetTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setErrorMessage(null);
            setIsCopying(false);
            setIsSaving(false);
            setCopySuccess(false);
            setSaveSuccess(false);
            setSaveClickCount(0);
            if (copyResetTimerRef.current) {
                window.clearTimeout(copyResetTimerRef.current);
                copyResetTimerRef.current = null;
            }
            if (saveResetTimerRef.current) {
                window.clearTimeout(saveResetTimerRef.current);
                saveResetTimerRef.current = null;
            }
        }
    }, [isOpen]);

    const handleCopy = useCallback(async () => {
        setIsCopying(true);
        setErrorMessage(null);
        setCopySuccess(false);
        try {
            await copyImageFromUrl(imageUrl);
            setCopySuccess(true);
            if (copyResetTimerRef.current) {
                window.clearTimeout(copyResetTimerRef.current);
            }
            copyResetTimerRef.current = window.setTimeout(() => {
                setCopySuccess(false);
            }, 1800);
        } catch {
            setErrorMessage(t("common.imageActions.copyFailedUseSave"));
        } finally {
            setIsCopying(false);
        }
    }, [imageUrl, t]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setErrorMessage(null);
        setSaveSuccess(false);
        setSaveClickCount((prev) => prev + 1);
        try {
            await saveImageFromUrl(imageUrl, fileName);
            setSaveSuccess(true);
            if (saveResetTimerRef.current) {
                window.clearTimeout(saveResetTimerRef.current);
            }
            saveResetTimerRef.current = window.setTimeout(() => {
                setSaveSuccess(false);
            }, 1800);
        } catch {
            setErrorMessage(t("common.imageActions.saveFailed"));
        } finally {
            setIsSaving(false);
        }
    }, [fileName, imageUrl, t]);

    const headerActions = (
        <>
            <button
                onClick={handleCopy}
                disabled={isCopying || isSaving}
                className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)] disabled:opacity-50"
                aria-label={t("common.imageActions.copyImage")}
                title={isCopying ? t("common.imageActions.copying") : copySuccess ? t("common.imageActions.copySuccess") : t("common.imageActions.copyImage")}
            >
                <span className="relative block w-4 h-4">
                    <svg
                        className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${isCopying || copySuccess ? "opacity-0 scale-75" : "opacity-100 scale-100"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <svg
                        className={`absolute inset-0 w-4 h-4 animate-spin transition-all duration-200 ${isCopying ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <circle cx="12" cy="12" r="9" strokeWidth="2" className="opacity-30" />
                        <path d="M12 3a9 9 0 019 9" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <svg
                        className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${copySuccess && !isCopying ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                </span>
            </button>
            <button
                onClick={handleSave}
                disabled={isSaving || isCopying}
                className="hh-press p-1.5 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-accent)] disabled:opacity-50"
                aria-label={t("common.imageActions.saveImage")}
                title={isSaving ? t("common.imageActions.saving") : saveSuccess ? t("common.imageActions.saveSuccess") : t("common.imageActions.saveImage")}
            >
                <span className="relative block w-4 h-4">
                    <svg
                        className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${isSaving || saveSuccess ? "opacity-0 scale-75" : "opacity-100 scale-100"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <svg
                        className={`absolute inset-0 w-4 h-4 animate-spin transition-all duration-200 ${isSaving ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <circle cx="12" cy="12" r="9" strokeWidth="2" className="opacity-30" />
                        <path d="M12 3a9 9 0 019 9" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <svg
                        className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${saveSuccess && !isSaving ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                </span>
            </button>
        </>
    );

    return (
        // Display-only dialog: copy and save already live in the title bar as
        // stateful icon buttons, so a bottom action bar would only duplicate
        // them. No `actions` prop here is deliberate, not an omission.
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size={size}
            headerActions={headerActions}
        >
            <div className="space-y-3">
                {saveClickCount >= 2 && (
                    <div className="rounded-[var(--hh-radius-md)] bg-[var(--hh-accent-wash)] border border-[var(--hh-accent-line)] px-4 py-2.5 animate-in fade-in duration-300">
                        <p className="hh-body text-xs text-[var(--hh-text-secondary)]">
                            {t("common.imageActions.downloadHintPrefix")}<strong className="font-semibold text-[var(--hh-text-primary)]">{t("common.imageActions.downloadHintAction")}</strong>{t("common.imageActions.downloadHintSuffix")}
                            <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-accent)] font-semibold hover:underline ml-1">Chrome</a>
                            <span className="mx-0.5 text-[var(--hh-text-tertiary)]">/</span>
                            <a href="https://www.firefox.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-accent)] font-semibold hover:underline">Firefox</a>
                        </p>
                    </div>
                )}

                {errorMessage && (
                    <p className="text-xs font-semibold text-[var(--hh-accent-alert)]">{errorMessage}</p>
                )}

                {/* Sunken trough: the artwork is the object, the frame around it
                    recedes so a bright card image doesn't fight the panel. */}
                <div className="hh-well p-3 sm:p-4">
                    <div className="max-h-[65vh] overflow-auto flex items-center justify-center">
                        <img
                            src={imageUrl}
                            alt={alt}
                            className="max-w-full max-h-[60vh] object-contain"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
