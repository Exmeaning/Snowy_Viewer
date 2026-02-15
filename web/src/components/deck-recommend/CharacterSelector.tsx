import React, { useState, useMemo } from "react";
import Image from "next/image";
import { UNIT_DATA, CHARACTER_NAMES } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";

interface CharacterSelectorProps {
    selectedCharacterId: number | null;
    onSelect: (id: number) => void;
}

const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

export default function CharacterSelector({
    selectedCharacterId,
    onSelect,
}: CharacterSelectorProps) {
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    const handleUnitClick = (unitId: string) => {
        if (selectedUnitId === unitId) {
            setSelectedUnitId(null);
        } else {
            setSelectedUnitId(unitId);
        }
    };

    const displayedCharacters = useMemo(() => {
        if (!selectedUnitId) {
            // Show all characters if no unit selected
            return UNIT_DATA.flatMap(u => u.charIds);
        }
        const unit = UNIT_DATA.find(u => u.id === selectedUnitId);
        return unit ? unit.charIds : [];
    }, [selectedUnitId]);


    return (
        <div className="space-y-4">
            {/* Unit Filter */}
            <div className="flex flex-wrap gap-2">
                {UNIT_DATA.map(unit => {
                    const iconName = UNIT_ICONS[unit.id] || "";
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
