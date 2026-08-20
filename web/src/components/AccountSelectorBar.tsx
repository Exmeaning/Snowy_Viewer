"use client";

import React, { useState, useCallback } from "react";
import AccountAvatar from "@/components/AccountAvatar";
import ExternalLink from "@/components/ExternalLink";
import {
    verifyHarukiApi,
    createAccount,
    getTopCharacterId,
    SERVER_OPTIONS,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";
import { startOAuthConnect } from "@/lib/oauth";
import { useI18n } from "@/contexts/I18nContext";

interface AccountSelectorBarProps {
    accounts: MoesekaiAccount[];
    activeAccount: MoesekaiAccount | null;
    onSelect: (acc: MoesekaiAccount) => void;
    onAccountAdded: () => void;
    returnTo?: string;
}

/**
 * Account pill. Selected state is a solid accent-wash slab with an accent
 * border — the same "current entry" language the side rail uses — rather than a
 * tinted translucent capsule.
 */
const ACCOUNT_PILL_CLASS =
    "hh-press hh-focusable flex items-center gap-2 px-3 py-1.5 rounded-[var(--hh-radius-md)] " +
    "text-xs font-medium border cursor-pointer transition-colors " +
    "duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)]";

/** Server chip inside a pill. */
const SERVER_TAG_CLASS = "px-1 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] font-bold";

/** Compact field label in the inline add form. */
const MINI_LABEL_CLASS = "block text-[10px] font-medium text-[var(--hh-text-secondary)] mb-1";

export default function AccountSelectorBar({
    accounts,
    activeAccount,
    onSelect,
    onAccountAdded,
    returnTo = "/profile",
}: AccountSelectorBarProps) {
    const { t } = useI18n();
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
                    ? t("common.harukiErrors.apiNotPublicShort")
                    : result.error === "NOT_FOUND"
                        ? t("common.harukiErrors.userNotFoundShort")
                        : t("common.harukiErrors.networkErrorShort")
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
    }, [gameId, server, onAccountAdded, t]);

    const handleOAuthBind = useCallback(async () => {
        try {
            setOauthError(null);
            await startOAuthConnect(returnTo);
        } catch (err) {
            setOauthError(err instanceof Error ? err.message : t("common.harukiErrors.oauthInitFailed"));
        }
    }, [returnTo, t]);

    return (
        <div className="mb-6">
            <div className="hh-tile p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--hh-text-primary)]">{t("common.account.selectAccount")}</span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => void handleOAuthBind()}
                            className="hh-press hh-focusable rounded-[var(--hh-radius-sm)] text-xs font-semibold text-[var(--hh-accent-deep)] cursor-pointer"
                        >
                            {t("common.account.oauthBind")}
                        </button>
                        <button
                            onClick={() => { setShowAddForm(!showAddForm); setError(null); setOauthError(null); }}
                            className="hh-press hh-focusable rounded-[var(--hh-radius-sm)] text-xs font-semibold text-[var(--hh-accent-deep)] cursor-pointer flex items-center gap-0.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t("common.account.addAccount")}
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
                                className={`${ACCOUNT_PILL_CLASS} ${isActive
                                    ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent)] text-[var(--hh-accent-deep)]"
                                    : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:border-[var(--hh-accent)] hover:bg-[var(--hh-surface-3)]"
                                    }`}
                            >
                                <AccountAvatar account={acc} size="sm" />
                                {displayName && (
                                    <span className="font-bold truncate max-w-[80px]">{displayName}</span>
                                )}
                                <span className="hh-numeric">{acc.gameId}</span>
                                <span className={`${SERVER_TAG_CLASS} ${isActive
                                    ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                    : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"
                                    }`}>
                                    {t(`common.server.${acc.server}`)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Inline add form */}
                {showAddForm && (
                    <div className="mt-3 pt-3 border-t border-[var(--hh-border)]">
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[140px]">
                                <label className={MINI_LABEL_CLASS}>{t("common.form.uid")}</label>
                                <input
                                    type="text"
                                    value={gameId}
                                    onChange={(e) => setGameId(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                    placeholder={t("common.account.inputGameUid")}
                                    className="hh-input w-full px-3 py-1.5 text-xs"
                                    disabled={isVerifying}
                                />
                            </div>
                            <div>
                                <label className={MINI_LABEL_CLASS}>{t("common.form.server")}</label>
                                <div className="flex flex-wrap gap-1">
                                    {SERVER_OPTIONS.map((s) => (
                                        <button
                                            key={s.value}
                                            onClick={() => setServer(s.value)}
                                            disabled={isVerifying}
                                            className={`hh-chip hh-press hh-focusable cursor-pointer ${server === s.value ? "hh-chip-active" : ""}`}
                                        >
                                            {t(`common.server.${s.value}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={!gameId.trim() || isVerifying}
                                className="hh-btn hh-btn-primary hh-press hh-focusable text-xs cursor-pointer disabled:opacity-50"
                            >
                                {isVerifying ? (
                                    <div className="w-3 h-3 border-2 border-[var(--hh-text-on-accent)]/30 border-t-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-full)] animate-spin" />
                                ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isVerifying ? t("common.account.verifying") : t("common.account.add")}
                            </button>
                            <button
                                onClick={() => { setShowAddForm(false); setError(null); }}
                                disabled={isVerifying}
                                className="hh-press hh-focusable px-3 py-1.5 text-xs text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] cursor-pointer"
                            >
                                {t("common.action.cancel")}
                            </button>
                        </div>
                        {(error || oauthError) && (
                            <p className="mt-2 text-[11px] text-[var(--hh-accent-alert)] flex items-center gap-1 flex-wrap">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                </svg>
                                {error || oauthError}
                                <ExternalLink href="https://haruki.seiunx.com" className="text-[var(--hh-accent-deep)] hover:underline ml-1">
                                    {t("common.account.goHaruki")}
                                </ExternalLink>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
