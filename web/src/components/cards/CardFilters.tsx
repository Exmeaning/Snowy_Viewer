"use client";
import React from "react";
import Image from "next/image";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import { CardRarityType, CardAttribute, ATTR_NAMES, CHARACTER_NAMES, UNIT_DATA } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";
import { useCardSupplyTypeMapping } from "@/hooks/useCardSupplyType";

interface CardFiltersProps {
    // Character filter
    selectedCharacters: number[];
    onCharacterChange: (chars: number[]) => void;

    // Attribute filter
    selectedAttrs: CardAttribute[];
    onAttrChange: (attrs: CardAttribute[]) => void;

    // Rarity filter
    selectedRarities: CardRarityType[];
    onRarityChange: (rarities: CardRarityType[]) => void;

    // Supply Type filter
    selectedSupplyTypes: string[];
    onSupplyTypeChange: (types: string[]) => void;

    // Search
    searchQuery: string;
    onSearchChange: (query: string) => void;

    // Sort
    sortBy: "id" | "releaseAt" | "rarity";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "releaseAt" | "rarity", sortOrder: "asc" | "desc") => void;

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

const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

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
    selectedAttrs,
    onAttrChange,
    selectedRarities,
    onRarityChange,
    selectedSupplyTypes,
    onSupplyTypeChange,
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    onReset,
    totalCards,
    filteredCards,
}: CardFiltersProps) {

    const [selectedUnitIds, setSelectedUnitIds] = React.useState<string[]>([]);
    const supplyTypes = useCardSupplyTypeMapping();

    const toggleCharacter = (id: number) => {
        if (selectedCharacters.includes(id)) {
            onCharacterChange(selectedCharacters.filter(c => c !== id));
        } else {
            onCharacterChange([...selectedCharacters, id]);
        }
    };

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

    const handleUnitClick = (unitId: string) => {
        const unit = UNIT_DATA.find(u => u.id === unitId);
        if (!unit) return;

        if (selectedUnitIds.includes(unitId)) {
            setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
            const newChars = selectedCharacters.filter(c => !unit.charIds.includes(c));
            onCharacterChange(newChars);
        } else {
            setSelectedUnitIds([...selectedUnitIds, unitId]);
            const newChars = [...new Set([...selectedCharacters, ...unit.charIds])];
            onCharacterChange(newChars);
        }
    };

    const hasActiveFilters =
        selectedCharacters.length > 0 ||
        selectedAttrs.length > 0 ||
        selectedRarities.length > 0 ||
        selectedSupplyTypes.length > 0 ||
        searchQuery.length > 0;

    const currentUnits = selectedUnitIds.length > 0
        ? UNIT_DATA.filter(u => selectedUnitIds.includes(u.id))
        : [];

    const handleReset = () => {
        onReset();
        setSelectedUnitIds([]);
    };

    return (
        <BaseFilters
            filteredCount={filteredCards}
            totalCount={totalCards}
            countUnit="张"
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="搜索卡牌名称或ID..."
            sortOptions={SORT_OPTIONS}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(id, order) => onSortChange(id as "id" | "releaseAt" | "rarity", order)}
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
                    <div className="flex flex-wrap gap-2">
                        {(currentUnits.length > 0
                            ? currentUnits.flatMap(u => u.charIds)
                            : [...new Set(selectedCharacters)]
                        ).map(charId => (
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
                                className={`p-1.5 rounded-xl transition-all ${selectedAttrs.includes(attr)
                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                    }`}
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
                                    className={`h-9 px-2.5 rounded-xl transition-all flex items-center justify-center gap-0.5 border ${isSelected
                                        ? "ring-2 ring-miku shadow-lg bg-white border-transparent"
                                        : "hover:bg-slate-100 border-slate-200 bg-slate-50"
                                        }`}
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
                                className={`px-3 py-1.5 rounded-xl text-sm transition-all border ${isSelected
                                    ? "ring-2 ring-miku shadow-lg bg-white border-transparent"
                                    : "hover:bg-slate-100 border-slate-200 bg-slate-50 text-slate-600"
                                    }`}
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
