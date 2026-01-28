"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { StorySnippet } from "@/components/story/StorySnippet";
import { fetchScenarioData, processScenarioForDisplay, mergeTranslations, mergeStoryTitle } from "@/lib/storyLoader";
import { fetchMasterData } from "@/lib/fetch";
import { getEventLogoUrl, getAssetBaseUrl, getScenarioJsonUrl } from "@/lib/assets";
import { IProcessedScenarioData, IEventStory } from "@/types/story";
import { IEventInfo } from "@/types/events";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { loadEventStoryTranslation } from "@/lib/eventStoryTranslation";

export default function StoryReaderClient() {
    const params = useParams();
    const { assetSource } = useTheme();

    // params.id comes from [id] folder (was eventId)
    const eventId = parseInt(params.id as string);
    const episodeNo = parseInt(params.episodeNo as string);

    const [scenarioData, setScenarioData] = useState<IProcessedScenarioData | null>(null);
    const [eventStory, setEventStory] = useState<IEventStory | null>(null);
    const [events, setEvents] = useState<IEventInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [translatedEpisodeTitle, setTranslatedEpisodeTitle] = useState<string | null>(null);
    const [translationSource, setTranslationSource] = useState<'official_cn' | 'llm' | undefined>(undefined);

    const { useLLMTranslation } = useTheme();
    // Load story data
    useEffect(() => {
        async function loadStory() {
            try {
                setIsLoading(true);
                setError(null);

                // Fetch master data and event story translation in parallel
                const [storiesData, eventsData, translationsData, eventStoryTranslation] = await Promise.all([
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(),
                    loadEventStoryTranslation(eventId),
                ]);
                setEvents(eventsData);
                setTranslations(translationsData);

                // Find the event story
                const story = storiesData.find(s => s.eventId === eventId);
                if (!story) {
                    throw new Error(`Event ${eventId} not found`);
                }
                setEventStory(story);

                // Find the episode
                const episode = story.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo);
                if (!episode) {
                    throw new Error(`Episode ${episodeNo} not found`);
                }

                // Build scenario URL
                const scenarioPath = `event_story/${story.assetbundleName}/scenario/${episode.scenarioId}`;
                const scenarioUrl = getScenarioJsonUrl(scenarioPath, assetSource);

                // Fetch and process scenario
                const rawData = await fetchScenarioData(scenarioUrl);
                const processedData = await processScenarioForDisplay(rawData);

                // Merge CN translations into actions
                const actionsWithTranslation = mergeTranslations(
                    processedData.actions,
                    eventStoryTranslation,
                    episodeNo
                );
                setScenarioData({
                    ...processedData,
                    actions: actionsWithTranslation,
                });

                // Update title and source
                const episodeTitle = mergeStoryTitle(episode.title, eventStoryTranslation, episodeNo);
                setTranslatedEpisodeTitle(episodeTitle);
                setTranslationSource(eventStoryTranslation?.meta?.source);

                const event = eventsData.find(e => e.id === eventId);
                const eventName = translationsData?.events?.name?.[event?.name || ""] || event?.name || `活动 ${eventId}`;
                document.title = `${episodeTitle} - ${eventName} - Snowy SekaiViewer`;

            } catch (err: any) {
                console.error("Error loading story:", err);
                setError(err instanceof Error ? err.message : "Failed to load story");
            } finally {
                setIsLoading(false);
            }
        }

        if (eventId && episodeNo) {
            loadStory();
        }
    }, [eventId, episodeNo, assetSource]);

    // Get event name helper
    const getEventName = (): string => {
        const event = events.find(e => e.id === eventId);
        if (!event) return `活动 ${eventId}`;
        const translatedName = translations?.events?.name?.[event.name];
        return translatedName || event.name;
    };

    // Get current episode
    const currentEpisode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo);

    // Navigation helpers
    const prevEpisode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo - 1);
    const nextEpisode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo + 1);

    return (
        <MainLayout activeNav="活动剧情">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Back Navigation */}
                <Link
                    href={`/eventstory/${eventId}`}
                    className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回话列表
                </Link>

                {/* Header */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        {eventStory && (
                            <img
                                src={getEventLogoUrl(eventStory.assetbundleName, assetSource)}
                                alt={getEventName()}
                                className="w-16 h-16 object-contain hidden sm:block"
                            />
                        )}
                        <div className="flex-1">
                            <p className="text-slate-500 text-sm">{getEventName()}</p>
                            <div className="flex items-center gap-2">
                                {currentEpisode ? (
                                    <div className="min-w-0 flex items-center gap-2">
                                        <div className="min-w-0">
                                            <h1 className="font-bold truncate text-slate-900 dark:text-slate-100">
                                                <span className="text-miku">第 {episodeNo} 话</span>
                                                {" - "}
                                                {useLLMTranslation && translatedEpisodeTitle ? translatedEpisodeTitle : currentEpisode?.title}
                                            </h1>
                                            <p className="text-sm text-slate-500 truncate">
                                                {events?.find(e => e.id === Number(params.id))?.name}
                                            </p>
                                        </div>
                                        {useLLMTranslation && translationSource && (
                                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${translationSource === 'official_cn'
                                                ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50'
                                                : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700'
                                                }`}>
                                                {translationSource === 'official_cn' ? '官方CN' : 'AI翻译'}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <h1 className="text-xl font-bold text-primary-text">
                                        `第 ${episodeNo} 话`
                                    </h1>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-12 h-12 border-4 border-miku/30 border-t-miku rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-500">正在加载剧情...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm mb-6">
                        <p className="font-bold">加载失败</p>
                        <p>{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 text-red-500 underline hover:no-underline"
                        >
                            重试
                        </button>
                    </div>
                )}

                {/* Story Content */}
                {!isLoading && !error && scenarioData && (
                    <div className="max-w-4xl mx-auto">
                        {/* Characters Appearing */}
                        {scenarioData.characters.length > 0 && (
                            <div className="mb-6 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700">
                                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                                    出场角色
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {scenarioData.characters.map((char) => (
                                        <span
                                            key={char.id}
                                            className="px-3 py-1 bg-miku/10 text-miku text-sm font-medium rounded-full border border-miku/20"
                                        >
                                            {char.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Story Snippets */}
                        <div className="space-y-1">
                            {scenarioData.actions.map((action, index) => (
                                <StorySnippet key={index} action={action} />
                            ))}
                        </div>

                        {/* End Marker */}
                        {scenarioData.actions.length > 0 && (
                            <div className="text-center py-8 text-slate-400">
                                — 第 {episodeNo} 话 结束 —
                            </div>
                        )}

                        {/* Episode Navigation */}
                        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                            {prevEpisode ? (
                                <Link
                                    href={`/eventstory/${eventId}/${prevEpisode.episodeNo}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    <div className="text-left">
                                        <div className="text-xs text-slate-400">上一话</div>
                                        <div className="text-sm font-medium">{prevEpisode.title}</div>
                                    </div>
                                </Link>
                            ) : (
                                <div></div>
                            )}

                            {nextEpisode ? (
                                <Link
                                    href={`/eventstory/${eventId}/${nextEpisode.episodeNo}`}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors"
                                >
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400">下一话</div>
                                        <div className="text-sm font-medium">{nextEpisode.title}</div>
                                    </div>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            ) : (
                                <div></div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
