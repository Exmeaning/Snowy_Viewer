"use client";
import React from "react";
import { IBondsHonor, IBondsHonorWord, IGameCharaUnit, HONOR_RARITY_NAMES } from "@/types/honor";
import BondsDegreeImage from "./BondsDegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { CHARACTER_NAMES } from "@/types/types";

interface BondsHonorDetailDialogProps {
    open: boolean;
    onClose: () => void;
    bondsHonor?: IBondsHonor;
    bondsHonorWords?: IBondsHonorWord[];
    gameCharaUnits: IGameCharaUnit[];
    source?: AssetSourceType;
}

export default function BondsHonorDetailDialog({
    open,
    onClose,
    bondsHonor,
    bondsHonorWords = [],
    gameCharaUnits,
    source = "snowyassets",
}: BondsHonorDetailDialogProps) {
    if (!open || !bondsHonor) return null;

    const gcu1 = gameCharaUnits.find(g => g.id === bondsHonor.gameCharacterUnitId1);
    const gcu2 = gameCharaUnits.find(g => g.id === bondsHonor.gameCharacterUnitId2);

    // Find the first matching word for this bonds group
    const defaultWord = bondsHonorWords.find(w => w.bondsGroupId === bondsHonor.bondsGroupId);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 space-y-5">
                    {/* Preview */}
                    <div className="flex justify-center">
                        <div className="w-full max-w-[380px]">
                            <BondsDegreeImage
                                bondsHonor={bondsHonor}
                                gameCharaUnits={gameCharaUnits}
                                bondsHonorWordAssetbundleName={defaultWord?.assetbundleName}
                                viewType="normal"
                                honorLevel={bondsHonor.levels.length > 0 ? bondsHonor.levels[0].level : undefined}
                                source={source}
                            />
                        </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-0">
                        <InfoRow label="ID" value={String(bondsHonor.id)} />
                        <InfoRow label="名称" value={bondsHonor.name} />
                        <InfoRow label="稀有度" value={HONOR_RARITY_NAMES[bondsHonor.honorRarity] || bondsHonor.honorRarity} />
                        {gcu1 && (
                            <InfoRow label="角色 1" value={CHARACTER_NAMES[gcu1.gameCharacterId] || `角色 ${gcu1.gameCharacterId}`} />
                        )}
                        {gcu2 && (
                            <InfoRow label="角色 2" value={CHARACTER_NAMES[gcu2.gameCharacterId] || `角色 ${gcu2.gameCharacterId}`} />
                        )}
                    </div>

                    {/* Levels */}
                    {bondsHonor.levels.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3">等级详情</h3>
                            <div className="space-y-3">
                                {bondsHonor.levels.map(level => (
                                    <div key={level.level} className="bg-slate-50 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-miku">Lv.{level.level}</span>
                                        </div>
                                        {level.description && (
                                            <p className="text-sm text-slate-600">{level.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Available Words */}
                    {bondsHonorWords.filter(w => w.bondsGroupId === bondsHonor.bondsGroupId).length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3">可用称号词</h3>
                            <div className="space-y-2">
                                {bondsHonorWords
                                    .filter(w => w.bondsGroupId === bondsHonor.bondsGroupId)
                                    .map(word => (
                                        <div key={word.id} className="bg-slate-50 rounded-xl p-3">
                                            <p className="text-sm text-slate-700 font-medium">{word.name}</p>
                                            {word.description && (
                                                <p className="text-xs text-slate-500 mt-1">{word.description}</p>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-sm font-bold text-slate-600">{label}</span>
            <span className="text-sm text-slate-800 text-right max-w-[60%]">{value}</span>
        </div>
    );
}
