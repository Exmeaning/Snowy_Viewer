"use client";
import React from "react";
import Image from "next/image";
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
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    筛选
                </h2>
                <span className="text-xs text-slate-500">
                    {filteredMusics} / {totalMusics}
                </span>
            </div>

            <div className="p-5 space-y-5">
                {/* Search */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        搜索
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索歌曲..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku transition-all"
                        />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Sort Options */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        排序
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: "publishedAt", label: "发布日期" },
                            { id: "id", label: "ID" }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onSortChange(opt.id as any, sortBy === opt.id && sortOrder === "desc" ? "asc" : "desc")}
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

                {/* Tag Filter */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        乐曲标签
                    </label>
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
                </div>

                {/* Category Filter */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        MV类型
                    </label>
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
                </div>

                {/* Other Filters (Event Only) */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        其他筛选
                    </label>
                    <button
                        onClick={() => onHasEventOnlyChange(!hasEventOnly)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${hasEventOnly
                            ? "ring-2 ring-miku shadow-lg bg-white border-transparent"
                            : "hover:bg-slate-50 border-slate-200 bg-slate-50/50"
                            }`}
                    >
                        <span className={`text-sm font-bold ${hasEventOnly ? "text-slate-800" : "text-slate-600"}`}>
                            仅显示活动歌曲
                        </span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${hasEventOnly ? "bg-miku border-miku" : "border-slate-300 bg-white"
                            }`}>
                            {hasEventOnly && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
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
