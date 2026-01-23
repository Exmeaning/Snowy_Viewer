"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { IGameChara, IUnitProfile, UNIT_DATA, CHARACTER_NAMES } from "@/types/types";
import { getCharacterSelectUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";

const UNIT_ICONS: Record<string, string> = {
    "light_sound": "ln.webp",
    "idol": "mmj.webp",
    "street": "vbs.webp",
    "theme_park": "wxs.webp",
    "school_refusal": "n25.webp",
    "piapro": "vs.webp",
};

// Map unit names from master data to our internal IDs
const UNIT_ID_MAP: Record<string, string> = {
    "light_sound": "ln",
    "idol": "mmj",
    "street": "vbs",
    "theme_park": "ws",
    "school_refusal": "25ji",
    "piapro": "vs",
};

function CharacterListContent() {
    const { assetSource } = useTheme();
    const [characters, setCharacters] = useState<IGameChara[]>([]);
    const [unitProfiles, setUnitProfiles] = useState<IUnitProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 角色";
        async function fetchData() {
            try {
                setIsLoading(true);
                const [charaData, unitData] = await Promise.all([
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                ]);
                setCharacters(charaData);
                setUnitProfiles(unitData);
                setError(null);
            } catch (err) {
                console.error("Error fetching character data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Group characters by unit
    const charactersByUnit = useMemo(() => {
        if (!characters.length || !unitProfiles.length) return {};

        // Sort units by seq
        const sortedUnits = unitProfiles.sort((a, b) => a.seq - b.seq);

        const grouped: Record<string, { unit: IUnitProfile; characters: IGameChara[] }> = {};

        sortedUnits.forEach(unit => {
            const unitCharas = characters.filter(c => c.unit === unit.unit);
            if (unitCharas.length > 0) {
                grouped[unit.unit] = {
                    unit,
                    characters: unitCharas,
                };
            }
        });

        return grouped;
    }, [characters, unitProfiles]);

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-miku border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-500">正在加载角色数据...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-500 underline hover:no-underline"
                    >
                        重试
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">角色图鉴</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    角色 <span className="text-miku">图鉴</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览世界计划中的所有角色
                </p>
            </div>

            {/* Characters grouped by unit */}
            <div className="space-y-10">
                {Object.entries(charactersByUnit).map(([unitId, { unit, characters: unitCharacters }]) => {
                    const iconName = UNIT_ICONS[unitId] || "vs.webp";
                    const internalUnitId = UNIT_ID_MAP[unitId] || unitId;

                    return (
                        <div key={unitId} className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            {/* Unit Header */}
                            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center gap-4">
                                <div className="w-12 h-12 relative shrink-0">
                                    <Image
                                        src={`/data/icon/${iconName}`}
                                        alt={unit.unitName}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg text-slate-800">
                                        <TranslatedText
                                            original={unit.unitName}
                                            category="units"
                                            field="unitName"
                                            inline
                                            translationClassName="text-sm text-slate-500 font-normal ml-2"
                                        />
                                    </h2>
                                    <div className="text-xs text-slate-500 line-clamp-1">
                                        <TranslatedText
                                            original={unit.profileSentence}
                                            category="units"
                                            field="profileSentence"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Characters Grid */}
                            <div className="p-4 sm:p-6">
                                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                                    {unitCharacters.map((chara) => (
                                        <div
                                            key={chara.id}
                                            className={`${unitId === "piapro"
                                                ? "w-[calc(16.666%-10px)] sm:w-[calc(16.666%-14px)]"
                                                : "w-[calc(25%-9px)] sm:w-[calc(25%-12px)]"
                                                }`}
                                        >
                                            <Link
                                                key={chara.id}
                                                href={`/character/${chara.id}`}
                                                className="group relative h-[320px] rounded-xl overflow-hidden bg-white ring-1 ring-slate-100 hover:ring-2 hover:ring-miku transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center p-2"
                                            >
                                                <div className="relative w-full h-full">
                                                    <Image
                                                        src={getCharacterSelectUrl(chara.id, assetSource)}
                                                        alt={CHARACTER_NAMES[chara.id] || `${chara.firstName} ${chara.givenName}`}
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                                {/* Character name overlay on hover */}
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-white text-xs font-bold text-center truncate">
                                                        {CHARACTER_NAMES[chara.id] || `${chara.firstName}${chara.givenName}`}
                                                    </p>
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function CharacterPage() {
    return (
        <MainLayout activeNav="角色">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载角色...</div>}>
                <CharacterListContent />
            </Suspense>
        </MainLayout>
    );
}
