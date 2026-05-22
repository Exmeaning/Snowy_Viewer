"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ACCOUNTS_CHANGED_EVENT,
    getActiveAccount,
    getCharacterIconUrl,
    getTopCharacterId,
    getCachedAvatarUrl,
    type MoesekaiAccount,
} from "@/lib/account";
import { useCardThumbnail } from "@/hooks/useCardThumbnail";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import {
    NAV_ITEM_LABEL_KEYS,
} from "@/lib/navigation";
import {
    getShortcutById,
    isEditableEventTarget,
    isKeyboardEventComposing,
    matchesShortcutCombo,
    parseShortcutCombos,
} from "@/lib/shortcuts";

interface NavItem {
    id: string;
    href: string;
    icon: React.ReactNode;
}

interface NavGroup {
    id: string;
    items: NavItem[];
}

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    hasMounted?: boolean;
    disableKeyboardNavigation?: boolean;
}

const SIDEBAR_FOCUS_NEXT_COMBOS = parseShortcutCombos(
    getShortcutById("sidebar-focus-next")?.combos ?? []
);
const SIDEBAR_FOCUS_PREV_COMBOS = parseShortcutCombos(
    getShortcutById("sidebar-focus-prev")?.combos ?? []
);
const SIDEBAR_OPEN_COMBO = parseShortcutCombos(
    getShortcutById("sidebar-open-focused")?.combos ?? []
)[0] ?? [];
const SIDEBAR_CLEAR_FOCUS_COMBO = parseShortcutCombos(
    getShortcutById("close-overlay")?.combos ?? []
)[0] ?? [];

const navigationGroups: NavGroup[] = [
    {
        id: "database",
        items: [
            {
                id: "cards",
                href: "/cards",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                ),
            },
            {
                id: "musicList",
                href: "/music",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                ),
            },
            {
                id: "musicMeta",
                href: "/music/meta",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                ),
            },
            {
                id: "soundtrack",
                href: "/soundtrack",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth={2} />
                        <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3a9 9 0 019 9" />
                    </svg>
                ),
            },
            {
                id: "character",
                href: "/character",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
            },
            {
                id: "costumes",
                href: "/costumes",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                ),
            },
            {
                id: "honors",
                href: "/honors",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                ),
            },
            {
                id: "sticker",
                href: "/sticker",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                id: "comic",
                href: "/comic",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                ),
            },
            {
                id: "manga",
                href: "/manga",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                ),
            },
            {
                id: "mysekai",
                href: "/mysekai",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                ),
            },
            {
                id: "materials",
                href: "/materials",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                ),
            },
            {
                id: "exchanges",
                href: "/exchanges",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "activity",
        items: [
            {
                id: "events",
                href: "/events",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                id: "gacha",
                href: "/gacha",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                ),
            },
            {
                id: "live",
                href: "/live",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                id: "prediction",
                href: "/prediction",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                ),
            },
            {
                id: "realtimeRanking",
                href: "/realtime-ranking",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h4v8H3zm7-10h4v18h-4zm7 6h4v12h-4z" />
                    </svg>
                ),
            },
            {
                id: "mysekaiPreview",
                href: "/mysekai-preview",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10.5L12 4l9 6.5M5 10v8.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V10" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 20v-6h8v6M9 11h.01M15 11h.01M12 8h.01" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "story",
        items: [
            {
                id: "mainStory",
                href: "/story/unit",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                ),
            },
            {
                id: "eventStory",
                href: "/story/event",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                id: "cardStory",
                href: "/story/card",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                ),
            },
            {
                id: "areaTalk",
                href: "/story/area",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                ),
            },
            {
                id: "selfIntro",
                href: "/story/self",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
            },
            {
                id: "specialStory",
                href: "/story/special",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "community",
        items: [
            {
                id: "guides",
                href: "/guides",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "tools",
        items: [
            {
                id: "deckRecommend",
                href: "/deck-recommend",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                ),
            },
            {
                id: "deckComparator",
                href: "/deck-comparator",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                ),
            },
            {
                id: "scoreControl",
                href: "/score-control",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                id: "stickerMaker",
                href: "/sticker-maker",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                ),
            },
            {
                id: "goodsGacha",
                href: "/goods-gacha",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                id: "guessWho",
                href: "/guess-who",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                id: "guessJacket",
                href: "/guess-jacket",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                ),
            },
            {
                id: "chartPreview",
                href: "/chart-preview",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                id: "mysekaiPreviewScene",
                href: "/mysekai-preview/scene",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-13z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14l4-8 4 8m-6.5-3h5M7 17h10" />
                    </svg>
                ),
            },
        ],
    },
    {
        id: "personal",
        items: [
            {
                id: "profile",
                href: "/profile",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                id: "myCards",
                href: "/my-cards",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                ),
            },
            {
                id: "myMusics",
                href: "/my-musics",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                ),
            },
            {
                id: "myMaterials",
                href: "/my-materials",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                ),
            },

            {
                id: "support",
                href: "/patreon",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                ),
            },
            {
                id: "about",
                href: "/about",
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
        ],
    },
];

