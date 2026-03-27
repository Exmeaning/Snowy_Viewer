"use client";
import BaseFilters, { FilterSection, getFilterChipStateClasses } from "@/components/common/BaseFilters";
import CharacterFilter from "@/components/common/CharacterFilter";
import { GachaCategoryType, GACHA_CATEGORY_LABELS } from "@/types/types";

interface GachaFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: "id" | "startAt";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "startAt", sortOrder: "asc" | "desc") => void;
    // Category filter (wish_pick / normal_pickup)
    selectedCategory: GachaCategoryType;
    onCategoryChange: (category: GachaCategoryType) => void;
    // Character filter (for pickup characters)
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;
    selectedUnitIds: string[];
    onUnitIdsChange: (units: string[]) => void;
    // Totals
    totalGachas: number;
    filteredGachas: number;
}

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "startAt", label: "开始时间" },
];

const GACHA_CATEGORIES: GachaCategoryType[] = ["all", "wish_pick", "normal_pickup"];

export default function GachaFilters({
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    selectedCategory,
    onCategoryChange,
    selectedCharacters,
    onCharacterChange,
    selectedUnitIds,
    onUnitIdsChange,
    totalGachas,
    filteredGachas,
}: GachaFiltersProps) {
    return (
        <BaseFilters
            filteredCount={filteredGachas}
            totalCount={totalGachas}
            countUnit="个"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="输入扭蛋名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "id" | "startAt", order)}
        >
            {/* Gacha Category Filter */}
            <FilterSection label="扭蛋类型">
                <div className="flex flex-wrap gap-2">
                    {GACHA_CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => onCategoryChange(category)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${getFilterChipStateClasses(selectedCategory === category)}`}
                        >
                            {GACHA_CATEGORY_LABELS[category]}
                        </button>
                    ))}
                </div>
            </FilterSection>

            {/* Pickup Character Filter */}
            <CharacterFilter
                selectedCharacters={selectedCharacters}
                onCharacterChange={onCharacterChange}
                selectedUnitIds={selectedUnitIds}
                onUnitIdsChange={onUnitIdsChange}
                unitLabel="团体"
                characterLabel="PU角色"
            />
        </BaseFilters>
    );
}
