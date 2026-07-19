"use client";

// Profile Card Workshop renderer — client-only (WebGL2 + Worker + WASM).
// Powered by allium-renderer / @empty-sekai/sekai-custom-profile-sdk
// (https://github.com/empty-sekai/allium-renderer).

import { useCallback, useEffect, useRef, useState } from "react";

import type {
    BrowserRenderer as BrowserRendererType,
    BrowserScene,
    RendererMasterData,
} from "@empty-sekai/sekai-custom-profile-sdk";

import { useI18n } from "@/contexts/I18nContext";
import {
    createResourceProvider,
    getMasterdataBase,
    normalizeProfilePages,
    SDK_ASSET_VERSION,
    SDK_PUBLIC_BASE,
    type ProfileCardPage,
    type ProfileCardProfile,
    type ProfileCardServer,
} from "@/lib/profile-card/sdk";

const CARD_WIDTH = 1830;
const CARD_HEIGHT = 812;

export interface WorkshopFont {
    id: number;
    name: string;
    bytes: ArrayBuffer;
    families: string[];
}

interface ProfileCardWorkshopProps {
    server: ProfileCardServer;
    profile: ProfileCardProfile;
    fonts: WorkshopFont[];
    exportFileName: string;
}

type Status =
    | { kind: "loading"; step: string }
    | { kind: "ready" }
    | { kind: "error"; message: string };

