"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData, fetchBilibiliEventsData } from "@/lib/fetch";
import {
  IEventInfo,
  IBilibiliEventsResponse,
  IBilibiliEvent,
} from "@/types/events";
import { IEventStory } from "@/types/story";
import {
  getEventLogoUrl,
  getEventBannerUrl,
  getStoryEpisodeImageUrl,
} from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { IStoryAdminResponse, IStoryAdminChapter } from "@/types/storyAdmin";
import ExternalLink from "@/components/ExternalLink";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";
import {
  getStoryTranslation,
  loadEventStoryTranslation,
  selectEventStoryLocalizedText,
  type IEventStoryTranslation,
} from "@/lib/eventStoryTranslation";
import type { UiLocale } from "@/lib/i18n";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";

const STORY_DETAIL_MIRROR_BASE_URL = "https://moe.exmeaning.com/story/detail";

interface IHubStoryDetailChapter {
  chapter_no: number;
  title_jp: string;
  title_cn: string;
  summary_cn: string;
  character_ids?: number[];
  image_url?: string;
}

interface IHubStoryDetailResponse {
  event_id: number;
  title_jp: string;
  title_cn: string;
  outline_jp?: string;
  outline_cn?: string;
  summary_cn?: string;
  chapters?: IHubStoryDetailChapter[];
}

function getStoryDetailMirrorUrl(eventId: number): string {
  return `${STORY_DETAIL_MIRROR_BASE_URL}/event_${String(eventId).padStart(3, "0")}.json`;
}

function normalizeMirrorStoryDetail(
  data: IHubStoryDetailResponse,
  eventId: number,
  assetbundleName: string,
  story?: IEventStory,
): IStoryAdminResponse {
  const episodeMap = new Map(
    (story?.eventStoryEpisodes ?? []).map((episode) => [
      episode.episodeNo,
      episode,
    ]),
  );
  const chapters = (data.chapters ?? []).map((chapter, index) => {
    const episode = episodeMap.get(chapter.chapter_no);
    return {
      id: index + 1,
      event_id: eventId,
      chapter_no: chapter.chapter_no,
      scenario_id: episode?.scenarioId ?? "",
      title_jp: chapter.title_jp || episode?.title || "",
      title_cn: chapter.title_cn || "",
      summary_cn: chapter.summary_cn || "",
      asset_bundle_name: assetbundleName,
      character_ids: JSON.stringify(chapter.character_ids ?? []),
      created_at: "",
      updated_at: "",
    } satisfies IStoryAdminChapter;
  });

  return {
    id: eventId,
    event_id: eventId,
    asset_bundle_name: assetbundleName,
    title_jp: data.title_jp || "",
    title_cn: data.title_cn || "",
    outline_jp: data.outline_jp || story?.outline || "",
    outline_cn: data.outline_cn || "",
    chapter_count: chapters.length,
    summary_status: chapters.length > 0 ? "completed" : "missing",
    summary_cn: data.summary_cn || "",
    cover_image_url: data.chapters?.[0]?.image_url,
    created_at: "",
    updated_at: "",
    chapters,
  };
}

async function fetchStorySummaryFromMirror(
  eventId: number,
  assetbundleName: string,
  story?: IEventStory,
): Promise<IStoryAdminResponse | null> {
  try {
    const response = await fetch(getStoryDetailMirrorUrl(eventId));
    if (!response.ok) {
      console.warn(
        `[StorySummaryMirror] Failed to fetch event ${eventId}: HTTP ${response.status}`,
      );
      return null;
    }
    const data = (await response.json()) as IHubStoryDetailResponse;
    return normalizeMirrorStoryDetail(data, eventId, assetbundleName, story);
  } catch (error) {
    console.warn(
      `[StorySummaryMirror] Failed to fetch event ${eventId}:`,
      error,
    );
    return null;
  }
}

async function fetchOptionalBilibiliEvent(
  eventId: number,
): Promise<IBilibiliEvent | null> {
  try {
    const bilibiliData =
      await fetchBilibiliEventsData<IBilibiliEventsResponse>();
    return (
      bilibiliData.events.find(
        (event) => event.event_id === eventId && event.bilibili_url,
      ) ?? null
    );
  } catch (error) {
    console.warn(`[BilibiliEvents] Failed to fetch event ${eventId}:`, error);
    return null;
  }
}

