"use client";
import { useState, useEffect } from "react";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { IGameChara, ICharaProfile, UNIT_FIELD_LABEL_KEYS } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";

const UNIT_ORDER = ["light_sound", "idol", "street", "theme_park", "school_refusal", "piapro"];

export default function StorySelfListClient() {
    const { serverSource } = useTheme();
    const { t } = useI18n();
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
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource, t]);

    const profileMap = new Map(profiles.map(p => [p.characterId, p]));

    // Group by unit
    const unitGroups = UNIT_ORDER.map(unit => ({
        unit,
        labelKey: UNIT_FIELD_LABEL_KEYS[unit],
        charas: charas.filter(c => c.unit === unit && profileMap.has(c.id)),
    })).filter(g => g.charas.length > 0);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="self" />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="hh-spinner w-10 h-10"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-8">
                        {unitGroups.map(({ unit, labelKey, charas: unitCharas }) => (
                            <div key={unit}>
                                <h2 className="hh-label text-sm mb-3 text-center">{labelKey ? t(labelKey) : unit}</h2>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {unitCharas.map(c => {
                                        const charaName = `${c.firstName ?? ""}${c.givenName}`;
                                        return (
                                            <Link
                                                key={c.id}
                                                href={`/story/self/${c.id}`}
                                                className="hh-tile hh-press hh-focusable group flex flex-col items-center gap-2 p-3 w-[calc(50%-6px)] sm:w-28 transition-colors hover:border-[var(--hh-accent-line)]"
                                            >
                                                <img
                                                    src={getCharacterIconUrl(c.id)}
                                                    alt={charaName}
                                                    className="w-14 h-14 rounded-full object-cover border-2 border-[var(--hh-border)] group-hover:border-miku/50 transition-colors"
                                                />
                                                <span className="text-xs font-medium text-[var(--hh-text-primary)] group-hover:text-miku transition-colors text-center leading-tight">
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
