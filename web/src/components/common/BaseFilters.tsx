"use client";
import React, { useCallback, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { playHandheldSound } from "@/lib/handheld-sound";

// ============================================================================
// Types
// ============================================================================

export interface SortOption {
    id: string;
    label: string;
}

export interface BaseFiltersProps {
    /** Optional title override (if shown in legacy/custom contexts) */
    title?: string;
    /** Count display format: "filtered / total" or just "total" */
    filteredCount: number;
    totalCount: number;
    /** Unit name for count display (e.g., cards, songs, items) */
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
// Shared filter styling helpers (Handheld Flat System)
// ============================================================================

/**
 * Returns class names for standard filter chips (e.g. tag/character/rarity buttons).
 * Tight 8px radius (--hh-radius-md), flat opaque surface, crisp active accent fill.
 */
export function getFilterChipStateClasses(
    selected: boolean,
    selectedClassName?: string,
    unselectedClassName?: string
): string {
    const selectedState = selectedClassName ?? "hh-chip hh-chip-active font-semibold shadow-none";
    const unselectedState = unselectedClassName ?? "hh-chip font-medium";

    return selected ? selectedState : unselectedState;
}

/**
 * Returns class names for icon-based filter chips (e.g. attribute/unit icons).
 */
export function getFilterIconStateClasses(
    selected: boolean,
    selectedClassName?: string,
    unselectedClassName?: string
): string {
    const selectedState = selectedClassName ?? "hh-chip hh-chip-active ring-2 ring-[var(--hh-accent-line)] scale-[1.03]";
    const unselectedState = unselectedClassName ?? "hh-chip";

    return selected ? selectedState : unselectedState;
}

/**
 * Returns class names for filter toggle rows (full-width switches).
 */
export function getFilterToggleStateClasses(selected: boolean): string {
    return selected
        ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent-line)] text-[var(--hh-accent-deep)]"
        : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)]";
}

// ============================================================================
// BaseFilters Component
// ============================================================================

/**
 * BaseFilters — Flat Handheld Filter Panel Component.
 *
 * Visual & Structural Principles:
 * 1. Flat & Unembellished: Completely stripped of glassmorphism (no blur, no gradients,
 *    no dashed borders, no thick 24px/32px radii). Radii are tightened to --hh-radius-md (8px).
 * 2. Unambiguous Hierarchy: The outer drawer (`FilterDrawer.tsx`) owns the main
 *    structural section header. BaseFilters does not duplicate a large "Filters" header bar;
 *    instead it renders a lightweight status strip with filtered count and fast reset.
 * 3. Exact Hook & Keyboard Accessibility: Maintains `data-shortcut-filters` on root and
 *    `data-shortcut-search` on input for single-mount shortcut indexing.
 * 4. Sound Cues: Preserves all 5 standard sound cues across search, sort, toggle, and reset.
 */
