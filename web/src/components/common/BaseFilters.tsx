"use client";
import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

export interface SortOption {
    id: string;
    label: string;
}

export interface BaseFiltersProps {
    /** Title shown in the header (default: "筛选") */
    title?: string;
    /** Count display format: "filtered / total" or just "total" */
    filteredCount: number;
    totalCount: number;
    /** Unit name for count display (e.g., "张", "首", "个") */
    countUnit?: string;

    // Search
    /** Search query value */
    searchQuery?: string;
    /** Search change handler */
    onSearchChange?: (query: string) => void;
    /** Placeholder text for search input */
    searchPlaceholder?: string;
    /** Whether to show search box (default: true if onSearchChange provided) */
    showSearch?: boolean;

    // Sort
    /** Available sort options */
    sortOptions?: SortOption[];
    /** Current sort field */
    sortBy?: string;
    /** Current sort order */
    sortOrder?: "asc" | "desc";
    /** Sort change handler */
    onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void;

    // Reset
    /** Whether to show reset button */
    hasActiveFilters?: boolean;
    /** Reset handler */
    onReset?: () => void;

    // Children (custom filter sections)
    children?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export default function BaseFilters({
    title = "筛选",
    filteredCount,
    totalCount,
    countUnit = "",
    searchQuery = "",
    onSearchChange,
    searchPlaceholder = "搜索...",
    showSearch = true,
    sortOptions,
    sortBy,
    sortOrder,
    onSortChange,
    hasActiveFilters = false,
    onReset,
    children,
}: BaseFiltersProps) {
    const pathname = usePathname();
    const STORAGE_KEY = `filters_collapsed:${pathname}`;
    const rootRef = useRef<HTMLDivElement>(null);
    const [isInsideQuickFilter, setIsInsideQuickFilter] = useState(false);
    const [mobileCollapsed, setMobileCollapsed] = useState(() => {
        if (typeof window === "undefined") return true;
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === null ? true : saved === "true";
    });

    useEffect(() => {
        if (rootRef.current?.closest(".quick-filter-modal-content")) {
            setIsInsideQuickFilter(true);
        }
    }, []);

    const toggleCollapsed = () => {
        setMobileCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
            return next;
        });
    };

    const handleSortClick = (optionId: string) => {
        if (!onSortChange) return;
        // Toggle order if clicking same option, otherwise default to desc
        const newOrder = sortBy === optionId && sortOrder === "desc" ? "asc" : "desc";
        onSortChange(optionId, newOrder);
    };

    return (
        <div ref={rootRef} data-shortcut-filters="true" className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            {/* Header — clickable on mobile to toggle collapse */}
            <div
                className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between lg:cursor-default cursor-pointer select-none"
                onClick={toggleCollapsed}
            >
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {title}
                    {/* Active filter indicator dot — mobile only, shown when collapsed with active filters */}
                    {hasActiveFilters && mobileCollapsed && (
                        <span className="lg:hidden w-2 h-2 rounded-full bg-miku animate-pulse" />
                    )}
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        {filteredCount === totalCount
                            ? `${totalCount}${countUnit ? ` ${countUnit}` : ""}`
                            : `${filteredCount} / ${totalCount}`}
                    </span>
                    {/* Collapse chevron — mobile only */}
                    <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 lg:hidden ${mobileCollapsed ? "" : "rotate-180"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Search — always visible */}
            {showSearch && onSearchChange && (
                <div className="px-5 pt-5">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        搜索
                    </label>
                    <div className="relative">
                        <input
                            data-shortcut-search="true"
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku transition-all"
                        />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Collapsible section — collapsed on mobile by default, always visible on lg+ */}
            <div data-filter-collapsible="true" className={`${mobileCollapsed ? "hidden" : "block"} lg:!block`}>
                <div className="p-5 space-y-5">
                    {/* Sort Options */}
                    {sortOptions && sortOptions.length > 0 && onSortChange && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                排序
                            </label>
                            <div className={`grid gap-2 ${sortOptions.length <= 2 ? "grid-cols-2" : sortOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                                {sortOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => handleSortClick(opt.id)}
                                        className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === opt.id
                                            ? "bg-miku text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                    >
                                        {opt.label}
                                        {sortBy === opt.id && (
                                            <svg className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Filter Sections (children) */}
                    {children}

                    {/* Reset Button */}
                    {hasActiveFilters && onReset && (
                        <button
                            onClick={onReset}
                            className="w-full py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            重置筛选
                        </button>
                    )}

                    {/* "Tap to collapse" bar — mobile only, hidden in quick filter modal */}
                    {!isInsideQuickFilter && (
                    <div
                        data-filter-collapse-bar="true"
                        className="lg:hidden -mx-5 -mb-5 mt-5 flex items-center justify-center gap-1 py-2.5 bg-slate-50 border-t border-slate-100 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                        onClick={toggleCollapsed}
                    >
                        <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        点击收起
                    </div>
                    )}
                </div>
            </div>

            {/* "Tap to expand" hint bar — mobile only, shown when collapsed */}
            {mobileCollapsed && (
                <div
                    data-filter-collapse-pad="true"
                    className="lg:hidden flex items-center justify-center gap-1 py-2.5 mt-4 bg-slate-50 border-t border-slate-100 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                    onClick={toggleCollapsed}
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    点击展开筛选
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Helper Components for custom filter sections
// ============================================================================

interface FilterSectionProps {
    label: string;
    children: React.ReactNode;
}

export function FilterSection({ label, children }: FilterSectionProps) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                {label}
            </label>
            {children}
        </div>
    );
}

interface FilterButtonProps {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export function FilterButton({ selected, onClick, children, className = "", style }: FilterButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selected
                ? "bg-miku text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                } ${className}`}
            style={style}
        >
            {children}
        </button>
    );
}

interface FilterToggleProps {
    selected: boolean;
    onClick: () => void;
    label: string;
}

export function FilterToggle({ selected, onClick, label }: FilterToggleProps) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${selected
                ? "ring-2 ring-miku shadow-lg bg-white border-transparent"
                : "hover:bg-slate-50 border-slate-200 bg-slate-50/50"
                }`}
        >
            <span className={`text-sm font-bold ${selected ? "text-slate-800" : "text-slate-600"}`}>
                {label}
            </span>
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selected ? "bg-miku border-miku" : "border-slate-300 bg-white"}`}>
                {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
        </button>
    );
}
