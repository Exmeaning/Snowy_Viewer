"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { ICardInfo, UNIT_DATA, CHARACTER_NAMES, CHAR_COLORS } from "@/types/types";
import { getCardFullUrl, getCharacterIconUrl } from "@/lib/assets";

// Game Constants
const ROUNDS_PER_GAME = 10;
const BASE_SCORE_PER_ROUND = 1000;
const FEEDBACK_DURATION = 10000; // 10 seconds

// Unit Id map for icons
const UNIT_ICON_MAP: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

// Rarity Definitions
const RARITY_OPTIONS = [
    { id: "rarity_1", num: 1 },
    { id: "rarity_2", num: 2 },
    { id: "rarity_3", num: 3 },
    { id: "rarity_4", num: 4 },
    { id: "rarity_birthday", num: 5 },
];

const DEFAULT_RARITIES = ["rarity_3", "rarity_4"];

// Types
type GameState = "setup" | "playing" | "result";
type ServerScope = "jp" | "cn";
type Difficulty = "easy" | "normal" | "hard" | "extreme";

// Distortion Effects
type DistortionType = "none" | "hue-rotate" | "flip-v" | "flip-h" | "grayscale" | "invert" | "rgb-shuffle";

interface ActiveDistortion {
    type: DistortionType;
    label: string;
}

const DISTORTION_POOL: { type: DistortionType; label: string }[] = [
    { type: "none", label: "不操作" },
    { type: "hue-rotate", label: "色相反转" },
    { type: "flip-v", label: "翻转" },
    { type: "flip-h", label: "镜像" },
    { type: "grayscale", label: "灰度" },
    { type: "invert", label: "反色" },
    { type: "rgb-shuffle", label: "RGB打乱" },
];

interface GameSettings {
    server: ServerScope;
    timeLimit: number;
    seed: string;
    difficulty: Difficulty;
    selectedUnitIds: string[];
    selectedRarities: string[];
}

interface RoundResult {
    round: number;
    card: ICardInfo;
    userGuess: number | null;
    isCorrect: boolean;
    score: number;
    timeTaken: number;
    isTrained: boolean;
    distortions?: ActiveDistortion[]; // For extreme mode
}

// Seeded Random
class SeededRandom {
    private seed: number;
    constructor(seed: string) {
        this.seed = this.hashString(seed || Date.now().toString());
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    next(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    // Helper to pick random item from array
    pick<T>(array: T[]): T {
        return array[Math.floor(this.next() * array.length)];
    }

    // Helper to pick N distinct items
    pickMultiple<T>(array: T[], n: number): T[] {
        const result: T[] = [];
        const pool = [...array];
        for (let i = 0; i < n; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(this.next() * pool.length);
            result.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return result;
    }
}

// Canvas Image Helper
const CanvasImage = ({ image, objectFit = "contain" }: { image: HTMLImageElement | null, objectFit?: "contain" | "cover" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs || !image) return;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        cvs.width = image.width;
        cvs.height = image.height;
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(image, 0, 0);
    }, [image]);

    if (!image) return null;

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ objectFit }}
        />
    );
};

function GuessWhoContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Game State
    const [gameState, setGameState] = useState<GameState>("setup");
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Settings
    const [settings, setSettings] = useState<GameSettings>({
        server: "jp",
        timeLimit: 30,
        seed: Math.random().toString(36).substring(7),
        difficulty: "normal",
        selectedUnitIds: [],
        selectedRarities: DEFAULT_RARITIES,
    });

    // Gameplay State
    const [gameDeck, setGameDeck] = useState<ICardInfo[]>([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [currentResults, setCurrentResults] = useState<RoundResult[]>([]);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRoundActive, setIsRoundActive] = useState(false);
    const [_, setRedraw] = useState(0);

    const activeImagesRef = useRef<Record<number, HTMLImageElement>>({});

    const [cropRect, setCropRect] = useState<{ x: number, y: number, size: number } | null>(null);
    const [currentIsTrained, setCurrentIsTrained] = useState(false);
    const [currentDistortions, setCurrentDistortions] = useState<ActiveDistortion[]>([]);

    // Feedback State
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<RoundResult | null>(null);

    // Refs
    const randomRef = useRef<SeededRandom | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initializedRef = useRef(false);

    // Initialize
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const seedParam = searchParams.get("seed");
        const difficultyParam = searchParams.get("difficulty");
        const timeParam = searchParams.get("time");
        const serverParam = searchParams.get("server");
        const unitsParam = searchParams.get("units");
        const raritiesParam = searchParams.get("rarities");

        setSettings(prev => ({
            ...prev,
            seed: seedParam || Math.random().toString(36).substring(7),
            difficulty: (difficultyParam as Difficulty) || "normal",
            timeLimit: timeParam ? Number(timeParam) : 30,
            server: (serverParam as ServerScope) || "jp",
            selectedUnitIds: unitsParam ? unitsParam.split(",") : [],
            selectedRarities: raritiesParam ? raritiesParam.split(",") : DEFAULT_RARITIES,
        }));
    }, [searchParams]);

    // Load Data
    useEffect(() => {
        async function loadData() {
            try {
                const data = await fetchMasterData<ICardInfo[]>("cards.json");
                const validCards = data.filter(c => c.characterId > 0 && c.characterId <= 26);
                setCards(validCards);
            } catch (e) {
                console.error("Failed to load cards", e);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    // Share URL
    const getShareUrl = () => {
        if (typeof window === "undefined") return "";
        const params = new URLSearchParams();
        params.set("seed", settings.seed);
        params.set("difficulty", settings.difficulty);
        params.set("time", settings.timeLimit.toString());
        params.set("server", settings.server);
        if (settings.selectedUnitIds.length > 0) {
            params.set("units", settings.selectedUnitIds.join(","));
        }
        if (settings.selectedRarities.length > 0 && settings.selectedRarities.length !== RARITY_OPTIONS.length) {
            params.set("rarities", settings.selectedRarities.join(","));
        }
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const copyShareLink = () => {
        const url = getShareUrl();
        navigator.clipboard.writeText(url).then(() => {
            alert("链接已复制! 分享给好友来挑战吧");
        });
    };

    // Filter Handlers
    const handleUnitToggle = (unitId: string) => {
        setSettings(prev => {
            const newUnits = prev.selectedUnitIds.includes(unitId)
                ? prev.selectedUnitIds.filter(id => id !== unitId)
                : [...prev.selectedUnitIds, unitId];
            return { ...prev, selectedUnitIds: newUnits };
        });
    };

    const handleRarityToggle = (rarityId: string) => {
        setSettings(prev => {
            const newRarities = prev.selectedRarities.includes(rarityId)
                ? prev.selectedRarities.filter(id => id !== rarityId)
                : [...prev.selectedRarities, rarityId];
            return { ...prev, selectedRarities: newRarities };
        });
    };

    // Available Characters
    const availableCharacters = useMemo(() => {
        if (settings.selectedUnitIds.length === 0) return Object.keys(CHARACTER_NAMES).map(Number);
        const chars: number[] = [];
        UNIT_DATA.forEach(unit => {
            if (settings.selectedUnitIds.includes(unit.id)) {
                chars.push(...unit.charIds);
            }
        });
        return Array.from(new Set(chars));
    }, [settings.selectedUnitIds]);

    // Start Game logic
    const startGame = () => {
        if (isLoading) return;

        randomRef.current = new SeededRandom(settings.seed);

        let deck = cards.filter(card => {
            if (settings.server === "cn") { /* placeholder */ }
            if (settings.selectedUnitIds.length > 0 && !availableCharacters.includes(card.characterId)) return false;
            if (settings.selectedRarities.length > 0) {
                if (!settings.selectedRarities.includes(card.cardRarityType)) return false;
            } else { return false; }
            if (!card.assetbundleName) return false;
            return true;
        });

        if (deck.length < ROUNDS_PER_GAME) {
            alert(`卡池数量不足 (${deck.length})，请扩大筛选范围`);
            return;
        }

        const shuffled = [...deck].sort(() => randomRef.current!.next() - 0.5);
        setGameDeck(shuffled.slice(0, ROUNDS_PER_GAME));

        setCurrentRound(0);
        setCurrentResults([]);
        activeImagesRef.current = {};

        setGameState("playing");
        startRound(shuffled[0], 0);
    };

    const startRound = (card: ICardInfo, roundIndex: number) => {
        setIsRoundActive(false);
        setShowFeedback(false);
        setFeedbackResult(null);
        setTimeLeft(settings.timeLimit);
        setCropRect(null);
        setCurrentDistortions([]);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        const isTrained = card.cardRarityType !== "rarity_1" && card.cardRarityType !== "rarity_2" && randomRef.current!.next() > 0.5;

        setCurrentIsTrained(isTrained);

        img.src = getCardFullUrl(card.characterId, card.assetbundleName, isTrained);

        img.onload = () => {
            activeImagesRef.current[roundIndex] = img;
            setRedraw(prev => prev + 1);

            let cropSize = 250;
            if (settings.difficulty === "easy") cropSize = 400;
            if (settings.difficulty === "hard") cropSize = 150;
            if (settings.difficulty === "extreme") cropSize = 150;

            const maxX = img.width - cropSize;
            const maxY = img.height - cropSize;
            const validMaxX = Math.max(0, maxX);
            const validMaxY = Math.max(0, maxY);

            const x = Math.floor(randomRef.current!.next() * validMaxX);
            const y = Math.floor(randomRef.current!.next() * validMaxY);

            // Extreme Mode: Distortions
            if (settings.difficulty === "extreme") {
                const numDistortions = Math.floor(randomRef.current!.next() * 3) + 1; // 1 to 3
                const effects = randomRef.current!.pickMultiple(DISTORTION_POOL, numDistortions);
                const activeEffects = effects.filter(e => e.type !== "none");
                setCurrentDistortions(activeEffects);
            } else {
                setCurrentDistortions([]);
            }

            setCropRect({ x, y, size: cropSize });
            setIsRoundActive(true);
        };

        img.onerror = () => {
            console.error("Failed to load image", card.id);
            handleGuess(null);
        };
    };

    // Draw Canvas (Drawing Logic Updated for Distortions)
    useEffect(() => {
        const currentImg = activeImagesRef.current[currentRound];
        if (!canvasRef.current || !currentImg || !cropRect) return;
        const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const cvs = canvasRef.current;
        cvs.width = 300; // Fixed display size
        cvs.height = 300;

        ctx.clearRect(0, 0, cvs.width, cvs.height);

        ctx.save();

        // Apply filters
        let filterString = "";

        // Active effects
        const hasFlipH = currentDistortions.some(d => d.type === "flip-h");
        const hasFlipV = currentDistortions.some(d => d.type === "flip-v");
        const hasGrayscale = currentDistortions.some(d => d.type === "grayscale");
        const hasInvert = currentDistortions.some(d => d.type === "invert");
        const hasHueRotate = currentDistortions.some(d => d.type === "hue-rotate");
        const hasRgbShuffle = currentDistortions.some(d => d.type === "rgb-shuffle");

        if (hasGrayscale) filterString += "grayscale(100%) ";
        if (hasInvert) filterString += "invert(100%) ";
        if (hasHueRotate) filterString += "hue-rotate(180deg) ";

        if (filterString) ctx.filter = filterString.trim();

        // Apply transforms (translate to center to rotate/flip)
        if (hasFlipH || hasFlipV) {
            ctx.translate(cvs.width / 2, cvs.height / 2);
            ctx.scale(hasFlipH ? -1 : 1, hasFlipV ? -1 : 1);
            ctx.translate(-cvs.width / 2, -cvs.height / 2);
        }

        ctx.drawImage(
            currentImg,
            cropRect.x, cropRect.y, cropRect.size, cropRect.size,
            0, 0, cvs.width, cvs.height
        );

        ctx.restore();

        // Apply Pixel Manipulations (RGB Shuffle) after standard filters
        if (hasRgbShuffle) {
            const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Cycle
                data[i] = g;     // R gets G
                data[i + 1] = b; // G gets B
                data[i + 2] = r; // B gets R
            }
            ctx.putImageData(imageData, 0, 0);
        }

    }, [currentRound, cropRect, currentDistortions, _]);

    // Timer
    useEffect(() => {
        if (!isRoundActive) return;
        if (timeLeft <= 0) {
            handleGuess(null);
            return;
        }
        const interval = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 0.1));
        }, 100);
        return () => clearInterval(interval);
    }, [isRoundActive, timeLeft]);

    const getCurrentPotentialScore = () => {
        if (!isRoundActive) return 0;
        const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
        let diffMult = 1.0;
        if (settings.difficulty === "easy") diffMult = 0.8;
        if (settings.difficulty === "hard") diffMult = 1.5;
        if (settings.difficulty === "extreme") diffMult = 2.5;
        return Math.floor(BASE_SCORE_PER_ROUND * timeFactor * diffMult);
    };

    const handleGuess = (charId: number | null) => {
        setIsRoundActive(false);
        const isCorrect = charId === gameDeck[currentRound].characterId;
        const timeTaken = settings.timeLimit - timeLeft;

        let roundScore = 0;
        if (isCorrect) {
            const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
            let diffMult = 1.0;
            if (settings.difficulty === "easy") diffMult = 0.8;
            if (settings.difficulty === "hard") diffMult = 1.5;
            if (settings.difficulty === "extreme") diffMult = 2.5;
            roundScore = Math.floor(BASE_SCORE_PER_ROUND * timeFactor * diffMult);
        }

        const result: RoundResult = {
            round: currentRound,
            card: gameDeck[currentRound],
            userGuess: charId,
            isCorrect,
            score: roundScore,
            timeTaken,
            isTrained: currentIsTrained,
            distortions: currentDistortions,
        };

        const newResults = [...currentResults, result];
        setCurrentResults(newResults);

        setFeedbackResult(result);
        setShowFeedback(true);

        feedbackTimerRef.current = setTimeout(() => {
            handleNextRound();
        }, FEEDBACK_DURATION);
    };

    const handleNextRound = () => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        if (currentRound < ROUNDS_PER_GAME - 1) {
            const nextRound = currentRound + 1;
            setCurrentRound(nextRound);
            startRound(gameDeck[nextRound], nextRound);
        } else {
            setGameState("result");
        }
    };

    const formatTime = (seconds: number) => Math.max(0, seconds).toFixed(1) + "s";

    if (isLoading) {
        return <MainLayout activeNav="我是谁"><div className="flex h-screen items-center justify-center">Loading...</div></MainLayout>;
    }

    const currentTotalScore = currentResults.reduce((acc, r) => acc + r.score, 0);
    const currentCanvasImage = activeImagesRef.current[currentRound];

    // ==================== RESULT SCREEN ====================
    if (gameState === "result") {
        const shareUrl = getShareUrl();
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

        // Helper for displaying server
        const getServerLabel = (s: ServerScope) => s === "jp" ? "JP (日服)" : "CN (国服)";
        const getDifficultyLabel = (d: Difficulty) => d === "easy" ? "简单" : d === "normal" ? "普通" : d === "hard" ? "困难" : "极限";

        return (
            <MainLayout activeNav="我是谁">
                <div className="min-h-screen">
                    <div className="container mx-auto px-4 py-8 pb-20">
                        <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden bg-white/60 backdrop-blur-md shadow-lg border border-slate-100">
                            <div className="p-8 text-center border-b border-slate-200/50">
                                {/* Header */}
                                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                                    <span className="text-miku text-xs font-bold tracking-widest uppercase">GAME OVER</span>
                                </div>
                                <h1 className="text-4xl font-black text-slate-800 mb-2">挑战完成!</h1>
                                <p className="text-xl text-slate-500 mb-6">最终得分</p>
                                <div className="text-6xl font-black text-miku mb-8 animate-bounce">{currentTotalScore}</div>

                                <div className="flex flex-col md:flex-row items-center justify-center gap-8 bg-slate-50/50 rounded-2xl p-6 mb-8">
                                    <div className="text-left space-y-2 text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 w-16">随机种子:</span>
                                            <code className="bg-white px-2 py-1 rounded border">{settings.seed}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 w-16">服务器:</span>
                                            <span className="font-bold text-slate-900">{getServerLabel(settings.server)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 w-16">难度:</span>
                                            <span className="capitalize font-bold text-miku">{getDifficultyLabel(settings.difficulty)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 w-16">限时:</span>
                                            <span>{settings.timeLimit}秒</span>
                                        </div>
                                        {settings.selectedUnitIds.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <span className="font-bold text-slate-700 w-16 shrink-0">指定团体:</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {settings.selectedUnitIds.map(uid => (
                                                        <Image key={uid} src={`/data/icon/${UNIT_ICON_MAP[uid]}`} width={20} height={20} alt={uid} className="w-5 h-5 object-contain" unoptimized />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {settings.difficulty === "extreme" && (
                                            <div className="text-xs text-red-500 font-bold mt-2 pt-2 border-t border-slate-200">
                                                (包含色相反转/镜像/RGB打乱等)
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-[120px] h-[120px] bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                            <img src={qrCodeUrl} alt="Share QR Code" className="w-full h-full object-contain" />
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">扫码挑战</span>
                                    </div>
                                </div>

                                <div className="flex justify-center gap-4">
                                    <button onClick={copyShareLink} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-sm">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        复制链接
                                    </button>
                                    <button onClick={() => { setSettings(prev => ({ ...prev, seed: Math.random().toString(36).substring(7) })); setGameState("setup"); }} className="px-6 py-3 bg-miku text-white rounded-xl font-bold hover:bg-miku-dark transition-colors shadow-lg shadow-miku/30">
                                        再玩一次 (新种子)
                                    </button>
                                </div>
                            </div>

                            {/* Results Grid */}
                            <div className="p-8 bg-slate-50/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    {currentResults.map((res, idx) => (
                                        <Link href={`/cards/${res.card.id}`} key={idx} className={`relative block p-4 rounded-xl border flex gap-4 overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-md ${res.isCorrect ? "bg-green-50/90 border-green-200" : "bg-red-50/90 border-red-200"}`}>
                                            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                                <CanvasImage image={activeImagesRef.current[res.round]} objectFit="cover" />
                                            </div>
                                            <div className="relative z-10 flex flex-col gap-2 w-full">
                                                <div className="flex gap-4 w-full">
                                                    <div className="w-16 h-16 relative shrink-0">
                                                        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-sm ring-1 ring-black/10">
                                                            <Image src={getCharacterIconUrl(res.card.characterId)} alt="char" fill className="object-cover" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-0.5">Round {res.round + 1}</div>
                                                        <div className={`font-black text-lg leading-tight mb-1 ${res.isCorrect ? "text-green-700" : "text-red-700"}`}>
                                                            {res.isCorrect ? "正确" : `错误`}
                                                        </div>
                                                        {!res.isCorrect && <div className="text-xs text-red-600 font-bold bg-white/50 inline-block px-1 rounded block w-fit mb-1">选了: {res.userGuess ? CHARACTER_NAMES[res.userGuess] : "超时"}</div>}
                                                        <div className="text-xs text-slate-600 truncate flex items-center gap-1">
                                                            <span className="font-bold shrink-0">{CHARACTER_NAMES[res.card.characterId]}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                                                            <span className="opacity-80 truncate">{res.card.prefix}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-lg font-bold text-slate-700 shrink-0">+{res.score}</div>
                                                </div>
                                                {res.distortions && res.distortions.length > 0 && (
                                                    <div className="flex flex-wrap justify-end gap-1 px-1">
                                                        {res.distortions.map((d, i) => (
                                                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-800/80 text-white rounded font-bold shadow-sm whitespace-nowrap">
                                                                {d.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    // Split for brevity / manual re-insertion of large render blocks
    return GuessWhoClientPlayingAndSetup({
        gameState, settings, setSettings,
        currentTotalScore, timeLeft, isRoundActive,
        currentRound, showFeedback, feedbackResult, currentCanvasImage,
        canvasRef, currentDistortions, handleGuess, handleNextRound,
        availableCharacters, startGame, handleRarityToggle, handleUnitToggle, copyShareLink, formatTime,
        potentialScore: getCurrentPotentialScore()
    });
}

export default function GuessWhoClient() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <GuessWhoContent />
        </Suspense>
    );
}

// Helper to keep code clean since we are repeating the layout in "Playing" mode
function GuessWhoClientPlayingAndSetup({
    gameState, settings, setSettings,
    currentTotalScore, timeLeft, isRoundActive,
    currentRound, showFeedback, feedbackResult, currentCanvasImage,
    canvasRef, currentDistortions, handleGuess, handleNextRound,
    availableCharacters, startGame, handleRarityToggle, handleUnitToggle, copyShareLink, formatTime, potentialScore
}: any) {
    if (gameState === "playing") {
        return (
            <MainLayout activeNav="我是谁">
                <div className="min-h-screen">
                    <div className="container mx-auto px-4 py-4 flex flex-col min-h-screen relative">
                        {/* Feedback Overlay */}
                        {showFeedback && feedbackResult && currentCanvasImage && (
                            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 cursor-pointer animate-in fade-in duration-200" onClick={handleNextRound}>
                                <div className="relative w-full max-w-lg aspect-[4/3] sm:aspect-auto sm:h-[70vh]">
                                    <CanvasImage image={currentCanvasImage} objectFit="contain" />
                                </div>
                                <div className={`mt-8 px-8 py-4 rounded-full font-black text-3xl animate-bounce ${feedbackResult.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                                    {feedbackResult.isCorrect ? "CORRECT!" : "WRONG!"}
                                </div>
                                <div className="mt-4 text-center text-white">
                                    <div className="text-2xl font-bold mb-1">{CHARACTER_NAMES[feedbackResult.card.characterId]}</div>
                                    <div className="text-slate-300">{feedbackResult.card.prefix}</div>
                                </div>
                                <div className="mt-8 text-slate-400 text-sm animate-pulse">点击屏幕继续 ({FEEDBACK_DURATION / 1000}s 后自动跳转)</div>
                            </div>
                        )}

                        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-sm mb-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="text-xl font-bold text-slate-700">Round {currentRound + 1} / {ROUNDS_PER_GAME}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-1">Seed: {settings.seed}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-slate-800">{currentTotalScore} <span className="text-sm text-slate-400 font-normal">pts</span></div>
                                    {isRoundActive && <div className="text-sm font-bold text-miku animate-pulse">+{potentialScore}</div>}
                                </div>
                            </div>
                            <div className="relative h-6 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-miku transition-all duration-100 ease-linear" style={{ width: `${(timeLeft / settings.timeLimit) * 100}%` }} />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">{formatTime(timeLeft)}</div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-start gap-8">
                            <div className="relative">
                                <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white bg-slate-100 shrink-0" style={{ width: 300, height: 300 }}>
                                    <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />
                                    {isRoundActive && currentDistortions.length > 0 && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                                            {currentDistortions.map((d: ActiveDistortion, i: number) => (
                                                <span key={i} className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-sm opacity-90">
                                                    {d.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {!isRoundActive && !showFeedback && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold backdrop-blur-sm">
                                            Loading...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full max-w-5xl flex flex-wrap justify-center gap-2 sm:gap-3 p-4 bg-white/80 backdrop-blur-md rounded-3xl shadow-sm transition-opacity">
                                {Object.entries(CHARACTER_NAMES).map(([idStr, name]) => {
                                    const id = Number(idStr);
                                    const color = CHAR_COLORS[idStr];
                                    if (!availableCharacters.includes(id)) return null;
                                    return (
                                        <button key={id} onClick={() => isRoundActive && handleGuess(id)} disabled={!isRoundActive} className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl overflow-hidden relative group transition-transform active:scale-95 hover:scale-105 disabled:opacity-50 disabled:scale-100 ring-2 ring-transparent hover:ring-miku shadow-sm" title={name}>
                                            <Image src={getCharacterIconUrl(id)} alt={name} fill className="object-cover" unoptimized />
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: color }} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    // SETUP SCREEN
    return (
        <MainLayout activeNav="我是谁">
            <div className="min-h-screen pt-8 pb-20">
                <div className="container mx-auto px-4 max-w-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4 bg-white/80 backdrop-blur-sm shadow-sm">
                            <span className="text-miku text-xs font-bold tracking-widest uppercase">Creativity Game</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 mb-2 drop-shadow-sm">我是谁 <span className="text-miku">?</span></h1>
                        <p className="text-slate-500 font-medium">通过随机裁剪的卡面猜测角色</p>
                    </div>

                    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 space-y-6 sm:space-y-8">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-700 mb-2">随机种子</label>
                                <div className="flex gap-2">
                                    <input type="text" value={settings.seed} onChange={(e) => setSettings({ ...settings, seed: e.target.value })} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-miku font-mono text-sm bg-slate-50" />
                                    <button onClick={() => setSettings({ ...settings, seed: Math.random().toString(36).substring(7) })} className="px-3 py-2 text-slate-400 hover:text-miku hover:bg-slate-100 rounded-lg transition-colors" title="重新生成">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-end w-full sm:w-auto">
                                <button onClick={copyShareLink} className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 h-[42px]">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    分享
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">难度设置</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(["easy", "normal", "hard", "extreme"] as Difficulty[]).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSettings({ ...settings, difficulty: d })}
                                        className={`py-3 rounded-xl font-bold capitalize transition-all text-sm ${settings.difficulty === d
                                            ? `${d === 'extreme' ? 'bg-red-500 ring-red-300' : 'bg-miku ring-miku/30'} text-white shadow-md ring-2`
                                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            }`}
                                    >
                                        {d === "easy" ? "简单" : d === "normal" ? "普通" : d === "hard" ? "困难" : "极限"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">卡面星级</label>
                            <div className="flex flex-wrap gap-2">
                                {RARITY_OPTIONS.map(({ id, num }) => {
                                    const isSelected = settings.selectedRarities.includes(id);
                                    return (
                                        <button key={id} onClick={() => handleRarityToggle(id)} className={`h-11 px-3 rounded-xl transition-all flex items-center justify-center gap-0.5 border ${isSelected ? "ring-2 ring-miku shadow-sm bg-white border-transparent" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"}`}>
                                            {id === "rarity_birthday" ? (<div className="w-5 h-5 relative"><Image src="/data/icon/birthday.webp" alt="Birthday" fill className="object-contain" unoptimized /></div>) : (Array.from({ length: num }).map((_, i) => (<div key={i} className="w-4 h-4 relative"><Image src="/data/icon/star.webp" alt="Star" fill className="object-contain" unoptimized /></div>)))}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">服务器范围</label>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                                    {(["jp", "cn"] as ServerScope[]).map(s => (
                                        <button key={s} onClick={() => setSettings({ ...settings, server: s })} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${settings.server === s ? "bg-white text-miku shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                            {s === "jp" ? "日服" : "国服"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">猜测时间 (秒)</label>
                                <input type="number" value={settings.timeLimit} onChange={(e) => setSettings({ ...settings, timeLimit: Math.max(3, Math.min(60, Number(e.target.value))) })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-miku font-mono text-center" />
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-slate-700">角色筛选</label>
                                <button onClick={() => setSettings({ ...settings, selectedUnitIds: [] })} className="text-xs text-miku hover:underline">重置筛选</button>
                            </div>
                            <div className="flex flex-wrap gap-3 mb-4 justify-center">
                                {UNIT_DATA.map(unit => (
                                    <button key={unit.id} onClick={() => handleUnitToggle(unit.id)} className={`transition-all p-1 rounded-full ${settings.selectedUnitIds.includes(unit.id) ? "bg-slate-100 ring-2 ring-miku scale-110" : "opacity-60 hover:opacity-100 grayscale hover:grayscale-0 hover:bg-slate-50"}`}>
                                        <Image src={`/data/icon/${UNIT_ICON_MAP[unit.id]}`} alt={unit.name} width={40} height={40} className="w-10 h-10 object-contain" unoptimized />
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-slate-400 text-center">已选: {settings.selectedUnitIds.length > 0 ? "~" + availableCharacters.length + " 名角色" : "全部26名角色"}</div>
                        </div>

                        <button onClick={startGame} className="w-full py-4 bg-gradient-to-r from-miku to-miku-dark text-white rounded-2xl font-black text-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            开始挑战
                        </button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}

