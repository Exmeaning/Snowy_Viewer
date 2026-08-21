"use client";
import React from "react";
import GachaItem from "./GachaItem";
import { IGachaInfo } from "@/types/types";
import { useI18n } from "@/contexts/I18nContext";

interface GachaGridProps {
    gachas: IGachaInfo[];
    isLoading?: boolean;
}

// Skeleton component for loading state
function GachaSkeleton() {
    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden animate-pulse">
            <div className="aspect-[16/9] bg-[var(--hh-surface-sunken)]" />
            <div className="p-3 space-y-2">
                <div className="h-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-3/4" />
                <div className="h-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-xs)] w-1/2" />
            </div>
        </div>
    );
}

export default function GachaGrid({ gachas, isLoading = false }: GachaGridProps) {
    const { t } = useI18n();

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <GachaSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (gachas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--hh-text-tertiary)]">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="font-bold">{t("page.gacha.noResult")}</p>
                <p className="text-sm">{t("page.gacha.noResultHint")}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {gachas.map((gacha) => (
                <GachaItem key={gacha.id} gacha={gacha} />
            ))}
        </div>
    );
}
