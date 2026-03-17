"use client";
import React from "react";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import CharacterFilter from "@/components/common/CharacterFilter";
import {
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES
} from "@/types/costume";

interface CostumeFiltersProps {
    // Character filter
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;

    // Unit filter
    selectedUnitIds: string[];
    onUnitIdsChange: (units: string[]) => void;

    // Part filter
    selectedPartTypes: string[];
    onPartTypeChange: (types: string[]) => void;

    // Source filter
    selectedSources: string[];
    onSourceChange: (sources: string[]) => void;

    // Rarity filter
    selectedRarities: string[];
    onRarityChange: (rarities: string[]) => void;

    // Gender filter
    selectedGenders: string[];
    onGenderChange: (genders: string[]) => void;

    // Related Card Filter
    onlyRelatedCardCostumes: boolean;
    onOnlyRelatedCardCostumesChange: (val: boolean) => void;

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

export default function CostumeFilters({
    selectedCharacters,
    onCharacterChange,
    selectedUnitIds,
    onUnitIdsChange,
    selectedPartTypes,
    onPartTypeChange,
    selectedSources,
    onSourceChange,
    selectedRarities,
    onRarityChange,
    selectedGenders,
    onGenderChange,
    onlyRelatedCardCostumes,
    onOnlyRelatedCardCostumesChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalCount,
    filteredCount,
}: CostumeFiltersProps) {

    const togglePartType = (type: string) => {
        if (selectedPartTypes.includes(type)) {
            onPartTypeChange(selectedPartTypes.filter(t => t !== type));
        } else {
            onPartTypeChange([...selectedPartTypes, type]);
        }
    };

    const toggleSource = (source: string) => {
        if (selectedSources.includes(source)) {
            onSourceChange(selectedSources.filter(s => s !== source));
        } else {
            onSourceChange([...selectedSources, source]);
        }
    };

    const toggleRarity = (rarity: string) => {
        if (selectedRarities.includes(rarity)) {
            onRarityChange(selectedRarities.filter(r => r !== rarity));
        } else {
            onRarityChange([...selectedRarities, rarity]);
        }
    };

    const toggleGender = (gender: string) => {
        if (selectedGenders.includes(gender)) {
            onGenderChange(selectedGenders.filter(g => g !== gender));
        } else {
            onGenderChange([...selectedGenders, gender]);
        }
    };

    const hasActiveFilters =
        selectedCharacters.length > 0 ||
        selectedPartTypes.length > 0 ||
        selectedSources.length > 0 ||
        selectedRarities.length > 0 ||
        selectedGenders.length > 0 ||
        onlyRelatedCardCostumes ||
        searchQuery.length > 0;

    const handleReset = () => {
        onReset();
    };

    return (
        <BaseFilters
            title="筛选服装"
            filteredCount={filteredCount}
            totalCount={totalCount}
            countUnit="套"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索服装名称、设计者..."
            sortOptions={[
                { id: "id", label: "ID" },
                { id: "publishedAt", label: "发布时间" },
            ]}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => onSortChange(field, order)}
            hasActiveFilters={hasActiveFilters}
            onReset={handleReset}
        >
            {/* Unit & Character Selection */}
            <CharacterFilter
                selectedCharacters={selectedCharacters}
                onCharacterChange={onCharacterChange}
                selectedUnitIds={selectedUnitIds}
                onUnitIdsChange={onUnitIdsChange}
                extraContent={
                    selectedCharacters.length > 0 ? (
                        <div className="mt-3">
                            <FilterToggle
                                selected={onlyRelatedCardCostumes}
                                onClick={() => onOnlyRelatedCardCostumesChange(!onlyRelatedCardCostumes)}
                                label="卡牌服装仅显示该角色关联的服装"
                            />
                        </div>
                    ) : undefined
                }
            />

            {/* Part Type and Source Filters */}
            <div className="grid grid-cols-1 gap-4">
                <FilterSection label="部位">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(PART_TYPE_NAMES).map(([key, label]) => (
                            <FilterButton
                                key={key}
                                selected={selectedPartTypes.includes(key)}
                                onClick={() => togglePartType(key)}
                            >
                                {label}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="来源">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(SOURCE_NAMES).map(([key, label]) => (
                            <FilterButton
                                key={key}
                                selected={selectedSources.includes(key)}
                                onClick={() => toggleSource(key)}
                            >
                                {label}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            </div>

            {/* Rarity & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FilterSection label="稀有度">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(RARITY_NAMES).map(([key, label]) => (
                            <FilterButton
                                key={key}
                                selected={selectedRarities.includes(key)}
                                onClick={() => toggleRarity(key)}
                            >
                                {label}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>

                <FilterSection label="性别">
                    <div className="flex flex-wrap gap-2">
                        <FilterButton
                            selected={selectedGenders.includes("female")}
                            onClick={() => toggleGender("female")}
                        >
                            女性
                        </FilterButton>
                        <FilterButton
                            selected={selectedGenders.includes("male")}
                            onClick={() => toggleGender("male")}
                        >
                            男性
                        </FilterButton>
                    </div>
                </FilterSection>
            </div>

        </BaseFilters>
    );
}
