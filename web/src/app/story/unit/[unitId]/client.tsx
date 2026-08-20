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
                    <div className="loading-spinner"></div>
                </div>
            </MainLayout>
        );
    }

    if (error || !profile || !story) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16 text-center">
                    <p className="hh-body text-red-500 mb-4">{error ?? t("common.state.noData")}</p>
                    <Link href="/story/unit" className="text-[var(--hh-accent)] hover:underline">{t("page.story.unit.backToList")}</Link>
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
                    className="hh-btn hh-press px-4 py-2 mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.unit.backToUnitList")}
                </Link>

                <div className="hh-panel flex items-center gap-5 mb-8 p-5">
                    <div className="w-24 h-12 flex items-center justify-center bg-[var(--hh-surface-sunken)] p-1.5 rounded-[var(--hh-radius-md)]">
                        <img src={logoUrl} alt={profile.unitName} className="max-w-full max-h-full object-contain shrink-0" />
                    </div>
                    <div>
                        <h1 className="hh-display text-2xl text-[var(--hh-text-primary)]">{profile.unitName}</h1>
                        <p className="hh-body text-sm text-[var(--hh-text-secondary)] mt-1">{t("page.story.unit.episodeCount", { count: episodes.length })}</p>
                    </div>
                </div>

                <div className="space-y-10 relative">
                    {/* Vertical story tree backbone connector (Tree Timeline Line) */}
                    <div className="absolute left-6 top-4 bottom-4 w-[2px] bg-[var(--hh-border)] pointer-events-none hidden md:block" />

                    {displayGroups.map(({ group, episodes: eps }, gi) => (
                        <div key={gi} className="relative md:pl-12">
                            {/* Chapter Node Marker */}
                            <div className="absolute left-4 top-2.5 w-4 h-4 rounded-[var(--hh-radius-full)] border-[3px] border-[var(--hh-accent)] bg-[var(--hh-surface-2)] hidden md:block z-10" />

                            {group && (
                                <div className="mb-5">
                                    <h2 className="hh-title text-base text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)] inline-block md:hidden" />
                                        {group.name}
                                    </h2>
                                    {group.outline && (
                                        <div className="hh-well hh-body mt-2.5 p-4 text-sm text-[var(--hh-text-secondary)]">
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
                                            {/* Locked spoiler shield. The blur is
                                                functional, not decorative: it is
                                                what actually obscures the episode
                                                thumbnail underneath, so this node
                                                opts out of the global
                                                backdrop-filter flattening via
                                                .hh-allow-blur. Flattening it would
                                                leak the artwork it exists to hide. */}
                                            {isLocked && (
                                                <div
                                                    onClick={(e) => triggerUnlockEffect(ep.scenarioId, e)}
                                                    className="hh-allow-blur absolute inset-0 bg-[#12131a]/75 backdrop-blur-[10px] z-20 flex flex-col items-center justify-center p-3 text-center transition-colors duration-300 hover:bg-[#12131a]/65 cursor-pointer group/lock overflow-hidden"
                                                >
                                                    {/* Unlock flash: covers the shield while the reveal plays. */}
                                                    {isUnlocking && (
                                                        <div className="absolute inset-0 bg-[var(--hh-surface-2)] z-30 flex flex-col items-center justify-center">
                                                            <svg className="w-12 h-12 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                            </svg>
                                                            <span className="hh-label mt-2 text-[var(--hh-accent)]">{t("page.story.reader.unlocking")}</span>
                                                        </div>
                                                    )}

                                                    {/* Ink is hardcoded here because the shield is always a
                                                        dark scrim over artwork, in either theme. */}
                                                    <div className="w-11 h-11 rounded-[var(--hh-radius-full)] bg-black/50 border border-white/25 flex items-center justify-center transition-colors duration-300 group-hover/lock:border-amber-400">
                                                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                        </svg>
                                                    </div>
                                                    <span className="hh-label mt-2 !text-white/70">{t("page.story.reader.lockedEpisode")}</span>
                                                    <span className="text-[9px] text-amber-400/90 mt-1 opacity-0 group-hover/lock:opacity-100 transition-opacity duration-300">{t("page.story.reader.clickToUnlock")}</span>
                                                </div>
                                            )}

                                            <div className="p-2.5 pb-0">
                                                <div className="relative aspect-video bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] overflow-hidden">
                                                    <img
                                                        src={getUnitEpisodeImageUrl(chapterAssetbundleName, ep.assetbundleName, assetSource)}
                                                        alt={ep.title}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />

                                                    {/* Episode number badge. Opaque ink so the
                                                        digit stays legible over any thumbnail. */}
                                                    <div className="hh-numeric absolute top-1.5 left-1.5 w-5 h-5 rounded-[var(--hh-radius-sm)] bg-black/70 text-[9px] font-bold flex items-center justify-center text-white">
                                                        {ep.episodeNo}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-2.5 pt-2 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <span className="hh-numeric text-[10px] text-[var(--hh-accent)] font-semibold tracking-wider">{ep.episodeNoLabel}</span>
                                                    <p className="hh-title text-sm text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent)] transition-colors mt-0.5 line-clamp-2">
                                                        {ep.title}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );

                                    return isLocked ? (
                                        <div
                                            key={ep.scenarioId}
                                            className="hh-tile relative overflow-hidden h-full"
                                        >
                                            {CardContent}
                                        </div>
                                    ) : (
                                        <Link
                                            key={ep.scenarioId}
                                            href={`/story/unit/${unitId}/${encodeURIComponent(ep.scenarioId)}`}
                                            className="hh-tile hh-press group relative overflow-hidden h-full hover:border-[var(--hh-accent-line)]"
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
