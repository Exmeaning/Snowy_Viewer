"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterIconUrl } from "@/lib/assets";
import { UNIT_BONUS_OPTIONS, ATTR_OPTIONS } from "./CustomRulesModal";
import type {
    DeckAreaItemOverride,
    DeckCharacterRankOverride,
    DeckMysekaiFixtureOverride,
    DeckMysekaiGateOverride,
} from "@/lib/deck-recommend/engine-types";

export interface OverrideCatalogItem {
    id: number;
    name: string;
    sub?: string;
    unit?: string;
    attr?: string;
    characterId?: number;
    icon?: string;
    max: number;
    current: number | null;
}

export interface DataOverrideValues {
    areaItemLevel: string;
    areaItemOverrides: DeckAreaItemOverride[];
    characterRank: string;
    characterRankOverrides: DeckCharacterRankOverride[];
    mysekaiGateLevel: string;
    mysekaiGateOverrides: DeckMysekaiGateOverride[];
    mysekaiFixtureBonusRate: string;
    mysekaiFixtureOverrides: DeckMysekaiFixtureOverride[];
}

interface DataOverridePanelProps {
    areaItems: OverrideCatalogItem[];
    characters: OverrideCatalogItem[];
    gates: OverrideCatalogItem[];
    fixtureCharacters: OverrideCatalogItem[];
    values: DataOverrideValues;
    onChange: (partial: Partial<DataOverrideValues>) => void;
}

function ItemIcon({ item }: { item: OverrideCatalogItem }) {
    if (item.characterId) {
        return (
            <img
                src={getCharacterIconUrl(item.characterId)}
                alt=""
                className="w-8 h-8 rounded-full object-contain flex-shrink-0"
                loading="lazy"
            />
        );
    }
    if (item.unit) {
        const u = UNIT_BONUS_OPTIONS.find((o) => o.value === item.unit);
        if (u) {
            return (
                <div className="w-8 h-8 relative flex-shrink-0">
                    <Image src={`/data/icon/${u.icon}`} alt="" fill className="object-contain" unoptimized />
                </div>
            );
        }
    }
    if (item.attr) {
        const a = ATTR_OPTIONS.find((o) => o.value.toLowerCase() === item.attr?.toLowerCase());
        if (a) {
            return (
                <div className="w-8 h-8 relative flex-shrink-0">
                    <Image src={`/data/icon/${a.icon}`} alt="" fill className="object-contain" unoptimized />
                </div>
            );
        }
    }
    return (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 flex-shrink-0">
            ★
        </div>
    );
}

