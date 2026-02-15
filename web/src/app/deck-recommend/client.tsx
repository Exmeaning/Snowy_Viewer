"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from "next/link";
import ExternalLink from "@/components/ExternalLink";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { UNIT_DATA, CHARACTER_NAMES, CHAR_NAMES } from "@/types/types";
import CharacterSelector from "@/components/deck-recommend/CharacterSelector";
import { getCharacterIconUrl, getCardThumbnailUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import EventSelector from "@/components/deck-recommend/EventSelector";
import MusicSelector from "@/components/deck-recommend/MusicSelector";
import "./deck-recommend.css";

// ==================== Types ====================
interface CardConfigItem {
    disable: boolean;
    rankMax: boolean;
    episodeRead: boolean;
    masterMax: boolean;
    skillMax: boolean;
}

type DeckMode = "challenge" | "event";
type ServerType = "jp" | "cn" | "tw";

const SERVER_OPTIONS: { value: ServerType; label: string }[] = [
    { value: "cn", label: "简中服 (CN)" },
    { value: "jp", label: "日服 (JP)" },
    { value: "tw", label: "繁中服 (TW)" },
];

const DIFFICULTY_OPTIONS = [
    { value: "easy", label: "Easy" },
    { value: "normal", label: "Normal" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
    { value: "master", label: "Master" },
    { value: "append", label: "Append" },
];

const LIVE_TYPE_OPTIONS = [
    { value: "multi", label: "多人 (Multi)" },
    { value: "solo", label: "单人 (Solo)" },
    { value: "auto", label: "自动 (Auto)" },
    { value: "cheerful", label: "嘉年华 (Cheerful)" },
];

const RARITY_CONFIG_KEYS = [
    { key: "rarity_1", label: "★1", color: "#888888" },
    { key: "rarity_2", label: "★2", color: "#88BB44" },
    { key: "rarity_3", label: "★3", color: "#4488DD" },
    { key: "rarity_4", label: "★4", color: "#FFAA00" },
    { key: "rarity_birthday", label: "Birthday", color: "#FF6699" },
];

const DEFAULT_CARD_CONFIG: Record<string, CardConfigItem> = {
    rarity_1: { disable: true, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: true, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
};



// ==================== Helper: error message mapping ====================
function getErrorMessage(error: string): string {
    switch (error) {
        case "USER_NOT_FOUND":
            return "用户数据未找到，请确认用户ID/所选服务器是否正确，并已在 Haruki 上传数据。";
        case "API_NOT_PUBLIC":
            return "该用户的公开API未开启，请先在 Haruki 上开启公开API。";
        default:
            if (error.includes("404")) return "用户数据未找到 (404)";
            if (error.includes("403")) return "公开API未开启 (403)";
            return error;
    }
}

// ==================== Main Component ====================
export default function DeckRecommendClient() {
    const { assetSource } = useTheme();

    // Form state
    const [userId, setUserId] = useState("");
    const [server, setServer] = useState<ServerType>("jp");
    const [mode, setMode] = useState<DeckMode>("event");
    const [characterId, setCharacterId] = useState<number | null>(null);
    const [eventId, setEventId] = useState("");
    const [liveType, setLiveType] = useState("multi");
    const [supportCharacterId, setSupportCharacterId] = useState<number | null>(null);
    const [musicId, setMusicId] = useState("");
    const [difficulty, setDifficulty] = useState("master");
    const [cardConfig, setCardConfig] = useState<Record<string, CardConfigItem>>(
        JSON.parse(JSON.stringify(DEFAULT_CARD_CONFIG))
    );

    // UI state
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState<any[] | null>(null);
    const [challengeHighScore, setChallengeHighScore] = useState<any>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [dataTime, setDataTime] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [allowSaveUserId, setAllowSaveUserId] = useState(false);
    const [showCardConfig, setShowCardConfig] = useState(false);



    // Cards master data (for result display)
    const [cardsMaster, setCardsMaster] = useState<any[]>([]);
    const [userCards, setUserCards] = useState<any[]>([]);

    // Worker ref
    const workerRef = useRef<Worker | null>(null);

    // Load music list on mount
    useEffect(() => {
        fetchMasterData<any[]>("cards.json").then((cards) => {
            setCardsMaster(cards);
        }).catch(console.error);

        // Load saved User ID
        const savedUserId = localStorage.getItem("deck_recommend_userid");
        if (savedUserId) {
            setUserId(savedUserId);
            setAllowSaveUserId(true);
        }
    }, []);





    // Update card config
    const updateCardConfig = useCallback((rarity: string, field: keyof CardConfigItem, value: boolean) => {
        setCardConfig((prev) => ({
            ...prev,
            [rarity]: { ...prev[rarity], [field]: value },
        }));
    }, []);

    // Start calculation
    const handleCalculate = useCallback(() => {
        // Validation
        if (!userId.trim()) {
            setError("请输入用户ID");
            return;
        }
        if (!musicId) {
            setError("请选择歌曲");
            return;
        }
        if (mode === "challenge" && !characterId) {
            setError("请选择角色");
            return;
        }
        if (mode === "event" && !eventId.trim()) {
            setError("请输入活动ID");
            return;
        }

        setError(null);
        setResults(null);
        setChallengeHighScore(null);
        setDuration(null);
        setDataTime(null);
        setIsCalculating(true);

        // Build cardConfig for sekai-calculator
        const configForCalc: Record<string, any> = {};
        for (const [key, val] of Object.entries(cardConfig)) {
            if (val.disable) {
                configForCalc[key] = { disable: true };
            } else {
                configForCalc[key] = {
                    rankMax: val.rankMax,
                    episodeRead: val.episodeRead,
                    masterMax: val.masterMax,
                    skillMax: val.skillMax,
                };
            }
        }

        const workerArgs = {
            mode,
            userId: userId.trim(),
            server,
            musicId: parseInt(musicId),
            difficulty,
            characterId: characterId || undefined,
            eventId: eventId ? parseInt(eventId) : undefined,
            liveType,
            supportCharacterId: supportCharacterId || undefined,
            cardConfig: configForCalc,
        };

        // Create and run worker
        if (workerRef.current) {
            workerRef.current.terminate();
        }

        const worker = new Worker(
            new URL("@/lib/deck-recommend/worker.ts", import.meta.url)
        );
        workerRef.current = worker;

        worker.onmessage = (event) => {
            const data = event.data;
            if (data.error) {
                setError(getErrorMessage(data.error));
            } else {
                setResults(data.result || []);
                setChallengeHighScore(data.challengeHighScore || null);
                if (data.userCards) setUserCards(data.userCards);
                setDuration(data.duration || null);
                if (data.upload_time) setDataTime(data.upload_time);
            }
            setIsCalculating(false);
            worker.terminate();
            workerRef.current = null;
        };

        worker.onerror = (err) => {
            setError(`Worker 错误: ${err.message}`);
            setIsCalculating(false);
            worker.terminate();
            workerRef.current = null;
        };

        worker.postMessage({ args: workerArgs });
    }, [userId, server, mode, characterId, eventId, liveType, supportCharacterId, musicId, difficulty, cardConfig]);

    // Cancel calculation
    const handleCancel = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setIsCalculating(false);
    }, []);

    // Find card master data by ID
    const getCardMaster = useCallback((cardId: number) => {
        return cardsMaster.find((c: any) => c.id === cardId);
    }, [cardsMaster]);



    return (
        <MainLayout activeNav="工具">
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Page Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">Deck Recommender</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        组卡<span className="text-miku">推荐器</span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm sm:text-base">
                        基于 sekai-calculator 的卡组推荐工具，自动计算最优卡组
                    </p>
                </div>

                {/* Mobile Warning */}
                <div className="dr-mobile-warning glass-card p-3 rounded-xl mb-6 flex items-center gap-2 text-sm text-amber-700 bg-amber-50/80 border border-amber-200/50">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>SnowyViewer不保存任何数据，完全基于本地计算，建议在电脑或 iPad 上使用以获得更好的性能体验。</span>
                </div>

                {/* Input Form */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                    <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                        基本设置
                    </h2>

                    {/* Mode Tabs */}
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-slate-700 mb-2">推荐模式</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode("event")}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${mode === "event"
                                    ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                    : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                                    }`}
                            >
                                活动
                            </button>
                            <button
                                onClick={() => setMode("challenge")}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${mode === "challenge"
                                    ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20"
                                    : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                                    }`}
                            >
                                挑战Live
                            </button>
                        </div>
                    </div>

                    {/* User ID + Server */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                用户ID <span className="text-red-400">*</span>
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setUserId(newVal);
                                        if (allowSaveUserId) {
                                            localStorage.setItem("deck_recommend_userid", newVal);
                                        }
                                    }}
                                    placeholder="输入游戏ID"
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all text-sm"
                                />
                            </div>

                            <div className="flex items-center justify-between mt-2 px-1">
                                <span className="text-sm text-slate-500">保存在浏览器本地</span>
                                <button
                                    onClick={() => {
                                        const newState = !allowSaveUserId;
                                        setAllowSaveUserId(newState);
                                        if (newState) {
                                            localStorage.setItem("deck_recommend_userid", userId);
                                        } else {
                                            localStorage.removeItem("deck_recommend_userid");
                                        }
                                    }}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${allowSaveUserId ? 'bg-miku' : 'bg-slate-200'}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${allowSaveUserId ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                                需先在 <ExternalLink href="https://haruki.seiunx.com" target="_blank" rel="noopener noreferrer" className="text-miku hover:underline">Haruki工具箱</ExternalLink> 上传数据并开启公开API
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">服务器</label>
                            <div className="flex flex-wrap gap-2">
                                {SERVER_OPTIONS.map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => setServer(s.value)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${server === s.value
                                            ? "bg-miku text-white shadow-md shadow-miku/20"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>



                    {/* Challenge Mode: Character Selector */}
                    {mode === "challenge" && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                挑战角色 <span className="text-red-400">*</span>
                            </label>
                            <CharacterSelector
                                selectedCharacterId={characterId}
                                onSelect={setCharacterId}
                            />
                        </div>
                    )}

                    {/* Event Mode: Event ID + Live Type */}
                    {mode === "event" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div>
                                <EventSelector
                                    selectedEventId={eventId}
                                    onSelect={(id) => setEventId(id)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Live类型</label>
                                <div className="flex flex-wrap gap-2">
                                    {LIVE_TYPE_OPTIONS.map((lt) => (
                                        <button
                                            key={lt.value}
                                            onClick={() => setLiveType(lt.value)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${liveType === lt.value
                                                ? "bg-miku text-white shadow-md shadow-miku/20"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                }`}
                                        >
                                            {lt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 font-medium">支援角色</span>
                                            <span className="text-slate-400 text-xs text-left">World Bloom 活动可选</span>
                                        </div>
                                        <button
                                            onClick={() => setSupportCharacterId(supportCharacterId !== null ? null : 0)}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${supportCharacterId !== null ? 'bg-miku' : 'bg-slate-200'}`}
                                        >
                                            <span
                                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${supportCharacterId !== null ? 'translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </button>
                                    </div>

                                    {supportCharacterId !== null && (
                                        <div className="mt-4 pt-3 border-t border-slate-200/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <CharacterSelector
                                                selectedCharacterId={supportCharacterId}
                                                onSelect={setSupportCharacterId}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Song Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <MusicSelector
                                selectedMusicId={musicId}
                                onSelect={(id) => setMusicId(id)}
                                recommendMode={mode}
                                liveType={liveType}
                            />
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

                    {/* Card Config Toggle */}
                    <div className="mb-5">
                        <button
                            onClick={() => setShowCardConfig(!showCardConfig)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-miku transition-colors"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${showCardConfig ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            卡牌养成配置
                        </button>

                        {showCardConfig && (
                            <div className="mt-3 overflow-x-auto">
                                <table className="dr-config-table w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th className="text-left py-2 px-2 text-slate-500 font-medium">稀有度</th>
                                            <th className="py-2 px-2 text-slate-500 font-medium">禁用</th>
                                            <th className="py-2 px-2 text-slate-500 font-medium">满级</th>
                                            <th className="py-2 px-2 text-slate-500 font-medium">前后篇</th>
                                            <th className="py-2 px-2 text-slate-500 font-medium">满突破</th>
                                            <th className="py-2 px-2 text-slate-500 font-medium">满技能</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {RARITY_CONFIG_KEYS.map(({ key, label, color }) => (
                                            <tr key={key} className="border-t border-slate-100">
                                                <td className="py-2 px-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {key === "rarity_birthday" ? (
                                                            <div className="w-4 h-4 relative">
                                                                <Image
                                                                    src="/data/icon/birthday.webp"
                                                                    alt="Birthday"
                                                                    fill
                                                                    className="object-contain"
                                                                    unoptimized
                                                                />
                                                            </div>
                                                        ) : (
                                                            Array.from({ length: parseInt(key.split("_")[1]) }).map((_, i) => (
                                                                <div key={i} className="w-3 h-3 relative">
                                                                    <Image
                                                                        src="/data/icon/star.webp"
                                                                        alt="Star"
                                                                        fill
                                                                        className="object-contain"
                                                                        unoptimized
                                                                    />
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={cardConfig[key].disable}
                                                        onChange={(e) => updateCardConfig(key, "disable", e.target.checked)}
                                                        className="dr-checkbox"
                                                    />
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={cardConfig[key].rankMax}
                                                        onChange={(e) => updateCardConfig(key, "rankMax", e.target.checked)}
                                                        disabled={cardConfig[key].disable}
                                                        className="dr-checkbox"
                                                    />
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={cardConfig[key].episodeRead}
                                                        onChange={(e) => updateCardConfig(key, "episodeRead", e.target.checked)}
                                                        disabled={cardConfig[key].disable}
                                                        className="dr-checkbox"
                                                    />
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={cardConfig[key].masterMax}
                                                        onChange={(e) => updateCardConfig(key, "masterMax", e.target.checked)}
                                                        disabled={cardConfig[key].disable}
                                                        className="dr-checkbox"
                                                    />
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={cardConfig[key].skillMax}
                                                        onChange={(e) => updateCardConfig(key, "skillMax", e.target.checked)}
                                                        disabled={cardConfig[key].disable}
                                                        className="dr-checkbox"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold shadow-lg shadow-miku/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isCalculating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    计算中...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    开始计算
                                </>
                            )}
                        </button>
                        {isCalculating && (
                            <button
                                onClick={handleCancel}
                                className="px-6 py-3 border-2 border-red-400 text-red-500 rounded-xl font-bold hover:bg-red-50 active:scale-[0.98] transition-all"
                            >
                                取消
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="glass-card p-4 rounded-2xl mb-6 bg-red-50/80 border border-red-200/50">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && results.length > 0 && (
                    <div className="glass-card p-5 sm:p-6 rounded-2xl mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-miku rounded-full"></span>
                                推荐卡组 Top {results.length}
                            </h2>
                            {duration !== null && (
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-slate-400 font-mono">
                                        耗时 {(duration / 1000).toFixed(2)}s
                                    </span>
                                    {dataTime && (
                                        <span className="text-xs text-slate-400 font-mono">
                                            数据更新于 {new Date(dataTime * 1000).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {challengeHighScore && (
                            <div className="mb-4 px-3 py-2 bg-amber-50 rounded-lg text-sm text-amber-700">
                                当前挑战Live最高分: <span className="font-bold">{challengeHighScore.highScore?.toLocaleString() || "无记录"}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {results.map((deck: any, index: number) => (
                                <DeckResultRow
                                    key={index}
                                    deck={deck}
                                    rank={index + 1}
                                    getCardMaster={getCardMaster}
                                    assetSource={assetSource}
                                    mode={mode}
                                    userCards={userCards}
                                />

                            ))}
                        </div>
                    </div>
                )}

                {results && results.length === 0 && (
                    <div className="glass-card p-8 rounded-2xl mb-6 text-center">
                        <p className="text-slate-500">未找到可推荐的卡组，请检查您的卡牌数据和配置。</p>
                    </div>
                )}

                <div className="mt-12 text-center text-xs text-slate-400">
                    <p className="mb-1">
                        组卡推荐器源代码采用xfl03(33)的 <ExternalLink href="https://github.com/xfl03/sekai-calculator" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-miku hover:underline">sekai-calculator</ExternalLink>
                    </p>
                    <p>
                        sekai-calculator采用 LGPL-2.1 开源协议 计算结果仅供参考
                    </p>
                </div>
            </div>
        </MainLayout >
    );
}

// ==================== Deck Result Row ====================
function DeckResultRow({
    deck,
    rank,
    getCardMaster,
    assetSource,
    mode,
    userCards,
}: {
    deck: any;
    rank: number;
    getCardMaster: (id: number) => any;
    assetSource: any;
    mode: DeckMode;
    userCards: any[];
}) {
    const [showDetails, setShowDetails] = useState(false);

    // Get total power
    const totalPower = deck.cards?.reduce((sum: number, card: any) => {
        const p = card.power;
        if (!p) return sum;
        return sum + (p.base || 0) + (p.areaItem || 0) + (p.characterRank || 0) +
            (p.honor || 0) + (p.mysekaiGate || 0) + (p.mysekaiCanvas || 0) + (p.masterRank || 0);
    }, 0) || 0;

    // Event bonus
    const eventBonus = deck.eventBonus ?? (deck.cards?.reduce((sum: number, card: any) => {
        if (!card.eventBonus) return sum;
        return sum + (card.eventBonus.total || card.eventBonus.all || 0);
    }, 0) || 0);

    return (
        <div className="dr-result-row rounded-xl border border-slate-100 overflow-hidden hover:border-miku/30 transition-all">
            {/* Summary Row */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 text-left hover:bg-slate-50/50 transition-colors"
            >
                {/* Mobile Top Row: Rank + Score + Expand Icon */}
                <div className="flex items-center justify-between sm:justify-start gap-3">
                    <div className="flex items-center gap-3">
                        {/* Rank */}
                        <div className={`dr-rank flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rank === 1 ? "bg-amber-400 text-white" :
                            rank === 2 ? "bg-slate-400 text-white" :
                                rank === 3 ? "bg-amber-700 text-white" :
                                    "bg-slate-100 text-slate-500"
                            }`}>
                            {rank}
                        </div>

                        {/* Score */}
                        <div className="flex-shrink-0 min-w-[80px]">
                            <div className="text-xs text-slate-400">{mode === "challenge" ? "分数" : "PT"}</div>
                            <div className="font-bold text-primary-text text-sm">
                                {Math.floor(deck.score).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Expand Icon */}
                    <svg
                        className={`w-4 h-4 text-slate-400 transition-transform sm:hidden ${showDetails ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Card Thumbnails (Mobile Bottom Row) */}
                <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar mask-gradient-right sm:overflow-visible sm:mask-none">
                    {deck.cards?.slice(0, 5).map((card: any, i: number) => {
                        const masterCard = getCardMaster(card.cardId);
                        const userCard = userCards.find((u) => u.cardId === card.cardId);

                        // Determind render properties
                        let rarity = masterCard?.rarity || 1;
                        // Use masterCard or card for rarity type check (masterCard is more reliable)
                        const rarityType = masterCard?.cardRarityType || card.cardRarityType;
                        const isBirthday = rarityType === "rarity_birthday";

                        if (rarityType) {
                            switch (rarityType) {
                                case "rarity_1": rarity = 1; break;
                                case "rarity_2": rarity = 2; break;
                                case "rarity_3": rarity = 3; break;
                                case "rarity_4": rarity = 4; break;
                                case "rarity_birthday": rarity = 4; break;
                            }
                        }

                        const masterRank = userCard?.masterRank ?? card.masterRank ?? 0;
                        const level = userCard?.level ?? card.level ?? 1;

                        // Should show trained image?
                        // Rule: Trained if (Master Rank > 0 OR Rarity >= 3) AND NOT Birthday
                        // Birthday cards only have normal image (no trained version)
                        const showTrained = (card.masterRank > 0 || rarityType === "rarity_3" || rarityType === "rarity_4") && !isBirthday;


                        if (!masterCard) {
                            return (
                                <div key={i} className="dr-card-thumb w-10 h-10 sm:w-12 sm:h-12 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
                                    ?
                                </div>
                            );
                        }
                        return (
                            <div key={i} className="relative flex flex-col items-center gap-0.5 flex-shrink-0">
                                <div className="dr-card-thumb relative w-10 h-10 sm:w-12 sm:h-12 rounded overflow-hidden flex-shrink-0 ring-1 ring-slate-200">
                                    <Link href={`/cards/${card.cardId}`} className="block relative w-full h-full" target="_blank">
                                        <Image
                                            src={getCardThumbnailUrl(
                                                masterCard.characterId,
                                                masterCard.assetbundleName,
                                                showTrained,
                                                assetSource
                                            )}
                                            alt={`Card ${card.cardId}`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </Link>
                                    {/* Attribute Badge */}
                                    {masterCard.attr && (
                                        <div className="absolute top-0.5 left-0.5 w-3 h-3 drop-shadow-md z-10">
                                            <Image
                                                src={`/data/icon/${masterCard.attr}.webp`}
                                                alt={masterCard.attr}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                    {/* Rarity & Birthday Badge */}
                                    <div className="absolute top-0.5 right-0.5 z-10">
                                        <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[10px]">
                                            {isBirthday ? (
                                                <div className="w-2.5 h-2.5 relative">
                                                    <Image
                                                        src="/data/icon/birthday.webp"
                                                        alt="Birthday"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-white text-[6px] font-bold leading-none">{rarity}</span>
                                                    <div className="w-1.5 h-1.5 relative">
                                                        <Image
                                                            src="/data/icon/star.webp"
                                                            alt="Star"
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {i === 0 && (
                                        <div className="absolute bottom-0 right-0 bg-miku/90 text-white text-[8px] font-bold px-1 py-[1px] rounded-tl-md leading-none backdrop-blur-[1px]">
                                            L
                                        </div>
                                    )}
                                </div>
                                <div className="text-[9px] sm:text-[10px] text-slate-500 font-mono leading-none flex items-center gap-0.5">
                                    <span>Lv.{level}</span>
                                    {masterRank > 0 && (
                                        <span className="bg-slate-100 text-slate-600 rounded-full px-[3px] py-[1px] flex items-center gap-[1px] leading-none border border-slate-200">
                                            <span className="text-[7px]">🔷</span>
                                            <span className="text-[8px] font-bold">{masterRank}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Power & Event Bonus */}
                {/* <div className="flex-shrink-0 text-right hidden sm:block">
                    <div className="text-xs text-slate-400">总战力</div>
                    <div className="font-bold text-sm text-primary-text">{totalPower.toLocaleString()}</div>
                </div> */}

                {mode === "event" && eventBonus > 0 && (
                    <div className="flex-shrink-0 text-right hidden sm:block">
                        <div className="text-xs text-slate-400">加成</div>
                        <div className="font-bold text-sm text-miku">{eventBonus}%</div>
                    </div>
                )}

                {/* Expand Icon (Desktop) */}
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 hidden sm:block ${showDetails ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Detail Panel */}
            {showDetails && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-slate-100">
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="text-left py-1 px-1">队长</th>
                                    <th className="text-left py-1 px-1">卡牌ID</th>
                                    <th className="text-left py-1 px-1">卡面名称</th>
                                    <th className="text-right py-1 px-1">综合力</th>
                                    <th className="text-right py-1 px-1">技能</th>
                                    {mode === "event" && <th className="text-right py-1 px-1">活动加成</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {deck.cards?.map((card: any, i: number) => {
                                    const masterCard = getCardMaster(card.cardId);
                                    const basePower = card.power
                                        ? (card.power.base || 0) + (card.power.areaItem || 0) + (card.power.characterRank || 0) +
                                        (card.power.honor || 0) + (card.power.mysekaiGate || 0) + (card.power.mysekaiCanvas || 0) + (card.power.masterRank || 0)
                                        : 0;
                                    const eb = card.eventBonus; // string or object (legacy)

                                    const cardName = masterCard?.prefix || (masterCard ? CHAR_NAMES[masterCard.characterId] : `ID:${card.characterId}`);

                                    return (
                                        <tr key={i} className="border-t border-slate-50">
                                            <td className="py-1.5 px-1 font-bold text-slate-500">
                                                {i === 0 ? "队长" : `#${i + 1}`}
                                            </td>
                                            <td className="py-1.5 px-1 font-mono text-slate-600">{card.cardId}</td>
                                            <td className="py-1.5 px-1 text-slate-600">
                                                {cardName}
                                            </td>
                                            <td className="py-1.5 px-1 text-right font-mono text-slate-600">
                                                {basePower.toLocaleString()}
                                            </td>
                                            <td className="py-1.5 px-1 text-right text-miku font-bold">
                                                {card.skill?.scoreUp || 0}%
                                            </td>
                                            {mode === "event" && (
                                                <td className="py-1.5 px-1 text-right font-bold text-amber-600">
                                                    {typeof eb === "string" ? eb : (eb?.total || eb?.all || 0) > 0 ? `${eb?.total || eb?.all}%` : "-"}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile: show power/bonus here */}
                    <div className="mt-2 flex gap-4 sm:hidden text-xs">
                        {/* <span className="text-slate-500">总战力: <span className="font-bold text-primary-text">{totalPower.toLocaleString()}</span></span> */}
                        {mode === "event" && eventBonus > 0 && (
                            <span className="text-slate-500">加成: <span className="font-bold text-miku">{eventBonus}%</span></span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
