"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { useStoryAsset } from "@/hooks/useStoryAsset";
import { fetchMasterData } from "@/lib/fetch";
import { IUnitProfile } from "@/types/types";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";

function getUnitOutlineLogoUrl(unitCode: string, server: string): string {
    const s = server === "cn" ? "cn" : "jp";
    return `/images/unit-logos/logo_${unitCode}_${s}.png`;
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
    const { t } = useI18n();
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
        fallbackErrorMessage: t("common.state.loadingFailed"),
    });

    const logoUrl = profile ? getUnitOutlineLogoUrl(profile.unit, serverSource) : null;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link 
                    href={`/story/unit/${unitId}`} 
                    className="hh-btn hh-press hh-focusable px-4 py-2 inline-flex items-center gap-2 text-[var(--hh-text-secondary)] hover:text-miku mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.unit.backToChapters")}
                </Link>

                <div className="hh-tile p-4 mb-6">
                    <div className="flex items-center gap-3">
                        {logoUrl && <img src={logoUrl} alt="" className="w-16 h-8 object-contain hidden sm:block bg-[var(--hh-surface-sunken)] p-1 rounded-[var(--hh-radius-xs)]" />}
                        <div className="flex-1 min-w-0">
                            <p className="hh-label">{profile?.unitName ?? t("page.story.unit.fallbackUnitName", { id: unitId })}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <h1 className="hh-title text-[var(--hh-text-primary)] text-base sm:text-lg">
                                    {currentEp && <span className="hh-numeric text-miku">{currentEp.episodeNoLabel} — </span>}
                                    {currentEp?.title ?? episodeId}
                                </h1>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] border ${
                                    serverSource === "cn"
                                        ? "bg-rose-500/12 text-rose-600 border-rose-500/30"
                                        : "bg-blue-500/12 text-blue-600 border-blue-500/30"
                                }`}>{t(`page.story.serverSource.${serverSource}`)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <StoryReader
                    scenarioData={scenarioData}
                    isLoading={isLoading || masterLoading}
                    error={error}
                    missingPaths={missingPaths ?? undefined}
                    endLabel={currentEp ? currentEp.episodeNoLabel : t("page.story.unit.currentEpisode")}
                />

                {!isLoading && !masterLoading && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-[var(--hh-border)] max-w-4xl mx-auto gap-4">
                        {prevEp ? (
                            <Link 
                                href={`/story/unit/${unitId}/${encodeURIComponent(prevEp.scenarioId)}`} 
                                className="hh-tile hh-press flex items-center gap-2.5 px-4 py-2.5 text-primary-text hover:text-miku hover:border-[var(--hh-accent)] max-w-[45%]"
                            >
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                <div className="text-left min-w-0">
                                    <div className="hh-label">{t("page.story.navigation.previousEpisode")}</div>
                                    <div className="hh-title text-xs truncate">{prevEp.title}</div>
                                </div>
                            </Link>
                        ) : <div />}
                        {nextEp ? (
                            <Link 
                                href={`/story/unit/${unitId}/${encodeURIComponent(nextEp.scenarioId)}`} 
                                className="hh-tile hh-press flex items-center gap-2.5 px-4 py-2.5 text-primary-text hover:text-miku hover:border-[var(--hh-accent)] max-w-[45%] text-right justify-end"
                            >
                                <div className="text-right min-w-0">
                                    <div className="hh-label">{t("page.story.navigation.nextEpisode")}</div>
                                    <div className="hh-title text-xs truncate">{nextEp.title}</div>
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
