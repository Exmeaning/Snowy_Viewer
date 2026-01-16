"use client";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import { VirtualLiveType, VIRTUAL_LIVE_TYPE_NAMES, VIRTUAL_LIVE_TYPE_COLORS } from "@/types/virtualLive";

interface VirtualLiveFiltersProps {
    selectedTypes: VirtualLiveType[];
    onTypeChange: (types: VirtualLiveType[]) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: "id" | "startAt";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "startAt", sortOrder: "asc" | "desc") => void;
    onReset: () => void;
    totalItems: number;
    filteredItems: number;
}

const VIRTUAL_LIVE_TYPES: VirtualLiveType[] = ["normal", "beginner", "archive", "cheerful_carnival", "connect_live", "streaming"];

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "startAt", label: "开始时间" },
];

export default function VirtualLiveFilters({
    selectedTypes,
    onTypeChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalItems,
    filteredItems,
}: VirtualLiveFiltersProps) {
    const toggleType = (type: VirtualLiveType) => {
        if (selectedTypes.includes(type)) {
            onTypeChange(selectedTypes.filter(t => t !== type));
        } else {
            onTypeChange([...selectedTypes, type]);
        }
    };

    const hasActiveFilters = selectedTypes.length > 0 || searchQuery.trim() !== "";

    return (
        <BaseFilters
            filteredCount={filteredItems}
            totalCount={totalItems}
            countUnit="个"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="输入演唱会名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "id" | "startAt", order)}
            hasActiveFilters={hasActiveFilters}
            onReset={onReset}
        >
            {/* Virtual Live Type Filter */}
            <FilterSection label="演唱会类型">
                <div className="flex flex-wrap gap-2">
                    {VIRTUAL_LIVE_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => toggleType(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedTypes.includes(type)
                                ? "text-white shadow-md"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            style={selectedTypes.includes(type) ? { backgroundColor: VIRTUAL_LIVE_TYPE_COLORS[type] } : {}}
                        >
                            {VIRTUAL_LIVE_TYPE_NAMES[type]}
                        </button>
                    ))}
                </div>
            </FilterSection>
        </BaseFilters>
    );
}
