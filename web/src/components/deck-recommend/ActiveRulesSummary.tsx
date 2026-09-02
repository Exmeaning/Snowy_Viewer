"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterIconUrl } from "@/lib/assets";
import type { ICardInfo } from "@/types/types";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { UNIT_BONUS_OPTIONS, ATTR_OPTIONS, type CustomRulesState } from "./CustomRulesModal";

interface ActiveRulesSummaryProps {
    state: CustomRulesState;
    onOpenModal: () => void;
    onChange: (partial: Partial<CustomRulesState>) => void;
    onResetAll: () => void;
    cardsMaster: ICardInfo[];
}

export default function ActiveRulesSummary({
    state,
    onOpenModal,
    onChange,
    onResetAll,
    cardsMaster,
}: ActiveRulesSummaryProps) {
    const { t } = useI18n();

    const {
        fixedCards,
        fixedCharacters,
        excludedCards,
        leaderCharacterId,
        bestSkillAsLeader,
        unitFilter,
        attrFilter,
        characterFilterIds,
        multiTeammatePower,
        multiTeammateScoreUp,
        multiScoreUpLowerBound,
        skillOrder,
        specificSkillOrder,
        skillReference,
        keepAfterTrainingState,
        supportMasterMax,
        supportSkillMax,
        filterOtherUnit,
        boost,
        otherScore,
        areaItemLevel,
        areaItemOverrides,
        characterRank,
        characterRankOverrides,
        mysekaiGateLevel,
        mysekaiGateOverrides,
        mysekaiFixtureBonusRate,
        mysekaiFixtureOverrides,
        singleCardOverrides,
        limit,
        timeoutSeconds,
    } = state;

    const activeRules = useMemo(() => {
        const rules: { key: string; label: string; detail?: React.ReactNode; onRemove: () => void }[] = [];

        if (fixedCharacters.length > 0) {
            rules.push({
                key: "fixedCharacters",
                label: t("page.deckRecommend.rules.preview.fixedCharacters", { count: fixedCharacters.length }),
                detail: (
                    <div className="flex items-center gap-1">
                        {fixedCharacters.map((id) => (
                            <img key={id} src={getCharacterIconUrl(id)} alt="" className="w-5 h-5 rounded-full object-contain" />
                        ))}
                    </div>
                ),
                onRemove: () => onChange({ fixedCharacters: [] }),
            });
        }

        if (fixedCards.length > 0) {
            rules.push({
                key: "fixedCards",
                label: t("page.deckRecommend.rules.preview.fixedCards", { count: fixedCards.length }),
                detail: (
                    <div className="flex items-center gap-1">
                        {fixedCards.map((cardId) => {
                            const c = cardsMaster.find((item) => item.id === cardId);
                            return c ? <SekaiCardThumbnail key={cardId} card={c} trained={false} width={22} /> : null;
                        })}
                    </div>
                ),
                onRemove: () => onChange({ fixedCards: [], useCurrentDeck: false }),
            });
        }

        if (excludedCards.length > 0) {
            rules.push({
                key: "excludedCards",
                label: t("page.deckRecommend.rules.preview.excludedCards", { count: excludedCards.length }),
                detail: (
                    <div className="flex items-center gap-1">
                        {excludedCards.slice(0, 5).map((cardId) => {
                            const c = cardsMaster.find((item) => item.id === cardId);
                            return c ? <SekaiCardThumbnail key={cardId} card={c} trained={false} width={22} /> : null;
                        })}
                        {excludedCards.length > 5 && (
                            <span className="text-[10px] text-slate-400 font-mono">+{excludedCards.length - 5}</span>
                        )}
                    </div>
                ),
                onRemove: () => onChange({ excludedCards: [] }),
            });
        }

        if (leaderCharacterId) {
            rules.push({
                key: "leader",
                label: t("page.deckRecommend.rules.preview.leader"),
                detail: (
                    <img src={getCharacterIconUrl(leaderCharacterId)} alt="" className="w-5 h-5 rounded-full object-contain" />
                ),
                onRemove: () => onChange({ leaderCharacterId: null }),
            });
        }

        if (!bestSkillAsLeader) {
            rules.push({
                key: "noBestSkillLeader",
                label: t("page.deckRecommend.rules.preview.noBestSkillLeader"),
                onRemove: () => onChange({ bestSkillAsLeader: true }),
            });
        }

        if (unitFilter) {
            const u = UNIT_BONUS_OPTIONS.find((item) => item.value === unitFilter);
            rules.push({
                key: "unitFilter",
                label: t("page.deckRecommend.rules.preview.unitFilter"),
                detail: u ? <Image src={`/data/icon/${u.icon}`} alt="" width={18} height={18} className="object-contain" /> : unitFilter,
                onRemove: () => onChange({ unitFilter: "" }),
            });
        }

        if (attrFilter) {
            const a = ATTR_OPTIONS.find((item) => item.value === attrFilter);
            rules.push({
                key: "attrFilter",
                label: t("page.deckRecommend.rules.preview.attrFilter"),
                detail: a ? <Image src={`/data/icon/${a.icon}`} alt="" width={18} height={18} className="object-contain" /> : attrFilter,
                onRemove: () => onChange({ attrFilter: "" }),
            });
        }

        if (characterFilterIds.length > 0) {
            rules.push({
                key: "characterFilter",
                label: t("page.deckRecommend.rules.preview.characterFilter", { count: characterFilterIds.length }),
                detail: (
                    <div className="flex items-center gap-1">
                        {characterFilterIds.map((id) => (
                            <img key={id} src={getCharacterIconUrl(id)} alt="" className="w-5 h-5 rounded-full object-contain" />
                        ))}
                    </div>
                ),
                onRemove: () => onChange({ characterFilterIds: [] }),
            });
        }

        if (multiTeammatePower || multiTeammateScoreUp || multiScoreUpLowerBound) {
            const parts: string[] = [];
            if (multiTeammatePower) parts.push(`${multiTeammatePower}`);
            if (multiTeammateScoreUp) parts.push(`${multiTeammateScoreUp}%`);
            rules.push({
                key: "multiLive",
                label: t("page.deckRecommend.rules.preview.multiLive", { value: parts.join(" / ") || "-" }),
                onRemove: () => onChange({ multiTeammatePower: "", multiTeammateScoreUp: "", multiScoreUpLowerBound: "" }),
            });
        }

        if (skillOrder !== "average" || specificSkillOrder) {
            rules.push({
                key: "skillOrder",
                label: t("page.deckRecommend.rules.preview.skillOrder", {
                    order: skillOrder === "specific" ? specificSkillOrder || "12345" : t(`page.deckRecommend.config.skillOrders.${skillOrder}`),
                }),
                onRemove: () => onChange({ skillOrder: "average", specificSkillOrder: "" }),
            });
        }

        if (skillReference !== "average") {
            rules.push({
                key: "skillRef",
                label: t("page.deckRecommend.rules.preview.skillRef", {
                    ref: t(`page.deckRecommend.config.skillReferences.${skillReference}`),
                }),
                onRemove: () => onChange({ skillReference: "average" }),
            });
        }

        if (keepAfterTrainingState) {
            rules.push({
                key: "keepAfterTraining",
                label: t("page.deckRecommend.rules.preview.keepAfterTraining"),
                onRemove: () => onChange({ keepAfterTrainingState: false }),
            });
        }

        if (supportMasterMax || supportSkillMax || filterOtherUnit) {
            rules.push({
                key: "support",
                label: t("page.deckRecommend.rules.preview.supportSettings"),
                onRemove: () => onChange({ supportMasterMax: false, supportSkillMax: false, filterOtherUnit: false }),
            });
        }

        if (areaItemLevel || areaItemOverrides.length > 0) {
            rules.push({
                key: "areaItems",
                label: areaItemLevel
                    ? t("page.deckRecommend.rules.preview.areaLevel", { level: areaItemLevel })
                    : t("page.deckRecommend.rules.preview.areaOverrides", { count: areaItemOverrides.length }),
                onRemove: () => onChange({ areaItemLevel: "", areaItemOverrides: [] }),
            });
        }

        if (characterRank || characterRankOverrides.length > 0) {
            rules.push({
                key: "characterRank",
                label: characterRank
                    ? t("page.deckRecommend.rules.preview.characterRankLevel", { rank: characterRank })
                    : t("page.deckRecommend.rules.preview.characterRankOverrides", { count: characterRankOverrides.length }),
                onRemove: () => onChange({ characterRank: "", characterRankOverrides: [] }),
            });
        }

        if (mysekaiGateLevel || mysekaiGateOverrides.length > 0 || mysekaiFixtureBonusRate || mysekaiFixtureOverrides.length > 0) {
            rules.push({
                key: "mysekaiOverrides",
                label: t("page.deckRecommend.rules.preview.mysekaiOverrides"),
                onRemove: () => onChange({
                    mysekaiGateLevel: "",
                    mysekaiGateOverrides: [],
                    mysekaiFixtureBonusRate: "",
                    mysekaiFixtureOverrides: [],
                }),
            });
        }

        if (singleCardOverrides.length > 0) {
            rules.push({
                key: "singleCards",
                label: t("page.deckRecommend.rules.preview.singleCards", { count: singleCardOverrides.length }),
                detail: (
                    <div className="flex items-center gap-1">
                        {singleCardOverrides.slice(0, 5).map((entry) => {
                            const c = cardsMaster.find((item) => item.id === entry.cardId);
                            return c ? <SekaiCardThumbnail key={entry.cardId} card={c} trained={false} width={22} /> : null;
                        })}
                        {singleCardOverrides.length > 5 && (
                            <span className="text-[10px] text-slate-400 font-mono">+{singleCardOverrides.length - 5}</span>
                        )}
                    </div>
                ),
                onRemove: () => onChange({ singleCardOverrides: [] }),
            });
        }

        if (boost || otherScore) {
            rules.push({
                key: "boostScore",
                label: t("page.deckRecommend.rules.preview.boostScore"),
                onRemove: () => onChange({ boost: "", otherScore: "" }),
            });
        }

        if (limit !== "10" || timeoutSeconds !== "120") {
            rules.push({
                key: "engineParams",
                label: t("page.deckRecommend.rules.preview.engineParams", { limit, timeout: timeoutSeconds }),
                onRemove: () => onChange({ limit: "10", timeoutSeconds: "120" }),
            });
        }

        return rules;
    }, [
        fixedCards, fixedCharacters, excludedCards, leaderCharacterId, bestSkillAsLeader,
        unitFilter, attrFilter, characterFilterIds, multiTeammatePower, multiTeammateScoreUp,
        multiScoreUpLowerBound, skillOrder, specificSkillOrder, skillReference,
        keepAfterTrainingState, supportMasterMax, supportSkillMax, filterOtherUnit,
        areaItemLevel, areaItemOverrides, characterRank, characterRankOverrides,
        mysekaiGateLevel, mysekaiGateOverrides, mysekaiFixtureBonusRate, mysekaiFixtureOverrides,
        singleCardOverrides, boost, otherScore, limit, timeoutSeconds, cardsMaster, onChange, t
    ]);

    return (
        <div className="mb-5 bg-white/40 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 transition-all">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-miku rounded-full" />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {t("page.deckRecommend.rules.title")}
                    </span>
                    {activeRules.length > 0 && (
                        <span className="text-xs font-mono font-bold text-miku bg-miku/10 border border-miku/20 px-2 py-0.5 rounded-full">
                            {t("page.deckRecommend.rules.activeCount", { count: activeRules.length })}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {activeRules.length > 0 && (
                        <button
                            type="button"
                            onClick={onResetAll}
                            className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                            {t("page.deckRecommend.rules.resetAll")}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onOpenModal}
                        className="ios-glass-btn rounded-xl px-3.5 py-1.5 text-xs font-bold text-miku hover:border-miku/40 transition-all flex items-center gap-1.5 shadow-xs"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <span>{activeRules.length > 0 ? t("page.deckRecommend.rules.editButton") : t("page.deckRecommend.rules.addButton")}</span>
                    </button>
                </div>
            </div>

            {activeRules.length === 0 ? (
                <div
                    onClick={onOpenModal}
                    className="p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80 text-center cursor-pointer hover:border-miku/50 transition-all group"
                >
                    <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-miku transition-colors">
                        {t("page.deckRecommend.rules.emptyHint")}
                    </p>
                </div>
            ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeRules.map((rule) => (
                        <div
                            key={rule.key}
                            className="inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs shadow-xs"
                        >
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{rule.label}</span>
                            {rule.detail}
                            <button
                                type="button"
                                onClick={rule.onRemove}
                                className="text-slate-400 hover:text-red-500 font-bold ml-1"
                                title={t("page.deckRecommend.rules.removeRule")}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
