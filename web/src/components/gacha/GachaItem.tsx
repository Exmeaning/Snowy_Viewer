"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { IGachaInfo } from "@/types/types";
import { getGachaLogoUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

interface GachaItemProps {
    gacha: IGachaInfo;
}

export default function GachaItem({ gacha }: GachaItemProps) {
    const { isShowSpoiler, assetSource } = useTheme();
    const now = Date.now();
    const isUnreleased = gacha.startAt > now;
    const isOngoing = gacha.startAt <= now && gacha.endAt >= now;
    const logoUrl = getGachaLogoUrl(gacha.assetbundleName, assetSource);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    return (
        <Link href={`/gacha/${gacha.id}`} className="group block">
            <div className="relative rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                {/* Logo Image */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                    <Image
                        src={logoUrl}
                        alt={gacha.name}
                        fill
                        className="object-contain p-2"
                        unoptimized
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='112' viewBox='0 0 200 112'%3E%3Crect fill='%23f1f5f9' width='200' height='112'/%3E%3Ctext x='100' y='56' text-anchor='middle' fill='%2394a3b8' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
                        }}
                    />

                    {/* Status Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {isUnreleased && isShowSpoiler && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                                剧透
                            </span>
                        )}
                        {isOngoing && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full animate-pulse">
                                进行中
                            </span>
                        )}
                    </div>

                    {/* ID Badge */}
                    <div className="absolute bottom-2 left-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-black/50 text-white rounded-full backdrop-blur-sm">
                            #{gacha.id}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-3">
                    <h3 className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors">
                        {gacha.name}
                    </h3>
                    <div className="mt-1 text-xs text-slate-400 space-y-0.5">
                        <p>{formatDate(gacha.startAt)} ~ {formatDate(gacha.endAt)}</p>
                    </div>
                </div>
            </div>
        </Link>
    );
}
