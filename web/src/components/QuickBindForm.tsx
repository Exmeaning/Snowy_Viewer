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
import { useI18n } from "@/contexts/I18nContext";

interface QuickBindFormProps {
    onAccountAdded: () => void;
    /** Custom icon. */
    icon?: React.ReactNode;
    /** Custom description text. */
    description?: string;
    /** Return path after OAuth succeeds. */
    returnTo?: string;
}

const DefaultIcon = () => (
    <svg className="w-8 h-8 text-[var(--hh-accent-deep)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
);

/** Field label. */
const FIELD_LABEL_CLASS = "block text-sm font-medium text-[var(--hh-text-primary)] mb-1.5";

export default function QuickBindForm({
    onAccountAdded,
    icon,
    description,
    returnTo = "/profile",
}: QuickBindFormProps) {
    const { t } = useI18n();
    const resolvedDescription = description ?? t("common.account.quickBindDefaultDescription");
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
                    ? t("common.harukiErrors.apiNotPublic")
                    : result.error === "NOT_FOUND"
                        ? t("common.harukiErrors.userNotFound")
                        : t("common.harukiErrors.networkError")
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
        <div className="hh-tile p-6 sm:p-8">
            <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent-wash)] border border-[var(--hh-accent-line)] flex items-center justify-center">
                    {icon || <DefaultIcon />}
                </div>
                <h2 className="hh-title text-lg text-[var(--hh-text-primary)] mb-1">{t("common.account.quickBindTitle")}</h2>
                <p className="text-xs text-[var(--hh-text-tertiary)]">{resolvedDescription}</p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
                <div>
                    <label className={FIELD_LABEL_CLASS}>
                        {t("common.form.gameUid")} <span className="text-[var(--hh-accent-alert)]">*</span>
                    </label>
                    <input
                        type="text"
                        value={gameId}
                        onChange={(e) => setGameId(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        placeholder={t("common.account.inputGameUid")}
                        className="hh-input w-full px-4 py-2.5 text-sm"
                        disabled={isVerifying}
                    />
                </div>
                <div>
                    <label className={FIELD_LABEL_CLASS}>{t("common.form.server")}</label>
                    <div className="grid grid-cols-3 gap-2">
                        {SERVER_OPTIONS.map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setServer(s.value)}
                                disabled={isVerifying}
                                // No px/py/text-* alongside .hh-chip: handheld-os.css is
                                // unlayered and outranks Tailwind's layered utilities, so
                                // those would compile and then do nothing.
                                className={`hh-chip hh-press hh-focusable cursor-pointer ${server === s.value ? "hh-chip-active" : ""}`}
                            >
                                {t(`common.server.${s.value}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {(error || oauthError) && (
                    <div className="p-3 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-2)] border border-[var(--hh-accent-alert)]">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-[var(--hh-accent-alert)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-xs font-medium text-[var(--hh-text-primary)]">{error || oauthError}</p>
                                <ExternalLink href="https://haruki.seiunx.com" className="text-xs text-[var(--hh-accent-deep)] hover:underline mt-1 inline-block">
                                    {t("common.account.goHaruki")}
                                </ExternalLink>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!gameId.trim() || isVerifying}
                        className="hh-btn hh-btn-primary hh-press hh-focusable w-full text-sm cursor-pointer disabled:opacity-50"
                    >
                        {isVerifying ? (
                            <>
                                <div className="w-4 h-4 border-2 border-[var(--hh-text-on-accent)]/30 border-t-[var(--hh-text-on-accent)] rounded-[var(--hh-radius-full)] animate-spin" />
                                {t("common.account.verifyingWithDots")}
                            </>
                        ) : (
                            t("common.account.verifyAndBind")
                        )}
                    </button>
                    <button
                        onClick={() => void handleOAuthBind()}
                        disabled={isVerifying}
                        className="hh-btn hh-press hh-focusable w-full text-sm cursor-pointer disabled:opacity-50"
                    >
                        {t("common.account.oauthAuthorizeBind")}
                    </button>
                </div>

                <p className="text-[10px] text-[var(--hh-text-tertiary)] text-center">
                    {t("common.account.manualBindHintStart")}{" "}
                    <ExternalLink href="https://haruki.seiunx.com" className="text-[var(--hh-accent-deep)] hover:underline">
                        {t("common.account.manualBindHintHaruki")}
                    </ExternalLink>
                    {" "}{t("common.account.manualBindHintEnd")}
                </p>
            </div>
        </div>
    );
}