export default function BaseFilters({
    filteredCount,
    totalCount,
    countUnit = "",
    searchQuery = "",
    onSearchChange,
    searchPlaceholder,
    showSearch = true,
    sortOptions,
    sortBy,
    sortOrder,
    onSortChange,
    hasActiveFilters = false,
    onReset,
    children,
}: BaseFiltersProps) {
    const { t } = useI18n();
    const resolvedSearchPlaceholder = searchPlaceholder ?? t("common.filter.search") + "...";

    const [, setRootElement] = useState<HTMLDivElement | null>(null);
    const rootRef = useCallback((node: HTMLDivElement | null) => {
        setRootElement((current) => (current === node ? current : node));
    }, []);

    // Format count display
    const countText = filteredCount === totalCount
        ? `${totalCount} ${countUnit}`
        : `${filteredCount} / ${totalCount} ${countUnit}`;

    const handleSortClick = (optionId: string) => {
        if (!onSortChange) return;

        if (sortBy === optionId) {
            playHandheldSound("toggle");
            onSortChange(optionId, sortOrder === "asc" ? "desc" : "asc");
        } else {
            playHandheldSound("confirm");
            onSortChange(optionId, "desc");
        }
    };

    const handleReset = () => {
        playHandheldSound("back");
        onReset?.();
    };

    const handleClearSearch = () => {
        playHandheldSound("back");
        onSearchChange?.("");
    };

    return (
        <div
            ref={rootRef}
            data-shortcut-filters="true"
            className="w-full flex flex-col gap-4 text-[var(--hh-text-primary)]"
        >
            {/* Status bar: item count & quick reset */}
            <div className="flex items-center justify-between px-0.5 text-xs text-[var(--hh-text-tertiary)] font-mono">
                <span className="font-medium tracking-tight">
                    {countText}
                </span>
                {hasActiveFilters && onReset && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="hh-press text-xs font-sans font-medium text-[var(--hh-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t("common.filter.reset")}
                    </button>
                )}
            </div>

            {/* Search Box */}
            {showSearch && onSearchChange && (
                <div className="relative">
                    <input
                        data-shortcut-search="true"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={resolvedSearchPlaceholder}
                        className="hh-input w-full h-9 pl-8 pr-8 text-xs font-medium"
                    />
                    <svg
                        className="w-3.5 h-3.5 text-[var(--hh-text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="hh-press absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* Sort Options */}
            {sortOptions && sortOptions.length > 0 && onSortChange && (
                <div className="space-y-1.5">
                    <label className="hh-label block px-0.5">
                        {t("common.filter.sort")}
                    </label>
                    <div className={`grid gap-1.5 ${sortOptions.length <= 2 ? "grid-cols-2" : sortOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                        {sortOptions.map((opt) => {
                            const isSelected = sortBy === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleSortClick(opt.id)}
                                    className={`hh-press px-2 py-1.5 flex items-center justify-center gap-1 cursor-pointer ${getFilterChipStateClasses(isSelected)}`}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSelected && (
                                        <svg
                                            className={`w-3 h-3 shrink-0 transition-transform duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] ${sortOrder === "asc" ? "rotate-180" : ""}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Filter Sections (children) */}
            {children}

            {/* Bottom Full Reset Button (for accessible / touch-friendly reset action) */}
            {hasActiveFilters && onReset && (
                <button
                    type="button"
                    onClick={handleReset}
                    className="hh-press hh-btn w-full py-2 rounded-[var(--hh-radius-md)] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-3)] border border-[var(--hh-border)]"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t("common.filter.reset")}
                </button>
            )}
        </div>
    );
}

// ============================================================================
// Helper Components for custom filter sections
// ============================================================================

export interface FilterSectionProps {
    label: string;
    children: React.ReactNode;
}

export function FilterSection({ label, children }: FilterSectionProps) {
    return (
        <div className="space-y-1.5">
            <label className="hh-label block px-0.5">
                {label}
            </label>
            <div>{children}</div>
        </div>
    );
}

export interface FilterButtonProps {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * Every filter chip on every list page routes through FilterButton.
 * Preserves the sound cue and passes through standard click handling.
 */
export function FilterButton({ selected, onClick, children, className = "", style }: FilterButtonProps) {
    const handleClick = () => {
        playHandheldSound("toggle");
        onClick();
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`hh-press cursor-pointer ${getFilterChipStateClasses(selected)} ${className}`}
            style={style}
        >
            {children}
        </button>
    );
}

export interface FilterToggleProps {
    selected: boolean;
    onClick: () => void;
    label: string;
}

export function FilterToggle({ selected, onClick, label }: FilterToggleProps) {
    const handleClick = () => {
        playHandheldSound("toggle");
        onClick();
    };

    return (
        <button
            type="button"
            role="switch"
            aria-checked={selected}
            onClick={handleClick}
            className="hh-press w-full flex items-center justify-between px-3 py-2 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] border border-[var(--hh-border)] cursor-pointer text-[var(--hh-text-primary)] transition-colors duration-[var(--hh-dur-fast)]"
        >
            <span className="text-sm font-medium">
                {label}
            </span>
            <span className={`hh-switch shrink-0 ${selected ? "hh-switch-active" : ""}`}>
                <span className="hh-switch-thumb" />
            </span>
        </button>
    );
}
