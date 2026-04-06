import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { UNIT_DATA, CHARACTER_NAMES, UNIT_ICON_FILES } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";

interface CharacterSelectorProps {
    selectedCharacterId: number | null;
    onSelect: (id: number) => void;
    availableCharacterIds?: readonly number[];
}

export default function CharacterSelector({
    selectedCharacterId,
    onSelect,
    availableCharacterIds,
}: CharacterSelectorProps) {
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    const availableCharacterIdSet = useMemo(
        () => availableCharacterIds ? new Set(availableCharacterIds) : null,
        [availableCharacterIds],
    );

    const visibleUnits = useMemo(() => {
        if (availableCharacterIdSet === null) return UNIT_DATA;
        return UNIT_DATA.filter(unit => unit.charIds.some(charId => availableCharacterIdSet.has(charId)));
    }, [availableCharacterIdSet]);

    useEffect(() => {
        if (selectedUnitId === null) return;
        if (visibleUnits.some(unit => unit.id === selectedUnitId)) return;
        setSelectedUnitId(null);
    }, [selectedUnitId, visibleUnits]);

    const handleUnitClick = (unitId: string) => {
        if (selectedUnitId === unitId) {
            setSelectedUnitId(null);
        } else {
            setSelectedUnitId(unitId);
        }
    };

    const displayedCharacters = useMemo(() => {
        if (!selectedUnitId) {
            return availableCharacterIds ?? UNIT_DATA.flatMap(u => u.charIds);
        }
        const unit = visibleUnits.find(u => u.id === selectedUnitId);
        if (!unit) return [];
        return availableCharacterIdSet
            ? unit.charIds.filter(charId => availableCharacterIdSet.has(charId))
            : unit.charIds;
    }, [selectedUnitId, availableCharacterIdSet, availableCharacterIds, visibleUnits]);


    return (
        <div className="space-y-4">
            {/* Unit Filter */}
            <div className="flex flex-wrap gap-2">
                {visibleUnits.map(unit => {
                    const iconName = UNIT_ICON_FILES[unit.id] || "";
                    const isSelected = selectedUnitId === unit.id;
                    return (
                        <button
                            key={unit.id}
                            onClick={() => handleUnitClick(unit.id)}
                            className={`p-1.5 rounded-xl transition-all ${isSelected
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

            {/* Character Grid */}
            <div className="flex flex-wrap gap-2">
                {displayedCharacters.map(charId => (
                    <button
                        key={charId}
                        onClick={() => onSelect(charId)}
                        className={`relative transition-all ${selectedCharacterId === charId
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
    );
}
