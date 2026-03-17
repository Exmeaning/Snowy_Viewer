"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import {
    UNIT_DATA,
    CHARACTER_NAMES
} from "@/types/types";
import {
    PART_TYPE_NAMES,
    SOURCE_NAMES,
    RARITY_NAMES
} from "@/types/costume";
import { getCharacterIconUrl } from "@/lib/assets";

// Unit icon mapping
const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

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

    const toggleCharacter = (id: number) => {
        if (selectedCharacters.includes(id)) {
            onCharacterChange(selectedCharacters.filter(c => c !== id));
        } else {
            onCharacterChange([...selectedCharacters, id]);
        }
    };

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

    const handleUnitClick = (unitId: string) => {
        const unit = UNIT_DATA.find(u => u.id === unitId);
        if (!unit) return;

        if (selectedUnitIds.includes(unitId)) {
            // Remove this unit and its characters
            onUnitIdsChange(selectedUnitIds.filter(id => id !== unitId));
            const newChars = selectedCharacters.filter(c => !unit.charIds.includes(c));
            onCharacterChange(newChars);
        } else {
            // Add this unit and its characters
            onUnitIdsChange([...selectedUnitIds, unitId]);
            const newChars = [...new Set([...selectedCharacters, ...unit.charIds])];
            onCharacterChange(newChars);
        }
    };

    const currentUnits = selectedUnitIds.length > 0
        ? UNIT_DATA.filter(u => selectedUnitIds.includes(u.id))
        : [];

    // Get current displayed characters
    const displayedCharacters = currentUnits.length > 0
        ? currentUnits.flatMap(u => u.charIds)
        : [...new Set(selectedCharacters)];

    // Check if all displayed characters are selected
    const allSelected = displayedCharacters.length > 0 && 
        displayedCharacters.every(charId => selectedCharacters.includes(charId));

    // Handle ALL button click
    const handleAllClick = () => {
        if (allSelected) {
            // If all are selected, deselect all displayed characters
            const newChars = selectedCharacters.filter(charId => !displayedCharacters.includes(charId));
            onCharacterChange(newChars);
        } else {
            // If not all are selected, select all displayed characters
            const newChars = [...new Set([...selectedCharacters, ...displayedCharacters])];
            onCharacterChange(newChars);
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
            {/* Unit Selection */}
            <FilterSection label="团体">
                <div className="flex flex-wrap gap-2">
                    {UNIT_DATA.map(unit => {
                        const iconName = UNIT_ICONS[unit.id] || "";
                        return (
                            <button
                                key={unit.id}
                                onClick={() => handleUnitClick(unit.id)}
                                className={`p-1.5 rounded-xl transition-all ${selectedUnitIds.includes(unit.id)
                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                    }`}
                                title={unit.name}
                            >
                                <div className="w-8 h-8 relative">
                                    <Image
                                        src={`/data/icon/${iconName}`}
                                        alt={unit.name}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            {/* Character Selection */}
            {(currentUnits.length > 0 || selectedCharacters.length > 0) && (
                <FilterSection label="角色">
                    <div className="flex flex-wrap gap-2 mb-3">
                        {displayedCharacters.map(charId => (
                            <button
                                key={charId}
                                onClick={() => toggleCharacter(charId)}
                                className={`relative transition-all ${selectedCharacters.includes(charId)
                                    ? "ring-2 ring-miku scale-110 z-10 rounded-full"
                                    : "ring-2 ring-transparent hover:ring-slate-200 rounded-full opacity-80 hover:opacity-100"
                                    }`}
                                title={CHARACTER_NAMES[charId]}
                            >
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                                    <Image
                                        src={getCharacterIconUrl(charId)}
                                        alt={CHARACTER_NAMES[charId]}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                    />
                                </div>
                            </button>
                        ))}
                        
                        {/* ALL Button - placed at the end */}
                        <button
                            key="all"
                            onClick={handleAllClick}
                            className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${allSelected
                                ? "bg-miku text-white shadow-lg ring-2 ring-miku"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
                                }`}
                            title="全部"
                            style={{ width: '40px', height: '40px' }}
                        >
                            ALL
                        </button>
                    </div>

                    {/* Related Card Filter Toggle */}
                    {selectedCharacters.length > 0 && (
                        <div className="mt-3">
                            <FilterToggle
                                selected={onlyRelatedCardCostumes}
                                onClick={() => onOnlyRelatedCardCostumesChange(!onlyRelatedCardCostumes)}
                                label="卡牌服装仅显示该角色关联的服装"
                            />
                        </div>
                    )}
                </FilterSection>
            )}

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
