"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import AccountSelector from "@/components/AccountSelector";
import MainLayout from "@/components/MainLayout";
import MysekaiScenePreview from "@/components/mysekai-preview/MysekaiScenePreview";
import { replaceAssetSourceRegion, type AssetSourceType, useTheme } from "@/contexts/ThemeContext";
import type { ServerType } from "@/lib/account";
import { type BaijingServer, getUserMysekaiRoomUrl } from "@/lib/mysekai-preview/baijing";
import type { MysekaiLayoutPayload } from "@/lib/mysekai-preview/types";

const TURNSTILE_SITE_KEY = "0x4AAAAAADSarNCgQKaLAJ6Y";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type EntryMode = "uid" | "json";
type JsonSourceMode = "file" | "url";

type PreviewState =
    | {
        kind: "uid";
        server: BaijingServer;
        uid: string;
        layoutData: MysekaiLayoutPayload;
        layoutKey: string;
    }
    | {
        kind: "json";
        sourceType: JsonSourceMode;
        sourceLabel: string;
        sourceUrl?: string;
        layoutData: MysekaiLayoutPayload;
        layoutKey: string;
    };

interface TurnstileRenderOptions {
    sitekey: string;
    callback?: (token: string) => void;
    "error-callback"?: () => void;
    "expired-callback"?: () => void;
    theme?: "light" | "dark" | "auto";
    size?: "normal" | "compact" | "flexible";
}

interface TurnstileApi {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
    reset: (widgetId?: string) => void;
    remove?: (widgetId?: string) => void;
    getResponse: (widgetId?: string) => string;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
        __mysekaiTurnstileLoaded?: () => void;
    }
}

const JSON_SOURCE_OPTIONS: Array<{ value: JsonSourceMode; label: string; desc: string }> = [
    { value: "file", label: "选择文件", desc: "从本地选择布局 JSON" },
    { value: "url", label: "填写 URL", desc: "输入布局 JSON 地址" },
];

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function responseErrorDetail(data: unknown) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return "";
    const detail = (data as { message?: unknown; error?: unknown }).message ?? (data as { message?: unknown; error?: unknown }).error;
    return typeof detail === "string" ? detail : "";
}

function jsonLoadErrorMessage(error: unknown) {
    const message = errorMessage(error);
    if (message === "Failed to fetch" || message.includes("NetworkError") || message.includes("Load failed")) {
        return "浏览器无法直接读取该 URL（可能是 CORS 或网络限制），请下载 JSON 后改用文件模式";
    }
    return message;
}

function normalizeUid(value: string) {
    return value.replace(/\s+/g, "").trim();
}

function normalizeHttpUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("请输入布局 JSON URL");
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw new Error("请输入完整的 http(s) JSON URL，或选择本地 JSON 文件");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("布局 JSON URL 仅支持 http(s) 地址");
    }
    return url.toString();
}

function parseLayoutJsonText(text: string, label: string) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error(`${label} 没有可读取的 JSON 内容`);
    try {
        return JSON.parse(trimmed) as MysekaiLayoutPayload;
    } catch {
        throw new Error(`${label} 不是有效的 JSON`);
    }
}

