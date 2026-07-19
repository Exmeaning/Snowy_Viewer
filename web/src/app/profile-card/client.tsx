"use client";

// Profile Card Workshop — renders Project SEKAI custom profile cards.
// Rendering by the open-source allium-renderer (sekai-custom-profile-sdk)
// by empty-sekai: https://github.com/empty-sekai/allium-renderer

import dynamic from "next/dynamic";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";

import MainLayout from "@/components/MainLayout";
import type { WorkshopFont } from "@/components/profile-card/ProfileCardWorkshop";
import { useI18n } from "@/contexts/I18nContext";
import {
    defaultFontFamilies,
    getProfileUrl,
    normalizeProfilePages,
    PROFILE_CARD_REPO_URL,
    PROFILE_CARD_SDK_NAME,
    PROFILE_CARD_SERVERS,
    type ProfileCardProfile,
    type ProfileCardServer,
} from "@/lib/profile-card/sdk";

const ProfileCardWorkshop = dynamic(
    () => import("@/components/profile-card/ProfileCardWorkshop"),
    { ssr: false },
);

const TURNSTILE_SITE_KEY = "0x4AAAAAADSarNCgQKaLAJ6Y";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

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
        __profileCardTurnstileLoaded?: () => void;
    }
}

interface PreviewState {
    server: ProfileCardServer;
    uid: string;
    profile: ProfileCardProfile;
    key: string;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function responseErrorDetail(data: unknown) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return "";
    const detail = (data as { message?: unknown; error?: unknown }).message ?? (data as { error?: unknown }).error;
    return typeof detail === "string" ? detail : "";
}

