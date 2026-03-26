"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
    getAccounts,
    setActiveAccount,
    getCharacterIconUrl,
    getTopCharacterId,
    getCachedAvatarUrl,
    SERVER_LABELS,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";

interface AccountSelectorProps {
    /** 当选择账号后回调，传入 gameId 和 server */
    onSelect: (gameId: string, server: ServerType) => void;
    /** 当前输入框中的 userId（用于高亮匹配） */
    currentUserId?: string;
    currentServer?: ServerType;
}

export default function AccountSelector({ onSelect, currentUserId, currentServer }: AccountSelectorProps) {
    const [accounts, setAccounts] = useState<MoesekaiAccount[]>([]);

    useEffect(() => {
        const syncAccounts = () => {
            setAccounts(getAccounts());
        };
        syncAccounts();
        window.addEventListener("storage", syncAccounts);
        return () => window.removeEventListener("storage", syncAccounts);
    }, []);

    if (accounts.length === 0) return null;

    return (
        <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-slate-500">已保存的账号</span>
                <span className="text-[10px] text-slate-400">点击快速填入</span>
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
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                isActive
                                    ? "bg-miku/10 border-miku/40 text-miku shadow-sm"
                                    : "bg-white/60 border-slate-200/60 text-slate-600 hover:border-miku/30 hover:bg-miku/5"
                            }`}
                        >
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
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
                            <span className="font-mono">{acc.gameId}</span>
                            <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                                isActive ? "bg-miku/20 text-miku" : "bg-slate-100 text-slate-500"
                            }`}>
                                {SERVER_LABELS[acc.server]}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
