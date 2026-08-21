"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, FilterToggle, getFilterChipStateClasses, getFilterIconStateClasses } from "@/components/common/BaseFilters";
import {
    MusicTagType,
    MusicCategoryType,
    MUSIC_TAG_IDS,
    MUSIC_CATEGORY_IDS,
    MUSIC_TAG_LABEL_KEYS,
    MUSIC_CATEGORY_LABEL_KEYS,
    MUSIC_CATEGORY_COLORS,
} from "@/types/music";
import { useI18n } from "@/contexts/I18nContext";

interface MusicFiltersProps {
    // Context labels
    title?: string;
    countUnit?: string;
    searchPlaceholder?: string;
    // Tag filter
    selectedTag: MusicTagType;
    onTagChange: (tag: MusicTagType) => void;
    // Category filter
    selectedCategories: MusicCategoryType[];
    onCategoryChange: (categories: MusicCategoryType[]) => void;
    // Event filter
    hasEventOnly: boolean;
    onHasEventOnlyChange: (checked: boolean) => void;
    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // Difficulty filter
    selectedDifficulty?: string;
    onDifficultyChange?: (difficulty: string) => void;
    // Show difficulty toggle
    showDifficulty?: boolean;
    onShowDifficultyChange?: (checked: boolean) => void;
    // Sort
    sortBy: "publishedAt" | "id" | "level" | "constant";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "publishedAt" | "id" | "level" | "constant", sortOrder: "asc" | "desc") => void;
    /** Override default sort options (e.g. to hide level/constant in contexts without difficulty) */
    customSortOptions?: { id: string; label: string }[];
    // Reset
    onReset: () => void;
    // Stats
    totalMusics: number;
    filteredMusics: number;
}

// Unit icon mapping for tags (local icons to match card filters)
const TAG_ICONS: Partial<Record<MusicTagType, string>> = {
    vocaloid: "/data/icon/vs.webp",
    theme_park: "/data/icon/wxs.webp",
    street: "/data/icon/vbs.webp",
    idol: "/data/icon/mmj.webp",
    school_refusal: "/data/icon/n25.webp",
    light_music_club: "/data/icon/ln.webp",
};

const SORT_OPTIONS_BASE = [
    { id: "publishedAt", labelKey: "common.filter.sortByPublishedAt" },
    { id: "id", labelKey: "common.filter.sortById" },
    { id: "level", labelKey: "common.filter.sortByLevel" },
    { id: "constant", labelKey: "common.filter.sortByConstant" },
];

const DIFFICULTY_OPTIONS = [
    { id: "easy", label: "EASY" },
    { id: "normal", label: "NORMAL" },
    { id: "hard", label: "HARD" },
    { id: "expert", label: "EXPERT" },
    { id: "master", label: "MASTER" },
    { id: "append", label: "APPEND" },
];

