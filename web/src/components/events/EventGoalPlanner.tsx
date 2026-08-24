"use client";
import React, { useState, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ServerType, RankChart } from '@/types/prediction';
import {
    calculateGoalStrategy,
    META_SONG_PROFILES,
    MetaSongKey,
    LiveMode,
    FeasibilityLevel
} from '@/lib/prediction-engine';

interface EventGoalPlannerProps {
    server: ServerType;
    charts: RankChart[];
    startAt: number;
    endAt: number;
    isActive: boolean;
    isWorldBloom?: boolean;
}

const TIER_OPTIONS = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 5000, 10000];
const MARATHON_BONUS_OPTIONS = [475, 435, 385, 250];
const WL_BONUS_OPTIONS = [990, 960, 900, 850, 750, 650];
const FIRE_OPTIONS = [10, 7, 5, 3, 2, 1];

export default function EventGoalPlanner({
    server,
    charts,
    startAt,
    endAt,
    isActive: _isActive,
    isWorldBloom = false,
}: EventGoalPlannerProps) {
    const { t, formatNumber } = useI18n();

    const bonusOptions = isWorldBloom ? WL_BONUS_OPTIONS : MARATHON_BONUS_OPTIONS;

    // Form states
    const [currentScoreInput, setCurrentScoreInput] = useState<string>('0');
    const [isCustomScore, setIsCustomScore] = useState<boolean>(false);
    const [selectedTier, setSelectedTier] = useState<number>(100);
    const [customScoreInput, setCustomScoreInput] = useState<string>('');

    // Strategy configuration
    const [customBonus, setCustomBonus] = useState<number | null>(null);
    const [customBonusInput, setCustomBonusInput] = useState<string | null>(null);
    const defaultBonus = isWorldBloom ? 850 : 475;
    const bonusPercent = customBonus ?? defaultBonus;
    const bonusPercentInput = customBonusInput ?? String(defaultBonus);

    const [fireMultiplier, setFireMultiplier] = useState<number>(10);
    const [selectedSong, setSelectedSong] = useState<MetaSongKey>('envy');
    const [liveMode, setLiveMode] = useState<LiveMode>('multi');
    const [dailyAvailableHours, setDailyAvailableHours] = useState<number>(6);
    const [dailyAutoBudget, setDailyAutoBudget] = useState<number>(30);

    // Derive target score
    const targetScore = useMemo(() => {
        if (isCustomScore) {
            const parsed = parseInt(customScoreInput.replace(/[^0-9]/g, ''), 10);
            return isNaN(parsed) ? 0 : parsed;
        }
        const matchingChart = charts.find(c => c.Rank === selectedTier);
        if (matchingChart && matchingChart.PredictedScore > 0) {
            return matchingChart.PredictedScore;
        }
        return matchingChart?.CurrentScore || 0;
    }, [isCustomScore, customScoreInput, charts, selectedTier]);

    const currentScore = useMemo(() => {
        const parsed = parseInt(currentScoreInput.replace(/[^0-9]/g, ''), 10);
        return isNaN(parsed) ? 0 : parsed;
    }, [currentScoreInput]);

    // Calculate plan
    const plan = useMemo(() => {
        return calculateGoalStrategy({
            server,
            currentScore,
            targetScore,
            startAt,
            endAt,
            bonusPercent,
            fireMultiplier,
            songKey: selectedSong,
            liveMode,
            dailyAvailableHours,
            dailyAutoBudget,
        });
    }, [server, currentScore, targetScore, startAt, endAt, bonusPercent, fireMultiplier, selectedSong, liveMode, dailyAvailableHours, dailyAutoBudget]);

    // Alternative comparison with Lost and Found / Envy
    const altSongKey: MetaSongKey = selectedSong === 'envy' ? 'lost_and_found' : 'envy';
    const altPlan = useMemo(() => {
        return calculateGoalStrategy({
            server,
            currentScore,
            targetScore,
            startAt,
            endAt,
            bonusPercent,
            fireMultiplier,
            songKey: altSongKey,
            liveMode,
            dailyAvailableHours,
            dailyAutoBudget,
        });
    }, [server, currentScore, targetScore, startAt, endAt, bonusPercent, fireMultiplier, altSongKey, liveMode, dailyAvailableHours, dailyAutoBudget]);

    const getFeasibilityStyle = (level: FeasibilityLevel) => {
        switch (level) {
            case 'comfortable':
                return {
                    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                    textClass: 'text-emerald-600 dark:text-emerald-400',
                    bgCardClass: 'border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10',
                };
            case 'achievable':
                return {
                    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
                    textClass: 'text-blue-600 dark:text-blue-400',
                    bgCardClass: 'border-blue-200/60 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10',
                };
            case 'hard':
                return {
                    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
                    textClass: 'text-amber-600 dark:text-amber-400',
                    bgCardClass: 'border-amber-200/60 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10',
                };
            case 'impossible':
                return {
                    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
                    textClass: 'text-red-600 dark:text-red-400',
                    bgCardClass: 'border-red-200/60 bg-red-50/20 dark:border-red-900/40 dark:bg-red-950/10',
                };
        }
    };

    const feasibilityStyle = getFeasibilityStyle(plan.feasibility);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-8 transition-all">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-miku/10 text-miku rounded-full text-xs font-bold uppercase tracking-wider mb-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {t("page.prediction.planner.badge")}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {t("page.prediction.planner.title")}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {server === 'jp' ? t("page.prediction.planner.subtitleJp") : t("page.prediction.planner.subtitle")}
                    </p>
                </div>
                {/* Feasibility Indicator */}
                <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 self-start sm:self-auto ${feasibilityStyle.badgeClass}`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="text-xs font-bold">
                        {t(`page.prediction.planner.results.status.${plan.feasibility}`)}
                    </span>
                </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Form: Inputs (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Current Score */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                            {t("page.prediction.planner.inputs.currentScore")}
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={currentScoreInput}
                            onChange={(e) => setCurrentScoreInput(e.target.value)}
                            placeholder={t("page.prediction.planner.inputs.currentScorePlaceholder")}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku"
                        />
                    </div>

                    {/* Target Selection Mode */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                {isCustomScore ? t("page.prediction.planner.inputs.targetScore") : t("page.prediction.planner.inputs.targetTier")}
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsCustomScore(!isCustomScore)}
                                className="text-xs text-miku hover:underline font-medium"
                            >
                                {isCustomScore ? t("page.prediction.planner.inputs.tierSelectToggle") : t("page.prediction.planner.inputs.customScoreToggle")}
                            </button>
                        </div>

                        {!isCustomScore ? (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                {TIER_OPTIONS.map((tier) => (
                                    <button
                                        key={tier}
                                        type="button"
                                        onClick={() => setSelectedTier(tier)}
                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${selectedTier === tier
                                            ? 'bg-miku text-white shadow-sm shadow-miku/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        T{tier}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <input
                                type="text"
                                inputMode="numeric"
                                value={customScoreInput}
                                onChange={(e) => setCustomScoreInput(e.target.value)}
                                placeholder={t("page.prediction.planner.inputs.targetScorePlaceholder")}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku"
                            />
                        )}
                        {!isCustomScore && (
                            <div className="mt-1 text-[11px] text-slate-400 font-mono flex justify-between">
                                <span>{t("page.prediction.table.predictedScore")}:</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">{formatNumber(targetScore)} pt</span>
                            </div>
                        )}
                    </div>

                    {/* Deck Bonus & Fire Multiplier */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Deck Bonus */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    {isWorldBloom ? t("page.prediction.planner.inputs.deckBonusWl") : t("page.prediction.planner.inputs.deckBonus")}
                                </label>
                                <span className="text-[10px] font-mono text-miku font-bold">+{bonusPercent}%</span>
                            </div>
                            <div className="relative mb-1.5">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 select-none">+</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={bonusPercentInput}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setCustomBonusInput(raw);
                                        const num = parseInt(raw, 10);
                                        if (!isNaN(num) && num >= 0) {
                                            setCustomBonus(Math.min(2500, num));
                                        } else if (raw === '') {
                                            setCustomBonus(0);
                                        }
                                    }}
                                    placeholder={isWorldBloom ? "1000" : "475"}
                                    className="w-full pl-6 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/30 font-mono"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 select-none">%</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {bonusOptions.map((b) => (
                                    <button
                                        key={b}
                                        type="button"
                                        onClick={() => {
                                            setCustomBonus(b);
                                            setCustomBonusInput(String(b));
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                            bonusPercent === b
                                                ? 'bg-miku/20 text-miku font-bold border border-miku/40'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        +{b}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Fire Multiplier */}
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.inputs.fireMultiplier")}
                            </label>
                            <select
                                value={fireMultiplier}
                                onChange={(e) => setFireMultiplier(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/30"
                            >
                                {FIRE_OPTIONS.map((f) => (
                                    <option key={f} value={f}>{t("page.prediction.planner.inputs.fireUnit", { fire: f })}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Live Mode (Multi / Co-op vs Solo) */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                {t("page.prediction.planner.inputs.liveMode")}
                            </label>
                            <span className="text-[10px] text-slate-400">
                                {t("page.prediction.planner.inputs.multiLiveNote")}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setLiveMode('multi')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    liveMode === 'multi'
                                        ? 'bg-miku text-white border-miku shadow-sm shadow-miku/30'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {t("page.prediction.planner.inputs.liveModeMulti")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLiveMode('solo')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    liveMode === 'solo'
                                        ? 'bg-miku text-white border-miku shadow-sm shadow-miku/30'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {t("page.prediction.planner.inputs.liveModeSolo")}
                            </button>
                        </div>
                    </div>

                    {/* Target Song Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                            {t("page.prediction.planner.inputs.songChoice")}
                        </label>
                        <select
                            value={selectedSong}
                            onChange={(e) => setSelectedSong(e.target.value as MetaSongKey)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/30"
                        >
                            {Object.entries(META_SONG_PROFILES).map(([k, s]) => (
                                <option key={k} value={k}>
                                    {t(s.nameKey)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Daily Available Time & Auto */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    {t("page.prediction.planner.inputs.dailyHours")}
                                </label>
                                <span className="text-[10px] font-mono text-miku font-bold">
                                    {t("page.prediction.planner.inputs.dailyHoursUnit", { hours: dailyAvailableHours })}
                                </span>
                            </div>
                            <div className="relative mb-1.5">
                                <input
                                    type="number"
                                    min={1}
                                    max={server === 'jp' ? 18 : 24}
                                    value={dailyAvailableHours}
                                    onChange={(e) => setDailyAvailableHours(Math.max(1, Number(e.target.value)))}
                                    className="w-full pl-3 pr-14 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-200"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                                    {t("page.prediction.planner.inputs.hoursSuffix")}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {[2, 4, 6, 8, 12].map((h) => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setDailyAvailableHours(h)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                            dailyAvailableHours === h
                                                ? 'bg-miku/20 text-miku font-bold border border-miku/40'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        {h}h
                                    </button>
                                ))}
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400 leading-tight">
                                {t("page.prediction.planner.inputs.dailyHoursHint")}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    {t("page.prediction.planner.inputs.dailyAuto")}
                                </label>
                                <span className="text-[10px] font-mono text-miku font-bold">
                                    {t("page.prediction.planner.inputs.dailyAutoUnit", { count: dailyAutoBudget })}
                                </span>
                            </div>
                            <div className="relative mb-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={dailyAutoBudget}
                                    onChange={(e) => setDailyAutoBudget(Math.max(0, Number(e.target.value)))}
                                    className="w-full pl-3 pr-12 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-200"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 select-none">
                                    {t("page.prediction.planner.inputs.runsSuffix")}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {[0, 10, 30, 99].map((cnt) => (
                                    <button
                                        key={cnt}
                                        type="button"
                                        onClick={() => setDailyAutoBudget(cnt)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                            dailyAutoBudget === cnt
                                                ? 'bg-miku/20 text-miku font-bold border border-miku/40'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        {cnt === 10
                                            ? t("page.prediction.planner.inputs.runsChipFree", { count: cnt })
                                            : t("page.prediction.planner.inputs.runsChip", { count: cnt })}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400 leading-tight">
                                {t("page.prediction.planner.inputs.dailyAutoHint")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Area: Strategy Plan Output Cards (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col justify-between">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {/* Deficit */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.results.deficit")}
                            </span>
                            <span className="text-base sm:text-lg font-black font-mono text-slate-800 dark:text-slate-100">
                                {plan.scoreDeficit > 0 ? `+${formatNumber(plan.scoreDeficit)}` : '0'}
                            </span>
                        </div>

                        {/* Daily Manual Hours */}
                        <div className={`p-3.5 rounded-xl border ${feasibilityStyle.bgCardClass}`}>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.results.manualHours")}
                            </span>
                            <span className={`text-base sm:text-lg font-black font-mono ${feasibilityStyle.textClass}`}>
                                {t("page.prediction.planner.results.hoursPerDay", { hours: plan.requiredManualHoursDaily })}
                            </span>
                        </div>

                        {/* Daily Auto plays */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.results.autoPlays")}
                            </span>
                            <span className="text-base sm:text-lg font-black font-mono text-slate-800 dark:text-slate-100">
                                {t("page.prediction.planner.results.playsPerDay", { count: plan.requiredAutoRunsDaily })}
                            </span>
                        </div>

                        {/* Hourly Manual Speed */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.results.hourlySpeed")}
                            </span>
                            <span className="text-base sm:text-lg font-black font-mono text-slate-700 dark:text-slate-300">
                                {formatNumber(plan.hourlyManualSpeed)}
                            </span>
                        </div>

                        {/* Total Energy Drinks Needed */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                                {t("page.prediction.planner.results.totalDrinks")}
                            </span>
                            <span className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                                {t("page.prediction.planner.results.drinksUnit", {
                                    count: plan.totalLargeDrinks,
                                    crystals: formatNumber(plan.totalCrystals)
                                })}
                            </span>
                        </div>
                    </div>

                    {/* Context Advice Box */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs leading-relaxed space-y-2">
                        <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                            <svg className="w-4 h-4 text-miku shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                            </svg>
                            <span>
                                {server === 'jp' && (plan.feasibility === 'impossible' || plan.feasibility === 'hard')
                                    ? t(`page.prediction.planner.results.tips.${plan.feasibility}Jp`)
                                    : t(`page.prediction.planner.results.tips.${plan.feasibility}`)}
                            </span>
                        </div>

                        {server === 'jp' && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
                                💡 {t("page.prediction.planner.results.tips.jpFatigueNote")}
                            </div>
                        )}

                        {/* Dynamic Song Comparison Note */}
                        {plan.scoreDeficit > 0 && selectedSong === 'envy' && (
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 pl-6">
                                🔄 {t("page.prediction.planner.results.comparison.switchToLostAndFound", {
                                    drinks: plan.totalLargeDrinks - altPlan.totalLargeDrinks,
                                    crystals: formatNumber((plan.totalLargeDrinks - altPlan.totalLargeDrinks) * 100),
                                    hours: Math.max(0, (altPlan.requiredManualHoursDaily - plan.requiredManualHoursDaily)).toFixed(1)
                                })}
                            </div>
                        )}
                        {plan.scoreDeficit > 0 && selectedSong === 'lost_and_found' && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 pl-6">
                                ⚡ {t("page.prediction.planner.results.comparison.switchToEnvy", {
                                    drinks: altPlan.totalLargeDrinks - plan.totalLargeDrinks,
                                    hours: Math.max(0, (plan.requiredManualHoursDaily - altPlan.requiredManualHoursDaily)).toFixed(1)
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
