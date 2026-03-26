"use client";
import React from "react";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import { HONOR_TYPE_NAMES, HONOR_RARITY_NAMES } from "@/types/honor";

interface HonorFiltersProps {
    // Honor type filter
    selectedTypes: string[];
    onTypeChange: (types: string[]) => void;
    availableTypes: string[];

    // Rarity filter
    selectedRarities: string[];
    onRarityChange: (rarities: string[]) => void;

    // Group once toggle
    groupOnce: boolean;
    onGroupOnceChange: (val: boolean) => void;

    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;

    // Sort
    sortBy: string;
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;

    // Reset
    onReset: () => void;

    // Counts
    totalCount: number;
    filteredCount: number;
}

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "seq", label: "序号" },
];

const RARITIES = ["low", "middle", "high", "highest"];

export default function HonorFilters({
    selectedTypes,
    onTypeChange,
    availableTypes,
    selectedRarities,
    onRarityChange,
    groupOnce,
    onGroupOnceChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalCount,
    filteredCount,
}: HonorFiltersProps) {
    const toggleType = (type: string) => {
        if (selectedTypes.includes(type)) {
            onTypeChange(selectedTypes.filter(t => t !== type));
        } else {
            onTypeChange([...selectedTypes, type]);
        }
    };

    const toggleRarity = (rarity: string) => {
        if (selectedRarities.includes(rarity)) {
            onRarityChange(selectedRarities.filter(r => r !== rarity));
        } else {
            onRarityChange([...selectedRarities, rarity]);
        }
    };

    const hasActiveFilters =
        selectedTypes.length > 0 ||
        selectedRarities.length > 0 ||
        groupOnce ||
        searchQuery.length > 0;

    return (
        <BaseFilters
            filteredCount={filteredCount}
            totalCount={totalCount}
            countUnit="个"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索称号名称..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Honor Type */}
            <FilterSection label="称号类型">
                <div className="flex flex-wrap gap-2">
                    {availableTypes.map(type => (
                        <FilterButton
                            key={type}
                            selected={selectedTypes.includes(type)}
                            onClick={() => toggleType(type)}
                        >
                            {HONOR_TYPE_NAMES[type] || type}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            {/* Rarity */}
            <FilterSection label="稀有度">
                <div className="flex flex-wrap gap-2">
                    {RARITIES.map(rarity => (
                        <FilterButton
                            key={rarity}
                            selected={selectedRarities.includes(rarity)}
                            onClick={() => toggleRarity(rarity)}
                        >
                            {HONOR_RARITY_NAMES[rarity] || rarity}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            {/* Group Once Toggle */}
            <FilterToggle
                selected={groupOnce}
                onClick={() => onGroupOnceChange(!groupOnce)}
                label="每组仅显示一个"
            />
        </BaseFilters>
    );
}
