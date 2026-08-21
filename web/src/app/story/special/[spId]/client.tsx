"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
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
    const { serverSource, assetSource } = useTheme();
    const { t } = useI18n();
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
                document.title = t("page.story.special.documentTitle", { name: title });

                const epResults: EpResult[] = await Promise.all(
                    s.episodes.map(async (ep): Promise<EpResult> => {
                        try {
                            const raw = await fetchStoryAssetFromMirror("special", assetSource, {
                                assetbundleName: ep.assetbundleName,
                                scenarioId: ep.scenarioId,
                            });
                            return { data: await processScenarioForDisplay(raw, "special", assetSource, serverSource), missing: null, err: null };
                        } catch (err) {
                            if (err instanceof StoryAssetMissingError)
                                return { data: null, missing: err.missingPaths, err: null };
                            return { data: null, missing: null, err: err instanceof Error ? err.message : t("common.state.loadingFailed") };
                        }
                    })
                );
                setResults(epResults);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spId, lang, t]);

    const storyTitle = story?.title ?? story?.episodes[0]?.title ?? t("page.story.special.fallbackTitle", { id: spId });
    const multiEp = (story?.episodes.length ?? 0) > 1;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/special" className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.special.backToList")}
                </Link>

                <div className="hh-tile p-4 mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="hh-numeric text-xs text-miku font-medium">SP{spId}</span>
                        <h1 className="hh-title font-bold text-[var(--hh-text-primary)]">{storyTitle}</h1>
                        <span className={`hh-label px-1.5 py-0.5 rounded-[var(--hh-radius-sm)] border ${serverSource === "cn" ? "border-rose-500/45 bg-rose-500/15" : "border-blue-500/45 bg-blue-500/15"}`}>
                            {t(`page.story.serverSource.${serverSource}`)}
                        </span>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="hh-spinner w-12 h-12 mb-4" />
                        <p className="text-[var(--hh-text-secondary)]">{t("page.story.special.loading")}</p>
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
                                            <span className="hh-numeric px-3 py-1 bg-[var(--hh-accent-wash)] text-miku text-sm font-bold rounded-[var(--hh-radius-md)] border border-miku/20">{t("page.story.special.episodeLabel", { episode: ep.episodeNo })}</span>
                                            <h2 className="hh-title font-bold text-[var(--hh-text-primary)]">{ep.title}</h2>
                                        </div>
                                    )}
                                    <StoryReader
                                        scenarioData={r?.data ?? null}
                                        isLoading={false}
                                        error={r?.err ?? null}
                                        missingPaths={r?.missing ?? undefined}
                                        endLabel={multiEp ? t("page.story.special.episodeLabel", { episode: ep.episodeNo }) : storyTitle}
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
