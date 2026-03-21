"use client";

import DegreeImage from "@/components/honor/DegreeImage";
import BondsDegreeImage from "@/components/honor/BondsDegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { RealtimeRankingMasterData, NormalizedPlayerHonor } from "@/types/realtime-ranking";

interface PlayerHonorPreviewProps {
    honors: NormalizedPlayerHonor[];
    masterData: RealtimeRankingMasterData;
    assetSource: AssetSourceType;
}

export default function PlayerHonorPreview({ honors, masterData, assetSource }: PlayerHonorPreviewProps) {
    if (honors.length === 0) {
        return <div className="text-xs text-slate-400">暂无可展示称号</div>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {honors.slice(0, 3).map((item, index) => {
                if (item.kind === "bonds" && item.bondsHonorId) {
                    const bondsHonor = masterData.bondsHonors.find((entry) => entry.id === item.bondsHonorId);
                    if (!bondsHonor) return null;

                    const resolvedWordAssetbundleName = item.bondsHonorWordAssetbundleName?.startsWith("__WORD_ID__:")
                        ? (() => {
                            const wordId = Number(item.bondsHonorWordAssetbundleName.replace("__WORD_ID__:", ""));
                            return masterData.bondsHonorWords.find((entry) => entry.id === wordId)?.assetbundleName;
                        })()
                        : item.bondsHonorWordAssetbundleName;

                    return (
                        <div key={`bonds-${item.bondsHonorId}-${index}`} className="w-[148px] max-w-full sm:w-[156px]">
                            <BondsDegreeImage
                                bondsHonor={bondsHonor}
                                gameCharaUnits={masterData.gameCharaUnits}
                                bondsHonorWordAssetbundleName={resolvedWordAssetbundleName}
                                honorLevel={item.bondsHonorLevel}
                                source={assetSource}
                                sub
                                className="w-full"
                            />
                        </div>
                    );
                }

                if (item.kind === "normal" && item.honorId) {
                    const honor = masterData.honors.find((entry) => entry.id === item.honorId);
                    if (!honor) return null;
                    const honorGroup = masterData.honorGroups.find((group) => group.id === honor.groupId);
                    return (
                        <div key={`normal-${item.honorId}-${index}`} className="w-[148px] max-w-full sm:w-[156px]">
                            <DegreeImage
                                honor={honor}
                                honorGroup={honorGroup}
                                honorLevel={item.honorLevel}
                                source={assetSource}
                                sub
                                className="w-full"
                            />
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
}
