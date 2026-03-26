"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { IEventInfo } from "@/types/events";
import { IEventStory } from "@/types/story";
import { getEventLogoUrl, getEventBannerUrl, getStoryEpisodeImageUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

export default function StoryEventDetailClient() {
    const params = useParams();
    const { assetSource, serverSource } = useTheme();
    const eventId = Number(params.eventId);

    const [eventInfo, setEventInfo] = useState<IEventInfo | null>(null);
    const [eventStory, setEventStory] = useState<IEventStory | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;
        async function fetchData() {
            try {
                setIsLoading(true);
                const [eventsData, storiesData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                ]);
                const event = eventsData.find(e => e.id === eventId);
                if (!event) throw new Error("活动不存在");
                setEventInfo(event);
                const story = storiesData.find(s => s.eventId === eventId);
                if (story) setEventStory(story);
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
                    <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin" />
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

    const episodes = eventStory?.eventStoryEpisodes ?? [];
    const outline = eventStory?.outline;

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
                <div className="relative rounded-2xl overflow-hidden shadow-lg mb-6 bg-white dark:bg-slate-800 min-h-[180px] flex items-center">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-miku/10 to-purple-500/10 mix-blend-multiply z-10" />
                        <Image src={getEventBannerUrl(eventInfo.assetbundleName, assetSource)} alt={eventInfo.name} fill className="object-cover opacity-50 blur-sm scale-105" unoptimized />
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-20" />
                    </div>
                    <div className="relative z-30 w-full p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative w-40 sm:w-56 aspect-[2/1] drop-shadow-xl shrink-0">
                            <Image src={getEventLogoUrl(eventInfo.assetbundleName, assetSource)} alt={eventInfo.name} fill className="object-contain" unoptimized />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{eventInfo.name}</h1>
                        </div>
                    </div>
                </div>

                {/* Outline */}
                {outline && (
                    <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {outline}
                    </div>
                )}

                {/* Episode grid */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">章节列表</h2>
                    <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">共 {episodes.length} 话</span>
                </div>

                {episodes.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">暂无章节信息</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {episodes.map((ep) => (
                            <Link
                                key={ep.episodeNo}
                                href={`/story/event/${eventId}/${ep.episodeNo}`}
                                className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all overflow-hidden"
                            >
                                <div className="p-2.5 pb-0">
                                    <div className="relative aspect-video bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                                        <Image
                                            src={getStoryEpisodeImageUrl(eventInfo.assetbundleName, ep.episodeNo, assetSource)}
                                            alt={ep.title}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                <div className="p-2.5 pt-2">
                                    <span className="text-[11px] text-miku font-medium">第 {ep.episodeNo} 话</span>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-miku transition-colors mt-0.5 line-clamp-2 leading-tight">
                                        {ep.title}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
