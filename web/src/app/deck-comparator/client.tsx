"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExternalLink from "@/components/ExternalLink";
import { useI18n } from "@/contexts/I18nContext";
import { IMusicInfo, IMusicMeta } from "@/types/music";
import { fetchMasterData } from "@/lib/fetch";
import MainLayout from "@/components/MainLayout";
import MusicSelector from "@/components/deck-recommend/MusicSelector";
import {
    MultiLivePTCalculator,
    Skill6Mode,
    Skill15Strategy,
    getBoostRate,
    type MusicMeta,
    type CalculationResult,
    type PTResult,
} from "@/lib/deck-comparator/calculator";
import "./deck-comparator.css";

const MUSIC_META_API = "https://moe.exmeaning.com/data/music_meta/music_metas.json";

const DIFFICULTY_OPTIONS = [
    { value: "easy", labelKey: "page.deckComparator.difficulties.easy" },
    { value: "normal", labelKey: "page.deckComparator.difficulties.normal" },
    { value: "hard", labelKey: "page.deckComparator.difficulties.hard" },
    { value: "expert", labelKey: "page.deckComparator.difficulties.expert" },
    { value: "master", labelKey: "page.deckComparator.difficulties.master" },
    { value: "append", labelKey: "page.deckComparator.difficulties.append" },
];

interface HistoryItem {
    id: string; // Timestamp as ID
    timestamp: number;
    musicId: number;
    musicTitle: string;
    difficulty: string;
    userPower: number;
    deckBonus: number;
    fires: number;
    score: number;
    pt: number;
    eventRate: number;
}

interface MusicMetaApiItem extends IMusicMeta {
    tap_count?: number;
    base_score_auto?: number;
    skill_score_solo?: number[];
    skill_score_multi?: number[];
    skill_score_auto?: number[];
}

