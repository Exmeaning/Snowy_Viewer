"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ExternalLink from "@/components/ExternalLink";
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

const MUSIC_META_API = "https://assets.exmeaning.com/musicmeta/music_metas.json";

const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Easy" },
    { value: "normal", label: "Normal" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
    { value: "master", label: "Master" },
    { value: "append", label: "Append" },
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
        const title = music ? music.title : `Music ${musicId}`;

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
            setError("请选择歌曲，并确保所选难度有对应Meta数据");
            return;
        }
        if (!userPower || userPower <= 0) {
            setError("请输入有效的综合力");
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

            // PT 计算
            const pt = calc.calculatePT(res, selectedMeta, deckBonus, fires);
            setPtResult(pt);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "计算出错";
            setError(message);
            setResult(null);
            setPtResult(null);
        }
    }, [selectedMeta, userPower, userEffectiveness, allSameTeammate, teammatePower, teammateEffectiveness, teammates, skill6Mode, skill15Strategy, deckBonus, fires]);

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
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">Deck Comparator</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        组卡<span className="text-miku">比较器</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                        多人Live PT简易计算器，快速比较不同歌曲和配置的得分差异
                    </p>
                </div>

                {/* Mobile Info */}
                <div className="dc-mobile-info glass-card p-3 rounded-xl mb-6 flex items-center gap-2 text-sm text-blue-700 bg-blue-50/80 border border-blue-200/50">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>无需上传数据，手动输入综合力和实效即可快速计算PT。</span>
                </div>

                {/* Input Form */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                        歌曲与难度
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
                                    ⚠️ 该歌曲的 {difficulty.toUpperCase()} 难度暂无Meta数据
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">难度</label>
                            <div className="flex flex-wrap gap-2">
                                {DIFFICULTY_OPTIONS.map((d) => {
                                    let activeClass = "";
                                    switch (d.value) {
                                        case "easy": activeClass = "bg-blue-500 text-white shadow-blue-500/20"; break;
                                        case "normal": activeClass = "bg-emerald-500 text-white shadow-emerald-500/20"; break;
                                        case "hard": activeClass = "bg-orange-500 text-white shadow-orange-500/20"; break;
                                        case "expert": activeClass = "bg-red-500 text-white shadow-red-500/20"; break;
                                        case "master": activeClass = "bg-purple-500 text-white shadow-purple-500/20"; break;
                                        case "append": activeClass = "bg-fuchsia-500 text-white shadow-fuchsia-500/20"; break;
                                        default: activeClass = "bg-miku text-white shadow-miku/20";
                                    }
                                    return (
                                        <button
                                            key={d.value}
                                            onClick={() => setDifficulty(d.value)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shadow-md ${difficulty === d.value
                                                ? activeClass
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-none"
                                                }`}
                                        >
                                            {d.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Config */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                        玩家配置
                    </h2>

                    {/* User Power + Effectiveness + Deck Bonus */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                我的综合力 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={userPower}
                                onChange={(e) => setUserPower(Number(e.target.value))}
                                placeholder="280000"
                                className="dc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                我的实效 (%)
                            </label>
                            <input
                                type="number"
                                value={userEffectiveness}
                                onChange={(e) => setUserEffectiveness(Number(e.target.value))}
                                placeholder="250"
                                className="dc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                卡组加成 (%)
                            </label>
                            <input
                                type="number"
                                value={deckBonus}
                                onChange={(e) => setDeckBonus(Number(e.target.value))}
                                placeholder="150"
                                className="dc-number-input w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                            />
                            <p className="mt-1 text-xs text-slate-400">活动卡组加成百分比，如150表示150%</p>
                        </div>
                    </div>

                    {/* Teammate Config */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-slate-700">
                                队友配置 (4人)
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">全队相同</span>
                                <button
                                    onClick={() => setAllSameTeammate(!allSameTeammate)}
                                    className={`dc-toggle relative w-11 h-6 rounded-full ${allSameTeammate ? 'bg-miku' : 'bg-slate-200'}`}
                                >
                                    <span
                                        className={`dc-toggle-knob absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow ${allSameTeammate ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {allSameTeammate ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">综合力</label>
                                    <input
                                        type="number"
                                        value={teammatePower}
                                        onChange={(e) => setTeammatePower(Number(e.target.value))}
                                        className="dc-number-input w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">实效 (%)</label>
                                    <input
                                        type="number"
                                        value={teammateEffectiveness}
                                        onChange={(e) => setTeammateEffectiveness(Number(e.target.value))}
                                        className="dc-number-input w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {teammates.map((tm, i) => (
                                    <div key={i} className="dc-teammate-row grid grid-cols-[auto_1fr_1fr] gap-2 items-center p-2 rounded-lg">
                                        <span className="text-xs font-bold text-slate-400 w-6 text-center">
                                            P{i + 2}
                                        </span>
                                        <input
                                            type="number"
                                            value={tm.power}
                                            onChange={(e) => updateTeammate(i, 'power', Number(e.target.value))}
                                            placeholder="综合力"
                                            className="dc-number-input w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                        />
                                        <input
                                            type="number"
                                            value={tm.effectiveness}
                                            onChange={(e) => updateTeammate(i, 'effectiveness', Number(e.target.value))}
                                            placeholder="实效%"
                                            className="dc-number-input w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Skill6 Mode + Skill1-5 Strategy */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Skill6 模式</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSkill6Mode(Skill6Mode.TEAM_AVERAGE)}
                                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${skill6Mode === Skill6Mode.TEAM_AVERAGE
                                        ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                        : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                                        }`}
                                >
                                    全队平均实效
                                </button>
                                <button
                                    onClick={() => setSkill6Mode(Skill6Mode.HIGHEST_POWER)}
                                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${skill6Mode === Skill6Mode.HIGHEST_POWER
                                        ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                        : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                                        }`}
                                >
                                    最高综合实效
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Skill1-5 策略</label>
                            <div className="flex gap-2">
                                {[
                                    { value: Skill15Strategy.EXPECTED, label: "期望值" },
                                    { value: Skill15Strategy.BEST, label: "最优" },
                                    { value: Skill15Strategy.WORST, label: "最差" },
                                ].map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => setSkill15Strategy(s.value)}
                                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${skill15Strategy === s.value
                                            ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                            : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Fire Count */}
                    <div className="mb-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                火罐数量 (0-10)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={fires}
                                    min={0}
                                    max={10}
                                    onChange={(e) => setFires(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                                    className="dc-number-input w-24 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                />
                                <span className="text-sm text-slate-500">
                                    当前倍率: <span className="font-bold text-orange-500">×{getBoostRate(fires)}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Calculate Button */}
                    <button
                        onClick={handleCalculate}
                        disabled={!selectedMeta}
                        className="w-full px-6 py-3 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        计算 PT
                    </button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="glass-card p-4 rounded-2xl mb-6 bg-red-50/80 border border-red-200/50">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="dc-score-enter glass-card p-5 sm:p-6 rounded-2xl mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                                计算结果
                            </h2>
                            <button
                                onClick={handleSaveHistory}
                                className="px-3 py-1.5 bg-miku/10 text-miku text-xs font-bold rounded-lg hover:bg-miku/20 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                保存结果
                            </button>
                        </div>

                        {/* Main PT */}
                        {ptResult && (
                            <div className="text-center mb-6 pb-6 border-b border-slate-100">
                                <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">活动 PT</div>
                                <div className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent font-mono">
                                    {ptResult.pt.toLocaleString()}
                                </div>
                                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-slate-400">
                                    <span>基础PT: {ptResult.basePT}</span>
                                    <span>·</span>
                                    <span>歌曲倍率: {ptResult.eventRate}%</span>
                                    <span>·</span>
                                    <span>卡组: ×{ptResult.deckRate.toFixed(2)}</span>
                                    <span>·</span>
                                    <span>火罐: ×{ptResult.boostRate}</span>
                                </div>
                            </div>
                        )}

                        {/* Main Score */}
                        <div className="text-center mb-6">
                            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">预计得分</div>
                            <div className="text-4xl sm:text-5xl font-black text-miku font-mono">
                                {result.score.toLocaleString()}
                            </div>
                            {ptResult && (
                                <div className="text-xs text-slate-400 mt-1">
                                    队友总得分: {ptResult.otherScore.toLocaleString()}
                                </div>
                            )}
                        </div>

                        {/* Score Breakdown Bar */}
                        <div className="mb-6">
                            <div className="dc-breakdown-bar">
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
                                { label: "基础分", value: result.baseScorePart, color: breakdownColors.base },
                                { label: "Skill1-5", value: result.skill15Part, color: breakdownColors.skill15 },
                                { label: "Skill6", value: result.skill6Part, color: breakdownColors.skill6 },
                                { label: "活跃加分", value: result.activeBonus, color: breakdownColors.active },
                            ].map((item) => (
                                <div key={item.label} className="dc-result-card rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-slate-500">{item.label}</span>
                                    </div>
                                    <div className="text-sm font-bold text-primary-text font-mono">
                                        {item.value.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            <div className="dc-result-card rounded-xl p-3 border border-slate-100">
                                <div className="text-xs text-slate-500 mb-1">全队综合力</div>
                                <div className="text-sm font-bold text-primary-text font-mono">
                                    {result.totalPower.toLocaleString()}
                                </div>
                            </div>
                            <div className="dc-result-card rounded-xl p-3 border border-slate-100">
                                <div className="text-xs text-slate-500 mb-1">Skill6 实效</div>
                                <div className="text-sm font-bold text-primary-text font-mono">
                                    {result.skill6Effectiveness.toFixed(1)}%
                                </div>
                            </div>
                            <div className="dc-result-card rounded-xl p-3 border border-slate-100 col-span-2 sm:col-span-1">
                                <div className="text-xs text-slate-500 mb-1">波动幅度</div>
                                <div className="text-sm font-bold text-primary-text font-mono">
                                    ±{((result.details.scoreBest - result.details.scoreWorst) / 2).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Best / Worst Reference */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="dc-result-card rounded-xl p-3 border border-emerald-100 bg-emerald-50/50">
                                <div className="text-xs text-emerald-600 mb-1">最优排列得分</div>
                                <div className="text-sm font-bold text-emerald-700 font-mono">
                                    {result.details.scoreBest.toLocaleString()}
                                </div>
                            </div>
                            <div className="dc-result-card rounded-xl p-3 border border-red-100 bg-red-50/50">
                                <div className="text-xs text-red-500 mb-1">最差排列得分</div>
                                <div className="text-sm font-bold text-red-600 font-mono">
                                    {result.details.scoreWorst.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History List */}
                {history.length > 0 && (
                    <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-slate-400 rounded-full"></span>
                                历史记录
                            </h2>
                            <span className="text-xs text-slate-400">
                                {history.length} 条记录
                            </span>
                        </div>

                        <div className="space-y-3">
                            {history.map((item) => (
                                <div key={item.id} className="relative group bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all">
                                    {/* Song Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-sm font-bold text-slate-700 truncate">
                                                {item.musicTitle}
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${item.difficulty === 'master' ? 'bg-purple-100 text-purple-600' :
                                                    item.difficulty === 'expert' ? 'bg-red-100 text-red-600' :
                                                        item.difficulty === 'append' ? 'bg-fuchsia-100 text-fuchsia-600' :
                                                            'bg-slate-100 text-slate-500'
                                                }`}>
                                                {item.difficulty}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>综合: {(item.userPower / 10000).toFixed(1)}w</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>加成: {item.deckBonus}%</span>
                                            <span className="hidden sm:inline">·</span>
                                            <span>{item.fires}🔥</span>
                                        </div>
                                    </div>

                                    {/* Score Info */}
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-miku font-mono">
                                            {item.pt.toLocaleString()} PT
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">
                                            {item.score.toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteHistory(item.id)}
                                        className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-red-200 hover:scale-110"
                                        title="删除"
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
                <div className="mt-12 text-center text-xs text-slate-400">
                    <p className="mb-1">
                        计算公式修改于 xfl03(33) 的 <ExternalLink href="https://github.com/xfl03/sekai-calculator" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-miku hover:underline">sekai-calculator</ExternalLink>
                    </p>
                    <p>
                        sekai-calculator 采用 LGPL-2.1 开源协议，计算结果仅供参考
                    </p>
                </div>
            </div>

        </MainLayout>
    );
}
