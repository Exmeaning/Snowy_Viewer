"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { createOrUpdateOAuthAccount, fetchOAuthBindingInitialData } from "@/lib/account";
import {
    clearPendingOAuthState,
    formatOAuthErrorMessage,
    getOAuthReturnTo,
    normalizeBindingGameId,
    normalizeBindingServer,
    resolveOAuthAuthorization,
    type OAuthAuthorizationPhase,
    type OAuthBinding,
} from "@/lib/oauth";

type CallbackPhase = OAuthAuthorizationPhase | "loading_initial_data" | "saving_account" | "redirecting" | "selecting_binding";

function getPhaseMessage(phase: CallbackPhase): string {
    switch (phase) {
        case "validating_state":
            return "正在校验授权状态…";
        case "exchanging_token":
            return "正在交换授权令牌…";
        case "loading_profile":
            return "正在读取授权用户信息…";
        case "loading_bindings":
            return "正在读取已绑定游戏账号…";
        case "loading_initial_data":
            return "正在同步基础游戏数据…";
        case "saving_account":
            return "正在保存授权账号…";
        case "redirecting":
            return "正在跳转回来源页面…";
        case "selecting_binding":
            return "检测到多个可用绑定，请选择要接入的账号。";
        default:
            return "正在完成授权与账号同步…";
    }
}

function buildSuccessReturnUrl(returnTo: string, accountId: string): string {
    const fallbackPath = "/profile";
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : fallbackPath;
    if (typeof window === "undefined") {
        return `${safeReturnTo}${safeReturnTo.includes("?") ? "&" : "?"}oauth=success&account=${encodeURIComponent(accountId)}`;
    }

    const url = new URL(safeReturnTo, window.location.origin);
    url.searchParams.set("oauth", "success");
    url.searchParams.set("account", accountId);
    return url.toString();
}

export default function CallbackClient() {
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
            setError(formatOAuthErrorMessage(oauthError));
            setLoading(false);
            return;
        }
        if (!code || !state) {
            clearPendingOAuthState(state);
            setError(formatOAuthErrorMessage("OAuth2 回调参数不完整"));
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
                    setError("当前授权未返回任何可用绑定，请确认 Haruki 账号已绑定并验证对应游戏账号。");
                    setLoading(false);
                }
            } catch (err) {
                clearPendingOAuthState(state);
                console.error("[OAuth2] callback resolve failed", err);
                if (!cancelled) {
                    setError(formatOAuthErrorMessage(err instanceof Error ? err.message : "OAuth2 处理失败"));
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
            setError("无法从 OAuth2 绑定中解析服务器或 UID");
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
            setError(formatOAuthErrorMessage(err instanceof Error ? err.message : "同步授权账号数据失败"));
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
                <div className="glass-card p-6 sm:p-8 rounded-2xl">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">OAuth2 Callback</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary-text mb-3">Haruki 授权处理中</h1>
                    {loading ? (
                        <div className="space-y-2 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-miku/20 border-t-miku rounded-full animate-spin" />
                                <span>{getPhaseMessage(phase)}</span>
                            </div>
                            <p className="text-xs text-slate-400">当前阶段：{phase}</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                            <p className="text-sm font-bold text-red-600">授权绑定失败</p>
                            <p className="text-xs text-red-500 mt-1 break-all">{error}</p>
                            <p className="text-[11px] text-red-400 mt-2">失败阶段：{phase}</p>
                            <button
                                onClick={() => router.replace(returnTo)}
                                className="mt-4 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
                            >
                                返回来源页面
                            </button>
                        </div>
                    ) : bindings.length > 1 ? (
                        <div>
                            <p className="text-sm text-slate-500 mb-4">检测到多个可用绑定，请选择要接入 Moesekai 的账号。</p>
                            <div className="space-y-3">
                                {bindings.map((binding, index) => {
                                    const server = normalizeBindingServer(binding) || "未知服";
                                    const gameId = normalizeBindingGameId(binding) || "未知 UID";
                                    return (
                                        <button
                                            key={`${binding.bindingId ?? binding.id ?? index}`}
                                            onClick={() => void handleBinding(binding)}
                                            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-miku/40 hover:bg-miku/5 transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-bold text-primary-text">{gameId}</p>
                                                    <p className="text-xs text-slate-500 mt-1">服务器：{server}</p>
                                                </div>
                                                <span className="text-xs font-bold text-miku">接入 →</span>
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
