"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { localizePathForBrowser } from "@/lib/localized-path";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { createOrUpdateOAuthAccount, fetchOAuthBindingInitialData } from "@/lib/account";
import {
    clearPendingOAuthState,
    formatOAuthErrorMessage,
    getOAuthReturnTo,
    normalizeBindingGameId,
    normalizeBindingServer,
    resolveOAuthAuthorization,
    sanitizeOAuthReturnTo,
    type OAuthAuthorizationPhase,
    type OAuthBinding,
} from "@/lib/oauth";

type CallbackPhase = OAuthAuthorizationPhase | "loading_initial_data" | "saving_account" | "redirecting" | "selecting_binding";

function getPhaseMessage(phase: CallbackPhase, t: (key: string) => string): string {
    switch (phase) {
        case "validating_state":
            return t("page.oauth2.callback.phases.validatingState");
        case "exchanging_token":
            return t("page.oauth2.callback.phases.exchangingToken");
        case "loading_profile":
            return t("page.oauth2.callback.phases.loadingProfile");
        case "loading_bindings":
            return t("page.oauth2.callback.phases.loadingBindings");
        case "loading_initial_data":
            return t("page.oauth2.callback.phases.loadingInitialData");
        case "saving_account":
            return t("page.oauth2.callback.phases.savingAccount");
        case "redirecting":
            return t("page.oauth2.callback.phases.redirecting");
        case "selecting_binding":
            return t("page.oauth2.callback.phases.selectingBinding");
        default:
            return t("page.oauth2.callback.defaultPhase");
    }
}

function buildSuccessReturnUrl(returnTo: string, accountId: string): string {
    const safeReturnTo = sanitizeOAuthReturnTo(returnTo);
    if (typeof window === "undefined") {
        return `${safeReturnTo}${safeReturnTo.includes("?") ? "&" : "?"}oauth=success&account=${encodeURIComponent(accountId)}`;
    }

    const url = new URL(localizePathForBrowser(safeReturnTo), window.location.origin);
    url.searchParams.set("oauth", "success");
    url.searchParams.set("account", accountId);
    return url.toString();
}

export default function CallbackClient() {
    const { t } = useI18n();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState<CallbackPhase>("validating_state");
    const [bindings, setBindings] = useState<OAuthBinding[]>([]);
    const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolveOAuthAuthorization>> | null>(null);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const returnTo = useMemo(() => getOAuthReturnTo(state), [state]);

    useEffect(() => {
        let cancelled = false;
        if (oauthError) {
            clearPendingOAuthState(state);
            setError(oauthError);
            setLoading(false);
            return;
        }
        if (!code || !state) {
            clearPendingOAuthState(state);
            setError("OAUTH_CALLBACK_PARAMS_MISSING");
            setLoading(false);
            return;
        }

        void (async () => {
            try {
                const result = await resolveOAuthAuthorization(code, state, (nextPhase) => {
                    if (!cancelled) setPhase(nextPhase);
                });
                if (cancelled) return;
                setResolved(result);
                setBindings(result.bindings);
                if (result.bindings.length === 1) {
                    await handleBinding(result.bindings[0]!, result);
                } else if (result.bindings.length > 1) {
                    setPhase("selecting_binding");
                    setLoading(false);
                } else {
                    clearPendingOAuthState(state);
                    setError("OAUTH_NO_BINDINGS");
                    setLoading(false);
                }
            } catch (err) {
                clearPendingOAuthState(state);
                console.error("[OAuth2] callback resolve failed", err);
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "OAUTH_PROCESS_FAILED");
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, state, oauthError]);

    const handleBinding = async (
        binding: OAuthBinding,
        source = resolved,
    ) => {
        if (!source) return;
        const server = normalizeBindingServer(binding);
        const gameId = normalizeBindingGameId(binding);
        if (!server || !gameId) {
            setError("OAUTH_BINDING_PARSE_FAILED");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setPhase("loading_initial_data");
        try {
            const initialData = await fetchOAuthBindingInitialData(source.tokenSet.accessToken, server, gameId);
            setPhase("saving_account");
            const account = createOrUpdateOAuthAccount({
                binding,
                profile: source.profile,
                tokenSet: source.tokenSet,
                initialData,
            });
            const redirectUrl = buildSuccessReturnUrl(returnTo, account.id);
            clearPendingOAuthState(state);
            setPhase("redirecting");
            console.info("[OAuth2] redirecting to", redirectUrl);
            window.location.replace(redirectUrl);
        } catch (err) {
            clearPendingOAuthState(state);
            console.error("[OAuth2] save account failed", err);
            setError(err instanceof Error ? err.message : "OAUTH_SYNC_ACCOUNT_FAILED");
            setLoading(false);
        }
    };

    const errorMessage = error ? formatOAuthErrorMessage(error, t) : null;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
                <div className="glass-card p-6 sm:p-8 rounded-2xl">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.oauth2.callback.badge")}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary-text mb-3">{t("page.oauth2.callback.title")}</h1>
                    {loading ? (
                        <div className="space-y-2 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-miku/20 border-t-miku rounded-full animate-spin" />
                                <span>{getPhaseMessage(phase, t)}</span>
                            </div>
                            <p className="text-xs text-slate-400">{t("page.oauth2.callback.currentPhase", { phase })}</p>
                        </div>
                    ) : errorMessage ? (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                            <p className="text-sm font-bold text-red-600">{t("page.oauth2.callback.failureTitle")}</p>
                            <p className="text-xs text-red-500 mt-1 break-all">{errorMessage}</p>
                            <p className="text-[11px] text-red-400 mt-2">{t("page.oauth2.callback.failedPhase", { phase })}</p>
                            <button
                                onClick={() => router.replace(localizePathForBrowser(returnTo))}
                                className="mt-4 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
                            >
                                {t("page.oauth2.callback.returnSource")}
                            </button>
                        </div>
                    ) : bindings.length > 1 ? (
                        <div>
                            <p className="text-sm text-slate-500 mb-4">{t("page.oauth2.callback.selectBindingDescription")}</p>
                            <div className="space-y-3">
                                {bindings.map((binding, index) => {
                                    const server = normalizeBindingServer(binding) || t("page.oauth2.callback.unknownServer");
                                    const gameId = normalizeBindingGameId(binding) || t("page.oauth2.callback.unknownUid");
                                    return (
                                        <button
                                            key={`${binding.bindingId ?? binding.id ?? index}`}
                                            onClick={() => void handleBinding(binding)}
                                            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-miku/40 hover:bg-miku/5 transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-bold text-primary-text">{gameId}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{t("page.oauth2.callback.serverLabel", { server })}</p>
                                                </div>
                                                <span className="text-xs font-bold text-miku">{t("page.oauth2.callback.selectAction")}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </MainLayout>
    );
}
