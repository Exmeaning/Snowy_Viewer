"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection, getFilterChipStateClasses, getFilterIconStateClasses } from "@/components/common/BaseFilters";
import CharacterFilter from "@/components/common/CharacterFilter";
import { CardRarityType, CardAttribute, ATTR_NAMES, SupportUnit, SUPPORT_UNIT_NAMES, UNIT_ICON_FILES, UNIT_FIELD_TO_ID } from "@/types/types";
import { useCardSupplyTypeMapping } from "@/hooks/useCardSupplyType";

interface CardFiltersProps {
    // Character filter
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;

    // Unit filter
    selectedUnitIds: string[];
    onUnitIdsChange: (units: string[]) => void;

    // Attribute filter
    selectedAttrs: CardAttribute[];
    onAttrChange: (attrs: CardAttribute[]) => void;

    // Rarity filter
    selectedRarities: CardRarityType[];
    onRarityChange: (rarities: CardRarityType[]) => void;

    // Supply Type filter
    selectedSupplyTypes: string[];
    onSupplyTypeChange: (types: string[]) => void;

    // Support Unit filter (for Virtual Singers)
    selectedSupportUnits: SupportUnit[];
    onSupportUnitChange: (units: SupportUnit[]) => void;

    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;

    // Sort
    sortBy: string;
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: string, sortOrder: "asc" | "desc") => void;

    // Extra sort options (e.g. for my-cards page)
    extraSortOptions?: { id: string; label: string }[];

    // Reset
    onReset: () => void;

    // Card count
    totalCards: number;
    filteredCards: number;
}

const ATTRIBUTES: CardAttribute[] = ["cool", "cute", "happy", "mysterious", "pure"];
const RARITIES: { type: CardRarityType; num: number }[] = [
    { type: "rarity_1", num: 1 },
    { type: "rarity_2", num: 2 },
    { type: "rarity_3", num: 3 },
    { type: "rarity_4", num: 4 },
    { type: "rarity_birthday", num: 5 },
];

const SORT_OPTIONS = [
    { id: "id", label: "ID" },
    { id: "releaseAt", label: "日期" },
    { id: "rarity", label: "稀有度" },
];

const ATTR_ICONS: Record<CardAttribute, string> = {
    "cool": "Cool.webp",
    "cute": "cute.webp",
    "happy": "Happy.webp",
    "mysterious": "Mysterious.webp",
    "pure": "Pure.webp",
};

