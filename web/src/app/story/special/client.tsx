"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
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
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource]);

    function getTitle(s: ISpecialStory): string {
        return s.title ?? s.episodes[0]?.title ?? `特殊剧情 ${s.id}`;
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="special" />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-2">
                        {stories.map(s => (
                            <Link
                                key={s.id}
                                href={`/story/special/${s.id}`}
                                className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-sm transition-all group"
                            >
                                <div>
                                    <span className="text-xs text-miku font-medium">SP{s.id}</span>
                                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-miku transition-colors mt-0.5">
                                        {getTitle(s)}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">{s.episodes.length} 话</p>
                                </div>
                                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