export default function DataOverridePanel({
    areaItems,
    characters,
    gates,
    fixtureCharacters,
    values,
    onChange,
}: DataOverridePanelProps) {
    const { t } = useI18n();
    const [subSection, setSubSection] = useState<"characters" | "gates" | "fixtures" | "area">("characters");

    const maxRank = useMemo(() => Math.max(0, ...characters.map((c) => c.max)), [characters]);
    const maxGate = useMemo(() => Math.max(0, ...gates.map((g) => g.max)), [gates]);
    const maxArea = useMemo(() => Math.max(0, ...areaItems.map((a) => a.max)), [areaItems]);

    // Map overrides for fast lookup
    const charOverridesMap = useMemo(
        () => new Map(values.characterRankOverrides.map((e) => [e.characterId, e.rank])),
        [values.characterRankOverrides],
    );
    const gateOverridesMap = useMemo(
        () => new Map(values.mysekaiGateOverrides.map((e) => [e.mysekaiGateId, e.level])),
        [values.mysekaiGateOverrides],
    );
    const fixtureOverridesMap = useMemo(
        () => new Map(values.mysekaiFixtureOverrides.map((e) => [e.characterId, e.totalBonusRate])),
        [values.mysekaiFixtureOverrides],
    );
    const areaOverridesMap = useMemo(
        () => new Map(values.areaItemOverrides.map((e) => [e.areaItemId, e.level])),
        [values.areaItemOverrides],
    );

    // Area items grouped strictly by mutually exclusive categories
    const attrAreaItems = useMemo(
        () => areaItems.filter((i) => !!i.attr && !i.characterId && !i.unit),
        [areaItems],
    );
    const unitAreaItems = useMemo(
        () => areaItems.filter((i) => !!i.unit && !i.characterId && !i.attr),
        [areaItems],
    );
    const charAreaItems = useMemo(
        () => areaItems.filter((i) => !!i.characterId),
        [areaItems],
    );
    const generalAreaItems = useMemo(
        () => areaItems.filter((i) => !i.attr && !i.unit && !i.characterId),
        [areaItems],
    );

    const setCharacterRank = (id: number, rankStr: string) => {
        if (rankStr === "") {
            onChange({
                characterRankOverrides: values.characterRankOverrides.filter((e) => e.characterId !== id),
            });
        } else {
            const num = Math.max(1, parseInt(rankStr, 10) || 1);
            const exists = values.characterRankOverrides.some((e) => e.characterId === id);
            onChange({
                characterRankOverrides: exists
                    ? values.characterRankOverrides.map((e) => (e.characterId === id ? { ...e, rank: num } : e))
                    : [...values.characterRankOverrides, { characterId: id, rank: num }],
            });
        }
    };

    const setGateLevel = (id: number, levelStr: string) => {
        if (levelStr === "") {
            onChange({
                mysekaiGateOverrides: values.mysekaiGateOverrides.filter((e) => e.mysekaiGateId !== id),
            });
        } else {
            const num = Math.max(1, parseInt(levelStr, 10) || 1);
            const exists = values.mysekaiGateOverrides.some((e) => e.mysekaiGateId === id);
            onChange({
                mysekaiGateOverrides: exists
                    ? values.mysekaiGateOverrides.map((e) => (e.mysekaiGateId === id ? { ...e, level: num } : e))
                    : [...values.mysekaiGateOverrides, { mysekaiGateId: id, level: num }],
            });
        }
    };

    const setFixtureRate = (id: number, rateStr: string) => {
        if (rateStr === "") {
            onChange({
                mysekaiFixtureOverrides: values.mysekaiFixtureOverrides.filter((e) => e.characterId !== id),
            });
        } else {
            const num = Math.max(0, parseFloat(rateStr) || 0);
            const exists = values.mysekaiFixtureOverrides.some((e) => e.characterId === id);
            onChange({
                mysekaiFixtureOverrides: exists
                    ? values.mysekaiFixtureOverrides.map((e) =>
                          e.characterId === id ? { ...e, totalBonusRate: num } : e,
                      )
                    : [...values.mysekaiFixtureOverrides, { characterId: id, totalBonusRate: num }],
            });
        }
    };

    const setAreaItemLevel = (id: number, levelStr: string) => {
        if (levelStr === "") {
            onChange({
                areaItemOverrides: values.areaItemOverrides.filter((e) => e.areaItemId !== id),
            });
        } else {
            const num = Math.max(1, parseInt(levelStr, 10) || 1);
            const exists = values.areaItemOverrides.some((e) => e.areaItemId === id);
            onChange({
                areaItemOverrides: exists
                    ? values.areaItemOverrides.map((e) => (e.areaItemId === id ? { ...e, level: num } : e))
                    : [...values.areaItemOverrides, { areaItemId: id, level: num }],
            });
        }
    };

    return (
        <div className="space-y-3.5">
            {/* Sub-section Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                    {
                        key: "characters" as const,
                        label: t("page.deckRecommend.config.dataOverrides.characterTitle"),
                        count: values.characterRankOverrides.length + (values.characterRank ? 1 : 0),
                    },
                    {
                        key: "gates" as const,
                        label: t("page.deckRecommend.config.dataOverrides.gateTitle"),
                        count: values.mysekaiGateOverrides.length + (values.mysekaiGateLevel ? 1 : 0),
                    },
                    {
                        key: "fixtures" as const,
                        label: t("page.deckRecommend.config.dataOverrides.fixtureTitle"),
                        count: values.mysekaiFixtureOverrides.length + (values.mysekaiFixtureBonusRate ? 1 : 0),
                    },
                    {
                        key: "area" as const,
                        label: t("page.deckRecommend.config.dataOverrides.areaItemTitle"),
                        count: values.areaItemOverrides.length + (values.areaItemLevel ? 1 : 0),
                    },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSubSection(tab.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            subSection === tab.key
                                ? "bg-white dark:bg-slate-800 text-miku font-bold shadow-xs border border-miku/30"
                                : "bg-slate-100/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                        }`}
                    >
                        <span>{tab.label}</span>
                        {tab.count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-miku" />}
                    </button>
                ))}
            </div>

            {/* 1. Characters Section */}
            {subSection === "characters" && (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
                    {/* Top Toolbar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {t("page.deckRecommend.config.dataOverrides.characterTitle")}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">(Max {maxRank})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {t("page.deckRecommend.config.dataOverrides.uniformSetting")}:
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={maxRank}
                                    value={values.characterRank}
                                    onChange={(e) => onChange({ characterRank: e.target.value })}
                                    placeholder={t("page.deckRecommend.config.dataOverrides.unset")}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xs focus:border-miku focus:ring-2 focus:ring-miku/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>
                            {maxRank > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ characterRank: String(maxRank) })}
                                    className="text-xs text-miku hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.setAllMax")}
                                </button>
                            )}
                            {(values.characterRank || values.characterRankOverrides.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ characterRank: "", characterRankOverrides: [] })}
                                    className="text-xs text-red-500 hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.clear")}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Character Pure Icon + Highlighted Input Grid */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 max-h-[320px] overflow-y-auto p-1">
                        {characters.map((char) => {
                            const overrideVal = charOverridesMap.get(char.id);
                            const hasOverride = overrideVal !== undefined;
                            return (
                                <div
                                    key={char.id}
                                    title={`${char.name} (Max ${char.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: char.current !== null ? char.current : "-" })})`}
                                    className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                                        hasOverride
                                            ? "bg-miku/10 border-2 border-miku/60 shadow-xs ring-1 ring-miku/20"
                                            : "bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                                    }`}
                                >
                                    <div className="relative mb-1">
                                        <img
                                            src={getCharacterIconUrl(char.id)}
                                            alt={char.name}
                                            className="w-8 h-8 rounded-full object-contain"
                                            loading="lazy"
                                        />
                                        {hasOverride && (
                                            <button
                                                type="button"
                                                onClick={() => setCharacterRank(char.id, "")}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={char.max}
                                        value={hasOverride ? overrideVal : ""}
                                        onChange={(e) => setCharacterRank(char.id, e.target.value)}
                                        placeholder={values.characterRank || (char.current !== null ? String(char.current) : "-")}
                                        className={`w-12 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                            hasOverride
                                                ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. Gates Section */}
            {subSection === "gates" && (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {t("page.deckRecommend.config.dataOverrides.gateTitle")}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">(Max {maxGate})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {t("page.deckRecommend.config.dataOverrides.uniformSetting")}:
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={maxGate}
                                    value={values.mysekaiGateLevel}
                                    onChange={(e) => onChange({ mysekaiGateLevel: e.target.value })}
                                    placeholder={t("page.deckRecommend.config.dataOverrides.unset")}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xs focus:border-miku focus:ring-2 focus:ring-miku/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>
                            {maxGate > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ mysekaiGateLevel: String(maxGate) })}
                                    className="text-xs text-miku hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.setAllMax")}
                                </button>
                            )}
                            {(values.mysekaiGateLevel || values.mysekaiGateOverrides.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ mysekaiGateLevel: "", mysekaiGateOverrides: [] })}
                                    className="text-xs text-red-500 hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.clear")}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 max-h-[320px] overflow-y-auto p-1">
                        {gates.map((gate) => {
                            const overrideVal = gateOverridesMap.get(gate.id);
                            const hasOverride = overrideVal !== undefined;
                            return (
                                <div
                                    key={gate.id}
                                    title={`${gate.name} (Max ${gate.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: gate.current !== null ? gate.current : "-" })})`}
                                    className={`flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all min-h-[92px] space-y-1.5 ${
                                        hasOverride
                                            ? "bg-miku/10 border-2 border-miku/60 shadow-xs ring-1 ring-miku/20"
                                            : "bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                                    }`}
                                >
                                    <div className="relative">
                                        <ItemIcon item={gate} />
                                        {hasOverride && (
                                            <button
                                                type="button"
                                                onClick={() => setGateLevel(gate.id, "")}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min={1}
                                        max={gate.max}
                                        value={hasOverride ? overrideVal : ""}
                                        onChange={(e) => setGateLevel(gate.id, e.target.value)}
                                        placeholder={values.mysekaiGateLevel || (gate.current !== null ? String(gate.current) : "-")}
                                        className={`w-12 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                            hasOverride
                                                ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. Fixtures Section */}
            {subSection === "fixtures" && (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {t("page.deckRecommend.config.dataOverrides.fixtureTitle")}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                ({t("page.deckRecommend.config.dataOverrides.bonusRateUnit")})
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {t("page.deckRecommend.config.dataOverrides.uniformSetting")}:
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={values.mysekaiFixtureBonusRate}
                                    onChange={(e) => onChange({ mysekaiFixtureBonusRate: e.target.value })}
                                    placeholder={t("page.deckRecommend.config.dataOverrides.unset")}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xs focus:border-miku focus:ring-2 focus:ring-miku/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>
                            {(values.mysekaiFixtureBonusRate || values.mysekaiFixtureOverrides.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ mysekaiFixtureBonusRate: "", mysekaiFixtureOverrides: [] })}
                                    className="text-xs text-red-500 hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.clear")}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2 max-h-[320px] overflow-y-auto p-1">
                        {fixtureCharacters.map((char) => {
                            const overrideVal = fixtureOverridesMap.get(char.id);
                            const hasOverride = overrideVal !== undefined;
                            return (
                                <div
                                    key={char.id}
                                    title={`${char.name} (${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: char.current !== null ? `${char.current}%` : "-" })})`}
                                    className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                                        hasOverride
                                            ? "bg-miku/10 border-2 border-miku/60 shadow-xs ring-1 ring-miku/20"
                                            : "bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                                    }`}
                                >
                                    <div className="relative mb-1">
                                        <img
                                            src={getCharacterIconUrl(char.id)}
                                            alt={char.name}
                                            className="w-8 h-8 rounded-full object-contain"
                                            loading="lazy"
                                        />
                                        {hasOverride && (
                                            <button
                                                type="button"
                                                onClick={() => setFixtureRate(char.id, "")}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        value={hasOverride ? overrideVal : ""}
                                        onChange={(e) => setFixtureRate(char.id, e.target.value)}
                                        placeholder={values.mysekaiFixtureBonusRate || (char.current !== null ? String(char.current) : "-")}
                                        className={`w-12 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                            hasOverride
                                                ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 4. Area Items Section */}
            {subSection === "area" && (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-4">
                    {/* Top Toolbar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {t("page.deckRecommend.config.dataOverrides.areaItemTitle")}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">(Max {maxArea})</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {t("page.deckRecommend.config.dataOverrides.uniformSetting")}:
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={maxArea}
                                    value={values.areaItemLevel}
                                    onChange={(e) => onChange({ areaItemLevel: e.target.value })}
                                    placeholder={t("page.deckRecommend.config.dataOverrides.unset")}
                                    className="w-16 px-2 py-1 text-xs text-center font-bold bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xs focus:border-miku focus:ring-2 focus:ring-miku/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>
                            {maxArea > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ areaItemLevel: String(maxArea) })}
                                    className="text-xs text-miku hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.setAllMax")}
                                </button>
                            )}
                            {(values.areaItemLevel || values.areaItemOverrides.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => onChange({ areaItemLevel: "", areaItemOverrides: [] })}
                                    className="text-xs text-red-500 hover:underline font-medium px-1.5 py-1"
                                >
                                    {t("page.deckRecommend.config.dataOverrides.clear")}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
                        {/* 4.1 Attribute Area Items (Grouped by 5 attributes, matching unit style) */}
                        {attrAreaItems.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                                    {t("page.deckRecommend.config.dataOverrides.attrItems")}
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                                    {ATTR_OPTIONS.map((attr) => {
                                        const items = attrAreaItems.filter((i) => i.attr?.toLowerCase() === attr.value.toLowerCase());
                                        if (items.length === 0) return null;
                                        return (
                                            <div
                                                key={attr.value}
                                                className="flex flex-col items-center justify-between p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2 shadow-2xs min-h-[92px]"
                                            >
                                                <div className="w-7 h-7 relative flex-shrink-0">
                                                    <Image src={`/data/icon/${attr.icon}`} alt={attr.label} fill className="object-contain" unoptimized />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                                                    {items.map((item, idx) => {
                                                        const overrideVal = areaOverridesMap.get(item.id);
                                                        const hasOverride = overrideVal !== undefined;
                                                        return (
                                                            <div key={item.id} className="relative">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={item.max}
                                                                    value={hasOverride ? overrideVal : ""}
                                                                    onChange={(e) => setAreaItemLevel(item.id, e.target.value)}
                                                                    placeholder={values.areaItemLevel || (item.current !== null ? String(item.current) : "-")}
                                                                    title={`${item.name} #${idx + 1} (Max ${item.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: item.current !== null ? item.current : "-" })})`}
                                                                    className={`w-11 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                                                        hasOverride
                                                                            ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                                            : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                                                    }`}
                                                                />
                                                                {hasOverride && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setAreaItemLevel(item.id, "")}
                                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                                        title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4.2 Unit Area Items (6 units) */}
                        {unitAreaItems.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                                    {t("page.deckRecommend.config.dataOverrides.unitItems")}
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                    {UNIT_BONUS_OPTIONS.map((unit) => {
                                        const items = unitAreaItems.filter((i) => i.unit === unit.value);
                                        if (items.length === 0) return null;
                                        return (
                                            <div
                                                key={unit.value}
                                                className={`flex flex-col items-center justify-between p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2 shadow-2xs min-h-[92px] ${
                                                    items.length > 2 ? "sm:col-span-2 lg:col-span-2" : ""
                                                }`}
                                            >
                                                <div className="w-7 h-7 relative flex-shrink-0">
                                                    <Image src={`/data/icon/${unit.icon}`} alt="" fill className="object-contain" unoptimized />
                                                </div>
                                                <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                                                    {items.map((item, idx) => {
                                                        const overrideVal = areaOverridesMap.get(item.id);
                                                        const hasOverride = overrideVal !== undefined;
                                                        return (
                                                            <div key={item.id} className="relative">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={item.max}
                                                                    value={hasOverride ? overrideVal : ""}
                                                                    onChange={(e) => setAreaItemLevel(item.id, e.target.value)}
                                                                    placeholder={values.areaItemLevel || (item.current !== null ? String(item.current) : "-")}
                                                                    title={`${item.name} #${idx + 1} (Max ${item.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: item.current !== null ? item.current : "-" })})`}
                                                                    className={`w-11 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                                                        hasOverride
                                                                            ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                                            : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                                                    }`}
                                                                />
                                                                {hasOverride && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setAreaItemLevel(item.id, "")}
                                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                                        title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4.3 Character Area Items (26 characters) */}
                        {charAreaItems.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                                    {t("page.deckRecommend.config.dataOverrides.characterItems")}
                                </span>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2">
                                    {charAreaItems.map((item) => {
                                        const overrideVal = areaOverridesMap.get(item.id);
                                        const hasOverride = overrideVal !== undefined;
                                        return (
                                            <div
                                                key={item.id}
                                                title={`${item.name} (Max ${item.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: item.current !== null ? item.current : "-" })})`}
                                                className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                                                    hasOverride
                                                        ? "bg-miku/10 border-2 border-miku/60 shadow-xs ring-1 ring-miku/20"
                                                        : "bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                                                }`}
                                            >
                                                <div className="relative mb-1">
                                                    <ItemIcon item={item} />
                                                    {hasOverride && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setAreaItemLevel(item.id, "")}
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                            title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={item.max}
                                                    value={hasOverride ? overrideVal : ""}
                                                    onChange={(e) => setAreaItemLevel(item.id, e.target.value)}
                                                    placeholder={values.areaItemLevel || (item.current !== null ? String(item.current) : "-")}
                                                    className={`w-12 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                                        hasOverride
                                                            ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                            : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                                    }`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4.4 General Area Items (if any) */}
                        {generalAreaItems.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                                    {t("page.deckRecommend.config.dataOverrides.generalItems")}
                                </span>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {generalAreaItems.map((item) => {
                                        const overrideVal = areaOverridesMap.get(item.id);
                                        const hasOverride = overrideVal !== undefined;
                                        return (
                                            <div
                                                key={item.id}
                                                title={`${item.name} (Max ${item.max}, ${t("page.deckRecommend.config.dataOverrides.currentLabel", { value: item.current !== null ? item.current : "-" })})`}
                                                className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                                                    hasOverride
                                                        ? "bg-miku/10 border-2 border-miku/60 shadow-xs ring-1 ring-miku/20"
                                                        : "bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                                                }`}
                                            >
                                                <div className="relative mb-1">
                                                    <ItemIcon item={item} />
                                                    {hasOverride && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setAreaItemLevel(item.id, "")}
                                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold"
                                                            title={t("page.deckRecommend.config.dataOverrides.resetOverride")}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={item.max}
                                                    value={hasOverride ? overrideVal : ""}
                                                    onChange={(e) => setAreaItemLevel(item.id, e.target.value)}
                                                    placeholder={values.areaItemLevel || (item.current !== null ? String(item.current) : "-")}
                                                    className={`w-12 px-1 py-0.5 text-xs text-center rounded-lg transition-all ${
                                                        hasOverride
                                                            ? "border-2 border-miku bg-miku/15 text-miku font-extrabold shadow-sm ring-1 ring-miku/30"
                                                            : "border-2 border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 font-medium focus:border-miku focus:ring-1 focus:ring-miku/30 shadow-2xs"
                                                    }`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