export default function CardFilters({
    selectedCharacters,
    onCharacterChange,
    selectedUnitIds,
    onUnitIdsChange,
    selectedAttrs,
    onAttrChange,
    selectedRarities,
    onRarityChange,
    selectedSupplyTypes,
    onSupplyTypeChange,
    selectedSupportUnits,
    onSupportUnitChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    extraSortOptions,
    onReset,
    totalCards,
    filteredCards,
}: CardFiltersProps) {

    const supplyTypes = useCardSupplyTypeMapping();

    const toggleAttr = (attr: CardAttribute) => {
        if (selectedAttrs.includes(attr)) {
            onAttrChange(selectedAttrs.filter(a => a !== attr));
        } else {
            onAttrChange([...selectedAttrs, attr]);
        }
    };

    const toggleRarity = (rarity: CardRarityType) => {
        if (selectedRarities.includes(rarity)) {
            onRarityChange(selectedRarities.filter(r => r !== rarity));
        } else {
            onRarityChange([...selectedRarities, rarity]);
        }
    };

    const toggleSupplyType = (type: string) => {
        if (selectedSupplyTypes.includes(type)) {
            onSupplyTypeChange(selectedSupplyTypes.filter(t => t !== type));
        } else {
            onSupplyTypeChange([...selectedSupplyTypes, type]);
        }
    };

    const toggleSupportUnit = (unit: SupportUnit) => {
        if (selectedSupportUnits.includes(unit)) {
            onSupportUnitChange(selectedSupportUnits.filter(u => u !== unit));
        } else {
            onSupportUnitChange([...selectedSupportUnits, unit]);
        }
    };

    // Check if any virtual singer is selected (characterId >= 21)
    const hasVirtualSingerSelected = selectedCharacters.some(id => id >= 21);

    const hasActiveFilters =
        selectedCharacters.length > 0 ||
        selectedAttrs.length > 0 ||
        selectedRarities.length > 0 ||
        selectedSupplyTypes.length > 0 ||
        selectedSupportUnits.length > 0 ||
        searchQuery.length > 0;

    const handleReset = () => {
        onReset();
    };

    return (
        <BaseFilters
            filteredCount={filteredCards}
            totalCount={totalCards}
            countUnit="张"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索卡牌名称或ID..."
            sortOptions={extraSortOptions ? [...SORT_OPTIONS, ...extraSortOptions] : SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id, order)}
            hasActiveFilters={hasActiveFilters}
            onReset={handleReset}
        >
            {/* Unit & Character Selection */}
            <CharacterFilter
                selectedCharacters={selectedCharacters}
                onCharacterChange={onCharacterChange}
                selectedUnitIds={selectedUnitIds}
                onUnitIdsChange={onUnitIdsChange}
            />

            {/* Support Unit Filter - Only show when virtual singers are selected */}
            {hasVirtualSingerSelected && (
                <FilterSection label="团体归属">
                    <div className="flex flex-wrap gap-2">
                        {/* Ordered list: follows team order, then original (none) at end */}
                        {(["light_sound", "idol", "street", "theme_park", "school_refusal", "none"] as SupportUnit[]).map((unit) => {
                            const isSelected = selectedSupportUnits.includes(unit);
                            const unitIconMap: Record<SupportUnit, string> = {
                                "none": "vs.webp",
                                "light_sound": UNIT_ICON_FILES[UNIT_FIELD_TO_ID["light_sound"]],
                                "idol": UNIT_ICON_FILES[UNIT_FIELD_TO_ID["idol"]],
                                "school_refusal": UNIT_ICON_FILES[UNIT_FIELD_TO_ID["school_refusal"]],
                                "theme_park": UNIT_ICON_FILES[UNIT_FIELD_TO_ID["theme_park"]],
                                "street": UNIT_ICON_FILES[UNIT_FIELD_TO_ID["street"]],
                            };
                            const iconName = unitIconMap[unit];
                            return (
                                <button
                                    key={unit}
                                    onClick={() => toggleSupportUnit(unit)}
                                    className={`p-1.5 rounded-xl transition-all ${getFilterIconStateClasses(isSelected)}`}
                                    title={SUPPORT_UNIT_NAMES[unit]}
                                >
                                    <div className="w-8 h-8 relative">
                                        <Image
                                            src={`/data/icon/${iconName}`}
                                            alt={SUPPORT_UNIT_NAMES[unit]}
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
            )}

            {/* Attribute and Rarity Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attribute Filter */}
                <FilterSection label="属性">
                    <div className="flex flex-wrap gap-2">
                        {ATTRIBUTES.map((attr) => (
                            <button
                                key={attr}
                                onClick={() => toggleAttr(attr)}
                                className={`p-1.5 rounded-xl transition-all ${getFilterIconStateClasses(selectedAttrs.includes(attr))}`}
                                title={ATTR_NAMES[attr]}
                            >
                                <div className="w-6 h-6 relative">
                                    <Image
                                        src={`/data/icon/${ATTR_ICONS[attr]}`}
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

                {/* Rarity Filter */}
                <FilterSection label="稀有度">
                    <div className="flex flex-wrap gap-2">
                        {RARITIES.map(({ type, num }) => {
                            const isSelected = selectedRarities.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleRarity(type)}
                                    className={`h-9 px-2.5 rounded-xl transition-all flex items-center justify-center gap-0.5 border ${getFilterIconStateClasses(isSelected, "ring-2 ring-miku shadow-lg bg-white border-transparent dark:bg-miku/12 dark:border-miku/40 dark:ring-miku/75", "bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:border-slate-700 dark:hover:bg-slate-700/80 dark:hover:border-slate-600")}`}
                                    title={type}
                                >
                                    {type === "rarity_birthday" ? (
                                        <div className="w-4 h-4 relative">
                                            <Image
                                                src="/data/icon/birthday.webp"
                                                alt="Birthday"
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    ) : (
                                        Array.from({ length: num }).map((_, i) => (
                                            <div key={i} className="w-3 h-3 relative">
                                                <Image
                                                    src="/data/icon/star.webp"
                                                    alt="Star"
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                        ))
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </FilterSection>
            </div>

            {/* Supply Type Filter */}
            <FilterSection label="卡牌类型">
                <div className="flex flex-wrap gap-2">
                    {supplyTypes.map((st) => {
                        const isSelected = selectedSupplyTypes.includes(st.type);
                        return (
                            <button
                                key={st.type}
                                onClick={() => toggleSupplyType(st.type)}
                                className={`px-3 py-1.5 rounded-xl text-sm transition-all border ${getFilterChipStateClasses(isSelected, "ring-2 ring-miku shadow-lg bg-white text-slate-700 border-transparent dark:bg-miku/12 dark:text-slate-100 dark:border-miku/40 dark:ring-miku/75", "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/80 dark:hover:border-slate-600")}`}
                            >
                                {st.name}
                            </button>
                        );
                    })}
                </div>
            </FilterSection>
        </BaseFilters>
    );
}
