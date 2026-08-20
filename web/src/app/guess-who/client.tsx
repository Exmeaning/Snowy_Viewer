"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { ICardInfo, UNIT_DATA, CHAR_COLORS, UNIT_ICON_FILES, UNIT_ID_LABEL_KEYS } from "@/types/types";
import { getCardFullUrl, getCharacterIconUrl } from "@/lib/assets";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";

// Game Constants
const ROUNDS_PER_GAME = 10;
const BASE_SCORE_PER_ROUND = 1000;
const FEEDBACK_DURATION = 3000; // Reduced to 3s for snappier feel
const MAX_STRIKES_PER_ROUND = 3;

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
}

const DISTORTION_POOL: { type: DistortionType }[] = [
    { type: "none" },
    { type: "hue-rotate" },
    { type: "flip-v" },
    { type: "flip-h" },
    { type: "grayscale" },
    { type: "invert" },
    { type: "rgb-shuffle" },
];

const DISTORTION_LABEL_KEYS: Record<DistortionType, string> = {
    none: "none",
    "hue-rotate": "hueRotate",
    "flip-v": "flipV",
    "flip-h": "flipH",
    grayscale: "grayscale",
    invert: "invert",
    "rgb-shuffle": "rgbShuffle",
};

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
    multiplier: number;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();

    // Game State
    const [gameState, setGameState] = useState<GameState>("setup");
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>("");

    // Settings
    const [settings, setSettings] = useState<GameSettings>({
        server: "jp",
        timeLimit: 60,
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

    // New Logic State
    const [strikes, setStrikes] = useState(0);
    const [combo, setCombo] = useState(0);

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
            timeLimit: Math.min(120, timeParam ? Number(timeParam) : 60),
            server: (serverParam as ServerScope) || "jp",
            selectedUnitIds: unitsParam ? unitsParam.split(",") : [],
            selectedRarities: raritiesParam ? raritiesParam.split(",") : DEFAULT_RARITIES,
        }));
    }, [searchParams]);

    // Load Data
    const loadCards = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
        try {
            const data = await fetchMasterData<ICardInfo[]>("cards.json");
            const validCards = data.filter(c => c.characterId > 0 && c.characterId <= 26);
            setCards(validCards);
        } catch (e) {
            console.error("Failed to load cards", e);
            setLoadError(t("page.guessWho.common.errors.cardLoadFailed"));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadCards();
    }, [loadCards]);

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
            alert(t("page.guessWho.single.shareCopied"));
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
        if (settings.selectedUnitIds.length === 0) return UNIT_DATA.flatMap((unit) => unit.charIds);
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

        const deck = cards.filter(card => {
            if (settings.server === "cn") { /* placeholder */ }
            if (settings.selectedUnitIds.length > 0 && !availableCharacters.includes(card.characterId)) return false;
            if (settings.selectedRarities.length > 0) {
                if (!settings.selectedRarities.includes(card.cardRarityType)) return false;
            } else { return false; }
            if (!card.assetbundleName) return false;
            return true;
        });

        if (deck.length < ROUNDS_PER_GAME) {
            alert(t("page.guessWho.common.errors.deckInsufficient", { count: deck.length }));
            return;
        }

        const shuffled = [...deck].sort(() => randomRef.current!.next() - 0.5);
        setGameDeck(shuffled.slice(0, ROUNDS_PER_GAME));

        setCurrentRound(0);
        setCurrentResults([]);
        setCombo(0);
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
        setStrikes(0);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRoundActive, timeLeft]);

    const getCurrentPotentialScore = () => {
        if (!isRoundActive) return 0;
        const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
        let diffMult = 1.0;
        if (settings.difficulty === "easy") diffMult = 0.8;
        if (settings.difficulty === "hard") diffMult = 1.5;
        if (settings.difficulty === "extreme") diffMult = 2.5;

        let comboMult = 1.0;
        if (combo > 0) comboMult = 1.0 + (combo * 0.5); // Preview next combo

        return Math.floor(BASE_SCORE_PER_ROUND * timeFactor * diffMult * comboMult);
    };

    const handleGuess = (charId: number | null) => {
        const isCorrect = charId === gameDeck[currentRound].characterId;

        // Wrong Guess Logic (Retry)
        if (!isCorrect && charId !== null) {
            // Check if max strikes reached
            if (strikes < MAX_STRIKES_PER_ROUND - 1) {
                setStrikes(prev => prev + 1);
                setTimeLeft(prev => prev * 0.5); // 50% penalty
                setCombo(0); // Break combo
                // Transient feedback
                const feedbackEl = document.createElement("div");
                feedbackEl.textContent = t("page.guessWho.single.wrongTimePenalty");
                feedbackEl.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--hh-accent-alert)] text-white font-bold px-6 py-3 rounded-[var(--hh-radius-md)] z-[100] text-xl shadow-[var(--hh-shadow-float)]";
                document.body.appendChild(feedbackEl);
                setTimeout(() => feedbackEl.remove(), 1000);
                return; // Do NOT end round
            }
            // If strikes reached max, proceed to fail round below
        }

        setIsRoundActive(false);
        const timeTaken = settings.timeLimit - timeLeft;

        let roundScore = 0;
        let finalMultiplier = 1.0;

        if (isCorrect) {
            const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
            let diffMult = 1.0;
            if (settings.difficulty === "easy") diffMult = 0.8;
            if (settings.difficulty === "hard") diffMult = 1.5;
            if (settings.difficulty === "extreme") diffMult = 2.5;

            // Combo Logic
            let newCombo = combo;
            if (strikes === 0) {
                newCombo = combo + 1;
            } else {
                newCombo = 0;
            }
            setCombo(newCombo);

            // Calculate Multiplier: 1 + (streak-1)*0.5. e.g. 1->1x, 2->1.5x, 3->2.0x
            // Wait, usually combo starts at 0.
            // If newCombo is 1 (first correct), mult is 1.0
            // If newCombo is 2 (2nd correct), mult is 1.5
            // If newCombo is 3 (3rd correct), mult is 2.0
            // Formula: 1.0 + Math.max(0, newCombo - 1) * 0.5

            const comboBonus = Math.max(0, newCombo - 1) * 0.5;
            finalMultiplier = 1.0 + comboBonus;

            roundScore = Math.floor(BASE_SCORE_PER_ROUND * timeFactor * diffMult * finalMultiplier);
        } else {
            setCombo(0);
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
            multiplier: finalMultiplier,
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
        return <MainLayout><div className="flex h-screen items-center justify-center">{t("page.guessWho.common.loading")}</div></MainLayout>;
    }

    const currentTotalScore = currentResults.reduce((acc, r) => acc + r.score, 0);
    const currentCanvasImage = activeImagesRef.current[currentRound];

    // ==================== RESULT SCREEN ====================
    if (gameState === "result") {
        const shareUrl = getShareUrl();
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

        // Helper for displaying server
        const getServerLabel = (s: ServerScope) => t(`page.guessWho.common.serverLabels.${s}`);
        const getDifficultyLabel = (d: Difficulty) => t(`page.guessWho.common.difficultyLabels.${d}`);

        return (
            <MainLayout>
                <div className="min-h-screen">
                    <div className="container mx-auto px-4 py-8 pb-20">
                        <div className="max-w-4xl mx-auto rounded-[var(--hh-radius-xl)] overflow-hidden hh-panel">
                            <div className="p-8 text-center border-b border-[var(--hh-border)]">
                                {/* Header */}
                                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                                    <span className="hh-label text-[var(--hh-accent)]">GAME OVER</span>
                                </div>
                                <h1 className="hh-display text-4xl text-[var(--hh-text-primary)] mb-2">{t("page.guessWho.single.challengeComplete")}</h1>
                                <p className="hh-body text-xl text-[var(--hh-text-secondary)] mb-6">{t("page.guessWho.single.finalScore")}</p>
                                <div className="hh-display hh-numeric text-6xl text-[var(--hh-accent)] mb-8">{currentTotalScore}</div>

                                <div className="flex flex-col md:flex-row items-center justify-center gap-8 hh-well p-6 mb-8">
                                    <div className="text-left space-y-2 text-sm text-[var(--hh-text-secondary)]">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-[var(--hh-text-primary)] w-16">{t("page.guessWho.common.seed")}</span>
                                            <code className="px-2 py-1 rounded-[var(--hh-radius-sm)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] font-mono text-[var(--hh-text-primary)]">{settings.seed}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-[var(--hh-text-primary)] w-16">{t("page.guessWho.common.server")}</span>
                                            <span className="font-semibold text-[var(--hh-text-primary)]">{getServerLabel(settings.server)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-[var(--hh-text-primary)] w-16">{t("page.guessWho.common.difficulty")}</span>
                                            <span className="capitalize font-semibold text-[var(--hh-accent)]">{getDifficultyLabel(settings.difficulty)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-[var(--hh-text-primary)] w-16">{t("page.guessWho.common.timeLimit")}</span>
                                            <span className="hh-numeric text-[var(--hh-text-primary)]">{settings.timeLimit}{t("page.guessWho.common.secondsSuffix")}</span>
                                        </div>
                                        {settings.selectedUnitIds.length > 0 && (
                                            <div className="flex items-start gap-2">
                                                <span className="font-semibold text-[var(--hh-text-primary)] w-16 shrink-0">{t("page.guessWho.common.selectedUnits")}</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {settings.selectedUnitIds.map(uid => (
                                                        <Image key={uid} src={`/data/icon/${UNIT_ICON_FILES[uid]}`} width={20} height={20} alt={uid} className="w-5 h-5 object-contain" unoptimized />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {settings.difficulty === "extreme" && (
                                            <div className="text-xs text-[var(--hh-accent-alert)] font-semibold mt-2 pt-2 border-t border-[var(--hh-border)]">
                                                {t("page.guessWho.common.distortions.extremeSummary")}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-[120px] h-[120px] bg-white p-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                                            {/* Kept white regardless of theme: a QR code only
                                                scans reliably on a light quiet zone. */}
                                            <img src={qrCodeUrl} alt="Share QR Code" className="w-full h-full object-contain" />
                                        </div>
                                        <span className="hh-label">{t("page.guessWho.single.scanToChallenge")}</span>
                                    </div>
                                </div>

                                <div className="flex justify-center gap-4">
                                    <button onClick={copyShareLink} className="hh-btn hh-press hh-focusable px-6 py-3 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                        {t("page.guessWho.single.copyLink")}
                                    </button>
                                    <button onClick={() => { setSettings(prev => ({ ...prev, seed: Math.random().toString(36).substring(7) })); setGameState("setup"); }} className="hh-btn hh-btn-primary hh-press hh-focusable px-6 py-3">
                                        {t("page.guessWho.single.playAgainNewSeed")}
                                    </button>
                                </div>
                            </div>

                            {/* Results Grid */}
                            <div className="p-8 bg-[var(--hh-surface-0)]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    {currentResults.map((res, idx) => (
                                        <Link href={`/cards/${res.card.id}`} key={idx} className={`hh-press hh-focusable relative block p-4 rounded-[var(--hh-radius-lg)] border flex gap-4 overflow-hidden ${res.isCorrect ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent-line)]" : "bg-[var(--hh-surface-2)] border-[var(--hh-accent-alert)]"}`}>
                                            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                                <CanvasImage image={activeImagesRef.current[res.round]} objectFit="cover" />
                                            </div>
                                            <div className="relative z-10 flex flex-col gap-2 w-full">
                                                <div className="flex gap-4 w-full">
                                                    <div className="w-16 h-16 relative shrink-0">
                                                        <div className="absolute inset-0 rounded-[var(--hh-radius-md)] overflow-hidden border border-[var(--hh-border)]">
                                                            <Image src={getCharacterIconUrl(res.card.characterId)} alt="char" fill className="object-cover" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="hh-label hh-numeric mb-0.5">Round {res.round + 1}</div>
                                                        <div className={`hh-title text-lg mb-1 ${res.isCorrect ? "text-[var(--hh-accent-deep)]" : "text-[var(--hh-accent-alert)]"}`}>
                                                            {res.isCorrect ? t("page.guessWho.common.correct") : t("page.guessWho.common.wrong")}
                                                        </div>
                                                        {!res.isCorrect && <div className="text-xs text-[var(--hh-accent-alert)] font-semibold bg-[var(--hh-surface-1)] inline-block px-1 rounded-[var(--hh-radius-xs)] block w-fit mb-1">{t("page.guessWho.common.selectedGuess", { name: res.userGuess ? getCharacterName(t, res.userGuess) : t("page.guessWho.common.timeout") })}</div>}
                                                        <div className="text-xs text-[var(--hh-text-secondary)] truncate flex items-center gap-1">
                                                            <span className="font-semibold shrink-0">{getCharacterName(t, res.card.characterId)}</span>
                                                            <span className="w-1 h-1 rounded-[var(--hh-radius-full)] bg-[var(--hh-text-tertiary)] shrink-0"></span>
                                                            <span className="opacity-80 truncate">{res.card.prefix}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0">
                                                        <div className="hh-numeric text-lg font-semibold text-[var(--hh-text-primary)]">+{res.score}</div>
                                                        {res.multiplier > 1 && (
                                                            <div className="hh-numeric text-xs font-semibold text-[var(--hh-accent)] bg-[var(--hh-accent-wash)] px-1.5 rounded-[var(--hh-radius-xs)]">
                                                                x{res.multiplier.toFixed(1)} Combo
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {res.distortions && res.distortions.length > 0 && (
                                                    <div className="flex flex-wrap justify-end gap-1 px-1">
                                                        {res.distortions.map((d, i) => (
                                                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)] rounded-[var(--hh-radius-xs)] font-semibold whitespace-nowrap">
                                                                {t(`page.guessWho.common.distortions.${DISTORTION_LABEL_KEYS[d.type]}`)}
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
        t,
        gameState, settings, setSettings,
        currentTotalScore, timeLeft, isRoundActive,
        currentRound, showFeedback, feedbackResult, currentCanvasImage,
        canvasRef, currentDistortions, handleGuess, handleNextRound,
        availableCharacters, getCharacterLabel: (characterId) => getCharacterName(t, characterId), startGame, handleRarityToggle, handleUnitToggle, copyShareLink, formatTime,
        potentialScore: getCurrentPotentialScore(),
        combo, strikes,
        loadError, loadCards, isLoading
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
interface GuessWhoPlayingAndSetupProps {
    t: ReturnType<typeof useI18n>["t"];
    gameState: GameState;
    settings: GameSettings;
    setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
    currentTotalScore: number;
    timeLeft: number;
    isRoundActive: boolean;
    currentRound: number;
    showFeedback: boolean;
    feedbackResult: RoundResult | null;
    currentCanvasImage?: HTMLImageElement;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    currentDistortions: ActiveDistortion[];
    handleGuess: (charId: number | null) => void;
    handleNextRound: () => void;
    availableCharacters: number[];
    getCharacterLabel: (characterId: number) => string;
    startGame: () => void;
    handleRarityToggle: (rarityId: string) => void;
    handleUnitToggle: (unitId: string) => void;
    copyShareLink: () => void;
    formatTime: (seconds: number) => string;
    potentialScore: number;
    combo: number;
    strikes: number;
    loadError: string;
    loadCards: () => Promise<void>;
    isLoading: boolean;
}

function GuessWhoClientPlayingAndSetup({
    t,
    gameState, settings, setSettings,
    currentTotalScore, timeLeft, isRoundActive,
    currentRound, showFeedback, feedbackResult, currentCanvasImage,
    canvasRef, currentDistortions, handleGuess, handleNextRound,
    availableCharacters, getCharacterLabel, startGame, handleRarityToggle, handleUnitToggle, copyShareLink, formatTime, potentialScore,

    combo, strikes,
    loadError, loadCards, isLoading
}: GuessWhoPlayingAndSetupProps) {
    const multiplier = combo > 0 ? 1.0 + (combo * 0.5) : 1.0;

    if (gameState === "playing") {
        return (
            <MainLayout>
                <div className="min-h-screen">
                    <div className="container mx-auto px-4 py-4 flex flex-col min-h-screen relative">
                        {/* Reveal overlay — the answer screen between rounds. Fully opaque
                            rather than a translucent scrim: this is a screen change, not a
                            dialog over the board, and the previous bg-black/90 was already
                            near-solid, so dropping to the 42% scrim token would leave the
                            HUD bleeding through behind the artwork. */}
                        {showFeedback && feedbackResult && currentCanvasImage && typeof document !== "undefined" && createPortal(
                            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--hh-surface-inset)] cursor-pointer animate-in fade-in duration-200" onClick={handleNextRound}>
                                <div className="relative w-full max-w-lg aspect-[4/3] sm:aspect-auto sm:h-[70vh]">
                                    <CanvasImage image={currentCanvasImage} objectFit="contain" />
                                </div>
                                <div className={`hh-display mt-8 px-8 py-4 rounded-[var(--hh-radius-md)] text-3xl border ${feedbackResult.isCorrect ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]" : "bg-[var(--hh-accent-alert)] border-[var(--hh-accent-alert)] text-white"}`}>
                                    {feedbackResult.isCorrect ? t("page.guessWho.single.feedbackCorrect") : t("page.guessWho.single.feedbackWrong")}
                                </div>
                                <div className="mt-4 text-center">
                                    <div className="hh-title text-2xl mb-1 text-[var(--hh-text-primary)]">{getCharacterLabel(feedbackResult.card.characterId)}</div>
                                    <div className="hh-body text-[var(--hh-text-secondary)]">{feedbackResult.card.prefix}</div>
                                </div>
                                <div className="mt-8 hh-body text-[var(--hh-text-tertiary)] text-sm">{t("page.guessWho.single.clickContinue", { seconds: FEEDBACK_DURATION / 1000 })}</div>
                            </div>,
                            document.body
                        )}

                        <div className="hh-tile p-4 mb-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="hh-title hh-numeric text-xl text-[var(--hh-text-primary)]">Round {currentRound + 1} / {ROUNDS_PER_GAME}</div>
                                    <div className="hh-numeric text-xs text-[var(--hh-text-tertiary)] font-mono mt-1">Seed: {settings.seed}</div>
                                </div>
                                <div className="text-right">
                                    <div className="hh-display hh-numeric text-2xl text-[var(--hh-text-primary)]">{currentTotalScore} <span className="text-sm text-[var(--hh-text-tertiary)] font-normal">pts</span></div>
                                    {isRoundActive && <div className="hh-numeric text-sm font-semibold text-[var(--hh-accent)]">+{potentialScore}</div>}
                                </div>
                            </div>

                            {/* Combo & Lives Bar */}
                            <div className="flex justify-between items-center mb-2 px-1">
                                <div className="flex items-center gap-1 h-6">
                                    {multiplier > 1 && (
                                        <div className="flex items-center gap-1 bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] px-2 py-0.5 rounded-[var(--hh-radius-sm)] text-xs font-semibold">
                                            <span className="hh-numeric">COMBO x{multiplier.toFixed(1)}</span>
                                            <span className="hh-numeric text-[10px] opacity-80">{t("page.guessWho.single.streakLabel", { combo })}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {[...Array(MAX_STRIKES_PER_ROUND)].map((_, i) => (
                                        <div key={i} className={`w-3 h-3 rounded-[var(--hh-radius-full)] transition-colors ${i < (MAX_STRIKES_PER_ROUND - strikes) ? "bg-[var(--hh-accent-alert)]" : "bg-[var(--hh-surface-inset)]"}`} />
                                    ))}
                                </div>
                            </div>

                            <div className="relative h-6 w-full bg-[var(--hh-surface-inset)] rounded-[var(--hh-radius-sm)] overflow-hidden">
                                <div className="h-full bg-[var(--hh-accent)] transition-all duration-100 ease-linear" style={{ width: `${(timeLeft / settings.timeLimit) * 100}%` }} />
                                {/* Tabular digits keep the countdown from twitching as the
                                    tenths place cycles. Ink rather than white: the label sits
                                    over the accent fill early in the round and over the bare
                                    trough late in it, and text-primary is the one value that
                                    stays legible on both in either color scheme. */}
                                <div className="absolute inset-0 flex items-center justify-center hh-numeric text-xs font-bold text-[var(--hh-text-primary)]">{formatTime(timeLeft)}</div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-start gap-8">
                            <div className="relative">
                                <div className="relative rounded-[var(--hh-radius-lg)] overflow-hidden shadow-[var(--hh-shadow-raised)] border-2 border-[var(--hh-border-strong)] bg-[var(--hh-surface-sunken)] shrink-0" style={{ width: 300, height: 300 }}>
                                    <canvas ref={canvasRef} width={300} height={300} className="w-full h-full" />
                                    {isRoundActive && currentDistortions.length > 0 && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                                            {currentDistortions.map((d: ActiveDistortion, i: number) => (
                                                <span key={i} className="px-2 py-1 bg-[var(--hh-accent-alert)] text-white text-xs font-semibold rounded-[var(--hh-radius-xs)]">
                                                    {t(`page.guessWho.common.distortions.${DISTORTION_LABEL_KEYS[d.type]}`)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {!isRoundActive && !showFeedback && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)] font-semibold">
                                            {t("page.guessWho.single.loadingImage")}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full max-w-5xl flex flex-wrap justify-center gap-2 sm:gap-3 p-4 hh-panel">
                                {availableCharacters.map((id) => {
                                    const name = getCharacterLabel(id);
                                    const idStr = String(id);
                                    const color = CHAR_COLORS[idStr];
                                    return (
                                        <button key={id} onClick={() => isRoundActive && handleGuess(id)} disabled={!isRoundActive} className="hh-press hh-focusable w-10 h-10 sm:w-16 sm:h-16 rounded-[var(--hh-radius-md)] overflow-hidden relative group border border-[var(--hh-border)] hover:border-[var(--hh-accent)] disabled:opacity-50" title={name}>
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
        <MainLayout>
            <div className="min-h-screen pt-8 pb-20">
                <div className="container mx-auto px-4 max-w-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                            <span className="hh-label text-[var(--hh-accent)]">{t("page.guessWho.badge")}</span>
                        </div>
                        <h1 className="hh-display text-4xl text-[var(--hh-text-primary)] mb-2">{t("page.guessWho.title")} <span className="text-[var(--hh-accent)]">?</span></h1>
                        <p className="hh-body text-[var(--hh-text-secondary)]">{t("page.guessWho.description")}</p>
                        <a
                            href="/guess-who/multiplayer/"
                            className="hh-btn hh-btn-primary hh-press hh-focusable inline-flex items-center gap-2 mt-4 px-6 py-2.5 text-sm"
                        >
                            <span>{t("page.guessWho.single.multiplayerMode")}</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </a>
                    </div>

                    <div className="hh-panel p-4 sm:p-8 space-y-6 sm:space-y-8">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block hh-label mb-2">{t("page.guessWho.common.seed")}</label>
                                <div className="flex gap-2">
                                    <input type="text" value={settings.seed} onChange={(e) => setSettings({ ...settings, seed: e.target.value })} className="hh-input flex-1 px-4 py-2 font-mono text-sm" />
                                    <button onClick={() => setSettings({ ...settings, seed: Math.random().toString(36).substring(7) })} className="hh-press hh-focusable px-3 py-2 rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent)] hover:bg-[var(--hh-surface-sunken)]" title={t("page.guessWho.single.regenerateSeed")}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-end w-full sm:w-auto">
                                <button onClick={copyShareLink} className="hh-btn hh-press hh-focusable w-full sm:w-auto px-4 h-[42px] flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    {t("page.guessWho.single.share")}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block hh-label mb-3">{t("page.guessWho.single.difficultySetting")}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(["easy", "normal", "hard", "extreme"] as Difficulty[]).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSettings({ ...settings, difficulty: d })}
                                        className={`hh-press hh-focusable py-3 rounded-[var(--hh-radius-md)] border font-semibold capitalize text-sm ${settings.difficulty === d
                                            ? d === "extreme"
                                                ? "bg-[var(--hh-accent-alert)] border-[var(--hh-accent-alert)] text-white"
                                                : "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                                            : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:border-[var(--hh-border-strong)]"
                                            }`}
                                    >
                                        {t(`page.guessWho.common.difficultyLabels.${d}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block hh-label mb-3">{t("page.guessWho.single.raritySetting")}</label>
                            <div className="flex flex-wrap gap-2">
                                {RARITY_OPTIONS.map(({ id, num }) => {
                                    const isSelected = settings.selectedRarities.includes(id);
                                    return (
                                        <button key={id} onClick={() => handleRarityToggle(id)} className={`hh-chip hh-press hh-focusable h-11 px-3 ${isSelected ? "hh-chip-active" : ""}`}>
                                            {id === "rarity_birthday" ? (<div className="w-5 h-5 relative"><Image src="/data/icon/birthday.webp" alt="Birthday" fill className="object-contain" unoptimized /></div>) : (Array.from({ length: num }).map((_, i) => (<div key={i} className="w-4 h-4 relative"><Image src="/data/icon/star.webp" alt="Star" fill className="object-contain" unoptimized /></div>)))}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block hh-label mb-3">{t("page.guessWho.single.serverScope")}</label>
                                <div className="hh-segment" role="tablist">
                                    {(["jp", "cn"] as ServerScope[]).map(s => (
                                        <button key={s} role="tab" aria-selected={settings.server === s} onClick={() => setSettings({ ...settings, server: s })} className="hh-segment-item hh-press">
                                            {t(`page.guessWho.common.serverLabels.${s}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block hh-label mb-3">{t("page.guessWho.single.guessTime")}</label>
                                <input type="number" value={settings.timeLimit} onChange={(e) => setSettings({ ...settings, timeLimit: Math.max(3, Math.min(120, Number(e.target.value))) })} className="hh-input hh-numeric w-full px-4 py-2 font-mono text-center" />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[var(--hh-border)] mt-6 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <label className="hh-label">{t("page.guessWho.single.characterFilter")}</label>
                            <button onClick={() => setSettings({ ...settings, selectedUnitIds: [] })} className="text-xs text-[var(--hh-accent)] hover:underline">{t("page.guessWho.single.resetFilter")}</button>
                        </div>
                        <div className="flex flex-wrap gap-3 mb-4 justify-center">
                            {UNIT_DATA.map(unit => {
                                const unitLabel = t(UNIT_ID_LABEL_KEYS[unit.id] ?? `common.units.${unit.id}`);
                                return (
                                    <button key={unit.id} onClick={() => handleUnitToggle(unit.id)} className={`hh-press hh-focusable p-1 rounded-[var(--hh-radius-md)] border ${settings.selectedUnitIds.includes(unit.id) ? "bg-[var(--hh-accent-wash)] border-[var(--hh-accent)]" : "border-transparent opacity-60 hover:opacity-100 grayscale hover:grayscale-0 hover:bg-[var(--hh-surface-sunken)]"}`}>
                                        <Image src={`/data/icon/${UNIT_ICON_FILES[unit.id]}`} alt={unitLabel} width={40} height={40} className="w-10 h-10 object-contain" unoptimized />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="text-xs text-[var(--hh-text-tertiary)] text-center">{settings.selectedUnitIds.length > 0 ? t("page.guessWho.single.selectedCharacters", { count: availableCharacters.length }) : t("page.guessWho.single.selectedAllCharacters")}</div>
                    </div>

                    {loadError && (
                        <div className="hh-tile text-center p-4 border-[var(--hh-accent-alert)]">
                            <p className="text-[var(--hh-accent-alert)] text-sm font-medium mb-2">{loadError}</p>
                            <button onClick={loadCards} className="hh-btn hh-btn-danger hh-press hh-focusable px-4 py-2 text-sm">
                                {t("page.guessWho.common.reload")}
                            </button>
                        </div>
                    )}

                    {/* Primary action — a solid accent slab that dips on press. No
                        gradient or colored glow: the console main key reads as a
                        physical button, not a web CTA. */}
                    <button onClick={startGame} disabled={isLoading || !!loadError} className="hh-btn hh-btn-primary hh-press hh-focusable hh-display w-full py-4 mt-6 text-xl disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? t("page.guessWho.common.loading") : t("page.guessWho.single.startChallenge")}
                    </button>

                    <Link href="/guess-jacket" className="mt-3 block text-center text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent)] transition-colors">
                        {t("page.guessWho.single.goGuessJacket")}
                    </Link>
                </div>
            </div>
        </MainLayout >
    );
}
