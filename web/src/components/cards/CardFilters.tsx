"use client";
import React from "react";
import Image from "next/image";
import { CardRarityType, CardAttribute, ATTR_NAMES, ATTR_COLORS, CHARACTER_NAMES, UNIT_DATA, RARITY_DISPLAY, getRarityNumber } from "@/types/types";
import { getCharacterIconUrl, getAttrIconUrl, getUnitLogoUrl } from "@/lib/assets";
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
            // Deselect unit - remove all characters from this unit
            setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
            const newChars = selectedCharacters.filter(c => !unit.charIds.includes(c));
            onCharacterChange(newChars);
        } else {
            // Select unit - add all characters from this unit
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

    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    筛选
                </h2>
                <span className="text-xs text-slate-500">
                    {filteredCards} / {totalCards}
                </span>
            </div>

            <div className="p-5 space-y-5">
                {/* Search */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        搜索
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="搜索卡牌..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku transition-all"
                        />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Sort Options */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        排序
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: "id", label: "ID" },
                            { id: "releaseAt", label: "日期" },
                            { id: "rarity", label: "稀有度" }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onSortChange(opt.id as any, sortBy === opt.id && sortOrder === "desc" ? "asc" : "desc")}
                                className={`px-2 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === opt.id
                                    ? "bg-miku text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                            >
                                {opt.label}
                                {sortBy === opt.id && (
                                    <svg className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Unit Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        团体
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {UNIT_DATA.map(unit => {
                            let iconName = "";
                            switch (unit.id) {
                                case "ln": iconName = "ln.webp"; break;
                                case "mmj": iconName = "mmj.webp"; break;
                                case "vbs": iconName = "vbs.webp"; break;
                                case "ws": iconName = "wxs.webp"; break;
                                case "25ji": iconName = "n25.webp"; break;
                                case "vs": iconName = "vs.webp"; break;
                            }
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
                </div>

                {/* Character Selection */}
                {(currentUnits.length > 0 || selectedCharacters.length > 0) && (
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            角色
                        </label>
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
                    </div>
                )}

                {/* Attribute and Rarity Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Attribute Filter */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            属性
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {ATTRIBUTES.map((attr) => {
                                let iconName = "";
                                switch (attr) {
                                    case "cool": iconName = "Cool.webp"; break;
                                    case "cute": iconName = "cute.webp"; break;
                                    case "happy": iconName = "Happy.webp"; break;
                                    case "mysterious": iconName = "Mysterious.webp"; break;
                                    case "pure": iconName = "Pure.webp"; break;
                                }
                                return (
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
                                                src={`/data/icon/${iconName}`}
                                                alt={ATTR_NAMES[attr]}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rarity Filter */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            稀有度
                        </label>
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
                    </div>
                </div>

                {/* Supply Type Filter */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        卡牌类型
                    </label>
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
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
                    <button
                        onClick={() => {
                            onReset();
                            setSelectedUnitIds([]);
                        }}
                        className="w-full py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重置筛选
                    </button>
                )}
            </div>
        </div>
    );
}
