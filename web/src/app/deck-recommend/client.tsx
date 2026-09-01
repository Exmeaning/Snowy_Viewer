"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "@/components/LocalizedLink";
import { useI18n } from "@/contexts/I18nContext";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import type { ICardInfo } from "@/types/types";
import type { IMusicInfo } from "@/types/music";
import CharacterSelector from "@/components/deck-recommend/CharacterSelector";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import CardSelectorModal from "@/components/cards/CardSelectorModal";
import { fetchMasterDataForServer } from "@/lib/fetch";
import { getCharacterIconUrl, getCardThumbnailUrl } from "@/lib/assets";
import {
    getOAuthAccessTokenForGameUser,
    isValidServer,
    SERVER_OPTIONS,
    type ServerType,
} from "@/lib/account";
import {
    getWl3SimulationGroupByEventId,
    type Wl3SimulationGroup,
} from "@/lib/world-bloom-simulation";
import { getCharacterName } from "@/lib/i18n";
import AccountSelector from "@/components/AccountSelector";
import EventSelector from "@/components/deck-recommend/EventSelector";
import MusicSelector from "@/components/deck-recommend/MusicSelector";
import { preloadDeckEngine } from "@/lib/deck-engine/wasm-loader";
import type {
    DeckRecommendMode,
    DeckResultDeck,
    DeckSingleCardOverride,
    DeckTrainingConfig,
    DeckUserCard,
    DeckWorkerOutput,
    DeckTarget,
    DeckSkillOrder,
    DeckSkillReference,
} from "@/lib/deck-recommend/engine-types";
import "./deck-recommend.css";

const MODE_OPTIONS: { value: DeckRecommendMode }[] = [
    { value: "event" },
    { value: "challenge" },
    { value: "custom" },
    { value: "strongest" },
    { value: "weakest" },
    { value: "mysekai" },
];

const DIFFICULTY_OPTIONS = ["easy", "normal", "hard", "expert", "master", "append"];

const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "bg-blue-500",
    normal: "bg-green-500",
    hard: "bg-amber-500",
    expert: "bg-red-500",
    master: "bg-purple-500",
    append: "bg-slate-800 dark:bg-slate-200",
};

const LIVE_TYPE_OPTIONS = ["multi", "solo", "auto"] as const;
const CHALLENGE_LIVE_OPTIONS = ["challenge", "auto"] as const;

const RARITY_CONFIG_KEYS = [
    { key: "rarity_1", color: "#888888" },
    { key: "rarity_2", color: "#88BB44" },
    { key: "rarity_3", color: "#4488DD" },
    { key: "rarity_4", color: "#FFAA00" },
    { key: "rarity_birthday", color: "#FF6699" },
];

const DEFAULT_CARD_CONFIG: Record<string, DeckTrainingConfig> = {
    rarity_1: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, levelMax: true, episodeRead: true, masterMax: false, skillMax: false },
};

/** 引擎事件加成团编码（event_unit）。 */
const UNIT_BONUS_OPTIONS = [
    { value: "light_sound", labelKey: "common.units.ln", icon: "ln.webp" },
    { value: "idol", labelKey: "common.units.mmj", icon: "mmj.webp" },
    { value: "street", labelKey: "common.units.vbs", icon: "vbs.webp" },
    { value: "theme_park", labelKey: "common.units.ws", icon: "wxs.webp" },
    { value: "school_refusal", labelKey: "common.units.25ji", icon: "n25.webp" },
    { value: "piapro", labelKey: "common.units.vs", icon: "vs.webp" },
];

const ATTR_OPTIONS = [
    { value: "cool", label: "Cool", icon: "Cool.webp" },
    { value: "cute", label: "Cute", icon: "cute.webp" },
    { value: "happy", label: "Happy", icon: "Happy.webp" },
    { value: "mysterious", label: "Mysterious", icon: "Mysterious.webp" },
    { value: "pure", label: "Pure", icon: "Pure.webp" },
];

const SIM_EVENT_TYPE_OPTIONS = ["marathon", "cheerful_carnival", "world_bloom"] as const;

/** 自定义加成可选角色（1-26）。 */
const CUSTOM_CHARACTER_IDS = Array.from({ length: 26 }, (_, i) => i + 1);
const VIRTUAL_SINGER_ID_MIN = 21;

type CustomSubMode = "unit" | "character";
type TranslationFn = ReturnType<typeof useI18n>["t"];

const USER_ID_STORAGE_KEY = "deck_recommend_userid";
const SERVER_STORAGE_KEY = "deck_recommend_server";
const SAVED_CONFIG_KEY = "deck_recommend_saved_config_v2";

/** 保存到 localStorage 的可序列化表单状态。 */
interface SavedConfig {
    mode: DeckRecommendMode;
    eventId: string;
    selectedEventType: string | null;
    eventBonusCharacterIds: number[];
    liveType: string;
    supportCharacterId: number | null;
    challengeCharacterId: number | null;
    musicId: string;
    difficulty: string;
    cardConfig: Record<string, DeckTrainingConfig>;
    target: DeckTarget;
    bonusTargets: string;
    simulateEnabled: boolean;
    simType: string;
    simAttr: string;
    simUnit: string;
    simTurn: number;
    simCharacterId: number | null;
    customSubMode: CustomSubMode;
    customUnit: string;
    customCharacterIds: number[];
    customCharacterUnits: Record<number, string>;
    customAttr: string;
    strongestTarget: "power" | "skill";
    multiTeammatePower: string;
    multiTeammateScoreUp: string;
    multiScoreUpLowerBound: string;
    skillOrder: DeckSkillOrder;
    specificSkillOrder: string;
    skillReference: DeckSkillReference;
    keepAfterTrainingState: boolean;
    bestSkillAsLeader: boolean;
    minimize: boolean;
    supportMasterMax: boolean;
    supportSkillMax: boolean;
    filterOtherUnit: boolean;
    boost: string;
    otherScore: string;
    fixedCards: number[];
    fixedCharacters: number[];
    excludedCards: number[];
    singleCardOverrides: DeckSingleCardOverride[];
    limit: string;
    timeoutSeconds: string;
}

const DEFAULT_SAVED_CONFIG: SavedConfig = {
    mode: "event",
    eventId: "",
    selectedEventType: null,
    eventBonusCharacterIds: [],
    liveType: "multi",
    supportCharacterId: null,
    challengeCharacterId: null,
    musicId: "",
    difficulty: "master",
    cardConfig: DEFAULT_CARD_CONFIG,
    target: "score",
    bonusTargets: "",
    simulateEnabled: false,
    simType: "marathon",
    simAttr: "",
    simUnit: "",
    simTurn: 3,
    simCharacterId: null,
    customSubMode: "unit",
    customUnit: "light_sound",
    customCharacterIds: [],
    customCharacterUnits: {},
    customAttr: "",
    strongestTarget: "power",
    multiTeammatePower: "",
    multiTeammateScoreUp: "",
    multiScoreUpLowerBound: "",
    skillOrder: "average",
    specificSkillOrder: "",
    skillReference: "average",
    keepAfterTrainingState: false,
    bestSkillAsLeader: true,
    minimize: false,
    supportMasterMax: false,
    supportSkillMax: false,
    filterOtherUnit: false,
    boost: "",
    otherScore: "",
    fixedCards: [],
    fixedCharacters: [],
    excludedCards: [],
    singleCardOverrides: [],
    limit: "10",
    timeoutSeconds: "120",
};

function getErrorMessage(error: string, t: TranslationFn): string {
    switch (error) {
        case "USER_NOT_FOUND":
            return t("page.deckRecommend.errors.userNotFound");
        case "API_NOT_PUBLIC":
            return t("page.deckRecommend.errors.apiNotPublic");
        default:
            if (error.includes("404")) return t("page.deckRecommend.errors.userNotFound404");
            if (error.includes("403")) return t("page.deckRecommend.errors.apiNotPublic403");
            return error;
    }
}