const SIDEBAR_GROUP_LABEL_KEYS: Record<string, string> = {
    database: "layout.nav.groups.database",
    activity: "layout.nav.groups.activity",
    story: "layout.nav.groups.story",
    community: "layout.nav.groups.community",
    tools: "layout.nav.groups.tools",
    personal: "layout.nav.groups.personal",
};

export default function Sidebar({
    isOpen,
    onClose,
    hasMounted = true,
    disableKeyboardNavigation = false,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { assetSource } = useTheme();
    const { t } = useI18n();
    // Expand all groups by default.
    const [expandedGroups, setExpandedGroups] = useState<string[]>(
        navigationGroups.map(group => group.id)
    );
    const [activeAccount, setActiveAccountState] = useState<MoesekaiAccount | null>(null);
    const activeAccountCardThumbnail = useCardThumbnail(activeAccount?.avatarCardId ?? null, assetSource);
    const navRef = useRef<HTMLElement>(null);

    // Keyboard navigation state: -1 means no focused item.
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Build the current visible navigation item list, respecting collapsed groups.
    const visibleItems = useMemo(() => {
        const items: { id: string; href: string }[] = [{ id: "home", href: "/" }];
        for (const group of navigationGroups) {
            if (expandedGroups.includes(group.id)) {
                for (const item of group.items) {
                    items.push({ id: item.id, href: item.href });
                }
            }
        }
        return items;
    }, [expandedGroups]);

    // Load and sync the active account.
    useEffect(() => {
        const syncActiveAccount = () => {
            const account = getActiveAccount();
            setActiveAccountState(account);
        };

        syncActiveAccount();
        window.addEventListener(ACCOUNTS_CHANGED_EVENT, syncActiveAccount);
        window.addEventListener("storage", syncActiveAccount);
        return () => {
            window.removeEventListener(ACCOUNTS_CHANGED_EVENT, syncActiveAccount);
            window.removeEventListener("storage", syncActiveAccount);
        };
    }, []);

    // Restore the sidebar scroll position.
    useEffect(() => {
        const saved = sessionStorage.getItem('sidebar_scroll');
        if (saved && navRef.current) {
            navRef.current.scrollTop = parseInt(saved, 10);
        }
    }, []);

    // Save the sidebar scroll position.
    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const handleScroll = () => {
            sessionStorage.setItem('sidebar_scroll', String(nav.scrollTop));
        };
        nav.addEventListener('scroll', handleScroll, { passive: true });
        return () => nav.removeEventListener('scroll', handleScroll);
    }, []);

    // Keyboard navigation: move with arrow keys, open with Enter, cancel with Escape.
    useEffect(() => {
        if (!isOpen || disableKeyboardNavigation || window.innerWidth < 768) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented || isKeyboardEventComposing(e)) return;

            // Ignore editable targets.
            if (isEditableEventTarget(e.target)) return;

            // Ignore system modifier shortcuts here.
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (SIDEBAR_FOCUS_NEXT_COMBOS.some((combo) => matchesShortcutCombo(e, combo))) {
                if (visibleItems.length === 0) return;
                e.preventDefault();
                setFocusedIndex(prev => {
                    const next = prev + 1;
                    return next >= visibleItems.length ? 0 : next;
                });
            } else if (SIDEBAR_FOCUS_PREV_COMBOS.some((combo) => matchesShortcutCombo(e, combo))) {
                if (visibleItems.length === 0) return;
                e.preventDefault();
                setFocusedIndex(prev => {
                    const next = prev - 1;
                    return next < 0 ? visibleItems.length - 1 : next;
                });
            } else if (focusedIndex >= 0 && matchesShortcutCombo(e, SIDEBAR_OPEN_COMBO)) {
                e.preventDefault();
                const item = visibleItems[focusedIndex];
                if (item) {
                    router.push(item.href);
                    setFocusedIndex(-1);
                }
            } else if (focusedIndex >= 0 && matchesShortcutCombo(e, SIDEBAR_CLEAR_FOCUS_COMBO)) {
                e.preventDefault();
                setFocusedIndex(-1);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, disableKeyboardNavigation, focusedIndex, visibleItems, router]);

    // Scroll focused item into view.
    useEffect(() => {
        if (focusedIndex < 0 || !navRef.current) return;
        const el = navRef.current.querySelector(`[data-nav-index="${focusedIndex}"]`);
        if (el) {
            el.scrollIntoView({ block: "nearest" });
        }
    }, [focusedIndex]);

    // Reset focus when the sidebar closes.
    useEffect(() => {
        if (!isOpen) setFocusedIndex(-1);
    }, [isOpen]);

    const toggleGroup = (id: string) => {
        setExpandedGroups((prev) =>
            prev.includes(id) ? prev.filter((groupId) => groupId !== id) : [...prev, id]
        );
    };

    const activeHref = useMemo(() => {
        if (pathname === "/") return "/";

        let bestMatch = "";
        for (const group of navigationGroups) {
            for (const item of group.items) {
                if (item.href === "/music" && pathname.startsWith("/music/meta")) {
                    continue;
                }
                if (pathname === item.href || pathname.startsWith(item.href + "/")) {
                    if (item.href.length > bestMatch.length) {
                        bestMatch = item.href;
                    }
                }
            }
        }

        return bestMatch;
    }, [pathname]);

    const isActive = (href: string) => href === activeHref;
    const getGroupLabel = (id: string) => t(SIDEBAR_GROUP_LABEL_KEYS[id] ?? id);
    const getItemLabel = (href: string, fallback: string) => t(NAV_ITEM_LABEL_KEYS[href] ?? fallback);

    // Close the sidebar after navigation only on mobile.
    const handleNavClick = () => {
        setFocusedIndex(-1);
        if (window.innerWidth < 768 || screen.width < 768) {
            onClose();
        }
    };

    // Flat index counter for visible items.
    let flatIdx = 0;
    const isHomePage = pathname === "/";

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[55] md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed ${isHomePage ? "top-[3.5rem] h-[calc(100vh-3.5rem)]" : "top-[5.5rem] h-[calc(100vh-5.5rem)]"} sm:top-[4.5rem] sm:h-[calc(100vh-4.5rem)] left-0 w-64 bg-white/95 backdrop-blur-lg border-r border-slate-200 z-[60] ${hasMounted ? 'transition-transform duration-300 ease-out' : ''} overflow-y-auto flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >


                {/* Navigation groups - scrollable area */}
                <nav ref={navRef} className="p-4 space-y-4 flex-grow overflow-y-auto">
                    {/* Home shortcut */}
                    <Link
                        href="/"
                        onClick={handleNavClick}
                        data-nav-index={(() => { const i = flatIdx; flatIdx++; return i; })()}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${focusedIndex === 0
                            ? "bg-miku/15 text-miku ring-2 ring-miku/30"
                            : pathname === "/"
                                ? "bg-miku/10 text-miku"
                                : "text-slate-600 hover:bg-slate-50 hover:text-miku"
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span>{t("layout.nav.home")}</span>
                    </Link>

                    <div className="border-t border-slate-100" />

                    {/* Navigation groups */}
                    {navigationGroups.map((group) => {
                        const isExpanded = expandedGroups.includes(group.id);
                        return (
                            <div key={group.id}>
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 hover:text-miku transition-colors"
                                >
                                    {getGroupLabel(group.id)}
                                    <svg
                                        className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""
                                            }`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div
                                    className={`space-y-1 overflow-hidden transition-all duration-200 ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                                        }`}
                                >
                                    {group.items.map((item) => {
                                        const active = isActive(item.href);
                                        const thisIdx = flatIdx;
                                        flatIdx++;
                                        const isFocused = focusedIndex === thisIdx;
                                        return (
                                            <div key={item.href}>
                                                <div className={`flex items-center rounded-lg transition-all ${isFocused
                                                    ? "bg-miku/15 text-miku ring-2 ring-miku/30"
                                                    : active
                                                        ? "bg-miku/10 text-miku"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-miku"
                                                    }`}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={handleNavClick}
                                                        data-nav-index={thisIdx}
                                                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium flex-1 min-w-0"
                                                    >
                                                        {item.icon}
                                                        <span>{getItemLabel(item.href, item.id)}</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom section - user info */}
                <div className="border-t border-slate-200 flex-shrink-0">
                    {/* User Info Card */}
                    <Link
                        href="/profile"
                        onClick={handleNavClick}
                        className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors group"
                    >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-miku to-blue-400 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {activeAccount ? (
                                <Image
                                    src={
                                        activeAccountCardThumbnail ||
                                        getCachedAvatarUrl(activeAccount.id) ||
                                        getCharacterIconUrl(
                                            activeAccount.avatarCharacterId ||
                                            (activeAccount.userCharacters ? getTopCharacterId(activeAccount.userCharacters) : 21)
                                        )
                                    }
                                    alt={activeAccount.userGamedata?.name || activeAccount.nickname || activeAccount.gameId}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            )}
                        </div>

                        {/* User Info */}
                        <div className="flex-grow min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate group-hover:text-miku transition-colors">
                                {activeAccount?.userGamedata?.name || activeAccount?.nickname || t("settings.sidebar.notLoggedIn")}
                            </div>
                            <div className="text-xs text-slate-400">
                                {activeAccount ? t("settings.sidebar.manageAccount") : t("settings.sidebar.bindAccount")}
                            </div>
                        </div>

                        {/* Arrow Icon */}
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-miku transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </aside>
        </>
    );
}
