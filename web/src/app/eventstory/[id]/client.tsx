"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { IEventInfo } from "@/types/events";
import { IEventStory } from "@/types/story";
import { getEventLogoUrl, getEventBannerUrl, getStoryEpisodeImageUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { IStoryAdminResponse, IStoryAdminEvent, IStoryAdminChapter } from "@/types/storyAdmin";

function ChapterItem({
    chapter,
    eventId,
    assetBundleName,
    showImage
}: {
    chapter: IStoryAdminChapter;
    eventId: number;
    assetBundleName: string;
    showImage: boolean;
}) {
    // Generate image URL
    // Note: fallback chapters might handle assetBundleName differently if not provided, 
    // but we pass it from parent which has event info.
    const imageUrl = getStoryEpisodeImageUrl(assetBundleName, chapter.chapter_no);

    return (
        <Link
            href={`/eventstory/${eventId}/${chapter.chapter_no}`}
            className="block mb-4 last:mb-0"
        >
            <div className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all group overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Episode Image - Responsive behavior */}
                    {showImage && (
                        <div className="relative w-full sm:w-64 aspect-video sm:aspect-[16/9] rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700 self-center sm:self-start">
                            <Image
                                src={imageUrl}
                                alt={`Episode ${chapter.chapter_no}`}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                            <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-[2px] text-white text-[10px] px-1.5 py-0.5 rounded">
                                #{chapter.chapter_no}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 group-hover:text-miku transition-colors line-clamp-1">
                                {chapter.title_cn || chapter.title_jp}
                            </h3>
                            {/* Mobile arrow indicator */}
                            <div className="sm:hidden text-slate-400 group-hover:text-miku transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>

                        {chapter.summary_cn ? (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3 sm:line-clamp-none">
                                {chapter.summary_cn}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400 italic mt-1">
                                暂无章节总结
                            </p>
                        )}
                    </div>

                    <div className="hidden sm:block text-slate-400 group-hover:text-miku transition-colors self-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default function EventStorySummaryClient() {
    const params = useParams();
    const router = useRouter();
    const { assetSource } = useTheme();
    const eventId = Number(params.id);

    const [adminData, setAdminData] = useState<IStoryAdminResponse | null>(null);
    const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
    const [fallbackChapters, setFallbackChapters] = useState<{ chapter_no: number; title: string, scenarioId: string }[]>([]);
    const [showEpImages, setShowEpImages] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                // Fetch Master Data for Assets and Admin Data for Content
                const [eventsData, storiesData, adminRes] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                    fetch(`https://sekaistoryadmin.exmeaning.com/api/v1/events/${eventId}`)
                ]);

                const event = eventsData.find(e => e.id === eventId);
                if (!event) {
                    throw new Error("Local Event Info not found");
                }
                setEventInfo(event);

                // Prepare fallback chapters from master data
                const story = storiesData.find(s => s.eventId === eventId);
                if (story) {
                    setFallbackChapters(story.eventStoryEpisodes.map(ep => ({
                        chapter_no: ep.episodeNo,
                        title: ep.title,
                        scenarioId: ep.scenarioId
                    })));
                }

                if (adminRes.ok) {
                    const data: IStoryAdminResponse = await adminRes.json();
                    setAdminData(data);
                } else {
                    console.warn("Failed to fetch admin data, status:", adminRes.status);
                    // Admin fetch failed, we will use fallbackChapters
                }

                document.title = `${event.name} - 剧情总览 - Snowy SekaiViewer`;
            } catch (err) {
                console.error("Error fetching story data:", err);
                setError("无法加载剧情数据");
            } finally {
                setIsLoading(false);
            }
        }

        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    if (isLoading) {
        return (
            <MainLayout activeNav="活动剧情">
                <div className="flex h-[50vh] w-full items-center justify-center text-slate-500">
                    <div className="loading-spinner mr-2"></div>
                    正在加载剧情档案...
                </div>
            </MainLayout>
        );
    }

    if (!eventInfo) {
        return (
            <MainLayout activeNav="活动剧情">
                <div className="container mx-auto px-4 py-16 text-center">
                    <h2 className="text-xl font-bold text-slate-700 mb-2">未找到活动</h2>
                    <Link href="/eventstory" className="text-miku hover:underline">返回列表</Link>
                </div>
            </MainLayout>
        );
    }

    // Fallback if admin data is missing (e.g. not added to DB yet)
    // We should probably show a message or redirect to old list?
    // User requirement: "点击/eventstory/:ID 先进入这个包含活动总览+活动总结的页面"
    // If no admin data, we might show "Summary not available" but still list episodes if we had them from master data.
    // But I strictly followed the new requirement to use this API.
    // I'll show what I have.

    return (
        <MainLayout activeNav="活动剧情">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Back Link */}
                <Link
                    href="/eventstory"
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回活动列表
                </Link>

                {/* Banner Header */}
                <div className="relative rounded-2xl overflow-hidden shadow-lg mb-8 bg-white dark:bg-slate-800">
                    {/* Background Banner */}
                    <div className="relative aspect-[21/9] sm:aspect-[32/9] w-full">
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

                    {/* Content Overlay */}
                    <div className="absolute inset-0 z-30 p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                        {/* Logo */}
                        <div className="relative w-48 sm:w-64 aspect-[2/1] drop-shadow-xl shrink-0 transition-transform hover:scale-105 duration-500">
                            <Image
                                src={getEventLogoUrl(eventInfo.assetbundleName, assetSource)}
                                alt={eventInfo.name}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>

                        {/* Title Text */}
                        <div className="flex-1 text-center sm:text-left min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-2 drop-shadow-sm">
                                {adminData?.title_cn || eventInfo.name}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                                {adminData?.title_jp}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Left Column: Summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                活动概要
                            </h2>
                            {adminData?.summary_cn ? (
                                <div className="prose prose-sm dark:prose-invert text-slate-600 dark:text-slate-400">
                                    <p>{adminData.summary_cn}</p>
                                </div>
                            ) : (
                                <p className="text-slate-400 italic text-sm">暂无活动总结</p>
                            )}

                            {/* Outline if available */}
                            {adminData?.outline_cn && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        背景提要
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {adminData.outline_cn}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Chapters */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                章节列表
                            </h2>
                            <div className="flex items-center gap-4">
                                {/* Toggle Images Button (Visible mostly on mobile but useful everywhere) */}
                                <button
                                    onClick={() => setShowEpImages(!showEpImages)}
                                    className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    {showEpImages ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">隐藏图片</span>
                                            <span className="sm:hidden">无图</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">显示图片</span>
                                            <span className="sm:hidden">有图</span>
                                        </>
                                    )}
                                </button>
                                <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                                    共 {adminData?.chapters?.length || fallbackChapters.length || 0} 话
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Render Admin Chapters if available */}
                            {adminData?.chapters?.length ? (
                                adminData.chapters.map((chapter) => (
                                    <ChapterItem
                                        key={`admin-${chapter.chapter_no}`}
                                        chapter={chapter}
                                        eventId={eventId}
                                        assetBundleName={eventInfo.assetbundleName}
                                        showImage={showEpImages}
                                    />
                                ))
                            ) : fallbackChapters.length > 0 ? (
                                /* Render Fallback Chapters if Admin Chapters missing */
                                fallbackChapters.map((chapter) => (
                                    <ChapterItem
                                        key={`fallback-${chapter.chapter_no}`}
                                        chapter={{
                                            id: 0, // Dummy ID
                                            event_id: eventId,
                                            chapter_no: chapter.chapter_no,
                                            scenario_id: chapter.scenarioId,
                                            title_jp: chapter.title,
                                            title_cn: "", // Master data only has JP title usually (or whatever is in title field)
                                            summary_cn: "",
                                            asset_bundle_name: eventInfo.assetbundleName,
                                            character_ids: "[]",
                                            created_at: "",
                                            updated_at: ""
                                        }}
                                        eventId={eventId}
                                        assetBundleName={eventInfo.assetbundleName}
                                        showImage={showEpImages}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <p className="text-slate-500 mb-2">暂无章节信息</p>
                                    <p className="text-xs text-slate-400">正在从资料库加载中...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
