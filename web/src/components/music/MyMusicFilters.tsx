"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, getFilterChipStateClasses, getFilterIconStateClasses } from "@/components/common/BaseFilters";
import {
    MusicTagType,
    MusicCategoryType,
    MUSIC_TAG_NAMES,
    MUSIC_CATEGORY_NAMES,
    MUSIC_CATEGORY_COLORS,
} from "@/types/music";

interface MyMusicFiltersProps {
    // Tag filter
    selectedTag: MusicTagType;
    onTagChange: (tag: MusicTagType) => void;
    // Category filter
    selectedCategories: MusicCategoryType[];
    onCategoryChange: (categories: MusicCategoryType[]) => void;
    // Difficulty filter
    selectedDifficulty: string;
    onDifficultyChange: (difficulty: string) => void;
    // Completion filter
    completionFilter: "all" | "no_fc" | "no_ap";
    onCompletionFilterChange: (filter: "all" | "no_fc" | "no_ap") => void;
    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;
    // Sort
    sortBy: "publishedAt" | "id" | "level" | "completion" | "constant";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "publishedAt" | "id" | "level" | "completion" | "constant", sortOrder: "asc" | "desc") => void;
    // Reset
    onReset: () => void;
    // Stats
    totalMusics: number;
    filteredMusics: number;
    // User data availability
    hasUserData: boolean;
}

// Unit icon mapping for tags
const TAG_ICONS: Partial<Record<MusicTagType, string>> = {
    vocaloid: "/data/icon/vs.webp",
    theme_park: "/data/icon/wxs.webp",
    street: "/data/icon/vbs.webp",
    idol: "/data/icon/mmj.webp",
    school_refusal: "/data/icon/n25.webp",
    light_music_club: "/data/icon/ln.webp",
};

const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "EASY" },
    { value: "normal", label: "NORMAL" },
    { value: "hard", label: "HARD" },
    { value: "expert", label: "EXPERT" },
    { value: "master", label: "MASTER" },
    { value: "append", label: "APPEND" },
];

const SORT_OPTIONS = [
    { id: "completion", label: "完成度" },
    { id: "publishedAt", label: "发布日期" },
    { id: "id", label: "ID" },
    { id: "level", label: "难度" },
    { id: "constant", label: "定数" },
];

export default function MyMusicFilters({
    selectedTag,
    onTagChange,
    selectedCategories,
    onCategoryChange,
    selectedDifficulty,
    onDifficultyChange,
    completionFilter,
    onCompletionFilterChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalMusics,
    filteredMusics,
    hasUserData,
}: MyMusicFiltersProps) {

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
        completionFilter !== "all" ||
        searchQuery.trim() !== "";

    return (
        <BaseFilters
            filteredCount={filteredMusics}
            totalCount={totalMusics}
            countUnit="首"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索歌曲名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "publishedAt" | "id" | "level" | "completion" | "constant", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Difficulty Selection */}
            <FilterSection label="难度">
                <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTY_OPTIONS.map((diff) => {
                        const isSelected = selectedDifficulty === diff.value;
                        return (
                            <button
                                key={diff.value}
                                onClick={() => onDifficultyChange(diff.value)}
                                className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${getFilterChipStateClasses(isSelected)}`}
                            >
                                {diff.label}
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Tag Filter */}
            <FilterSection label="乐曲标签">
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(MUSIC_TAG_NAMES) as MusicTagType[]).map((tag) => {
                        const isSelected = selectedTag === tag;
                        const hasIcon = TAG_ICONS[tag];

                        return (
                            <button
                                key={tag}
                                onClick={() => onTagChange(tag)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${getFilterIconStateClasses(isSelected, "ring-2 ring-miku shadow-lg bg-white border border-transparent dark:bg-miku/12 dark:border-miku/40 dark:ring-miku/75", "bg-slate-50/50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-700/80 dark:hover:border-slate-600")}`}
                                title={MUSIC_TAG_NAMES[tag]}
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
                                    {MUSIC_TAG_NAMES[tag]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Category Filter */}
            <FilterSection label="MV类型">
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
                                    {MUSIC_CATEGORY_NAMES[cat]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Completion Filter */}
            {hasUserData && (
                <FilterSection label="完成度筛选">
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => onCompletionFilterChange("all")}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${getFilterChipStateClasses(completionFilter === "all")}`}
                        >
                            全部
                        </button>
                        <button
                            onClick={() => onCompletionFilterChange("no_fc")}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${getFilterChipStateClasses(completionFilter === "no_fc")}`}
                        >
                            未FC
                        </button>
                        <button
                            onClick={() => onCompletionFilterChange("no_ap")}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${getFilterChipStateClasses(completionFilter === "no_ap")}`}
                        >
                            未AP
                        </button>
                    </div>
                </FilterSection>
            )}
        </BaseFilters>
    );
}
