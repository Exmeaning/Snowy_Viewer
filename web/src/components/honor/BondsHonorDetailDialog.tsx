"use client";
import React, { useRef } from "react";
import Modal from "@/components/common/Modal";
import { IBondsHonor, IBondsHonorWord, IGameCharaUnit, HONOR_RARITY_NAMES } from "@/types/honor";
import BondsDegreeImage from "./BondsDegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { CHARACTER_NAMES } from "@/types/types";
import { useSvgPreviewActions } from "@/hooks/useSvgPreviewActions";

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
    const previewRef = useRef<HTMLDivElement>(null);
    const { headerActions, errorMessage } = useSvgPreviewActions({
        isOpen: open,
        previewRef,
        fileName: bondsHonor ? `${bondsHonor.name}_${bondsHonor.id}` : "bonds_honor",
    });
    const gcu1 = bondsHonor
        ? gameCharaUnits.find(g => g.id === bondsHonor.gameCharacterUnitId1)
        : undefined;
    const gcu2 = bondsHonor
        ? gameCharaUnits.find(g => g.id === bondsHonor.gameCharacterUnitId2)
        : undefined;
    const defaultWord = bondsHonor
        ? bondsHonorWords.find(w => w.bondsGroupId === bondsHonor.bondsGroupId)
        : undefined;

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={bondsHonor?.name ?? "羁绊称号详情"}
            size="md"
            headerActions={headerActions}
        >
            {bondsHonor ? (
                <div className="space-y-5">
                    <div className="flex justify-center">
                        <div ref={previewRef} className="w-full max-w-[380px]">
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

                    {bondsHonor.levels.length > 0 && (
                        <div>
                            <h3 className="mb-3 text-sm font-bold text-slate-700">等级详情</h3>
                            <div className="space-y-3">
                                {bondsHonor.levels.map(level => (
                                    <div key={level.level} className="rounded-xl bg-slate-50 p-4 space-y-2">
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

                    {bondsHonorWords.filter(w => w.bondsGroupId === bondsHonor.bondsGroupId).length > 0 && (
                        <div>
                            <h3 className="mb-3 text-sm font-bold text-slate-700">可用称号词</h3>
                            <div className="space-y-2">
                                {bondsHonorWords
                                    .filter(w => w.bondsGroupId === bondsHonor.bondsGroupId)
                                    .map(word => (
                                        <div key={word.id} className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-sm font-medium text-slate-700">{word.name}</p>
                                            {word.description && (
                                                <p className="mt-1 text-xs text-slate-500">{word.description}</p>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
                </div>
            ) : null}
        </Modal>
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
