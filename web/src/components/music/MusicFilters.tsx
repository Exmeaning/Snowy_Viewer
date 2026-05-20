"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, FilterToggle, getFilterChipStateClasses, getFilterIconStateClasses } from "@/components/common/BaseFilters";
import {
    MusicTagType,
    MusicCategoryType,
    MUSIC_TAG_NAMES,
    MUSIC_CATEGORY_NAMES,
    MUSIC_CATEGORY_COLORS,
} from "@/types/music";
import { useI18n } from "@/contexts/I18nContext";

interface MusicFiltersProps {
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
    { id: "publishedAt", labelKey: "filter.sortByPublishedAt" },
    { id: "id", labelKey: "filter.sortById" },
    { id: "level", labelKey: "filter.sortByLevel" },
    { id: "constant", labelKey: "filter.sortByConstant" },
];

const DIFFICULTY_OPTIONS = [
    { id: "easy", label: "EASY", color: "from-green-400 to-green-500" },
    { id: "normal", label: "NORMAL", color: "from-blue-400 to-blue-500" },
    { id: "hard", label: "HARD", color: "from-yellow-400 to-yellow-500" },
    { id: "expert", label: "EXPERT", color: "from-red-400 to-red-500" },
    { id: "master", label: "MASTER", color: "from-purple-500 to-purple-600" },
    { id: "append", label: "APPEND", color: "from-pink-500 to-pink-600" },
];

export default function MusicFilters({
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
            filteredCount={filteredMusics}
            totalCount={totalMusics}
            countUnit={t("page.music.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder={t("page.music.searchPlaceholder")}
            sortOptions={customSortOptions || SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "publishedAt" | "id" | "level" | "constant", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Tag Filter */}
            <FilterSection label={t("common.filter.musicTag")}>
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(MUSIC_TAG_NAMES) as MusicTagType[]).map((tag) => {
                        const isSelected = selectedTag === tag;
                        const hasIcon = TAG_ICONS[tag];

                        return (
                            <button
                                key={tag}
                                onClick={() => onTagChange(tag)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${getFilterIconStateClasses(isSelected, "ring-2 ring-miku shadow-lg bg-white border border-transparent dark:bg-miku/12 dark:border-miku/40 dark:ring-miku/75", "bg-slate-50/50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-700/80 dark:hover:border-slate-600")}`}
                                title={t(`common.musicTags.${tag}`)}
                            >
                                {hasIcon && (
                                    <div className="w-5 h-5 relative">
                                        <Image
                                            src={TAG_ICONS[tag]!}
                                            alt=""
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                )}
                                <span className={`text-xs font-medium ${isSelected ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}>
                                    {t(`common.musicTags.${tag}`)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Category Filter */}
            <FilterSection label={t("common.filter.mvType")}>
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(MUSIC_CATEGORY_NAMES) as MusicCategoryType[]).map((cat) => {
                        const isSelected = selectedCategories.includes(cat);
                        return (
                            <button
                                key={cat}
                                onClick={() => toggleCategory(cat)}
                                className={`h-9 px-3 rounded-xl transition-all flex items-center justify-center border ${isSelected
                                    ? "text-white shadow-lg border-transparent ring-1 ring-white/30 dark:ring-white/10"
                                    : getFilterChipStateClasses(false, undefined, "bg-slate-50/50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/80 dark:hover:border-slate-600")
                                    }`}
                                style={
                                    isSelected
                                        ? { backgroundColor: MUSIC_CATEGORY_COLORS[cat] }
                                        : {}
                                }
                            >
                                <span className="text-xs font-medium">
                                    {t(`common.musicCategories.${cat}`)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Difficulty Filter - Only show when sorting by level */}
            {(sortBy === "level" || sortBy === "constant") && selectedDifficulty && onDifficultyChange && (
                <FilterSection label={t("common.filter.difficulty")}>
                    <div className="grid grid-cols-2 gap-2">
                        {DIFFICULTY_OPTIONS.map((diff) => {
                            const isSelected = selectedDifficulty === diff.id;
                            return (
                                <button
                                    key={diff.id}
                                    onClick={() => onDifficultyChange(diff.id)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${isSelected
                                        ? `bg-gradient-to-r ${diff.color} text-white shadow-lg ring-1 ring-white/30 dark:ring-white/10`
                                        : "bg-slate-50/50 border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/80 dark:hover:border-slate-600"
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
