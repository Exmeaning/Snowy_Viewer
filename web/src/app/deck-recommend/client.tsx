"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from "@/components/LocalizedLink";
import { useSearchParams } from "next/navigation";
import ExternalLink from "@/components/ExternalLink";
import { useI18n } from "@/contexts/I18nContext";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { UNIT_DATA, type ICardInfo } from "@/types/types";
import CharacterSelector from "@/components/deck-recommend/CharacterSelector";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { saveToolState, getAccount, getOAuthAccessTokenForGameUser, isValidServer, SERVER_OPTIONS, type ServerType } from "@/lib/account";
import { getWl3SimulationGroupByEventId, WL3_SIMULATION_GROUPS } from "@/lib/world-bloom-simulation";
import { getCharacterName } from "@/lib/i18n";
import AccountSelector from "@/components/AccountSelector";
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

interface WorkerCardConfig {
    disable?: boolean;
    rankMax?: boolean;
    episodeRead?: boolean;
    masterMax?: boolean;
    skillMax?: boolean;
}

interface DeckPowerInfo {
    total?: number;
}

interface DeckSkillInfo {
    scoreUp?: number;
    isPreTrainingSkill?: boolean;
}

interface DeckEventBonusInfo {
    total?: number;
    all?: number;
}

interface DeckCardResult {
    cardId: number;
    cardRarityType?: string;
    masterRank?: number;
    level?: number;
    characterId?: number;
    power?: DeckPowerInfo;
    skill?: DeckSkillInfo;
    eventBonus?: string | number | DeckEventBonusInfo;
}

interface DeckResult {
    score: number;
    eventBonus?: number;
    supportDeckBonus?: number;
    power?: DeckPowerInfo;
    cards?: DeckCardResult[];
    multiLiveScoreUp?: number;
}

interface ChallengeHighScoreInfo {
    highScore?: number;
}

type CardMasterInfo = ICardInfo;

interface UserCardInfo {
    cardId: number;
    masterRank?: number;
    level?: number;
}

interface WorkerProgressMessage {
    type: "progress";
    stage: string;
    percent: number;
    progressKey?: string;
    stageLabel?: string;
}

interface WorkerResultMessage {
    type?: "result";
    result?: DeckResult[];
    challengeHighScore?: ChallengeHighScoreInfo | null;
    userCards?: UserCardInfo[];
    duration?: number;
    upload_time?: number;
    error?: string;
}

type DeckRecommendWorkerMessage = WorkerProgressMessage | WorkerResultMessage;

interface DeckRecommendWorkerArgs {
    mode: DeckMode;
    userId: string;
    server: ServerType;
    musicId: number;
    difficulty: string;
    characterId?: number;
    eventId?: number;
    liveType: string;
    supportCharacterId?: number;
    cardConfig: Record<string, WorkerCardConfig>;
    // Custom mode: mixed-event custom bonus
    customUnit?: string;
    customCharacterIds?: number[];
    customCharacterUnits?: Record<number, string>;
    customAttr?: string;
    customCharacterBonus?: number;
    customAttrBonus?: number;
    leaderCharacter?: number;
    strongestTarget?: StrongestTarget;
}

type DeckMode = "event" | "challenge" | "mysekai" | "custom" | "strongest" | "wl3";
type StrongestTarget = "power" | "skill";

const MAX_CUSTOM_CHARACTERS = 5;

// Virtual Singer supportUnit options used by custom bonus unit selection
const VS_SUPPORT_UNIT_OPTIONS: { value: string; labelKey?: string; label: string; icon: string }[] = [
    { value: "none", labelKey: "common.supportUnits.none", label: "Original", icon: "vs.webp" },
    { value: "leo_need", label: "LN", icon: "ln.webp" },
    { value: "more_more_jump", label: "MMJ", icon: "mmj.webp" },
    { value: "vivid_bad_squad", label: "VBS", icon: "vbs.webp" },
    { value: "wonderlands_showtime", label: "WS", icon: "wxs.webp" },
    { value: "nightcord_at_25", label: "25ji", icon: "n25.webp" },
];

const MODE_OPTIONS: { value: DeckMode }[] = [
    { value: "event" },
    { value: "wl3" },
    { value: "challenge" },
    { value: "mysekai" },
    { value: "strongest" },
    { value: "custom" },
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
    { value: "multi" },
    { value: "solo" },
    { value: "auto" },
    { value: "cheerful" },
];

const SERVER_VALUE_SET = new Set<ServerType>(SERVER_OPTIONS.map((option) => option.value));
const MODE_VALUE_SET = new Set<DeckMode>(MODE_OPTIONS.map((option) => option.value));
const DIFFICULTY_VALUE_SET = new Set(DIFFICULTY_OPTIONS.map((option) => option.value));
const LIVE_TYPE_VALUE_SET = new Set(LIVE_TYPE_OPTIONS.map((option) => option.value));

const RARITY_CONFIG_KEYS = [
    { key: "rarity_1", label: "★1", color: "#888888" },
    { key: "rarity_2", label: "★2", color: "#88BB44" },
    { key: "rarity_3", label: "★3", color: "#4488DD" },
    { key: "rarity_4", label: "★4", color: "#FFAA00" },
    { key: "rarity_birthday", label: "Birthday", color: "#FF6699" },
];

const DEFAULT_CARD_CONFIG: Record<string, CardConfigItem> = {
    rarity_1: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_2: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_3: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_4: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
    rarity_birthday: { disable: false, rankMax: true, episodeRead: true, masterMax: false, skillMax: false },
};

const ATTR_OPTIONS = [
    { value: "cool", label: "Cool", icon: "Cool.webp" },
    { value: "cute", label: "Cute", icon: "cute.webp" },
    { value: "happy", label: "Happy", icon: "Happy.webp" },
    { value: "mysterious", label: "Mysterious", icon: "Mysterious.webp" },
    { value: "pure", label: "Pure", icon: "Pure.webp" },
];

const UNIT_OPTIONS = [
    { value: "leo_need", labelKey: "common.units.ln", icon: "ln.webp" },
    { value: "more_more_jump", labelKey: "common.units.mmj", icon: "mmj.webp" },
    { value: "vivid_bad_squad", labelKey: "common.units.vbs", icon: "vbs.webp" },
    { value: "wonderlands_showtime", labelKey: "common.units.ws", icon: "wxs.webp" },
    { value: "nightcord_at_25", labelKey: "common.units.25ji", icon: "n25.webp" },
    { value: "piapro", labelKey: "common.units.vs", icon: "vs.webp" },
];

type CustomSubMode = "unit" | "character";

type TranslationFn = ReturnType<typeof useI18n>["t"];

function getErrorMessage(error: string, t: TranslationFn): string {
    switch (error) {
        case "USER_NOT_FOUND":
            return t("page.deckRecommend.errors.userNotFound");
        case "API_NOT_PUBLIC":
            return t("page.deckRecommend.errors.apiNotPublic");
        case "INVALID_USER_DATA_PAYLOAD":
            return t("page.deckRecommend.errors.invalidUserDataPayload");
        default:
            if (error.includes("404")) return t("page.deckRecommend.errors.userNotFound404");
            if (error.includes("403")) return t("page.deckRecommend.errors.apiNotPublic403");
            return error;
    }
}

function parseBonusNumber(value: unknown): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const normalized = value.replace(/%/g, "").trim();
        const parsed = Number.parseFloat(normalized);
        if (Number.isFinite(parsed)) return parsed;
        const fallback = Number.parseFloat(normalized.replace(/[^0-9.+-]/g, ""));
        return Number.isFinite(fallback) ? fallback : 0;
    }
    return 0;
}

function parseCardEventBonusValue(value: DeckCardResult["eventBonus"]): number {
    if (value === undefined || value === null) {
        return 0;
    }
    if (typeof value === "object") {
        if (value.total !== undefined) {
            return parseBonusNumber(value.total);
        }
        if (value.all !== undefined) {
            return parseBonusNumber(value.all);
        }
        return 0;
    }
    return parseBonusNumber(value);
}

