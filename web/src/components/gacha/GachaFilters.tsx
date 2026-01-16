"use client";
import BaseFilters from "@/components/common/BaseFilters";

interface GachaFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: "id" | "startAt";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "startAt", sortOrder: "asc" | "desc") => void;
    totalGachas: number;
    filteredGachas: number;
}

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "startAt", label: "开始时间" },
];

export default function GachaFilters({
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
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
        />
    );
}