function ChapterItem({
  chapter,
  eventId,
  assetBundleName,
  showImage,
  locale,
  translatedTitle,
}: {
  chapter: IStoryAdminChapter;
  eventId: number;
  assetBundleName: string;
  showImage: boolean;
  locale: UiLocale;
  translatedTitle?: string;
}) {
  const { assetSource } = useTheme();
  const { t } = useI18n();
  const imageUrl = getStoryEpisodeImageUrl(
    assetBundleName,
    chapter.chapter_no,
    assetSource,
  );
  const displayTitle = selectEventStoryLocalizedText(
    locale,
    chapter.title_jp,
    chapter.title_cn,
    translatedTitle,
  );
  const displaySummary = selectEventStoryLocalizedText(
    locale,
    undefined,
    chapter.summary_cn,
  );

  return (
    <Link
      href={`/story/event/${eventId}/${chapter.chapter_no}`}
      className="block mb-4 last:mb-0"
    >
      <div className="ios-glass-card ios-glass-card-interactive rounded-xl p-4 border-none group overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4">
          {showImage && (
            <div className="relative w-full sm:w-64 aspect-video sm:aspect-[16/9] rounded-lg overflow-hidden shrink-0 bg-slate-200/20 dark:bg-slate-700/20 self-center sm:self-start border border-white/10">
              <Image
                src={imageUrl}
                alt={`Episode ${chapter.chapter_no}`}
                fill
                className="object-contain transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-[2px] text-white text-[10px] px-1.5 py-0.5 rounded font-black">
                #{chapter.chapter_no}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 group-hover:text-miku transition-colors line-clamp-1">
                {displayTitle}
              </h3>
              <div className="sm:hidden text-slate-400 group-hover:text-miku transition-all group-hover:translate-x-1">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
            {displaySummary ? (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {displaySummary}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic mt-1">{t("page.story.event.noChapterSummary")}</p>
            )}
          </div>
          <div className="hidden sm:block text-slate-400 group-hover:text-miku transition-all group-hover:translate-x-1 self-center">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function StoryEventDetailClient() {
  const params = useParams();
  const { assetSource, serverSource, useLLMTranslation } = useTheme();
  const { locale, t } = useI18n();
  const { t: translateMasterText } = useTranslation();
  const eventId = Number(params.eventId);

  const [adminData, setAdminData] = useState<IStoryAdminResponse | null>(null);
  const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
  const [eventStory, setEventStory] = useState<IEventStory | null>(null);
  const [translationState, setTranslationState] = useState<{
    locale: UiLocale;
    translation: IEventStoryTranslation | null;
  } | null>(null);
  const [bilibiliEvent, setBilibiliEvent] = useState<IBilibiliEvent | null>(
    null,
  );
  const [fallbackChapters, setFallbackChapters] = useState<
    { chapter_no: number; title: string; scenarioId: string }[]
  >([]);
  const [showEpImages, _setShowEpImages] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore scroll position when navigating back from an episode reader page
  useSimpleScrollRestore(`story_event_detail_${eventId}`, !isLoading);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        setAdminData(null);
        setEventInfo(null);
        setEventStory(null);
        setTranslationState(null);
        setBilibiliEvent(null);
        setFallbackChapters([]);

        const bilibiliPromise = fetchOptionalBilibiliEvent(eventId);

        const [eventsData, storiesData, bEvent, storyTranslation] = await Promise.all([
          fetchMasterData<IEventInfo[]>("events.json"),
          fetchMasterData<IEventStory[]>("eventStories.json"),
          bilibiliPromise,
          loadEventStoryTranslation(eventId, locale),
        ]);

        if (cancelled) return;

        const event = eventsData.find((e) => e.id === eventId);
        if (!event) throw new Error(t("page.story.event.eventNotFound"));

        const story = storiesData.find((s) => s.eventId === eventId);
        const nextFallbackChapters = story
          ? story.eventStoryEpisodes.map((ep) => ({
              chapter_no: ep.episodeNo,
              title: ep.title,
              scenarioId: ep.scenarioId,
            }))
          : [];

        // Fetch story summary from mirror
        const summaryData = await fetchStorySummaryFromMirror(
          eventId,
          event.assetbundleName,
          story,
        );

        if (cancelled) return;

        setEventInfo(event);
        setEventStory(story ?? null);
        setTranslationState({ locale, translation: storyTranslation });
        setFallbackChapters(nextFallbackChapters);
        if (summaryData) setAdminData(summaryData);
        if (bEvent) setBilibiliEvent(bEvent);
        document.title = t("page.story.event.documentTitle", { name: event.name });
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
        setIsLoading(false);
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [eventId, locale, serverSource, t]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[50vh] w-full items-center justify-center">
          <div className="loading-spinner mr-2"></div>{t("common.state.loading")}
        </div>
      </MainLayout>
    );
  }

  if (error || !eventInfo) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              {t("page.events.notFoundTitle", { id: eventId })}
            </h2>
            <p className="text-slate-500 mb-6">
              {error || t("page.events.notFoundDesc")}
            </p>
            <Link
              href="/story/event"
              className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t("page.events.backToList")}
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const chapters = adminData?.chapters ?? [];
  const totalChapters = chapters.length || fallbackChapters.length;
  const storyTranslation = translationState?.locale === locale
    ? translationState.translation
    : null;
  const sourceTitle = adminData?.title_jp || eventInfo.name;
  const translatedEventTitle = translateMasterText("events", "name", eventInfo.name) ?? undefined;
  const displayTitle = selectEventStoryLocalizedText(
    locale,
    sourceTitle,
    adminData?.title_cn,
    translatedEventTitle,
  );
  const displaySummary = selectEventStoryLocalizedText(
    locale,
    undefined,
    adminData?.summary_cn,
  );
  const displayOutline = selectEventStoryLocalizedText(
    locale,
    adminData?.outline_jp || eventStory?.outline,
    adminData?.outline_cn,
  );
  const showSummaryCredit = locale === "zh-CN"
    && Boolean(adminData?.summary_cn || adminData?.outline_cn);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className="relative rounded-2xl overflow-hidden ios-glass-card mb-8 min-h-[200px] sm:min-h-[250px] flex items-center border-none">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-miku/10 to-purple-500/10 mix-blend-multiply z-10" />
            <Image
              src={getEventBannerUrl(eventInfo.assetbundleName, assetSource)}
              alt={eventInfo.name}
              fill
              className="object-cover opacity-50 blur-sm scale-105"
              unoptimized
            />
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-20" />
          </div>
          <div className="relative z-30 w-full p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <div className="relative w-48 sm:w-64 aspect-[2/1] drop-shadow-xl shrink-0 transition-transform hover:scale-105 duration-500">
              <Image
                src={getEventLogoUrl(eventInfo.assetbundleName, assetSource)}
                alt={eventInfo.name}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-2 drop-shadow-sm">
                {displayTitle}
              </h1>
              {sourceTitle && sourceTitle !== displayTitle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                  {sourceTitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Left: Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="ios-glass-card ios-glass-card-interactive rounded-2xl overflow-hidden border-none group">
              <Link href={`/events/${eventId}`} className="block">
                <div className="p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-miku/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="w-6 h-6 text-miku"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-miku transition-colors">
                      {t("page.story.event.eventDetailTitle")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {t("page.story.event.eventDetailDescription")}
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            </div>

            {bilibiliEvent && (
              <div className="ios-glass-card ios-glass-card-interactive rounded-2xl overflow-hidden border-none group">
                <ExternalLink
                  href={bilibiliEvent.bilibili_url!}
                  className="block"
                >
                  <div className="p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-[#fb7299]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <svg
                        className="w-6 h-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z"
                          fill="#FB7299"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-[#fb7299] transition-colors">
                        {t("page.story.event.bilibiliTranslationTitle")}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {t("page.story.event.bilibiliTranslationDescription")}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-300 group-hover:text-[#fb7299] transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>
                </ExternalLink>
              </div>
            )}

            <div className="ios-glass-card rounded-2xl p-6 border-none">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-miku"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {t("page.story.event.summaryTitle")}
              </h2>
              {displaySummary ? (
                <div className="prose prose-sm dark:prose-invert text-slate-600 dark:text-slate-400">
                  <p>{displaySummary}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic text-sm">{t("page.story.event.noEventSummary")}</p>
              )}
              {displayOutline && (
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {t("page.story.event.outlineTitle")}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {displayOutline}
                  </p>
                </div>
              )}
              {showSummaryCredit && (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 italic text-right">
                    {t("page.story.event.summaryCredit")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Chapters */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-miku"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                {t("page.story.event.chapterListTitle")}
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                  {t("page.story.event.chapterCount", { count: totalChapters })}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {chapters.length > 0 ? (
                chapters.map((chapter) => (
                  <ChapterItem
                    key={`admin-${chapter.chapter_no}`}
                    chapter={chapter}
                    eventId={eventId}
                    assetBundleName={eventInfo.assetbundleName}
                    showImage={showEpImages}
                    locale={locale}
                    translatedTitle={useLLMTranslation
                      ? getStoryTranslation(storyTranslation, chapter.chapter_no)?.title
                      : undefined}
                  />
                ))
              ) : fallbackChapters.length > 0 ? (
                fallbackChapters.map((chapter) => (
                  <ChapterItem
                    key={`fallback-${chapter.chapter_no}`}
                    chapter={{
                      id: 0,
                      event_id: eventId,
                      chapter_no: chapter.chapter_no,
                      scenario_id: chapter.scenarioId,
                      title_jp: chapter.title,
                      title_cn: "",
                      summary_cn: "",
                      asset_bundle_name: eventInfo.assetbundleName,
                      character_ids: "[]",
                      created_at: "",
                      updated_at: "",
                    }}
                    eventId={eventId}
                    assetBundleName={eventInfo.assetbundleName}
                    showImage={showEpImages}
                    locale={locale}
                    translatedTitle={useLLMTranslation
                      ? getStoryTranslation(storyTranslation, chapter.chapter_no)?.title
                      : undefined}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-slate-500 mb-2">{t("page.story.event.noChapters")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