export default function MusicFilters({
    title,
    countUnit,
    searchPlaceholder,
    selectedTag,
    onTagChange,
    selectedCategories,
    onCategoryChange,
    hasEventOnly,
    onHasEventOnlyChange,
    searchQuery,
    onSearchChange,
    selectedDifficulty,
    onDifficultyChange,
    showDifficulty,
    onShowDifficultyChange,
    sortBy,
    sortOrder,
    onSortChange,
    customSortOptions,
    onReset,
    totalMusics,
    filteredMusics,
}: MusicFiltersProps) {
    const { t } = useI18n();

    const SORT_OPTIONS = SORT_OPTIONS_BASE.map(opt => ({
        id: opt.id,
        label: t(opt.labelKey),
    }));

    const toggleCategory = (cat: MusicCategoryType) => {
        if (selectedCategories.includes(cat)) {
            onCategoryChange(selectedCategories.filter((c) => c !== cat));
        } else {
            onCategoryChange([...selectedCategories, cat]);
        }
    };

    const hasActiveFilters =
        selectedTag !== "all" ||
        selectedCategories.length > 0 ||
        hasEventOnly ||
        searchQuery.trim() !== "";

    return (
        <BaseFilters
            title={title}
            filteredCount={filteredMusics}
            totalCount={totalMusics}
            countUnit={countUnit ?? t("page.music.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder ?? t("page.music.searchPlaceholder")}
            sortOptions={customSortOptions || SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "publishedAt" | "id" | "level" | "constant", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Tag Filter */}
            <FilterSection label={t("common.filter.musicTag")}>
                <div className="flex flex-wrap items-center gap-2">
                    {MUSIC_TAG_IDS.map((tag) => {
                        const isSelected = selectedTag === tag;
                        const icon = TAG_ICONS[tag];
                        const label = t(MUSIC_TAG_LABEL_KEYS[tag]);

                        // Unit tags: icon-only button (like card filters), no redundant text
                        if (icon) {
                            return (
                                <button
                                    key={tag}
                                    onClick={() => onTagChange(tag)}
                                    className={`hh-press p-1.5 rounded-[var(--hh-radius-md)] cursor-pointer ${getFilterIconStateClasses(isSelected)}`}
                                    title={label}
                                    aria-label={label}
                                    aria-pressed={isSelected}
                                >
                                    <div className="w-7 h-7 relative">
                                        <Image
                                            src={icon}
                                            alt={label}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                </button>
                            );
                        }

                        // Text-only tags (all, other, ...)
                        return (
                            <button
                                key={tag}
                                onClick={() => onTagChange(tag)}
                                className={`hh-press px-3 py-1.5 rounded-[var(--hh-radius-md)] text-xs font-medium cursor-pointer ${getFilterChipStateClasses(isSelected)}`}
                                title={label}
                                aria-pressed={isSelected}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Category Filter */}
            <FilterSection label={t("common.filter.mvType")}>
                <div className="flex flex-wrap gap-2">
                    {MUSIC_CATEGORY_IDS.map((cat) => {
                        const isSelected = selectedCategories.includes(cat);
                        const label = t(MUSIC_CATEGORY_LABEL_KEYS[cat]);
                        return (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`hh-press h-9 px-3 rounded-[var(--hh-radius-md)] cursor-pointer flex items-center justify-center border ${isSelected
                                    ? "text-white border-black/20"
                                    : getFilterChipStateClasses(false)
                                    }`}
                                // Selected fill is the MV category's own semantic color.
                                style={
                                    isSelected
                                        ? { backgroundColor: MUSIC_CATEGORY_COLORS[cat] }
                                        : {}
                                }
                            >
                                <span className="text-xs font-medium">
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Difficulty Filter - Only show when sorting by level */}
            {(sortBy === "level" || sortBy === "constant") && selectedDifficulty && onDifficultyChange && (
                <FilterSection label={t("common.filter.difficulty")}>
                    <div className="grid grid-cols-3 gap-1.5">
                        {DIFFICULTY_OPTIONS.map((diff) => {
                            const isSelected = selectedDifficulty === diff.id;
                            return (
                                <button
                                    key={diff.id}
                                    type="button"
                                    onClick={() => onDifficultyChange(diff.id)}
                                    className={`hh-press py-1.5 px-2 rounded-[var(--hh-radius-md)] text-xs font-bold transition-all cursor-pointer border ${
                                        isSelected
                                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] border-[var(--hh-accent-line)]"
                                            : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] border-[var(--hh-border)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                                    }`}
                                >
                                    {diff.label}
                                </button>
                            );
                        })}
                    </div>
                </FilterSection>
            )}

            {/* Other Filters */}
            <FilterSection label={t("common.filter.otherFilters")}>
                <div className="space-y-2">
                    <FilterToggle
                        selected={hasEventOnly}
                        onClick={() => onHasEventOnlyChange(!hasEventOnly)}
                        label={t("common.filter.eventSongsOnly")}
                    />
                    {onShowDifficultyChange && (
                        <FilterToggle
                            selected={!!showDifficulty}
                            onClick={() => onShowDifficultyChange(!showDifficulty)}
                            label={t("common.filter.showDifficulty")}
                        />
                    )}
                </div>
            </FilterSection>
        </BaseFilters>
    );
}
