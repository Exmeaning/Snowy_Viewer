"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { MOE_LOGO_URL } from "@/lib/assets";
import { LOCAL_TEST_LAYOUT_URL, MYSEKAI_PREVIEW_STORAGE_KEY } from "@/lib/mysekai-preview/assets";
import { MysekaiScenePreviewRuntime } from "@/lib/mysekai-preview/runtime";
import type { MysekaiPreviewOptions, MysekaiPreviewStatus } from "@/lib/mysekai-preview/types";

interface MysekaiScenePreviewProps {
    className?: string;
    heightClassName?: string;
    defaultLayoutUrl?: string;
    compact?: boolean;
}

const ASSET_RULE_NOTE = "资源路径由 assetbundleName / handleType 规则推导，不列桶、不轮询。";

const SITE_OPTIONS = [
    { id: 1, label: "户外" },
    { id: 2, label: "1F" },
    { id: 3, label: "2F" },
    { id: 4, label: "3F" },
];

function readSavedOptions(): Partial<MysekaiPreviewOptions> {
    if (typeof window === "undefined") return {};
    try {
        const raw = localStorage.getItem(MYSEKAI_PREVIEW_STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Partial<MysekaiPreviewOptions>;
    } catch {
        return {};
    }
}

function persistOptions(options: MysekaiPreviewOptions) {
    try {
        localStorage.setItem(MYSEKAI_PREVIEW_STORAGE_KEY, JSON.stringify({
            layoutUrl: options.layoutUrl,
            siteId: options.siteId,
            gridEnabled: options.gridEnabled,
            shadowEnabled: options.shadowEnabled,
            debugEnabled: options.debugEnabled,
            backWallOpacity: options.backWallOpacity,
        }));
    } catch {
        // ignore localStorage failures
    }
}

export default function MysekaiScenePreview({
    className = "",
    heightClassName = "h-[min(78vh,760px)] min-h-[520px]",
    defaultLayoutUrl = LOCAL_TEST_LAYOUT_URL,
    compact = false,
}: MysekaiScenePreviewProps) {
    const { assetSource } = useTheme();
    const hostRef = useRef<HTMLDivElement>(null);
    const axesRef = useRef<HTMLDivElement>(null);
    const runtimeRef = useRef<MysekaiScenePreviewRuntime | null>(null);
    const [status, setStatus] = useState<MysekaiPreviewStatus>({
        phase: "idle",
        message: "初始化中...",
        loaded: 0,
        total: 0,
        skipped: 0,
    });
    const [layoutUrl, setLayoutUrl] = useState(defaultLayoutUrl);
    const [siteId, setSiteId] = useState(1);
    const [debugEnabled, setDebugEnabled] = useState(false);
    const [gridEnabled, setGridEnabled] = useState(true);
    const [shadowEnabled, setShadowEnabled] = useState(true);
    const [backWallOpacity, setBackWallOpacity] = useState(0.2);

    useEffect(() => {
        const saved = readSavedOptions();
        if (typeof saved.layoutUrl === "string" && saved.layoutUrl) setLayoutUrl(saved.layoutUrl);
        if (Number.isFinite(Number(saved.siteId))) setSiteId(Number(saved.siteId));
        if (typeof saved.debugEnabled === "boolean") setDebugEnabled(saved.debugEnabled);
        if (typeof saved.gridEnabled === "boolean") setGridEnabled(saved.gridEnabled);
        if (typeof saved.shadowEnabled === "boolean") setShadowEnabled(saved.shadowEnabled);
        if (Number.isFinite(Number(saved.backWallOpacity))) {
            setBackWallOpacity(Math.max(0, Math.min(1, Number(saved.backWallOpacity))));
        }
    }, []);

    const options = useMemo<MysekaiPreviewOptions>(() => ({
        layoutUrl,
        siteId,
        assetSource,
        gridEnabled,
        shadowEnabled,
        debugEnabled,
        backWallOpacity,
    }), [assetSource, backWallOpacity, debugEnabled, gridEnabled, layoutUrl, shadowEnabled, siteId]);

    useEffect(() => {
        persistOptions(options);
    }, [options]);

    useEffect(() => {
        if (!hostRef.current || !axesRef.current) return;
        const runtime = new MysekaiScenePreviewRuntime(hostRef.current, axesRef.current, options, { onStatus: setStatus });
        runtimeRef.current = runtime;
        void runtime.reload(false);
        return () => {
            runtimeRef.current = null;
            runtime.dispose();
        };
        // Runtime should be created only once; subsequent option changes go through updateOptions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        runtimeRef.current?.updateOptions(options);
    }, [options]);

    const handleReload = useCallback(() => {
        void runtimeRef.current?.reload(true);
    }, []);

    const handleResetCamera = useCallback(() => {
        runtimeRef.current?.resetCamera();
    }, []);

    const statusTone = status.phase === "error"
        ? "text-red-600"
        : status.phase === "ready" ? "text-cyan-700" : "text-sky-700";
    const progressValue = Math.max(0, Math.min(100, Math.round(status.progress ?? (status.total ? (status.loaded / Math.max(1, status.total)) * 100 : 0))));
    const showLoadingOverlay = status.phase === "loading";
    const loadingTitle = status.stageLabel || (status.stage === "master" ? "正在加载 master data" : status.stage === "layout" ? "正在读取布局" : "正在加载模型资源");
    const panelPadding = compact ? "p-3" : "p-4";

    return (
        <div className={`space-y-3 ${className}`}>
            <div className={`rounded-3xl border border-slate-200/80 bg-white/86 ${panelPadding} text-xs text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-xl`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-black text-primary-text">烤森预览</div>
                            <span className="rounded-full bg-miku/10 px-2 py-1 text-[10px] font-bold text-miku ring-1 ring-miku/20">本地测试</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{assetSource}</span>
                        </div>
                        {!compact && <div className="mt-1 text-[11px] text-slate-500">{ASSET_RULE_NOTE}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleReload}
                            className="rounded-xl bg-miku px-3 py-2 font-bold text-white shadow-lg shadow-miku/20 transition hover:opacity-90 active:scale-95"
                        >
                            重新读取
                        </button>
                        <button
                            type="button"
                            onClick={handleResetCamera}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95"
                        >
                            重置相机
                        </button>
                    </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px]">
                    <label className="block">
                        <span className="mb-1 block font-bold text-slate-500">布局 JSON</span>
                        <input
                            value={layoutUrl}
                            onChange={(event) => setLayoutUrl(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-miku focus:ring-2 focus:ring-miku/20"
                            placeholder={LOCAL_TEST_LAYOUT_URL}
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block font-bold text-slate-500">场景</span>
                        <select
                            value={siteId}
                            onChange={(event) => setSiteId(Number(event.target.value))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-miku focus:ring-2 focus:ring-miku/20"
                        >
                            {SITE_OPTIONS.map(option => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 flex items-center justify-between font-bold text-slate-500">
                            <span>背墙</span>
                            <span>{Math.round(backWallOpacity * 100)}%</span>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(backWallOpacity * 100)}
                            onChange={(event) => setBackWallOpacity(Number(event.target.value) / 100)}
                            className="mt-2 w-full accent-miku"
                        />
                    </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-slate-600">
                    <label className="inline-flex items-center gap-1.5 font-medium">
                        <input type="checkbox" checked={debugEnabled} onChange={(event) => setDebugEnabled(event.target.checked)} />
                        调试
                    </label>
                    <label className="inline-flex items-center gap-1.5 font-medium">
                        <input type="checkbox" checked={gridEnabled} onChange={(event) => setGridEnabled(event.target.checked)} />
                        网格
                    </label>
                    <label className="inline-flex items-center gap-1.5 font-medium">
                        <input type="checkbox" checked={shadowEnabled} onChange={(event) => setShadowEnabled(event.target.checked)} />
                        阴影
                    </label>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-miku via-cyan-300 to-sky-300 transition-[width] duration-300"
                        style={{ width: `${progressValue}%` }}
                    />
                </div>
                <div className={`mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50/80 p-3 font-mono text-[11px] leading-relaxed ${statusTone}`}>
                    {status.message}
                </div>
                {!compact && (
                    <div className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        左键旋转 / 右键移动 / 滚轮缩放；WASD + Space/Shift 可平移相机。加载时也可以直接修改上方 JSON 和调试选项。
                    </div>
                )}
            </div>

            <div className={`relative overflow-hidden rounded-3xl border border-white/40 bg-sky-200 shadow-2xl shadow-slate-900/10 ${heightClassName}`}>
                <div ref={hostRef} className="absolute inset-0" />

                {showLoadingOverlay && (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 backdrop-blur-[6px]">
                        <div className="w-[min(460px,calc(100%-2rem))] rounded-3xl border border-white/20 bg-slate-950/78 p-6 text-center text-white shadow-2xl shadow-slate-950/35 backdrop-blur-xl">
                            <div
                                className="mx-auto h-14 w-56 bg-miku drop-shadow-[0_0_18px_rgba(57,197,187,0.45)] sm:h-16 sm:w-64"
                                style={{
                                    maskImage: `url(${MOE_LOGO_URL})`,
                                    maskSize: "contain",
                                    maskPosition: "center",
                                    maskRepeat: "no-repeat",
                                    WebkitMaskImage: `url(${MOE_LOGO_URL})`,
                                    WebkitMaskSize: "contain",
                                    WebkitMaskPosition: "center",
                                    WebkitMaskRepeat: "no-repeat",
                                }}
                                role="img"
                                aria-label="Moe Sekai"
                            />
                            <div className="mt-5 text-base font-black tracking-wide">烤森预览加载中</div>
                            <div className="mt-1 text-xs text-slate-300">{loadingTitle}</div>
                            <div className="mt-5 h-3 overflow-hidden rounded-full border border-white/15 bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-miku via-cyan-300 to-sky-300 shadow-[0_0_18px_rgba(57,197,187,0.65)] transition-[width] duration-300 ease-out"
                                    style={{ width: `${progressValue}%` }}
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-300">
                                <span>{progressValue}%</span>
                                <span>{status.loaded}/{status.renderableTotal ?? status.total ?? 0}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                                <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <div className="text-slate-400">已完成</div>
                                    <div className="mt-0.5 text-sm font-black text-cyan-100">{status.loaded}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <div className="text-slate-400">正常忽略</div>
                                    <div className="mt-0.5 text-sm font-black text-slate-100">{status.ignored ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <div className="text-slate-400">失败</div>
                                    <div className="mt-0.5 text-sm font-black text-red-200">{status.failed ?? 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={axesRef} className="absolute bottom-3 left-3 z-10 h-28 w-28 overflow-hidden rounded-2xl border border-white/25 bg-slate-950/20 backdrop-blur-sm" />

                <div className="absolute bottom-3 right-3 z-10 max-w-[calc(100%-9rem)] rounded-2xl border border-white/30 bg-white/72 px-4 py-2 text-right text-[11px] font-medium text-slate-600 shadow-lg backdrop-blur">
                    原作 / ルナ茶　Powered by Moe Dev Team　转载请标明原作者
                </div>
            </div>
        </div>
    );
}