function formatBonusValue(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function parsePositiveInt(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ==================== Fake Progress Bar ====================
function ProgressBar({ stage, percent, stageLabel }: { stage: string; percent: number; stageLabel: string }) {
    const [displayPercent, setDisplayPercent] = useState(0);
    const targetRef = useRef(percent);

    useEffect(() => { targetRef.current = percent; }, [percent]);

    useEffect(() => {
        let raf: number;
        let current = 0;
        const animate = () => {
            const target = targetRef.current;
            const diff = target - current;
            if (Math.abs(diff) < 0.5) { current = target; setDisplayPercent(target); return; }
            const speed = target >= 90 ? 0.02 : target >= 70 ? 0.05 : 0.1;
            current += diff * speed;
            setDisplayPercent(Math.round(current * 10) / 10);
            raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, [percent]);

    useEffect(() => {
        if (stage === "done") return;
        const interval = setInterval(() => {
            setDisplayPercent(prev => {
                const t = targetRef.current;
                if (prev >= t - 1) return Math.min(prev + 0.3, t - 0.5);
                return prev;
            });
        }, 500);
        return () => clearInterval(interval);
    }, [stage]);

    // Track and fill are expressed inline rather than through the .dr-progress-*
    // rules: those still carry the old translucent gradient plus a shimmer
    // sweep, and a console progress meter is a solid accent bar in a sunken
    // trough with no travelling highlight.
    return (
        <div className="py-1">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--hh-text-secondary)]">{stageLabel}</span>
                <span className="hh-numeric text-xs font-mono text-[var(--hh-text-tertiary)]">{Math.round(displayPercent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-inset)]">
                <div
                    className="h-full rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)] transition-[width] duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)]"
                    style={{ width: `${displayPercent}%` }}
                />
            </div>
        </div>
    );
}

// ==================== Main Component ====================
export default function DeckRecommendClient() {
    const searchParams = useSearchParams();
    const { t, formatDate, formatNumber } = useI18n();
    const isScreenshotMode = searchParams.get("mode") === "screenshot";
    const [userId, setUserId] = useState("");
    const [server, setServer] = useState<ServerType>("jp");
    const [mode, setMode] = useState<DeckMode>("event");
    const [characterId, setCharacterId] = useState<number | null>(null);
    const [eventId, setEventId] = useState("");
    const [liveType, setLiveType] = useState("multi");
    const [supportCharacterId, setSupportCharacterId] = useState<number | null>(null);
    const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
    const [eventBonusCharacterIds, setEventBonusCharacterIds] = useState<number[]>([]);
    const [musicId, setMusicId] = useState("");
    const [difficulty, setDifficulty] = useState("master");
    const [cardConfig, setCardConfig] = useState<Record<string, CardConfigItem>>(JSON.parse(JSON.stringify(DEFAULT_CARD_CONFIG)));
    const [customSubMode, setCustomSubMode] = useState<CustomSubMode>("unit");
    const [customUnit, setCustomUnit] = useState("");
    const [customCharacterIds, setCustomCharacterIds] = useState<number[]>([]);
    const [customCharacterUnits, setCustomCharacterUnits] = useState<Record<number, string>>({});
    const [customAttr, setCustomAttr] = useState("");
    const [leaderCharacterId, setLeaderCharacterId] = useState<number | null>(null);
    const [showLeaderSelect, setShowLeaderSelect] = useState(false);
    const [strongestTarget, setStrongestTarget] = useState<StrongestTarget>("power");
    const [wl3GroupId, setWl3GroupId] = useState<number | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [results, setResults] = useState<DeckResult[] | null>(null);
    const [challengeHighScore, setChallengeHighScore] = useState<ChallengeHighScoreInfo | null>(null);
    const [duration, setDuration] = useState<number | null>(null);
    const [dataTime, setDataTime] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [allowSaveUserId, setAllowSaveUserId] = useState(false);
    const [showCardConfig, setShowCardConfig] = useState(false);
    const [progressStage, setProgressStage] = useState("idle");
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLabel, setProgressLabel] = useState("");
    const [cardsMaster, setCardsMaster] = useState<CardMasterInfo[]>([]);
    const [userCards, setUserCards] = useState<UserCardInfo[]>([]);
    const workerRef = useRef<Worker | null>(null);
    const autoCalculateKeyRef = useRef<string>("");
    // WL3 mode: derive simulation group from wl3GroupId; event mode: derive from eventId
    const selectedWl3Simulation = mode === "wl3"
        ? (wl3GroupId !== null ? WL3_SIMULATION_GROUPS.find(g => g.groupId === wl3GroupId) ?? null : null)
        : getWl3SimulationGroupByEventId(eventId);
    // Effective eventId for WL3 mode
    const effectiveEventId = mode === "wl3" ? (selectedWl3Simulation?.eventId?.toString() ?? "") : eventId;

    useEffect(() => {
        fetchMasterData<CardMasterInfo[]>("cards.json").then(setCardsMaster).catch(console.error);

        if (isScreenshotMode) return;

        let nextUserId = "";
        let nextServer: ServerType = "jp";
        let nextAllowSave = false;

        const account = getAccount();
        if (account?.toolStates.deckRecommend) {
            nextUserId = account.toolStates.deckRecommend.userId;
            nextServer = account.toolStates.deckRecommend.server;
            nextAllowSave = true;
        } else {
            const savedUserId = localStorage.getItem("deck_recommend_userid");
            const savedServer = localStorage.getItem("deck_recommend_server");
            if (savedUserId) {
                nextUserId = savedUserId;
                nextAllowSave = true;
            }
            if (isValidServer(savedServer)) {
                nextServer = savedServer;
            }
        }

        queueMicrotask(() => {
            setUserId(nextUserId);
            setServer(nextServer);
            setAllowSaveUserId(nextAllowSave);
        });
    }, [isScreenshotMode]);

    useEffect(() => {
        if (!isScreenshotMode) return;

        const queuedUpdates: Array<() => void> = [];

        const userIdParam = searchParams.get("userId")?.trim();
        if (userIdParam) {
            queuedUpdates.push(() => setUserId(userIdParam));
        }

        const serverParam = searchParams.get("server");
        if (serverParam && SERVER_VALUE_SET.has(serverParam as ServerType)) {
            queuedUpdates.push(() => setServer(serverParam as ServerType));
        }

        const deckModeParam = searchParams.get("deckMode");
        if (deckModeParam && MODE_VALUE_SET.has(deckModeParam as DeckMode)) {
            queuedUpdates.push(() => setMode(deckModeParam as DeckMode));
        }

        const characterParam = parsePositiveInt(searchParams.get("characterId"));
        if (characterParam !== null) {
            queuedUpdates.push(() => setCharacterId(characterParam));
        }

        const eventParam = parsePositiveInt(searchParams.get("eventId"));
        if (eventParam !== null) {
            queuedUpdates.push(() => setEventId(String(eventParam)));
        }

        const supportCharacterParam = parsePositiveInt(searchParams.get("supportCharacterId"));
        if (supportCharacterParam !== null) {
            queuedUpdates.push(() => setSupportCharacterId(supportCharacterParam));
        }

        const musicParam = parsePositiveInt(searchParams.get("musicId"));
        if (musicParam !== null) {
            queuedUpdates.push(() => setMusicId(String(musicParam)));
        }

        const difficultyParam = searchParams.get("difficulty");
        if (difficultyParam && DIFFICULTY_VALUE_SET.has(difficultyParam)) {
            queuedUpdates.push(() => setDifficulty(difficultyParam));
        }

        const liveTypeParam = searchParams.get("liveType");
        if (liveTypeParam && LIVE_TYPE_VALUE_SET.has(liveTypeParam)) {
            queuedUpdates.push(() => setLiveType(liveTypeParam));
        }

        const customAttrParam = searchParams.get("customAttr");
        if (customAttrParam) {
            queuedUpdates.push(() => setCustomAttr(customAttrParam));
        }

        const customCharsParam = searchParams.get("customCharacterIds");
        if (customCharsParam) {
            const ids = customCharsParam.split(",").map(Number).filter(n => Number.isFinite(n) && n > 0);
            if (ids.length > 0) {
                queuedUpdates.push(() => setCustomCharacterIds(ids.slice(0, MAX_CUSTOM_CHARACTERS)));
            }
        }

        const customCharUnitsParam = searchParams.get("customCharacterUnits");
        if (customCharUnitsParam) {
            try {
                const parsed = JSON.parse(customCharUnitsParam);
                if (parsed && typeof parsed === "object") {
                    const units: Record<number, string> = {};
                    for (const [k, v] of Object.entries(parsed)) {
                        const cid = Number(k);
                        if (cid >= 21 && cid <= 26 && typeof v === "string") units[cid] = v;
                    }
                    if (Object.keys(units).length > 0) {
                        queuedUpdates.push(() => setCustomCharacterUnits(units));
                    }
                }
            } catch { /* ignore invalid JSON */ }
        }

        const leaderCharacterParam = parsePositiveInt(searchParams.get("leaderCharacter"));
        if (leaderCharacterParam !== null) {
            queuedUpdates.push(() => { setShowLeaderSelect(true); setLeaderCharacterId(leaderCharacterParam); });
        }

        const strongestTargetParam = searchParams.get("strongestTarget");
        if (strongestTargetParam === "power" || strongestTargetParam === "skill") {
            queuedUpdates.push(() => setStrongestTarget(strongestTargetParam));
        }

        const expandConfigParam = searchParams.get("expandConfig");
        if (expandConfigParam === "1" || expandConfigParam === "true") {
            queuedUpdates.push(() => setShowCardConfig(true));
        }

        if (queuedUpdates.length > 0) {
            queueMicrotask(() => {
                queuedUpdates.forEach((update) => update());
            });
        }
    }, [isScreenshotMode, searchParams]);

    const updateCardConfig = useCallback((rarity: string, field: keyof CardConfigItem, value: boolean) => {
        setCardConfig(prev => ({ ...prev, [rarity]: { ...prev[rarity], [field]: value } }));
    }, []);

    // Auto-enable support character when world_bloom is selected; clear when not
    useEffect(() => {
        if (mode === "wl3") return; // WL3 mode manages its own support character
        if (selectedEventType === "world_bloom") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSupportCharacterId(prev => prev === null ? 0 : prev);
        } else {
             
            setSupportCharacterId(null);
        }
    }, [selectedEventType, mode]);

    // Reset support character if it's no longer in the bonus character list
    useEffect(() => {
        if (mode === "wl3") return;
        if (selectedEventType !== "world_bloom") return;
        if (eventBonusCharacterIds.length === 0) return;
        if (supportCharacterId === null || supportCharacterId <= 0) return;
        if (eventBonusCharacterIds.includes(supportCharacterId)) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSupportCharacterId(0);
    }, [mode, selectedEventType, eventBonusCharacterIds, supportCharacterId]);

    // In WL3 mode: default to showing support character selector (set to 0 = "please select")
    useEffect(() => {
        if (mode === "wl3" && supportCharacterId === null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSupportCharacterId(0);
        }
    }, [mode, supportCharacterId]);

    useEffect(() => {
        if (!selectedWl3Simulation) return;
        if (supportCharacterId === null || supportCharacterId <= 0) return;
        if ((selectedWl3Simulation.members as readonly number[]).includes(supportCharacterId)) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSupportCharacterId(0);
    }, [selectedWl3Simulation, supportCharacterId]);

    const needsMusic = mode !== "mysekai";
    const needsEvent = mode === "event" || mode === "mysekai";
    const isWl3Mode = mode === "wl3";
    const modeOptions = MODE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(`page.deckRecommend.modes.${option.value}.label`),
        desc: t(`page.deckRecommend.modes.${option.value}.desc`),
    }));
    const liveTypeOptions = LIVE_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(`page.deckRecommend.liveTypes.${option.value}`),
    }));
    const serverOptions = SERVER_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
    }));
    const scoreLabel = mode === "mysekai"
        ? t("page.deckRecommend.scoreLabels.mysekai")
        : mode === "challenge"
            ? t("page.deckRecommend.scoreLabels.challenge")
            : mode === "strongest"
                ? (strongestTarget === "skill" ? t("page.deckRecommend.scoreLabels.effectiveSkill") : t("page.deckRecommend.scoreLabels.power"))
                : t("page.deckRecommend.scoreLabels.pt");
    const canAutoCalculateInScreenshot =
        isScreenshotMode &&
        !!userId.trim() &&
        (!needsMusic || !!musicId) &&
        (!needsEvent || !!effectiveEventId.trim()) &&
        (isWl3Mode ? (wl3GroupId !== null && supportCharacterId !== null && supportCharacterId > 0) : true) &&
        (selectedEventType !== "world_bloom" || (supportCharacterId !== null && supportCharacterId > 0)) &&
        (mode !== "challenge" || characterId !== null);

    const handleCalculate = useCallback(() => {
        if (!userId.trim()) { setError(t("page.deckRecommend.errors.userRequired")); return; }
        if (needsMusic && !musicId) { setError(t("page.deckRecommend.errors.musicRequired")); return; }
        if (mode === "challenge" && !characterId) { setError(t("page.deckRecommend.errors.characterRequired")); return; }
        if (isWl3Mode && !wl3GroupId) { setError(t("page.deckRecommend.errors.wl3GroupRequired")); return; }
        if (isWl3Mode && (supportCharacterId === null || supportCharacterId <= 0)) { setError(t("page.deckRecommend.errors.supportCharacterRequired")); return; }
        if (needsEvent && !effectiveEventId.trim()) { setError(t("page.deckRecommend.errors.eventRequired")); return; }
        if (selectedEventType === "world_bloom" && (supportCharacterId === null || supportCharacterId <= 0)) { setError(t("page.deckRecommend.errors.supportCharacterRequired")); return; }

        setError(null); setResults(null); setChallengeHighScore(null); setDuration(null); setDataTime(null);
        setIsCalculating(true); setProgressStage("fetching"); setProgressPercent(5); setProgressLabel(t("page.deckRecommend.progress.fetchingUserData"));

        const configForCalc: Record<string, WorkerCardConfig> = {};
        for (const [key, val] of Object.entries(cardConfig)) {
            configForCalc[key] = val.disable ? { disable: true } : { rankMax: val.rankMax, episodeRead: val.episodeRead, masterMax: val.masterMax, skillMax: val.skillMax };
        }

        // WL3 mode maps to "event" for the worker
        const workerMode: DeckMode = isWl3Mode ? "event" : mode;
        const workerEventId = isWl3Mode ? effectiveEventId : eventId;
        const workerArgs: DeckRecommendWorkerArgs = {
            mode: workerMode, userId: userId.trim(), server, musicId: musicId ? parseInt(musicId) : 0, difficulty,
            characterId: characterId || undefined, eventId: workerEventId ? parseInt(workerEventId) : undefined,
            liveType, supportCharacterId: supportCharacterId || undefined, cardConfig: configForCalc,
            leaderCharacter: showLeaderSelect && leaderCharacterId ? leaderCharacterId : undefined,
        };
        if (mode === "custom") {
            if (customSubMode === "unit") {
                // Unit-event mode: apply unit bonus
                workerArgs.customUnit = customUnit || undefined;
            } else {
                // Mixed-event mode: apply character bonus
                if (customCharacterIds.length > 0) {
                    workerArgs.customCharacterIds = customCharacterIds;
                    const vsUnits: Record<number, string> = {};
                    for (const cid of customCharacterIds) {
                        if (cid >= 21 && cid <= 26 && customCharacterUnits[cid]) {
                            vsUnits[cid] = customCharacterUnits[cid];
                        }
                    }
                    if (Object.keys(vsUnits).length > 0) {
                        workerArgs.customCharacterUnits = vsUnits;
                    }
                }
            }
            workerArgs.customAttr = customAttr || undefined;
        }
        if (mode === "strongest") {
            workerArgs.strongestTarget = strongestTarget;
        }

        if (workerRef.current) workerRef.current.terminate();
        const worker = new Worker(new URL("@/lib/deck-recommend/dr-worker.ts", import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<DeckRecommendWorkerMessage>) => {
            const data = event.data;
            if (data.type === "progress") {
                const progressLabelKey = data.progressKey;
                setProgressStage(data.stage);
                setProgressPercent(data.percent);
                setProgressLabel(progressLabelKey ? t(progressLabelKey) : data.stageLabel ?? "");
                return;
            }
            if (data.error) { setError(getErrorMessage(data.error, t)); }
            else {
                setResults(data.result || []); setChallengeHighScore(data.challengeHighScore || null);
                if (data.userCards) setUserCards(data.userCards);
                setDuration(data.duration || null); if (data.upload_time) setDataTime(data.upload_time);
            }
            setIsCalculating(false); setProgressStage("idle"); setProgressPercent(0);
            worker.terminate(); workerRef.current = null;
        };
        worker.onerror = (err) => {
            setError(t("page.deckRecommend.errors.workerError", { message: err.message }));
            setIsCalculating(false); setProgressStage("idle"); setProgressPercent(0);
            worker.terminate(); workerRef.current = null;
        };
        const oauthAccessToken = getOAuthAccessTokenForGameUser(server, userId.trim());
        worker.postMessage({
            args: {
                ...workerArgs,
                oauthAccessToken,
            },
        });
    }, [userId, server, mode, characterId, eventId, effectiveEventId, liveType, supportCharacterId, selectedEventType, musicId, difficulty, cardConfig, needsMusic, needsEvent, isWl3Mode, wl3GroupId, customSubMode, customUnit, customCharacterIds, customCharacterUnits, customAttr, leaderCharacterId, showLeaderSelect, strongestTarget, t]);

    const handleCancel = useCallback(() => {
        if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
        setIsCalculating(false); setProgressStage("idle"); setProgressPercent(0);
    }, []);

    useEffect(() => {
        if (!isScreenshotMode) {
            autoCalculateKeyRef.current = "";
            return;
        }
        if (!canAutoCalculateInScreenshot || isCalculating) return;

        const autoCalculateKey = [
            userId.trim(),
            server,
            mode,
            characterId ?? "",
            eventId,
            liveType,
            supportCharacterId ?? "",
            musicId,
            difficulty,
            customSubMode,
            customUnit,
            customCharacterIds.join(","),
            JSON.stringify(customCharacterUnits),
            customAttr,
            leaderCharacterId ?? "",
            showLeaderSelect,
            strongestTarget,
            wl3GroupId ?? "",
        ].join("|");

        if (autoCalculateKeyRef.current === autoCalculateKey) return;
        autoCalculateKeyRef.current = autoCalculateKey;
        queueMicrotask(() => {
            handleCalculate();
        });
    }, [
        isScreenshotMode,
        canAutoCalculateInScreenshot,
        isCalculating,
        userId,
        server,
        mode,
        characterId,
        eventId,
        liveType,
        supportCharacterId,
        musicId,
        difficulty,
        customSubMode,
        customUnit,
        customCharacterIds,
        customCharacterUnits,
        customAttr,
        leaderCharacterId,
        showLeaderSelect,
        strongestTarget,
        wl3GroupId,
        handleCalculate,
    ]);

    const getCardMaster = useCallback((cardId: number) => cardsMaster.find((c) => c.id === cardId), [cardsMaster]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku">{t("page.deckRecommend.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">{t("page.deckRecommend.title")}<span className="text-miku">{t("page.deckRecommend.titleHighlight")}</span></h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto text-sm sm:text-base">{t("page.deckRecommend.description")}</p>
                </div>

                <div className="dr-mobile-warning hh-tile rounded-[var(--hh-radius-lg)] p-3 mb-6 flex items-center gap-2 text-sm text-amber-700 bg-amber-500/12 border-amber-500/30">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    <span>{t("page.deckRecommend.mobileWarning")}</span>
                </div>

                {/* Input Form */}
                <div className="hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                    <h2 className="hh-title text-lg text-[var(--hh-text-primary)] mb-4 flex items-center gap-2">
                        <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>{t("page.deckRecommend.basicSettings")}
                    </h2>

                    {/* Mode Tabs */}
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.recommendationMode")}</label>
                        <div className="flex gap-2 flex-wrap">
                            {modeOptions.map((m) => (
                                <button key={m.value} onClick={() => setMode(m.value)} title={m.desc}
                                    className={`hh-press hh-focusable px-4 py-2.5 rounded-[var(--hh-radius-md)] border font-medium text-sm ${mode === m.value ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] border-[var(--hh-accent-line)]" : "bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] border-[var(--hh-border)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-[var(--hh-text-tertiary)] mt-1.5">{modeOptions.find(m => m.value === mode)?.desc}</p>
                    </div>

                    {/* Account Selector + User ID + Server */}
                    <AccountSelector
                        onSelect={(gameId, srv) => {
                            setUserId(gameId);
                            setServer(srv);
                            if (allowSaveUserId) {
                                localStorage.setItem("deck_recommend_userid", gameId);
                                localStorage.setItem("deck_recommend_server", srv);
                                saveToolState("deckRecommend", gameId, srv);
                            }
                        }}
                        currentUserId={userId}
                        currentServer={server}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckRecommend.userId")} <span className="text-red-400">*</span></label>
                            <input type="text" value={userId} onChange={(e) => { setUserId(e.target.value); if (allowSaveUserId) localStorage.setItem("deck_recommend_userid", e.target.value); }}
                                placeholder={t("page.deckRecommend.userIdPlaceholder")} className="hh-input hh-numeric w-full px-4 py-2.5 text-sm" />
                            <div className="flex items-center justify-between mt-2 px-1">
                                <span className="text-sm text-[var(--hh-text-secondary)]">{t("page.deckRecommend.saveLocally")}</span>
                                <button onClick={() => { const ns = !allowSaveUserId; setAllowSaveUserId(ns); if (ns) { localStorage.setItem("deck_recommend_userid", userId); localStorage.setItem("deck_recommend_server", server); saveToolState("deckRecommend", userId, server); } else { localStorage.removeItem("deck_recommend_userid"); localStorage.removeItem("deck_recommend_server"); } }}
                                    role="switch" aria-checked={allowSaveUserId}
                                    className={`hh-switch hh-focusable ${allowSaveUserId ? "hh-switch-active" : ""}`}>
                                    <span className="hh-switch-thumb" />
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-[var(--hh-text-tertiary)]">{t("page.deckRecommend.harukiHintStart")} <ExternalLink href="https://haruki.seiunx.com" target="_blank" rel="noopener noreferrer" className="text-miku hover:underline">{t("page.deckRecommend.harukiToolbox")}</ExternalLink> {t("page.deckRecommend.harukiHintEnd")}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckRecommend.server")}</label>
                            <div className="flex flex-wrap gap-2">
                                {serverOptions.map((s) => (
                                    <button key={s.value} onClick={() => { setServer(s.value); if (allowSaveUserId) localStorage.setItem("deck_recommend_server", s.value); }}
                                        className={`hh-chip hh-press hh-focusable ${server === s.value ? "hh-chip-active" : ""}`}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Challenge Mode */}
                    {mode === "challenge" && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.challengeCharacter")} <span className="text-red-400">*</span></label>
                            <CharacterSelector selectedCharacterId={characterId} onSelect={setCharacterId} />
                        </div>
                    )}

                    {/* Strongest Mode */}
                    {mode === "strongest" && (
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.optimizationTarget")}</label>
                            <div className="hh-segment max-w-xs" role="tablist">
                                <button role="tab" aria-selected={strongestTarget === "power"} onClick={() => setStrongestTarget("power")}
                                    className="hh-segment-item hh-press cursor-pointer">
                                    {t("page.deckRecommend.strongestTargets.power")}
                                </button>
                                <button role="tab" aria-selected={strongestTarget === "skill"} onClick={() => setStrongestTarget("skill")}
                                    className="hh-segment-item hh-press cursor-pointer">
                                    {t("page.deckRecommend.strongestTargets.skill")}
                                </button>
                            </div>
                            <p className="text-xs text-[var(--hh-text-tertiary)] mt-1.5">
                                {t(`page.deckRecommend.strongestTargetDescriptions.${strongestTarget}`)}
                            </p>
                        </div>
                    )}

                    {/* Leader Character (all modes except challenge which has its own) */}
                    {mode !== "challenge" && (
                        <div className="mb-5">
                            <div className="hh-well p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-[var(--hh-text-primary)] font-medium">{t("page.deckRecommend.fixedCharacter")}</span>
                                        <span className="text-[var(--hh-text-tertiary)] text-xs text-left">{t("page.deckRecommend.fixedCharacterDescription")}</span>
                                    </div>
                                    <button onClick={() => { setShowLeaderSelect(!showLeaderSelect); if (showLeaderSelect) setLeaderCharacterId(null); }}
                                        role="switch" aria-checked={showLeaderSelect}
                                        className={`hh-switch hh-focusable shrink-0 ${showLeaderSelect ? "hh-switch-active" : ""}`}>
                                        <span className="hh-switch-thumb" />
                                    </button>
                                </div>
                                {showLeaderSelect && (
                                    <div className="mt-4 pt-3 border-t border-[var(--hh-border)]">
                                        <CharacterSelector selectedCharacterId={leaderCharacterId} onSelect={setLeaderCharacterId} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* WL3 Mode: Group Selector + Live Type + Support Character */}
                    {isWl3Mode && (
                        <div className="mb-5 space-y-4">
                            {/* WL3 Group Selector */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.wl3Group")} <span className="text-red-400">*</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {WL3_SIMULATION_GROUPS.map(group => {
                                        const isSelected = wl3GroupId === group.groupId;
                                        return (
                                            <button
                                                key={group.groupId}
                                                onClick={() => setWl3GroupId(isSelected ? null : group.groupId)}
                                                aria-pressed={isSelected}
                                                className={`hh-press hh-focusable rounded-[var(--hh-radius-md)] border p-3 text-left ${isSelected
                                                    ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]"
                                                    : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)]"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="text-sm font-bold text-[var(--hh-text-primary)]">{t("page.deckRecommend.wl3GroupTitle", { group: group.groupId })}</div>
                                                    <span className="hh-numeric text-[11px] font-mono text-emerald-600 bg-emerald-500/12 px-1.5 py-0.5 rounded-[var(--hh-radius-sm)]">WL3</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {group.members.map(charId => {
                                                        const characterName = getCharacterName(t, charId);
                                                        return (
                                                            <div key={charId} className="w-7 h-7 rounded-full overflow-hidden bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)]" title={characterName}>
                                                                <Image src={getCharacterIconUrl(charId)} alt={characterName} width={28} height={28} className="w-full h-full object-cover" unoptimized />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Live Type */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckRecommend.liveType")}</label>
                                <div className="flex flex-wrap gap-2">
                                    {liveTypeOptions.map((lt) => (
                                        <button key={lt.value} onClick={() => setLiveType(lt.value)}
                                            className={`hh-chip hh-press hh-focusable ${liveType === lt.value ? "hh-chip-active" : ""}`}>
                                            {lt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Support Character — always visible, no toggle */}
                            {selectedWl3Simulation && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.supportCharacter")} <span className="text-red-400">*</span></label>
                                    <CharacterSelector
                                        selectedCharacterId={supportCharacterId}
                                        onSelect={setSupportCharacterId}
                                        availableCharacterIds={selectedWl3Simulation.members}
                                        hideUnitFilter
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Event / Mysekai Mode */}
                    {needsEvent && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div><EventSelector selectedEventId={eventId} onSelect={(id) => setEventId(id)} onEventTypeChange={setSelectedEventType} onBonusCharactersChange={setEventBonusCharacterIds} /></div>
                            {mode === "event" && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckRecommend.liveType")}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {liveTypeOptions.map((lt) => (
                                            <button key={lt.value} onClick={() => setLiveType(lt.value)}
                                                className={`hh-chip hh-press hh-focusable ${liveType === lt.value ? "hh-chip-active" : ""}`}>
                                                {lt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {mode === "mysekai" && (
                                <div className="flex items-center">
                                    <div className="w-full rounded-[var(--hh-radius-md)] border border-amber-500/30 bg-amber-500/12 p-3">
                                        <div className="flex items-center gap-2 text-sm text-amber-700">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>{t("page.deckRecommend.mysekaiNoMusicHint")}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedEventType === "world_bloom" && (
                                <div className="sm:col-span-2">
                                    <div className="hh-well p-3">
                                        <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-2">{t("page.deckRecommend.supportCharacter")} <span className="text-red-400">*</span></label>
                                        <CharacterSelector
                                            selectedCharacterId={supportCharacterId}
                                            onSelect={setSupportCharacterId}
                                            availableCharacterIds={eventBonusCharacterIds.length > 0 ? eventBonusCharacterIds : undefined}
                                            hideUnitFilter={eventBonusCharacterIds.length > 0}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Mode */}
                    {mode === "custom" && (
                        <div className="mb-5">
                            <div className="hh-well p-4">
                                <h3 className="hh-title text-sm text-[var(--hh-text-primary)] mb-3 flex items-center gap-2">
                                    <span className="w-[3px] h-4 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>{t("page.deckRecommend.customBonus")}
                                </h3>

                                {/* Custom bonus mode switch */}
                                <div className="hh-segment w-fit mb-4" role="tablist">
                                    <button role="tab" aria-selected={customSubMode === "unit"} onClick={() => setCustomSubMode("unit")}
                                        className="hh-segment-item hh-press cursor-pointer px-3">
                                        {t("page.deckRecommend.customModes.unit")}
                                    </button>
                                    <button role="tab" aria-selected={customSubMode === "character"} onClick={() => setCustomSubMode("character")}
                                        className="hh-segment-item hh-press cursor-pointer px-3">
                                        {t("page.deckRecommend.customModes.character")}
                                    </button>
                                </div>

                                {/* Unit bonus mode */}
                                {customSubMode === "unit" && (
                                    <div className="mb-4">
                                        <label className="hh-label block mb-2">{t("page.deckRecommend.bonusUnit")}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {UNIT_OPTIONS.map((u) => {
                                                const unitLabel = t(u.labelKey);
                                                return (
                                                    <button key={u.value} onClick={() => setCustomUnit(customUnit === u.value ? "" : u.value)}
                                                        aria-pressed={customUnit === u.value}
                                                        className={`hh-press hh-focusable p-1.5 rounded-[var(--hh-radius-md)] border ${customUnit === u.value ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]" : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)]"}`}
                                                        title={unitLabel}>
                                                        <div className="w-8 h-8 relative">
                                                            <Image src={`/data/icon/${u.icon}`} alt={unitLabel} fill className="object-contain" unoptimized />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                    </div>
                                )}

                                {/* Character bonus mode */}
                                {customSubMode === "character" && (
                                    <div className="mb-4">
                                        <label className="hh-label block mb-2">
                                            {t("page.deckRecommend.bonusCharacters", { count: customCharacterIds.length, max: MAX_CUSTOM_CHARACTERS })}
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {UNIT_DATA.flatMap(u => u.charIds).map(cid => {
                                                const isSelected = customCharacterIds.includes(cid);
                                                const isFull = customCharacterIds.length >= MAX_CUSTOM_CHARACTERS && !isSelected;
                                                const isVS = cid >= 21 && cid <= 26;
                                                    const characterName = getCharacterName(t, cid);

                                                return (
                                                    <button key={cid}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setCustomCharacterIds(prev => prev.filter(c => c !== cid));
                                                                if (isVS) {
                                                                    setCustomCharacterUnits(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[cid];
                                                                        return next;
                                                                    });
                                                                }
                                                            } else {
                                                                setCustomCharacterIds(prev => {
                                                                    if (prev.length >= MAX_CUSTOM_CHARACTERS) return prev;
                                                                    return [...prev, cid];
                                                                });
                                                            }
                                                        }}
                                                        disabled={isFull}
                                                        aria-pressed={isSelected}
                                                        className={`hh-press hh-focusable relative rounded-full ring-2 ${isSelected
                                                            ? "ring-[var(--hh-accent)] z-10"
                                                            : isFull
                                                                ? "ring-transparent opacity-30 cursor-not-allowed"
                                                                : "ring-transparent hover:ring-[var(--hh-border-strong)]"
                                                        }`}
                                                        title={characterName}>
                                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--hh-surface-sunken)]">
                                                            <Image src={getCharacterIconUrl(cid)} alt={characterName} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                                                        </div>
                                                        {isSelected && (
                                                            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--hh-accent)] rounded-full flex items-center justify-center">
                                                                <svg className="w-2 h-2 text-[var(--hh-text-on-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Virtual singer unit selector */}
                                        {customCharacterIds.some(cid => cid >= 21 && cid <= 26) && (
                                            <div className="mt-3 p-3 rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)]">
                                                <label className="hh-label block mb-2">{t("page.deckRecommend.virtualSingerUnit")}</label>
                                                {customCharacterIds.filter(cid => cid >= 21 && cid <= 26).map(cid => {
                                                const characterName = getCharacterName(t, cid);

                                                    return (
                                                        <div key={cid} className="flex items-center gap-2 mb-2 last:mb-0">
                                                        <div className="w-7 h-7 rounded-full overflow-hidden bg-[var(--hh-surface-sunken)] flex-shrink-0">
                                                            <Image src={getCharacterIconUrl(cid)} alt={characterName} width={28} height={28} className="w-full h-full object-cover" unoptimized />
                                                        </div>
                                                        <span className="text-xs text-[var(--hh-text-secondary)] w-16 flex-shrink-0">{characterName}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {VS_SUPPORT_UNIT_OPTIONS.map(opt => (
                                                                <button key={opt.value}
                                                                    onClick={() => setCustomCharacterUnits(prev => {
                                                                        if (prev[cid] === opt.value) {
                                                                            const next = { ...prev };
                                                                            delete next[cid];
                                                                            return next;
                                                                        }
                                                                        return { ...prev, [cid]: opt.value };
                                                                    })}
                                                                    aria-pressed={customCharacterUnits[cid] === opt.value}
                                                                    className={`hh-press hh-focusable p-1 rounded-[var(--hh-radius-sm)] border ${
                                                                        customCharacterUnits[cid] === opt.value
                                                                            ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]"
                                                                            : "border-[var(--hh-border)] bg-[var(--hh-surface-1)] hover:bg-[var(--hh-surface-3)]"
                                                                    }`}
                                                                    title={opt.labelKey ? t(opt.labelKey) : opt.label}>
                                                                    <div className="w-5 h-5 relative">
                                                                        <Image src={`/data/icon/${opt.icon}`} alt={opt.labelKey ? t(opt.labelKey) : opt.label} fill className="object-contain" unoptimized />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {customCharacterIds.length > 0 && (
                                            <div className="mt-2">
                                                <button onClick={() => { setCustomCharacterIds([]); setCustomCharacterUnits({}); }} className="text-[10px] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-alert)] transition-colors">{t("page.deckRecommend.clearSelection")}</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bonus attribute selector */}
                                <div>
                                    <label className="hh-label block mb-2">{t("page.deckRecommend.bonusAttribute")}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ATTR_OPTIONS.map((a) => (
                                            <button key={a.value} onClick={() => setCustomAttr(customAttr === a.value ? "" : a.value)}
                                                aria-pressed={customAttr === a.value}
                                                className={`hh-press hh-focusable p-1.5 rounded-[var(--hh-radius-md)] border ${customAttr === a.value ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]" : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)]"}`}
                                                title={a.label}>
                                                <div className="w-6 h-6 relative">
                                                    <Image src={`/data/icon/${a.icon}`} alt={a.label} fill className="object-contain" unoptimized />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {((customSubMode === "unit" && !customUnit) || (customSubMode === "character" && customCharacterIds.length === 0)) && !customAttr && (
                                    <p className="text-xs text-[var(--hh-text-tertiary)] mt-3">{t("page.deckRecommend.customBonusEmptyHint", { target: t(`page.deckRecommend.customBonusTargets.${customSubMode}`) })}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Song Selection (not for mysekai) */}
                    {needsMusic && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div><MusicSelector selectedMusicId={musicId} onSelect={(id) => setMusicId(id)} recommendMode={mode === "challenge" ? "challenge" : "event"} liveType={liveType} /></div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--hh-text-secondary)] mb-1">{t("page.deckRecommend.difficulty")}</label>
                                <div className="flex flex-wrap gap-2">
                                    {DIFFICULTY_OPTIONS.map((d) => {
                                        // Difficulty hues are game semantics, not decoration, so the
                                        // active slab keeps them; only the elevation halo is dropped.
                                        const colors: Record<string, string> = { easy: "bg-blue-500", normal: "bg-emerald-500", hard: "bg-orange-500", expert: "bg-red-500", master: "bg-purple-500", append: "bg-fuchsia-500" };
                                        const isActive = difficulty === d.value;
                                        return (
                                            <button key={d.value} onClick={() => setDifficulty(d.value)}
                                                aria-pressed={isActive}
                                                className={`hh-chip hh-press hh-focusable ${isActive ? `${colors[d.value] ?? "bg-[var(--hh-accent)]"} text-white border-black/15` : ""}`}>
                                                {d.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Card Config */}
                    <div className="mb-5">
                        <button onClick={() => setShowCardConfig(!showCardConfig)} className="flex items-center gap-2 text-sm font-medium text-[var(--hh-text-secondary)] hover:text-miku transition-colors">
                            <svg className={`w-4 h-4 transition-transform ${showCardConfig ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            {t("page.deckRecommend.cardTrainingConfig")}
                        </button>
                        {showCardConfig && (
                            <div className="mt-3 overflow-x-auto">
                                <table className="dr-config-table w-full text-sm">
                                    <thead><tr>
                                        <th className="hh-label text-left py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.rarity")}</th>
                                        <th className="hh-label py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.disable")}</th>
                                        <th className="hh-label py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.maxLevel")}</th>
                                        <th className="hh-label py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.episodes")}</th>
                                        <th className="hh-label py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.maxMaster")}</th>
                                        <th className="hh-label py-2 px-2">{t("page.deckRecommend.cardConfigHeaders.maxSkill")}</th>
                                    </tr></thead>
                                    <tbody>
                                        {RARITY_CONFIG_KEYS.map(({ key }) => (
                                            <tr key={key} className="border-t border-[var(--hh-border-hairline)]">
                                                <td className="py-2 px-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {key === "rarity_birthday" ? (
                                                            <div className="w-4 h-4 relative"><Image src="/data/icon/birthday.webp" alt="Birthday" fill className="object-contain" unoptimized /></div>
                                                        ) : (
                                                            Array.from({ length: parseInt(key.split("_")[1]) }).map((_, i) => (
                                                                <div key={i} className="w-3 h-3 relative"><Image src="/data/icon/star.webp" alt="Star" fill className="object-contain" unoptimized /></div>
                                                            ))
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-2 text-center"><input type="checkbox" checked={cardConfig[key].disable} onChange={(e) => updateCardConfig(key, "disable", e.target.checked)} className="dr-checkbox" /></td>
                                                <td className="py-2 px-2 text-center"><input type="checkbox" checked={cardConfig[key].rankMax} onChange={(e) => updateCardConfig(key, "rankMax", e.target.checked)} disabled={cardConfig[key].disable} className="dr-checkbox" /></td>
                                                <td className="py-2 px-2 text-center"><input type="checkbox" checked={cardConfig[key].episodeRead} onChange={(e) => updateCardConfig(key, "episodeRead", e.target.checked)} disabled={cardConfig[key].disable} className="dr-checkbox" /></td>
                                                <td className="py-2 px-2 text-center"><input type="checkbox" checked={cardConfig[key].masterMax} onChange={(e) => updateCardConfig(key, "masterMax", e.target.checked)} disabled={cardConfig[key].disable} className="dr-checkbox" /></td>
                                                <td className="py-2 px-2 text-center"><input type="checkbox" checked={cardConfig[key].skillMax} onChange={(e) => updateCardConfig(key, "skillMax", e.target.checked)} disabled={cardConfig[key].disable} className="dr-checkbox" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button onClick={handleCalculate} disabled={isCalculating}
                            className="hh-btn hh-btn-primary hh-press hh-focusable flex-1 px-6 py-3 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                            {isCalculating ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>{t("page.deckRecommend.calculating")}</>) : (<>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                {t("page.deckRecommend.startCalculate")}
                            </>)}
                        </button>
                        {isCalculating && (
                            <button onClick={handleCancel} className="hh-btn hh-btn-danger hh-press hh-focusable px-6 py-3 font-bold">{t("page.deckRecommend.cancel")}</button>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {isCalculating && progressStage !== "idle" && (
                        <div className="mt-4">
                            <ProgressBar stage={progressStage} percent={progressPercent} stageLabel={progressLabel} />
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-4 mb-6 bg-red-500/12 border-red-500/30">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && results.length > 0 && (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-5 sm:p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="hh-title text-lg text-[var(--hh-text-primary)] flex items-center gap-2">
                                <span className="w-[3px] h-5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]"></span>
                                {t("page.deckRecommend.resultsTitle", { count: results.length })}
                            </h2>
                            {duration !== null && (
                                <div className="flex flex-col items-end">
                                    <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)] font-mono">{t("page.deckRecommend.elapsed", { seconds: (duration / 1000).toFixed(2) })}</span>
                                    {dataTime && <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)] font-mono">{t("page.deckRecommend.dataUpdatedAt", { time: formatDate(dataTime * 1000, { dateStyle: "medium", timeStyle: "short" }) })}</span>}
                                </div>
                            )}
                        </div>
                        {challengeHighScore && (
                            <div className="hh-numeric mb-4 px-3 py-2 rounded-[var(--hh-radius-md)] border border-amber-500/30 bg-amber-500/12 text-sm text-amber-700">
                                {t("page.deckRecommend.challengeHighScore", { score: challengeHighScore.highScore ? formatNumber(challengeHighScore.highScore) : t("page.deckRecommend.noRecord") })}
                            </div>
                        )}
                        <div className="space-y-3">
                            {results.map((deck, index: number) => (
                                <DeckResultRow key={index} deck={deck} rank={index + 1} getCardMaster={getCardMaster} mode={mode} userCards={userCards} scoreLabel={scoreLabel} formatNumber={formatNumber} forceExpand={isScreenshotMode} strongestTarget={strongestTarget} />
                            ))}
                        </div>
                    </div>
                )}

                {results && results.length === 0 && (
                    <div className="hh-tile rounded-[var(--hh-radius-lg)] p-8 mb-6 text-center">
                        <p className="text-[var(--hh-text-secondary)]">{t("page.deckRecommend.noDecks")}</p>
                    </div>
                )}

                <div className="mt-12 text-center text-xs text-[var(--hh-text-tertiary)]">
                    <p className="mb-1">{t("page.deckRecommend.sourceCreditPrefix")} <ExternalLink href="https://github.com/xfl03/sekai-calculator" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-miku hover:underline">sekai-calculator</ExternalLink></p>
                    <p className="mb-1">{t("page.deckRecommend.algorithmCreditPrefix")} <ExternalLink href="https://github.com/NeuraXmy/sekai-deck-recommend-cpp" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-miku hover:underline">sekai-deck-recommend-cpp</ExternalLink> {t("page.deckRecommend.algorithmCreditAuthor")}</p>
                    <p>{t("page.deckRecommend.licenseNotice")}</p>
                </div>
            </div>
        </MainLayout>
    );
}

// ==================== Deck Result Row ====================
interface DeckResultRowProps {
    deck: DeckResult;
    rank: number;
    getCardMaster: (id: number) => CardMasterInfo | undefined;
    mode: DeckMode;
    userCards: UserCardInfo[];
    scoreLabel: string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    forceExpand?: boolean;
    strongestTarget?: StrongestTarget;
}

function DeckResultRow({ deck, rank, getCardMaster, mode, userCards, scoreLabel, formatNumber, forceExpand = false, strongestTarget }: DeckResultRowProps) {
    const { t } = useI18n();
    const [showDetails, setShowDetails] = useState(forceExpand);
    const detailsExpanded = forceExpand || showDetails;
    const baseEventBonus = deck.eventBonus !== undefined
        ? parseBonusNumber(deck.eventBonus)
        : (deck.cards?.reduce((sum: number, card: DeckCardResult) => {
            return sum + parseCardEventBonusValue(card.eventBonus);
        }, 0) || 0);
    const supportDeckBonus = parseBonusNumber(deck.supportDeckBonus);
    const totalEventBonus = baseEventBonus + supportDeckBonus;
    const showSupportBonusBreakdown = supportDeckBonus > 0;
    const totalEventBonusText = `${formatBonusValue(totalEventBonus)}%`;
    const baseEventBonusText = `${formatBonusValue(baseEventBonus)}%`;
    const supportDeckBonusText = `${formatBonusValue(supportDeckBonus)}%`;
    const totalBonusLabel = mode === "custom" ? t("page.deckRecommend.result.totalBonusLabelCustom") : (showSupportBonusBreakdown ? t("page.deckRecommend.result.totalBonusLabelTotal") : t("page.deckRecommend.result.totalBonusLabelBonus"));

    const effectiveSkill = deck.cards && deck.cards.length === 5 ? (deck.cards[0].skill?.scoreUp || 0) + deck.cards.slice(1).reduce((sum: number, card: DeckCardResult) => sum + (card.skill?.scoreUp || 0), 0) / 5 : 0;
    const totalPower = deck.power?.total ?? 0;

    return (
        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
            <button onClick={() => {
                if (forceExpand) return;
                setShowDetails(!showDetails);
            }}
                aria-expanded={detailsExpanded}
                className="hh-press w-full p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 text-left hover:bg-[var(--hh-surface-1)] transition-colors">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                    <div className="flex items-center gap-3">
                        {/* Podium badge. gold / silver / bronze are medal semantics, so the
                            literal amber-400 / slate-400 / amber-700 stay; only ranks 4+
                            fall through to a neutral surface. */}
                        <div className={`hh-numeric flex-shrink-0 w-8 h-8 rounded-[var(--hh-radius-md)] flex items-center justify-center font-bold text-sm ${rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : rank === 3 ? "bg-amber-700 text-white" : "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)]"}`}>{rank}</div>
                        <div className="flex-shrink-0 min-w-[80px]">
                            <div className="text-xs text-[var(--hh-text-tertiary)]">{scoreLabel}</div>
                            <div className="hh-numeric font-bold text-[var(--hh-text-primary)] text-sm">
                                {mode === "strongest" && strongestTarget === "skill" && deck.multiLiveScoreUp != null
                                    ? `${deck.multiLiveScoreUp.toFixed(1)}%`
                                    : formatNumber(Math.floor(deck.score))}
                            </div>
                        </div>
                        {effectiveSkill > 0 && mode !== "challenge" && mode !== "mysekai" && mode !== "strongest" && (
                            <div className="flex-shrink-0 min-w-[60px]">
                                <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.deckRecommend.result.effectiveSkill")}</div>
                                <div className="hh-numeric font-bold text-emerald-600 text-sm">{effectiveSkill.toFixed(1)}%</div>
                            </div>
                        )}
                        {totalPower > 0 && (
                            <div className="flex-shrink-0 min-w-[60px] sm:hidden">
                                <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.deckRecommend.result.power")}</div>
                                <div className="hh-numeric font-bold text-miku text-sm">{formatNumber(totalPower)}</div>
                            </div>
                        )}
                        {(mode === "event" || mode === "wl3" || mode === "mysekai" || mode === "custom") && totalEventBonus > 0 && (
                            <div className="flex-shrink-0 min-w-[60px] hidden sm:block">
                                <div className="text-xs text-[var(--hh-text-tertiary)]">{totalBonusLabel}</div>
                                <div className="hh-numeric font-bold text-miku text-sm">{totalEventBonusText}</div>
                                {showSupportBonusBreakdown && (
                                    <div className="hh-numeric text-[10px] text-[var(--hh-text-secondary)] leading-tight">{t("page.deckRecommend.result.mainDeckPlusSupport", { base: baseEventBonusText, support: supportDeckBonusText })}</div>
                                )}
                            </div>
                        )}

                    </div>
                    <svg className={`w-4 h-4 text-[var(--hh-text-tertiary)] transition-transform sm:hidden ${detailsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar mask-gradient-right sm:overflow-visible sm:mask-none">
                    {deck.cards?.slice(0, 5).map((card: DeckCardResult, i: number) => {
                        const masterCard = getCardMaster(card.cardId);
                        const userCard = userCards.find((u) => u.cardId === card.cardId);
                        const rarityType = masterCard?.cardRarityType || card.cardRarityType;
                        const isBirthday = rarityType === "rarity_birthday";
                        const masterRank = userCard?.masterRank ?? card.masterRank ?? 0;
                        const level = userCard?.level ?? card.level ?? 1;
                        const isPreTraining = card.skill?.isPreTrainingSkill === true;
                        const showTrained = (rarityType === "rarity_3" || rarityType === "rarity_4") && !isBirthday && !isPreTraining;
                        // Unresolved card: an empty slot is a well, not a tile, so it
                        // reads as a hole in the row rather than a fifth card.
                        if (!masterCard) return <div key={i} className="hh-well w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--hh-radius-sm)] flex items-center justify-center text-[var(--hh-text-tertiary)] text-xs flex-shrink-0">?</div>;
                        return (
                            <div key={i} className="relative flex flex-col items-center gap-0.5 flex-shrink-0">
                                <Link href={`/cards/${card.cardId}`} className="block relative" target="_blank">
                                    <SekaiCardThumbnail card={masterCard} trained={showTrained} mastery={masterRank} width={48} />
                                    {i === 0 && <div className="absolute bottom-0 right-0 bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] text-[8px] font-bold px-1 py-[1px] rounded-tl-[var(--hh-radius-xs)] leading-none z-10">L</div>}
                                </Link>
                                <div className="hh-numeric text-[9px] sm:text-[10px] text-[var(--hh-text-secondary)] font-mono leading-none flex items-center gap-0.5">
                                    <span>Lv.{level}</span>
                                    {masterRank > 0 && <span className="bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] rounded-[var(--hh-radius-full)] px-[3px] py-[1px] flex items-center gap-[1px] leading-none border border-[var(--hh-border)]"><span className="text-[7px]">🔷</span><span className="text-[8px] font-bold">{masterRank}</span></span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {totalPower > 0 && (
                    <div className="flex-shrink-0 text-right hidden sm:block">
                        <div className="text-xs text-[var(--hh-text-tertiary)]">{t("page.deckRecommend.result.power")}</div>
                        <div className="hh-numeric font-bold text-sm text-miku">{formatNumber(totalPower)}</div>
                    </div>
                )}
                <svg className={`w-4 h-4 text-[var(--hh-text-tertiary)] transition-transform flex-shrink-0 hidden sm:block ${detailsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {detailsExpanded && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[var(--hh-border)]">
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr>
                                <th className="hh-label text-left py-1 px-1">{t("page.deckRecommend.result.leader")}</th>
                                <th className="hh-label text-left py-1 px-1">{t("page.deckRecommend.result.cardId")}</th>
                                <th className="hh-label text-left py-1 px-1">{t("page.deckRecommend.result.cardName")}</th>
                                <th className="hh-label text-right py-1 px-1">{t("page.deckRecommend.result.power")}</th>
                                <th className="hh-label text-right py-1 px-1">{t("page.deckRecommend.result.skill")}</th>
                                {(mode === "event" || mode === "wl3" || mode === "mysekai" || mode === "custom") && <th className="hh-label text-right py-1 px-1">{mode === "custom" ? t("page.deckRecommend.result.customBonus") : t("page.deckRecommend.result.eventBonus")}</th>}
                            </tr></thead>
                            <tbody>
                                {deck.cards?.map((card: DeckCardResult, i: number) => {
                                    const masterCard = getCardMaster(card.cardId);
                                    const basePower = card.power?.total || 0;
                                    const eb = card.eventBonus;
                                    const eventBonusValue = parseCardEventBonusValue(eb);
                                    const eventBonusText = typeof eb === "string"
                                        ? eb
                                        : eventBonusValue > 0
                                            ? `${formatBonusValue(eventBonusValue)}%`
                                            : "-";
                                    const cardName = masterCard?.prefix || (masterCard ? getCharacterName(t, masterCard.characterId, "short") : `ID:${card.characterId}`);
                                    return (
                                        <tr key={i} className="border-t border-[var(--hh-border-hairline)]">
                                            <td className="py-1.5 px-1 font-bold text-[var(--hh-text-secondary)]">{i === 0 ? t("page.deckRecommend.result.leader") : `#${i + 1}`}</td>
                                            <td className="hh-numeric py-1.5 px-1 font-mono text-[var(--hh-text-secondary)]">{card.cardId}</td>
                                            <td className="py-1.5 px-1 text-[var(--hh-text-secondary)]">{cardName}</td>
                                            <td className="hh-numeric py-1.5 px-1 text-right font-mono text-[var(--hh-text-secondary)]">{formatNumber(basePower)}</td>
                                            <td className="hh-numeric py-1.5 px-1 text-right text-miku font-bold">
                                                <span>{card.skill?.scoreUp || 0}%</span>
                                                {card.skill?.isPreTrainingSkill && <span className="ml-1 text-[9px] font-medium text-amber-500 bg-amber-500/12 px-1 py-[1px] rounded-[var(--hh-radius-xs)]" title={t("page.deckRecommend.result.preTrainingTitle")}>{t("page.deckRecommend.result.preTrainingBadge")}</span>}
                                            </td>
                                            {(mode === "event" || mode === "wl3" || mode === "mysekai" || mode === "custom") && (
                                                <td className="hh-numeric py-1.5 px-1 text-right font-bold text-amber-600">
                                                    {eventBonusText}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-2 flex gap-4 sm:hidden text-xs">
                        {(mode === "event" || mode === "wl3" || mode === "mysekai" || mode === "custom") && totalEventBonus > 0 && (
                            <span className="text-[var(--hh-text-secondary)]">
                                {totalBonusLabel}: <span className="hh-numeric font-bold text-miku">{totalEventBonusText}</span>
                                {showSupportBonusBreakdown && <span className="hh-numeric text-[var(--hh-text-tertiary)]"> ({t("page.deckRecommend.result.mainDeckPlusSupport", { base: baseEventBonusText, support: supportDeckBonusText })})</span>}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
