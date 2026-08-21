"use client";
import React, { useRef } from "react";
import Modal from "@/components/common/Modal";
import { IHonorInfo, IHonorGroup } from "@/types/honor";
import DegreeImage from "./DegreeImage";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { useSvgPreviewActions } from "@/hooks/useSvgPreviewActions";
import { useI18n } from "@/contexts/I18nContext";

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
    source = "main-jp",
}: HonorDetailDialogProps) {
    const { t } = useI18n();
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
            title={honor?.name ?? t("page.honors.normalDetailTitle")}
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
                        <InfoRow label={t("common.field.name")} value={honor.name} />
                        {honorGroup && (
                            <InfoRow label={t("common.field.honorGroup")} value={honorGroup.name} />
                        )}
                        {honorGroup && (
                            <InfoRow label={t("common.field.type")} value={t(`common.honor.types.${honorGroup.honorType}`) === `common.honor.types.${honorGroup.honorType}` ? honorGroup.honorType.replace(/_/g, " ") : t(`common.honor.types.${honorGroup.honorType}`)} />
                        )}
                        {honor.honorRarity && (
                            <InfoRow label={t("common.field.rarity")} value={t(`common.honor.rarities.${honor.honorRarity}`) === `common.honor.rarities.${honor.honorRarity}` ? honor.honorRarity : t(`common.honor.rarities.${honor.honorRarity}`)} />
                        )}
                    </div>

                    {honor.levels.length > 0 && (
                        <div>
                            <h3 className="hh-title mb-3 text-sm font-bold text-[var(--hh-text-primary)]">{t("common.field.levelDetails")}</h3>
                            <div className="space-y-4">
                                {honor.levels.map(level => (
                                    <div key={level.level} className="hh-well p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="hh-numeric text-xs font-bold text-miku">Lv.{level.level}</span>
                                            {level.honorRarity && (
                                                <span className="rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent-wash-strong)] px-2 py-0.5 text-xs font-medium text-[var(--hh-accent-deep)]">
                                                    {t(`common.honor.rarities.${level.honorRarity}`) === `common.honor.rarities.${level.honorRarity}` ? level.honorRarity : t(`common.honor.rarities.${level.honorRarity}`)}
                                                </span>
                                            )}
                                        </div>
                                        {level.description && (
                                            <p className="hh-body text-sm text-[var(--hh-text-secondary)]">{level.description}</p>
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
        <div className="flex items-center justify-between py-2.5 border-b border-[var(--hh-border-hairline)] last:border-0">
            <span className="text-sm font-bold text-[var(--hh-text-secondary)]">{label}</span>
            <span className="text-sm text-[var(--hh-text-primary)] text-right max-w-[60%]">{value}</span>
        </div>
    );
}
