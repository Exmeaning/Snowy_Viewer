"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import Link from "@/components/LocalizedLink";
import ExternalLink from '@/components/ExternalLink';
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import {
    IMusicInfo,
    IMusicMeta,
    IMusicDifficultyInfo,
    MusicDifficultyType,
    DIFFICULTY_COLORS,
    DIFFICULTY_NAMES,
    getMusicJacketUrl,
} from "@/types/music";
import { fetchMasterData } from "@/lib/fetch";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { MOE_MUSIC_META_URL } from "@/lib/assets";

// Music Meta API URL
const MUSIC_META_API = MOE_MUSIC_META_URL;

// Items per page options
const PAGE_SIZE_OPTIONS = [20, 50, 100];

// Mode options
type LiveMode = "auto" | "solo" | "multi";
const LIVE_MODE_OPTIONS: { value: LiveMode; labelKey: string }[] = [
    { value: "multi", labelKey: "page.musicMeta.liveModes.multi" },
    { value: "solo", labelKey: "page.musicMeta.liveModes.solo" },
    { value: "auto", labelKey: "page.musicMeta.liveModes.auto" },
];

// View mode
type ViewMode = "overview" | "detailed";

// Mode-specific ranking categories
interface RankingCategory {
    id: string;
    titleKey: string;
    subtitleKey: string;
    field: keyof IMusicMeta;
    format: (val: number) => string;
    dedupeBySong?: boolean;
    hideDifficulty?: boolean;
}

