"use client";
import { useState, useEffect } from "react";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";

interface ISpecialStoryEpisode {
    id: number;
    specialStoryId: number;
    episodeNo: number;
    title: string;
    assetbundleName: string;
    scenarioId: string;
}
interface ISpecialStory {
    id: number;
    seq: number;
    title?: string;
    episodes: ISpecialStoryEpisode[];
}

export default function StorySpecialListClient() {
    const { serverSource } = useTheme();
    const { t } = useI18n();
    const [stories, setStories] = useState<ISpecialStory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useSimpleScrollRestore("story_special", !isLoading);

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchMasterData<ISpecialStory[]>("specialStories.json");
                // Skip id == 2 (special case per crawler)
                setStories(data.filter(s => s.id !== 2 && s.episodes.length > 0));
            } catch (err) {
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource, t]);

    function getTitle(s: ISpecialStory): string {
        return s.title ?? s.episodes[0]?.title ?? t("page.story.special.fallbackTitle", { id: s.id });
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="special" />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="hh-spinner w-10 h-10"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-2">
                        {stories.map(s => (
                            <Link
                                key={s.id}
                                href={`/story/special/${s.id}`}
                                className="hh-tile hh-press hh-focusable flex items-center justify-between p-4 transition-colors hover:border-[var(--hh-accent-line)] group"
                            >
                                <div>
                                    <span className="hh-numeric text-xs text-miku font-medium">SP{s.id}</span>
                                    <p className="font-medium text-[var(--hh-text-primary)] group-hover:text-miku transition-colors mt-0.5">
                                        {getTitle(s)}
                                    </p>
                                    <p className="hh-numeric text-xs text-[var(--hh-text-tertiary)] mt-0.5">{t("page.story.special.episodeCount", { count: s.episodes.length })}</p>
                                </div>
                                <svg className="w-5 h-5 text-[var(--hh-text-tertiary)] group-hover:text-miku transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
