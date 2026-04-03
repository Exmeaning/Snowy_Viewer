"use client";
import React, { useRef } from "react";
import Modal from "@/components/common/Modal";
import { IHonorInfo, IHonorGroup, HONOR_RARITY_NAMES, HONOR_TYPE_NAMES } from "@/types/honor";
import DegreeImage from "./DegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { useSvgPreviewActions } from "@/hooks/useSvgPreviewActions";

interface HonorDetailDialogProps {
    open: boolean;
    onClose: () => void;
    honor?: IHonorInfo;
    honorGroup?: IHonorGroup;
    source?: AssetSourceType;
}

export default function HonorDetailDialog({
    open,
    onClose,
    honor,
    honorGroup,
    source = "snowyassets",
}: HonorDetailDialogProps) {
    const previewRef = useRef<HTMLDivElement>(null);
    const { headerActions, errorMessage } = useSvgPreviewActions({
        isOpen: open,
        previewRef,
        fileName: honor ? `${honor.name}_${honor.id}` : "honor",
    });

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={honor?.name ?? "称号详情"}
            size="md"
            headerActions={headerActions}
        >
            {honor ? (
                <div className="space-y-5">
                    <div className="flex justify-center">
                        <div ref={previewRef} className="w-full max-w-[380px]">
                            <DegreeImage
                                honor={honor}
                                honorGroup={honorGroup}
                                honorLevel={honor.levels.length > 0 ? honor.levels[0].level : undefined}
                                source={source}
                            />
                        </div>
                    </div>

                    <div className="space-y-0">
                        <InfoRow label="ID" value={String(honor.id)} />
                        <InfoRow label="名称" value={honor.name} />
                        {honorGroup && (
                            <InfoRow label="称号组" value={honorGroup.name} />
                        )}
                        {honorGroup && (
                            <InfoRow label="类型" value={HONOR_TYPE_NAMES[honorGroup.honorType] || honorGroup.honorType} />
                        )}
                        {honor.honorRarity && (
                            <InfoRow label="稀有度" value={HONOR_RARITY_NAMES[honor.honorRarity] || honor.honorRarity} />
                        )}
                    </div>

                    {honor.levels.length > 0 && (
                        <div>
                            <h3 className="mb-3 text-sm font-bold text-slate-700">等级详情</h3>
                            <div className="space-y-4">
                                {honor.levels.map(level => (
                                    <div key={level.level} className="rounded-xl bg-slate-50 p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-miku">Lv.{level.level}</span>
                                            {level.honorRarity && (
                                                <span className="rounded-full bg-miku/10 px-2 py-0.5 text-xs font-medium text-miku">
                                                    {HONOR_RARITY_NAMES[level.honorRarity] || level.honorRarity}
                                                </span>
                                            )}
                                        </div>
                                        {level.description && (
                                            <p className="text-sm text-slate-600">{level.description}</p>
                                        )}
                                        {level.assetbundleName && (
                                            <div className="mt-2">
                                                <DegreeImage
                                                    honor={{ ...honor, assetbundleName: level.assetbundleName }}
                                                    honorGroup={honorGroup}
                                                    honorLevel={level.level}
                                                    source={source}
                                                />
                                            </div>
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
