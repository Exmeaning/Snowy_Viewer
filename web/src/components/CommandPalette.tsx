"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { searchableNavItems, SEARCH_GROUP_LABEL_KEYS, SEARCH_GROUP_ROUTES, SEARCH_STATIC_GROUP_LABEL_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";
import { CHARACTER_NAMES } from "@/types/types";
import { getPrimaryShortcutLabel, isKeyboardEventComposing } from "@/lib/shortcuts";
import { fetchMusicAliases } from "@/lib/musicAliases";
import { useI18n } from "@/contexts/I18nContext";
import { hhPopoverVariants, springSnappy } from "@/lib/motion";
import { playHandheldSound } from "@/lib/handheld-sound";

// Dynamic search index item from search-index.json
interface SearchIndexItem {
    id: number;
    n: string;   // name (JP)
    cn?: string;  // name (CN translation)
    en?: string;  // name (EN translation)
    g: string;    // group: cards, music, events, gacha
    c?: number;   // characterId (cards only)
}

// Search result with matched alias info
interface SearchResultItem extends SearchIndexItem {
    matchedAlias?: string; // The alias that matched the search query
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (href: string) => void;
}

function escapeRegExp(string: string) {
    return string.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

// Max dynamic results per group
const MAX_DYNAMIC_PER_GROUP = 8;
const WILDCARD_STORAGE_KEY = "moesekai_search_wildcard_enabled";

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
    const [mounted, setMounted] = useState(false);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [activeIndex, setActiveIndex] = useState(0);
    const [useWildcard, setUseWildcard] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Dynamic search index state (loaded once per session)
    const [searchIndex, setSearchIndex] = useState<SearchIndexItem[] | null>(null);
    const [musicAliasesMap, setMusicAliasesMap] = useState<Map<number, string[]> | null>(null);
    const [isLoadingIndex, setIsLoadingIndex] = useState(false);
    const indexLoadedRef = useRef(false);
    const wildcardShortcut = getPrimaryShortcutLabel("toggle-search-wildcard");
    const { locale, t } = useI18n();

    useEffect(() => {
        try {
            const savedWildcard = localStorage.getItem(WILDCARD_STORAGE_KEY);
            if (savedWildcard === "true") {
                setUseWildcard(true);
            }
        } catch {}
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        try {
            localStorage.setItem(WILDCARD_STORAGE_KEY, String(useWildcard));
        } catch {}
    }, [useWildcard, mounted]);

    // Load search index on first open
    useEffect(() => {
        if (isOpen && !indexLoadedRef.current && !isLoadingIndex) {
            indexLoadedRef.current = true;
            setIsLoadingIndex(true);

            // Aliases are optional and must not delay the primary multilingual index.
            fetch("https://translation.exmeaning.com/data/search-index.json")
                .then((res) => res.json() as Promise<SearchIndexItem[]>)
                .then((indexData) => {
                    setSearchIndex(indexData);
                })
                .catch((err) => {
                    console.warn("Failed to load search index:", err);
                })
                .finally(() => {
                    setIsLoadingIndex(false);
                });

            fetchMusicAliases()
                .then(setMusicAliasesMap)
                .catch(() => setMusicAliasesMap(new Map()));
        }
    }, [isOpen, isLoadingIndex]);

    // Filter items based on query
    const searchRegex = useMemo(() => {
        if (!useWildcard) return null;
        const q = deferredQuery.trim();
        if (!q) return null;
        try {
            // Convert * and ? to regex equivalents, escape other regex specials
            const parts = q.split(/([*?])/);
            const regexPattern = parts.map(part => {
                if (part === '*') return '.*';
                if (part === '?') return '.';
                return escapeRegExp(part);
            }).join('');
            return new RegExp(regexPattern, 'i');
        } catch (_e) {
            return null;
        }
    }, [deferredQuery, useWildcard]);

    const filtered = useMemo(() => {
        const qStr = deferredQuery.trim();
        if (!qStr) return searchableNavItems;
        const q = qStr.toLowerCase();

        return searchableNavItems.filter((item) => {
            if (searchRegex) {
                const label = t(NAV_ITEM_LABEL_KEYS[item.href] ?? item.href);
                const groupLabel = t(SEARCH_STATIC_GROUP_LABEL_KEYS[item.group] ?? item.group);
                return searchRegex.test(label) ||
                    searchRegex.test(item.href) ||
                    searchRegex.test(groupLabel) ||
                    item.keywords.some((kw) => searchRegex.test(kw));
            } else {
                const label = t(NAV_ITEM_LABEL_KEYS[item.href] ?? item.href).toLowerCase();
                const groupLabel = t(SEARCH_STATIC_GROUP_LABEL_KEYS[item.group] ?? item.group).toLowerCase();
                return label.includes(q) ||
                    item.href.toLowerCase().includes(q) ||
                    groupLabel.includes(q) ||
                    item.keywords.some((kw) => kw.toLowerCase().includes(q));
            }
        });
    }, [deferredQuery, searchRegex, t]);

    // Filter dynamic search index items based on query
    const dynamicFiltered = useMemo(() => {
        const qStr = deferredQuery.trim();
        if (!qStr || !searchIndex) return [];
        const q = qStr.toLowerCase();

        const matched: SearchResultItem[] = searchIndex.map((item) => {
            const idStr = item.id.toString();
            if (searchRegex) {
                if (searchRegex.test(idStr)) return { ...item };
                if (searchRegex.test(item.n)) return { ...item };
                if (item.cn && searchRegex.test(item.cn)) return { ...item };
                if (item.en && searchRegex.test(item.en)) return { ...item };
                if (item.c) {
                    const charName = CHARACTER_NAMES[item.c];
                    if (charName && searchRegex.test(charName)) return { ...item };
                }
                // Match music aliases
                if (item.g === "music" && musicAliasesMap) {
                    const aliases = musicAliasesMap.get(item.id);
                    if (aliases) {
                        const matchedAlias = aliases.find(alias => searchRegex!.test(alias));
                        if (matchedAlias) return { ...item, matchedAlias };
                    }
                }
                return null;
            } else {
                if (idStr === qStr) return { ...item }; // Exact ID match
                if (item.n.toLowerCase().includes(q)) return { ...item };
                if (item.cn && item.cn.toLowerCase().includes(q)) return { ...item };
                if (item.en && item.en.toLowerCase().includes(q)) return { ...item };
                // For cards, also search by character name
                if (item.c) {
                    const charName = CHARACTER_NAMES[item.c];
                    if (charName && charName.toLowerCase().includes(q)) return { ...item };
                }
                // Match music aliases
                if (item.g === "music" && musicAliasesMap) {
                    const aliases = musicAliasesMap.get(item.id);
                    if (aliases) {
                        const matchedAlias = aliases.find(alias => alias.toLowerCase().includes(q));
                        if (matchedAlias) return { ...item, matchedAlias };
                    }
                }
                return null;
            }
        }).filter((item): item is SearchResultItem => item !== null);

        // Group and limit results
        const grouped: Record<string, SearchResultItem[]> = {};
        for (const item of matched) {
            if (!grouped[item.g]) grouped[item.g] = [];
            if (grouped[item.g].length < MAX_DYNAMIC_PER_GROUP) {
                grouped[item.g].push(item);
            }
        }

        return Object.entries(grouped).flatMap(([, items]) => items);
    }, [deferredQuery, searchIndex, searchRegex, musicAliasesMap]);

    // Combined flat list for keyboard navigation
    const totalItems = filtered.length + dynamicFiltered.length;

    // Group filtered static items
    const grouped = useMemo(() => {
        const groups: { titleKey: string; items: typeof filtered }[] = [];
        const groupMap = new Map<string, typeof filtered>();
        for (const item of filtered) {
            const existing = groupMap.get(item.group);
            if (existing) {
                existing.push(item);
            } else {
                const arr = [item];
                groupMap.set(item.group, arr);
                groups.push({ titleKey: SEARCH_STATIC_GROUP_LABEL_KEYS[item.group] ?? item.group, items: arr });
            }
        }
        return groups;
    }, [filtered]);

    // Group dynamic items
    const dynamicGrouped = useMemo(() => {
        const groups: { titleKey: string; items: SearchResultItem[] }[] = [];
        const groupMap = new Map<string, SearchResultItem[]>();
        for (const item of dynamicFiltered) {
            const groupKey = SEARCH_GROUP_LABEL_KEYS[item.g] || item.g;
            const existing = groupMap.get(groupKey);
            if (existing) {
                existing.push(item);
            } else {
                const arr = [item];
                groupMap.set(groupKey, arr);
                groups.push({ titleKey: groupKey, items: arr });
            }
        }
        return groups;
    }, [dynamicFiltered]);

    // Reset state when opening/closing
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setActiveIndex(0);
            // Focus input after animation starts
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    // Prevent body scroll while preserving any existing overflow override.
    useEffect(() => {
        if (!isOpen) return;
        const previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousBodyOverflow;
        };
    }, [isOpen]);

    // Reset active index when filtered results change
    useEffect(() => {
        setActiveIndex(0);
    }, [filtered, dynamicFiltered]);

    // Both the mouse and the Enter key land here, so this is the one place the
    // confirm cue belongs — every result row gets it for free.
    const navigate = useCallback(
        (href: string) => {
            playHandheldSound("confirm");
            onNavigate(href);
        },
        [onNavigate]
    );

    // Scroll active item into view
    useEffect(() => {
        if (!listRef.current) return;
        const activeEl = listRef.current.querySelector("[data-active='true']");
        if (activeEl) {
            activeEl.scrollIntoView({ block: "nearest" });
        }
    }, [activeIndex]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (isKeyboardEventComposing(e.nativeEvent)) return;

            switch (e.key) {
                case "ArrowDown":
                    if (totalItems === 0) return;
                    e.preventDefault();
                    playHandheldSound("cursor");
                    setActiveIndex((prev) => (prev + 1) % totalItems);
                    break;
                case "ArrowUp":
                    if (totalItems === 0) return;
                    e.preventDefault();
                    playHandheldSound("cursor");
                    setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
                    break;
                case "Enter":
                    if (totalItems === 0) return;
                    e.preventDefault();
                    if (activeIndex < filtered.length) {
                        navigate(filtered[activeIndex].href);
                    } else {
                        const dynIdx = activeIndex - filtered.length;
                        if (dynamicFiltered[dynIdx]) {
                            const item = dynamicFiltered[dynIdx];
                            const route = SEARCH_GROUP_ROUTES[item.g] || `/${item.g}`;
                            navigate(`${route}/${item.id}`);
                        }
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    playHandheldSound("back");
                    onClose();
                    break;
                case "q":
                case "Q":
                case "œ":
                    // macOS Option+Q triggers œ, keep both for compatibility
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        playHandheldSound("toggle");
                        setUseWildcard((prev) => !prev);
                    }
                    break;
            }
        },
        [filtered, dynamicFiltered, activeIndex, navigate, onClose, totalItems]
    );

    // Flat index counter for rendering
    let flatIndex = -1;

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] isolate flex items-start justify-center px-3 pt-4 sm:px-4 sm:pt-[min(20vh,8rem)]">
                    {/* Scrim — flat dim, no blur. */}
                    <motion.div
                        className="absolute inset-0 hh-scrim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springSnappy}
                        onClick={onClose}
                    />

                    {/* Dialog — grows down from the search trigger in the top
                        chrome, which is what hhPopoverVariants encodes: the
                        shared damped popover path instead of this file's own
                        hand-rolled drop. */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={t("search.commandPalette.placeholder")}
                        className="relative w-full max-w-lg transform-gpu will-change-transform hh-float overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[70vh]"
                        variants={hhPopoverVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        onKeyDown={handleKeyDown}
                    >
                        {/* Search input row — the palette's own chrome strip. */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                            <div className="flex items-center gap-3 flex-1">
                                <svg
                                    className="w-5 h-5 text-[var(--hh-text-tertiary)] flex-shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t("search.commandPalette.placeholder")}
                                    className="flex-1 py-1.5 sm:py-2.5 bg-transparent text-sm text-[var(--hh-text-primary)] placeholder:text-[var(--hh-text-tertiary)] outline-none min-w-0"
                                />
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-[var(--hh-text-tertiary)] bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)]">
                                    {t("common.shortcut.escape")}
                                </kbd>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-[var(--hh-border-hairline)] pt-2 sm:pt-0 shrink-0">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--hh-text-secondary)]">
                                    {t("search.commandPalette.wildcard")}
                                    <kbd className="hidden sm:inline-flex items-center px-1 py-0.5 text-[9px] font-mono font-semibold text-[var(--hh-text-tertiary)] bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] leading-none h-4">
                                        {wildcardShortcut}
                                    </kbd>
                                </span>
                                <button
                                    onClick={() => {
                                        playHandheldSound("toggle");
                                        setUseWildcard(!useWildcard);
                                    }}
                                    className={`hh-press hh-switch ${useWildcard ? "hh-switch-active" : ""}`}
                                    role="switch"
                                    aria-checked={useWildcard}
                                    aria-label={t("search.commandPalette.wildcard")}
                                >
                                    <span className="hh-switch-thumb" />
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
                            {totalItems === 0 && !isLoadingIndex ? (
                                <div className="px-4 py-8 text-center text-sm text-[var(--hh-text-tertiary)]">
                                    {t("search.commandPalette.noResults")}
                                </div>
                            ) : (
                                <>
                                    {/* Static navigation results */}
                                    {grouped.map((group) => (
                                        <div key={group.titleKey}>
                                            <div className="hh-label px-4 pt-3 pb-1">
                                                {t(group.titleKey)}
                                            </div>
                                            {group.items.map((item) => {
                                                flatIndex++;
                                                const isActive = flatIndex === activeIndex;
                                                const idx = flatIndex;
                                                return (
                                                    <button
                                                        key={item.href}
                                                        data-active={isActive}
                                                        onClick={() => navigate(item.href)}
                                                        onMouseEnter={() => setActiveIndex(idx)}
                                                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isActive
                                                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                                            : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                                            }`}
                                                    >
                                                        <span className="font-medium">{t(NAV_ITEM_LABEL_KEYS[item.href] ?? item.href)}</span>
                                                        <span
                                                            className={`text-xs ${isActive ? "text-[var(--hh-text-on-accent)] opacity-70" : "text-[var(--hh-text-tertiary)]"
                                                                }`}
                                                        >
                                                            {item.href}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}

                                    {/* Dynamic search results */}
                                    {dynamicGrouped.map((group) => (
                                        <div key={`dyn-${group.titleKey}`}>
                                            <div className="hh-label px-4 pt-3 pb-1 flex items-center gap-2">
                                                {t(group.titleKey)}
                                                {group.titleKey === SEARCH_GROUP_LABEL_KEYS.music && (
                                                    <span className="font-normal normal-case tracking-normal text-[10px] text-[var(--hh-text-tertiary)]">
                                                        ({t("search.commandPalette.musicAliasHint")} · <a href="https://github.com/Team-Haruki" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hh-accent)]">haruki</a>)
                                                    </span>
                                                )}
                                            </div>
                                            {group.items.map((item) => {
                                                flatIndex++;
                                                const isActive = flatIndex === activeIndex;
                                                const idx = flatIndex;
                                                const route = SEARCH_GROUP_ROUTES[item.g] || `/${item.g}`;
                                                const href = `${route}/${item.id}`;
                                                // For cards, show character name; for music with matched alias, show the alias
                                                const subtitle = item.c
                                                    ? CHARACTER_NAMES[item.c] || ""
                                                    : "";
                                                // Show the active target title while all indexed locales remain searchable.
                                                const localizedTitle = item.g === "music"
                                                    ? (locale === "zh-CN" ? item.cn : locale === "en-US" ? item.en : "") || ""
                                                    : "";
                                                const aliasHint = item.g === "music" && item.matchedAlias && item.matchedAlias !== localizedTitle
                                                    ? `(${item.matchedAlias})`
                                                    : "";
                                                const musicSubtitle = [localizedTitle, aliasHint].filter(Boolean).join(" ");
                                                return (
                                                    <button
                                                        key={`${item.g}-${item.id}`}
                                                        data-active={isActive}
                                                        onClick={() => navigate(href)}
                                                        onMouseEnter={() => setActiveIndex(idx)}
                                                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isActive
                                                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                                                            : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                                                            }`}
                                                    >
                                                        <span className="flex flex-col items-start min-w-0">
                                                            <span className="font-medium truncate max-w-[280px]">
                                                                {item.n}
                                                            </span>
                                                            {(musicSubtitle || subtitle) && (
                                                                <span
                                                                    className={`text-xs truncate max-w-[280px] ${isActive ? "text-[var(--hh-text-on-accent)] opacity-70" : "text-[var(--hh-text-tertiary)]"
                                                                        }`}
                                                                >
                                                                    {musicSubtitle}
                                                                    {musicSubtitle && subtitle ? " · " : ""}
                                                                    {subtitle}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span
                                                            className={`hh-numeric text-xs font-mono flex-shrink-0 ${isActive ? "text-[var(--hh-text-on-accent)] opacity-70" : "text-[var(--hh-text-tertiary)]"
                                                                }`}
                                                        >
                                                            #{item.id}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}

                                    {/* Loading indicator for first load */}
                                    {isLoadingIndex && query && (
                                        <div className="px-4 py-3 text-center text-xs text-[var(--hh-text-tertiary)]">
                                            {t("search.commandPalette.loadingIndex")}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Key hint strip. Not an action bar: every command here
                            is one keystroke away, so buttons would restate the
                            hints instead of adding an answer. */}
                        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--hh-border)] bg-[var(--hh-surface-1)] text-[11px] text-[var(--hh-text-tertiary)]">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-[10px]">↑</kbd>
                                <kbd className="px-1 py-0.5 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-[10px]">↓</kbd>
                                {t("search.commandPalette.footer.navigate")}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-[10px]">Enter</kbd>
                                {t("search.commandPalette.footer.open")}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] text-[10px]">Esc</kbd>
                                {t("search.commandPalette.footer.close")}
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
