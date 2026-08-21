"use client";
import { useState, useEffect } from "react";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
import { IUnitProfile } from "@/types/types";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";
import { useI18n } from "@/contexts/I18nContext";

interface IUnitStoryChapterEpisode {
    episodeNo: number;
    title: string;
    scenarioId: string;
    unitStoryEpisodeGroupId: number;
    releaseConditionId: number;
}
interface IUnitStoryChapter {
    assetbundleName: string;
    episodes: IUnitStoryChapterEpisode[];
}
interface IUnitStory {
    id: number;
    seq: number;
    unit: string;
    chapters: IUnitStoryChapter[];
}

function getUnitOutlineLogoUrl(unitCode: string, server: string): string {
    const s = server === "cn" ? "cn" : "jp";
    return `/images/unit-logos/logo_${unitCode}_${s}.png`;
}

export default function StoryUnitListClient() {
    const { serverSource } = useTheme();
    const { t } = useI18n();
    const [units, setUnits] = useState<{ profile: IUnitProfile; story: IUnitStory }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useSimpleScrollRestore("story_unit", !isLoading);

    useEffect(() => {
        async function load() {
            try {
                const [profiles, stories] = await Promise.all([
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                    fetchMasterData<IUnitStory[]>("unitStories.json"),
                ]);
                const merged = profiles
                    .map(p => {
                        const story = stories.find(s => s.seq === p.seq);
                        return story ? { profile: p, story } : null;
                    })
                    .filter(Boolean) as { profile: IUnitProfile; story: IUnitStory }[];
                merged.sort((a, b) => {
                    // piapro always last
                    if (a.profile.unit === "piapro") return 1;
                    if (b.profile.unit === "piapro") return -1;
                    return a.profile.seq - b.profile.seq;
                });
                setUnits(merged);
            } catch (err) {
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource, t]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="unit" />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="hh-spinner w-10 h-10"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {units.map(({ profile, story }) => {
                            const logoUrl = getUnitOutlineLogoUrl(profile.unit, serverSource);
                            const episodeCount = story.chapters[0]?.episodes.length ?? 0;
                            return (
                                <Link
                                    key={profile.seq}
                                    href={`/story/unit/${profile.seq}`}
                                    className="hh-tile hh-press hh-focusable p-5 flex flex-col items-center gap-3 text-center group transition-colors hover:border-[var(--hh-accent-line)]"
                                >
                                    <div className="w-full h-14 flex items-center justify-center">
                                        <img
                                            src={logoUrl}
                                            alt={profile.unitName}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="hh-title text-sm font-bold text-[var(--hh-text-primary)] group-hover:text-miku transition-colors">
                                            {profile.unitName}
                                        </h2>
                                        <p className="hh-numeric text-xs text-[var(--hh-text-tertiary)] mt-0.5">{t("page.story.unit.episodeCount", { count: episodeCount })}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
