"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
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
import { useI18n } from "@/contexts/I18nContext";

export default function StoryEventReaderClient() {
    const params = useParams();
    const { assetSource, serverSource, useLLMTranslation } = useTheme();
    const { t } = useI18n();
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
                        const eventName = translationsData?.events?.name?.[event?.name ?? ""] ?? event?.name ?? t("page.story.event.fallbackEventName", { id: eventId });
                        document.title = `${title} - ${eventName} - Moesekai`;
                    }
                }
            } finally {
                setMasterLoading(false);
            }
        }
        load();
    }, [eventId, episodeNo, serverSource, t]);

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
        fallbackErrorMessage: t("common.state.loadingFailed"),
    });

    const displayTitle = useLLMTranslation && translatedTitle ? translatedTitle : episode?.title;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link 
                    href={`/story/event/${eventId}`} 
                    className="ios-glass-btn border-none hover:bg-miku/10 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.unit.backToChapters")}
                </Link>

                {/* Header */}
                <div className="ios-glass-card border-none rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-4">
                        {eventStory && (
                            <img src={getEventLogoUrl(eventStory.assetbundleName, assetSource)} alt="" className="w-16 h-16 object-contain hidden sm:block bg-white/5 p-1 rounded-xl" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{eventInfo?.name ?? t("page.story.event.fallbackEventName", { id: eventId })}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <h1 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg">
                                    <span className="text-miku">{t("page.story.event.episodeLabel", { episode: episodeNo })}</span>
                                    {displayTitle && ` — ${displayTitle}`}
                                </h1>
                                {useLLMTranslation && translationSource && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                        translationSource === "official_cn"
                                            ? "bg-amber-100/50 text-amber-800 border-amber-200/20 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30"
                                            : translationSource === "human"
                                            ? "bg-emerald-100/50 text-emerald-800 border-emerald-200/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/30"
                                            : "bg-slate-100/50 text-slate-600 border-slate-200/20 dark:bg-slate-800/20 dark:text-slate-400 dark:border-slate-700/30"
                                    }`}>
                                        {translationSource === "official_cn" ? t("page.story.reader.translationSources.officialCn") : translationSource === "human" ? (eventId <= 198 ? t("page.story.reader.translationSources.aiPolishedShort") : t("page.story.reader.translationSources.human")) : t("page.story.reader.translationSources.ai")}
                                    </span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    serverSource === "cn"
                                        ? "bg-rose-105/50 text-rose-600 border-rose-500/20 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700/30"
                                        : "bg-blue-105/50 text-blue-600 border-blue-500/20 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700/30"
                                }`}>
                                    {t(`page.story.serverSource.${serverSource}`)}
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
                    endLabel={t("page.story.event.episodeLabel", { episode: episodeNo })}
                    translationSource={translationSource}
                    storyType="event"
                    storyId={eventId}
                />

                {!isLoading && !masterLoading && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 max-w-4xl mx-auto gap-4">
                        {prevEpisode ? (
                            <Link 
                                href={`/story/event/${eventId}/${prevEpisode.episodeNo}`} 
                                className="ios-glass-card ios-glass-card-interactive border-none flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-primary-text hover:text-miku transition-colors max-w-[45%]"
                            >
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <div className="text-left min-w-0">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("page.story.navigation.previousEpisode")}</div>
                                    <div className="text-xs font-extrabold truncate">{prevEpisode.title}</div>
                                </div>
                            </Link>
                        ) : <div />}
                        {nextEpisode ? (
                            <Link 
                                href={`/story/event/${eventId}/${nextEpisode.episodeNo}`} 
                                className="ios-glass-card ios-glass-card-interactive border-none flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-primary-text hover:text-miku transition-colors max-w-[45%] text-right justify-end"
                            >
                                <div className="text-right min-w-0">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("page.story.navigation.nextEpisode")}</div>
                                    <div className="text-xs font-extrabold truncate">{nextEpisode.title}</div>
                                </div>
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                        ) : <div />}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
