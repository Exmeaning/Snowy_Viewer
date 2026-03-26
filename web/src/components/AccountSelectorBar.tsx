"use client";

import React, { useState, useCallback } from "react";
import AccountAvatar from "@/components/AccountAvatar";
import ExternalLink from "@/components/ExternalLink";
import {
    verifyHarukiApi,
    createAccount,
    getTopCharacterId,
    SERVER_OPTIONS,
    SERVER_LABELS,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";
import { startOAuthConnect } from "@/lib/oauth";

interface AccountSelectorBarProps {
    accounts: MoesekaiAccount[];
    activeAccount: MoesekaiAccount | null;
    onSelect: (acc: MoesekaiAccount) => void;
    onAccountAdded: () => void;
    returnTo?: string;
}

export default function AccountSelectorBar({
    accounts,
    activeAccount,
    onSelect,
    onAccountAdded,
    returnTo = "/profile",
}: AccountSelectorBarProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [gameId, setGameId] = useState("");
    const [server, setServer] = useState<ServerType>("jp");
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [oauthError, setOauthError] = useState<string | null>(null);

    const handleAdd = useCallback(async () => {
        if (!gameId.trim()) return;
        setIsVerifying(true);
        setError(null);
        setOauthError(null);

        const result = await verifyHarukiApi(server, gameId.trim());
        if (!result.success) {
            setError(
                result.error === "API_NOT_PUBLIC"
                    ? "公开API未开启"
                    : result.error === "NOT_FOUND"
                        ? "用户未找到"
                        : "网络错误"
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
        setShowAddForm(false);
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
        <div className="mb-6">
            <div className="glass-card p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600">选择账号</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => void handleOAuthBind()}
                            className="text-xs font-medium text-miku hover:text-miku-dark transition-colors"
                        >
                            OAuth2 绑定
                        </button>
                        <button
                            onClick={() => { setShowAddForm(!showAddForm); setError(null); setOauthError(null); }}
                            className="text-xs font-medium text-miku hover:text-miku-dark transition-colors flex items-center gap-0.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            添加账号
                        </button>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {accounts.map((acc) => {
                        const isActive = activeAccount?.id === acc.id;
                        const displayName = acc.userGamedata?.name || acc.nickname;
                        return (
                            <button
                                key={acc.id}
                                onClick={() => onSelect(acc)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${isActive
                                    ? "bg-miku/10 border-miku/40 text-miku shadow-sm"
                                    : "bg-white/60 border-slate-200/60 text-slate-600 hover:border-miku/30 hover:bg-miku/5"
                                    }`}
                            >
                                <AccountAvatar account={acc} size="sm" />
                                {displayName && (
                                    <span className="font-bold truncate max-w-[80px]">{displayName}</span>
                                )}
                                <span className="font-mono">{acc.gameId}</span>
                                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${isActive ? "bg-miku/20 text-miku" : "bg-slate-100 text-slate-500"}`}>
                                    {SERVER_LABELS[acc.server]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Inline Add Form */}
                {showAddForm && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">UID</label>
                                <input
                                    type="text"
                                    value={gameId}
                                    onChange={(e) => setGameId(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                    placeholder="输入游戏UID"
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-xs"
                                    disabled={isVerifying}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1">服务器</label>
                                <div className="flex gap-1">
                                    {SERVER_OPTIONS.map((s) => (
                                        <button
                                            key={s.value}
                                            onClick={() => setServer(s.value)}
                                            disabled={isVerifying}
                                            className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${server === s.value
                                                ? "bg-miku text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={!gameId.trim() || isVerifying}
                                className="px-4 py-1.5 bg-gradient-to-r from-miku to-miku-dark text-white rounded-lg font-bold text-xs shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isVerifying ? (
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isVerifying ? "验证中" : "添加"}
                            </button>
                            <button
                                onClick={() => { setShowAddForm(false); setError(null); }}
                                disabled={isVerifying}
                                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                        </div>
                        {(error || oauthError) && (
                            <p className="mt-2 text-[11px] text-red-500 flex items-center gap-1 flex-wrap">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                </svg>
                                {error || oauthError}
                                <ExternalLink href="https://haruki.seiunx.com" className="text-miku hover:underline ml-1">
                                    前往 Haruki →
                                </ExternalLink>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
