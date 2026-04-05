"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
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
            setErrorMessage("复制失败：当前浏览器可能不支持，请使用保存图片");
        } finally {
            setIsCopying(false);
        }
    }, [imageUrl]);

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
            setErrorMessage("保存失败，请稍后重试");
        } finally {
            setIsSaving(false);
        }
    }, [fileName, imageUrl]);

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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size={size}
            headerActions={headerActions}
        >
            <div className="space-y-3">
                {saveClickCount >= 2 && (
                    <div className="rounded-xl bg-gradient-to-r from-miku/5 to-luka/5 border border-miku/15 px-4 py-2.5 animate-in fade-in duration-300">
                        <p className="text-xs text-slate-600 leading-relaxed">
                            若未能正常开启下载，请尝试<strong className="text-slate-700">右键点击图片（移动端长按）→ 保存图像</strong>。
                            或下载最新版浏览器：
                            <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer" className="text-miku font-medium hover:underline ml-1">Chrome</a>
                            <span className="mx-0.5 text-slate-300">/</span>
                            <a href="https://www.firefox.com/zh-CN/" target="_blank" rel="noopener noreferrer" className="text-miku font-medium hover:underline">Firefox</a>
                        </p>
                    </div>
                )}

                {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
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
