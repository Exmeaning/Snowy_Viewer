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
        <div className="mb-3 max-w-full">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-slate-500">{t("common.account.savedAccounts")}</span>
                <span className="text-[10px] text-slate-400">{t("common.account.quickFill")}</span>
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
                            type="button"
                            onClick={() => {
                                setActiveAccount(acc.id);
                                onSelect(acc.gameId, acc.server);
                            }}
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all border max-w-full min-w-0 ${
                                isActive
                                    ? "bg-miku/10 border-miku/40 text-miku shadow-sm"
                                    : "bg-white/60 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-miku/30 hover:bg-miku/5"
                            }`}
                        >
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
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
                                <span className="font-bold truncate max-w-[65px] sm:max-w-[85px] flex-shrink-0">{displayName}</span>
                            )}
                            <span className="font-mono truncate min-w-0 flex-1">{acc.gameId}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 whitespace-nowrap ${
                                isActive ? "bg-miku/20 text-miku" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
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
