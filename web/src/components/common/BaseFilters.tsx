"use client";
import React from "react";

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
    const handleSortClick = (optionId: string) => {
        if (!onSortChange) return;
        // Toggle order if clicking same option, otherwise default to desc
        const newOrder = sortBy === optionId && sortOrder === "desc" ? "asc" : "desc";
        onSortChange(optionId, newOrder);
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    {title}
                </h2>
                <span className="text-xs text-slate-500">
                    {filteredCount === totalCount
                        ? `${totalCount}${countUnit ? ` ${countUnit}` : ""}`
                        : `${filteredCount} / ${totalCount}`}
                </span>
            </div>

            <div className="p-5 space-y-5">
                {/* Search */}
                {showSearch && onSearchChange && (
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            搜索
                        </label>
                        <div className="relative">
                            <input
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
            </div>
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
