"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { getMusicJacketUrl } from "@/lib/assets";
import type { AssetSourceType } from "@/contexts/ThemeContext";
import { fetchMasterDataForServer } from "@/lib/fetch";
import { loadTranslations, type TranslationData } from "@/lib/translations";
import { useI18n } from "@/contexts/I18nContext";
import type { IMusicInfo } from "@/types/music";

const ROUNDS_PER_GAME = 10;
const OPTIONS_PER_ROUND_DEFAULT = 10;
const OPTIONS_CHOICES = [4, 6, 8, 10] as const;
const BASE_SCORE_PER_ROUND = 1000;
const FEEDBACK_DURATION = 3000;
const MAX_STRIKES_PER_ROUND = 3;

type GameState = "setup" | "playing" | "result";
type Difficulty = "easy" | "normal" | "hard" | "extreme";
type ServerScope = "jp" | "cn";

// Distortion Effects for Extreme Mode
type DistortionType = "none" | "hue-rotate" | "flip-v" | "flip-h" | "grayscale" | "invert" | "rgb-shuffle";

interface ActiveDistortion {
    type: DistortionType;
}

const DISTORTION_POOL: ActiveDistortion[] = [
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

interface CropRect {
    x: number;
    y: number;
    size: number;
}

interface GameSettings {
    server: ServerScope;
    seed: string;
    difficulty: Difficulty;
    timeLimit: number;
    optionsCount: number;
}

interface RoundQuestion {
    music: IMusicInfo;
    options: IMusicInfo[];
}

interface RoundResult {
    round: number;
    music: IMusicInfo;
    userGuess: number | null;
    isCorrect: boolean;
    score: number;
    timeTaken: number;
    multiplier: number;
    distortions?: ActiveDistortion[];
}

class SeededRandom {
    private seed: number;

    constructor(seed: string) {
        this.seed = this.hashString(seed || Date.now().toString());
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return hash;
    }

    next(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    pickMultiple<T>(array: T[], count: number): T[] {
        const pool = [...array];
        const picked: T[] = [];
        const total = Math.min(count, pool.length);

        for (let i = 0; i < total; i++) {
            const index = Math.floor(this.next() * pool.length);
            picked.push(pool[index]);
            pool.splice(index, 1);
        }

        return picked;
    }
}

const CanvasImage = ({ image, objectFit = "contain" }: { image: HTMLImageElement | null; objectFit?: "contain" | "cover" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
    }, [image]);

    if (!image) return null;

    return <canvas ref={canvasRef} className="w-full h-full block" style={{ objectFit }} />;
};

function getAssetSourceForServer(server: ServerScope): AssetSourceType {
    return server === "cn" ? "main-cn" : "main-jp";
}

function getDifficultyMultiplier(difficulty: Difficulty): number {
    if (difficulty === "easy") return 0.8;
    if (difficulty === "hard") return 1.5;
    if (difficulty === "extreme") return 2.2;
    return 1.0;
}

function getCropSize(difficulty: Difficulty): number {
    if (difficulty === "easy") return 380;
    if (difficulty === "hard") return 200;
    if (difficulty === "extreme") return 150;
    return 280;
}

function GuessJacketContent() {
    const searchParams = useSearchParams();
    const { t } = useI18n();

    const [gameState, setGameState] = useState<GameState>("setup");
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [settings, setSettings] = useState<GameSettings>({
        server: "jp",
        seed: Math.random().toString(36).substring(7),
        difficulty: "normal",
        timeLimit: 30,
        optionsCount: OPTIONS_PER_ROUND_DEFAULT,
    });

    const [rounds, setRounds] = useState<RoundQuestion[]>([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [currentResults, setCurrentResults] = useState<RoundResult[]>([]);
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRoundActive, setIsRoundActive] = useState(false);
    const [cropRect, setCropRect] = useState<CropRect | null>(null);
    const [strikes, setStrikes] = useState(0);
    const [combo, setCombo] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackResult, setFeedbackResult] = useState<RoundResult | null>(null);
    const [disabledOptionIds, setDisabledOptionIds] = useState<number[]>([]);
    const [roundNotice, setRoundNotice] = useState("");
    const [redrawFlag, setRedrawFlag] = useState(0);
    const [currentDistortions, setCurrentDistortions] = useState<ActiveDistortion[]>([]);

    const activeImagesRef = useRef<Record<number, HTMLImageElement>>({});
    const roundResolvedRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
    const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const seedParam = searchParams.get("seed");
        const difficultyParam = searchParams.get("difficulty");
        const timeParam = searchParams.get("time");
        const optionsParam = searchParams.get("options");
        const serverParam = searchParams.get("server");

        const safeDifficulty: Difficulty =
            difficultyParam === "easy" || difficultyParam === "normal" || difficultyParam === "hard" || difficultyParam === "extreme"
                ? difficultyParam
                : "normal";

        const timeFromQuery = timeParam === null ? NaN : Number(timeParam);
        const safeTime = Number.isFinite(timeFromQuery)
            ? Math.max(5, Math.min(120, timeFromQuery))
            : 30;

        const optionsFromQuery = optionsParam === null ? NaN : Number(optionsParam);
        const safeOptions = Number.isFinite(optionsFromQuery) && (OPTIONS_CHOICES as readonly number[]).includes(optionsFromQuery)
            ? optionsFromQuery
            : OPTIONS_PER_ROUND_DEFAULT;

        const safeServer: ServerScope = serverParam === "cn" ? "cn" : "jp";

        setSettings((prev) => ({
            ...prev,
            seed: seedParam || prev.seed,
            difficulty: safeDifficulty,
            timeLimit: safeTime,
            optionsCount: safeOptions,
            server: safeServer,
        }));
    }, [searchParams]);

    const loadMusics = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
        try {
            const [data, translationsData] = await Promise.all([
                fetchMasterDataForServer<IMusicInfo[]>(settings.server, "musics.json"),
                loadTranslations(),
            ]);
            const validMusics = data.filter((music) =>
                Boolean(music.assetbundleName && music.title && music.id > 0)
            );
            setMusics(validMusics);
            setTranslations(translationsData);
        } catch (error) {
            console.error("Failed to load musics", error);
            setLoadError(t("page.guessJacket.common.errors.musicLoadFailed"));
        } finally {
            setIsLoading(false);
        }
    }, [settings.server, t]);

    useEffect(() => {
        loadMusics();
    }, [loadMusics]);

    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
            if (noticeTimerRef.current) {
                clearTimeout(noticeTimerRef.current);
            }
        };
    }, []);

    const musicMap = useMemo(() => {
        return new Map(musics.map((music) => [music.id, music]));
    }, [musics]);

    const getCnTitle = useCallback((jpTitle: string) => {
        return translations?.music?.title?.[jpTitle] ?? "";
    }, [translations]);

    const getDisplayTitle = useCallback((music: IMusicInfo) => {
        const jp = music.title;
        const cn = getCnTitle(jp);
        return {
            jp,
            cn,
        };
    }, [getCnTitle]);

    const getDisplayTitleById = useCallback((musicId: number | null) => {
        if (!musicId) return null;
        const music = musicMap.get(musicId);
        if (!music) return null;
        return getDisplayTitle(music);
    }, [getDisplayTitle, musicMap]);

    const currentQuestion = rounds[currentRound];
    const currentCanvasImage = activeImagesRef.current[currentRound] || null;
    const currentTotalScore = currentResults.reduce((total, result) => total + result.score, 0);
    const comboMultiplier = combo > 0 ? 1 + combo * 0.5 : 1;

    const getShareUrl = useCallback(() => {
        if (typeof window === "undefined") return "";

        const params = new URLSearchParams();
        params.set("seed", settings.seed);
        params.set("difficulty", settings.difficulty);
        params.set("time", settings.timeLimit.toString());
        params.set("options", settings.optionsCount.toString());
        params.set("server", settings.server);
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    }, [settings]);

    const copyShareLink = useCallback(() => {
        const url = getShareUrl();
        navigator.clipboard.writeText(url).then(() => {
            alert(t("page.guessJacket.single.shareCopied"));
        });
    }, [getShareUrl, t]);

    const buildRounds = useCallback((pool: IMusicInfo[], seed: string, optionsCount: number): RoundQuestion[] => {
        const deckRandom = new SeededRandom(`${seed}-deck`);
        const selectedSongs = deckRandom.pickMultiple(pool, ROUNDS_PER_GAME);

        return selectedSongs.map((music, roundIndex) => {
            const optionRandom = new SeededRandom(`${seed}-options-${roundIndex}-${music.id}`);
            const distractors = optionRandom.pickMultiple(
                pool.filter((candidate) => candidate.id !== music.id),
                optionsCount - 1
            );
            const mixed = optionRandom.pickMultiple([...distractors, music], optionsCount);
            return {
                music,
                options: mixed,
            };
        });
    }, []);

    const showTransientNotice = useCallback((message: string) => {
        setRoundNotice(message);
        if (noticeTimerRef.current) {
            clearTimeout(noticeTimerRef.current);
        }
        noticeTimerRef.current = setTimeout(() => {
            setRoundNotice("");
        }, 1000);
    }, []);

    const startRound = useCallback((question: RoundQuestion, roundIndex: number) => {
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }

        roundResolvedRef.current = false;
        setShowFeedback(false);
        setFeedbackResult(null);
        setCropRect(null);
        setTimeLeft(settings.timeLimit);
        setStrikes(0);
        setDisabledOptionIds([]);
        setRoundNotice("");
        setIsRoundActive(false);

        const assetSource = getAssetSourceForServer(settings.server);
        const image = new window.Image();
        image.crossOrigin = "anonymous";
        image.src = getMusicJacketUrl(question.music.assetbundleName, assetSource);

        image.onload = () => {
            activeImagesRef.current[roundIndex] = image;
            setRedrawFlag((prev) => prev + 1);

            const cropSize = getCropSize(settings.difficulty);
            const maxX = Math.max(0, image.width - cropSize);
            const maxY = Math.max(0, image.height - cropSize);
            const cropRandom = new SeededRandom(`${settings.seed}-crop-${roundIndex}-${question.music.id}`);

            const x = Math.floor(cropRandom.next() * (maxX + 1));
            const y = Math.floor(cropRandom.next() * (maxY + 1));

            // Extreme Mode: pick 1-3 random distortions (consistent with guess-who)
            if (settings.difficulty === "extreme") {
                const distRandom = new SeededRandom(`${settings.seed}-dist-${roundIndex}`);
                const numDistortions = Math.floor(distRandom.next() * 3) + 1; // 1 to 3
                const pool = [...DISTORTION_POOL];
                const picked: ActiveDistortion[] = [];
                for (let i = 0; i < numDistortions && pool.length > 0; i++) {
                    const idx = Math.floor(distRandom.next() * pool.length);
                    picked.push(pool[idx]);
                    pool.splice(idx, 1);
                }
                const activeEffects = picked.filter(e => e.type !== "none");
                setCurrentDistortions(activeEffects);
            } else {
                setCurrentDistortions([]);
            }

            setCropRect({ x, y, size: cropSize });
            setIsRoundActive(true);
        };

        image.onerror = () => {
            console.error("Failed to load music jacket", question.music.id);
            showTransientNotice(t("page.guessJacket.common.errors.jacketLoadFailed"));
            setIsRoundActive(true);
            setTimeLeft(0);
        };
    }, [settings.difficulty, settings.seed, settings.timeLimit, settings.server, showTransientNotice, t]);

    useEffect(() => {
        const currentImage = activeImagesRef.current[currentRound];
        const canvas = canvasRef.current;

        if (!canvas || !currentImage || !cropRect) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = 320;
        canvas.height = 320;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Base filter per difficulty
        if (settings.difficulty === "hard") {
            ctx.filter = "saturate(120%) contrast(130%)";
        } else {
            ctx.filter = "none";
        }

        ctx.save();

        // Apply distortion filters (extreme mode)
        if (settings.difficulty === "extreme") {
            let filterString = "";
            const hasFlipH = currentDistortions.some(d => d.type === "flip-h");
            const hasFlipV = currentDistortions.some(d => d.type === "flip-v");
            const hasGrayscale = currentDistortions.some(d => d.type === "grayscale");
            const hasInvert = currentDistortions.some(d => d.type === "invert");
            const hasHueRotate = currentDistortions.some(d => d.type === "hue-rotate");

            if (hasGrayscale) filterString += "grayscale(100%) ";
            if (hasInvert) filterString += "invert(100%) ";
            if (hasHueRotate) filterString += "hue-rotate(180deg) ";

            if (filterString) ctx.filter = filterString.trim();

            if (hasFlipH || hasFlipV) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(hasFlipH ? -1 : 1, hasFlipV ? -1 : 1);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }
        }

        ctx.drawImage(
            currentImage,
            cropRect.x,
            cropRect.y,
            cropRect.size,
            cropRect.size,
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.restore();

        // Apply pixel manipulations (RGB Shuffle) after standard filters
        if (settings.difficulty === "extreme" && currentDistortions.some(d => d.type === "rgb-shuffle")) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                data[i] = g;
                data[i + 1] = b;
                data[i + 2] = r;
            }
            ctx.putImageData(imageData, 0, 0);
        }
    }, [currentRound, cropRect, redrawFlag, settings.difficulty, settings.seed, currentDistortions]);

    const finishRound = useCallback((guessMusicId: number | null) => {
        if (roundResolvedRef.current || !currentQuestion) return;
        roundResolvedRef.current = true;
        setIsRoundActive(false);

        const isCorrect = guessMusicId === currentQuestion.music.id;
        const timeTaken = settings.timeLimit - timeLeft;

        let roundScore = 0;
        let multiplier = 1;

        if (isCorrect) {
            const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
            const diffMultiplier = getDifficultyMultiplier(settings.difficulty);
            const newCombo = strikes === 0 ? combo + 1 : 0;
            setCombo(newCombo);

            multiplier = 1 + Math.max(0, newCombo - 1) * 0.5;
            roundScore = Math.floor(BASE_SCORE_PER_ROUND * timeFactor * diffMultiplier * multiplier);
        } else {
            setCombo(0);
        }

        const result: RoundResult = {
            round: currentRound,
            music: currentQuestion.music,
            userGuess: guessMusicId,
            isCorrect,
            score: roundScore,
            timeTaken,
            multiplier,
            distortions: currentDistortions.length > 0 ? currentDistortions : undefined,
        };

        setCurrentResults((prev) => [...prev, result]);
        setFeedbackResult(result);
        setShowFeedback(true);

        feedbackTimerRef.current = setTimeout(() => {
            if (currentRound < ROUNDS_PER_GAME - 1) {
                const nextRound = currentRound + 1;
                setCurrentRound(nextRound);
                const nextQuestion = rounds[nextRound];
                if (nextQuestion) {
                    startRound(nextQuestion, nextRound);
                }
            } else {
                setGameState("result");
            }
        }, FEEDBACK_DURATION);
    }, [combo, currentDistortions, currentQuestion, currentRound, rounds, settings.difficulty, settings.timeLimit, startRound, strikes, timeLeft]);

    const handleGuess = useCallback((musicId: number | null) => {
        if (!isRoundActive || !currentQuestion) return;

        const isCorrect = musicId === currentQuestion.music.id;

        if (!isCorrect && musicId !== null && strikes < MAX_STRIKES_PER_ROUND - 1) {
            setStrikes((prev) => prev + 1);
            setTimeLeft((prev) => prev * 0.5);
            setCombo(0);
            setDisabledOptionIds((prev) => (prev.includes(musicId) ? prev : [...prev, musicId]));
            showTransientNotice(t("page.guessJacket.single.wrongTimePenalty"));
            return;
        }

        finishRound(musicId);
    }, [currentQuestion, finishRound, isRoundActive, showTransientNotice, strikes, t]);

    useEffect(() => {
        if (!isRoundActive) return;
        if (timeLeft <= 0) {
            finishRound(null);
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 0.1));
        }, 100);

        return () => clearInterval(timer);
    }, [finishRound, isRoundActive, timeLeft]);

    const startGame = useCallback(() => {
        if (isLoading) return;

        const validPool = musics.filter((music) => music.assetbundleName && music.title);
        const requiredPoolSize = Math.max(ROUNDS_PER_GAME, settings.optionsCount);

        if (validPool.length < requiredPoolSize) {
            alert(t("page.guessJacket.common.errors.deckInsufficient", { count: validPool.length }));
            return;
        }

        const builtRounds = buildRounds(validPool, settings.seed, settings.optionsCount);
        setRounds(builtRounds);
        setCurrentRound(0);
        setCurrentResults([]);
        setCombo(0);
        activeImagesRef.current = {};
        setGameState("playing");
        startRound(builtRounds[0], 0);
    }, [buildRounds, isLoading, musics, settings.optionsCount, settings.seed, startRound, t]);

    const handleNextRound = useCallback(() => {
        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }

        if (currentRound < ROUNDS_PER_GAME - 1) {
            const nextRound = currentRound + 1;
            setCurrentRound(nextRound);
            const nextQuestion = rounds[nextRound];
            if (nextQuestion) {
                startRound(nextQuestion, nextRound);
            }
        } else {
            setGameState("result");
        }
    }, [currentRound, rounds, startRound]);

    const formatTime = (seconds: number) => `${Math.max(0, seconds).toFixed(1)}s`;
    const getServerLabel = useCallback((server: ServerScope) => t(`page.guessJacket.common.serverLabels.${server}`), [t]);
    const getServerShortLabel = useCallback((server: ServerScope) => t(`page.guessJacket.common.serverLabels.${server}Short`), [t]);
    const getDifficultyLabel = useCallback((difficulty: Difficulty) => t(`page.guessJacket.common.difficultyLabels.${difficulty}`), [t]);
    const getDistortionLabel = useCallback((distortion: ActiveDistortion) => t(`page.guessJacket.common.distortions.${DISTORTION_LABEL_KEYS[distortion.type]}`), [t]);
    const getLocalizedMusicTitle = useCallback((title: ReturnType<typeof getDisplayTitle> | null) => {
        if (!title) return t("page.guessJacket.common.noTranslation");
        return title.cn || t("page.guessJacket.common.noTranslation");
    }, [t]);
    const formatGuessedTitle = useCallback((musicId: number | null) => {
        if (!musicId) return t("page.guessJacket.common.timeout");
        const guessed = getDisplayTitleById(musicId);
        if (!guessed) return t("page.guessJacket.common.noTranslation");
        return `${guessed.jp} / ${getLocalizedMusicTitle(guessed)}`;
    }, [getDisplayTitleById, getLocalizedMusicTitle, t]);

    const potentialScore = useMemo(() => {
        if (!isRoundActive) return 0;

        const timeFactor = Math.max(0.1, timeLeft / settings.timeLimit);
        const difficultyFactor = getDifficultyMultiplier(settings.difficulty);
        const previewComboMultiplier = combo > 0 ? 1 + combo * 0.5 : 1;

        return Math.floor(BASE_SCORE_PER_ROUND * timeFactor * difficultyFactor * previewComboMultiplier);
    }, [combo, isRoundActive, settings.difficulty, settings.timeLimit, timeLeft]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex min-h-screen items-center justify-center">
                    <h1 className="sr-only">{t("page.guessJacket.title")}</h1>
                    {t("page.guessJacket.common.loading")}
                </div>
            </MainLayout>
        );
    }

    if (gameState === "result") {
        const shareUrl = getShareUrl();
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

        return (
            <MainLayout>
                <div className="min-h-screen">
                    <div className="container mx-auto px-4 py-8 pb-20">
                        <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden ios-glass-card">
                            <div className="p-8 text-center border-b border-slate-200/20">
                                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4 bg-white/10">
                                    <span className="text-miku text-xs font-bold tracking-widest uppercase">GUESS JACKET</span>
                                </div>
                                <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-2">{t("page.guessJacket.single.challengeComplete")}</h1>
                                <p className="text-xl text-slate-500 mb-6">{t("page.guessJacket.single.finalScore")}</p>
                                <div className="text-6xl font-black text-miku mb-8 animate-bounce">{currentTotalScore}</div>

                                <div className="flex flex-col md:flex-row items-center justify-center gap-8 ios-glass-panel rounded-2xl p-6 mb-8">
                                    <div className="text-left space-y-2 text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{t("page.guessJacket.common.seed")}</span>
                                            <code className="ios-glass-panel px-2 py-1 rounded border border-slate-200/10 font-mono text-slate-800 dark:text-slate-200">{settings.seed}</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{t("page.guessJacket.common.server")}</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100">{getServerLabel(settings.server)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{t("page.guessJacket.common.difficulty")}</span>
                                            <span className="font-bold text-miku">{getDifficultyLabel(settings.difficulty)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{t("page.guessJacket.common.timeLimit")}</span>
                                            <span className="text-slate-800 dark:text-slate-200">{settings.timeLimit}{t("page.guessJacket.common.secondsSuffix")}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{t("page.guessJacket.common.questionCount")}</span>
                                            <span className="text-slate-800 dark:text-slate-200">{t("page.guessJacket.common.questionCountValue", { rounds: ROUNDS_PER_GAME, options: settings.optionsCount })}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-[120px] h-[120px] bg-white p-2 rounded-xl shadow-sm border border-slate-200/50">
                                            <Image src={qrCodeUrl} alt="Share QR Code" width={120} height={120} className="w-full h-full object-contain" unoptimized />
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">{t("page.guessJacket.single.scanToChallenge")}</span>
                                    </div>
                                </div>

                                <div className="flex justify-center gap-4">
                                    <button
                                        onClick={copyShareLink}
                                        className="px-6 py-3 ios-glass-btn text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-white/10 transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        {t("page.guessJacket.single.copyLink")}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSettings((prev) => ({
                                                ...prev,
                                                seed: Math.random().toString(36).substring(7),
                                            }));
                                            setGameState("setup");
                                        }}
                                        className="px-6 py-3 ios-glass-btn ios-glass-btn-primary text-white rounded-xl font-bold shadow-lg shadow-miku/30"
                                    >
                                        {t("page.guessJacket.single.playAgainNewSeed")}
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50/10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    {currentResults.map((result) => (
                                        <Link
                                            href={`/music/${result.music.id}`}
                                            key={result.round}
                                            className={`block p-4 rounded-xl border transition-transform hover:-translate-y-1 hover:shadow-md ${result.isCorrect ? "bg-green-50/90 dark:bg-black/50 border-green-200" : "bg-red-50/90 dark:bg-black/50 border-red-200"}`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 relative rounded-lg overflow-hidden shadow-sm ring-1 ring-black/10 shrink-0">
                                                    <Image
                                                        src={getMusicJacketUrl(result.music.assetbundleName, getAssetSourceForServer(settings.server))}
                                                        alt={result.music.title}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-0.5">
                                                        Round {result.round + 1}
                                                    </div>
                                                    <div className={`font-black text-lg leading-tight mb-1 ${result.isCorrect ? "text-green-700" : "text-red-700"}`}>
                                                        {result.isCorrect ? t("page.guessJacket.common.correct") : t("page.guessJacket.common.wrong")}
                                                    </div>
                                                    {!result.isCorrect && (
                                                        <div className="text-xs text-red-600 font-bold bg-white/50 inline-block px-1 rounded mb-1">
                                                            {t("page.guessJacket.common.selectedGuess", { name: formatGuessedTitle(result.userGuess) })}
                                                        </div>
                                                    )}
                                                    <div className="text-sm text-slate-700 truncate font-bold">{getDisplayTitle(result.music).jp}</div>
                                                    <div className="text-xs text-slate-500 truncate">{getLocalizedMusicTitle(getDisplayTitle(result.music))}</div>
                                                    <div className="text-xs text-slate-400">{t("page.guessJacket.common.usedTime", { time: formatTime(result.timeTaken) })}</div>
                                                </div>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <div className="text-lg font-bold text-slate-700">+{result.score}</div>
                                                    {result.multiplier > 1 && (
                                                        <div className="text-xs font-bold text-miku bg-miku/10 px-1.5 rounded">
                                                            x{result.multiplier.toFixed(1)} Combo
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {result.distortions && result.distortions.length > 0 && (
                                                <div className="flex flex-wrap justify-end gap-1 px-1 mt-1">
                                                    {result.distortions.map((d, i) => (
                                                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-800/80 text-white rounded font-bold shadow-sm whitespace-nowrap">
                                                            {getDistortionLabel(d)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
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

    if (gameState === "playing" && currentQuestion) {
        return (
            <MainLayout>
                <div className="h-[100dvh] overflow-hidden">
                    <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col h-[100dvh] relative overflow-hidden">
                        {showFeedback && feedbackResult && currentCanvasImage && typeof document !== "undefined" && createPortal(
                            <div
                                className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 cursor-pointer animate-in fade-in duration-200"
                                onClick={handleNextRound}
                            >
                                <div className="relative w-full max-w-lg aspect-square">
                                    <CanvasImage image={currentCanvasImage} objectFit="contain" />
                                </div>
                                <div className={`mt-8 px-8 py-4 rounded-full font-black text-3xl animate-bounce ${feedbackResult.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                                    {feedbackResult.isCorrect ? t("page.guessJacket.single.feedbackCorrect") : t("page.guessJacket.single.feedbackWrong")}
                                </div>
                                <div className="mt-4 text-center text-white max-w-2xl px-4">
                                    <div className="text-2xl font-bold mb-1">{getDisplayTitle(feedbackResult.music).jp}</div>
                                    <div className="text-base text-slate-300 mb-1">{getLocalizedMusicTitle(getDisplayTitle(feedbackResult.music))}</div>
                                    {!feedbackResult.isCorrect && (
                                        <div className="text-slate-300 text-sm">
                                            {t("page.guessJacket.common.answer", { name: formatGuessedTitle(feedbackResult.userGuess) })}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-8 text-slate-400 text-sm animate-pulse">{t("page.guessJacket.single.clickContinue", { seconds: FEEDBACK_DURATION / 1000 })}</div>
                            </div>,
                            document.body
                        )}

                        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-sm mb-3 sm:mb-6 shrink-0">
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

                            <div className="flex justify-between items-center mb-2 px-1">
                                <div className="flex items-center gap-1 h-6">
                                    {comboMultiplier > 1 && (
                                        <div className="flex items-center gap-1 bg-yellow-400 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm animate-pulse">
                                            <span>COMBO x{comboMultiplier.toFixed(1)}</span>
                                            <span className="text-[10px] opacity-80">(Streak: {combo})</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {[...Array(MAX_STRIKES_PER_ROUND)].map((_, index) => (
                                        <div
                                            key={index}
                                            className={`w-3 h-3 rounded-full transition-colors ${index < (MAX_STRIKES_PER_ROUND - strikes) ? "bg-red-500" : "bg-slate-200"}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="relative h-6 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-miku transition-all duration-100 ease-linear"
                                    style={{ width: `${(timeLeft / settings.timeLimit) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                                    {formatTime(timeLeft)}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center gap-2 sm:gap-6 pb-3 sm:pb-8 overflow-hidden">
                            <div className="flex flex-col items-center gap-2 sm:gap-4 shrink-0">
                                <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white bg-slate-100 shrink-0 w-[min(36vw,132px)] h-[min(36vw,132px)] sm:w-[320px] sm:h-[320px]">
                                    <canvas ref={canvasRef} width={320} height={320} className="w-full h-full" />
                                    {isRoundActive && currentDistortions.length > 0 && (
                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                                            {currentDistortions.map((d, i) => (
                                                <span key={i} className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-sm opacity-90">
                                                    {getDistortionLabel(d)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {!isRoundActive && !showFeedback && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold backdrop-blur-sm">
                                            {t("page.guessJacket.single.loadingImage")}
                                        </div>
                                    )}
                                </div>

                                <div className="text-[11px] sm:text-xs text-slate-500 text-center px-4">
                                    {t("page.guessJacket.single.chooseHint", { count: settings.optionsCount })}
                                </div>

                                {roundNotice && (
                                    <div className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-bold animate-pulse shadow-md">
                                        {roundNotice}
                                    </div>
                                )}
                            </div>

                            <div className="w-full lg:flex-1 max-w-4xl p-2.5 sm:p-4 bg-white/80 backdrop-blur-md rounded-3xl shadow-sm min-h-0 flex-[1.25] lg:flex-1 overflow-hidden lg:h-full">
                                <div className="h-full overflow-y-auto pr-1 touch-pan-y overscroll-contain">
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        {currentQuestion.options.map((option, index) => {
                                            const isDisabled = !isRoundActive || disabledOptionIds.includes(option.id);
                                            return (
                                                <button
                                                    key={`${currentRound}-${option.id}`}
                                                    onClick={() => handleGuess(option.id)}
                                                    disabled={isDisabled}
                                                    className={`text-left px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all ${isDisabled
                                                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                        : "bg-white hover:border-miku hover:bg-miku/5 text-slate-700 border-slate-200 active:scale-[0.99]"
                                                        }`}
                                                >
                                                    <span className="text-[10px] sm:text-xs font-mono text-slate-400 mr-1.5 sm:mr-2">{String(index + 1).padStart(2, "0")}</span>
                                                    <span className="font-bold text-xs sm:text-base block truncate">{getDisplayTitle(option).jp}</span>
                                                    <span className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 block truncate">{getLocalizedMusicTitle(getDisplayTitle(option))}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="min-h-screen pt-8 pb-20">
                <div className="container mx-auto px-4 max-w-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4 bg-white/10 backdrop-blur-sm shadow-sm">
                            <span className="text-miku text-xs font-bold tracking-widest uppercase">Creativity Game</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-2 drop-shadow-sm">{t("page.guessJacket.title")} <span className="text-miku">?</span></h1>
                        <p className="text-slate-500 font-medium">{t("page.guessJacket.description")}</p>
                        <a
                            href="/guess-jacket/multiplayer/"
                            className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 ios-glass-btn ios-glass-btn-primary text-white rounded-full font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                        >
                            <span>{t("page.guessJacket.single.multiplayerMode")}</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </a>
                    </div>

                    <div className="ios-glass-card p-4 sm:p-8 rounded-3xl space-y-6 sm:space-y-8">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t("page.guessJacket.common.seed")}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={settings.seed}
                                        onChange={(event) => setSettings((prev) => ({ ...prev, seed: event.target.value }))}
                                        className="flex-1 px-4 py-2 ios-glass-input rounded-xl focus:outline-none font-mono text-sm"
                                    />
                                    <button
                                        onClick={() => setSettings((prev) => ({ ...prev, seed: Math.random().toString(36).substring(7) }))}
                                        className="px-3 py-2 text-slate-400 hover:text-miku hover:bg-white/10 rounded-lg transition-colors"
                                        title={t("page.guessJacket.single.regenerateSeed")}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-end w-full sm:w-auto">
                                <button onClick={copyShareLink} className="w-full sm:w-auto justify-center px-4 py-2.5 ios-glass-btn text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-white/10 transition-colors flex items-center gap-2 h-[42px]">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    {t("page.guessJacket.single.share")}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t("page.guessJacket.single.serverScope")}</label>
                                <div className="flex gap-2 p-1 ios-glass-panel rounded-lg">
                                    {(["jp", "cn"] as ServerScope[]).map(s => (
                                        <button key={s} onClick={() => setSettings({ ...settings, server: s })} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${settings.server === s ? "ios-glass-tab-active text-miku shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                                            {getServerShortLabel(s)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t("page.guessJacket.single.roundTime")}</label>
                                <input
                                    type="number"
                                    value={settings.timeLimit}
                                    onChange={(event) => {
                                        const nextValue = Number(event.target.value);
                                        const safeValue = Number.isFinite(nextValue) ? Math.max(5, Math.min(120, nextValue)) : 30;
                                        setSettings((prev) => ({ ...prev, timeLimit: safeValue }));
                                    }}
                                    className="w-full px-4 py-2 ios-glass-input rounded-xl focus:outline-none font-mono text-center"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t("page.guessJacket.single.difficultySetting")}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(["easy", "normal", "hard", "extreme"] as Difficulty[]).map((difficulty) => (
                                    <button
                                        key={difficulty}
                                        onClick={() => setSettings((prev) => ({ ...prev, difficulty }))}
                                        className={`py-3 rounded-xl font-bold capitalize transition-all text-sm ${settings.difficulty === difficulty
                                            ? `${difficulty === "extreme" ? "bg-red-500 ring-red-300" : "bg-miku ring-miku/30"} text-white shadow-md ring-2`
                                            : "ios-glass-tab text-slate-500 hover:bg-white/60"
                                            }`}
                                    >
                                        {getDifficultyLabel(difficulty)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t("page.guessJacket.single.optionsCount")}</label>
                            <div className="grid grid-cols-4 gap-2">
                                {OPTIONS_CHOICES.map((count) => (
                                    <button
                                        key={count}
                                        onClick={() => setSettings((prev) => ({ ...prev, optionsCount: count }))}
                                        className={`py-3 rounded-xl font-bold transition-all text-sm ${settings.optionsCount === count
                                            ? "ios-glass-tab-active bg-miku text-white shadow-md ring-2 ring-miku/30"
                                            : "ios-glass-tab text-slate-500 hover:bg-white/60"
                                            }`}
                                    >
                                        {t("page.guessJacket.common.optionCountLabel", { count })}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl ios-glass-panel p-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                            <div>• {t("page.guessJacket.single.rules.roundCount", { rounds: ROUNDS_PER_GAME, options: settings.optionsCount })}</div>
                            <div>• {t("page.guessJacket.single.rules.strikes", { strikes: MAX_STRIKES_PER_ROUND })}</div>
                            <div>• {t("page.guessJacket.single.rules.combo")}</div>
                            <div>• {t("page.guessJacket.single.rules.seed")}</div>
                        </div>
                    </div>

                    {loadError && (
                        <div className="mt-4 text-center p-4 ios-glass-card border border-red-500/20 bg-red-500/5 rounded-2xl">
                            <p className="text-red-600 text-sm font-medium mb-2">{loadError}</p>
                            <button
                                onClick={loadMusics}
                                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
                            >
                                {t("page.guessJacket.common.reload")}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={startGame}
                        disabled={isLoading || !!loadError}
                        className={`mt-6 w-full py-4 ios-glass-btn ios-glass-btn-primary text-white rounded-2xl font-black text-xl shadow-lg shadow-miku/20 active:scale-[0.99] transition-all ${(isLoading || loadError) ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {isLoading ? t("page.guessJacket.common.loading") : t("page.guessJacket.single.startChallenge")}
                    </button>

                    <Link
                        href="/guess-who"
                        className="mt-3 block text-center text-sm text-slate-500 hover:text-miku transition-colors"
                    >
                        {t("page.guessJacket.single.goGuessWho")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

export default function GuessJacketClient() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <GuessJacketContent />
        </Suspense>
    );
}
