"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { copyImageBlob, createSvgPreviewBlob, saveImageBlob } from "@/lib/imageActions";

interface UseSvgPreviewActionsOptions {
    isOpen: boolean;
    previewRef: RefObject<HTMLElement | null>;
    fileName: string;
}

export function useSvgPreviewActions({
    isOpen,
    previewRef,
    fileName,
}: UseSvgPreviewActionsOptions) {
    const [isCopying, setIsCopying] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    const getPreviewSvg = useCallback(() => {
        return previewRef.current?.querySelector("svg") ?? null;
    }, [previewRef]);

    const handleCopy = useCallback(async () => {
        const previewSvg = getPreviewSvg();
        if (!previewSvg) {
            setErrorMessage("预览图片尚未准备好，请稍后重试");
            return;
        }

        setIsCopying(true);
        setErrorMessage(null);
        setCopySuccess(false);

        try {
            const blob = await createSvgPreviewBlob(previewSvg);
            await copyImageBlob(blob);
            setCopySuccess(true);
            if (copyResetTimerRef.current) {
                window.clearTimeout(copyResetTimerRef.current);
            }
            copyResetTimerRef.current = window.setTimeout(() => {
                setCopySuccess(false);
            }, 1800);
        } catch {
            setErrorMessage("复制失败：当前浏览器可能不支持，请使用保存图片");
        } finally {
            setIsCopying(false);
        }
    }, [getPreviewSvg]);

    const handleSave = useCallback(async () => {
        const previewSvg = getPreviewSvg();
        if (!previewSvg) {
            setErrorMessage("预览图片尚未准备好，请稍后重试");
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setSaveSuccess(false);

        try {
            const blob = await createSvgPreviewBlob(previewSvg);
            await saveImageBlob(blob, fileName);
            setSaveSuccess(true);
            if (saveResetTimerRef.current) {
                window.clearTimeout(saveResetTimerRef.current);
            }
            saveResetTimerRef.current = window.setTimeout(() => {
                setSaveSuccess(false);
            }, 1800);
        } catch {
            setErrorMessage("保存失败，请稍后重试");
        } finally {
            setIsSaving(false);
        }
    }, [fileName, getPreviewSvg]);

    const headerActions = (
        <>
            <button
                onClick={handleCopy}
                disabled={isCopying || isSaving}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="复制图片"
                title={isCopying ? "复制中" : copySuccess ? "复制成功" : "复制图片"}
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
                className="p-1.5 text-slate-400 hover:text-miku hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="保存图片"
                title={isSaving ? "保存中" : saveSuccess ? "保存完成" : "保存图片"}
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

    return { headerActions, errorMessage };
}
