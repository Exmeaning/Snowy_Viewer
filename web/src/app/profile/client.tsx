"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "@/components/LocalizedLink";
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
    SERVER_OPTIONS,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";
import { startOAuthConnect } from "@/lib/oauth";
import { useI18n } from "@/contexts/I18nContext";

/**
 * A section panel on this page.
 *
 * `.hh-tile` is not used because the danger-zone panel needs an alert-colored
 * edge: handheld-os.css is unlayered while Tailwind utilities live in `@layer
 * utilities`, so .hh-tile's `border` shorthand would outrank a
 * `border-[var(--hh-accent-alert)]` written beside it. Border color is therefore
 * left to the call site and stays inside the layered cascade.
 */
const PANEL_CLASS =
    "bg-[var(--hh-surface-2)] border rounded-[var(--hh-radius-lg)] " +
    "shadow-[var(--hh-shadow-tile)] text-[var(--hh-text-primary)] p-5 sm:p-6 mb-6";

/** Section heading with its accent tick. */
const PANEL_TITLE_CLASS = "hh-title text-lg text-[var(--hh-text-primary)] flex items-center gap-2";
const PANEL_TICK_CLASS = "w-1.5 h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]";

/** Small text-only action inside an account row. */
const ROW_ACTION_CLASS =
    "hh-press hh-focusable px-2.5 py-1.5 text-[11px] font-semibold rounded-[var(--hh-radius-sm)] " +
    "text-[var(--hh-accent-deep)] hover:bg-[var(--hh-accent-wash)] cursor-pointer";

/**
 * Server chip in the add-account form.
 *
 * No padding or font-size utilities here on purpose: handheld-os.css is imported
 * unlayered while Tailwind emits utilities inside `@layer utilities`, so unlayered
 * wins and .hh-chip's own padding/font-size would silently defeat anything written
 * alongside it. The chip default is the intended size, so it is simply used.
 */
const SERVER_CHIP_CLASS = "hh-chip hh-press hh-focusable cursor-pointer";

/** Field label in the add-account form. */
const FIELD_LABEL_CLASS = "block text-sm font-medium text-[var(--hh-text-primary)] mb-1";

/** Tool quick-link row. */
const TOOL_ROW_CLASS =
    "hh-press hh-focusable flex items-center justify-between p-3 rounded-[var(--hh-radius-md)] " +
    "border border-[var(--hh-border)] bg-[var(--hh-surface-1)] " +
    "hover:border-[var(--hh-accent)] hover:bg-[var(--hh-accent-wash)] group";

/** Icon plate inside a tool row. All three share one neutral plate: they are the
 *  same kind of object, and three different pastel fills read as decoration. */
const TOOL_ICON_CLASS =
    "w-9 h-9 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] " +
    "text-[var(--hh-text-secondary)] flex items-center justify-center shrink-0";

