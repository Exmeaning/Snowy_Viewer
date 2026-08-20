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
import type { UiLocale } from "@/lib/i18n";

export default function StoryEventReaderClient() {
    const params = useParams();
    const { assetSource, serverSource, useLLMTranslation } = useTheme();
    const { locale, t } = useI18n();
    const eventId = parseInt(params.eventId as string);
    const episodeNo = parseInt(params.episodeNo as string);

    const [eventStory, setEventStory] = useState<IEventStory | null>(null);
    const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
    const [translationState, setTranslationState] = useState<{
        eventId: number;
        episodeNo: number;
        locale: UiLocale;
        translation: IEventStoryTranslation | null;
        translatedTitle: string | null;
    } | null>(null);
    const [masterLoading, setMasterLoading] = useState(true);

    const activeTranslation = translationState?.eventId === eventId
        && translationState.episodeNo === episodeNo
        && translationState.locale === locale
        ? translationState
        : null;
    const translation = activeTranslation?.translation ?? null;
    const translatedTitle = activeTranslation?.translatedTitle ?? null;

    // Load master data + translation
    useEffect(() => {
        if (!eventId || !episodeNo) return;
        let cancelled = false;
        async function load() {
            setMasterLoading(true);
            try {
                const [storiesData, eventsData, translationsData, trans] = await Promise.all([
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(locale),
                    serverSource !== "cn" ? loadEventStoryTranslation(eventId, locale) : Promise.resolve(null),
                ]);
                if (cancelled) return;
                const story = storiesData.find(s => s.eventId === eventId) ?? null;
                setEventStory(story);
                const event = eventsData.find(e => e.id === eventId) ?? null;
                setEventInfo(event);

                let nextTranslatedTitle: string | null = null;
                if (story) {
                    const ep = story.eventStoryEpisodes.find(e => e.episodeNo === episodeNo);
                    if (ep) {
                        const title = mergeStoryTitle(ep.title, trans, episodeNo);
                        nextTranslatedTitle = title;
                        const eventName = translationsData?.events?.name?.[event?.name ?? ""] ?? event?.name ?? t("page.story.event.fallbackEventName", { id: eventId });
                        document.title = `${title} - ${eventName} - Moesekai`;
                    }
                }
                setTranslationState({ eventId, episodeNo, locale, translation: trans, translatedTitle: nextTranslatedTitle });
            } finally {
                if (!cancelled) setMasterLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [eventId, episodeNo, locale, serverSource, t]);

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
        translationLocale: locale,
        fallbackErrorMessage: t("common.state.loadingFailed"),
    });

    const displayTitle = useLLMTranslation && translatedTitle ? translatedTitle : episode?.title;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link 
                    href={`/story/event/${eventId}`} 
                    className="hh-btn hh-press px-4 py-2 mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.unit.backToChapters")}
                </Link>

                {/* Header */}
                <div className="hh-tile p-4 mb-6">
                    <div className="flex items-center gap-4">
                        {eventStory && (
                            <img src={getEventLogoUrl(eventStory.assetbundleName, assetSource)} alt="" className="w-16 h-16 object-contain hidden sm:block bg-[var(--hh-surface-sunken)] p-1 rounded-[var(--hh-radius-md)]" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="hh-label">{eventInfo?.name ?? t("page.story.event.fallbackEventName", { id: eventId })}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <h1 className="hh-title text-[var(--hh-text-primary)] text-base sm:text-lg">
                                    <span className="text-[var(--hh-accent)]">{t("page.story.event.episodeLabel", { episode: episodeNo })}</span>
                                    {displayTitle && ` — ${displayTitle}`}
                                </h1>
                                {useLLMTranslation && translationSource && (
                                    <span className={`hh-label px-1.5 py-0.5 rounded-[var(--hh-radius-sm)] border ${
                                        translationSource === "official_cn"
                                            ? "border-amber-500/45 bg-amber-500/15"
                                            : translationSource === "human"
                                            ? "border-emerald-500/45 bg-emerald-500/15"
                                            : "border-[var(--hh-border)] bg-[var(--hh-surface-sunken)]"
                                    }`}>
                                        {translationSource === "official_cn" ? t("page.story.reader.translationSources.officialCn") : translationSource === "human" ? (eventId <= 198 ? t("page.story.reader.translationSources.aiPolishedShort") : t("page.story.reader.translationSources.human")) : t("page.story.reader.translationSources.ai")}
                                    </span>
                                )}
                                <span className={`hh-label px-1.5 py-0.5 rounded-[var(--hh-radius-sm)] border ${
                                    serverSource === "cn"
                                        ? "border-rose-500/45 bg-rose-500/15"
                                        : "border-blue-500/45 bg-blue-500/15"
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
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-[var(--hh-border)] max-w-4xl mx-auto gap-4">
                        {prevEpisode ? (
                            <Link 
                                href={`/story/event/${eventId}/${prevEpisode.episodeNo}`} 
                                className="hh-tile hh-press flex items-center gap-2.5 px-4 py-2.5 max-w-[45%] hover:border-[var(--hh-accent-line)]"
                            >
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <div className="text-left min-w-0">
                                    <div className="hh-label">{t("page.story.navigation.previousEpisode")}</div>
                                    <div className="hh-title text-xs text-[var(--hh-text-primary)] truncate">{prevEpisode.title}</div>
                                </div>
                            </Link>
                        ) : <div />}
                        {nextEpisode ? (
                            <Link 
                                href={`/story/event/${eventId}/${nextEpisode.episodeNo}`} 
                                className="hh-tile hh-press flex items-center gap-2.5 px-4 py-2.5 max-w-[45%] text-right justify-end hover:border-[var(--hh-accent-line)]"
                            >
                                <div className="text-right min-w-0">
                                    <div className="hh-label">{t("page.story.navigation.nextEpisode")}</div>
                                    <div className="hh-title text-xs text-[var(--hh-text-primary)] truncate">{nextEpisode.title}</div>
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
