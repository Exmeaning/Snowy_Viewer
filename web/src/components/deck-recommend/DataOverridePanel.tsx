"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type {
    DeckAreaItemOverride,
    DeckCharacterRankOverride,
    DeckMysekaiFixtureOverride,
    DeckMysekaiGateOverride,
} from "@/lib/deck-recommend/engine-types";

/** One selectable row in the override panel (with the account's current value and cap). */
export interface OverrideCatalogItem {
    id: number;
    /** Display name (already localized by the caller). */
    name: string;
    /** Secondary label (character / unit / attr). */
    sub?: string;
    /** Cap for the level or the bonus value. */
    max: number;
    /** Current value from the account; null when unavailable. */
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
    /** Area items (id/name/sub/max/current). */
    areaItems: OverrideCatalogItem[];
    characters: OverrideCatalogItem[];
    gates: OverrideCatalogItem[];
    fixtureCharacters: OverrideCatalogItem[];
    values: DataOverrideValues;
    onChange: (partial: Partial<DataOverrideValues>) => void;
}

/** Add row: dropdown of uncovered items + add button; picking one adds a row (defaults to the cap). */
function AddRow({
    items,
    label,
    add,
    t,
}: {
    items: OverrideCatalogItem[];
    label: (item: OverrideCatalogItem) => string;
    add: (id: number) => void;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const [selected, setSelected] = useState("");
    return (
        <div className="flex items-center gap-2 pt-2">
            <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="ds-field-input !w-auto flex-1 !py-1.5 !text-xs"
            >
                <option value="">{t("page.deckRecommend.config.dataOverrides.pick")}</option>
                {items.map((item) => (
                    <option key={item.id} value={item.id}>{label(item)}</option>
                ))}
            </select>
            <button
                type="button"
                disabled={selected === ""}
                onClick={() => {
                    add(Number(selected));
                    setSelected("");
                }}
                className="ios-glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-miku disabled:opacity-40"
            >
                {t("page.deckRecommend.config.dataOverrides.add")}
            </button>
        </div>
    );
}

/** One single-item override row: name + current value + override input + remove. */
function OverrideRow({
    name,
    sub,
    current,
    max,
    value,
    onValue,
    onRemove,
    t,
}: {
    name: string;
    sub?: string;
    current: number | null;
    max: number;
    value: number;
    onValue: (v: number) => void;
    onRemove: () => void;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    return (
        <div className="flex items-center gap-2 flex-wrap py-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="text-xs text-slate-600 dark:text-slate-300 w-36 truncate" title={name}>{name}</span>
            {sub && <span className="text-[10px] text-slate-400 max-w-24 truncate" title={sub}>{sub}</span>}
            <span className="text-[10px] text-slate-400 ml-auto sm:ml-2 whitespace-nowrap">
                {current === null ? "-" : t("page.deckRecommend.config.dataOverrides.current", { value: current })}
            </span>
            <input
                type="number"
                min={0}
                max={max}
                value={value}
                onChange={(e) => onValue(Number(e.target.value))}
                className="ds-field-input !w-20 !py-1 !text-xs"
            />
            <span className="text-[10px] text-slate-400">/ {max}</span>
            <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-500 text-xs px-1">
                ×
            </button>
        </div>
    );
}

/** Uniform value selector: default (no override) + 1..max. */
function UniformSelect({
    value,
    max,
    disabled,
    onChange,
    t,
}: {
    value: string;
    max: number;
    disabled?: boolean;
    onChange: (v: string) => void;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const options = useMemo(() => Array.from({ length: Math.max(0, max) }, (_, i) => i + 1), [max]);
    return (
        <select
            value={value === "" ? "default" : value}
            disabled={disabled || max <= 0}
            onChange={(e) => onChange(e.target.value === "default" ? "" : e.target.value)}
            className="ds-field-input !w-auto !px-3 !py-1.5 !text-xs"
        >
            <option value="default">{t("page.deckRecommend.config.dataOverrides.unset")}</option>
            {options.map((level) => (
                <option key={level} value={level}>{level}</option>
            ))}
        </select>
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

    const patchOverrides = <T,>(key: keyof DataOverrideValues, list: T[]) => {
        onChange({ [key]: list } as Partial<DataOverrideValues>);
    };

    const available = (items: OverrideCatalogItem[], overrideIds: number[]) =>
        items.filter((item) => !overrideIds.includes(item.id));

    const pickupLabel = (item: OverrideCatalogItem | undefined) =>
        item ? `${item.name}${item.sub ? `（${item.sub}）` : ""}` : "";

    const maxAreaLevel = Math.max(0, ...areaItems.map((item) => item.max));
    const maxRank = Math.max(0, ...characters.map((item) => item.max));
    const maxGateLevel = Math.max(0, ...gates.map((item) => item.max));

    return (
        <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t("page.deckRecommend.config.dataOverridesTitle")}
            </label>
            <p className="text-xs text-slate-400 mb-3">{t("page.deckRecommend.config.dataOverridesDesc")}</p>
            <div className="grid gap-3">
                {/* Area items */}
                <div data-testid="dr-ov-area" className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium text-primary-text dark:text-slate-100">
                            {t("page.deckRecommend.config.dataOverrides.areaItemTitle")}
                        </span>
                        <UniformSelect
                            value={values.areaItemLevel}
                            max={maxAreaLevel}
                            disabled={areaItems.length === 0}
                            onChange={(v) => onChange({ areaItemLevel: v })}
                            t={t}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mb-1">
                        {t("page.deckRecommend.config.dataOverrides.areaItemLevel")}
                    </p>
                    {values.areaItemOverrides.length === 0 && (
                        <p className="text-xs text-slate-300 dark:text-slate-600 py-1">
                            {t("page.deckRecommend.config.dataOverrides.none")}
                        </p>
                    )}
                    {values.areaItemOverrides.map((entry) => {
                        const meta = areaItems.find((item) => item.id === entry.areaItemId);
                        return (
                            <OverrideRow
                                key={entry.areaItemId}
                                name={meta?.name ?? `#${entry.areaItemId}`}
                                sub={meta?.sub}
                                current={meta?.current ?? null}
                                max={meta?.max ?? entry.level}
                                value={entry.level}
                                onValue={(v) => patchOverrides(
                                    "areaItemOverrides",
                                    values.areaItemOverrides.map((e) => e.areaItemId === entry.areaItemId ? { ...e, level: v } : e),
                                )}
                                onRemove={() => patchOverrides(
                                    "areaItemOverrides",
                                    values.areaItemOverrides.filter((e) => e.areaItemId !== entry.areaItemId),
                                )}
                                t={t}
                            />
                        );
                    })}
                    <AddRow
                        items={available(areaItems, values.areaItemOverrides.map((e) => e.areaItemId))}
                        label={pickupLabel}
                        add={(id) => {
                            const meta = areaItems.find((item) => item.id === id);
                            patchOverrides("areaItemOverrides", [
                                ...values.areaItemOverrides,
                                { areaItemId: id, level: meta?.max ?? 1 },
                            ]);
                        }}
                        t={t}
                    />
                    {values.areaItemOverrides.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">{t("page.deckRecommend.config.dataOverrides.priorityHint")}</p>
                    )}
                </div>

                {/* Character ranks */}
                <div data-testid="dr-ov-character" className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium text-primary-text dark:text-slate-100">
                            {t("page.deckRecommend.config.dataOverrides.characterTitle")}
                        </span>
                        <UniformSelect
                            value={values.characterRank}
                            max={maxRank}
                            disabled={characters.length === 0}
                            onChange={(v) => onChange({ characterRank: v })}
                            t={t}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mb-1">
                        {t("page.deckRecommend.config.dataOverrides.characterRank")}
                    </p>
                    {values.characterRankOverrides.length === 0 && (
                        <p className="text-xs text-slate-300 dark:text-slate-600 py-1">
                            {t("page.deckRecommend.config.dataOverrides.none")}
                        </p>
                    )}
                    {values.characterRankOverrides.map((entry) => {
                        const meta = characters.find((item) => item.id === entry.characterId);
                        return (
                            <OverrideRow
                                key={entry.characterId}
                                name={meta?.name ?? `#${entry.characterId}`}
                                sub={meta?.sub}
                                current={meta?.current ?? null}
                                max={meta?.max ?? entry.rank}
                                value={entry.rank}
                                onValue={(v) => patchOverrides(
                                    "characterRankOverrides",
                                    values.characterRankOverrides.map((e) => e.characterId === entry.characterId ? { ...e, rank: v } : e),
                                )}
                                onRemove={() => patchOverrides(
                                    "characterRankOverrides",
                                    values.characterRankOverrides.filter((e) => e.characterId !== entry.characterId),
                                )}
                                t={t}
                            />
                        );
                    })}
                    <AddRow
                        items={available(characters, values.characterRankOverrides.map((e) => e.characterId))}
                        label={pickupLabel}
                        add={(id) => {
                            const meta = characters.find((item) => item.id === id);
                            patchOverrides("characterRankOverrides", [
                                ...values.characterRankOverrides,
                                { characterId: id, rank: meta?.max ?? 1 },
                            ]);
                        }}
                        t={t}
                    />
                    {values.characterRankOverrides.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">{t("page.deckRecommend.config.dataOverrides.priorityHint")}</p>
                    )}
                </div>

                {/* MySekai gates */}
                <div data-testid="dr-ov-gate" className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium text-primary-text dark:text-slate-100">
                            {t("page.deckRecommend.config.dataOverrides.gateTitle")}
                        </span>
                        <UniformSelect
                            value={values.mysekaiGateLevel}
                            max={maxGateLevel}
                            disabled={gates.length === 0}
                            onChange={(v) => onChange({ mysekaiGateLevel: v })}
                            t={t}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mb-1">
                        {t("page.deckRecommend.config.dataOverrides.gateLevel")}
                    </p>
                    {values.mysekaiGateOverrides.length === 0 && (
                        <p className="text-xs text-slate-300 dark:text-slate-600 py-1">
                            {t("page.deckRecommend.config.dataOverrides.none")}
                        </p>
                    )}
                    {values.mysekaiGateOverrides.map((entry) => {
                        const meta = gates.find((item) => item.id === entry.mysekaiGateId);
                        return (
                            <OverrideRow
                                key={entry.mysekaiGateId}
                                name={meta?.name ?? `#${entry.mysekaiGateId}`}
                                sub={meta?.sub}
                                current={meta?.current ?? null}
                                max={meta?.max ?? entry.level}
                                value={entry.level}
                                onValue={(v) => patchOverrides(
                                    "mysekaiGateOverrides",
                                    values.mysekaiGateOverrides.map((e) => e.mysekaiGateId === entry.mysekaiGateId ? { ...e, level: v } : e),
                                )}
                                onRemove={() => patchOverrides(
                                    "mysekaiGateOverrides",
                                    values.mysekaiGateOverrides.filter((e) => e.mysekaiGateId !== entry.mysekaiGateId),
                                )}
                                t={t}
                            />
                        );
                    })}
                    <AddRow
                        items={available(gates, values.mysekaiGateOverrides.map((e) => e.mysekaiGateId))}
                        label={pickupLabel}
                        add={(id) => {
                            const meta = gates.find((item) => item.id === id);
                            patchOverrides("mysekaiGateOverrides", [
                                ...values.mysekaiGateOverrides,
                                { mysekaiGateId: id, level: meta?.max ?? 1 },
                            ]);
                        }}
                        t={t}
                    />
                    {values.mysekaiGateOverrides.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">{t("page.deckRecommend.config.dataOverrides.priorityHint")}</p>
                    )}
                </div>

                {/* Fixture bonuses */}
                <div data-testid="dr-ov-fixture" className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-primary-text dark:text-slate-100">
                            {t("page.deckRecommend.config.dataOverrides.fixtureTitle")}
                        </span>
                        <label className="flex items-center gap-2 text-[11px] text-slate-400">
                            {t("page.deckRecommend.config.dataOverrides.fixtureRate")}
                            <input
                                type="number"
                                min={0}
                                value={values.mysekaiFixtureBonusRate}
                                onChange={(e) => onChange({ mysekaiFixtureBonusRate: e.target.value })}
                                placeholder="-"
                                className="ds-field-input !w-24 !py-1.5 !text-xs"
                            />
                        </label>
                    </div>
                    {values.mysekaiFixtureOverrides.length === 0 && (
                        <p className="text-xs text-slate-300 dark:text-slate-600 py-1">
                            {t("page.deckRecommend.config.dataOverrides.none")}
                        </p>
                    )}
                    {values.mysekaiFixtureOverrides.map((entry) => {
                        const meta = fixtureCharacters.find((item) => item.id === entry.characterId);
                        return (
                            <OverrideRow
                                key={entry.characterId}
                                name={meta?.name ?? `#${entry.characterId}`}
                                sub={meta?.sub}
                                current={meta?.current ?? null}
                                max={Math.max(meta?.max ?? 0, 9999)}
                                value={entry.totalBonusRate}
                                onValue={(v) => patchOverrides(
                                    "mysekaiFixtureOverrides",
                                    values.mysekaiFixtureOverrides.map((e) => e.characterId === entry.characterId ? { ...e, totalBonusRate: v } : e),
                                )}
                                onRemove={() => patchOverrides(
                                    "mysekaiFixtureOverrides",
                                    values.mysekaiFixtureOverrides.filter((e) => e.characterId !== entry.characterId),
                                )}
                                t={t}
                            />
                        );
                    })}
                    <AddRow
                        items={available(fixtureCharacters, values.mysekaiFixtureOverrides.map((e) => e.characterId))}
                        label={pickupLabel}
                        add={(id) => {
                            const meta = fixtureCharacters.find((item) => item.id === id);
                            patchOverrides("mysekaiFixtureOverrides", [
                                ...values.mysekaiFixtureOverrides,
                                { characterId: id, totalBonusRate: meta?.current ?? 0 },
                            ]);
                        }}
                        t={t}
                    />
                    {values.mysekaiFixtureOverrides.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">{t("page.deckRecommend.config.dataOverrides.priorityHint")}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