// ==================== Main Component ====================
export default function DeckComparatorClient() {
    const { t, formatDate, formatNumber } = useI18n();

    // Music selection state
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicMetas, setMusicMetas] = useState<MusicMetaApiItem[]>([]);
    const [musicId, setMusicId] = useState("");
    const [difficulty, setDifficulty] = useState("master");

    // Calculator inputs
    const [userPower, setUserPower] = useState(280000);
    const [userEffectiveness, setUserEffectiveness] = useState(250);
    const [allSameTeammate, setAllSameTeammate] = useState(true);
    const [teammatePower, setTeammatePower] = useState(200000);
    const [teammateEffectiveness, setTeammateEffectiveness] = useState(200);
    const [teammates, setTeammates] = useState([
        { power: 200000, effectiveness: 200 },
        { power: 200000, effectiveness: 200 },
        { power: 200000, effectiveness: 200 },
        { power: 200000, effectiveness: 200 },
    ]);
    const [skill6Mode, setSkill6Mode] = useState<Skill6Mode>(Skill6Mode.TEAM_AVERAGE);
    const [skill15Strategy, setSkill15Strategy] = useState<Skill15Strategy>(Skill15Strategy.EXPECTED);

    // Event PT inputs
    const [deckBonus, setDeckBonus] = useState(150);
    const [fires, setFires] = useState(5);

    // Result state
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [ptResult, setPtResult] = useState<PTResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // History state
    const [history, setHistory] = useState<HistoryItem[]>(() => {
        if (typeof window === "undefined") return [];
        try {
            const saved = localStorage.getItem("deck-comparator-history");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Load initial data
    useEffect(() => {
        // Load music list
        fetchMasterData<IMusicInfo[]>("musics.json")
            .then(data => setMusics(data))
            .catch(err => console.error("Failed to fetch musics", err));

        // Load meta
        fetch(MUSIC_META_API).then(res => res.json())
            .then(data => setMusicMetas(data))
            .catch(err => console.error("Failed to fetch music meta", err));

    }, []);

    // Save history to local storage
    useEffect(() => {
        localStorage.setItem("deck-comparator-history", JSON.stringify(history));
    }, [history]);

    const handleSaveHistory = () => {
        if (!ptResult || !result || !musicId) return;

        const music = musics.find(m => m.id.toString() === musicId);
        const title = music ? music.title : t("page.deckComparator.fallbackMusicTitle", { id: musicId });

        const item: HistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            musicId: parseInt(musicId),
            musicTitle: title,
            difficulty,
            userPower,
            deckBonus,
            fires,
            score: result.score,
            pt: ptResult.pt,
            eventRate: ptResult.eventRate,
        };

        setHistory(prev => [item, ...prev]);
    };

    const handleDeleteHistory = (id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
    };

    // Get music meta for selected song + difficulty
    const selectedMeta = useMemo((): MusicMeta | null => {
        if (!musicId || !musicMetas.length) return null;
        const id = parseInt(musicId);
        const meta = musicMetas.find(
            (m) => m.music_id === id && m.difficulty === difficulty
        );
        if (!meta) return null;
        return {
            music_id: meta.music_id,
            difficulty: meta.difficulty,
            music_time: meta.music_time,
            base_score: meta.base_score,
            fever_score: meta.fever_score,
            tap_count: meta.tap_count || 0,
            event_rate: meta.event_rate || 100,
            skill_score_solo: meta.skill_score_solo || [],
            skill_score_multi: meta.skill_score_multi || [],
            skill_score_auto: meta.skill_score_auto || [],
            base_score_auto: meta.base_score_auto || 0,
        };
    }, [musicId, difficulty, musicMetas]);

    // Update individual teammate
    const updateTeammate = useCallback((index: number, field: 'power' | 'effectiveness', value: number) => {
        setTeammates(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    // Handle calculation
    const handleCalculate = useCallback(() => {
        if (!selectedMeta) {
            setError(t("page.deckComparator.errors.musicMetaRequired"));
            return;
        }
        if (!userPower || userPower <= 0) {
            setError(t("page.deckComparator.errors.invalidPower"));
            return;
        }

        try {
            setError(null);
            const calc = new MultiLivePTCalculator();

            // Set teammates
            const actualTeammates = allSameTeammate
                ? Array.from({ length: 4 }, () => ({ power: teammatePower, effectiveness: teammateEffectiveness }))
                : teammates;

            for (let i = 0; i < 4; i++) {
                calc.setTeammate(i, actualTeammates[i].power, actualTeammates[i].effectiveness);
            }

            calc.setSkill6Mode(skill6Mode);
            calc.setSkill15Strategy(skill15Strategy);

            const res = calc.calculate(userPower, userEffectiveness, selectedMeta);
            setResult(res);

            // PT calculation
            const pt = calc.calculatePT(res, selectedMeta, deckBonus, fires);
            setPtResult(pt);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t("page.deckComparator.errors.calculationFailedUnknown");
            const cause = err instanceof Error && typeof err.cause === "object" && err.cause !== null
                ? err.cause as Record<string, string | number>
                : undefined;
            const translated = message.startsWith("page.deckComparator.")
                ? t(message, cause)
                : t("page.deckComparator.errors.calculationFailed", { message });
            setError(translated);
            setResult(null);
            setPtResult(null);
        }
    }, [selectedMeta, userPower, userEffectiveness, allSameTeammate, teammatePower, teammateEffectiveness, teammates, skill6Mode, skill15Strategy, deckBonus, fires, t]);

    // Score breakdown colors
    const breakdownColors = {
        base: "#3b82f6",
        skill15: "#10b981",
        skill6: "#f59e0b",
        active: "#8b5cf6",
    };

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Page Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku">{t("page.deckComparator.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                        {t("page.deckComparator.title")}<span className="text-miku">{t("page.deckComparator.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                        {t("page.deckComparator.description")}
                    </p>
                </div>

                {/* Mobile Info. .dc-mobile-info carries the desktop media query that
                    hides this strip, so the class stays even though its look is now
                    expressed through tokens. */}
                <div className="dc-mobile-info hh-tile rounded-[var(--hh-radius-lg)] p-3 mb-6 flex items-center gap-2 text-sm text-blue-700 bg-blue-500/12 border-blue-500/30">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{t("page.deckComparator.mobileInfo")}</span>
                </div>

                {/* Input Form */}
                <div className="hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                    <h2 className="hh-title text-lg text-[var(--hh-text-primary)] mb-4 flex items-center gap-2">
                        <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>
                        {t("page.deckComparator.musicAndDifficulty")}
                    </h2>

                    {/* Song + Difficulty */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <MusicSelector
                                selectedMusicId={musicId}
                                onSelect={(id) => setMusicId(id)}
                                recommendMode="event"
                                liveType="multi"
                            />
                            {/* Meta availability hint */}
                            {musicId && !selectedMeta && (
                                <p className="mt-1 text-xs text-amber-500">
                                    ⚠️ {t("page.deckComparator.noMetaForDifficulty", { difficulty: difficulty.toUpperCase() })}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.difficulty")}</label>
                            <div className="flex flex-wrap gap-2">
                                {DIFFICULTY_OPTIONS.map((d) => {
                                    // Difficulty hues are game semantics rather than decoration, so
                                    // the active slab keeps its colour; only the coloured elevation
                                    // halo is dropped.
                                    const activeColors: Record<string, string> = {
                                        easy: "bg-blue-500",
                                        normal: "bg-emerald-500",
                                        hard: "bg-orange-500",
                                        expert: "bg-red-500",
                                        master: "bg-purple-500",
                                        append: "bg-fuchsia-500",
                                    };
                                    const isActive = difficulty === d.value;
                                    return (
                                        <button
                                            key={d.value}
                                            onClick={() => setDifficulty(d.value)}
                                            aria-pressed={isActive}
                                            className={`hh-chip hh-press hh-focusable ${isActive ? `${activeColors[d.value] ?? "bg-[var(--hh-accent)]"} text-white border-black/15` : ""}`}
                                        >
                                            {t(d.labelKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Config */}
                <div className="hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                    <h2 className="hh-title text-lg text-[var(--hh-text-primary)] mb-4 flex items-center gap-2">
                        <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>
                        {t("page.deckComparator.playerConfig")}
                    </h2>

                    {/* User Power + Effectiveness + Deck Bonus */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">
                                {t("page.deckComparator.myPower")} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={userPower}
                                onChange={(e) => setUserPower(Number(e.target.value))}
                                placeholder="280000"
                                className="dc-number-input hh-input hh-numeric w-full px-4 py-2.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">
                                {t("page.deckComparator.myEffectiveness")}
                            </label>
                            <input
                                type="number"
                                value={userEffectiveness}
                                onChange={(e) => setUserEffectiveness(Number(e.target.value))}
                                placeholder="250"
                                className="dc-number-input hh-input hh-numeric w-full px-4 py-2.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">
                                {t("page.deckComparator.deckBonus")}
                            </label>
                            <input
                                type="number"
                                value={deckBonus}
                                onChange={(e) => setDeckBonus(Number(e.target.value))}
                                placeholder="150"
                                className="dc-number-input hh-input hh-numeric w-full px-4 py-2.5 text-sm"
                            />
                            <p className="mt-1 text-xs text-[var(--hh-text-tertiary)]">{t("page.deckComparator.deckBonusHint")}</p>
                        </div>
                    </div>

                    {/* Teammate Config */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-[var(--hh-text-secondary)]">
                                {t("page.deckComparator.teammateConfig")}
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--hh-text-secondary)]">{t("page.deckComparator.wholeTeamSame")}</span>
                                <button
                                    onClick={() => setAllSameTeammate(!allSameTeammate)}
                                    role="switch"
                                    aria-checked={allSameTeammate}
                                    className={`hh-switch hh-focusable shrink-0 ${allSameTeammate ? "hh-switch-active" : ""}`}
                                >
                                    <span className="hh-switch-thumb" />
                                </button>
                            </div>
                        </div>

                        {allSameTeammate ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.power")}</label>
                                    <input
                                        type="number"
                                        value={teammatePower}
                                        onChange={(e) => setTeammatePower(Number(e.target.value))}
                                        className="dc-number-input hh-input hh-numeric w-full px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.effectiveness")}</label>
                                    <input
                                        type="number"
                                        value={teammateEffectiveness}
                                        onChange={(e) => setTeammateEffectiveness(Number(e.target.value))}
                                        className="dc-number-input hh-input hh-numeric w-full px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {teammates.map((tm, i) => (
                                    // The row was a 10%-opaque wash that only held together
                                    // behind a blur; on a flat surface it needs a real well.
                                    <div key={i} className="dc-teammate-row hh-well grid grid-cols-[auto_1fr_1fr] gap-2 items-center p-2 rounded-[var(--hh-radius-md)]">
                                        <span className="hh-numeric text-xs font-bold text-[var(--hh-text-tertiary)] w-6 text-center">
                                            P{i + 2}
                                        </span>
                                        <input
                                            type="number"
                                            value={tm.power}
                                            onChange={(e) => updateTeammate(i, 'power', Number(e.target.value))}
                                            placeholder={t("page.deckComparator.powerPlaceholder")}
                                            className="dc-number-input hh-input hh-numeric w-full px-3 py-1.5 text-sm"
                                        />
                                        <input
                                            type="number"
                                            value={tm.effectiveness}
                                            onChange={(e) => updateTeammate(i, 'effectiveness', Number(e.target.value))}
                                            placeholder={t("page.deckComparator.effectivenessPlaceholder")}
                                            className="dc-number-input hh-input hh-numeric w-full px-3 py-1.5 text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Skill6 Mode + Skill1-5 Strategy */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckComparator.skill6Mode")}</label>
                            {/* Both of these are exclusive two/three-way choices that already
                                filled their column, which is the sizing model .hh-segment is
                                built for, so no width override is needed here. */}
                            <div className="hh-segment" role="tablist">
                                <button
                                    role="tab"
                                    aria-selected={skill6Mode === Skill6Mode.TEAM_AVERAGE}
                                    onClick={() => setSkill6Mode(Skill6Mode.TEAM_AVERAGE)}
                                    className="hh-segment-item hh-press cursor-pointer"
                                >
                                    {t("page.deckComparator.skill6Modes.teamAverage")}
                                </button>
                                <button
                                    role="tab"
                                    aria-selected={skill6Mode === Skill6Mode.HIGHEST_POWER}
                                    onClick={() => setSkill6Mode(Skill6Mode.HIGHEST_POWER)}
                                    className="hh-segment-item hh-press cursor-pointer"
                                >
                                    {t("page.deckComparator.skill6Modes.highestPower")}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckComparator.skill15Strategy")}</label>
                            <div className="hh-segment" role="tablist">
                                {[
                                    { value: Skill15Strategy.EXPECTED, labelKey: "page.deckComparator.skill15Strategies.expected" },
                                    { value: Skill15Strategy.BEST, labelKey: "page.deckComparator.skill15Strategies.best" },
                                    { value: Skill15Strategy.WORST, labelKey: "page.deckComparator.skill15Strategies.worst" },
                                ].map((s) => (
                                    <button
                                        key={s.value}
                                        role="tab"
                                        aria-selected={skill15Strategy === s.value}
                                        onClick={() => setSkill15Strategy(s.value)}
                                        className="hh-segment-item hh-press cursor-pointer"
                                    >
                                        {t(s.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Fire Count */}
                    <div className="mb-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">
                                {t("page.deckComparator.fireCount")}
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={fires}
                                    min={0}
                                    max={10}
                                    onChange={(e) => setFires(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                                    className="dc-number-input hh-input hh-numeric w-24 px-3 py-2 text-sm"
                                />
                                <span className="hh-numeric text-sm text-[var(--hh-text-secondary)]">
                                    {t("page.deckComparator.currentMultiplier", { rate: getBoostRate(fires) })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Calculate Button */}
                    <button
                        onClick={handleCalculate}
                        disabled={!selectedMeta}
                        className="hh-btn hh-btn-primary hh-press hh-focusable w-full px-6 py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {t("page.deckComparator.calculatePt")}
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-4 mb-6 border-red-500/30 bg-red-500/12">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-medium text-red-600">{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="dc-score-enter hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="hh-title text-lg text-[var(--hh-text-primary)] flex items-center gap-2">
                                <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>
                                {t("page.deckComparator.resultsTitle")}
                            </h2>
                            <button
                                onClick={handleSaveHistory}
                                className="hh-btn hh-press hh-focusable px-3 py-1.5 text-miku text-xs font-bold"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                {t("page.deckComparator.saveResult")}
                            </button>
                        </div>

                        {/* Main PT. The headline was a clipped orange-to-red gradient; a
                            flat readout uses one solid colour and lets the numerals carry
                            the emphasis. */}
                        {ptResult && (
                            <div className="text-center mb-6 pb-6 border-b border-[var(--hh-border)]">
                                <div className="hh-label mb-1">{t("page.deckComparator.result.eventPt")}</div>
                                <div className="hh-display hh-numeric text-5xl sm:text-6xl text-orange-500 font-mono">
                                    {formatNumber(ptResult.pt)}
                                </div>
                                <div className="hh-numeric flex items-center justify-center gap-3 mt-2 text-xs text-[var(--hh-text-tertiary)]">
                                    <span>{t("page.deckComparator.result.basePt", { value: formatNumber(ptResult.basePT) })}</span>
                                    <span>·</span>
                                    <span>{t("page.deckComparator.result.musicRate", { value: ptResult.eventRate })}</span>
                                    <span>·</span>
                                    <span>{t("page.deckComparator.result.deckRate", { value: ptResult.deckRate.toFixed(2) })}</span>
                                    <span>·</span>
                                    <span>{t("page.deckComparator.result.boostRate", { value: ptResult.boostRate })}</span>
                                </div>
                            </div>
                        )}

                        {/* Main Score */}
                        <div className="text-center mb-6">
                            <div className="hh-label mb-1">{t("page.deckComparator.result.estimatedScore")}</div>
                            <div className="hh-display hh-numeric text-4xl sm:text-5xl text-miku font-mono">
                                {formatNumber(result.score)}
                            </div>
                            {ptResult && (
                                <div className="hh-numeric text-xs text-[var(--hh-text-tertiary)] mt-1">
                                    {t("page.deckComparator.result.teammateTotalScore", { value: formatNumber(ptResult.otherScore) })}
                                </div>
                            )}
                        </div>

                        {/* Score Breakdown Bar. The segment colours are the legend for the
                            four cards below, so they are data rather than decoration; only
                            the track is repointed at a sunken token. .dc-breakdown-bar is
                            unlayered, hence the inline background override. */}
                        <div className="mb-6">
                            <div className="dc-breakdown-bar" style={{ background: "var(--hh-surface-inset)" }}>
                                <div className="flex h-full">
                                    <div
                                        className="dc-breakdown-segment"
                                        style={{
                                            width: `${(result.baseScorePart / result.score) * 100}%`,
                                            backgroundColor: breakdownColors.base,
                                        }}
                                    />
                                    <div
                                        className="dc-breakdown-segment"
                                        style={{
                                            width: `${(result.skill15Part / result.score) * 100}%`,
                                            backgroundColor: breakdownColors.skill15,
                                        }}
                                    />
                                    <div
                                        className="dc-breakdown-segment"
                                        style={{
                                            width: `${(result.skill6Part / result.score) * 100}%`,
                                            backgroundColor: breakdownColors.skill6,
                                        }}
                                    />
                                    <div
                                        className="dc-breakdown-segment"
                                        style={{
                                            width: `${(result.activeBonus / result.score) * 100}%`,
                                            backgroundColor: breakdownColors.active,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                            {[
                                { label: t("page.deckComparator.result.baseScore"), value: result.baseScorePart, color: breakdownColors.base },
                                { label: t("page.deckComparator.result.skill15"), value: result.skill15Part, color: breakdownColors.skill15 },
                                { label: t("page.deckComparator.result.skill6"), value: result.skill6Part, color: breakdownColors.skill6 },
                                { label: t("page.deckComparator.result.activeBonus"), value: result.activeBonus, color: breakdownColors.active },
                            ].map((item) => (
                                <div key={item.label} className="hh-well p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-[var(--hh-text-secondary)]">{item.label}</span>
                                    </div>
                                    <div className="hh-numeric text-sm font-bold text-[var(--hh-text-primary)] font-mono">
                                        {formatNumber(item.value)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            <div className="hh-well p-3">
                                <div className="text-xs text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.result.totalPower")}</div>
                                <div className="hh-numeric text-sm font-bold text-[var(--hh-text-primary)] font-mono">
                                    {formatNumber(result.totalPower)}
                                </div>
                            </div>
                            <div className="hh-well p-3">
                                <div className="text-xs text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.result.skill6Effectiveness")}</div>
                                <div className="hh-numeric text-sm font-bold text-[var(--hh-text-primary)] font-mono">
                                    {result.skill6Effectiveness.toFixed(1)}%
                                </div>
                            </div>
                            <div className="hh-well p-3 col-span-2 sm:col-span-1">
                                <div className="text-xs text-[var(--hh-text-secondary)] mb-1">{t("page.deckComparator.result.fluctuationRange")}</div>
                                {/* Tabular digits matter most here: the ± readout sits directly
                                    under best/worst, and proportional numerals make the sign
                                    and leading digit shift between renders. */}
                                <div className="hh-numeric text-sm font-bold text-[var(--hh-text-primary)] font-mono">
                                    ±{formatNumber((result.details.scoreBest - result.details.scoreWorst) / 2)}
                                </div>
                            </div>
                        </div>

                        {/* Best / Worst Reference — success green and error red are semantic. */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-[var(--hh-radius-md)] p-3 border border-emerald-500/30 bg-emerald-500/10">
                                <div className="text-xs text-emerald-600 mb-1">{t("page.deckComparator.result.bestScore")}</div>
                                <div className="hh-numeric text-sm font-bold text-emerald-700 font-mono">
                                    {formatNumber(result.details.scoreBest)}
                                </div>
                            </div>
                            <div className="rounded-[var(--hh-radius-md)] p-3 border border-red-500/30 bg-red-500/10">
                                <div className="text-xs text-red-500 mb-1">{t("page.deckComparator.result.worstScore")}</div>
                                <div className="hh-numeric text-sm font-bold text-red-600 font-mono">
                                    {formatNumber(result.details.scoreWorst)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History List */}
                {history.length > 0 && (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="hh-title text-lg text-[var(--hh-text-primary)] flex items-center gap-2">
                                <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-border-strong)]"></span>
                                {t("page.deckComparator.historyTitle")}
                            </h2>
                            <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)]">
                                {t("page.deckComparator.historyCount", { count: formatNumber(history.length) })}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {history.map((item) => (
                                <div key={item.id} className="hh-press relative group hh-well p-3 flex items-center gap-3">
                                    {/* Song Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-sm font-bold text-[var(--hh-text-primary)] truncate">
                                                {item.musicTitle}
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] uppercase ${item.difficulty === 'master' ? 'bg-purple-500/15 text-purple-600' :
                                                    item.difficulty === 'expert' ? 'bg-red-500/15 text-red-600' :
                                                        item.difficulty === 'append' ? 'bg-fuchsia-500/15 text-fuchsia-600' :
                                                            'bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]'
                                                }`}>
                                                {item.difficulty}
                                            </span>
                                        </div>
                                        <div className="hh-numeric flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--hh-text-tertiary)]">
                                            <span>{formatDate(item.timestamp, { dateStyle: "short", timeStyle: "short" })}</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>{t("page.deckComparator.historyPower", { power: `${(item.userPower / 10000).toFixed(1)}w` })}</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>{t("page.deckComparator.historyBonus", { bonus: item.deckBonus })}</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>{item.fires}🔥</span>
                                        </div>
                                    </div>

                                    {/* Score Info */}
                                    <div className="text-right flex-shrink-0">
                                        <div className="hh-numeric text-sm font-bold text-miku font-mono">
                                            {formatNumber(item.pt)} PT
                                        </div>
                                        <div className="hh-numeric text-xs text-[var(--hh-text-tertiary)] font-mono">
                                            {formatNumber(item.score)}
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteHistory(item.id)}
                                        className="hh-press hh-focusable absolute -top-2 -right-2 bg-red-500/15 text-red-500 rounded-[var(--hh-radius-full)] p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-red-500/25"
                                        title={t("page.deckComparator.deleteHistory")}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 text-center text-xs text-[var(--hh-text-tertiary)]">
                    <p className="mb-1">
                        {t("page.deckComparator.sourceCreditPrefix")} <ExternalLink href="https://github.com/xfl03/sekai-calculator" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-miku hover:underline">sekai-calculator</ExternalLink>
                    </p>
                    <p>
                        {t("page.deckComparator.licenseNotice")}
                    </p>
                </div>
            </div>

        </MainLayout>
    );
}
