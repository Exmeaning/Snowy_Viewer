"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { StoryReader } from "@/components/story/StoryReader";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { IGameChara, ICharaProfile } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchStoryAssetFromMirror, StoryAssetMissingError } from "@/lib/storyAsset";
import { processScenarioForDisplay } from "@/lib/storyLoader";
import { IProcessedScenarioData } from "@/types/story";

export default function StorySelfReaderClient() {
    const params = useParams();
    const { serverSource, assetSource } = useTheme();
    const charaId = Number(params.charaId);
    const lang: "jp" | "cn" = serverSource === "cn" ? "cn" : "jp";

    const [chara, setChara] = useState<IGameChara | null>(null);
    const [year1, setYear1] = useState<IProcessedScenarioData | null>(null);
    const [year2, setYear2] = useState<IProcessedScenarioData | null>(null);
    const [missing1, setMissing1] = useState<string[] | null>(null);
    const [missing2, setMissing2] = useState<string[] | null>(null);
    const [error1, setError1] = useState<string | null>(null);
    const [error2, setError2] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!charaId) return;
        async function load() {
            setIsLoading(true);
            try {
                const [charasData, profilesData] = await Promise.all([
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterData<ICharaProfile[]>("characterProfiles.json"),
                ]);
                const c = charasData.find(x => x.id === charaId);
                if (!c) return;
                setChara(c);

                const profile = profilesData.find(p => p.characterId === charaId);
                if (!profile?.scenarioId) return;

                const scenarioId2 = profile.scenarioId;
                const scenarioId1 = scenarioId2.substring(0, scenarioId2.lastIndexOf("_"));

                const loadPart = async (scenarioId: string, setData: typeof setYear1, setMissing: typeof setMissing1, setErr: typeof setError1) => {
                    try {
                        const raw = await fetchStoryAssetFromMirror("self", lang, { scenarioId });
                        setData(await processScenarioForDisplay(raw, "scenario", assetSource));
                    } catch (err) {
                        if (err instanceof StoryAssetMissingError) setMissing(err.missingPaths);
                        else setErr(err instanceof Error ? err.message : "加载失败");
                    }
                };

                const charaName = `${c.firstName ?? ""}${c.givenName}`;
                document.title = `${charaName} - 自我介绍 - Moesekai`;

                await Promise.all([
                    loadPart(scenarioId1, setYear1, setMissing1, setError1),
                    loadPart(scenarioId2, setYear2, setMissing2, setError2),
                ]);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [charaId, lang]);

    const charaName = chara ? `${chara.firstName ?? ""}${chara.givenName}` : `角色 ${charaId}`;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/self" className="inline-flex items-center gap-2 text-miku hover:text-miku-dark transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回角色列表
                </Link>

                <div className="flex items-center gap-4 mb-8 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {chara && <img src={getCharacterIconUrl(chara.id)} alt={charaName} className="w-16 h-16 rounded-full object-cover border-2 border-miku/30 shrink-0" />}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">{charaName}</h1>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                serverSource === "cn"
                                    ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50"
                                    : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50"
                            }`}>{serverSource === "cn" ? "国服" : "日服"}</span>
                        </div>
                        <p className="text-sm text-slate-500">自我介绍</p>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-12 h-12 border-4 border-miku/30 border-t-miku rounded-full animate-spin mb-4" />
                        <p className="text-slate-500">正在加载...</p>
                    </div>
                )}

                {!isLoading && (
                    <div className="max-w-4xl mx-auto space-y-10">
                        {[
                            { label: "第二学年", data: year2, missing: missing2, err: error2 },
                            { label: "第一学年", data: year1, missing: missing1, err: error1 },
                        ].map(({ label, data, missing, err }) => (
                            <div key={label}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-3 py-1 bg-miku/10 text-miku text-sm font-bold rounded-full border border-miku/20">{label}</span>
                                </div>
                                <StoryReader
                                    scenarioData={data}
                                    isLoading={false}
                                    error={err}
                                    missingPaths={missing ?? undefined}
                                    endLabel={label}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
