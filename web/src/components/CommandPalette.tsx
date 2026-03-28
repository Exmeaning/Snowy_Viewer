"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { searchableNavItems, SEARCH_GROUP_LABELS, SEARCH_GROUP_ROUTES } from "@/lib/navigation";
import { CHARACTER_NAMES } from "@/types/types";
import { getPrimaryShortcutLabel, isKeyboardEventComposing } from "@/lib/shortcuts";
import { fetchMusicAliases } from "@/lib/musicAliases";

// Dynamic search index item from search-index.json
interface SearchIndexItem {
    id: number;
    n: string;   // name (JP)
    cn?: string;  // name (CN translation)
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

            // Load search index and music aliases in parallel
            Promise.all([
                fetch("https://translation.exmeaning.com/data/search-index.json")
                    .then((res) => res.json()) as Promise<SearchIndexItem[]>,
                fetchMusicAliases().catch(() => new Map()) // Don't fail if aliases fail to load
            ])
                .then(([indexData, aliasesMap]) => {
                    setSearchIndex(indexData);
                    setMusicAliasesMap(aliasesMap);
                    setIsLoadingIndex(false);
                })
                .catch((err) => {
                    console.warn("Failed to load search index:", err);
                    setIsLoadingIndex(false);
                });
        }
    }, [isOpen, isLoadingIndex]);

    // Filter items based on query
    const searchRegex = useMemo(() => {
        if (!useWildcard) return null;
        const q = query.trim();
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
        } catch (e) {
            return null;
        }
    }, [query, useWildcard]);

    const filtered = useMemo(() => {
        const qStr = query.trim();
        if (!qStr) return searchableNavItems;
        const q = qStr.toLowerCase();

        return searchableNavItems.filter((item) => {
            if (searchRegex) {
                return searchRegex.test(item.name) ||
                    searchRegex.test(item.href) ||
                    searchRegex.test(item.group) ||
                    item.keywords.some((kw) => searchRegex.test(kw));
            } else {
                return item.name.toLowerCase().includes(q) ||
                    item.href.toLowerCase().includes(q) ||
                    item.group.toLowerCase().includes(q) ||
                    item.keywords.some((kw) => kw.toLowerCase().includes(q));
            }
        });
    }, [query, searchableNavItems, searchRegex]);

    // Filter dynamic search index items based on query
    const dynamicFiltered = useMemo(() => {
        const qStr = query.trim();
        if (!qStr || !searchIndex) return [];
        const q = qStr.toLowerCase();

        const matched: SearchResultItem[] = searchIndex.map((item) => {
            const idStr = item.id.toString();
            if (searchRegex) {
                if (searchRegex.test(idStr)) return { ...item };
                if (searchRegex.test(item.n)) return { ...item };
                if (item.cn && searchRegex.test(item.cn)) return { ...item };
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
    }, [query, searchIndex, searchRegex, musicAliasesMap]);

    // Combined flat list for keyboard navigation
    const totalItems = filtered.length + dynamicFiltered.length;

    // Group filtered static items
    const grouped = useMemo(() => {
        const groups: { title: string; items: typeof filtered }[] = [];
        const groupMap = new Map<string, typeof filtered>();
        for (const item of filtered) {
            const existing = groupMap.get(item.group);
            if (existing) {
                existing.push(item);
            } else {
                const arr = [item];
                groupMap.set(item.group, arr);
                groups.push({ title: item.group, items: arr });
            }
        }
        return groups;
    }, [filtered]);

    // Group dynamic items
    const dynamicGrouped = useMemo(() => {
        const groups: { title: string; items: SearchResultItem[] }[] = [];
        const groupMap = new Map<string, SearchResultItem[]>();
        for (const item of dynamicFiltered) {
            const groupLabel = SEARCH_GROUP_LABELS[item.g] || item.g;
            const existing = groupMap.get(groupLabel);
            if (existing) {
                existing.push(item);
            } else {
                const arr = [item];
                groupMap.set(groupLabel, arr);
                groups.push({ title: groupLabel, items: arr });
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

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Reset active index when filtered results change
    useEffect(() => {
        setActiveIndex(0);
    }, [filtered, dynamicFiltered]);

    const navigate = useCallback(
        (href: string) => {
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
                    setActiveIndex((prev) => (prev + 1) % totalItems);
                    break;
                case "ArrowUp":
                    if (totalItems === 0) return;
                    e.preventDefault();
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
                    onClose();
                    break;
                case "q":
                case "Q":
                case "œ":
                    // macOS Option+Q triggers œ, keep both for compatibility
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
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
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[min(20vh,8rem)] px-4">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col max-h-[70vh]"
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        onKeyDown={handleKeyDown}
                    >
                        {/* Search input */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2 border-b border-slate-200">
                            <div className="flex items-center gap-3 flex-1">
                                <svg
                                    className="w-5 h-5 text-slate-400 flex-shrink-0"
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
                                    placeholder="搜索页面、卡牌、歌曲、活动..."
                                    className="flex-1 py-1.5 sm:py-2.5 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none min-w-0"
                                />
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
                                    ESC
                                </kbd>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 shrink-0">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                    通配符 (*, ?)
                                    <kbd className="hidden sm:inline-flex items-center px-1 py-0.5 text-[9px] font-mono font-medium text-slate-400 bg-slate-100 rounded border border-slate-200 shadow-sm leading-none h-4">
                                        {wildcardShortcut}
                                    </kbd>
                                </span>
                                <button
                                    onClick={() => setUseWildcard(!useWildcard)}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useWildcard ? 'bg-miku' : 'bg-slate-200'}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useWildcard ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
                            {totalItems === 0 && !isLoadingIndex ? (
                                <div className="px-4 py-8 text-center text-sm text-slate-400">
                                    没有找到匹配的结果
                                </div>
                            ) : (
                                <>
                                    {/* Static navigation results */}
                                    {grouped.map((group) => (
                                        <div key={group.title}>
                                            <div className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                {group.title}
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
                                                            ? "bg-miku/10 text-miku"
                                                            : "text-slate-600 hover:bg-slate-50"
                                                            }`}
                                                    >
                                                        <span className="font-medium">{item.name}</span>
                                                        <span
                                                            className={`text-xs ${isActive ? "text-miku/60" : "text-slate-400"
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
                                        <div key={`dyn-${group.title}`}>
                                            <div className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                {group.title}
                                                {group.title === "歌曲" && (
                                                    <span className="font-normal normal-case text-[10px] text-slate-400/70">
                                                        (含别名 · <a href="https://github.com/Team-Haruki" target="_blank" rel="noopener noreferrer" className="hover:text-miku">haruki</a>)
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
                                                // For music, show CN title; if matched via alias, append alias
                                                const cnTitle = item.g === "music" ? (item.cn || "") : "";
                                                const aliasHint = item.g === "music" && item.matchedAlias && item.matchedAlias !== item.cn
                                                    ? `(${item.matchedAlias})`
                                                    : "";
                                                const musicSubtitle = [cnTitle, aliasHint].filter(Boolean).join(" ");
                                                return (
                                                    <button
                                                        key={`${item.g}-${item.id}`}
                                                        data-active={isActive}
                                                        onClick={() => navigate(href)}
                                                        onMouseEnter={() => setActiveIndex(idx)}
                                                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isActive
                                                            ? "bg-miku/10 text-miku"
                                                            : "text-slate-600 hover:bg-slate-50"
                                                            }`}
                                                    >
                                                        <span className="flex flex-col items-start min-w-0">
                                                            <span className="font-medium truncate max-w-[280px]">
                                                                {item.n}
                                                            </span>
                                                            {(musicSubtitle || subtitle) && (
                                                                <span
                                                                    className={`text-xs truncate max-w-[280px] ${isActive ? "text-miku/50" : "text-slate-400"
                                                                        }`}
                                                                >
                                                                    {musicSubtitle}
                                                                    {musicSubtitle && subtitle ? " · " : ""}
                                                                    {subtitle}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span
                                                            className={`text-xs font-mono flex-shrink-0 ${isActive ? "text-miku/60" : "text-slate-400"
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
                                        <div className="px-4 py-3 text-center text-xs text-slate-400">
                                            正在加载数据索引...
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer hints */}
                        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">↑</kbd>
                                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">↓</kbd>
                                导航
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">Enter</kbd>
                                跳转
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">Esc</kbd>
                                关闭
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
