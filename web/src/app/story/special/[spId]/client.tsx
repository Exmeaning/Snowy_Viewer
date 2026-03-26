"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchStoryAssetFromMirror, StoryAssetMissingError } from "@/lib/storyAsset";
import { processScenarioForDisplay } from "@/lib/storyLoader";
import { IProcessedScenarioData } from "@/types/story";

interface ISpecialStoryEpisode {
    id: number; specialStoryId: number; episodeNo: number;
    title: string; assetbundleName: string; scenarioId: string;
}
interface ISpecialStory {
    id: number; seq: number; title?: string;
    episodes: ISpecialStoryEpisode[];
}

type EpResult = { data: IProcessedScenarioData | null; missing: string[] | null; err: string | null };

export default function StorySpecialReaderClient() {
    const params = useParams();
    const { serverSource } = useTheme();
    const spId = Number(params.spId);
    const lang: "jp" | "cn" = serverSource === "cn" ? "cn" : "jp";

    const [story, setStory] = useState<ISpecialStory | null>(null);
    const [results, setResults] = useState<EpResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!spId) return;
        async function load() {
            setIsLoading(true);
            try {
                const data = await fetchMasterData<ISpecialStory[]>("specialStories.json");
                const s = data.find(x => x.id === spId);
                if (!s || s.id === 2) return;
                setStory(s);
                const title = s.title ?? s.episodes[0]?.title ?? `SP${spId}`;
                document.title = `${title} - 特殊剧情 - Moesekai`;

                const epResults: EpResult[] = await Promise.all(
                    s.episodes.map(async (ep): Promise<EpResult> => {
                        try {
                            const raw = await fetchStoryAssetFromMirror("special", lang, {
                                assetbundleName: ep.assetbundleName,
                                scenarioId: ep.scenarioId,
                            });
                            return { data: await processScenarioForDisplay(raw), missing: null, err: null };
                        } catch (err) {
                            if (err instanceof StoryAssetMissingError)
                                return { data: null, missing: err.missingPaths, err: null };
                            return { data: null, missing: null, err: err instanceof Error ? err.message : "加载失败" };
                        }
                    })
                );
                setResults(epResults);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [spId, lang]);

    const storyTitle = story?.title ?? story?.episodes[0]?.title ?? `特殊剧情 ${spId}`;
    const multiEp = (story?.episodes.length ?? 0) > 1;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/special" className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回特殊剧情列表
                </Link>

                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-miku font-medium">SP{spId}</span>
                        <h1 className="font-bold text-slate-900 dark:text-slate-100">{storyTitle}</h1>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${serverSource === "cn" ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50" : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50"}`}>
                            {serverSource === "cn" ? "国服" : "日服"}
                        </span>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-12 h-12 border-4 border-miku/30 border-t-miku rounded-full animate-spin mb-4" />
                        <p className="text-slate-500">正在加载剧情...</p>
                    </div>
                )}

                {!isLoading && story && results.length > 0 && (
                    <div className="max-w-4xl mx-auto space-y-10">
                        {story.episodes.map((ep, i) => {
                            const r = results[i];
                            return (
                                <div key={ep.id}>
                                    {multiEp && (
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="px-3 py-1 bg-miku/10 text-miku text-sm font-bold rounded-full border border-miku/20">第 {ep.episodeNo} 话</span>
                                            <h2 className="font-bold text-slate-800 dark:text-slate-200">{ep.title}</h2>
                                        </div>
                                    )}
                                    <StoryReader
                                        scenarioData={r?.data ?? null}
                                        isLoading={false}
                                        error={r?.err ?? null}
                                        missingPaths={r?.missing ?? undefined}
                                        endLabel={multiEp ? `第 ${ep.episodeNo} 话` : storyTitle}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
