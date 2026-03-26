"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";
import { useCardThumbnail } from "@/hooks/useCardThumbnail";
import {
    getCharacterIconUrl,
    getTopCharacterId,
    setCachedAvatarUrl,
    type MoesekaiAccount,
} from "@/lib/account";

interface AccountAvatarProps {
    account: MoesekaiAccount;
    /** 尺寸: sm=20px, md=32px, lg=48px */
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_MAP = {
    sm: { px: 20, cls: "w-5 h-5" },
    md: { px: 32, cls: "w-8 h-8" },
    lg: { px: 12, cls: "w-12 h-12" },
} as const;

export default function AccountAvatar({ account, size = "md", className }: AccountAvatarProps) {
    const { assetSource } = useTheme();
    const cardThumbnail = useCardThumbnail(account.avatarCardId, assetSource);

    const avatarUrl = cardThumbnail || getCharacterIconUrl(
        account.avatarCharacterId ||
        (account.userCharacters ? getTopCharacterId(account.userCharacters) : 21)
    );

    // 缓存头像 URL 供侧边栏等组件直接读取
    useEffect(() => {
        if (avatarUrl) {
            setCachedAvatarUrl(account.id, avatarUrl);
        }
    }, [account.id, avatarUrl]);

    const s = SIZE_MAP[size];

    if (size === "lg") {
        // lg 使用 fill 模式（用于 profile 等大头像场景）
        return (
            <div className={`relative ${s.cls} rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 ${className || ""}`}>
                <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>
        );
    }

    return (
        <div className={`${s.cls} rounded-full overflow-hidden bg-slate-100 flex-shrink-0 ${className || ""}`}>
            <Image
                src={avatarUrl}
                alt=""
                width={s.px}
                height={s.px}
                className="object-cover"
                unoptimized
            />
        </div>
    );
}
