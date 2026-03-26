"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import MyMusicFilters from "@/components/music/MyMusicFilters";
import Best30ShareImage from "@/components/music/Best30ShareImage";
import { TranslatedText } from "@/components/common/TranslatedText";
import { fetchMasterDataForServer } from "@/lib/fetch";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";
import { getMusicJacketUrl, getCharacterIconUrl } from "@/lib/assets";
import type { AssetSourceType } from "@/contexts/ThemeContext";
import {
    getAccounts,
    getActiveAccount,
    setActiveAccount,
    createAccount,
    getTopCharacterId,
    getCachedAvatarUrl,
    fetchAccountGameData,
    normalizeAccountDataError,
    SERVER_LABELS,
    SERVER_OPTIONS,
    type AccountDataErrorCode,
    type MoesekaiAccount,
    type ServerType,
    type UserCharacter,
} from "@/lib/account";

import AccountSelectorBar from "@/components/AccountSelectorBar";
import QuickBindForm from "@/components/QuickBindForm";
import {
    MusicTagType,
    MusicCategoryType,
    IMusicTagInfo,
} from "@/types/music";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { fetchSongConstants, buildSongConstantsMap } from "@/lib/songConstants";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ==================== Types ====================

interface Music {
    id: number;
    title: string;
    publishedAt: number;
    assetbundleName: string;
    composer: string;
    pronunciation: string;
    categories: string[];
}

interface MusicDifficulty {
    musicId: number;
    musicDifficulty: string;
    playLevel: number;
}

interface RawUserMusicResult {
    musicId?: number | string;
    musicDifficultyType?: string;
    musicDifficulty?: string;
    playResult?: string;
    fullPerfectFlg?: boolean;
    fullComboFlg?: boolean;
}

interface RawUserMusicDifficultyStatus extends RawUserMusicResult {
    userMusicResults?: RawUserMusicResult[];
}

interface RawUserMusic {
    musicId?: number | string;
    userMusicDifficultyStatuses?: RawUserMusicDifficultyStatus[];
    userMusicResults?: RawUserMusicResult[];
}

type PlayResult = "AP" | "FC" | "C" | "";

const PLAY_RESULT_PRIORITY: Record<PlayResult, number> = {
    "": 0,
    C: 1,
    FC: 2,
    AP: 3,
};

function parseUploadTimeToDate(uploadTime: string | number): Date | null {
    if (typeof uploadTime === "number") {
        if (!Number.isFinite(uploadTime)) return null;
        const normalized = uploadTime < 1_000_000_000_000 ? uploadTime * 1000 : uploadTime;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const text = String(uploadTime).trim();
    if (!text) return null;

    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
        const normalized = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Format upload time in a way that's consistent between server and client
function formatUploadTime(uploadTime: string | number): string {
    const date = parseUploadTimeToDate(uploadTime);
    if (!date) return String(uploadTime);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
}

function getUserErrorMessage(code: AccountDataErrorCode): string {
    switch (code) {
        case "API_NOT_PUBLIC":
            return "当前账号的公开 API 未开启，且 OAuth2 数据读取也不可用。请前往 Haruki 开启公开 API，或重新进行 OAuth2 授权。";
        case "NOT_FOUND":
            return "用户数据未找到，请确认 UID、服务器是否正确，并已在 Haruki 上传数据。";
        case "OAUTH_REAUTH_REQUIRED":
            return "当前 OAuth2 授权已过期，请重新授权；如果该账号已开启公开 API，可刷新页面后重试。";
        case "OAUTH_ACCESS_FAILED":
            return "OAuth2 数据读取失败，且无法回退到公开 API。请重新授权或稍后再试。";
        case "NETWORK_ERROR":
        default:
            return "网络异常，请稍后重试。";
    }
}


function parseMusicId(value: number | string | undefined, fallback?: number): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    if (typeof fallback === "number" && Number.isFinite(fallback)) return fallback;
    return null;
}

function normalizeDifficulty(value: string | undefined | null): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
}

function normalizePlayResult(result: Pick<RawUserMusicResult, "playResult" | "fullPerfectFlg" | "fullComboFlg">): PlayResult {
    if (result.fullPerfectFlg) return "AP";

    const playResult = result.playResult?.toLowerCase();
    if (playResult === "full_perfect" || playResult === "all_perfect" || playResult === "ap") {
        return "AP";
    }

    if (result.fullComboFlg) return "FC";
    if (playResult === "full_combo" || playResult === "fc") {
        return "FC";
    }

    if (playResult === "clear" || playResult === "c") {
        return "C";
    }

    return "";
}

