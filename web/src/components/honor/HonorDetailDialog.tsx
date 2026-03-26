"use client";
import React from "react";
import { IHonorInfo, IHonorGroup, HONOR_RARITY_NAMES, HONOR_TYPE_NAMES } from "@/types/honor";
import DegreeImage from "./DegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";

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
    if (!open || !honor) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 space-y-5">
                    {/* Honor Image Preview */}
                    <div className="flex justify-center">
                        <div className="w-full max-w-[380px]">
                            <DegreeImage
                                honor={honor}
                                honorGroup={honorGroup}
                                honorLevel={honor.levels.length > 0 ? honor.levels[0].level : undefined}
                                source={source}
                            />
                        </div>
                    </div>

                    {/* Info Rows */}
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

                    {/* Levels */}
                    {honor.levels.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3">等级详情</h3>
                            <div className="space-y-4">
                                {honor.levels.map(level => (
                                    <div key={level.level} className="bg-slate-50 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-miku">Lv.{level.level}</span>
                                            {level.honorRarity && (
                                                <span className="text-xs px-2 py-0.5 bg-miku/10 text-miku rounded-full font-medium">
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
