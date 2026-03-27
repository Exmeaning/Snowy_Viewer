"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData, fetchBilibiliEventsData } from "@/lib/fetch";
import { IEventInfo, IBilibiliEventsResponse, IBilibiliEvent } from "@/types/events";
import { IEventStory } from "@/types/story";
import { getEventLogoUrl, getEventBannerUrl, getStoryEpisodeImageUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { IStoryAdminResponse, IStoryAdminChapter } from "@/types/storyAdmin";
import ExternalLink from "@/components/ExternalLink";

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
    const { assetSource } = useTheme();
    const imageUrl = getStoryEpisodeImageUrl(assetBundleName, chapter.chapter_no, assetSource);

    return (
        <Link href={`/story/event/${eventId}/${chapter.chapter_no}`} className="block mb-4 last:mb-0">
            <div className="bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-sm rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all group overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4">
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
                            <div className="sm:hidden text-slate-400 group-hover:text-miku transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                        {chapter.summary_cn ? (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                {chapter.summary_cn}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400 italic mt-1">暂无章节总结</p>
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

export default function StoryEventDetailClient() {
    const params = useParams();
    const { assetSource, serverSource } = useTheme();
    const eventId = Number(params.eventId);

    const [adminData, setAdminData] = useState<IStoryAdminResponse | null>(null);
    const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
    const [bilibiliEvent, setBilibiliEvent] = useState<IBilibiliEvent | null>(null);
    const [fallbackChapters, setFallbackChapters] = useState<{ chapter_no: number; title: string; scenarioId: string }[]>([]);
    const [showEpImages, setShowEpImages] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;
        async function fetchData() {
            try {
                setIsLoading(true);
                const [eventsData, storiesData, adminRes, bilibiliData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                    fetch(`https://sekaistoryadmin.exmeaning.com/api/v1/events/${eventId}`, { cache: "no-store" }),
                    fetchBilibiliEventsData<IBilibiliEventsResponse>(),
                ]);

                const event = eventsData.find(e => e.id === eventId);
                if (!event) throw new Error("活动不存在");
                setEventInfo(event);

                const story = storiesData.find(s => s.eventId === eventId);
                if (story) {
                    setFallbackChapters(story.eventStoryEpisodes.map(ep => ({
                        chapter_no: ep.episodeNo,
                        title: ep.title,
                        scenarioId: ep.scenarioId,
                    })));
                }

                if (adminRes.ok) {
                    const data: IStoryAdminResponse = await adminRes.json();
                    setAdminData(data);
                }

                const bEvent = bilibiliData.events.find(e => e.event_id === eventId);
                if (bEvent && bEvent.bilibili_url) setBilibiliEvent(bEvent);

                document.title = `${event.name} - 活动剧情 - Moesekai`;
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [eventId, serverSource]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-[50vh] w-full items-center justify-center">
                    <div className="loading-spinner mr-2"></div>正在加载...
                </div>
            </MainLayout>
        );
    }

    if (error || !eventInfo) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16 text-center">
                    <h2 className="text-xl font-bold text-slate-700 mb-2">{error || "未找到活动"}</h2>
                    <Link href="/story/event" className="text-miku hover:underline">返回列表</Link>
                </div>
            </MainLayout>
        );
    }

    const chapters = adminData?.chapters ?? [];
    const totalChapters = chapters.length || fallbackChapters.length;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/event" className="inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回活动列表
                </Link>

                {/* Banner */}
                <div className="relative rounded-2xl overflow-hidden shadow-lg mb-8 bg-white dark:bg-slate-800 min-h-[200px] sm:min-h-[250px] flex items-center">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-miku/10 to-purple-500/10 mix-blend-multiply z-10" />
                        <Image src={getEventBannerUrl(eventInfo.assetbundleName, assetSource)} alt={eventInfo.name} fill className="object-cover opacity-50 blur-sm scale-105" unoptimized />
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-20" />
                    </div>
                    <div className="relative z-30 w-full p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                        <div className="relative w-48 sm:w-64 aspect-[2/1] drop-shadow-xl shrink-0 transition-transform hover:scale-105 duration-500">
                            <Image src={getEventLogoUrl(eventInfo.assetbundleName, assetSource)} alt={eventInfo.name} fill className="object-contain" unoptimized />
                        </div>
                        <div className="flex-1 text-center sm:text-left min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-2 drop-shadow-sm">
                                {adminData?.title_cn || eventInfo.name}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">{adminData?.title_jp}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Left: Summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700 group">
                            <Link href={`/events/${eventId}`} className="block">
                                <div className="p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="w-12 h-12 rounded-xl bg-miku/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        <svg className="w-6 h-6 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-miku transition-colors">活动详情</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">查看加成、歌曲及卡牌信息</p>
                                    </div>
                                    <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </Link>
                        </div>

                        {bilibiliEvent && (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700 group">
                                <ExternalLink href={bilibiliEvent.bilibili_url!} className="block">
                                    <div className="p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <div className="w-12 h-12 rounded-xl bg-[#fb7299]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z" fill="#FB7299" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-[#fb7299] transition-colors">资讯站汉化</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">前往 Bilibili 观看本活动剧情汉化</p>
                                        </div>
                                        <svg className="w-5 h-5 text-slate-300 group-hover:text-[#fb7299] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </div>
                                </ExternalLink>
                            </div>
                        )}

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
                            {adminData?.outline_cn && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">背景提要</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">{adminData.outline_cn}</p>
                                </div>
                            )}
                            {adminData && (
                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-400 italic text-right">
                                        剧情总结和章节翻译文本来源于moesekai，转载请表明出处。
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Chapters */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                章节列表
                            </h2>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowEpImages(!showEpImages)}
                                    className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    {showEpImages ? "隐藏图片" : "显示图片"}
                                </button>
                                <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
                                    共 {totalChapters} 话
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
                                    />
                                ))
                            ) : (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <p className="text-slate-500 mb-2">暂无章节信息</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
