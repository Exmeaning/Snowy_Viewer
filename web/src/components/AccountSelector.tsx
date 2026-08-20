"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
    getAccounts,
    setActiveAccount,
    getCharacterIconUrl,
    getTopCharacterId,
    getCachedAvatarUrl,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";
import { useI18n } from "@/contexts/I18nContext";

interface AccountSelectorProps {
    /** Called after an account is selected, with gameId and server. */
    onSelect: (gameId: string, server: ServerType) => void;
    /** Current userId in the input, used for highlighting matches. */
    currentUserId?: string;
    currentServer?: ServerType;
    /** Optionally only show accounts from specified servers. */
    allowedServers?: ServerType[];
}

export default function AccountSelector({ onSelect, currentUserId, currentServer, allowedServers }: AccountSelectorProps) {
    const { t } = useI18n();
    const [accounts, setAccounts] = useState<MoesekaiAccount[]>([]);

    useEffect(() => {
        const syncAccounts = () => {
            const allAccounts = getAccounts();
            setAccounts(allowedServers?.length
                ? allAccounts.filter((account) => allowedServers.includes(account.server))
                : allAccounts);
        };
        syncAccounts();
        window.addEventListener("storage", syncAccounts);
        return () => window.removeEventListener("storage", syncAccounts);
    }, [allowedServers]);

    if (accounts.length === 0) return null;

    return (
        <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-[var(--hh-text-secondary)]">{t("common.account.savedAccounts")}</span>
                <span className="text-[10px] text-[var(--hh-text-tertiary)]">{t("common.account.quickFill")}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
                {accounts.map((acc) => {
                    const isActive = currentUserId === acc.gameId && currentServer === acc.server;
                    const charId = acc.avatarCharacterId || (acc.userCharacters ? getTopCharacterId(acc.userCharacters) : 21);
                    const cachedAvatar = getCachedAvatarUrl(acc.id);
                    const avatarUrl = cachedAvatar || getCharacterIconUrl(charId);
                    const displayName = acc.userGamedata?.name || acc.nickname;
                    return (
                        <button
                            key={acc.id}
                            onClick={() => {
                                setActiveAccount(acc.id);
                                onSelect(acc.gameId, acc.server);
                            }}
                            /* Same pill recipe as AccountSelectorBar: these two
                               controls appear on the same pages and must not read as
                               two different components. */
                            className={`hh-press hh-focusable flex items-center gap-2 px-3 py-1.5 rounded-[var(--hh-radius-md)] text-xs font-medium border cursor-pointer transition-colors duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] ${
                                isActive
                                    ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent)] text-[var(--hh-accent-deep)]"
                                    : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:border-[var(--hh-accent)] hover:bg-[var(--hh-surface-3)]"
                            }`}
                        >
                            <div className="w-5 h-5 rounded-[var(--hh-radius-full)] overflow-hidden bg-[var(--hh-surface-sunken)] flex-shrink-0">
                                <Image
                                    src={avatarUrl}
                                    alt=""
                                    width={20}
                                    height={20}
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                            {displayName && (
                                <span className="font-bold truncate max-w-[80px]">{displayName}</span>
                            )}
                            <span className="hh-numeric">{acc.gameId}</span>
                            <span className={`px-1 py-0.5 rounded-[var(--hh-radius-xs)] text-[10px] font-bold ${
                                isActive
                                    ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                    : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"
                            }`}>
                                {t(`common.server.${acc.server}`)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
