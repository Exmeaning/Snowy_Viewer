"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, FilterToggle } from "@/components/common/BaseFilters";
import {
    MusicTagType,
    MusicCategoryType,
    MUSIC_TAG_NAMES,
    MUSIC_CATEGORY_NAMES,
    MUSIC_CATEGORY_COLORS,
} from "@/types/music";

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
    // Sort
    sortBy: "publishedAt" | "id";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "publishedAt" | "id", sortOrder: "asc" | "desc") => void;
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

const SORT_OPTIONS = [
    { id: "publishedAt", label: "发布日期" },
    { id: "id", label: "ID" },
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
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalMusics,
    filteredMusics,
}: MusicFiltersProps) {

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
            countUnit="首"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索歌曲名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "publishedAt" | "id", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
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
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${isSelected
                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                    : "hover:bg-slate-100 border border-slate-200 bg-slate-50/50"
                                    }`}
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
                                <span className="text-xs font-medium text-slate-600">
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
                                    ? "text-white shadow-lg border-transparent"
                                    : "hover:bg-slate-100 border-slate-200 bg-slate-50/50 text-slate-600"
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

            {/* Other Filters (Event Only) */}
            <FilterSection label="其他筛选">
                <FilterToggle
                    selected={hasEventOnly}
                    onClick={() => onHasEventOnlyChange(!hasEventOnly)}
                    label="仅显示活动歌曲"
                />
            </FilterSection>
        </BaseFilters>
    );
}
