"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getUnitStoryEpisodeImageUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { IUnitProfile } from "@/types/types";
import { useI18n } from "@/contexts/I18nContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";

function getUnitOutlineLogoUrl(unitCode: string, server: string): string {
    const s = server === "cn" ? "cn" : "jp";
    return `/images/unit-logos/logo_${unitCode}_${s}.png`;
}

function getUnitEpisodeImageUrl(chapterAssetbundleName: string, episodeAssetbundleName: string, assetSource: import("@/contexts/ThemeContext").AssetSourceType): string {
    return getUnitStoryEpisodeImageUrl(chapterAssetbundleName, episodeAssetbundleName, assetSource);
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
    const { t } = useI18n();
    const unitId = Number(params.unitId);

    const [profile, setProfile] = useState<IUnitProfile | null>(null);
    const [story, setStory] = useState<IUnitStory | null>(null);
    const [episodeGroups, setEpisodeGroups] = useState<IUnitStoryEpisodeGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Restore scroll position when navigating back from an episode reader page
    useSimpleScrollRestore(`story_unit_detail_${unitId}`, !isLoading);

    // Locked episodes state and unlock haptics/animations
    const [unlockedStories, setUnlockedStories] = useState<Record<string, boolean>>({});
    const [unlockingId, setUnlockingId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("moesekai_unlocked_stories");
            if (saved) {
                try {
                    setUnlockedStories(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse unlocked stories cache:", e);
                }
            }
        }
    }, []);

    const triggerUnlockEffect = (scenarioId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setUnlockingId(scenarioId);
        
        // Haptic feedback if supported
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([80, 50, 100]);
        }
        
        setTimeout(() => {
            const newUnlocked = { ...unlockedStories, [scenarioId]: true };
            setUnlockedStories(newUnlocked);
            localStorage.setItem("moesekai_unlocked_stories", JSON.stringify(newUnlocked));
            setUnlockingId(null);
        }, 850);
    };

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
                if (!p) throw new Error(t("page.story.unit.unitNotFound"));
                const s = stories.find(x => x.seq === unitId);
                if (!s) throw new Error(t("page.story.unit.storyDataNotFound"));
                setProfile(p);
                setStory(s);
                setEpisodeGroups(groups.filter(g => g.unit === p.unit));
                document.title = t("page.story.unit.documentTitle", { name: p.unitName });
            } catch (err) {
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [unitId, serverSource, t]);

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
                    <p className="text-red-500 mb-4">{error ?? t("common.state.noData")}</p>
                    <Link href="/story/unit" className="text-miku hover:underline">{t("page.story.unit.backToList")}</Link>
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
                <Link 
                    href="/story/unit" 
                    className="ios-glass-btn border-none hover:bg-miku/10 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.unit.backToUnitList")}
                </Link>

                <div className="flex items-center gap-5 mb-8 p-5 ios-glass-card border-none rounded-2xl">
                    <div className="w-24 h-12 flex items-center justify-center bg-white/10 dark:bg-black/10 p-1.5 rounded-xl">
                        <img src={logoUrl} alt={profile.unitName} className="max-w-full max-h-full object-contain shrink-0" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{profile.unitName}</h1>
                        <p className="text-sm text-slate-500 mt-1">{t("page.story.unit.episodeCount", { count: episodes.length })}</p>
                    </div>
                </div>

                <div className="space-y-10 relative">
                    {/* Vertical story tree backbone connector (Tree Timeline Line) */}
                    <div className="absolute left-6 top-4 bottom-4 w-[2px] bg-gradient-to-b from-miku/30 via-purple-500/25 to-slate-200/10 dark:to-slate-800/10 pointer-events-none hidden md:block" />

                    {displayGroups.map(({ group, episodes: eps }, gi) => (
                        <div key={gi} className="relative md:pl-12">
                            {/* Chapter Node Marker */}
                            <div className="absolute left-4 top-2.5 w-4 h-4 rounded-full border-4 border-miku bg-slate-900 shadow-md hidden md:block z-10" />

                            {group && (
                                <div className="mb-5">
                                    <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-miku inline-block md:hidden" />
                                        {group.name}
                                    </h2>
                                    {group.outline && (
                                        <div className="mt-2.5 p-4 ios-glass-panel border-none rounded-xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed shadow-sm">
                                            {group.outline}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {eps.map(ep => {
                                    const isLocked = ep.releaseConditionId > 1 && !unlockedStories[ep.scenarioId];
                                    const isUnlocking = unlockingId === ep.scenarioId;
                                    
                                    const CardContent = (
                                        <div className="relative h-full flex flex-col">
                                            {/* Locked Shield Overlay */}
                                            {isLocked && (
                                                <div 
                                                    onClick={(e) => triggerUnlockEffect(ep.scenarioId, e)}
                                                    className="absolute inset-0 bg-slate-950/70 backdrop-blur-[10px] z-20 flex flex-col items-center justify-center p-3 text-center transition-all duration-300 hover:bg-slate-950/60 cursor-pointer group/lock overflow-hidden"
                                                >
                                                    {/* Ice shatter animation layer */}
                                                    {isUnlocking && (
                                                        <div className="absolute inset-0 bg-white dark:bg-slate-900 z-30 flex flex-col items-center justify-center animate-pulse">
                                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-miku via-purple-600 to-transparent scale-150 animate-spin" />
                                                            <svg className="w-12 h-12 text-miku animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                            </svg>
                                                            <span className="text-[11px] text-miku font-black tracking-widest uppercase mt-2 animate-pulse">{t("page.story.reader.unlocking")}</span>
                                                        </div>
                                                    )}

                                                    <div className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center shadow-lg transition-all group-hover/lock:scale-110 group-hover/lock:border-amber-400 group-hover/lock:shadow-amber-500/20 duration-300">
                                                        <svg className="w-5 h-5 text-amber-400 group-hover/lock:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">{t("page.story.reader.lockedEpisode")}</span>
                                                    <span className="text-[9px] text-amber-400/90 mt-1 opacity-0 group-hover/lock:opacity-100 transition-opacity duration-300">{t("page.story.reader.clickToUnlock")}</span>
                                                </div>
                                            )}

                                            <div className="p-2.5 pb-0">
                                                <div className="relative aspect-video bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                                                    <img
                                                        src={getUnitEpisodeImageUrl(chapterAssetbundleName, ep.assetbundleName, assetSource)}
                                                        alt={ep.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                    
                                                    {/* Story Tree Connection Node Indicator */}
                                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-slate-900/60 backdrop-blur-sm border border-white/20 text-[9px] font-black flex items-center justify-center text-white">
                                                        {ep.episodeNo}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-2.5 pt-2 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <span className="text-[10px] text-miku font-semibold tracking-wider">{ep.episodeNoLabel}</span>
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-100 group-hover:text-miku transition-colors mt-0.5 line-clamp-2 leading-snug">
                                                        {ep.title}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );

                                    return isLocked ? (
                                        <div
                                            key={ep.scenarioId}
                                            className="ios-glass-card relative overflow-hidden rounded-xl border-none h-full"
                                        >
                                            {CardContent}
                                        </div>
                                    ) : (
                                        <Link
                                            key={ep.scenarioId}
                                            href={`/story/unit/${unitId}/${encodeURIComponent(ep.scenarioId)}`}
                                            className="ios-glass-card ios-glass-card-interactive group relative overflow-hidden rounded-xl border-none h-full"
                                        >
                                            {CardContent}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
