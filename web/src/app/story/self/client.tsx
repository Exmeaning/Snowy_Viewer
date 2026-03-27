"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { IGameChara, ICharaProfile, UNIT_NAME_MAP } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";

const UNIT_ORDER = ["light_sound", "idol", "street", "theme_park", "school_refusal", "piapro"];

export default function StorySelfListClient() {
    const { serverSource } = useTheme();
    const [charas, setCharas] = useState<IGameChara[]>([]);
    const [profiles, setProfiles] = useState<ICharaProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useSimpleScrollRestore("story_self", !isLoading);

    useEffect(() => {
        async function load() {
            try {
                const [charasData, profilesData] = await Promise.all([
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterData<ICharaProfile[]>("characterProfiles.json"),
                ]);
                setCharas(charasData);
                setProfiles(profilesData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource]);

    const profileMap = new Map(profiles.map(p => [p.characterId, p]));

    // Group by unit
    const unitGroups = UNIT_ORDER.map(unit => ({
        unit,
        name: UNIT_NAME_MAP[unit] ?? unit,
        charas: charas.filter(c => c.unit === unit && profileMap.has(c.id)),
    })).filter(g => g.charas.length > 0);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="self" />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-8">
                        {unitGroups.map(({ unit, name, charas: unitCharas }) => (
                            <div key={unit}>
                                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 text-center">{name}</h2>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {unitCharas.map(c => {
                                        const charaName = `${c.firstName ?? ""}${c.givenName}`;
                                        return (
                                            <Link
                                                key={c.id}
                                                href={`/story/self/${c.id}`}
                                                className="group flex flex-col items-center gap-2 p-3 w-[calc(50%-6px)] sm:w-28 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all"
                                            >
                                                <img
                                                    src={getCharacterIconUrl(c.id)}
                                                    alt={charaName}
                                                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 group-hover:border-miku/50 transition-colors"
                                                />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-miku transition-colors text-center leading-tight">
                                                    {charaName}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