function TurnstileBox({ onToken, resetSeed }: { onToken: (token: string) => void; resetSeed: number }) {
    const { t } = useI18n();
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
    const [message, setMessage] = useState(() => t("page.profileCard.turnstile.loading"));

    useEffect(() => {
        if (window.turnstile) return;

        window.__profileCardTurnstileLoaded = () => setScriptReady(true);
        const existingScript = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SCRIPT_SRC}"]`);
        if (existingScript) {
            existingScript.addEventListener("load", () => setScriptReady(true), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = `${TURNSTILE_SCRIPT_SRC}&onload=__profileCardTurnstileLoaded`;
        script.async = true;
        script.defer = true;
        script.onerror = () => setMessage(t("page.profileCard.turnstile.scriptFailed"));
        document.head.appendChild(script);
    }, [t]);

    useEffect(() => {
        if (!scriptReady || !hostRef.current || !window.turnstile) return;
        if (widgetIdRef.current) return;

        widgetIdRef.current = window.turnstile.render(hostRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: "light",
            size: "normal",
            callback: (token) => {
                setMessage(t("page.profileCard.turnstile.completed"));
                onToken(token);
            },
            "expired-callback": () => {
                setMessage(t("page.profileCard.turnstile.expired"));
                onToken("");
            },
            "error-callback": () => {
                setMessage(t("page.profileCard.turnstile.failed"));
                onToken("");
            },
        });

        return () => {
            if (widgetIdRef.current) {
                window.turnstile?.remove?.(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [onToken, scriptReady, t]);

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

export default function ProfileCardClient() {
    const { t } = useI18n();
    const [server, setServer] = useState<ProfileCardServer>("cn");
    const [uid, setUid] = useState("");
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileResetSeed, setTurnstileResetSeed] = useState(0);
    const [fonts, setFonts] = useState<WorkshopFont[]>([]);
    const nextFontIdRef = useRef(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewState, setPreviewState] = useState<PreviewState | null>(null);

    const handleFontChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = [...(event.target.files ?? [])];
        event.target.value = "";
        if (files.length === 0) return;
        const loaded: WorkshopFont[] = [];
        for (const file of files) {
            loaded.push({
                id: nextFontIdRef.current++,
                name: file.name,
                bytes: await file.arrayBuffer(),
                families: defaultFontFamilies(file.name),
            });
        }
        setFonts((current) => [...current, ...loaded]);
        setError(null);
    };

    const handleFontRemove = (id: number) => {
        setFonts((current) => current.filter((font) => font.id !== id));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const normalizedUid = uid.replace(/\s+/g, "").trim();
        if (!/^\d+$/.test(normalizedUid)) {
            setError(t("page.profileCard.errors.invalidUid"));
            return;
        }
        if (fonts.length === 0) {
            setError(t("page.profileCard.errors.fontRequired"));
            return;
        }
        if (!turnstileToken) {
            setError(t("page.profileCard.errors.turnstileRequired"));
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${getProfileUrl(server, normalizedUid)}?_ts=${Date.now()}`, {
                cache: "no-store",
                headers: {
                    "CF-Turnstile-Response": turnstileToken,
                    "X-CF-Turnstile-Response": turnstileToken,
                    "X-Turnstile-Token": turnstileToken,
                    "x-moe-sekai-token": turnstileToken,
                },
            });
            const data = await response.json().catch(() => null) as ProfileCardProfile | null;
            if (!response.ok) {
                const detail = responseErrorDetail(data);
                throw new Error(detail ? `${response.status} ${detail}` : `${response.status} ${response.statusText}`);
            }
            if (!data || normalizeProfilePages(data).length === 0) {
                throw new Error(t("page.profileCard.errors.noCards"));
            }
            setUid(normalizedUid);
            setPreviewState({
                server,
                uid: normalizedUid,
                profile: data,
                key: `${server}-${normalizedUid}-${Date.now()}`,
            });
        } catch (submitError) {
            setError(errorMessage(submitError));
            setTurnstileResetSeed((current) => current + 1);
        } finally {
            setLoading(false);
        }
    };

    const attribution = (
        <p className="mt-8 text-center text-xs leading-6 text-slate-400">
            {t("page.profileCard.attribution.prefix")}{" "}
            <a
                href={PROFILE_CARD_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-miku underline decoration-miku/40 underline-offset-2 hover:text-miku-dark"
            >
                empty-sekai/allium-renderer
            </a>
            {" "}({PROFILE_CARD_SDK_NAME}) · AGPL-3.0
        </p>
    );

    if (previewState) {
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
                            {t("page.profileCard.workshop.backToEntry")}
                        </button>
                        <div className="max-w-full truncate rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-black text-slate-500 shadow-sm backdrop-blur">
                            {previewState.server.toUpperCase()} · UID {previewState.uid}
                        </div>
                    </div>

                    <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/65 p-4 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-5">
                        <ProfileCardWorkshop
                            key={previewState.key}
                            server={previewState.server}
                            profile={previewState.profile}
                            fonts={fonts}
                            exportFileName={`profile-card-${previewState.server}-${previewState.uid}`}
                        />
                    </section>
                    {attribution}
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-miku/30 bg-miku/5 px-4 py-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-miku">{t("page.profileCard.badge")}</span>
                    </div>
                    <h1 className="text-3xl font-black text-primary-text sm:text-4xl">
                        {t("page.profileCard.title")} <span className="text-miku">{t("page.profileCard.titleHighlight")}</span>
                    </h1>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
                        {t("page.profileCard.description")}
                    </p>
                </div>

                {error && (
                    <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm font-bold text-red-600 shadow-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-3xl space-y-5 rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-2xl shadow-slate-900/8 backdrop-blur-2xl sm:p-6">
                    <div>
                        <h2 className="text-lg font-black text-primary-text">{t("page.profileCard.form.title")}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{t("page.profileCard.form.description")}</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-600">UID</span>
                            <input
                                value={uid}
                                onChange={(event) => setUid(event.target.value)}
                                inputMode="numeric"
                                placeholder={t("page.profileCard.form.uidPlaceholder")}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-miku focus:ring-2 focus:ring-miku/20"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-sm font-bold text-slate-600">{t("page.profileCard.form.server")}</span>
                            <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {PROFILE_CARD_SERVERS.map((candidate) => (
                                    <button
                                        key={candidate}
                                        type="button"
                                        onClick={() => setServer(candidate)}
                                        className={`flex-1 rounded-lg px-2 py-2 text-sm font-black uppercase transition ${server === candidate
                                            ? "bg-white text-miku shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                            }`}
                                    >
                                        {candidate}
                                    </button>
                                ))}
                            </div>
                        </label>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-sm font-black text-slate-600">{t("page.profileCard.fonts.title")}</div>
                                <p className="mt-1 text-xs leading-5 text-slate-400">{t("page.profileCard.fonts.description")}</p>
                            </div>
                            <label className="cursor-pointer rounded-xl border border-miku/30 bg-white px-4 py-2 text-sm font-black text-miku transition hover:bg-miku/5 active:scale-95">
                                {t("page.profileCard.fonts.add")}
                                <input type="file" accept=".ttf,.otf" multiple className="hidden" onChange={handleFontChange} />
                            </label>
                        </div>
                        {fonts.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {fonts.map((font) => (
                                    <li key={font.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-bold text-slate-700">{font.name}</div>
                                            <div className="truncate text-xs text-slate-400">{font.families.join(" · ")}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleFontRemove(font.id)}
                                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-black text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <TurnstileBox onToken={setTurnstileToken} resetSeed={turnstileResetSeed} />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl bg-gradient-to-r from-miku to-miku-dark px-5 py-3 text-sm font-black text-white shadow-lg shadow-miku/20 transition active:scale-95 disabled:opacity-60"
                    >
                        {loading ? t("page.profileCard.form.loading") : t("page.profileCard.form.submit")}
                    </button>
                </form>
                {attribution}
            </div>
        </MainLayout>
    );
}
