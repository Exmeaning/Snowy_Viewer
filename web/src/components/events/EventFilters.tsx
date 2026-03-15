"use client";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import CharacterFilter from "@/components/common/CharacterFilter";
import { EventType, EVENT_TYPE_NAMES, EVENT_TYPE_COLORS } from "@/types/events";

interface EventFiltersProps {
    selectedTypes: EventType[];
    onTypeChange: (types: EventType[]) => void;

    // Character filter (bonus characters)
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;
    selectedUnitIds: string[];
    onUnitIdsChange: (units: string[]) => void;

    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: "id" | "startAt";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "startAt", sortOrder: "asc" | "desc") => void;
    onReset: () => void;
    totalEvents: number;
    filteredEvents: number;
}

const EVENT_TYPES: EventType[] = ["marathon", "cheerful_carnival", "world_bloom"];

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "startAt", label: "开始时间" },
];

export default function EventFilters({
    selectedTypes,
    onTypeChange,
    selectedCharacters,
    onCharacterChange,
    selectedUnitIds,
    onUnitIdsChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalEvents,
    filteredEvents,
}: EventFiltersProps) {
    const toggleType = (type: EventType) => {
        if (selectedTypes.includes(type)) {
            onTypeChange(selectedTypes.filter(t => t !== type));
        } else {
            onTypeChange([...selectedTypes, type]);
        }
    };

    const hasActiveFilters = selectedTypes.length > 0 || selectedCharacters.length > 0 || searchQuery.trim() !== "";

    return (
        <BaseFilters
            filteredCount={filteredEvents}
            totalCount={totalEvents}
            countUnit="个"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="输入活动名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "id" | "startAt", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Event Type Filter */}
            <FilterSection label="活动类型">
                <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => toggleType(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedTypes.includes(type)
                                ? "text-white shadow-md"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            style={selectedTypes.includes(type) ? { backgroundColor: EVENT_TYPE_COLORS[type] } : {}}
                        >
                            {EVENT_TYPE_NAMES[type]}
                        </button>
                    ))}
                </div>
            </FilterSection>

            {/* Bonus Character Filter */}
            <CharacterFilter
                selectedCharacters={selectedCharacters}
                onCharacterChange={onCharacterChange}
                selectedUnitIds={selectedUnitIds}
                onUnitIdsChange={onUnitIdsChange}
                unitLabel="加成角色 (团体)"
                characterLabel="加成角色"
            />
        </BaseFilters>
    );
}