export default function ProfileCardWorkshop({ server, profile, fonts, exportFileName }: ProfileCardWorkshopProps) {
    const { t } = useI18n();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<BrowserRendererType | null>(null);
    const masterDataRef = useRef<RendererMasterData | null>(null);
    const sceneRef = useRef<BrowserScene | null>(null);
    const scenesRef = useRef<Map<number, BrowserScene>>(new Map());
    const playingRef = useRef(false);
    const rafRef = useRef(0);

    const [status, setStatus] = useState<Status>({ kind: "loading", step: t("page.profileCard.status.starting") });
    const [pages, setPages] = useState<ProfileCardPage[]>([]);
    const [activePage, setActivePage] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [exporting, setExporting] = useState(false);

    const stopLoop = useCallback(() => {
        playingRef.current = false;
        cancelAnimationFrame(rafRef.current);
    }, []);

    const startLoop = useCallback(() => {
        if (playingRef.current) return;
        playingRef.current = true;
        let busy = false;
        const step = () => {
            if (!playingRef.current) return;
            rafRef.current = requestAnimationFrame(step);
            const scene = sceneRef.current;
            if (!scene || busy) return;
            busy = true;
            scene.advance(1)
                .then(() => {
                    if (playingRef.current && sceneRef.current === scene) scene.draw();
                })
                .catch(() => undefined)
                .finally(() => { busy = false; });
        };
        rafRef.current = requestAnimationFrame(step);
    }, []);

    const showScene = useCallback(async (renderer: BrowserRendererType, masterData: RendererMasterData, page: ProfileCardPage, index: number, fullProfile: ProfileCardProfile) => {
        let scene = scenesRef.current.get(index) ?? null;
        if (!scene) {
            scene = await renderer.createProfileScene({
                masterData,
                documentKey: page.documentKey,
                card: page.card,
                profile: fullProfile,
                frameMode: "animate",
            });
            scenesRef.current.set(index, scene);
        }
        sceneRef.current = scene;
        scene.draw();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const normalizedPages = normalizeProfilePages(profile);
        if (normalizedPages.length === 0) {
            setStatus({ kind: "error", message: t("page.profileCard.errors.noCards") });
            return;
        }

        (async () => {
            try {
                setStatus({ kind: "loading", step: t("page.profileCard.status.starting") });
                const { BrowserRenderer } = await import("@empty-sekai/sekai-custom-profile-sdk");
                const origin = window.location.origin;
                const version = `?v=${SDK_ASSET_VERSION}`;
                const renderer = await BrowserRenderer.create({
                    canvas,
                    region: server,
                    workerUrl: new URL(`${SDK_PUBLIC_BASE}/worker.js${version}`, origin),
                    moduleUrl: new URL(`${SDK_PUBLIC_BASE}/allium_renderer_wasm.js${version}`, origin),
                    wasmUrl: new URL(`${SDK_PUBLIC_BASE}/allium_renderer_wasm.wasm${version}`, origin),
                    resourceProvider: createResourceProvider(server),
                    resourceConcurrency: 8,
                    fontProvider: {
                        provide: async ({ family }) => {
                            const font = fonts.find((candidate) => candidate.families.includes(family));
                            return font ? { bytes: font.bytes } : null;
                        },
                    },
                    fontConcurrency: 3,
                });
                if (cancelled) { renderer.destroy(); return; }
                rendererRef.current = renderer;

                setStatus({ kind: "loading", step: t("page.profileCard.status.masterdata") });
                const masterdataBase = getMasterdataBase(server);
                const masterData = await renderer.loadMasterData("latest", async ({ table }, { signal }) => {
                    const response = await fetch(`${masterdataBase}/${encodeURIComponent(table)}.json`, { signal, cache: "default" });
                    if (!response.ok) throw new Error(`masterdata ${table} ${response.status}`);
                    return response.json();
                });
                if (cancelled) return;
                masterDataRef.current = masterData;

                setStatus({ kind: "loading", step: t("page.profileCard.status.scene") });
                await showScene(renderer, masterData, normalizedPages[0], 0, profile);
                if (cancelled) return;

                setPages(normalizedPages);
                setActivePage(0);
                setStatus({ kind: "ready" });
                startLoop();
            } catch (error) {
                if (!cancelled) {
                    setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
                }
            }
        })();

        return () => {
            cancelled = true;
            stopLoop();
            sceneRef.current = null;
            const scenes = scenesRef.current;
            scenesRef.current = new Map();
            const renderer = rendererRef.current;
            rendererRef.current = null;
            const masterData = masterDataRef.current;
            masterDataRef.current = null;
            void (async () => {
                for (const scene of scenes.values()) await scene.destroy().catch(() => undefined);
                await masterData?.destroy().catch(() => undefined);
                renderer?.destroy();
            })();
        };
    }, [server, profile, fonts, showScene, startLoop, stopLoop, t]);

    const handlePageSwitch = async (index: number) => {
        const renderer = rendererRef.current;
        const masterData = masterDataRef.current;
        if (!renderer || !masterData || index === activePage || !pages[index]) return;
        try {
            setStatus({ kind: "loading", step: t("page.profileCard.status.scene") });
            await showScene(renderer, masterData, pages[index], index, profile);
            setActivePage(index);
            setStatus({ kind: "ready" });
        } catch (error) {
            setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
        }
    };

    const handleTogglePlay = () => {
        if (playing) {
            stopLoop();
            setPlaying(false);
        } else {
            startLoop();
            setPlaying(true);
        }
    };

    const handleExport = async () => {
        const scene = sceneRef.current;
        if (!scene || exporting) return;
        setExporting(true);
        try {
            const blob = await scene.exportPng();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${exportFileName}-p${activePage + 1}.png`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900/95 shadow-inner">
                <canvas
                    ref={canvasRef}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    className="block h-auto w-full"
                    style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
                />
                {status.kind === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                        <div className="rounded-2xl bg-white/90 px-5 py-3 text-sm font-black text-slate-600 shadow-lg">
                            {status.step}
                        </div>
                    </div>
                )}
            </div>

            {status.kind === "error" && (
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-bold text-red-600">
                    {status.message}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {pages.map((page, index) => (
                        <button
                            key={page.documentKey}
                            type="button"
                            onClick={() => handlePageSwitch(index)}
                            className={`rounded-xl px-4 py-2 text-sm font-black transition active:scale-95 ${index === activePage
                                ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                : "border border-slate-200 bg-white/75 text-slate-500 hover:border-miku/30 hover:text-miku"
                                }`}
                        >
                            {t("page.profileCard.workshop.pageTab", { index: String(index + 1) })}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleTogglePlay}
                        disabled={status.kind !== "ready"}
                        className="rounded-xl border border-slate-200 bg-white/75 px-4 py-2 text-sm font-black text-slate-500 transition hover:border-miku/30 hover:text-miku active:scale-95 disabled:opacity-50"
                    >
                        {playing ? t("page.profileCard.workshop.pause") : t("page.profileCard.workshop.play")}
                    </button>
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={status.kind !== "ready" || exporting}
                        className="rounded-xl bg-gradient-to-r from-miku to-miku-dark px-4 py-2 text-sm font-black text-white shadow-lg shadow-miku/20 transition active:scale-95 disabled:opacity-50"
                    >
                        {exporting ? t("page.profileCard.workshop.exporting") : t("page.profileCard.workshop.exportPng")}
                    </button>
                </div>
            </div>
        </div>
    );
}
