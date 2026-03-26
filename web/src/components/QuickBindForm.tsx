"use client";

import React, { useState, useCallback } from "react";
import ExternalLink from "@/components/ExternalLink";
import {
    verifyHarukiApi,
    createAccount,
    getTopCharacterId,
    SERVER_OPTIONS,
    type ServerType,
} from "@/lib/account";
import { startOAuthConnect } from "@/lib/oauth";

interface QuickBindFormProps {
    onAccountAdded: () => void;
    /** 自定义图标 */
    icon?: React.ReactNode;
    /** 自定义描述文字 */
    description?: string;
    /** OAuth 成功后的回跳页面 */
    returnTo?: string;
}

const DefaultIcon = () => (
    <svg className="w-8 h-8 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

export default function QuickBindForm({
    onAccountAdded,
    icon,
    description = "输入游戏UID即可开始使用",
    returnTo = "/profile",
}: QuickBindFormProps) {
    const [gameId, setGameId] = useState("");
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [server, setServer] = useState<ServerType>("jp");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async () => {
        if (!gameId.trim()) return;
        setIsVerifying(true);
        setError(null);
        setOauthError(null);

        const result = await verifyHarukiApi(server, gameId.trim());
        if (!result.success) {
            setError(
                result.error === "API_NOT_PUBLIC"
                    ? "该用户的公开API未开启，请先前往 Haruki 工具箱勾选「公开API访问」"
                    : result.error === "NOT_FOUND"
                        ? "用户数据未找到，请确认UID和服务器是否正确，并已在 Haruki 上传数据"
                        : "网络错误，请稍后重试"
            );
            setIsVerifying(false);
            return;
        }

        const chars = result.userCharacters || [];
        const topCharId = getTopCharacterId(chars);
        const nickname = result.userGamedata?.name || "";
        createAccount(gameId.trim(), server, nickname, topCharId, chars, true);

        setGameId("");
        setIsVerifying(false);
        setError(null);
        onAccountAdded();
    }, [gameId, server, onAccountAdded]);

    const handleOAuthBind = useCallback(async () => {
        try {
            setOauthError(null);
            await startOAuthConnect(returnTo);
        } catch (err) {
            setOauthError(err instanceof Error ? err.message : "OAuth2 授权初始化失败");
        }
    }, [returnTo]);

    return (
        <div className="glass-card p-6 sm:p-8 rounded-2xl">
            <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-miku/10 flex items-center justify-center">
                    {icon || <DefaultIcon />}
                </div>
                <h2 className="text-lg font-bold text-primary-text mb-1">快速绑定账号</h2>
                <p className="text-xs text-slate-400">{description}</p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        游戏UID <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={gameId}
                        onChange={(e) => setGameId(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        placeholder="输入游戏UID"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                        disabled={isVerifying}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">服务器</label>
                    <div className="flex gap-2">
                        {SERVER_OPTIONS.map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setServer(s.value)}
                                disabled={isVerifying}
                                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${server === s.value
                                    ? "bg-miku text-white shadow-md shadow-miku/20"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {(error || oauthError) && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200/50">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-xs font-medium text-red-700">{error || oauthError}</p>
                                <ExternalLink href="https://haruki.seiunx.com" className="text-xs text-miku hover:underline mt-1 inline-block">
                                    前往 Haruki 工具箱 →
                                </ExternalLink>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!gameId.trim() || isVerifying}
                        className="w-full px-6 py-3 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold text-sm shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isVerifying ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                验证中...
                            </>
                        ) : (
                            "验证并绑定"
                        )}
                    </button>
                    <button
                        onClick={() => void handleOAuthBind()}
                        disabled={isVerifying}
                        className="w-full px-6 py-3 border border-miku/30 text-miku rounded-xl font-bold text-sm hover:bg-miku/5 transition-all disabled:opacity-50"
                    >
                        OAuth2 授权绑定
                    </button>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                    手动 UID 绑定需要先在{" "}
                    <ExternalLink href="https://haruki.seiunx.com" className="text-miku hover:underline">
                        Haruki 工具箱
                    </ExternalLink>
                    {" "}上传数据并开启公开 API；OAuth2 授权绑定则不依赖公开 API 开启。
                </p>
            </div>
        </div>
    );
}