function upsertMusicResult(
    resultsMap: Map<number, Record<string, PlayResult>>,
    musicId: number,
    difficulty: string,
    rank: PlayResult
): void {
    if (!rank) return;

    if (!resultsMap.has(musicId)) {
        resultsMap.set(musicId, {});
    }

    const entry = resultsMap.get(musicId)!;
    const current = entry[difficulty] || "";
    if (PLAY_RESULT_PRIORITY[rank] > PLAY_RESULT_PRIORITY[current]) {
        entry[difficulty] = rank;
    }
}

function addRawResultsToMap(
    resultsMap: Map<number, Record<string, PlayResult>>,
    rawResults: RawUserMusicResult[],
    fallbackMusicId?: number,
    fallbackDifficulty?: string
): void {
    for (const rawResult of rawResults) {
        const musicId = parseMusicId(rawResult.musicId, fallbackMusicId);
        const difficulty = normalizeDifficulty(
            rawResult.musicDifficultyType || rawResult.musicDifficulty || fallbackDifficulty
        );
        const rank = normalizePlayResult(rawResult);

        if (musicId === null || !difficulty || !rank) continue;
        upsertMusicResult(resultsMap, musicId, difficulty, rank);
    }
}

function parseTopLevelMusicResults(data: unknown): Map<number, Record<string, PlayResult>> {
    const resultsMap = new Map<number, Record<string, PlayResult>>();

    if (Array.isArray(data)) {
        addRawResultsToMap(resultsMap, data as RawUserMusicResult[]);
        return resultsMap;
    }

    if (!data || typeof data !== "object") {
        return resultsMap;
    }

    const topLevelResults = (data as { userMusicResults?: unknown }).userMusicResults;
    if (Array.isArray(topLevelResults)) {
        addRawResultsToMap(resultsMap, topLevelResults as RawUserMusicResult[]);
    }

    return resultsMap;
}

function parseLegacyMusicResults(data: unknown): Map<number, Record<string, PlayResult>> {
    const resultsMap = new Map<number, Record<string, PlayResult>>();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return resultsMap;
    }

    const userMusics = (data as { userMusics?: unknown }).userMusics;
    if (!Array.isArray(userMusics)) {
        return resultsMap;
    }

    for (const music of userMusics as RawUserMusic[]) {
        const musicId = parseMusicId(music.musicId);
        if (musicId === null) continue;

        if (Array.isArray(music.userMusicResults)) {
            addRawResultsToMap(resultsMap, music.userMusicResults, musicId);
        }

        const diffStatuses = Array.isArray(music.userMusicDifficultyStatuses)
            ? music.userMusicDifficultyStatuses
            : [];

        for (const diffStatus of diffStatuses) {
            const statusDifficulty = normalizeDifficulty(
                diffStatus.musicDifficultyType || diffStatus.musicDifficulty
            );

            // Some legacy payloads store clear/fc/ap directly on difficulty status.
            addRawResultsToMap(
                resultsMap,
                [diffStatus],
                musicId,
                statusDifficulty || undefined
            );

            const nestedResults = Array.isArray(diffStatus.userMusicResults)
                ? diffStatus.userMusicResults
                : [];
            addRawResultsToMap(
                resultsMap,
                nestedResults,
                musicId,
                statusDifficulty || undefined
            );
        }
    }

    return resultsMap;
}

function mergeFallbackMusicResults(
    primaryResultsMap: Map<number, Record<string, PlayResult>>,
    fallbackResultsMap: Map<number, Record<string, PlayResult>>
): Map<number, Record<string, PlayResult>> {
    fallbackResultsMap.forEach((fallbackEntry, musicId) => {
        const primaryEntry = primaryResultsMap.get(musicId);
        if (!primaryEntry) {
            primaryResultsMap.set(musicId, { ...fallbackEntry });
            return;
        }

        Object.entries(fallbackEntry).forEach(([difficulty, rank]) => {
            if (!primaryEntry[difficulty]) {
                primaryEntry[difficulty] = rank;
            }
        });
    });

    return primaryResultsMap;
}

// ==================== Main Component ====================

