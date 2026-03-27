"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import AccountAvatar from "@/components/AccountAvatar";
import CharacterRankRadar from "@/components/profile/CharacterRankRadar";
import ChallengeStageChart from "@/components/profile/ChallengeStageChart";
import BondsRankTable from "@/components/profile/BondsRankTable";
import PowerBonusDetail from "@/components/profile/PowerBonusDetail";
import {
    getAccounts,
    getActiveAccount,
    setActiveAccount,
    createAccount,
    removeAccount,
    updateAccount,
    clearAllAccounts,
    verifyHarukiApi,
    getTopCharacterId,
    getLeaderCardId,
    refreshOAuthAccountData,
    disconnectOAuthAccount,
    SERVER_LABELS,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";
import { startOAuthConnect } from "@/lib/oauth";

const SERVER_OPTIONS: { value: ServerType; label: string }[] = [
    { value: "cn", label: "简中服 (CN)" },
    { value: "jp", label: "日服 (JP)" },
    { value: "tw", label: "繁中服 (TW)" },
];

export default function ProfileClient() {
    const searchParams = useSearchParams();
    const oauthStatus = searchParams.get("oauth");
    const [accounts, setAccounts] = useState<MoesekaiAccount[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Add account form
    const [showAddForm, setShowAddForm] = useState(false);
    const [formGameId, setFormGameId] = useState("");
    const [formServer, setFormServer] = useState<ServerType>("jp");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [oauthMessage, setOauthMessage] = useState<string | null>(null);

    // Confirm clear
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const reload = useCallback(() => {
        const accs = getAccounts();
        setAccounts(accs);
        const active = getActiveAccount();
        setActiveId(active?.id || null);
    }, []);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            reload();
            setLoaded(true);
        });


        // 自动刷新所有账号的数据（uploadTime、名称、头像等）
        const refreshAllAccounts = async () => {
            const accs = getAccounts();
            for (const acc of accs) {
                console.log(`刷新账号数据: ${acc.gameId} (${acc.server})`);

                if (acc.authSource === "oauth2") {
                    try {
                        await refreshOAuthAccountData(acc.id);
                    } catch (error) {
                        console.warn(`OAuth2 账号 ${acc.gameId} 刷新失败，保留已有数据`, error);
                    }
                    continue;
                }

                const result = await verifyHarukiApi(acc.server, acc.gameId);

                if (!result.success) {
                    console.warn(`账号 ${acc.gameId} 刷新失败，保留已有数据`);
                } else {
                    const userGamedata = result.userGamedata || null;
                    const userDecks = result.userDecks || null;
                    const userCharacters = result.userCharacters || null;
                    const userChallengeLiveSoloStages = result.userChallengeLiveSoloStages || null;
                    const userChallengeLiveSoloResults = result.userChallengeLiveSoloResults || null;
                    const userChallengeLiveSoloHighScoreRewards = result.userChallengeLiveSoloHighScoreRewards || null;
                    const userBonds = result.userBonds || null;
                    const userMaterials = result.userMaterials || null;
                    const userAreas = result.userAreas || null;
                    const userMysekaiFixtureGameCharacterPerformanceBonuses = result.userMysekaiFixtureGameCharacterPerformanceBonuses || null;
                    const userMysekaiGates = result.userMysekaiGates || null;
                    const uploadTime = result.uploadTime || null;
                    const avatarCardId = getLeaderCardId(userGamedata, userDecks);

                    updateAccount(acc.id, {
                        userCharacters,
                        userChallengeLiveSoloStages,
                        userChallengeLiveSoloResults,
                        userChallengeLiveSoloHighScoreRewards,
                        userBonds,
                        userMaterials,
                        userAreas,
                        userMysekaiFixtureGameCharacterPerformanceBonuses,
                        userMysekaiGates,
                        userGamedata,
                        userDecks,
                        uploadTime,
                        avatarCardId,
                        avatarCharacterId: userCharacters && userCharacters.length > 0
                            ? getTopCharacterId(userCharacters)
                            : acc.avatarCharacterId,
                        nickname: userGamedata?.name || acc.nickname,
                    });
                }
            }
            // 刷新完成后重新加载
            reload();
        };

        refreshAllAccounts();
        return () => cancelAnimationFrame(raf);
    }, [reload, searchParams]);

    const handleAddAccount = useCallback(async () => {
        if (!formGameId.trim()) return;
        setIsVerifying(true);
        setVerifyError(null);

        const result = await verifyHarukiApi(formServer, formGameId.trim());

        if (!result.success) {
            if (result.error === "API_NOT_PUBLIC") {
                setVerifyError("该用户的公开API未开启，请先前往 Haruki 工具箱勾选「公开API访问」");
            } else if (result.error === "NOT_FOUND") {
                setVerifyError("用户数据未找到，请确认UID和服务器是否正确，并已在 Haruki 上传数据");
            } else {
                setVerifyError("网络错误，请稍后重试");
            }
            setIsVerifying(false);
            return;
        }

        const userGamedata = result.userGamedata || null;
        const userDecks = result.userDecks || null;
        const userCharacters = result.userCharacters || null;
        const userChallengeLiveSoloStages = result.userChallengeLiveSoloStages || null;
        const userChallengeLiveSoloResults = result.userChallengeLiveSoloResults || null;
        const userChallengeLiveSoloHighScoreRewards = result.userChallengeLiveSoloHighScoreRewards || null;
        const userBonds = result.userBonds || null;
        const userMaterials = result.userMaterials || null;
        const userAreas = result.userAreas || null;
        const userMysekaiFixtureGameCharacterPerformanceBonuses = result.userMysekaiFixtureGameCharacterPerformanceBonuses || null;
        const userMysekaiGates = result.userMysekaiGates || null;
        const uploadTime = result.uploadTime || null;

        // 获取 leader 卡面 ID
        const avatarCardId = getLeaderCardId(userGamedata, userDecks);
        const nickname = userGamedata?.name || "";
        const avatarCharacterId = userCharacters && userCharacters.length > 0
            ? getTopCharacterId(userCharacters)
            : null;

        // 创建账号并设置新字段
        const account = createAccount(formGameId.trim(), formServer, nickname, avatarCharacterId, userCharacters, true);
        updateAccount(account.id, {
            userCharacters,
            userChallengeLiveSoloStages,
            userChallengeLiveSoloResults,
            userChallengeLiveSoloHighScoreRewards,
            userBonds,
            userMaterials,
            userAreas,
            userMysekaiFixtureGameCharacterPerformanceBonuses,
            userMysekaiGates,
            userGamedata,
            userDecks,
            uploadTime,
            avatarCardId,
            avatarCharacterId,
        });

        setFormGameId("");
        setFormServer("jp");
        setShowAddForm(false);
        setIsVerifying(false);
        reload();
    }, [formGameId, formServer, reload]);

    const handleSetActive = useCallback((id: string) => {
        setActiveAccount(id);
        setActiveId(id);
    }, []);

    const handleDelete = useCallback((id: string) => {
        void disconnectOAuthAccount(id).catch(() => {
            // 忽略断开失败，删除本地账号仍应成功
        }).finally(() => {
            removeAccount(id);
            setDeleteConfirmId(null);
            reload();
        });
    }, [reload]);

    const handleClearAll = useCallback(() => {
        clearAllAccounts();
        setShowClearConfirm(false);
        reload();
    }, [reload]);
    const handleOAuthBind = useCallback(async () => {
        try {
            setVerifyError(null);
            await startOAuthConnect("/profile");
        } catch (err) {
            setVerifyError(err instanceof Error ? err.message : "OAuth2 授权初始化失败");
        }
    }, []);

    const activeAccount = accounts.find((acc) => acc.id === activeId) || null;
    const activeCharacterRanks = new Map((activeAccount?.userCharacters || []).map((c) => [c.characterId, c.characterRank]));
    const activeChallengeStageRanks = new Map<number, number>();
    (activeAccount?.userChallengeLiveSoloStages || []).forEach((stage) => {
        const current = activeChallengeStageRanks.get(stage.characterId) || 0;
        if (stage.rank > current) activeChallengeStageRanks.set(stage.characterId, stage.rank);
    });

    if (!loaded) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
                    <div className="text-center py-20 text-slate-400">加载中...</div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">My Profile</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        我的<span className="text-miku">主页</span>
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm">
                        管理你的游戏账号，所有数据仅保存在浏览器本地
                    </p>
                </div>

                {(oauthMessage || oauthStatus === "success") && (
                    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {oauthMessage || "OAuth2 账号绑定成功，已自动设为当前使用账号。"}
                    </div>
                )}

                {/* Accounts List */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                            已绑定账号
                            {accounts.length > 0 && (
                                <span className="text-xs font-normal text-slate-400 ml-1">({accounts.length})</span>
                            )}
                        </h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => void handleOAuthBind()}
                                className="px-3 py-1.5 border border-miku/30 text-miku rounded-lg font-bold text-xs hover:bg-miku/5 transition-all"
                            >
                                OAuth2 绑定
                            </button>
                            <button
                                onClick={() => { setShowAddForm(true); setVerifyError(null); }}
                                className="px-3 py-1.5 bg-gradient-to-r from-miku to-miku-dark text-white rounded-lg font-bold text-xs shadow-md shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                添加账号
                            </button>
                        </div>
                    </div>

                    {accounts.length === 0 && !showAddForm ? (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <p className="text-slate-500 text-sm mb-4">还没有绑定任何账号</p>
                            <button
                                onClick={() => { setShowAddForm(true); setVerifyError(null); }}
                                className="px-6 py-2.5 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold text-sm shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                                添加第一个账号
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {accounts.map((acc) => {
                                const isActive = acc.id === activeId;
                                // 优先使用 userGamedata.name，否则使用 nickname
                                const displayName = acc.userGamedata?.name || acc.nickname;

                                return (
                                    <div
                                        key={acc.id}
                                        className={`relative p-4 rounded-xl border transition-all ${isActive
                                            ? "border-miku/40 bg-miku/5 shadow-sm"
                                            : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar - 使用卡面缩略图 */}
                                            <AccountAvatar account={acc} size="lg" className={`ring-2 ring-offset-1 transition-all ${isActive ? "ring-miku/40" : "ring-slate-200"}`} />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {displayName && (
                                                        <span className="text-sm font-bold text-primary-text truncate">{displayName}</span>
                                                    )}
                                                    <span className="font-mono text-xs text-slate-500">{acc.gameId}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive ? "bg-miku/20 text-miku" : "bg-slate-100 text-slate-500"
                                                        }`}>
                                                        {SERVER_LABELS[acc.server]}
                                                    </span>
                                                    {isActive && (
                                                        <span className="px-1.5 py-0.5 bg-miku/10 text-miku text-[10px] font-bold rounded">
                                                            当前使用
                                                        </span>
                                                    )}
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${acc.authSource === "oauth2" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                                                        {acc.authSource === "oauth2" ? "OAuth2" : "公开 API"}
                                                    </span>
                                                    {acc.authError === "reauth_required" && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-600">
                                                            需重新授权
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-slate-400">
                                                        添加于 {new Date(acc.createdAt).toLocaleDateString()}
                                                    </p>
                                                    {acc.uploadTime && (
                                                        <>
                                                            <span className="text-[10px] text-slate-300">•</span>
                                                            <p className="text-[10px] text-slate-400">
                                                                数据更新于 {new Date(acc.uploadTime * 1000).toLocaleString()}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                {!isActive && (
                                                    <button
                                                        onClick={() => handleSetActive(acc.id)}
                                                        className="px-2.5 py-1.5 text-[11px] font-medium text-miku hover:bg-miku/10 rounded-lg transition-colors"
                                                    >
                                                        设为默认
                                                    </button>
                                                )}
                                                {acc.authSource === "oauth2" && (
                                                    <button
                                                        onClick={() => void refreshOAuthAccountData(acc.id).then(reload).catch((error) => {
                                                            console.warn(`OAuth2 账号 ${acc.gameId} 手动同步失败`, error);
                                                            setVerifyError("OAuth2 账号刷新失败，请稍后重试或查看控制台日志");
                                                        })}
                                                        className="px-2.5 py-1.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        重新同步
                                                    </button>
                                                )}
                                                {deleteConfirmId === acc.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(acc.id)}
                                                            className="px-2 py-1 text-[11px] font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                                        >
                                                            确认
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirmId(null)}
                                                            className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirmId(acc.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="删除账号"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add Account Form */}
                    {showAddForm && (
                        <div className="mt-4 p-4 rounded-xl border border-miku/20 bg-miku/5">
                            <h3 className="text-sm font-bold text-primary-text mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 bg-miku rounded-full"></span>
                                添加新账号
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        游戏UID <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formGameId}
                                        onChange={(e) => setFormGameId(e.target.value)}
                                        placeholder="输入游戏UID"
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                        disabled={isVerifying}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">服务器</label>
                                    <div className="flex flex-wrap gap-2">
                                        {SERVER_OPTIONS.map((s) => (
                                            <button
                                                key={s.value}
                                                onClick={() => setFormServer(s.value)}
                                                disabled={isVerifying}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formServer === s.value
                                                    ? "bg-miku text-white shadow-md shadow-miku/20"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    }`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {verifyError && (
                                    <div className="p-3 rounded-lg bg-red-50 border border-red-200/50">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <p className="text-xs font-medium text-red-700">{verifyError}</p>
                                                <ExternalLink
                                                    href="https://haruki.seiunx.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-miku hover:underline mt-1 inline-block"
                                                >
                                                    前往 Haruki 工具箱 →
                                                </ExternalLink>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-slate-400">
                                    添加时会自动从 Haruki API 获取个性签名和角色数据作为头像
                                </p>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={handleAddAccount}
                                        disabled={!formGameId.trim() || isVerifying}
                                        className="flex-1 px-6 py-2.5 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold text-sm shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isVerifying ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                验证中...
                                            </>
                                        ) : (
                                            "验证并添加"
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setVerifyError(null); }}
                                        disabled={isVerifying}
                                        className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {activeAccount && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch mb-6">
                        <div className="min-w-0 h-full flex flex-col gap-6">
                            <div className="min-w-0">
                                <CharacterRankRadar
                                    characterRanks={activeCharacterRanks}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <ChallengeStageChart
                                    challengeStageRanks={activeChallengeStageRanks}
                                    server={activeAccount.server}
                                    challengeSoloStages={activeAccount.userChallengeLiveSoloStages || []}
                                    challengeSoloResults={activeAccount.userChallengeLiveSoloResults || []}
                                    challengeHighScoreRewards={activeAccount.userChallengeLiveSoloHighScoreRewards || []}
                                />
                            </div>
                        </div>
                        <div className="min-w-0 h-full flex flex-col gap-6">
                            <div className="min-w-0">
                                <BondsRankTable
                                    userBonds={activeAccount.userBonds || []}
                                    userCharacters={activeAccount.userCharacters || []}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <PowerBonusDetail
                                    server={activeAccount.server}
                                    userAreas={activeAccount.userAreas || []}
                                    userCharacters={activeAccount.userCharacters || []}
                                    userMysekaiFixtureGameCharacterPerformanceBonuses={activeAccount.userMysekaiFixtureGameCharacterPerformanceBonuses || []}
                                    userMysekaiGates={activeAccount.userMysekaiGates || []}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Tool Quick Links */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-amber-400 rounded-full"></span>
                        工具快捷入口
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                        已绑定的账号可在以下工具中快速选择使用
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/deck-recommend"
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-miku/30 hover:bg-miku/5 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-primary-text">组卡推荐器</div>
                                    <div className="text-xs text-slate-400">自动计算最优卡组</div>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-miku group-hover:translate-x-0.5 transition-transform">前往 →</span>
                        </Link>

                        <Link
                            href="/score-control"
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-miku/30 hover:bg-miku/5 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-primary-text">控分计算器</div>
                                    <div className="text-xs text-slate-400">智能规划放置路线</div>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-miku group-hover:translate-x-0.5 transition-transform">前往 →</span>
                        </Link>

                        <Link
                            href="/my-cards"
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-miku/30 hover:bg-miku/5 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-primary-text">卡牌进度</div>
                                    <div className="text-xs text-slate-400">查看卡牌收集进度</div>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-miku group-hover:translate-x-0.5 transition-transform">前往 →</span>
                        </Link>
                    </div>
                </div>

                {/* Danger Zone */}
                {accounts.length > 0 && (
                    <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6 border border-red-100">
                        <h2 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-red-400 rounded-full"></span>
                            危险操作
                        </h2>
                        <p className="text-xs text-slate-400 mb-4">
                            清除所有账号将删除所有本地保存的数据，此操作不可恢复
                        </p>
                        {!showClearConfirm ? (
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                className="px-4 py-2 border-2 border-red-300 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50 transition-all"
                            >
                                清除所有数据
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-red-500 font-medium">确定要清除所有账号吗？</span>
                                <button
                                    onClick={handleClearAll}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all"
                                >
                                    确认清除
                                </button>
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all"
                                >
                                    取消
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Info */}
                <div className="text-center text-xs text-slate-400 mt-8">
                    <p>所有数据仅保存在你的浏览器本地 (localStorage)，Moesekai 不会上传或存储任何个人信息</p>
                </div>
            </div>
        </MainLayout>
    );
}