async function fetchLayoutPayloadFromUrl(url: string) {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText || "布局 JSON 读取失败"}`);
    }
    return parseLayoutJsonText(text, url);
}

function isValidRoomPayload(payload: MysekaiLayoutPayload) {
    if (Array.isArray(payload)) return true;
    if (!payload || typeof payload !== "object") return false;
    if ("room" in payload) return Boolean(payload.room);
    return "userMysekaiSiteHousingLayouts" in payload || "mysekaiRank" in payload;
}

function getInitialAssetSource(assetSource: AssetSourceType, server: BaijingServer) {
    return replaceAssetSourceRegion(assetSource, server);
}

function TurnstileBox({ onToken, resetSeed }: { onToken: (token: string) => void; resetSeed: number }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
    const [message, setMessage] = useState("正在加载 Cloudflare 验证…");

    useEffect(() => {
        if (window.turnstile) return;

        window.__mysekaiTurnstileLoaded = () => setScriptReady(true);
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener("load", () => setScriptReady(true), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = `${TURNSTILE_SCRIPT_SRC}&onload=__mysekaiTurnstileLoaded`;
        script.async = true;
        script.defer = true;
        script.onerror = () => setMessage("Cloudflare 验证脚本加载失败，请检查网络后刷新页面");
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!scriptReady || !hostRef.current || !window.turnstile) return;
        if (widgetIdRef.current) return;

        widgetIdRef.current = window.turnstile.render(hostRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: "light",
            size: "normal",
            callback: (token) => {
                setMessage("验证完成，可以查询 UID 啦");
                onToken(token);
            },
            "expired-callback": () => {
                setMessage("验证已过期，请重新完成人机验证");
                onToken("");
            },
            "error-callback": () => {
                setMessage("验证失败，请重新尝试");
                onToken("");
            },
        });

        return () => {
            if (widgetIdRef.current) {
                window.turnstile?.remove?.(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [onToken, scriptReady]);

    useEffect(() => {
        if (!resetSeed || !widgetIdRef.current) return;
        window.turnstile?.reset(widgetIdRef.current);
        onToken("");
    }, [onToken, resetSeed]);

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Cloudflare Turnstile</div>
                    <div className="mt-1 text-sm font-bold text-slate-600">{message}</div>
                </div>
                <div ref={hostRef} className="min-h-[65px] min-w-[300px] overflow-hidden rounded-xl" />
            </div>
        </div>
    );
}

function ModeTabs({ mode, onChange }: { mode: EntryMode; onChange: (mode: EntryMode) => void }) {
    const options: Array<{ value: EntryMode; label: string; desc: string }> = [
        { value: "uid", label: "UID 查询", desc: "输入 JP / CN UID 自动读取烤森布局" },
        { value: "json", label: "布局 JSON", desc: "选择本地文件或直接读取 JSON URL" },
    ];

    return (
        <div className="flex flex-wrap justify-center gap-2">
            {options.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    onClick={() => onChange(item.value)}
                    className={`rounded-2xl px-5 py-3 text-sm font-black transition active:scale-95 ${mode === item.value
                        ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                        : "border border-slate-200 bg-white/75 text-slate-500 hover:border-miku/30 hover:text-miku"
                        }`}
                    title={item.desc}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export default function MysekaiPreviewSceneClient() {
    const { assetSource } = useTheme();
    const [mode, setMode] = useState<EntryMode>("uid");
    const [server, setServer] = useState<BaijingServer>("jp");
    const [uid, setUid] = useState("");
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileResetSeed, setTurnstileResetSeed] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [jsonSourceMode, setJsonSourceMode] = useState<JsonSourceMode>("file");
    const [layoutFile, setLayoutFile] = useState<File | null>(null);
    const [customLayoutUrl, setCustomLayoutUrl] = useState("");
    const [previewState, setPreviewState] = useState<PreviewState | null>(null);

    const previewAssetSource = useMemo<AssetSourceType>(() => {
        if (previewState?.kind === "uid") return getInitialAssetSource(assetSource, previewState.server);
        return assetSource;
    }, [assetSource, previewState]);

    const handleUidSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const normalizedUid = normalizeUid(uid);
        if (!/^\d+$/.test(normalizedUid)) {
            setError("请输入正确的数字 UID");
            return;
        }
        if (!turnstileToken) {
            setError("请先完成 Cloudflare 验证");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const roomUrl = getUserMysekaiRoomUrl(server, normalizedUid);
            const response = await fetch(`${roomUrl}?_ts=${Date.now()}`, {
                cache: "no-store",
                headers: {
                    "CF-Turnstile-Response": turnstileToken,
                    "X-CF-Turnstile-Response": turnstileToken,
                    "X-Turnstile-Token": turnstileToken,
                    "x-moe-sekai-token": turnstileToken,
                },
            });
            const data = await response.json().catch(() => null) as MysekaiLayoutPayload | { message?: string; error?: string; status?: number } | null;
            if (!response.ok) {
                const detail = responseErrorDetail(data);
                throw new Error(detail ? `${response.status} ${detail}` : `${response.status} ${response.statusText}`);
            }
            if (!data || !isValidRoomPayload(data as MysekaiLayoutPayload)) {
                throw new Error("接口未返回可用的 room 布局数据");
            }
            setUid(normalizedUid);
            setPreviewState({
                kind: "uid",
                server,
                uid: normalizedUid,
                layoutData: data as MysekaiLayoutPayload,
                layoutKey: `${server}-${normalizedUid}-${Date.now()}`,
            });
        } catch (submitError) {
            setError(errorMessage(submitError));
            setTurnstileResetSeed((current) => current + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleLayoutFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        setLayoutFile(file);
        if (file) {
            setJsonSourceMode("file");
            setError(null);
        }
    };

    const handleJsonSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let data: MysekaiLayoutPayload;
            let sourceLabel: string;
            let sourceUrl: string | undefined;
            let layoutKey: string;

            if (jsonSourceMode === "file") {
                if (!layoutFile) throw new Error("请选择布局 JSON 文件");
                data = parseLayoutJsonText(await layoutFile.text(), layoutFile.name);
                sourceLabel = layoutFile.name;
                layoutKey = `file-${layoutFile.name}-${layoutFile.size}-${layoutFile.lastModified}-${Date.now()}`;
            } else {
                const nextUrl = normalizeHttpUrl(customLayoutUrl);
                data = await fetchLayoutPayloadFromUrl(nextUrl);
                sourceLabel = nextUrl;
                sourceUrl = nextUrl;
                layoutKey = `url-${nextUrl}-${Date.now()}`;
            }

            if (!isValidRoomPayload(data)) {
                throw new Error("JSON 中没有找到可用的 room / layout 布局数据");
            }

            setPreviewState({
                kind: "json",
                sourceType: jsonSourceMode,
                sourceLabel,
                sourceUrl,
                layoutData: data,
                layoutKey,
            });
        } catch (submitError) {
            setError(jsonSourceMode === "url" ? jsonLoadErrorMessage(submitError) : errorMessage(submitError));
        } finally {
            setLoading(false);
        }
    };

    if (previewState) {
        const isUidPreview = previewState.kind === "uid";
        const title = isUidPreview ? `UID ${previewState.uid}` : "自定义布局";
        const badge = isUidPreview ? `${previewState.server.toUpperCase()} UID` : previewState.sourceType === "file" ? "JSON 文件" : "JSON URL";
        const sourceLabel = isUidPreview ? `${previewState.server.toUpperCase()} · UID ${previewState.uid}` : previewState.sourceLabel;
        const layoutSource = isUidPreview ? getUserMysekaiRoomUrl(previewState.server, previewState.uid) : previewState.sourceUrl ?? `browser-file:${previewState.sourceLabel}`;
        const headerNote = isUidPreview ? "已通过 UID 查询获取布局，资源路径按当前区服自动匹配。" : "自定义布局 JSON 预览。";

        return (
            <MainLayout>
                <div className="container mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setPreviewState(null)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-4 py-2 text-sm font-black text-slate-500 shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:border-miku/30 hover:text-miku active:scale-95"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
                            </svg>
                            返回查询入口
                        </button>
                        <div className="max-w-full truncate rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-black text-slate-500 shadow-sm backdrop-blur">
                            {sourceLabel}
                        </div>
                    </div>

                    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/65 p-4 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-5">
                        <MysekaiScenePreview
                            key={previewState.layoutKey}
                            defaultLayoutUrl={layoutSource}
                            layoutData={previewState.layoutData}
                            layoutKey={previewState.layoutKey}
                            assetSourceOverride={previewAssetSource}
                            persistOptionsEnabled={false}
                            showLayoutUrlInput={false}
                            headerTitle={title}
                            headerBadge={badge}
                            headerNote={headerNote}
                            heightClassName="h-[min(76vh,760px)] min-h-[560px]"
                            compact
                        />
                    </section>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-miku/30 bg-miku/5 px-4 py-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-miku">MySekai Scene Preview</span>
                    </div>
                    <h1 className="text-3xl font-black text-primary-text sm:text-4xl">
                        烤森 <span className="text-miku">3D 预览器</span>
                    </h1>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                        输入 JP / CN UID 查询 MySekai 房间布局，或在浏览器端选择布局 JSON 文件 / URL 后再进入 3D 预览。默认不会自动加载预览，减少资源消耗。
                    </p>
                </div>

                <ModeTabs mode={mode} onChange={(nextMode) => { setMode(nextMode); setError(null); }} />

                {error && (
                    <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-bold text-red-600 shadow-sm">
                        {error}
                    </div>
                )}

                {mode === "uid" ? (
                    <form onSubmit={handleUidSubmit} className="mx-auto mt-6 max-w-3xl rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-6">
                        <div className="mb-5">
                            <h2 className="text-lg font-black text-primary-text">UID 查询入口</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500">可以手动输入 UID，也可以点击 /profile 已保存账号快速填入。</p>
                        </div>

                        <AccountSelector
                            allowedServers={["jp", "cn"]}
                            currentUserId={uid}
                            currentServer={server as ServerType}
                            onSelect={(gameId, accountServer) => {
                                if (accountServer !== "jp" && accountServer !== "cn") return;
                                setUid(gameId);
                                setServer(accountServer);
                                setError(null);
                            }}
                        />

                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-600">UID</span>
                                <input
                                    value={uid}
                                    onChange={(event) => setUid(event.target.value)}
                                    inputMode="numeric"
                                    placeholder="输入游戏 UID"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-miku focus:ring-2 focus:ring-miku/20"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-600">服务器</span>
                                <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                    {(["jp", "cn"] as BaijingServer[]).map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setServer(item)}
                                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-black transition active:scale-95 ${server === item ? "bg-miku text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}
                                        >
                                            {item.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </label>
                        </div>

                        <div className="mt-5">
                            <TurnstileBox onToken={setTurnstileToken} resetSeed={turnstileResetSeed} />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !normalizeUid(uid) || !turnstileToken}
                            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-miku to-miku-dark px-5 py-3 text-sm font-black text-white shadow-lg shadow-miku/20 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                        >
                            {loading ? "查询布局中…" : "查询并进入预览"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleJsonSubmit} className="mx-auto mt-6 max-w-3xl rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-6">
                        <div className="mb-5">
                            <h2 className="text-lg font-black text-primary-text">布局 JSON</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                选择本地 JSON 文件，或输入公开 JSON URL。
                            </p>
                        </div>

                        <div className="mb-4 grid gap-2 sm:grid-cols-2">
                            {JSON_SOURCE_OPTIONS.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => {
                                        setJsonSourceMode(item.value);
                                        setError(null);
                                    }}
                                    className={`rounded-2xl px-4 py-3 text-left transition active:scale-[0.99] ${jsonSourceMode === item.value
                                        ? "border border-miku/30 bg-miku/10 text-miku shadow-sm"
                                        : "border border-slate-200 bg-white/75 text-slate-500 hover:border-miku/25 hover:text-miku"
                                        }`}
                                >
                                    <div className="text-sm font-black">{item.label}</div>
                                    <div className="mt-1 text-xs font-medium leading-relaxed opacity-75">{item.desc}</div>
                                </button>
                            ))}
                        </div>

                        {jsonSourceMode === "file" ? (
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-600">本地 JSON 文件</span>
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={handleLayoutFileChange}
                                    className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-miku/10 file:px-4 file:py-2 file:text-sm file:font-black file:text-miku hover:border-miku/30 focus:border-miku focus:ring-2 focus:ring-miku/20"
                                />
                                {layoutFile && (
                                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                        已选择：{layoutFile.name}（{Math.max(1, Math.round(layoutFile.size / 1024))} KB）
                                    </p>
                                )}
                            </label>
                        ) : (
                            <label className="block">
                                <span className="mb-1 block text-sm font-bold text-slate-600">布局 JSON URL</span>
                                <input
                                    value={customLayoutUrl}
                                    onChange={(event) => setCustomLayoutUrl(event.target.value)}
                                    placeholder="https://example.com/mysekai-room.json"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-miku focus:ring-2 focus:ring-miku/20"
                                />
                                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                    如果 URL 读取失败，请下载 JSON 后改用文件模式。
                                </p>
                            </label>
                        )}

                        <button
                            type="submit"
                            disabled={loading || (jsonSourceMode === "file" ? !layoutFile : !customLayoutUrl.trim())}
                            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-miku to-miku-dark px-5 py-3 text-sm font-black text-white shadow-lg shadow-miku/20 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                        >
                            {loading ? "读取布局中…" : "读取并进入预览"}
                        </button>
                    </form>
                )}
            </div>
        </MainLayout>
    );
}