function MyMusicsContent() {
    // Theme context for asset source
    const { assetSource } = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Account state
    const [accounts, setAccountsList] = useState<MoesekaiAccount[]>([]);
    const [activeAccount, setActiveAcc] = useState<MoesekaiAccount | null>(null);

    // Data state
    const [allMusics, setAllMusics] = useState<Music[]>([]);
    const [musicDifficulties, setMusicDifficulties] = useState<MusicDifficulty[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [userMusicResults, setUserMusicResults] = useState<Map<number, Record<string, PlayResult>>>(new Map());
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [songConstantsMap, setSongConstantsMap] = useState<Record<number, Record<string, number>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingUser, setIsFetchingUser] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userError, setUserError] = useState<AccountDataErrorCode | null>(null);
    const [uploadTime, setUploadTime] = useState<string | number | null>(null);
    const [isTwFallback, setIsTwFallback] = useState(false);
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [best30Expanded, setBest30Expanded] = useState(false);
    const [showBest30Share, setShowBest30Share] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>("master");
    const [selectedTag, setSelectedTag] = useState<MusicTagType>("all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>([]);
    const [sortBy, setSortBy] = useState<"publishedAt" | "id" | "level" | "completion" | "constant">("level");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [completionFilter, setCompletionFilter] = useState<"all" | "no_fc" | "no_ap">("all");

    // Pagination with scroll restoration
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "my-musics",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading && !isFetchingUser,
    });

    const allDifficulties = ["easy", "normal", "hard", "expert", "master", "append"];

    // Storage key
    const STORAGE_KEY = "my_musics_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const tag = searchParams.get("tag");
        const categories = searchParams.get("categories");
        const difficulty = searchParams.get("difficulty");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");
        const completion = searchParams.get("completion");

        const hasUrlParams = tag || categories || difficulty || search || sort || order || completion;

        if (hasUrlParams) {
            if (tag) setSelectedTag(tag as MusicTagType);
            if (categories) setSelectedCategories(categories.split(",") as MusicCategoryType[]);
            if (difficulty) setSelectedDifficulty(difficulty);
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort as "publishedAt" | "id" | "level" | "completion" | "constant");
            if (order) setSortOrder(order as "asc" | "desc");
            if (completion) setCompletionFilter(completion as "all" | "no_fc" | "no_ap");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.tag) setSelectedTag(filters.tag);
                    if (filters.categories?.length) setSelectedCategories(filters.categories);
                    if (filters.difficulty) setSelectedDifficulty(filters.difficulty);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                    if (filters.completionFilter) setCompletionFilter(filters.completionFilter);
                }
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    }, []);

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        const filters = {
            tag: selectedTag,
            categories: selectedCategories,
            difficulty: selectedDifficulty,
            search: searchQuery,
            sortBy,
            sortOrder,
            completionFilter,
        };

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        const params = new URLSearchParams();
        if (selectedTag !== "all") params.set("tag", selectedTag);
        if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
        if (selectedDifficulty !== "master") params.set("difficulty", selectedDifficulty);
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "level") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        if (completionFilter !== "all") params.set("completion", completionFilter);

        const queryString = params.toString();
        const newUrl = queryString ? `/my-musics?${queryString}` : "/my-musics";
        router.replace(newUrl, { scroll: false });
    }, [selectedTag, selectedCategories, selectedDifficulty, searchQuery, sortBy, sortOrder, completionFilter, filtersInitialized, router]);

    // Load accounts
    useEffect(() => {
        const accs = getAccounts();
        setAccountsList(accs);
        const active = getActiveAccount();
        setActiveAcc(active);
    }, []);

    // Fetch masterdata when account changes
    useEffect(() => {
        if (!activeAccount) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        async function loadMasterData() {
            setIsLoading(true);
            setError(null);
            setIsTwFallback(false);

            try {
                const server = activeAccount!.server;

                // 台服和国服都使用国服数据
                const dataServer: ServerType = server === "tw" || server === "cn" ? "cn" : "jp";

                const [musicsData, difficultiesData, tagsData, translationsData] = await Promise.all([
                    fetchMasterDataForServer<Music[]>(dataServer, "musics.json"),
                    fetchMasterDataForServer<MusicDifficulty[]>(dataServer, "musicDifficulties.json"),
                    fetchMasterDataForServer<IMusicTagInfo[]>(dataServer, "musicTags.json"),
                    loadTranslations(),
                ]);

                if (cancelled) return;

                // 如果是台服，检查是否需要从日服补充数据
                if (server === "tw") {
                    const cnMusicIds = new Set(musicsData.map(m => m.id));
                    try {
                        const jpMusics = await fetchMasterDataForServer<Music[]>("jp", "musics.json");
                        const jpDifficulties = await fetchMasterDataForServer<MusicDifficulty[]>("jp", "musicDifficulties.json");

                        const extraMusics = jpMusics.filter(m => !cnMusicIds.has(m.id));
                        const extraDifficulties = jpDifficulties.filter(d => !cnMusicIds.has(d.musicId));

                        if (extraMusics.length > 0) {
                            setIsTwFallback(true);
                            setAllMusics([...musicsData, ...extraMusics]);
                            setMusicDifficulties([...difficultiesData, ...extraDifficulties]);
                        } else {
                            setAllMusics(musicsData);
                            setMusicDifficulties(difficultiesData);
                        }
                    } catch {
                        // 日服数据获取失败，仅使用国服数据
                        setAllMusics(musicsData);
                        setMusicDifficulties(difficultiesData);
                    }
                } else {
                    setAllMusics(musicsData);
                    setMusicDifficulties(difficultiesData);
                }

                setMusicTags(tagsData);
                setTranslations(translationsData);

                // Fetch song constants (non-blocking)
                fetchSongConstants().then(entries => {
                    setSongConstantsMap(buildSongConstantsMap(entries));
                }).catch(err => {
                    console.warn("Failed to load song constants:", err);
                });
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "加载歌曲数据失败");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        loadMasterData();
        return () => { cancelled = true; };
    }, [activeAccount]);

    // Fetch user music results from suite API
    useEffect(() => {
        if (!activeAccount) {
            setUserMusicResults(new Map());
            return;
        }

        let cancelled = false;

        async function fetchUserMusics() {
            setIsFetchingUser(true);
            setUserError(null);

            try {
                const data = await fetchAccountGameData(activeAccount!, ["userMusics", "userMusicResults", "upload_time"]);

                if (typeof data.upload_time === "number" || typeof data.upload_time === "string") {
                    setUploadTime(data.upload_time);
                } else {
                    setUploadTime(null);
                }

                // New payload: top-level userMusicResults
                const topLevelResultsMap = parseTopLevelMusicResults(data);
                const topLevelCount = topLevelResultsMap.size;

                // Legacy payload fallback: userMusics nested structures
                const legacyResultsMap = parseLegacyMusicResults(data);
                const legacyCount = legacyResultsMap.size;

                // Keep top-level as source-of-truth, fill missing difficulties from legacy payload.
                const mergedResultsMap = mergeFallbackMusicResults(topLevelResultsMap, legacyResultsMap);

                console.log(
                    `[MyMusics] Loaded ${mergedResultsMap.size} music results from API (top-level: ${topLevelCount}, legacy fallback: ${legacyCount})`
                );
                if (!cancelled) setUserMusicResults(mergedResultsMap);
            } catch (error) {
                if (!cancelled) setUserError(normalizeAccountDataError(error));
            } finally {
                if (!cancelled) setIsFetchingUser(false);
            }
        }

        fetchUserMusics();
        return () => { cancelled = true; };
    }, [activeAccount]);

    // Build difficulty map
    const musicDifficultiesMap = useMemo(() => {
        const map: Record<number, Record<string, number>> = {};
        musicDifficulties.forEach(d => {
            if (!map[d.musicId]) map[d.musicId] = {};
            map[d.musicId]![d.musicDifficulty] = d.playLevel;
        });
        return map;
    }, [musicDifficulties]);

    // Filter and sort
    const filteredMusics = useMemo(() => {
        let result = [...allMusics];
        const now = Date.now();

        // Filter released only
        result = result.filter(m => m.publishedAt <= now);

        // Tag filter
        if (selectedTag !== "all") {
            const musicIdsWithTag = new Set(
                musicTags
                    .filter((mt) => mt.musicTag === selectedTag)
                    .map((mt) => mt.musicId)
            );
            result = result.filter((m) => musicIdsWithTag.has(m.id));
        }

        // Category filter
        if (selectedCategories.length > 0) {
            result = result.filter((m) =>
                selectedCategories.every((cat) => m.categories.includes(cat))
            );
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const qNum = parseInt(q, 10);
            result = result.filter(m => {
                if (m.id === qNum) return true;
                if (m.title.toLowerCase().includes(q)) return true;
                const cn = translations?.music?.title?.[m.id.toString()];
                if (cn && cn.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // Completion filter
        if (completionFilter !== "all" && userMusicResults.size > 0) {
            const diff = selectedDifficulty;
            result = result.filter(m => {
                const rank = userMusicResults.get(m.id)?.[diff] || "";
                if (completionFilter === "no_fc") return rank !== "AP" && rank !== "FC";
                if (completionFilter === "no_ap") return rank !== "AP";
                return true;
            });
        }

        // Sort
        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === "level") {
                // Sort by level first, then by completion
                const levelA = musicDifficultiesMap[a.id]?.[selectedDifficulty] || 0;
                const levelB = musicDifficultiesMap[b.id]?.[selectedDifficulty] || 0;
                cmp = levelA - levelB;
                if (cmp === 0) {
                    // Same level, sort by completion (AP > FC > C > 未完成)
                    const rankA = userMusicResults.get(a.id)?.[selectedDifficulty] || "";
                    const rankB = userMusicResults.get(b.id)?.[selectedDifficulty] || "";
                    const priority: Record<string, number> = { "": 0, "C": 1, "FC": 2, "AP": 3 };
                    cmp = priority[rankB] - priority[rankA]; // Reverse for high to low
                }
            } else if (sortBy === "constant") {
                const constA = songConstantsMap[a.id]?.[selectedDifficulty] || 0;
                const constB = songConstantsMap[b.id]?.[selectedDifficulty] || 0;
                cmp = constA - constB;
                if (cmp === 0) cmp = a.publishedAt - b.publishedAt;
            } else if (sortBy === "completion") {
                // Sort by completion status (AP > FC > C > 未完成)
                const rankA = userMusicResults.get(a.id)?.[selectedDifficulty] || "";
                const rankB = userMusicResults.get(b.id)?.[selectedDifficulty] || "";
                const priority: Record<string, number> = { "": 0, "C": 1, "FC": 2, "AP": 3 };
                cmp = priority[rankA] - priority[rankB];
                if (cmp === 0) cmp = a.publishedAt - b.publishedAt;
            } else if (sortBy === "publishedAt") {
                cmp = a.publishedAt - b.publishedAt;
                if (cmp === 0) cmp = a.id - b.id;
            } else if (sortBy === "id") {
                cmp = a.id - b.id;
            }
            return sortOrder === "asc" ? cmp : -cmp;
        });

        return result;
    }, [
        allMusics,
        musicTags,
        selectedTag,
        selectedCategories,
        searchQuery,
        completionFilter,
        selectedDifficulty,
        sortBy,
        sortOrder,
        userMusicResults,
        musicDifficultiesMap,
        translations,
        songConstantsMap,
    ]);

    // Progress stats
    const progressStats = useMemo(() => {
        if (userMusicResults.size === 0) return null;

        const diff = selectedDifficulty;
        const now = Date.now();
        let ap = 0, fc = 0, clear = 0, total = 0;

        for (const music of allMusics) {
            if (music.publishedAt > now) continue;
            if (musicDifficultiesMap[music.id]?.[diff] !== undefined) {
                total++;
                const rank = userMusicResults.get(music.id)?.[diff] || "";
                if (rank === "AP") { ap++; fc++; clear++; }
                else if (rank === "FC") { fc++; clear++; }
                else if (rank === "C") { clear++; }
            }
        }

        return { ap, fc, clear, total };
    }, [allMusics, selectedDifficulty, userMusicResults, musicDifficultiesMap]);

    // Best30 calculation
    const best30Data = useMemo(() => {
        if (userMusicResults.size === 0 || Object.keys(songConstantsMap).length === 0) return null;

        const allDiffs = ["easy", "normal", "hard", "expert", "master", "append"];
        const entries: Array<{ musicId: number; difficulty: string; constant: number; userConstant: number; playResult: PlayResult; title: string; assetbundleName: string }> = [];

        for (const music of allMusics) {
            for (const diff of allDiffs) {
                const constant = songConstantsMap[music.id]?.[diff];
                if (constant === undefined) continue;

                const playResult = userMusicResults.get(music.id)?.[diff] || "";
                // Only AP and FC count
                if (playResult !== "AP" && playResult !== "FC") continue;

                let userConstant: number;
                if (playResult === "AP") {
                    userConstant = constant;
                } else {
                    // FC: ≥33 → -1, <33 → -1.5
                    userConstant = constant >= 33 ? constant - 1 : constant - 1.5;
                }

                entries.push({
                    musicId: music.id,
                    difficulty: diff,
                    constant,
                    userConstant,
                    playResult: playResult as PlayResult,
                    title: music.title,
                    assetbundleName: music.assetbundleName,
                });
            }
        }

        // Sort by userConstant descending
        entries.sort((a, b) => b.userConstant - a.userConstant);

        const top30 = entries.slice(0, 30);
        const average = top30.length > 0
            ? top30.reduce((sum, e) => sum + e.userConstant, 0) / top30.length
            : 0;

        return { entries: top30, average };
    }, [allMusics, userMusicResults, songConstantsMap]);

    // Displayed musics with level separators
    const displayedMusicsWithSeparators = useMemo(() => {
        const musics = filteredMusics.slice(0, displayCount);
        if (sortBy !== "level" && sortBy !== "constant") {
            return musics.map(m => ({ type: 'music' as const, data: m }));
        }

        // Group by level and insert separators
        const result: Array<{ type: 'music' | 'separator', data: Music | { level: number, difficulty: string } }> = [];
        let lastLevel: number | null = null;

        for (const music of musics) {
            const rawLevel = sortBy === "constant"
                ? (songConstantsMap[music.id]?.[selectedDifficulty] || 0)
                : (musicDifficultiesMap[music.id]?.[selectedDifficulty] || 0);
            // For constant sorting, group by integer level only
            const groupLevel = sortBy === "constant" ? Math.floor(rawLevel) : rawLevel;

            if (groupLevel !== lastLevel) {
                result.push({
                    type: 'separator',
                    data: { level: groupLevel, difficulty: selectedDifficulty.toUpperCase() }
                });
                lastLevel = groupLevel;
            }

            result.push({ type: 'music', data: music });
        }

        return result;
    }, [filteredMusics, displayCount, sortBy, musicDifficultiesMap, selectedDifficulty, songConstantsMap]);

    const resetFilters = useCallback(() => {
        setSearchQuery("");
        setSelectedDifficulty("master");
        setSelectedTag("all");
        setSelectedCategories([]);
        setSortBy("level");
        setSortOrder("desc");
        setCompletionFilter("all");
        resetDisplayCount();
    }, [resetDisplayCount]);

    const handleAccountSelect = useCallback((acc: MoesekaiAccount) => {
        setActiveAccount(acc.id);
        setActiveAcc(acc);
    }, []);

    const getMusicThumbnailUrl = useCallback((music: Music): string => {
        // Determine asset source based on server
        let finalAssetSource: AssetSourceType = assetSource;

        // For CN/TW servers, force CN assets (ignore settings)
        if (activeAccount && (activeAccount.server === "cn" || activeAccount.server === "tw")) {
            // Map JP sources to CN equivalents
            const cnSourceMap: Record<AssetSourceType, AssetSourceType> = {
                "snowyassets": "snowyassets_cn",
                "haruki": "haruki_cn",
                "uni": "snowyassets_cn", // uni doesn't have CN, default to snowyassets_cn
                "snowyassets_cn": "snowyassets_cn",
                "haruki_cn": "haruki_cn",
            };
            finalAssetSource = cnSourceMap[assetSource] || "snowyassets_cn";
        }

        return getMusicJacketUrl(music.assetbundleName, finalAssetSource);
    }, [assetSource, activeAccount]);

    const quickFilterContent = (
        <MyMusicFilters
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
            selectedCategories={selectedCategories}
            onCategoryChange={setSelectedCategories}
            selectedDifficulty={selectedDifficulty}
            onDifficultyChange={setSelectedDifficulty}
            completionFilter={completionFilter}
            onCompletionFilterChange={setCompletionFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(newSortBy, newSortOrder) => {
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
            }}
            onReset={resetFilters}
            totalMusics={allMusics.length}
            filteredMusics={filteredMusics.length}
            hasUserData={userMusicResults.size > 0}
        />
    );

    useQuickFilter("歌曲进度筛选", quickFilterContent, [
        selectedTag,
        selectedCategories,
        selectedDifficulty,
        completionFilter,
        searchQuery,
        sortBy,
        sortOrder,
        allMusics.length,
        filteredMusics.length,
        userMusicResults.size,
    ]);

    // No account state
    if (accounts.length === 0) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">
                <PageHeader />
                <QuickBindForm
                    onAccountAdded={() => {
                        setAccountsList(getAccounts());
                        const active = getActiveAccount();
                        setActiveAcc(active);
                    }}
                    description="绑定账号后即可查看你的歌曲完成度与 Best30"
                    returnTo="/my-musics"
                />

            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <PageHeader />

            {/* Account Selector */}
            <AccountSelectorBar
                accounts={accounts}
                activeAccount={activeAccount}
                onSelect={handleAccountSelect}
                onAccountAdded={() => {
                    setAccountsList(getAccounts());
                    const active = getActiveAccount();
                    setActiveAcc(active);
                }}
                returnTo="/my-musics"
            />


            {/* TW Warning */}
            {activeAccount?.server === "tw" && isTwFallback && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200/50 text-xs text-amber-700 flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>繁中服使用国服数据，部分国服未实装歌曲已使用日服数据补充，可能存在兼容性问题</span>
                </div>
            )}

            {/* User Error */}
            {userError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/50">
                    <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-xs font-medium text-red-700">
                                {getUserErrorMessage(userError)}
                            </p>
                            <ExternalLink href="https://haruki.seiunx.com" className="text-xs text-miku hover:underline mt-1 inline-block">
                                前往 Haruki 工具箱 →
                            </ExternalLink>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {!isLoading && !isFetchingUser && userMusicResults.size > 0 && progressStats && (
                <div className="mb-6 glass-card p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-primary-text">
                                {selectedDifficulty.toUpperCase()} 完成度
                            </span>
                            {uploadTime && (
                                <span className="text-[11px] text-slate-400" title="数据上传时间">
                                    数据时间: {formatUploadTime(uploadTime)}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-4 text-sm font-bold mb-2">
                        <div className="flex items-center gap-1">
                            <Image src="/data/music/icon_clear.png" alt="Clear" width={20} height={20} className="drop-shadow-sm" />
                            <span>{progressStats.clear} / {progressStats.total}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Image src="/data/music/icon_fullCombo.png" alt="FC" width={20} height={20} className="drop-shadow-sm" />
                            <span>{progressStats.fc} / {progressStats.total}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Image src="/data/music/icon_allPerfect.png" alt="AP" width={20} height={20} className="drop-shadow-sm" />
                            <span>{progressStats.ap} / {progressStats.total}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Best30 Card */}
            {!isLoading && !isFetchingUser && best30Data && best30Data.entries.length > 0 && (
                <div className="mb-6 glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                        <div
                            className="flex items-center gap-3 cursor-pointer flex-1 hover:opacity-80 transition-opacity"
                            onClick={() => setBest30Expanded(!best30Expanded)}
                        >
                            <span className="text-sm font-bold text-primary-text">Best30</span>
                            <span className="text-2xl font-black text-miku">{best30Data.average.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">社区定数 · 仅供参考</span>
                            <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${best30Expanded ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <button
                            onClick={() => setShowBest30Share(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-miku/10 hover:bg-miku/20 text-miku text-xs font-bold rounded-lg transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            分享
                        </button>
                    </div>
                    {best30Expanded && (
                        <div className="border-t border-slate-200/50 grid grid-cols-1 sm:grid-cols-2">
                            {best30Data.entries.map((entry, idx) => (
                                <Link
                                    key={`${entry.musicId}-${entry.difficulty}`}
                                    href={`/music/${entry.musicId}`}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50/80 transition-colors border-b border-r border-slate-100/50"
                                >
                                    <span className="text-[10px] font-bold text-slate-400 w-5 text-right">#{idx + 1}</span>
                                    <div className="w-8 h-8 rounded-md overflow-hidden relative flex-shrink-0">
                                        <Image
                                            src={getMusicThumbnailUrl({ assetbundleName: entry.assetbundleName } as Music)}
                                            alt=""
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-primary-text truncate">{entry.title}</div>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${entry.difficulty === 'master' ? 'bg-purple-100 text-purple-600' :
                                        entry.difficulty === 'append' ? 'bg-pink-100 text-pink-600' :
                                            entry.difficulty === 'expert' ? 'bg-red-100 text-red-600' :
                                                'bg-slate-100 text-slate-600'
                                        }`}>
                                        {entry.difficulty.slice(0, 3)}
                                    </span>
                                    <Image
                                        src={entry.playResult === 'AP' ? '/data/music/icon_allPerfect.png' : '/data/music/icon_fullCombo.png'}
                                        alt={entry.playResult}
                                        width={14}
                                        height={14}
                                        className="drop-shadow-sm flex-shrink-0"
                                    />
                                    <div className="text-right flex-shrink-0 w-10">
                                        <div className="text-[11px] font-black text-miku">{entry.userConstant.toFixed(1)}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Best30 Share Image Modal */}
            {showBest30Share && best30Data && activeAccount && (
                <Best30ShareImage
                    entries={best30Data.entries}
                    average={best30Data.average}
                    gameId={activeAccount.gameId}
                    serverLabel={SERVER_LABELS[activeAccount.server]}
                    getMusicThumbnailUrl={(entry) => getMusicThumbnailUrl({ assetbundleName: entry.assetbundleName } as Music)}
                    avatarUrl={
                        getCachedAvatarUrl(activeAccount.id) ||
                        getCharacterIconUrl(
                            activeAccount.userCharacters
                                ? getTopCharacterId(activeAccount.userCharacters)
                                : 21
                        )
                    }
                    nickname={activeAccount.userGamedata?.name || activeAccount.nickname || undefined}
                    uploadTime={uploadTime || undefined}
                    onClose={() => setShowBest30Share(false)}
                />
            )}

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout: Filters + Content */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Filters */}
                <aside className="lg:w-80 flex-shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {isLoading || isFetchingUser ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse">
                                    <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200" />
                                </div>
                            ))}
                        </div>
                    ) : filteredMusics.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <p className="text-slate-400 font-medium">没有找到符合条件的歌曲</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                            {displayedMusicsWithSeparators.map((item, index) => {
                                if (item.type === 'separator') {
                                    const sepData = item.data as { level: number, difficulty: string };
                                    return (
                                        <LevelSeparatorCard
                                            key={`sep-${sepData.difficulty}-${sepData.level}`}
                                            level={sepData.level}
                                            difficulty={sepData.difficulty}
                                        />
                                    );
                                } else {
                                    const music = item.data as Music;
                                    return (
                                        <MusicItem
                                            key={music.id}
                                            music={music}
                                            difficulties={musicDifficultiesMap[music.id] || {}}
                                            results={userMusicResults.get(music.id) || {}}
                                            thumbnailUrl={getMusicThumbnailUrl(music)}
                                            hasUserData={userMusicResults.size > 0}
                                            selectedDifficulty={selectedDifficulty}
                                            constant={songConstantsMap[music.id]?.[selectedDifficulty]}
                                            sortBy={sortBy}
                                        />
                                    );
                                }
                            })}
                        </div>
                    )}

                    {/* Load More Button */}
                    {!isLoading && displayedMusicsWithSeparators.filter(i => i.type === 'music').length < filteredMusics.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                data-shortcut-load-more="true"
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedMusicsWithSeparators.filter(i => i.type === 'music').length} / {filteredMusics.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded indicator */}
                    {!isLoading && displayedMusicsWithSeparators.filter(i => i.type === 'music').length > 0 && displayedMusicsWithSeparators.filter(i => i.type === 'music').length >= filteredMusics.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {filteredMusics.length} 首歌曲
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== Sub Components ====================

function LevelSeparatorCard({ level, difficulty }: { level: number; difficulty: string }) {
    // Difficulty color mapping
    const difficultyColors: Record<string, string> = {
        EASY: "from-green-400 to-green-500",
        NORMAL: "from-blue-400 to-blue-500",
        HARD: "from-yellow-400 to-yellow-500",
        EXPERT: "from-red-400 to-red-500",
        MASTER: "from-purple-500 to-purple-600",
        APPEND: "from-pink-500 to-pink-600",
    };

    const gradientClass = difficultyColors[difficulty] || "from-slate-400 to-slate-500";

    return (
        <div className={`aspect-square rounded-xl bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center shadow-lg`}>
            <div className="text-white text-center px-2">
                <div className="text-[10px] sm:text-xs font-bold opacity-90 mb-0.5">
                    {difficulty}
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black">
                    {level}
                </div>
            </div>
        </div>
    );
}

function PageHeader() {
    return (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                <span className="text-miku text-xs font-bold tracking-widest uppercase">Music Progress</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                歌曲<span className="text-miku">进度</span>
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
                查看你的歌曲完成进度和成绩
            </p>
        </div>
    );
}

interface MusicItemProps {
    music: Music;
    difficulties: Record<string, number>;
    results: Record<string, PlayResult>;
    thumbnailUrl: string;
    hasUserData: boolean;
    selectedDifficulty: string;
    constant?: number;
    sortBy?: string;
}

function MusicItem({ music, difficulties, results, thumbnailUrl, hasUserData, selectedDifficulty, constant, sortBy }: MusicItemProps) {
    const allDiffs = ["easy", "normal", "hard", "expert", "master", "append"];
    const currentLevel = difficulties[selectedDifficulty];

    return (
        <Link href={`/music/${music.id}`} className="group block" data-shortcut-item="true">
            <div className="relative cursor-pointer rounded-xl overflow-hidden transition-all bg-white/60 ring-1 ring-slate-200/60 hover:ring-miku hover:shadow-xl hover:-translate-y-1">
                {/* Music Thumbnail */}
                <div className="w-full aspect-square relative">
                    <Image
                        src={thumbnailUrl}
                        alt={music.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                    />

                    {/* Badge - top right corner */}
                    {currentLevel !== undefined && (
                        <div className={`absolute top-1 right-1 text-white font-bold px-1.5 py-0.5 rounded ${constant ? 'bg-miku/80 backdrop-blur-sm text-[10px] shadow-sm' : 'bg-black/70 text-xs'}`}>
                            {constant ? constant.toFixed(1) : (sortBy === 'constant' ? `${currentLevel}.?` : currentLevel)}
                        </div>
                    )}

                    {/* Completion Badges - bottom left corner */}
                    {hasUserData && (
                        <div className="absolute bottom-1 left-1 flex gap-0.5">
                            {allDiffs.map(diff => {
                                if (difficulties[diff] === undefined) return null;
                                const result = results[diff] || "";

                                return (
                                    <div key={diff} className="flex-shrink-0">
                                        {result === "AP" && (
                                            <Image src="/data/music/icon_allPerfect.png" alt="AP" width={12} height={12} className="drop-shadow-md" />
                                        )}
                                        {result === "FC" && (
                                            <Image src="/data/music/icon_fullCombo.png" alt="FC" width={12} height={12} className="drop-shadow-md" />
                                        )}
                                        {result === "C" && (
                                            <Image src="/data/music/icon_clear.png" alt="C" width={12} height={12} className="drop-shadow-md" />
                                        )}
                                        {!result && (
                                            <Image src="/data/music/icon_notClear.png" alt="NC" width={12} height={12} className="opacity-50 drop-shadow-md" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Title Info */}
                <div className="p-3">
                    <h3 className="text-sm font-bold text-primary-text group-hover:text-miku transition-colors">
                        <TranslatedText
                            original={music.title}
                            category="music"
                            field="title"
                            originalClassName="truncate block"
                            translationClassName="text-xs font-medium text-slate-400 truncate block"
                        />
                    </h3>
                </div>
            </div>
        </Link>
    );
}

// ==================== Export ====================

export default function MyMusicsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载...</div>}>
                <MyMusicsContent />
            </Suspense>
        </MainLayout>
    );
}
