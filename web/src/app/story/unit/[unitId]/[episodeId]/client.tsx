"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { useStoryAsset } from "@/hooks/useStoryAsset";
import { fetchMasterData } from "@/lib/fetch";
import { IUnitProfile } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";

function getUnitOutlineLogoUrl(unitCode: string, server: "jp" | "cn"): string {
    return `https://sekai.best/images/${server}/logol_outline/logo_${unitCode}.png`;
}

interface IUnitStoryChapterEpisode {
    episodeNo: number;
    episodeNoLabel: string;
    title: string;
    scenarioId: string;
    unitStoryEpisodeGroupId: number;
}
interface IUnitStoryChapter { assetbundleName: string; episodes: IUnitStoryChapterEpisode[]; }
interface IUnitStory { id: number; seq: number; unit: string; chapters: IUnitStoryChapter[]; }

export default function StoryUnitReaderClient() {
    const params = useParams();
    const { serverSource } = useTheme();
    const unitId = Number(params.unitId);
    const episodeId = decodeURIComponent(params.episodeId as string);

    const [profile, setProfile] = useState<IUnitProfile | null>(null);
    const [allEpisodes, setAllEpisodes] = useState<IUnitStoryChapterEpisode[]>([]);
    const [assetbundleName, setAssetbundleName] = useState<string>("");
    const [masterLoading, setMasterLoading] = useState(true);

    useEffect(() => {
        if (!unitId || !episodeId) return;
        async function load() {
            setMasterLoading(true);
            try {
                const [profiles, stories] = await Promise.all([
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                    fetchMasterData<IUnitStory[]>("unitStories.json"),
                ]);
                const p = profiles.find(x => x.seq === unitId);
                if (!p) return;
                setProfile(p);
                const s = stories.find(x => x.seq === unitId);
                if (!s?.chapters[0]) return;
                setAllEpisodes(s.chapters[0].episodes);
                setAssetbundleName(s.chapters[0].assetbundleName);
                const ep = s.chapters[0].episodes.find(e => e.scenarioId === episodeId);
                if (ep) document.title = `${ep.title} - ${p.unitName} - Moesekai`;
            } finally {
                setMasterLoading(false);
            }
        }
        load();
    }, [unitId, episodeId, serverSource]);

    const currentEp = allEpisodes.find(e => e.scenarioId === episodeId);
    const currentIndex = allEpisodes.findIndex(e => e.scenarioId === episodeId);
    const prevEp = currentIndex > 0 ? allEpisodes[currentIndex - 1] : null;
    const nextEp = currentIndex >= 0 && currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null;

    const { scenarioData, isLoading, error, missingPaths } = useStoryAsset({
        type: "unit",
        params: assetbundleName ? { assetbundleName, scenarioId: episodeId } : null,
    });

    const logoUrl = profile ? getUnitOutlineLogoUrl(profile.unit, serverSource) : null;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href={`/story/unit/${unitId}`} className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回章节列表
                </Link>

                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        {logoUrl && <img src={logoUrl} alt="" className="w-16 h-8 object-contain hidden sm:block" />}
                        <div className="flex-1 min-w-0">
                            <p className="text-slate-500 text-sm">{profile?.unitName ?? `组合 ${unitId}`}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="font-bold text-slate-900 dark:text-slate-100">
                                    {currentEp && <span className="text-miku">{currentEp.episodeNoLabel} — </span>}
                                    {currentEp?.title ?? episodeId}
                                </h1>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    serverSource === "cn"
                                        ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50"
                                        : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50"
                                }`}>{serverSource === "cn" ? "国服" : "日服"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <StoryReader
                    scenarioData={scenarioData}
                    isLoading={isLoading || masterLoading}
                    error={error}
                    missingPaths={missingPaths ?? undefined}
                    endLabel={currentEp ? currentEp.episodeNoLabel : "本话"}
                />

                {!isLoading && !masterLoading && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 max-w-4xl mx-auto">
                        {prevEp ? (
                            <Link href={`/story/unit/${unitId}/${encodeURIComponent(prevEp.scenarioId)}`} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <div className="text-left"><div className="text-xs text-slate-400">上一话</div><div className="text-sm font-medium">{prevEp.title}</div></div>
                            </Link>
                        ) : <div />}
                        {nextEp ? (
                            <Link href={`/story/unit/${unitId}/${encodeURIComponent(nextEp.scenarioId)}`} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary-text hover:bg-miku/10 hover:text-miku transition-colors">
                                <div className="text-right"><div className="text-xs text-slate-400">下一话</div><div className="text-sm font-medium">{nextEp.title}</div></div>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </Link>
                        ) : <div />}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
