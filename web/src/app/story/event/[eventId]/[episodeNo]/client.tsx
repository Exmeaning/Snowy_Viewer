"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { useStoryAsset } from "@/hooks/useStoryAsset";
import { fetchMasterData } from "@/lib/fetch";
import { getEventLogoUrl } from "@/lib/assets";
import { IEventStory } from "@/types/story";
import { IEventInfo } from "@/types/events";
import { useTheme } from "@/contexts/ThemeContext";
import { loadEventStoryTranslation, IEventStoryTranslation } from "@/lib/eventStoryTranslation";
import { loadTranslations } from "@/lib/translations";
import { mergeStoryTitle } from "@/lib/storyLoader";

export default function StoryEventReaderClient() {
    const params = useParams();
    const { assetSource, serverSource, useLLMTranslation } = useTheme();
    const eventId = parseInt(params.eventId as string);
    const episodeNo = parseInt(params.episodeNo as string);

    const [eventStory, setEventStory] = useState<IEventStory | null>(null);
    const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
    const [translation, setTranslation] = useState<IEventStoryTranslation | null>(null);
    const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
    const [masterLoading, setMasterLoading] = useState(true);

    // Load master data + translation
    useEffect(() => {
        if (!eventId || !episodeNo) return;
        async function load() {
            setMasterLoading(true);
            try {
                const [storiesData, eventsData, translationsData, trans] = await Promise.all([
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(),
                    serverSource === "jp" ? loadEventStoryTranslation(eventId) : Promise.resolve(null),
                ]);
                const story = storiesData.find(s => s.eventId === eventId) ?? null;
                setEventStory(story);
                const event = eventsData.find(e => e.id === eventId) ?? null;
                setEventInfo(event);
                setTranslation(trans);

                if (story) {
                    const ep = story.eventStoryEpisodes.find(e => e.episodeNo === episodeNo);
                    if (ep) {
                        const title = mergeStoryTitle(ep.title, trans, episodeNo);
                        setTranslatedTitle(title);
                        const eventName = translationsData?.events?.name?.[event?.name ?? ""] ?? event?.name ?? `活动 ${eventId}`;
                        document.title = `${title} - ${eventName} - Moesekai`;
                    }
                }
            } finally {
                setMasterLoading(false);
            }
        }
        load();
    }, [eventId, episodeNo, serverSource]);

    const episode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo);
    const prevEpisode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo - 1);
    const nextEpisode = eventStory?.eventStoryEpisodes.find(ep => ep.episodeNo === episodeNo + 1);

    const { scenarioData, isLoading, error, missingPaths, translationSource } = useStoryAsset({
        type: "event",
        params: episode && eventStory ? {
            assetbundleName: eventStory.assetbundleName,
            scenarioId: episode.scenarioId,
        } : null,
        translation: useLLMTranslation ? translation : null,
        episodeNo,
    });

    const displayTitle = useLLMTranslation && translatedTitle ? translatedTitle : episode?.title;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href={`/story/event/${eventId}`} className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回章节列表
                </Link>

                {/* Header */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        {eventStory && (
                            <img src={getEventLogoUrl(eventStory.assetbundleName, assetSource)} alt="" className="w-16 h-16 object-contain hidden sm:block" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-slate-500 text-sm">{eventInfo?.name ?? `活动 ${eventId}`}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="font-bold text-slate-900 dark:text-slate-100">
                                    <span className="text-miku">第 {episodeNo} 话</span>
                                    {displayTitle && ` — ${displayTitle}`}
                                </h1>
                                {useLLMTranslation && translationSource && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                        translationSource === "official_cn"
                                            ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50"
                                            : translationSource === "human"
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50"
                                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700"
                                    }`}>
                                        {translationSource === "official_cn" ? "官方CN" : translationSource === "human" ? (eventId <= 198 ? "AI翻译+人工精校" : "人工翻译") : "AI翻译"}
                                    </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    serverSource === "cn"
                                        ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50"
                                        : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50"
                                }`}>
                                    {serverSource === "cn" ? "国服" : "日服"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <StoryReader
                    scenarioData={scenarioData}
                    isLoading={isLoading || masterLoading}
                    error={error}
                    missingPaths={missingPaths ?? undefined}
                    endLabel={`第 ${episodeNo} 话`}
                    translationSource={translationSource}
                    storyType="event"
                    storyId={eventId}
                />

                {/* Episode navigation */}
                {!isLoading && !masterLoading && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 max-w-4xl mx-auto">
                        {prevEpisode ? (
                            <Link href={`/story/event/${eventId}/${prevEpisode.episodeNo}`} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <div className="text-left">
                                    <div className="text-xs text-slate-400">上一话</div>
                                    <div className="text-sm font-medium">{prevEpisode.title}</div>
                                </div>
                            </Link>
                        ) : <div />}
                        {nextEpisode ? (
                            <Link href={`/story/event/${eventId}/${nextEpisode.episodeNo}`} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors">
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">下一话</div>
                                    <div className="text-sm font-medium">{nextEpisode.title}</div>
                                </div>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                        ) : <div />}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