function formatBonusValue(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function formatScoreValue(value: number): string {
    return new Intl.NumberFormat("en-US").format(Math.floor(value));
}

/** 解析目标加成输入（空格/逗号分隔的正整数，最多 32 个）。 */
function parseBonusTargets(text: string): number[] | null {
    const parts = text.split(/[\s,，]+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length > 32) return null;
    const values: number[] = [];
    for (const part of parts) {
        const value = Number.parseInt(part, 10);
        if (!Number.isFinite(value) || value <= 0) return null;
        values.push(value);
    }
    return values;
}

// ==================== Fake Progress Bar ====================
function ProgressBar({ percent, stageLabel }: { percent: number; stageLabel: string }) {
    const [displayPercent, setDisplayPercent] = useState(0);
    const targetRef = useRef(percent);

    useEffect(() => {
        targetRef.current = percent;
        let raf: number;
        const tick = () => {
            setDisplayPercent((prev) => {
                const target = targetRef.current;
                if (prev >= target) return prev;
                const next = prev + Math.max(0.2, (target - prev) * 0.08);
                return next > target ? target : next;
            });
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [percent]);

    return (
        <div className="ds-progress-container">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">{stageLabel}</span>
                <span className="text-xs font-mono text-miku font-bold">{Math.round(displayPercent)}%</span>
            </div>
            <div className="ds-progress-track">
                <div className="ds-progress-bar" style={{ width: `${displayPercent}%` }} />
            </div>
        </div>
    );
}

function Field({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
        </div>
    );
}

function SectionTitle({ text }: { text: string }) {
    return (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{text}</label>
    );
}

function usePillClass() {
    return useCallback((active: boolean) =>
        `px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${active
            ? "ios-glass-tab-active text-white shadow-lg shadow-miku/20"
            : "ios-glass-tab text-slate-600 dark:text-slate-300 hover:bg-white/60 border border-slate-200/50"}`, []);
}

// ==================== Character multi-select grid ====================
function CharacterMultiGrid({
    selected,
    onToggle,
    maxCount,
}: {
    selected: number[];
    onToggle: (id: number) => void;
    maxCount: number;
}) {
    const { t } = useI18n();
    return (
        <div className="ds-char-grid">
            {CUSTOM_CHARACTER_IDS.map((id) => {
                const active = selected.includes(id);
                const full = !active && selected.length >= maxCount;
                return (
                    <button
                        key={id}
                        type="button"
                        disabled={full}
                        onClick={() => onToggle(id)}
                        className={`ds-char-cell ${active ? "ds-char-cell-active" : ""} ${full ? "opacity-30 cursor-not-allowed" : ""}`}
                        title={getCharacterName(t, id, "full")}
                    >
                        <img src={getCharacterIconUrl(id)} alt={getCharacterName(t, id, "short")} className="w-9 h-9 rounded-full object-contain" loading="lazy" />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{id}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ==================== Song ranking panel ====================
interface MusicRankRow {
    musicId: number;
    difficulty: string;
    liveScore: number;
    eventPoint?: number;
}

function SongRankingPanel({
    rows,
    loading,
    songTitles,
}: {
    rows: MusicRankRow[] | null;
    loading: boolean;
    songTitles: Map<number, string>;
}) {
    const { t } = useI18n();
    if (loading) {
        return <p className="text-xs text-slate-400 py-2">{t("page.deckRecommend.result.songRankingLoading")}</p>;
    }
    if (!rows || rows.length === 0) {
        return <p className="text-xs text-slate-400 py-2">{t("page.deckRecommend.result.songRankingEmpty")}</p>;
    }
    return (
        <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-slate-400">
                        <th className="text-left py-1 px-1">#</th>
                        <th className="text-left py-1 px-1">{t("page.deckRecommend.result.colSong")}</th>
                        <th className="text-left py-1 px-1">{t("page.deckRecommend.result.colDifficulty")}</th>
                        <th className="text-right py-1 px-1">{t("page.deckRecommend.result.colLiveScore")}</th>
                        <th className="text-right py-1 px-1">{t("page.deckRecommend.result.colEventPoint")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.slice(0, 20).map((row, i) => {
                        return (
                            <tr key={`${row.musicId}-${row.difficulty}`} className="border-t border-slate-50 dark:border-slate-800/60">
                                <td className="py-1.5 px-1 font-bold text-slate-400">{i + 1}</td>
                                <td className="py-1.5 px-1 text-slate-600 dark:text-slate-300">
                                    {songTitles.get(row.musicId) ?? `#${row.musicId}`}
                                </td>
                                <td className="py-1.5 px-1 font-mono uppercase text-slate-500">{row.difficulty}</td>
                                <td className="py-1.5 px-1 text-right font-mono text-slate-600 dark:text-slate-300">{formatScoreValue(row.liveScore)}</td>
                                <td className="py-1.5 px-1 text-right font-bold text-miku">{row.eventPoint !== undefined ? formatScoreValue(row.eventPoint) : "-"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ==================== Single card override row ====================
function SingleCardRow({
    entry,
    cardsMaster,
    onChange,
    onRemove,
}: {
    entry: DeckSingleCardOverride;
    cardsMaster: ICardInfo[];
    onChange: (next: DeckSingleCardOverride) => void;
    onRemove: () => void;
}) {
    const { t } = useI18n();
    const master = cardsMaster.find((c) => c.id === entry.cardId);
    const maxLevel = (master as { maxLevel?: number } | undefined)?.maxLevel ?? 60;
    const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
    const label = master?.prefix ?? `#${entry.cardId}`;
    const selectCls = "ios-glass-input px-2 py-1 rounded-lg text-xs";
    return (
        <div className="flex items-center gap-2 flex-wrap py-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <div className="w-9 h-9 flex-shrink-0">
                {master && <SekaiCardThumbnail card={master} trained={false} width={36} />}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-300 w-24 truncate" title={label}>{label}</span>
            <select
                value={entry.level ?? ""}
                onChange={(e) => onChange({ ...entry, level: e.target.value ? Number(e.target.value) : undefined })}
                className={selectCls}
            >
                <option value="">{t("page.deckRecommend.config.singleCardLevelAuto")}</option>
                {levels.map((lv) => (
                    <option key={lv} value={lv}>Lv.{lv}</option>
                ))}
            </select>
            <select
                value={entry.skillLevel ?? ""}
                onChange={(e) => onChange({ ...entry, skillLevel: e.target.value ? Number(e.target.value) : undefined })}
                className={selectCls}
            >
                <option value="">{t("page.deckRecommend.config.singleCardSkillAuto")}</option>
                {[1, 2, 3, 4].map((lv) => (
                    <option key={lv} value={lv}>{t("page.deckRecommend.config.singleCardSkill")} Lv.{lv}</option>
                ))}
            </select>
            <select
                value={entry.masterRank ?? ""}
                onChange={(e) => onChange({ ...entry, masterRank: e.target.value === "" ? undefined : Number(e.target.value) })}
                className={selectCls}
            >
                <option value="">{t("page.deckRecommend.config.singleCardMasterAuto")}</option>
                {[0, 1, 2, 3, 4, 5].map((rank) => (
                    <option key={rank} value={rank}>{t("page.deckRecommend.config.singleCardMaster")} {rank}</option>
                ))}
            </select>
            <select
                value={entry.episodeReadCount ?? ""}
                onChange={(e) => onChange({ ...entry, episodeReadCount: e.target.value === "" ? undefined : Number(e.target.value) })}
                className={selectCls}
            >
                <option value="">{t("page.deckRecommend.config.singleCardEpisodeAuto")}</option>
                <option value={0}>{t("page.deckRecommend.config.episodeNone")}</option>
                <option value={1}>{t("page.deckRecommend.config.episodeFirst")}</option>
                <option value={2}>{t("page.deckRecommend.config.episodeBoth")}</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <input
                    type="checkbox"
                    className="ds-checkbox"
                    checked={entry.canvas ?? false}
                    onChange={(e) => onChange({ ...entry, canvas: e.target.checked })}
                />
                {t("page.deckRecommend.config.singleCardCanvas")}
            </label>
            <button
                type="button"
                onClick={onRemove}
                className="ml-auto text-xs text-red-400 hover:text-red-500"
            >
                {t("page.deckRecommend.config.singleCardRemove")}
            </button>
        </div>
    );
}

// ==================== Result deck row ====================
interface DeckRowProps {
    deck: DeckResultDeck;
    scoreLabel: string;
    showBonus: boolean;
    cardsMaster: ICardInfo[];
    songTitles: Map<number, string>;
    userCards: DeckUserCard[];
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    musicRows: MusicRankRow[] | null;
    musicLoading: boolean;
    onRequestMusic: () => void;
}

function DeckRow({
    deck, scoreLabel, showBonus, cardsMaster, songTitles, userCards, formatNumber,
    musicRows, musicLoading, onRequestMusic,
}: DeckRowProps) {
    const { t } = useI18n();
    const [expanded, setExpanded] = useState(false);
    const [showRanking, setShowRanking] = useState(false);

    const masterById = useMemo(() => new Map(cardsMaster.map((c) => [c.id, c])), [cardsMaster]);
    const userCardById = useMemo(() => new Map(userCards.map((u) => [u.cardId, u])), [userCards]);

    const totalPower = deck.totalPower;
    const eventBonus = deck.eventBonus ?? 0;

    const copySummary = useCallback(() => {
        const lines = [
            `#${deck.rank} ${scoreLabel}: ${formatScoreValue(deck.score)}`,
            `power: ${formatNumber(totalPower)}`,
            showBonus ? `bonus: ${formatBonusValue(eventBonus)}%` : "",
            `effective skill: ${formatBonusValue(deck.effectiveSkill)}%`,
            deck.cards.map((c, i) => {
                const name = masterById.get(c.cardId)?.prefix ?? `card ${c.cardId}`;
                return `${i === 0 ? "[L]" : "   "} ${name} (${c.cardId})`;
            }).join("\n"),
        ].filter(Boolean);
        navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
    }, [deck, scoreLabel, showBonus, eventBonus, totalPower, formatNumber, masterById]);

    return (
        <div className="ds-result-row rounded-2xl mb-3 overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left"
            >
                <div className="flex-shrink-0 w-9 text-center">
                    <div className={`ds-rank text-xl font-black ${deck.rank === 1 ? "text-miku" : "text-slate-400 dark:text-slate-500"}`}>
                        {deck.rank === 1 ? "👑" : `#${deck.rank}`}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xl sm:text-2xl font-black text-primary-text dark:text-slate-100 font-mono">
                            {formatScoreValue(deck.score)}
                        </span>
                        <span className="text-xs text-slate-400">{scoreLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        {showBonus && (
                            <span className="font-bold text-amber-500">{formatBonusValue(eventBonus)}%</span>
                        )}
                        <span>{t("page.deckRecommend.result.power")}: {formatNumber(totalPower)}</span>
                        <span>{t("page.deckRecommend.result.effectiveSkill")}: {formatBonusValue(deck.effectiveSkill)}%</span>
                    </div>
                </div>
                <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar mask-gradient-right sm:overflow-visible sm:mask-none justify-start sm:justify-end">
                    {deck.cards.slice(0, 5).map((card, i) => {
                        const masterCard = masterById.get(card.cardId);
                        const userCard = userCardById.get(card.cardId);
                        const masterRank = userCard?.masterRank ?? card.masterRank;
                        const level = userCard?.level ?? card.level;
                        const isBirthday = card.rarity === "rarity_birthday" || masterCard?.cardRarityType === "rarity_birthday";
                        const showTrained = (card.rarity === "rarity_3" || card.rarity === "rarity_4") && !isBirthday;
                        if (!masterCard) {
                            return (
                                <div key={i} className="ds-card-thumb w-10 h-10 sm:w-12 sm:h-12 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">?</div>
                            );
                        }
                        return (
                            <div key={i} className="relative flex flex-col items-center gap-0.5 flex-shrink-0">
                                <Link href={`/cards/${card.cardId}`} className="block relative" target="_blank">
                                    <span className="block w-10 h-10 sm:w-12 sm:h-12">
                                        <SekaiCardThumbnail card={masterCard} trained={showTrained} mastery={masterRank} width={48} />
                                    </span>
                                    {i === 0 && (
                                        <div className="absolute bottom-0 right-0 bg-miku/90 text-white text-[8px] font-bold px-1 py-[1px] rounded-tl-md leading-none backdrop-blur-[1px] z-10">L</div>
                                    )}
                                </Link>
                                <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-none flex items-center gap-0.5">
                                    <span>Lv.{level}</span>
                                    {masterRank > 0 && (
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-[3px] py-[1px] flex items-center gap-[1px] leading-none border border-slate-200 dark:border-slate-700">
                                            <span className="text-[8px] font-bold">{masterRank}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 hidden sm:block ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {expanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="py-2.5 flex flex-wrap items-center gap-2 sm:gap-3 text-xs border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{t("page.deckRecommend.result.liveScore")}:</span>
                            <span className="font-mono font-bold text-primary-text dark:text-slate-100">{formatNumber(deck.liveScore)}</span>
                        </div>
                        {deck.eventPoint !== undefined && (
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-2.5 py-1.5">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">{t("page.deckRecommend.result.eventPoint")}:</span>
                                <span className="font-mono font-bold text-primary-text dark:text-slate-100">{formatNumber(deck.eventPoint)}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setShowRanking((prev) => !prev);
                                if (!showRanking && musicRows === null && !musicLoading) onRequestMusic();
                            }}
                            className="ios-glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-miku"
                        >
                            {t("page.deckRecommend.result.songRanking")}
                        </button>
                        <button
                            type="button"
                            onClick={copySummary}
                            className="ios-glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-miku"
                        >
                            {t("page.deckRecommend.result.copy")}
                        </button>
                    </div>
                    {showRanking && (
                        <SongRankingPanel rows={musicRows} loading={musicLoading} songTitles={songTitles} />
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs mt-2">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="text-left py-1 px-1">{t("page.deckRecommend.result.leader")}</th>
                                    <th className="text-left py-1 px-1">{t("page.deckRecommend.result.cardId")}</th>
                                    <th className="text-left py-1 px-1">{t("page.deckRecommend.result.cardName")}</th>
                                    <th className="text-right py-1 px-1">{t("page.deckRecommend.result.power")}</th>
                                    <th className="text-right py-1 px-1">{t("page.deckRecommend.result.skill")}</th>
                                    {showBonus && <th className="text-right py-1 px-1">{t("page.deckRecommend.result.eventBonus")}</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {deck.cards.map((card, i) => {
                                    const masterCard = masterById.get(card.cardId);
                                    const cardName = masterCard?.prefix ?? getCharacterName(t, card.characterId, "short") ?? `ID:${card.characterId}`;
                                    return (
                                        <tr key={i} className="border-t border-slate-50 dark:border-slate-800/60">
                                            <td className="py-1.5 px-1 font-bold text-slate-500">{i === 0 ? t("page.deckRecommend.result.leader") : `#${i + 1}`}</td>
                                            <td className="py-1.5 px-1 font-mono text-slate-600 dark:text-slate-300">{card.cardId}</td>
                                            <td className="py-1.5 px-1 text-slate-600 dark:text-slate-300">{cardName}</td>
                                            <td className="py-1.5 px-1 text-right font-mono text-slate-600 dark:text-slate-300">{formatNumber(card.power)}</td>
                                            <td className="py-1.5 px-1 text-right text-miku font-bold">{formatBonusValue(card.skillScoreUp)}%</td>
                                            {showBonus && (
                                                <td className="py-1.5 px-1 text-right font-bold text-amber-600">
                                                    {card.eventBonus > 0 ? `${formatBonusValue(card.eventBonus)}%` : "-"}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== Main client ====================
export default function DeckRecommendClient() {
    const { t, formatNumber } = useI18n();
    const pill = usePillClass();

    // Account
    const [server, setServer] = useState<ServerType>("jp");
    const [userId, setUserId] = useState("");
    // Form state (restorable)
    const [state, setState] = useState<SavedConfig>(DEFAULT_SAVED_CONFIG);
    const patch = useCallback((partial: Partial<SavedConfig>) => {
        setState((prev) => ({ ...prev, ...partial }));
    }, []);

    const {
        mode, eventId, selectedEventType, eventBonusCharacterIds, liveType, supportCharacterId,
        challengeCharacterId, musicId, difficulty, cardConfig, target, bonusTargets,
        simulateEnabled, simType, simAttr, simUnit, simTurn, simCharacterId,
        customSubMode, customUnit, customCharacterIds, customCharacterUnits, customAttr,
        strongestTarget, multiTeammatePower, multiTeammateScoreUp, multiScoreUpLowerBound,
        skillOrder, specificSkillOrder, skillReference, keepAfterTrainingState,
        bestSkillAsLeader, minimize, boost, otherScore, fixedCards, fixedCharacters,
        excludedCards, singleCardOverrides, limit, timeoutSeconds,
    } = state;

    // 页面布局模式：快速只显示基础配置；进阶把合并后的完整配置展开置顶。
    const [layoutMode, setLayoutMode] = useState<"quick" | "advanced">("quick");
    // Run state
    const [isCalculating, setIsCalculating] = useState(false);
    const [, setProgressStage] = useState("idle");
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<DeckResultDeck[] | null>(null);
    const [userCards, setUserCards] = useState<DeckUserCard[]>([]);
    const [duration, setDuration] = useState<number | null>(null);
    const [musicByDeck, setMusicByDeck] = useState<Record<number, MusicRankRow[] | null>>({});
    const [musicLoadingByDeck, setMusicLoadingByDeck] = useState<Record<number, boolean>>({});
    const [savedHint, setSavedHint] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // Card master + music metas for result rendering
    const [cardsMaster, setCardsMaster] = useState<ICardInfo[]>([]);
    const [songTitles, setSongTitles] = useState<Map<number, string>>(new Map());
    const [cardModal, setCardModal] = useState<null | "fixed" | "excluded" | "single">(null);
    const [showLeaderSelect, setShowLeaderSelect] = useState(false);
    const [leaderCharacterId, setLeaderCharacterId] = useState<number | null>(null);

    // 卡名与缩略图必须与账号数据同区服：站点默认数据库区服不一定等于所选账号区服。
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetchMasterDataForServer<ICardInfo[]>(server, "cards.json"),
            fetchMasterDataForServer<IMusicInfo[]>(server, "musics.json"),
        ])
            .then(([cards, musics]) => {
                if (cancelled) return;
                setCardsMaster(cards);
                setSongTitles(new Map(musics.map((m) => [m.id, m.title])));
            })
            .catch(console.error);
        return () => {
            cancelled = true;
        };
    }, [server]);

    // Warm the wasm cache
    useEffect(() => {
        preloadDeckEngine();
    }, []);

    // Restore last used account + saved config
    useEffect(() => {
        const storedServer = localStorage.getItem(SERVER_STORAGE_KEY);
        const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
        const savedConfig = localStorage.getItem(SAVED_CONFIG_KEY);
        let restored: Partial<SavedConfig> | null = null;
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig) as Partial<SavedConfig>;
                restored = { ...parsed, cardConfig: { ...DEFAULT_CARD_CONFIG, ...(parsed.cardConfig ?? {}) } };
            } catch {
                // ignore broken config
            }
        }
        queueMicrotask(() => {
            if (storedServer && isValidServer(storedServer)) setServer(storedServer);
            if (storedUserId) setUserId(storedUserId);
            if (restored) setState((prev) => ({ ...prev, ...restored }));
        });
    }, []);

    const selectedWl3Simulation: Wl3SimulationGroup | null = useMemo(
        () => getWl3SimulationGroupByEventId(eventId),
        [eventId],
    );

    // Clear support char when it no longer belongs to the current bonus set
    useEffect(() => {
        if (supportCharacterId === null || supportCharacterId <= 0) return;
        const allowed: readonly number[] | null = selectedWl3Simulation
            ? (selectedWl3Simulation.members as readonly number[])
            : selectedEventType === "world_bloom"
                ? eventBonusCharacterIds
                : null;
        if (allowed && !allowed.includes(supportCharacterId)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            patch({ supportCharacterId: 0 });
        }
    }, [selectedWl3Simulation, selectedEventType, eventBonusCharacterIds, supportCharacterId, patch]);

    const needsMusic = mode !== "mysekai" && mode !== "weakest";
    const needsEvent = mode === "event" || mode === "mysekai";
    const needsLiveType = mode === "event" || mode === "custom" || mode === "strongest";

    const scoreLabel = useMemo(() => {
        if (mode === "mysekai") return t("page.deckRecommend.scoreLabels.mysekai");
        if (mode === "challenge") return t("page.deckRecommend.scoreLabels.challenge");
        if (mode === "weakest") return t("page.deckRecommend.scoreLabels.power");
        if (mode === "strongest") {
            return strongestTarget === "skill"
                ? t("page.deckRecommend.scoreLabels.effectiveSkill")
                : t("page.deckRecommend.scoreLabels.power");
        }
        if (mode === "event" && target === "power") return t("page.deckRecommend.scoreLabels.power");
        if (mode === "event" && target === "bonus") return t("page.deckRecommend.scoreLabels.bonus");
        return t("page.deckRecommend.scoreLabels.pt");
    }, [mode, strongestTarget, target, t]);

    const updateCardConfig = useCallback((key: string, field: keyof DeckTrainingConfig, value: boolean) => {
        setState((prev) => ({
            ...prev,
            cardConfig: { ...prev.cardConfig, [key]: { ...prev.cardConfig[key], [field]: value } },
        }));
    }, []);

    // EventSelector 回调保持引用稳定；bonus characters 用等值短路防止 effect 循环。
    const handleEventSelect = useCallback((id: string, eventType?: string) => {
        setState((prev) => ({
            ...prev,
            eventId: id,
            selectedEventType: eventType !== undefined ? eventType : prev.selectedEventType,
        }));
    }, []);

    const handleEventTypeChange = useCallback((eventType: string | null) => {
        setState((prev) => ({
            ...prev,
            selectedEventType: eventType,
            supportCharacterId: eventType !== "world_bloom" ? 0 : prev.supportCharacterId,
        }));
    }, []);

    const handleBonusCharacters = useCallback((ids: number[]) => {
        setState((prev) =>
            prev.eventBonusCharacterIds === ids ||
            (prev.eventBonusCharacterIds.length === ids.length &&
                prev.eventBonusCharacterIds.every((v, i) => v === ids[i]))
                ? prev
                : { ...prev, eventBonusCharacterIds: ids },
        );
    }, []);

    const handleSaveConfig = useCallback(() => {
        localStorage.setItem(SAVED_CONFIG_KEY, JSON.stringify(state));
        setSavedHint(true);
        setTimeout(() => setSavedHint(false), 1500);
    }, [state]);

    const handleClearConfig = useCallback(() => {
        localStorage.removeItem(SAVED_CONFIG_KEY);
        setState(DEFAULT_SAVED_CONFIG);
    }, []);

    const handleCalculate = () => {
        if (!userId.trim()) { setError(t("page.deckRecommend.errors.userRequired")); return; }
        if (needsMusic && !musicId) { setError(t("page.deckRecommend.errors.musicRequired")); return; }
        if (needsEvent && mode === "event" && !simulateEnabled && !eventId.trim()) { setError(t("page.deckRecommend.errors.eventRequired")); return; }
        if (mode === "mysekai" && !eventId.trim()) { setError(t("page.deckRecommend.errors.eventRequired")); return; }
        if (mode === "challenge" && !challengeCharacterId) { setError(t("page.deckRecommend.errors.characterRequired")); return; }
        if (mode === "custom" && customSubMode === "character" && customCharacterIds.length === 0) {
            setError(t("page.deckRecommend.errors.customCharactersRequired"));
            return;
        }
        if (mode === "event" && !simulateEnabled && !selectedWl3Simulation && selectedEventType === "world_bloom" && (supportCharacterId === null || supportCharacterId <= 0)) {
            setError(t("page.deckRecommend.errors.supportCharacterRequired"));
            return;
        }
        if (mode === "event" && simulateEnabled && simType === "world_bloom" && simTurn === 3 && (simCharacterId === null || simCharacterId <= 0)) {
            setError(t("page.deckRecommend.errors.supportCharacterRequired"));
            return;
        }
        if (mode === "event" && simulateEnabled && simType === "world_bloom" && simTurn !== 3 && !simUnit) {
            setError(t("page.deckRecommend.errors.simulateUnitRequired"));
            return;
        }
        const parsedBonus = mode === "event" && target === "bonus" ? parseBonusTargets(bonusTargets) : null;
        if (mode === "event" && target === "bonus") {
            if (parsedBonus === null) {
                setError(t("page.deckRecommend.errors.bonusTargetsInvalid"));
                return;
            }
        }

        setError(null);
        setResults(null);
        setDuration(null);
        setMusicByDeck({});
        setMusicLoadingByDeck({});
        setIsCalculating(true);
        setProgressPercent(5);
        setProgressLabel(t("page.deckRecommend.progress.fetchingUserData"));

        const workerArgs = {
            mode,
            userId: userId.trim(),
            server,
            eventId: eventId ? parseInt(eventId) : undefined,
            eventType: selectedEventType ?? undefined,
            simulatedEvent: mode === "event" && simulateEnabled
                ? {
                      eventType: simType,
                      attr: simAttr || undefined,
                      unit: simUnit || undefined,
                      worldBloomTurn: simType === "world_bloom" ? simTurn : undefined,
                      worldBloomCharacterId:
                          simType === "world_bloom" && simTurn === 3 ? simCharacterId ?? undefined : undefined,
                  }
                : undefined,
            liveType,
            supportCharacterId: supportCharacterId || undefined,
            challengeCharacterId: challengeCharacterId || undefined,
            musicId: musicId ? parseInt(musicId) : 0,
            difficulty,
            cardConfig,
            target: mode === "event" ? target : undefined,
            bonusTargets: parsedBonus ?? undefined,
            customUnit: mode === "custom" && customSubMode === "unit" ? customUnit : undefined,
            customCharacterIds: mode === "custom" && customSubMode === "character" ? customCharacterIds : undefined,
            customCharacterUnits: mode === "custom" && customSubMode === "character" ? customCharacterUnits : undefined,
            customAttr: mode === "custom" && customAttr ? customAttr : undefined,
            strongestTarget: mode === "strongest" || mode === "weakest" ? "power" : undefined,

            multiTeammatePower: multiTeammatePower ? parseInt(multiTeammatePower) : undefined,
            multiTeammateScoreUp: multiTeammateScoreUp ? parseInt(multiTeammateScoreUp) : undefined,
            multiScoreUpLowerBound: multiScoreUpLowerBound ? parseFloat(multiScoreUpLowerBound) : undefined,
            skillOrder,
            specificSkillOrder: skillOrder === "specific" ? specificSkillOrder : undefined,
            skillReference,
            keepAfterTrainingState: keepAfterTrainingState || undefined,
            bestSkillAsLeader,
            supportMasterMax: state.supportMasterMax || undefined,
            supportSkillMax: state.supportSkillMax || undefined,
            filterOtherUnit: state.filterOtherUnit || undefined,
            minimize: (minimize || mode === "weakest") || undefined,
            boost: boost !== "" ? parseInt(boost) : undefined,
            otherScore: otherScore ? parseInt(otherScore) : undefined,
            fixedCards: fixedCards.length ? fixedCards : undefined,
            fixedCharacters: fixedCharacters.length ? fixedCharacters : undefined,
            excludedCards: excludedCards.length ? excludedCards : undefined,
            singleCardOverrides: singleCardOverrides.length ? singleCardOverrides : undefined,
            leaderCharacterId: showLeaderSelect && leaderCharacterId ? leaderCharacterId : undefined,
            limit: Math.min(30, Math.max(1, parseInt(limit) || 10)),
            timeoutMs: Math.min(300, Math.max(5, parseInt(timeoutSeconds) || 120)) * 1000,
        };

        if (workerRef.current) workerRef.current.terminate();
        const worker = new Worker(new URL("@/lib/deck-recommend/engine-worker.ts", import.meta.url));
        workerRef.current = worker;

        type WorkerMessage =
            | DeckWorkerOutput
            | { type: "music"; requestId: number; rows: MusicRankRow[] };
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const data = event.data;
            if (data.type === "progress") {
                setProgressStage(data.stage);
                setProgressPercent(data.percent);
                setProgressLabel(data.progressKey ? t(data.progressKey) : data.stageLabel ?? "");
                return;
            }
            if (data.type === "music") {
                const deckRank = data.requestId ?? 0;
                setMusicLoadingByDeck((prev) => ({ ...prev, [deckRank]: false }));
                setMusicByDeck((prev) => ({ ...prev, [deckRank]: data.rows ?? [] }));
                return;
            }
            if (data.error) {
                setError(getErrorMessage(data.error, t));
            } else {
                setResults(data.result ?? []);
                if (data.userCards) setUserCards(data.userCards);
                setDuration(data.duration ?? null);
            }
            setIsCalculating(false);
            setProgressPercent(0);
            // worker 保留给单曲收益查询；下次计算时再 terminate
        };
        worker.onerror = (err) => {
            setError(t("page.deckRecommend.errors.workerError", { message: err.message }));
            setIsCalculating(false);
            setProgressPercent(0);
            worker.terminate();
            workerRef.current = null;
        };
        const oauthAccessToken = getOAuthAccessTokenForGameUser(server, userId.trim());
        worker.postMessage({ args: { ...workerArgs, oauthAccessToken } });
    };

    const handleCancel = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setIsCalculating(false);
        setProgressPercent(0);
    }, []);

    const requestMusic = (deck: DeckResultDeck) => {
        const worker = workerRef.current;
        if (!worker || musicLoadingByDeck[deck.rank]) return;
        setMusicLoadingByDeck((prev) => ({ ...prev, [deck.rank]: true }));
        // 音乐推荐不需要用户数据，但 UI 用 rank 关联面板；requestId 即 rank。
        worker.postMessage({
            music: {
                requestId: deck.rank,
                liveType,
                eventType: selectedEventType ?? undefined,
                teammates: {
                    power: multiTeammatePower ? parseInt(multiTeammatePower) : undefined,
                    scoreUp: multiTeammateScoreUp ? parseInt(multiTeammateScoreUp) : undefined,
                },
                deck: {
                    totalPower: deck.totalPower,
                    eventBonusRate: deck.eventBonus ?? 0,
                    supportDeckBonusRate: 0,
                    cards: deck.cards.map((c) => ({ skillScoreUp: c.skillScoreUp, skillLifeRecovery: 0 })),
                },
            },
        });
    };

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.deckRecommend.badge")}</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text dark:text-slate-100">
                        {t("page.deckRecommend.title")}<span className="text-miku">{t("page.deckRecommend.titleHighlight")}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                        {t("page.deckRecommend.description")}
                    </p>
                </div>

                {/* 布局模式切换 */}
                <div className="flex justify-center gap-2 mb-6">
                    {(["quick", "advanced"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setLayoutMode(option)}
                            className={`${pill(layoutMode === option)} min-w-32`}
                        >
                            {t(`page.deckRecommend.layout.${option}`)}
                        </button>
                    ))}
                </div>

                {/* Account */}
                <div className="ios-glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <h2 className="text-lg font-bold text-primary-text dark:text-slate-100 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-miku rounded-full" />
                            {t("page.deckRecommend.account.title")}
                        </h2>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleSaveConfig} className="ios-glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-miku">
                                {savedHint ? t("page.deckRecommend.config.saved") : t("page.deckRecommend.config.save")}
                            </button>
                            <button type="button" onClick={handleClearConfig} className="ios-glass-btn rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400">
                                {t("page.deckRecommend.config.clear")}
                            </button>
                        </div>
                    </div>
                    <AccountSelector
                        onSelect={(gameId, srv) => {
                            setUserId(gameId);
                            setServer(srv);
                            localStorage.setItem(USER_ID_STORAGE_KEY, gameId);
                            localStorage.setItem(SERVER_STORAGE_KEY, srv);
                        }}
                        currentUserId={userId}
                        currentServer={server}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-1">
                        <div>
                            <SectionTitle text={t("page.deckRecommend.account.server")} />
                            <div className="flex flex-wrap gap-2">
                                {SERVER_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setServer(option.value);
                                            localStorage.setItem(SERVER_STORAGE_KEY, option.value);
                                        }}
                                        className={pill(server === option.value)}
                                    >
                                        {t(option.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <SectionTitle text={t("page.deckRecommend.account.userId")} />
                            <input
                                type="text"
                                value={userId}
                                onChange={(e) => {
                                    setUserId(e.target.value);
                                    localStorage.setItem(USER_ID_STORAGE_KEY, e.target.value);
                                }}
                                placeholder={t("page.deckRecommend.account.userIdPlaceholder")}
                                className="ios-glass-input w-full px-4 py-2.5 rounded-lg transition-all text-sm"
                            />
                            <p className="text-xs text-slate-400 mt-1.5">{t("page.deckRecommend.account.userIdHint")}</p>
                        </div>
                    </div>
                </div>

                {/* 进阶模式：合并后的完整配置（全部展开、置顶） */}
                {layoutMode === "advanced" && (
                    <div className="ios-glass-card p-5 sm:p-6 rounded-2xl mb-6">
                        <h2 className="text-lg font-bold text-primary-text dark:text-slate-100 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-miku rounded-full" />
                            {t("page.deckRecommend.config.layers.advanced")}
                        </h2>
                    <div className="pt-1">
                        {/* 协力参数 */}
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.multiLiveTitle")} />
                            <p className="text-xs text-slate-400 mb-3">{t("page.deckRecommend.config.multiLiveDesc")}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label={t("page.deckRecommend.config.teammatePower")} hint={t("page.deckRecommend.config.followSelfPlaceholder")}>
                                    <input type="number" min={0} value={multiTeammatePower} onChange={(e) => patch({ multiTeammatePower: e.target.value })} className="ds-field-input" />
                                </Field>
                                <Field label={t("page.deckRecommend.config.teammateScoreUp")} hint={t("page.deckRecommend.config.followSelfPlaceholder")}>
                                    <input type="number" min={0} value={multiTeammateScoreUp} onChange={(e) => patch({ multiTeammateScoreUp: e.target.value })} className="ds-field-input" />
                                </Field>
                                <Field label={t("page.deckRecommend.config.scoreUpLowerBound")} hint={t("page.deckRecommend.config.noLimit")}>
                                    <input type="number" min={0} value={multiScoreUpLowerBound} onChange={(e) => patch({ multiScoreUpLowerBound: e.target.value })} className="ds-field-input" />
                                </Field>
                            </div>
                        </div>

                        {/* 体力消耗 / 协力对手分数 */}
                        <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={t("page.deckRecommend.config.boost")} hint={t("page.deckRecommend.config.boostHint")}>
                                <input type="number" min={0} max={10} value={boost} onChange={(e) => patch({ boost: e.target.value })} className="ds-field-input" />
                            </Field>
                            <Field label={t("page.deckRecommend.config.otherScore")} hint={t("page.deckRecommend.config.otherScoreHint")}>
                                <input type="number" min={0} value={otherScore} onChange={(e) => patch({ otherScore: e.target.value })} className="ds-field-input" />
                            </Field>
                        </div>

                        {/* 引擎参数 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label={t("page.deckRecommend.config.advanced.limit")}>
                                <input type="number" min={1} max={30} value={limit} onChange={(e) => patch({ limit: e.target.value })} className="ds-field-input" />
                            </Field>
                            <Field label={t("page.deckRecommend.config.advanced.timeout")}>
                                <input type="number" min={5} max={300} value={timeoutSeconds} onChange={(e) => patch({ timeoutSeconds: e.target.value })} className="ds-field-input" />
                            </Field>
                        </div>
                    </div>


                        <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                        {/* 技能与支援 */}
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.skillsTitle")} />
                            <label className="block text-xs text-slate-400 mb-1.5">{t("page.deckRecommend.config.skillOrder")}</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(["average", "max", "min", "specific"] as const).map((option) => (
                                    <button key={option} type="button" onClick={() => patch({ skillOrder: option })} className={`${pill(skillOrder === option)} !px-3 !py-1.5 text-xs`}>
                                        {t(`page.deckRecommend.config.skillOrders.${option}`)}
                                    </button>
                                ))}
                            </div>
                            {skillOrder === "specific" && (
                                <div className="mb-3 max-w-xs">
                                    <input
                                        type="text"
                                        value={specificSkillOrder}
                                        onChange={(e) => patch({ specificSkillOrder: e.target.value })}
                                        placeholder={t("page.deckRecommend.config.specificSkillOrderPlaceholder")}
                                        className="ios-glass-input w-full px-3 py-2 rounded-lg text-sm"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{t("page.deckRecommend.config.specificSkillOrderHint")}</p>
                                </div>
                            )}
                            <label className="block text-xs text-slate-400 mb-1.5">{t("page.deckRecommend.config.skillReference")}</label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(["average", "max", "min"] as const).map((option) => (
                                    <button key={option} type="button" onClick={() => patch({ skillReference: option })} className={`${pill(skillReference === option)} !px-3 !py-1.5 text-xs`}>
                                        {t(`page.deckRecommend.config.skillReferences.${option}`)}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(["keepAfterTrainingState", "bestSkillAsLeader"] as const).map((typedKey) => (
                                    <label key={typedKey} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-3 py-2">
                                        <span>{t(`page.deckRecommend.config.${typedKey}`)}</span>
                                        <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${state[typedKey] ? "bg-miku" : "bg-slate-200 dark:bg-slate-700"}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${state[typedKey] ? "translate-x-4" : ""}`} />
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={state[typedKey]}
                                            onChange={(e) => patch({ [typedKey]: e.target.checked })}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 连接世界支援 */}
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.supportGroupTitle")} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {(["supportMasterMax", "supportSkillMax", "filterOtherUnit"] as const).map((typedKey) => (
                                    <label key={typedKey} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-3 py-2">
                                        <span>{t(`page.deckRecommend.config.${typedKey}`)}</span>
                                        <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${state[typedKey] ? "bg-miku" : "bg-slate-200 dark:bg-slate-700"}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${state[typedKey] ? "translate-x-4" : ""}`} />
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={state[typedKey]}
                                            onChange={(e) => patch({ [typedKey]: e.target.checked })}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 卡组约束 */}
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.constraintsTitle")} />
                            <p className="text-xs text-slate-400 mb-2">{t("page.deckRecommend.config.constraintsHint")}</p>
                            {([["fixedCards", "fixedCards", "fixed"], ["excludedCards", "excludedCards", "excluded"]] as const).map(([key, label, modalKey]) => {
                                const typedKey = key as "fixedCards" | "excludedCards";
                                const list = state[typedKey];
                                return (
                                    <div key={key} className="mb-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs text-slate-400">{t(`page.deckRecommend.config.${label}`)}</label>
                                            <button type="button" onClick={() => setCardModal(modalKey)} className="text-xs text-miku font-medium hover:underline">
                                                + {t("page.deckRecommend.config.addCard")}
                                            </button>
                                        </div>
                                        {list.length === 0 ? (
                                            <p className="text-xs text-slate-300 dark:text-slate-600">{t("page.deckRecommend.config.noneSelected")}</p>
                                        ) : (
                                            <div className="flex gap-1.5 flex-wrap">
                                                {list.map((cardId) => {
                                                    const master = cardsMaster.find((c) => c.id === cardId);
                                                    return (
                                                        <button
                                                            key={cardId}
                                                            type="button"
                                                            title={`${t("page.deckRecommend.config.singleCardRemove")}: ${master?.prefix ?? cardId}`}
                                                            onClick={() => patch({ [typedKey]: list.filter((v) => v !== cardId) } as Partial<SavedConfig>)}
                                                            className="relative rounded-lg overflow-hidden hover:opacity-70 transition-opacity"
                                                        >
                                                            {master ? <SekaiCardThumbnail card={master} trained={false} width={40} /> : <span className="text-xs">#{cardId}</span>}
                                                            <span className="absolute top-0 right-0 bg-red-400 text-white text-[8px] w-3.5 h-3.5 rounded-bl flex items-center justify-center">×</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {/* 指定队长 */}
                            <div className="mb-3">
                                <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-lg px-3 py-2">
                                    <span>{t("page.deckRecommend.config.leaderTitle")}</span>
                                    <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${showLeaderSelect ? "bg-miku" : "bg-slate-200 dark:bg-slate-700"}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showLeaderSelect ? "translate-x-4" : ""}`} />
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={showLeaderSelect}
                                        onChange={(e) => {
                                            setShowLeaderSelect(e.target.checked);
                                            if (!e.target.checked) setLeaderCharacterId(null);
                                        }}
                                    />
                                </label>
                                {showLeaderSelect && (
                                    <div className="mt-2">
                                        <CharacterSelector selectedCharacterId={leaderCharacterId} onSelect={setLeaderCharacterId} />
                                    </div>
                                )}
                            </div>

                            {/* 固定角色 */}
                            <div>
                                <label className="text-xs text-slate-400 mb-1.5 block">{t("page.deckRecommend.config.fixedCharacters")}</label>
                                {fixedCharacters.length === 0 ? (
                                    <p className="text-xs text-slate-300 dark:text-slate-600">{t("page.deckRecommend.config.noneSelected")}</p>
                                ) : (
                                    <div className="flex gap-1.5 flex-wrap mb-2">
                                        {fixedCharacters.map((id) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => patch({ fixedCharacters: fixedCharacters.filter((v) => v !== id) })}
                                                className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full pl-1 pr-2 py-0.5 hover:opacity-70"
                                            >
                                                <img src={getCharacterIconUrl(id)} alt="" className="w-6 h-6 rounded-full object-contain" loading="lazy" />
                                                <span className="text-xs text-slate-500 dark:text-slate-300">{getCharacterName(t, id, "short")}</span>
                                                <span className="text-red-400 text-xs">×</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <CharacterMultiGrid
                                    selected={fixedCharacters}
                                    onToggle={(id) => {
                                        setState((prev) => ({
                                            ...prev,
                                            fixedCharacters: prev.fixedCharacters.includes(id)
                                                ? prev.fixedCharacters.filter((v) => v !== id)
                                                : prev.fixedCharacters.length >= 5
                                                    ? prev.fixedCharacters
                                                    : [...prev.fixedCharacters, id].sort((a, b) => a - b),
                                        }));
                                    }}
                                    maxCount={5}
                                />
                            </div>
                        </div>

                        {/* 单卡养成覆盖 */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <SectionTitle text={t("page.deckRecommend.config.singleCardTitle")} />
                                <button type="button" onClick={() => setCardModal("single")} className="text-xs text-miku font-medium hover:underline">
                                    + {t("page.deckRecommend.config.singleCardAdd")}
                                </button>
                            </div>
                            {singleCardOverrides.length === 0 ? (
                                <p className="text-xs text-slate-300 dark:text-slate-600">{t("page.deckRecommend.config.singleCardEmpty")}</p>
                            ) : (
                                <div>
                                    {singleCardOverrides.map((entry) => (
                                        <SingleCardRow
                                            key={entry.cardId}
                                            entry={entry}
                                            cardsMaster={cardsMaster}
                                            onChange={(next) =>
                                                setState((prev) => ({
                                                    ...prev,
                                                    singleCardOverrides: prev.singleCardOverrides.map((e) => (e.cardId === next.cardId ? next : e)),
                                                }))
                                            }
                                            onRemove={() =>
                                                setState((prev) => ({
                                                    ...prev,
                                                    singleCardOverrides: prev.singleCardOverrides.filter((e) => e.cardId !== entry.cardId),
                                                }))
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                )}

                {/* Mode tabs */}
                <div className="flex flex-wrap gap-2 mb-6 justify-center">
                    {MODE_OPTIONS
                        .filter((option) => layoutMode === "quick" || option.value !== "weakest")
                        .map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => patch({ mode: option.value })}
                            className={`${pill(mode === option.value)} min-w-24`}
                        >
                            {t(`page.deckRecommend.modes.${option.value}`)}
                        </button>
                    ))}
                </div>

                {/* Config card */}
                <div className="ios-glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    {/* ============ 默认配置 ============ */}
                    {/* 挑战组卡 */}
                    {mode === "challenge" && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.challengeTitle")} />
                            <CharacterSelector
                                selectedCharacterId={challengeCharacterId}
                                onSelect={(id) => patch({ challengeCharacterId: id })}
                            />
                            <div className="mt-3">
                                <SectionTitle text={t("page.deckRecommend.config.challengeLiveType")} />
                                <div className="flex gap-2">
                                    {CHALLENGE_LIVE_OPTIONS.map((option) => (
                                        <button key={option} type="button" onClick={() => patch({ liveType: option })} className={pill(liveType === option)}>
                                            {t(`page.deckRecommend.config.challengeLiveTypes.${option}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 活动选择 / 模拟活动 */}
                    {mode === "event" && (
                        <div className="mb-5">
                            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                                <SectionTitle text={simulateEnabled ? t("page.deckRecommend.config.simulateTitle") : t("page.deckRecommend.config.eventTitle")} />
                                <button
                                    type="button"
                                    onClick={() => patch({ simulateEnabled: !simulateEnabled })}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${simulateEnabled ? "bg-miku" : "bg-slate-200 dark:bg-slate-700"}`}
                                    title={t("page.deckRecommend.config.simulateDesc")}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${simulateEnabled ? "translate-x-5" : ""}`} />
                                </button>
                            </div>
                            {simulateEnabled ? (
                                <div className="border border-miku/30 bg-miku/5 rounded-xl p-4">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t("page.deckRecommend.config.simulateDesc")}</p>
                                    <SectionTitle text={t("page.deckRecommend.config.simulateType")} />
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {SIM_EVENT_TYPE_OPTIONS.map((option) => (
                                            <button key={option} type="button" onClick={() => patch({ simType: option })} className={pill(simType === option)}>
                                                {t(`page.deckRecommend.config.eventTypes.${option === "cheerful_carnival" ? "cheerful" : option}`)}
                                            </button>
                                        ))}
                                    </div>
                                    {simType === "world_bloom" ? (
                                        <div className="mb-3">
                                            <SectionTitle text={t("page.deckRecommend.config.simulateTurn")} />
                                            <div className="flex gap-2 mb-3">
                                                {[1, 2, 3].map((turn) => (
                                                    <button key={turn} type="button" onClick={() => patch({ simTurn: turn })} className={pill(simTurn === turn)}>
                                                        {t("page.deckRecommend.config.simulateTurnOption", { turn: String(turn) })}
                                                    </button>
                                                ))}
                                            </div>
                                            {simTurn !== 3 ? (
                                                <div>
                                                    <SectionTitle text={t("page.deckRecommend.config.simulateUnit")} />
                                                    <div className="flex flex-wrap gap-2">
                                                        {UNIT_BONUS_OPTIONS.map((unit) => (
                                                            <button
                                                                key={unit.value}
                                                                type="button"
                                                                onClick={() => patch({ simUnit: unit.value })}
                                                                className={`flex items-center gap-1.5 ${pill(simUnit === unit.value)}`}
                                                            >
                                                                <Image src={`/data/icon/${unit.icon}`} alt={t(unit.labelKey)} width={16} height={16} className="object-contain" />
                                                                {t(unit.labelKey)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <SectionTitle text={t("page.deckRecommend.config.simulateCharacter")} />
                                                    <CharacterSelector
                                                        selectedCharacterId={simCharacterId}
                                                        onSelect={(id) => patch({ simCharacterId: id })}
                                                        hideUnitFilter
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <SectionTitle text={t("page.deckRecommend.config.simulateAttr")} />
                                            <div className="flex flex-wrap gap-2">
                                                {ATTR_OPTIONS.map((attr) => (
                                                    <button
                                                        key={attr.value}
                                                        type="button"
                                                        onClick={() => patch({ simAttr: simAttr === attr.value ? "" : attr.value })}
                                                        className={`flex items-center gap-1.5 ${pill(simAttr === attr.value)}`}
                                                    >
                                                        <Image src={`/data/icon/${attr.icon}`} alt={attr.label} width={16} height={16} className="object-contain" />
                                                        {attr.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <EventSelector
                                        selectedEventId={eventId}
                                        onSelect={handleEventSelect}
                                        onEventTypeChange={handleEventTypeChange}
                                        onBonusCharactersChange={handleBonusCharacters}
                                    />
                                    {selectedWl3Simulation && (
                                        <p className="text-xs text-miku mt-2 font-medium">
                                            {t("page.deckRecommend.config.wl3Hint", { group: String(selectedWl3Simulation.groupId) })}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {mode === "mysekai" && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.eventTitle")} />
                            <EventSelector
                                selectedEventId={eventId}
                                onSelect={handleEventSelect}
                            />
                        </div>
                    )}

                    {/* 连接世界章节角色 */}
                    {mode === "event" && !simulateEnabled && selectedEventType === "world_bloom" && (
                        <div className="mb-5">
                            <SectionTitle
                                text={selectedWl3Simulation
                                    ? t("page.deckRecommend.config.wl3Chapter")
                                    : t("page.deckRecommend.config.wlChapter")}
                            />
                            <CharacterSelector
                                selectedCharacterId={supportCharacterId}
                                onSelect={(id) => patch({ supportCharacterId: id })}
                                availableCharacterIds={
                                    selectedWl3Simulation
                                        ? (selectedWl3Simulation.members as readonly number[])
                                        : eventBonusCharacterIds.length
                                            ? eventBonusCharacterIds
                                            : undefined
                                }
                                hideUnitFilter
                            />
                        </div>
                    )}

                    {/* 最弱组卡：无参数直接组卡 */}
                    {mode === "weakest" && (
                        <div className="mb-5">
                            <div className="border border-miku/30 bg-miku/5 rounded-xl p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    {t("page.deckRecommend.config.weakestHint")}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 自定义加成 */}
                    {mode === "custom" && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.customTitle")} />
                            <div className="flex gap-2 mb-4">
                                <button type="button" onClick={() => patch({ customSubMode: "unit" })} className={pill(customSubMode === "unit")}>
                                    {t("page.deckRecommend.config.customSubMode.unit")}
                                </button>
                                <button type="button" onClick={() => patch({ customSubMode: "character" })} className={pill(customSubMode === "character")}>
                                    {t("page.deckRecommend.config.customSubMode.character")}
                                </button>
                            </div>
                            {customSubMode === "unit" ? (
                                <div>
                                    <SectionTitle text={t("page.deckRecommend.config.customUnit")} />
                                    <div className="flex flex-wrap gap-2">
                                        {UNIT_BONUS_OPTIONS.map((unit) => (
                                            <button
                                                key={unit.value}
                                                type="button"
                                                onClick={() => patch({ customUnit: unit.value })}
                                                className={`flex items-center gap-1.5 ${pill(customUnit === unit.value)}`}
                                            >
                                                <Image src={`/data/icon/${unit.icon}`} alt={t(unit.labelKey)} width={16} height={16} className="object-contain" />
                                                {t(unit.labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <SectionTitle text={t("page.deckRecommend.config.customCharacters")} />
                                    <p className="text-xs text-slate-400 mb-2">{t("page.deckRecommend.config.customCharactersHint")}</p>
                                    <CharacterMultiGrid
                                        selected={customCharacterIds}
                                        onToggle={(id) => {
                                            setState((prev) => {
                                                const next = prev.customCharacterIds.includes(id)
                                                    ? prev.customCharacterIds.filter((v) => v !== id)
                                                    : prev.customCharacterIds.length >= 5
                                                        ? prev.customCharacterIds
                                                        : [...prev.customCharacterIds, id].sort((a, b) => a - b);
                                                const units = { ...prev.customCharacterUnits };
                                                if (!next.includes(id)) delete units[id];
                                                return { ...prev, customCharacterIds: next, customCharacterUnits: units };
                                            });
                                        }}
                                        maxCount={5}
                                    />
                                    {customCharacterIds.some((id) => id >= VIRTUAL_SINGER_ID_MIN) && (
                                        <div className="mt-4 space-y-2">
                                            {customCharacterIds.filter((id) => id >= VIRTUAL_SINGER_ID_MIN).map((id) => (
                                                <div key={id} className="flex items-center gap-2 flex-wrap">
                                                    <img src={getCharacterIconUrl(id)} alt="" className="w-7 h-7 rounded-full object-contain" loading="lazy" />
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium w-28">
                                                        {getCharacterName(t, id, "short")}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {UNIT_BONUS_OPTIONS.map((unit) => (
                                                            <button
                                                                key={unit.value}
                                                                type="button"
                                                                onClick={() =>
                                                                    setState((prev) => {
                                                                        const units = { ...prev.customCharacterUnits };
                                                                        if (units[id] === unit.value) delete units[id];
                                                                        else units[id] = unit.value;
                                                                        return { ...prev, customCharacterUnits: units };
                                                                    })
                                                                }
                                                                className={`px-2 py-1 rounded-lg text-xs transition-all ${customCharacterUnits[id] === unit.value
                                                                    ? "bg-miku text-white shadow-md shadow-miku/20"
                                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                                                            >
                                                                {t(unit.labelKey)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="mt-4">
                                <SectionTitle text={t("page.deckRecommend.config.customAttr")} />
                                <div className="flex flex-wrap gap-2">
                                    {ATTR_OPTIONS.map((attr) => (
                                        <button
                                            key={attr.value}
                                            type="button"
                                            onClick={() => patch({ customAttr: customAttr === attr.value ? "" : attr.value })}
                                            className={`flex items-center gap-1.5 ${pill(customAttr === attr.value)}`}
                                        >
                                            <Image src={`/data/icon/${attr.icon}`} alt={attr.label} width={16} height={16} className="object-contain" />
                                            {attr.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Live 类型 */}
                    {needsLiveType && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.liveType")} />
                            <div className="flex flex-wrap gap-2">
                                {LIVE_TYPE_OPTIONS.map((option) => (
                                    <button key={option} type="button" onClick={() => patch({ liveType: option })} className={pill(liveType === option)}>
                                        {t(`page.deckRecommend.liveTypes.${option}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 最强组卡目标 */}
                    {mode === "strongest" && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.strongestTarget")} />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => patch({ strongestTarget: "power", minimize: false })}
                                    className={pill(strongestTarget === "power" && !minimize)}
                                >
                                    {t("page.deckRecommend.config.strongestPower")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patch({ strongestTarget: "skill", minimize: false })}
                                    className={pill(strongestTarget === "skill")}
                                >
                                    {t("page.deckRecommend.config.strongestSkill")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 组卡目标 */}
                    {mode === "event" && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.targetTitle")} />
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(["score", "power", "bonus"] as const).map((option) => (
                                    <button key={option} type="button" onClick={() => patch({ target: option })} className={pill(target === option)}>
                                        {t(`page.deckRecommend.config.targets.${option}`)}
                                    </button>
                                ))}
                            </div>
                            {target === "bonus" && (
                                <div>
                                    <input
                                        type="text"
                                        value={bonusTargets}
                                        onChange={(e) => patch({ bonusTargets: e.target.value })}
                                        placeholder={t("page.deckRecommend.config.bonusTargetsPlaceholder")}
                                        className="ios-glass-input w-full max-w-sm px-3 py-2 rounded-lg text-sm"
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5">{t("page.deckRecommend.config.bonusTargetsHint")}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 音乐 */}
                    {needsMusic && (
                        <div className="mb-5">
                            <SectionTitle text={t("page.deckRecommend.config.musicTitle")} />
                            <MusicSelector selectedMusicId={musicId} onSelect={(id) => patch({ musicId: id })} liveType={liveType} />
                            <div className="flex flex-wrap gap-2 mt-3">
                                {DIFFICULTY_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => patch({ difficulty: option })}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${difficulty === option
                                            ? `${DIFFICULTY_COLORS[option]} text-white shadow-lg`
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200"}`}
                                    >
                                        {option.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {mode !== "weakest" && (
                    <>
                    {/* 卡牌养成 */}
                    <div className="mb-5">
                        <SectionTitle text={t("page.deckRecommend.config.trainingTitle")} />
                        <div className="overflow-x-auto">
                            <table className="ds-config-table w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400">
                                        <th className="text-left py-2 px-2">{t("page.deckRecommend.config.training.rarity")}</th>
                                        <th className="text-center py-2 px-2">{t("page.deckRecommend.config.training.disable")}</th>
                                        <th className="text-center py-2 px-2">{t("page.deckRecommend.config.training.level")}</th>
                                        <th className="text-center py-2 px-2">{t("page.deckRecommend.config.training.episodes")}</th>
                                        <th className="text-center py-2 px-2">{t("page.deckRecommend.config.training.master")}</th>
                                        <th className="text-center py-2 px-2">{t("page.deckRecommend.config.training.skill")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {RARITY_CONFIG_KEYS.map(({ key, color }) => (
                                        <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-2">
                                                <span className="font-bold" style={{ color }}>{t(`page.deckRecommend.config.training.rarities.${key}`)}</span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" className="ds-checkbox" checked={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "disable", e.target.checked)} />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" className="ds-checkbox" checked={cardConfig[key].levelMax} disabled={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "levelMax", e.target.checked)} />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" className="ds-checkbox" checked={cardConfig[key].episodeRead} disabled={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "episodeRead", e.target.checked)} />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" className="ds-checkbox" checked={cardConfig[key].masterMax} disabled={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "masterMax", e.target.checked)} />
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" className="ds-checkbox" checked={cardConfig[key].skillMax} disabled={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "skillMax", e.target.checked)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </>
                    )}
                </div>

                {/* Calculate */}
                <div className="mb-6">
                    {isCalculating ? (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-full ios-glass-btn rounded-xl py-3.5 font-bold text-red-500 border border-red-200/50"
                        >
                            <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full ds-spinner mr-2 align-[-2px]" />
                            {t("page.deckRecommend.cancel")}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCalculate}
                            className="w-full ios-glass-btn ios-glass-btn-primary rounded-xl py-3.5 font-bold shadow-lg shadow-miku/20"
                        >
                            {t("page.deckRecommend.calculate")}
                        </button>
                    )}
                    {isCalculating && (
                        <div className="ios-glass-panel p-4 rounded-2xl mt-4">
                            <ProgressBar percent={progressPercent} stageLabel={progressLabel} />
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="ios-glass-card p-4 rounded-2xl mb-6 bg-red-50/80 border border-red-200/50">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Results */}
                {results && results.length > 0 && (
                    <div className="ios-glass-panel p-5 sm:p-6 rounded-2xl mb-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="text-lg font-bold text-primary-text dark:text-slate-100 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-miku rounded-full" />
                                {t("page.deckRecommend.result.title")}
                            </h2>
                            {duration !== null && (
                                <span className="text-xs text-slate-400 font-mono">
                                    {t("page.deckRecommend.result.duration", { ms: formatNumber(Math.round(duration)) })}
                                </span>
                            )}
                        </div>
                        {results.map((deck) => (
                            <DeckRow
                                key={deck.rank}
                                deck={deck}
                                scoreLabel={scoreLabel}
                                showBonus={mode === "event" || mode === "custom" || mode === "mysekai"}
                                cardsMaster={cardsMaster}
                                songTitles={songTitles}
                                userCards={userCards}
                                formatNumber={formatNumber}
                                musicRows={musicByDeck[deck.rank] ?? null}
                                musicLoading={musicLoadingByDeck[deck.rank] ?? false}
                                onRequestMusic={() => requestMusic(deck)}
                            />
                        ))}
                    </div>
                )}
                {results && results.length === 0 && !error && (
                    <div className="ios-glass-card p-6 rounded-2xl mb-6 text-center">
                        <p className="text-sm text-slate-400">{t("page.deckRecommend.result.empty")}</p>
                    </div>
                )}
            </div>

            {/* 卡牌选择弹窗（固定/排除/单卡覆盖共用） */}
            <CardSelectorModal
                isOpen={cardModal !== null}
                onClose={() => setCardModal(null)}
                title={cardModal === "fixed"
                    ? t("page.deckRecommend.config.fixedCards")
                    : cardModal === "excluded"
                        ? t("page.deckRecommend.config.excludedCards")
                        : t("page.deckRecommend.config.singleCardTitle")}
                cards={cardsMaster}
                maxSelectCount={cardModal === "fixed" ? 5 : cardModal === "single" ? 1 : undefined}
                selectedCardIds={cardModal === "fixed" ? fixedCards : cardModal === "excluded" ? excludedCards : singleCardOverrides.map((e) => e.cardId)}
                onToggleCardSelect={(card) => {
                    if (cardModal === "single") {
                        setState((prev) => ({ ...prev, singleCardOverrides: [{ cardId: card.id }] }));
                        setCardModal(null);
                        return;
                    }
                    const key = cardModal === "fixed" ? "fixedCards" : "excludedCards";
                    setState((prev) => {
                        const list = prev[key] as number[];
                        return {
                            ...prev,
                            [key]: list.includes(card.id) ? list.filter((v) => v !== card.id) : [...list, card.id],
                        };
                    });
                }}
            />
</MainLayout>
    );
}
