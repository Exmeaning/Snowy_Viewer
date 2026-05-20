"use client";
import React from "react";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import { useI18n } from "@/contexts/I18nContext";

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
    { id: "id", labelKey: "common.filter.sortById" },
    { id: "seq", labelKey: "common.filter.sortBySeq" },
] as const;

const RARITIES = ["low", "middle", "high", "highest"];

type TranslationFn = ReturnType<typeof useI18n>["t"];

function formatFallbackLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function getHonorTypeLabel(type: string, t: TranslationFn): string {
    const key = `common.honor.types.${type}`;
    const label = t(key);
    return label === key ? formatFallbackLabel(type) : label;
}

function getHonorRarityLabel(rarity: string, t: TranslationFn): string {
    const key = `common.honor.rarities.${rarity}`;
    const label = t(key);
    return label === key ? formatFallbackLabel(rarity) : label;
}

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
    const { t } = useI18n();

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
            countUnit={t("page.honors.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder={t("page.honors.searchPlaceholder.normal")}
            sortOptions={SORT_OPTIONS.map((option) => ({ id: option.id, label: t(option.labelKey) }))}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Honor Type */}
            <FilterSection label={t("common.filter.honorType")}>
                <div className="flex flex-wrap gap-2">
                    {availableTypes.map(type => (
                        <FilterButton
                            key={type}
                            selected={selectedTypes.includes(type)}
                            onClick={() => toggleType(type)}
                        >
                            {getHonorTypeLabel(type, t)}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            {/* Rarity */}
            <FilterSection label={t("common.filter.rarity")}>
                <div className="flex flex-wrap gap-2">
                    {RARITIES.map(rarity => (
                        <FilterButton
                            key={rarity}
                            selected={selectedRarities.includes(rarity)}
                            onClick={() => toggleRarity(rarity)}
                        >
                            {getHonorRarityLabel(rarity, t)}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            {/* Group Once Toggle */}
            <FilterToggle
                selected={groupOnce}
                onClick={() => onGroupOnceChange(!groupOnce)}
                label={t("common.filter.groupOnce")}
            />
        </BaseFilters>
    );
}