export default function ProfileClient() {
    const { t, formatDate } = useI18n();
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
    const [oauthMessage, _setOauthMessage] = useState<string | null>(null);

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


        // Automatically refresh account data (uploadTime, name, avatar, etc.).
        const refreshAllAccounts = async () => {
            const accs = getAccounts();
            for (const acc of accs) {
                console.log(`Refreshing account data: ${acc.gameId} (${acc.server})`);

                if (acc.authSource === "oauth2") {
                    try {
                        await refreshOAuthAccountData(acc.id);
                    } catch (error) {
                        console.warn(`OAuth2 account ${acc.gameId} refresh failed; keeping existing data`, error);
                    }
                    continue;
                }

                const result = await verifyHarukiApi(acc.server, acc.gameId);

                if (!result.success) {
                    console.warn(`Account ${acc.gameId} refresh failed; keeping existing data`);
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
            // Reload after all refreshes finish.
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
                setVerifyError(t("common.harukiErrors.apiNotPublic"));
            } else if (result.error === "NOT_FOUND") {
                setVerifyError(t("common.harukiErrors.userNotFound"));
            } else {
                setVerifyError(t("common.harukiErrors.networkError"));
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

        // Resolve the leader card ID.
        const avatarCardId = getLeaderCardId(userGamedata, userDecks);
        const nickname = userGamedata?.name || "";
        const avatarCharacterId = userCharacters && userCharacters.length > 0
            ? getTopCharacterId(userCharacters)
            : null;

        // Create the account and populate extended fields.
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
    }, [formGameId, formServer, reload, t]);

    const handleSetActive = useCallback((id: string) => {
        setActiveAccount(id);
        setActiveId(id);
    }, []);

    const handleDelete = useCallback((id: string) => {
        void disconnectOAuthAccount(id).catch(() => {
            // Ignore disconnect failures; local account deletion should still succeed.
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
            setVerifyError(err instanceof Error ? err.message : t("common.harukiErrors.oauthInitFailed"));
        }
    }, [t]);

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
                    <div className="text-center py-20 text-[var(--hh-text-tertiary)]">{t("common.state.loading")}</div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-[var(--hh-accent-deep)] text-xs">{t("page.profile.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                        {t("page.profile.title")}<span className="text-[var(--hh-accent-deep)]">{t("page.profile.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mt-2 text-sm">
                        {t("page.profile.description")}
                    </p>
                </div>

                {(oauthMessage || oauthStatus === "success") && (
                    <div className="mb-6 rounded-[var(--hh-radius-lg)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-4 py-3 text-sm text-[var(--hh-text-primary)]">
                        {oauthMessage || t("common.account.oauthBindSuccess")}
                    </div>
                )}

                {/* Accounts List */}
                <div className={`${PANEL_CLASS} border-[var(--hh-border)]`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={PANEL_TITLE_CLASS}>
                            <span className={PANEL_TICK_CLASS}></span>
                            {t("page.profile.boundAccounts")}
                            {accounts.length > 0 && (
                                <span className="text-xs font-normal text-[var(--hh-text-tertiary)] hh-numeric ml-1">({accounts.length})</span>
                            )}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => void handleOAuthBind()}
                                className="hh-btn hh-press hh-focusable text-xs cursor-pointer"
                            >
                                {t("common.account.oauthBind")}
                            </button>
                            <button
                                onClick={() => { setShowAddForm(true); setVerifyError(null); }}
                                className="hh-btn hh-btn-primary hh-press hh-focusable text-xs cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t("common.account.addAccount")}
                            </button>
                        </div>
                    </div>

                    {accounts.length === 0 && !showAddForm ? (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)] flex items-center justify-center">
                                <svg className="w-8 h-8 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <p className="text-[var(--hh-text-secondary)] text-sm mb-4">{t("common.account.noAccounts")}</p>
                            <button
                                onClick={() => { setShowAddForm(true); setVerifyError(null); }}
                                className="hh-btn hh-btn-primary hh-press hh-focusable text-sm cursor-pointer"
                            >
                                {t("common.account.addFirstAccount")}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {accounts.map((acc) => {
                                const isActive = acc.id === activeId;
                                // Prefer userGamedata.name, otherwise use nickname.
                                const displayName = acc.userGamedata?.name || acc.nickname;

                                return (
                                    <div
                                        key={acc.id}
                                        className={`relative p-4 rounded-[var(--hh-radius-md)] border transition-colors duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] ${isActive
                                            ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]"
                                            : "border-[var(--hh-border)] bg-[var(--hh-surface-1)] hover:border-[var(--hh-border-strong)]"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar - use the leader card thumbnail. */}
                                            <AccountAvatar account={acc} size="lg" className={`border transition-colors ${isActive ? "border-[var(--hh-accent)]" : "border-[var(--hh-border)]"}`} />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {displayName && (
                                                        <span className="text-sm font-bold text-[var(--hh-text-primary)] truncate">{displayName}</span>
                                                    )}
                                                    <span className="hh-numeric text-xs text-[var(--hh-text-secondary)]">{acc.gameId}</span>
                                                    <span className={`px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] font-bold ${isActive
                                                        ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                                        : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"
                                                        }`}>
                                                        {t(`common.server.${acc.server}`)}
                                                    </span>
                                                    {isActive && (
                                                        <span className="px-1.5 py-0.5 bg-[var(--hh-accent-wash-strong)] text-[var(--hh-accent-deep)] text-[10px] font-bold rounded-[var(--hh-radius-xs)]">
                                                            {t("common.account.current")}
                                                        </span>
                                                    )}
                                                    <span className="px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] font-bold bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]">
                                                        {acc.authSource === "oauth2" ? "OAuth2" : t("common.account.publicApi")}
                                                    </span>
                                                    {acc.authError === "reauth_required" && (
                                                        <span className="px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] font-bold bg-[var(--hh-accent-alert)] text-white">
                                                            {t("common.account.reauthRequired")}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] text-[var(--hh-text-tertiary)] hh-numeric">
                                                        {t("common.account.createdAt", { date: formatDate(acc.createdAt) })}
                                                    </p>
                                                    {acc.uploadTime && (
                                                        <>
                                                            <span className="text-[10px] text-[var(--hh-text-tertiary)]">•</span>
                                                            <p className="text-[10px] text-[var(--hh-text-tertiary)] hh-numeric">
                                                                {t("common.account.dataUpdatedAt", { date: formatDate(acc.uploadTime * 1000, { dateStyle: "medium", timeStyle: "short" }) })}
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
                                                        className={ROW_ACTION_CLASS}
                                                    >
                                                        {t("common.account.setDefault")}
                                                    </button>
                                                )}
                                                {acc.authSource === "oauth2" && (
                                                    <button
                                                        onClick={() => void refreshOAuthAccountData(acc.id).then(reload).catch((error) => {
                                                            console.warn(`OAuth2 account ${acc.gameId} manual sync failed`, error);
                                                            setVerifyError(t("common.harukiErrors.oauthRefreshFailed"));
                                                        })}
                                                        className={ROW_ACTION_CLASS}
                                                    >
                                                        {t("common.account.resync")}
                                                    </button>
                                                )}
                                                {deleteConfirmId === acc.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(acc.id)}
                                                            className="hh-press hh-focusable px-2 py-1 text-[11px] font-bold text-white bg-[var(--hh-accent-alert)] rounded-[var(--hh-radius-sm)] cursor-pointer"
                                                        >
                                                            {t("common.action.confirm")}
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirmId(null)}
                                                            className="hh-press hh-focusable px-2 py-1 text-[11px] font-medium text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-sm)] cursor-pointer"
                                                        >
                                                            {t("common.action.cancel")}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirmId(acc.id)}
                                                        className="hh-press hh-focusable p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-alert)] rounded-[var(--hh-radius-sm)] cursor-pointer"
                                                        title={t("common.account.deleteAccount")}
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
                        <div className="hh-well mt-4 p-4">
                            <h3 className="text-sm font-bold text-[var(--hh-text-primary)] mb-3 flex items-center gap-2">
                                <span className="w-1 h-4 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>
                                {t("common.account.addNewAccount")}
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>
                                        {t("common.form.gameUid")} <span className="text-[var(--hh-accent-alert)]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formGameId}
                                        onChange={(e) => setFormGameId(e.target.value)}
                                        placeholder={t("common.account.inputGameUid")}
                                        className="hh-input w-full px-4 py-2.5 text-sm"
                                        disabled={isVerifying}
                                    />
                                </div>
                                <div>
                                    <label className={FIELD_LABEL_CLASS}>{t("common.form.server")}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {SERVER_OPTIONS.map((s) => (
                                            <button
                                                key={s.value}
                                                onClick={() => setFormServer(s.value)}
                                                disabled={isVerifying}
                                                className={`${SERVER_CHIP_CLASS} ${formServer === s.value ? "hh-chip-active" : ""}`}
                                            >
                                                {t(`common.server.${s.value}`)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {verifyError && (
                                    <div className="p-3 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-2)] border border-[var(--hh-accent-alert)]">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-4 h-4 text-[var(--hh-accent-alert)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <p className="text-xs font-medium text-[var(--hh-text-primary)]">{verifyError}</p>
                                                <ExternalLink
                                                    href="https://haruki.seiunx.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[var(--hh-accent-deep)] hover:underline mt-1 inline-block"
                                                >
                                                    {t("common.account.goHaruki")}
                                                </ExternalLink>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-[var(--hh-text-tertiary)]">
                                    {t("common.account.addHint")}
                                </p>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={handleAddAccount}
                                        disabled={!formGameId.trim() || isVerifying}
                                        className="hh-btn hh-btn-primary hh-press hh-focusable flex-1 text-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {isVerifying ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-[var(--hh-text-on-accent)]/30 border-t-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-full)] animate-spin"></div>
                                                {t("common.account.verifyingWithDots")}
                                            </>
                                        ) : (
                                            t("common.account.verifyAndAdd")
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setVerifyError(null); }}
                                        disabled={isVerifying}
                                        className="hh-btn hh-press hh-focusable text-sm cursor-pointer"
                                    >
                                        {t("common.action.cancel")}
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
                <div className={`${PANEL_CLASS} border-[var(--hh-border)]`}>
                    <h2 className={`${PANEL_TITLE_CLASS} mb-4`}>
                        <span className={PANEL_TICK_CLASS}></span>
                        {t("page.profile.toolQuickLinks")}
                    </h2>
                    <p className="text-xs text-[var(--hh-text-tertiary)] mb-4">
                        {t("page.profile.toolQuickLinksHint")}
                    </p>
                    <div className="space-y-3">
                        <Link href="/deck-recommend" className={TOOL_ROW_CLASS}>
                            <div className="flex items-center gap-3">
                                <div className={TOOL_ICON_CLASS}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-[var(--hh-text-primary)]">{t("page.profile.tools.deckRecommend.title")}</div>
                                    <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.profile.tools.deckRecommend.description")}</div>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-[var(--hh-accent-deep)]">{t("page.profile.goTo")}</span>
                        </Link>

                        <Link href="/score-control" className={TOOL_ROW_CLASS}>
                            <div className="flex items-center gap-3">
                                <div className={TOOL_ICON_CLASS}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-[var(--hh-text-primary)]">{t("page.profile.tools.scoreControl.title")}</div>
                                    <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.profile.tools.scoreControl.description")}</div>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-[var(--hh-accent-deep)]">{t("page.profile.goTo")}</span>
                        </Link>

                        <Link href="/my-cards" className={TOOL_ROW_CLASS}>
                            <div className="flex items-center gap-3">
                                <div className={TOOL_ICON_CLASS}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-[var(--hh-text-primary)]">{t("page.profile.tools.myCards.title")}</div>
                                    <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.profile.tools.myCards.description")}</div>
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-[var(--hh-accent-deep)]">{t("page.profile.goTo")}</span>
                        </Link>
                    </div>
                </div>

                {/* Danger Zone */}
                {accounts.length > 0 && (
                    <div className={`${PANEL_CLASS} border-[var(--hh-accent-alert)]`}>
                        <h2 className="hh-title text-lg text-[var(--hh-accent-alert)] mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent-alert)]"></span>
                            {t("page.profile.dangerZone")}
                        </h2>
                        <p className="text-xs text-[var(--hh-text-tertiary)] mb-4">
                            {t("page.profile.dangerDescription")}
                        </p>
                        {!showClearConfirm ? (
                            /* Written out rather than `.hh-btn` + overrides: .hh-btn is
                               unlayered, so its border and color would win over the
                               alert-tinted utilities and the button would look ordinary. */
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                className="hh-press hh-focusable inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-alert)] bg-[var(--hh-surface-2)] text-sm font-semibold text-[var(--hh-accent-alert)] cursor-pointer"
                            >
                                {t("page.profile.clearAllData")}
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm text-[var(--hh-accent-alert)] font-medium">{t("page.profile.clearAllConfirm")}</span>
                                <button
                                    onClick={handleClearAll}
                                    className="hh-btn hh-btn-danger hh-press hh-focusable text-sm cursor-pointer"
                                >
                                    {t("page.profile.confirmClear")}
                                </button>
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="hh-btn hh-press hh-focusable text-sm cursor-pointer"
                                >
                                    {t("common.action.cancel")}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Info */}
                <div className="text-center text-xs text-[var(--hh-text-tertiary)] mt-8">
                    <p>{t("common.account.localOnlyNotice")}</p>
                </div>
            </div>
        </MainLayout>
    );
}
