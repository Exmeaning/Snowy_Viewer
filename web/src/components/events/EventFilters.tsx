"use client";
import Image from "next/image";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import CharacterFilter from "@/components/common/CharacterFilter";
import { EventType, EVENT_TYPE_NAMES, EVENT_TYPE_COLORS } from "@/types/events";
import { ICharaUnitInfo, UNIT_DATA, UNIT_ICON_FILES, CardAttribute, ATTR_NAMES, ATTR_ICON_PATHS, ATTR_COLORS } from "@/types/types";

/** Filter IDs for event unit (group) filter */
export type EventUnitFilterId = "ln" | "mmj" | "vbs" | "ws" | "25ji" | "vs" | "mixed";

export const EVENT_UNIT_FILTERS: { id: EventUnitFilterId; name: string; icon?: string }[] = [
    ...UNIT_DATA.map(u => ({ id: u.id as EventUnitFilterId, name: u.name, icon: UNIT_ICON_FILES[u.id] })),
    { id: "mixed", name: "混合" },
];

/** Map raw event_type from actionSets to filter ID */
export const EVENT_TYPE_TO_FILTER_ID: Record<string, EventUnitFilterId> = {
    band: "ln",
    idol: "mmj",
    street: "vbs",
    wonder: "ws",
    night: "25ji",
    piapro: "vs",
};

interface EventFiltersProps {
    selectedTypes: EventType[];
    onTypeChange: (types: EventType[]) => void;

    // Event unit (group) filter (optional — only used on events list page)
    selectedEventUnits?: EventUnitFilterId[];
    onEventUnitChange?: (units: EventUnitFilterId[]) => void;

    // Character filter (bonus characters)
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;
    selectedUnitIds: string[];
    onUnitIdsChange: (units: string[]) => void;
    charaUnits?: ICharaUnitInfo[];

    // Banner character filter (optional)
    selectedBannerChars?: number[];
    onBannerCharsChange?: (chars: number[]) => void;
    selectedBannerUnitIds?: string[];
    onBannerUnitIdsChange?: (units: string[]) => void;

    // Bonus attribute filter (optional)
    selectedBonusAttr?: CardAttribute | null;
    onBonusAttrChange?: (attr: CardAttribute | null) => void;

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
    selectedEventUnits,
    onEventUnitChange,
    selectedCharacters,
    onCharacterChange,
    selectedUnitIds,
    onUnitIdsChange,
    charaUnits,
    selectedBannerChars,
    onBannerCharsChange,
    selectedBannerUnitIds,
    onBannerUnitIdsChange,
    selectedBonusAttr,
    onBonusAttrChange,
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

    const toggleEventUnit = (unitId: EventUnitFilterId) => {
        if (!onEventUnitChange || !selectedEventUnits) return;
        if (selectedEventUnits.includes(unitId)) {
            onEventUnitChange(selectedEventUnits.filter(u => u !== unitId));
        } else {
            onEventUnitChange([...selectedEventUnits, unitId]);
        }
    };

    const hasActiveFilters = selectedTypes.length > 0 || (selectedEventUnits && selectedEventUnits.length > 0) || selectedCharacters.length > 0 || (selectedBannerChars && selectedBannerChars.length > 0) || !!selectedBonusAttr || searchQuery.trim() !== "";

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
            {/* Event Unit (Group) Filter — only shown when props are provided */}
            {selectedEventUnits && onEventUnitChange && (
                <FilterSection label="活动团体">
                    <div className="flex flex-wrap gap-2">
                        {EVENT_UNIT_FILTERS.map(unit => (
                            <button
                                key={unit.id}
                                onClick={() => toggleEventUnit(unit.id)}
                                className={`p-1.5 rounded-xl transition-all ${selectedEventUnits.includes(unit.id)
                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                    }`}
                                title={unit.name}
                            >
                                {unit.icon ? (
                                    <div className="w-8 h-8 relative">
                                        <Image
                                            src={`/data/icon/${unit.icon}`}
                                            alt={unit.name}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <span className="text-xs text-slate-500 font-bold">混</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </FilterSection>
            )}

            {/* Banner Character Filter */}
            {selectedBannerChars && onBannerCharsChange && selectedBannerUnitIds && onBannerUnitIdsChange && (
                <CharacterFilter
                    selectedCharacters={selectedBannerChars}
                    onCharacterChange={onBannerCharsChange}
                    selectedUnitIds={selectedBannerUnitIds}
                    onUnitIdsChange={onBannerUnitIdsChange}
                    unitLabel="封面角色"
                    characterLabel="封面角色"
                />
            )}

            {/* Event Type Filter */}
            <FilterSection label="活动形式">
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
                unitLabel="加成角色"
                characterLabel="加成角色"
                charaUnits={charaUnits}
            />

            {/* Bonus Attribute Filter */}
            {onBonusAttrChange && (
                <FilterSection label="加成属性">
                    <div className="flex flex-wrap gap-2">
                        {(["cool", "cute", "happy", "mysterious", "pure"] as CardAttribute[]).map(attr => (
                            <button
                                key={attr}
                                onClick={() => onBonusAttrChange(selectedBonusAttr === attr ? null : attr)}
                                className={`p-1.5 rounded-xl transition-all flex items-center gap-1.5 ${selectedBonusAttr === attr
                                    ? "ring-2 shadow-lg bg-white"
                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                    }`}
                                style={selectedBonusAttr === attr ? { boxShadow: `0 0 0 2px ${ATTR_COLORS[attr]}` } : {}}
                                title={ATTR_NAMES[attr]}
                            >
                                <div className="w-7 h-7 relative">
                                    <Image
                                        src={`/data/icon/${ATTR_ICON_PATHS[attr]}`}
                                        alt={ATTR_NAMES[attr]}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            </button>
                        ))}
                    </div>
                </FilterSection>
            )}
        </BaseFilters>
    );
}