const getRankingCategories = (mode: LiveMode): RankingCategory[] => {
    const base: RankingCategory[] = [];

    if (mode === "multi") {
        base.push(
            { id: "hourly", titleKey: "page.musicMeta.rankings.hourly", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_pt_per_hour_multi", format: (v) => v.toFixed(1) },
            { id: "score", titleKey: "page.musicMeta.rankings.score", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_multi_score", format: (v) => v.toFixed(1) },
            { id: "pt", titleKey: "page.musicMeta.rankings.pt", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_multi_pt_max", format: (v) => v.toFixed(1) },
            { id: "cycles", titleKey: "page.musicMeta.rankings.cycles", subtitleKey: "page.musicMeta.units.timesPerHour", field: "cycles_multi", format: (v) => v.toFixed(1), dedupeBySong: true, hideDifficulty: true },
        );
    } else if (mode === "solo") {
        base.push(
            { id: "score", titleKey: "page.musicMeta.rankings.score", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_solo_score", format: (v) => v.toFixed(1) },
            { id: "pt", titleKey: "page.musicMeta.rankings.pt", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_solo_pt_max", format: (v) => v.toFixed(1) },
        );
    } else {
        base.push(
            { id: "hourly", titleKey: "page.musicMeta.rankings.hourly", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_pt_per_hour_auto", format: (v) => v.toFixed(1) },
            { id: "score", titleKey: "page.musicMeta.rankings.score", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_auto_score", format: (v) => v.toFixed(1) },
            { id: "pt", titleKey: "page.musicMeta.rankings.pt", subtitleKey: "page.musicMeta.units.pspi", field: "pspi_auto_pt_max", format: (v) => v.toFixed(1) },
            { id: "cycles", titleKey: "page.musicMeta.rankings.cycles", subtitleKey: "page.musicMeta.units.timesPerHour", field: "cycles_auto", format: (v) => v.toFixed(1), dedupeBySong: true, hideDifficulty: true },
        );
    }

    return base;
};

// Rank colors for top 3. Medal hues are semantic and stay literal; everything
// below the podium falls back to the neutral text ramp.
const getRankColor = (rank: number): string => {
    if (rank === 1) return "text-yellow-500"; // Gold
    if (rank === 2) return "text-[var(--hh-text-secondary)]"; // Silver
    if (rank === 3) return "text-amber-600"; // Bronze
    return "text-[var(--hh-text-tertiary)]";
};

// Hook to get responsive column count
function useColumnCount() {
    const [columns, setColumns] = useState(5);

    useEffect(() => {
        const updateColumns = () => {
            const width = window.innerWidth;
            if (width >= 1280) setColumns(5);      // xl
            else if (width >= 1024) setColumns(3); // lg
            else if (width >= 640) setColumns(2);  // sm
            else setColumns(1);                     // mobile
        };

        updateColumns();
        window.addEventListener("resize", updateColumns);
        return () => window.removeEventListener("resize", updateColumns);
    }, []);

    return columns;
}

// Hook to determine if sticky columns should be enabled
// When scrollable area is less than MIN_SCROLLABLE_WIDTH, disable sticky to allow full horizontal scroll
const MIN_SCROLLABLE_WIDTH = 100; // Minimum pixels for scrollable area
// Total sticky columns width: ID + Difficulty + Song Title (min-width)
// sm+: 60 + 140 + 180 = 380px
// xs:  45 + 95 + 180 = 320px
const STICKY_COLUMNS_WIDTH_SM = 380;
const STICKY_COLUMNS_WIDTH_XS = 320;

function useEnableStickyColumns() {
    const [enableSticky, setEnableSticky] = useState(true);

    useEffect(() => {
        const checkWidth = () => {
            const screenWidth = window.innerWidth;
            const isSm = screenWidth >= 640;
            const stickyWidth = isSm ? STICKY_COLUMNS_WIDTH_SM : STICKY_COLUMNS_WIDTH_XS;
            // Calculate scrollable area: screen width - sticky columns - container padding (px-4 = 32px total)
            const scrollableArea = screenWidth - stickyWidth - 32;
            setEnableSticky(scrollableArea >= MIN_SCROLLABLE_WIDTH);
        };

        checkWidth();
        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, []);

    return enableSticky;
}

function MusicMetaContent() {
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
    const { t, formatNumber } = useI18n();
    const [musicMetas, setMusicMetas] = useState<IMusicMeta[]>([]);
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [difficulties, setDifficulties] = useState<IMusicDifficultyInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>("overview");

    // Live mode state
    const [liveMode, setLiveMode] = useState<LiveMode>("multi");

    // Ranking expand states
    const [expandedRankings, setExpandedRankings] = useState<Set<string>>(new Set());

    // Sort state (for detailed view)
    const [sortField, setSortField] = useState<keyof IMusicMeta>("music_id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    // Search state
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Get responsive column count
    const columnCount = useColumnCount();

    // Check if sticky columns should be enabled (false when scrollable area is too small)
    const enableStickyColumns = useEnableStickyColumns();

    // Calculate item counts based on columns to fill rows
    // Default: 1 row, Expanded: 3 rows
    const defaultRowCount = 1;
    const expandedRowCount = columnCount >= 5 ? 3 : 5;
    const defaultItemCount = columnCount * defaultRowCount;
    const expandedItemCount = columnCount * expandedRowCount;

    // Storage key for sessionStorage
    const STORAGE_KEY = "music_meta_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const view = searchParams.get("view");
        const mode = searchParams.get("mode");
        const expanded = searchParams.get("expanded");
        const sort = searchParams.get("sortField");
        const order = searchParams.get("sortOrder");
        const search = searchParams.get("search");
        const page = searchParams.get("page");
        const size = searchParams.get("pageSize");

        // If URL has params, use them
        const hasUrlParams = view || mode || expanded || sort || order || search || page || size;

        if (hasUrlParams) {
            if (view && (view === "overview" || view === "detailed")) setViewMode(view);
            if (mode && (mode === "multi" || mode === "solo" || mode === "auto")) setLiveMode(mode);
            if (expanded) setExpandedRankings(new Set(expanded.split(",")));
            if (sort) setSortField(sort as keyof IMusicMeta);
            if (order && (order === "asc" || order === "desc")) setSortOrder(order);
            if (search) setSearchQuery(search);
            if (page) setCurrentPage(Number(page) || 1);
            if (size && PAGE_SIZE_OPTIONS.includes(Number(size))) setPageSize(Number(size));
        } else {
            // Fallback to sessionStorage
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.viewMode) setViewMode(filters.viewMode);
                    if (filters.liveMode) setLiveMode(filters.liveMode);
                    if (filters.expandedRankings?.length) setExpandedRankings(new Set(filters.expandedRankings));
                    if (filters.sortField) setSortField(filters.sortField);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                    if (filters.searchQuery) setSearchQuery(filters.searchQuery);
                    if (filters.currentPage) setCurrentPage(filters.currentPage);
                    if (filters.pageSize) setPageSize(filters.pageSize);
                }
            } catch (_e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        // Save to sessionStorage
        const filters = {
            viewMode,
            liveMode,
            expandedRankings: Array.from(expandedRankings),
            sortField,
            sortOrder,
            searchQuery,
            currentPage,
            pageSize,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (_e) {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (viewMode !== "overview") params.set("view", viewMode);
        if (liveMode !== "multi") params.set("mode", liveMode);
        if (expandedRankings.size > 0) params.set("expanded", Array.from(expandedRankings).join(","));
        if (sortField !== "music_id") params.set("sortField", sortField);
        if (sortOrder !== "asc") params.set("sortOrder", sortOrder);
        if (searchQuery) params.set("search", searchQuery);
        if (currentPage !== 1) params.set("page", String(currentPage));
        if (pageSize !== 50) params.set("pageSize", String(pageSize));
        replaceCurrentUrlSearchParams(params);
    }, [viewMode, liveMode, expandedRankings, sortField, sortOrder, searchQuery, currentPage, pageSize, filtersInitialized]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [metaData, musicsData, difficultiesData] = await Promise.all([
                    fetch(MUSIC_META_API).then((res) => res.json()),
                    fetchMasterData<IMusicInfo[]>("musics.json"),
                    fetchMasterData<IMusicDifficultyInfo[]>("musicDifficulties.json"),
                ]);
                setMusicMetas(metaData);
                setMusics(musicsData);
                setDifficulties(difficultiesData);
                setError(null);
            } catch (err) {
                console.error("Error fetching music meta data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Create music ID to info map
    const musicMap = useMemo(() => {
        const map = new Map<number, IMusicInfo>();
        musics.forEach((m) => map.set(m.id, m));
        return map;
    }, [musics]);

    // Create difficulty map
    const difficultyMap = useMemo(() => {
        const map = new Map<string, number>();
        difficulties.forEach((d) => {
            map.set(`${d.musicId}-${d.musicDifficulty}`, d.playLevel);
        });
        return map;
    }, [difficulties]);

    // Toggle ranking expansion - just update state, no scroll
    const toggleRankingExpand = (id: string) => {
        setExpandedRankings((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Get top N items for a ranking (with optional deduplication by song)
    const getTopItems = (field: keyof IMusicMeta, count: number, dedupeBySong: boolean = false) => {
        const sorted = [...musicMetas].sort((a, b) => (b[field] as number) - (a[field] as number));

        if (dedupeBySong) {
            const seen = new Set<number>();
            const result: IMusicMeta[] = [];
            for (const item of sorted) {
                if (!seen.has(item.music_id)) {
                    seen.add(item.music_id);
                    result.push(item);
                    if (result.length >= count) break;
                }
            }
            return result;
        }

        return sorted.slice(0, count);
    };

    // Get ranking categories for current mode
    const rankingCategories = useMemo(() => getRankingCategories(liveMode), [liveMode]);

    // Filter and sort (for detailed view)
    const filteredMetas = useMemo(() => {
        let result = [...musicMetas];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const queryNum = parseInt(query, 10);
            result = result.filter((meta) => {
                const music = musicMap.get(meta.music_id);
                const title = music?.title || "";
                return meta.music_id === queryNum || title.toLowerCase().includes(query);
            });
        }

        result.sort((a, b) => {
            if (sortField === "difficulty") {
                const aLevel = difficultyMap.get(`${a.music_id}-${a.difficulty}`) || 0;
                const bLevel = difficultyMap.get(`${b.music_id}-${b.difficulty}`) || 0;
                if (aLevel !== bLevel) {
                    return sortOrder === "asc" ? aLevel - bLevel : bLevel - aLevel;
                }
            }
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortOrder === "asc"
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });

        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [musicMetas, searchQuery, sortField, sortOrder, musicMap]);

    const paginatedMetas = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredMetas.slice(start, start + pageSize);
    }, [filteredMetas, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredMetas.length / pageSize);



    const handleSort = (field: keyof IMusicMeta) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
        setCurrentPage(1);
    };

    const getModeFields = (mode: LiveMode) => {
        switch (mode) {
            case "auto":
                return {
                    score: "pspi_auto_score" as keyof IMusicMeta,
                    pt: "pspi_auto_pt_max" as keyof IMusicMeta,
                    hourly: "pspi_pt_per_hour_auto" as keyof IMusicMeta,
                    cycles: "cycles_auto" as keyof IMusicMeta,
                };
            case "solo":
                return {
                    score: "pspi_solo_score" as keyof IMusicMeta,
                    pt: "pspi_solo_pt_max" as keyof IMusicMeta,
                    hourly: null,
                    cycles: null,
                };
            case "multi":
                return {
                    score: "pspi_multi_score" as keyof IMusicMeta,
                    pt: "pspi_multi_pt_max" as keyof IMusicMeta,
                    hourly: "pspi_pt_per_hour_multi" as keyof IMusicMeta,
                    cycles: "cycles_multi" as keyof IMusicMeta,
                };
        }
    };

    const modeFields = getModeFields(liveMode);

    // Ranking Item Component - Compact horizontal layout
    const RankingItem = ({ meta, rank, category }: { meta: IMusicMeta; rank: number; category: RankingCategory }) => {
        const music = musicMap.get(meta.music_id);
        const level = difficultyMap.get(`${meta.music_id}-${meta.difficulty}`) || "?";
        const diffColor = DIFFICULTY_COLORS[meta.difficulty as MusicDifficultyType] || "#888";
        const diffName = DIFFICULTY_NAMES[meta.difficulty as MusicDifficultyType] || meta.difficulty;
        const value = meta[category.field] as number;

        return (
            <Link
                href={`/music/${meta.music_id}`}
                className="group relative block"
            >
                <div className="hh-tile relative rounded-[var(--hh-radius-lg)] overflow-hidden hover:bg-[var(--hh-surface-3)] hover:border-[var(--hh-accent-line)] transition-colors flex">
                    {/* Cover Image - Smaller */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden">
                        {music && (
                            <Image
                                src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                alt={music.title}
                                fill
                                sizes="96px"
                                className="object-cover"
                                unoptimized
                            />
                        )}

                        {/* Difficulty Badge - Only show if not hidden */}
                        {!category.hideDifficulty && (
                            <div
                                className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] text-[9px] font-bold text-white"
                                style={{ backgroundColor: diffColor }}
                            >
                                {diffName} <span className="hh-numeric">{level}</span>
                            </div>
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 p-2 sm:p-3 flex flex-col justify-center min-w-0">
                        <h3 className="text-sm font-bold text-primary-text truncate group-hover:text-[var(--hh-accent-deep)] transition-colors">
                            {music?.title || `Music ${meta.music_id}`}
                        </h3>
                        <p className="text-xs text-[var(--hh-text-secondary)] truncate mt-0.5">
                            {music?.composer}
                            {music?.composer !== music?.arranger && music?.arranger !== "-" && ` / ${music?.arranger}`}
                        </p>
                        {/* PSPI Score */}
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="hh-numeric hh-display text-lg text-[var(--hh-accent-deep)]">{category.format(value)}</span>
                            <span className="text-[10px] text-[var(--hh-text-tertiary)]">{t(category.subtitleKey)}</span>
                        </div>
                    </div>

                    {/* Rank Badge - Bottom Right Corner, Large with special colors */}
                    <div className={`hh-numeric hh-display absolute bottom-2 right-2 text-2xl sm:text-3xl select-none ${getRankColor(rank)}`}>
                        #{rank}
                    </div>
                </div>
            </Link>
        );
    };

    // Ranking Section Component
    const RankingSection = ({ category }: { category: RankingCategory }) => {
        const isExpanded = expandedRankings.has(category.id);
        const itemCount = isExpanded ? expandedItemCount : defaultItemCount;
        const items = getTopItems(category.field, itemCount, category.dedupeBySong);

        return (
            <div className="mb-10">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="w-1 h-6 bg-[var(--hh-accent)] rounded-[var(--hh-radius-xs)]"></span>
                        <h2 className="hh-title text-lg text-primary-text">{t(category.titleKey)}</h2>
                        <span className="text-xs text-[var(--hh-text-secondary)] bg-[var(--hh-surface-sunken)] px-2 py-0.5 rounded-[var(--hh-radius-xs)]">{t(category.subtitleKey)}</span>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            toggleRankingExpand(category.id);
                        }}
                        className="hh-press hh-focusable text-xs text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] transition-colors px-3 py-1 rounded-[var(--hh-radius-md)] hover:bg-[var(--hh-surface-sunken)]"
                    >
                        {isExpanded ? t("page.musicMeta.collapse") : t("page.musicMeta.expandMore")}
                    </button>
                </div>

                {/* Ranking Grid - Responsive: 1 col mobile, 2 sm, 3 lg, 5 xl */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {items.map((meta, idx) => (
                        <RankingItem
                            key={`${category.id}-${meta.music_id}-${meta.difficulty}`}
                            meta={meta}
                            rank={idx + 1}
                            category={category}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // Table Header Component
    const TableHeader = ({
        field, main, sub, center = false, className = "",
    }: {
        field: keyof IMusicMeta; main: string; sub?: string; center?: boolean; className?: string;
    }) => (
        <th
            className={`px-3 py-3 ${center ? "text-center" : "text-left"} cursor-pointer hover:bg-[var(--hh-surface-3)] transition-colors whitespace-nowrap bg-[var(--hh-surface-1)] ${className}`}
            // Sortable header: a real control that no default selector matched, so
            // the click was silent. Re-sorting is a state flip, hence "toggle".
            // `data-hh-click` rather than `hh-press` — scaling a table header
            // would drag the whole column with it.
            data-hh-click
            data-hh-sound="toggle"
            onClick={() => handleSort(field)}
        >
            <div className={`flex flex-col ${center ? "items-center" : "items-start"}`}>
                <span className="text-sm font-bold text-[var(--hh-text-primary)]">
                    {main}
                    {sortField === field && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </span>
                {sub && <span className="text-xs text-[var(--hh-text-tertiary)]">{sub}</span>}
            </div>
        </th>
    );

    // Difficulty Badge Component
    const DifficultyBadge = ({ musicId, difficulty }: { musicId: number; difficulty: string }) => {
        const color = DIFFICULTY_COLORS[difficulty as MusicDifficultyType] || "#888";
        const name = DIFFICULTY_NAMES[difficulty as MusicDifficultyType] || difficulty.toUpperCase();
        const level = difficultyMap.get(`${musicId}-${difficulty}`) || "?";
        return (
            <div className="flex justify-center">
                <span className="w-[85px] sm:w-[120px] px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-xs font-bold text-white inline-flex items-center justify-center gap-1" style={{ backgroundColor: color }}>
                    <span className="hidden sm:inline">{name}</span>
                    <span className="hh-numeric opacity-90">Lv.{level}</span>
                </span>
            </div>
        );
    };

    // Pagination Component
    const Pagination = () => (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-2">
            <div className="flex items-center gap-2 text-sm text-[var(--hh-text-secondary)]">
                <span>{t("page.musicMeta.pagination.perPagePrefix")}</span>
                <select value={pageSize} onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                }} className="hh-input hh-numeric px-2 py-1 rounded-[var(--hh-radius-md)]">
                    {PAGE_SIZE_OPTIONS.map((size) => (<option key={size} value={size}>{size}</option>))}
                </select>
                <span>{t("page.musicMeta.pagination.perPageSuffix")}</span>
                <span className="text-[var(--hh-text-tertiary)] ml-2">{t("page.musicMeta.pagination.total", { count: formatNumber(filteredMetas.length) })}</span>
            </div>
            <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="hh-press px-2 py-1 rounded-[var(--hh-radius-md)] text-sm border border-[var(--hh-border)] bg-[var(--hh-surface-2)] disabled:opacity-40 hover:bg-[var(--hh-surface-3)]">{t("page.musicMeta.pagination.first")}</button>
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="hh-press px-2 py-1 rounded-[var(--hh-radius-md)] text-sm border border-[var(--hh-border)] bg-[var(--hh-surface-2)] disabled:opacity-40 hover:bg-[var(--hh-surface-3)]">{t("page.musicMeta.pagination.previous")}</button>
                <span className="hh-numeric px-3 py-1 text-sm text-[var(--hh-text-secondary)] font-mono">{currentPage}/{totalPages || 1}</span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="hh-press px-2 py-1 rounded-[var(--hh-radius-md)] text-sm border border-[var(--hh-border)] bg-[var(--hh-surface-2)] disabled:opacity-40 hover:bg-[var(--hh-surface-3)]">{t("page.musicMeta.pagination.next")}</button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="hh-press px-2 py-1 rounded-[var(--hh-radius-md)] text-sm border border-[var(--hh-border)] bg-[var(--hh-surface-2)] disabled:opacity-40 hover:bg-[var(--hh-surface-3)]">{t("page.musicMeta.pagination.last")}</button>
            </div>
        </div>
    );

    // PSPI Explanation Section
    const PSPIExplanation = () => (
        <div className="hh-well mt-12 p-6 rounded-[var(--hh-radius-lg)]">
            <h2 className="hh-title text-lg text-primary-text mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-[var(--hh-accent)] rounded-[var(--hh-radius-xs)]"></span>
                {t("page.musicMeta.pspi.title")}
            </h2>
            <div className="hh-body space-y-4 text-[var(--hh-text-secondary)] text-sm">
                <p>
                    <strong>{t("page.musicMeta.pspi.term")}</strong>{t("page.musicMeta.pspi.descriptionAfterTerm")}
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                        <h3 className="font-bold text-[var(--hh-text-primary)] mb-2">{t("page.musicMeta.pspi.teamTitle")}</h3>
                        <ul className="space-y-1 text-sm">
                            <li>{t("page.musicMeta.pspi.soloAutoTeam")}</li>
                            <li>{t("page.musicMeta.pspi.multiTeam")}</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                        <h3 className="font-bold text-[var(--hh-text-primary)] mb-2">{t("page.musicMeta.pspi.cyclesTitle")}</h3>
                        <ul className="space-y-1 text-sm">
                            <li>{t("page.musicMeta.pspi.autoCycle")}</li>
                            <li>{t("page.musicMeta.pspi.multiCycle")}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );

    // Credits Section
    const CreditsSection = () => (
        <div className="mt-8 py-6 border-t border-[var(--hh-border)] text-center">
            <div className="text-sm text-[var(--hh-text-tertiary)] mb-2">{t("page.musicMeta.creditsTitle")}</div>
            <div className="text-center text-sm text-[var(--hh-text-secondary)] py-8">
                Meta Data Provided by <ExternalLink href="https://github.com/Sekai-World/sekai-viewer" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent-deep)] transition-colors">Sekai-World/sekai-viewer</ExternalLink> & <ExternalLink href="https://3-3.dev/" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent-deep)] transition-colors">xfl03</ExternalLink> & <ExternalLink href="https://github.com/NeuraXmy" target="_blank" rel="noopener noreferrer" className="text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent-deep)] transition-colors">Luna</ExternalLink>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-sm)] mb-4">
                    <span className="hh-label text-[var(--hh-accent-deep)]">{t("page.musicMeta.badge")}</span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl text-primary-text mb-3">
                    {t("page.musicMeta.title")} <span className="text-[var(--hh-accent-deep)]">{t("page.musicMeta.titleHighlight")}</span>
                </h1>
                <p className="hh-body text-[var(--hh-text-secondary)] max-w-2xl mx-auto text-sm">
                    {t("page.musicMeta.description")}
                </p>
            </div>

            {/* Controls. Both toggles are hand-built segmented troughs rather than
                .hh-segment, which forces `width: 100%` for the side rail and would
                make these two stretch and lose their shrink-to-fit centering. */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8">
                {/* Live Mode Toggle */}
                <div className="flex items-center gap-[2px] bg-[var(--hh-surface-sunken)] border border-[var(--hh-border-hairline)] p-[3px] rounded-[var(--hh-radius-md)]">
                    {LIVE_MODE_OPTIONS.map((option) => (
                        <button
                            type="button"
                            key={option.value}
                            onClick={() => setLiveMode(option.value)}
                            className={`px-4 py-2 rounded-[var(--hh-radius-sm)] text-sm font-semibold transition-colors ${liveMode === option.value
                                ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]"
                                : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                                }`}
                        >
                            {t(option.labelKey)}
                        </button>
                    ))}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-[2px] bg-[var(--hh-surface-sunken)] border border-[var(--hh-border-hairline)] p-[3px] rounded-[var(--hh-radius-md)]">
                    <button
                        type="button"
                        onClick={() => setViewMode("overview")}
                        className={`px-4 py-2 rounded-[var(--hh-radius-sm)] text-sm font-semibold transition-colors ${viewMode === "overview" ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]" : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                            }`}
                    >
                        {t("page.musicMeta.viewModes.overview")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("detailed")}
                        className={`px-4 py-2 rounded-[var(--hh-radius-sm)] text-sm font-semibold transition-colors ${viewMode === "detailed" ? "bg-[var(--hh-surface-2)] text-[var(--hh-text-primary)]" : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)]"
                            }`}
                    >
                        {t("page.musicMeta.viewModes.detailed")}
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-[var(--hh-accent-alert)]/10 border border-[var(--hh-accent-alert)]/40 rounded-[var(--hh-radius-md)] text-[var(--hh-accent-alert)] text-sm">
                    <p className="font-bold">{t("page.musicMeta.loadFailed")}</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div className="flex h-[30vh] w-full items-center justify-center text-[var(--hh-text-secondary)] flex-col gap-3">
                    <div className="loading-spinner loading-spinner-sm" />
                    <p>{t("page.musicMeta.loading")}</p>
                </div>
            ) : viewMode === "overview" ? (
                /* Overview Mode - Rankings */
                <div>
                    {rankingCategories.map((category) => (
                        <RankingSection key={category.id} category={category} />
                    ))}
                </div>
            ) : (
                /* Detailed Mode - Table */
                <>
                    <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between sticky top-[4.5rem] z-30 bg-[var(--hh-surface-1)] p-4 rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                        <div className="relative w-full sm:max-w-md">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--hh-text-tertiary)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                data-shortcut-search="true"
                                type="text"
                                placeholder={t("page.musicMeta.searchPlaceholder")}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="hh-input w-full pl-10 pr-4 py-2"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)]">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead className="bg-[var(--hh-surface-1)]">
                                <tr>
                                    <TableHeader field="music_id" main="ID" center className={`${enableStickyColumns ? 'sticky left-0 z-20' : ''} border-r border-[var(--hh-border)] w-[45px] min-w-[45px] sm:w-[60px]`} />
                                    <TableHeader field="difficulty" main={t("page.musicMeta.table.difficulty")} center className={`${enableStickyColumns ? 'sticky left-[45px] sm:left-[60px] z-20' : ''} border-r border-[var(--hh-border)] w-[95px] min-w-[95px] sm:w-[140px]`} />
                                    <th className={`px-3 py-3 text-left text-sm font-bold text-[var(--hh-text-primary)] min-w-[180px] ${enableStickyColumns ? 'sticky left-[140px] sm:left-[200px] z-20' : ''} bg-[var(--hh-surface-1)] border-r border-[var(--hh-border)]`}>{t("page.musicMeta.table.songName")}</th>
                                    <TableHeader field="music_time" main={t("page.musicMeta.table.duration")} sub={t("page.musicMeta.units.seconds")} center className="w-[80px]" />
                                    <TableHeader field="event_rate" main={t("page.musicMeta.table.eventRate")} center className="w-[100px]" />
                                    <TableHeader field="base_score" main={t("page.musicMeta.table.baseScore")} center className="min-w-[100px]" />
                                    <TableHeader field="fever_score" main="Fever" center className="min-w-[100px]" />
                                    {modeFields.cycles && <TableHeader field={modeFields.cycles} main={t("page.musicMeta.table.cycles")} sub={t("page.musicMeta.table.baseCycles")} center className="min-w-[90px]" />}
                                    <TableHeader field={modeFields.score} main={t("page.musicMeta.table.score")} sub={t("page.musicMeta.units.pspi")} center className="min-w-[100px]" />
                                    <TableHeader field={modeFields.pt} main={t("page.musicMeta.table.eventPt")} sub={t("page.musicMeta.units.pspi")} center className="min-w-[100px]" />
                                    {modeFields.hourly && <TableHeader field={modeFields.hourly} main={t("page.musicMeta.table.hourly")} sub={t("page.musicMeta.units.pspi")} center className="min-w-[100px]" />}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedMetas.map((meta, idx) => {
                                    const rowBgClass = idx % 2 === 0 ? "bg-[var(--hh-surface-2)]" : "bg-[var(--hh-surface-1)]";
                                    const music = musicMap.get(meta.music_id);
                                    return (
                                        <tr key={`${meta.music_id}-${meta.difficulty}`} className="group">
                                            {/* Every numeric cell is tabular: this table is read by
                                                comparing columns, which needs a fixed digit width. */}
                                            <td className={`hh-numeric px-3 py-3 font-mono text-[var(--hh-text-secondary)] text-center ${enableStickyColumns ? 'sticky left-0 z-10' : ''} border-r border-[var(--hh-border)] ${rowBgClass}`}>{meta.music_id}</td>
                                            <td className={`px-3 py-3 ${enableStickyColumns ? 'sticky left-[45px] sm:left-[60px] z-10' : ''} border-r border-[var(--hh-border)] ${rowBgClass}`}><DifficultyBadge musicId={meta.music_id} difficulty={meta.difficulty} /></td>
                                            <td className={`px-3 py-3 ${enableStickyColumns ? 'sticky left-[140px] sm:left-[200px] z-10' : ''} border-r border-[var(--hh-border)] ${rowBgClass}`}>
                                                <Link href={`/music/${meta.music_id}`} className="text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent-deep)] font-medium transition-colors line-clamp-1" title={music?.title}>
                                                    {music?.title || `Music ${meta.music_id}`}
                                                </Link>
                                            </td>
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{meta.music_time.toFixed(1)}</td>
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{meta.event_rate}%</td>
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta.base_score * 100).toFixed(2)}%</td>
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta.fever_score * 100).toFixed(2)}%</td>
                                            {modeFields.cycles && <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta[modeFields.cycles] as number).toFixed(1)}</td>}
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta[modeFields.score] as number).toFixed(1)}</td>
                                            <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta[modeFields.pt] as number).toFixed(1)}</td>
                                            {modeFields.hourly && <td className={`hh-numeric px-3 py-3 text-[var(--hh-text-secondary)] font-mono text-center ${rowBgClass}`}>{(meta[modeFields.hourly] as number).toFixed(1)}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination />
                </>
            )}

            {/* PSPI Explanation & Credits */}
            <PSPIExplanation />
            <CreditsSection />
        </div>
    );
}

function MusicMetaFallback() {
    const { t } = useI18n();

    return <>{t("page.musicMeta.loadingFallback")}</>;
}

export default function MusicMetaClient() {
    return (
        <MainLayout>
            <Suspense
                fallback={
                    <div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">
                        <MusicMetaFallback />
                    </div>
                }
            >
                <MusicMetaContent />
            </Suspense>
        </MainLayout>
    );
}
