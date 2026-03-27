"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { isCnSource, ASSET_BASE_URL_SNOWY, ASSET_BASE_URL_SNOWY_CN } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { IUnitProfile } from "@/types/types";

function getUnitOutlineLogoUrl(unitCode: string, server: "jp" | "cn"): string {
    return `https://sekai.best/images/${server}/logol_outline/logo_${unitCode}.png`;
}

function getUnitEpisodeImageUrl(chapterAssetbundleName: string, episodeAssetbundleName: string, assetSource: import("@/contexts/ThemeContext").AssetSourceType): string {
    const base = isCnSource(assetSource) ? ASSET_BASE_URL_SNOWY_CN : ASSET_BASE_URL_SNOWY;
    return `${base}/startapp/story/episode_image/${chapterAssetbundleName}/${episodeAssetbundleName}.png`;
}

interface IUnitStoryEpisodeGroup {
    id: number;
    unit: string;
    seq: number;
    name: string;
    outline: string;
    assetbundleName: string;
}
interface IUnitStoryChapterEpisode {
    episodeNo: number;
    episodeNoLabel: string;
    title: string;
    assetbundleName: string;
    scenarioId: string;
    unitStoryEpisodeGroupId: number;
    releaseConditionId: number;
}
interface IUnitStoryChapter {
    assetbundleName: string;
    episodes: IUnitStoryChapterEpisode[];
}
interface IUnitStory {
    id: number;
    seq: number;
    unit: string;
    chapters: IUnitStoryChapter[];
}

export default function StoryUnitDetailClient() {
    const params = useParams();
    const { serverSource, assetSource } = useTheme();
    const unitId = Number(params.unitId);

    const [profile, setProfile] = useState<IUnitProfile | null>(null);
    const [story, setStory] = useState<IUnitStory | null>(null);
    const [episodeGroups, setEpisodeGroups] = useState<IUnitStoryEpisodeGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!unitId) return;
        async function load() {
            try {
                const [profiles, stories, groups] = await Promise.all([
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                    fetchMasterData<IUnitStory[]>("unitStories.json"),
                    fetchMasterData<IUnitStoryEpisodeGroup[]>("unitStoryEpisodeGroups.json"),
                ]);
                const p = profiles.find(x => x.seq === unitId);
                if (!p) throw new Error("组合不存在");
                const s = stories.find(x => x.seq === unitId);
                if (!s) throw new Error("剧情数据不存在");
                setProfile(p);
                setStory(s);
                setEpisodeGroups(groups.filter(g => g.unit === p.unit));
                document.title = `${p.unitName} - 主线剧情 - Moesekai`;
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [unitId, serverSource]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-[50vh] items-center justify-center">
                    <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                </div>
            </MainLayout>
        );
    }

    if (error || !profile || !story) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16 text-center">
                    <p className="text-red-500 mb-4">{error ?? "未找到数据"}</p>
                    <Link href="/story/unit" className="text-miku hover:underline">返回列表</Link>
                </div>
            </MainLayout>
        );
    }

    const episodes = story.chapters[0]?.episodes ?? [];
    const chapterAssetbundleName = story.chapters[0]?.assetbundleName ?? "";
    const logoUrl = getUnitOutlineLogoUrl(profile.unit, serverSource);

    // Group episodes by unitStoryEpisodeGroupId
    const groupMap = new Map<number, IUnitStoryEpisodeGroup>();
    episodeGroups.forEach(g => groupMap.set(g.id, g));

    // Build display groups: each unique episodeGroupId → episodes
    const displayGroups: { group: IUnitStoryEpisodeGroup | null; episodes: IUnitStoryChapterEpisode[] }[] = [];
    const seenGroups = new Set<number>();
    for (const ep of episodes) {
        const gid = ep.unitStoryEpisodeGroupId;
        if (!seenGroups.has(gid)) {
            seenGroups.add(gid);
            displayGroups.push({ group: groupMap.get(gid) ?? null, episodes: [] });
        }
        displayGroups[displayGroups.length - 1].episodes.push(ep);
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/unit" className="inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回主线列表
                </Link>

                {/* Header */}
                <div className="flex items-center gap-5 mb-8 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <img src={logoUrl} alt={profile.unitName} className="w-24 h-12 object-contain shrink-0" />
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white">{profile.unitName}</h1>
                        <p className="text-sm text-slate-500 mt-1">共 {episodes.length} 话</p>
                    </div>
                </div>

                {/* Episode groups */}
                <div className="space-y-6">
                    {displayGroups.map(({ group, episodes: eps }, gi) => (
                        <div key={gi}>
                            {group && (
                                <div className="mb-3">
                                    <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">{group.name}</h2>
                                    {group.outline && (
                                        <div className="mt-2 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {group.outline}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {eps.map(ep => (
                                    <Link
                                        key={ep.scenarioId}
                                        href={`/story/unit/${unitId}/${encodeURIComponent(ep.scenarioId)}`}
                                        className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all overflow-hidden"
                                    >
                                        <div className="p-2.5 pb-0">
                                            <div className="relative aspect-video bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                                                <img
                                                    src={getUnitEpisodeImageUrl(chapterAssetbundleName, ep.assetbundleName, assetSource)}
                                                    alt={ep.title}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-2.5 pt-2">
                                            <span className="text-[11px] text-miku font-medium">{ep.episodeNoLabel}</span>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-miku transition-colors mt-0.5 line-clamp-2 leading-tight">
                                                {ep.title}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
