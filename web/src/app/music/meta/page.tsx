"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

// Music Meta API URL
const MUSIC_META_API = "https://assets.exmeaning.com/musicmeta/music_metas.json";

// Items per page options
const PAGE_SIZE_OPTIONS = [20, 50, 100];

// Mode options
type LiveMode = "auto" | "solo" | "multi";
const LIVE_MODE_OPTIONS: { value: LiveMode; label: string }[] = [
    { value: "multi", label: "协力LIVE" },
    { value: "solo", label: "单人LIVE" },
    { value: "auto", label: "自动LIVE" },
];

// View mode
type ViewMode = "overview" | "detailed";

// Mode-specific ranking categories
interface RankingCategory {
    id: string;
    title: string;
    subtitle: string;
    field: keyof IMusicMeta;
    format: (val: number) => string;
    dedupeBySong?: boolean;
    hideDifficulty?: boolean;
}

const getRankingCategories = (mode: LiveMode): RankingCategory[] => {
    const base: RankingCategory[] = [];

    if (mode === "multi") {
        base.push(
            { id: "hourly", title: "时速榜", subtitle: "PSPI", field: "pspi_pt_per_hour_multi", format: (v) => v.toFixed(1) },
            { id: "score", title: "得分榜", subtitle: "PSPI", field: "pspi_multi_score", format: (v) => v.toFixed(1) },
            { id: "pt", title: "单局PT榜", subtitle: "PSPI", field: "pspi_multi_pt_max", format: (v) => v.toFixed(1) },
            { id: "cycles", title: "周回榜", subtitle: "次/小时", field: "cycles_multi", format: (v) => v.toFixed(1), dedupeBySong: true, hideDifficulty: true },
        );
    } else if (mode === "solo") {
        base.push(
            { id: "score", title: "得分榜", subtitle: "PSPI", field: "pspi_solo_score", format: (v) => v.toFixed(1) },
            { id: "pt", title: "单局PT榜", subtitle: "PSPI", field: "pspi_solo_pt_max", format: (v) => v.toFixed(1) },
        );
    } else {
        base.push(
            { id: "hourly", title: "时速榜", subtitle: "PSPI", field: "pspi_pt_per_hour_auto", format: (v) => v.toFixed(1) },
            { id: "score", title: "得分榜", subtitle: "PSPI", field: "pspi_auto_score", format: (v) => v.toFixed(1) },
            { id: "pt", title: "单局PT榜", subtitle: "PSPI", field: "pspi_auto_pt_max", format: (v) => v.toFixed(1) },
            { id: "cycles", title: "周回榜", subtitle: "次/小时", field: "cycles_auto", format: (v) => v.toFixed(1), dedupeBySong: true, hideDifficulty: true },
        );
    }

    return base;
};

// Rank colors for top 3
const getRankColor = (rank: number): string => {
    if (rank === 1) return "text-yellow-500"; // Gold
    if (rank === 2) return "text-slate-400"; // Silver
    if (rank === 3) return "text-amber-600"; // Bronze
    return "text-slate-300";
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
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
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
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
        } catch (e) {
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

        const queryString = params.toString();
        const newUrl = queryString ? `/music/meta?${queryString}` : "/music/meta";
        router.replace(newUrl, { scroll: false });
    }, [viewMode, liveMode, expandedRankings, sortField, sortOrder, searchQuery, currentPage, pageSize, router, filtersInitialized]);

    // Fetch data
    useEffect(() => {
        document.title = "Snowy SekaiViewer 歌曲Meta";
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
                <div className="relative rounded-xl overflow-hidden bg-white/80 border border-slate-200/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex">
                    {/* Cover Image - Smaller */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden">
                        {music && (
                            <Image
                                src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                alt={music.title}
                                fill
                                sizes="96px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                unoptimized
                            />
                        )}

                        {/* Difficulty Badge - Only show if not hidden */}
                        {!category.hideDifficulty && (
                            <div
                                className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow"
                                style={{ backgroundColor: diffColor }}
                            >
                                {diffName} {level}
                            </div>
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 p-2 sm:p-3 flex flex-col justify-center min-w-0">
                        <h3 className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors">
                            {music?.title || `Music ${meta.music_id}`}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                            {music?.composer}
                            {music?.composer !== music?.arranger && music?.arranger !== "-" && ` / ${music?.arranger}`}
                        </p>
                        {/* PSPI Score */}
                        <div className="mt-1.5 flex items-baseline gap-1">
                            <span className="text-lg font-black text-miku">{category.format(value)}</span>
                            <span className="text-[10px] text-slate-400">{category.subtitle}</span>
                        </div>
                    </div>

                    {/* Rank Badge - Bottom Right Corner, Large with special colors */}
                    <div className={`absolute bottom-2 right-2 font-black text-2xl sm:text-3xl select-none ${getRankColor(rank)}`}>
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
                        <span className="w-1 h-6 bg-miku rounded-full"></span>
                        <h2 className="text-lg font-bold text-primary-text">{category.title}</h2>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{category.subtitle}</span>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            toggleRankingExpand(category.id);
                        }}
                        className="text-xs text-slate-500 hover:text-miku transition-colors px-3 py-1 rounded-lg hover:bg-slate-100"
                    >
                        {isExpanded ? "收起" : "展开更多"}
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
            className={`px-3 py-3 ${center ? "text-center" : "text-left"} cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap bg-slate-50 ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className={`flex flex-col ${center ? "items-center" : "items-start"}`}>
                <span className="text-sm font-bold text-slate-700">
                    {main}
                    {sortField === field && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </span>
                {sub && <span className="text-xs text-slate-400">{sub}</span>}
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
                <span className="w-[85px] sm:w-[120px] px-2 py-0.5 rounded text-xs font-bold text-white inline-flex items-center justify-center gap-1 shadow-sm" style={{ backgroundColor: color }}>
                    <span className="hidden sm:inline">{name}</span>
                    <span className="opacity-90">Lv.{level}</span>
                </span>
            </div>
        );
    };

    // Pagination Component
    const Pagination = () => (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4 px-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>每页</span>
                <select value={pageSize} onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                }} className="px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-miku/50">
                    {PAGE_SIZE_OPTIONS.map((size) => (<option key={size} value={size}>{size}</option>))}
                </select>
                <span>条</span>
                <span className="text-slate-400 ml-2">共 {filteredMetas.length} 条</span>
            </div>
            <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">首页</button>
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">上</button>
                <span className="px-3 py-1 text-sm text-slate-600 font-mono">{currentPage}/{totalPages || 1}</span>
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">下</button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages} className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50">末页</button>
            </div>
        </div>
    );

    // PSPI Explanation Section
    const PSPIExplanation = () => (
        <div className="mt-12 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
            <h2 className="text-lg font-bold text-primary-text mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-miku rounded-full"></span>
                关于 PSPI基准得分
            </h2>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                <p>
                    <strong>PSPI基准得分</strong> 通过采用一个基准队伍游玩easy难度的Tell Your World歌曲的活动得分/活动pt计为1000分。
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-slate-100">
                        <h3 className="font-bold text-slate-700 mb-2">基准队伍定义</h3>
                        <ul className="space-y-1 text-sm">
                            <li>Solo/Auto: 250000综合力，车头120倍率，技能100%</li>
                            <li>协力: 250000综合力，车头200倍率，队友200倍率</li>
                        </ul>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-slate-100">
                        <h3 className="font-bold text-slate-700 mb-2">周回计算</h3>
                        <ul className="space-y-1 text-sm">
                            <li>自动周回间隔: 35秒</li>
                            <li>多人周回间隔: 45秒</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );

    // Credits Section
    const CreditsSection = () => (
        <div className="mt-8 py-6 border-t border-slate-100 text-center">
            <div className="text-sm text-slate-400 mb-2">数据来源与鸣谢</div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
                <a href="https://github.com/Sekai-World/sekai-viewer" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-miku transition-colors">Sekai-World/sekai-viewer</a>
                <a href="https://3-3.dev/" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-miku transition-colors">xfl03</a>
                <a href="https://github.com/NeuraXmy" target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-miku transition-colors">Luna茶</a>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">歌曲元数据</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text mb-3">
                    歌曲 <span className="text-miku">Meta</span>
                </h1>
                <p className="text-slate-500 max-w-2xl mx-auto text-sm">
                    包含PSPI基准得分、周回效率等活动相关数据
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8">
                {/* Live Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {LIVE_MODE_OPTIONS.map((option) => (
                        <button
                            type="button"
                            key={option.value}
                            onClick={() => setLiveMode(option.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${liveMode === option.value
                                ? "bg-white text-miku shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setViewMode("overview")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "overview" ? "bg-white text-miku shadow-sm" : "text-slate-500 hover:text-slate-900"
                            }`}
                    >
                        简明
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("detailed")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "detailed" ? "bg-white text-miku shadow-sm" : "text-slate-500 hover:text-slate-900"
                            }`}
                    >
                        详细
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">数据加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div className="flex h-[30vh] w-full items-center justify-center text-slate-500 flex-col gap-3">
                    <div className="w-8 h-8 border-4 border-miku/30 border-t-miku rounded-full animate-spin" />
                    <p>正在加载数据...</p>
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
                    <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between sticky top-[4.5rem] z-30 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="relative w-full sm:max-w-md">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="搜索歌曲ID或名称..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-miku/50"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead className="bg-slate-50">
                                <tr>
                                    <TableHeader field="music_id" main="ID" center className={`${enableStickyColumns ? 'sticky left-0 z-20' : ''} border-r border-slate-200/60 w-[45px] min-w-[45px] sm:w-[60px]`} />
                                    <TableHeader field="difficulty" main="难度" center className={`${enableStickyColumns ? 'sticky left-[45px] sm:left-[60px] z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]' : ''} border-r border-slate-200/60 w-[95px] min-w-[95px] sm:w-[140px]`} />
                                    <th className={`px-3 py-3 text-left text-sm font-bold text-slate-700 min-w-[180px] ${enableStickyColumns ? 'sticky left-[140px] sm:left-[200px] z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]' : ''} bg-slate-50 border-r border-slate-200/60`}>歌曲名称</th>
                                    <TableHeader field="music_time" main="时长" sub="秒" center className="w-[80px]" />
                                    <TableHeader field="event_rate" main="活动PT倍率" center className="w-[100px]" />
                                    <TableHeader field="base_score" main="基础分" center className="min-w-[100px]" />
                                    <TableHeader field="fever_score" main="Fever" center className="min-w-[100px]" />
                                    {modeFields.cycles && <TableHeader field={modeFields.cycles} main="周回" sub="基准周回" center className="min-w-[90px]" />}
                                    <TableHeader field={modeFields.score} main="得分" sub="PSPI" center className="min-w-[100px]" />
                                    <TableHeader field={modeFields.pt} main="活动PT" sub="PSPI" center className="min-w-[100px]" />
                                    {modeFields.hourly && <TableHeader field={modeFields.hourly} main="时速" sub="PSPI" center className="min-w-[100px]" />}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedMetas.map((meta, idx) => {
                                    const rowBgClass = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
                                    const music = musicMap.get(meta.music_id);
                                    return (
                                        <tr key={`${meta.music_id}-${meta.difficulty}`} className="hover:bg-slate-50 transition-colors group">
                                            <td className={`px-3 py-3 font-mono text-slate-500 text-center ${enableStickyColumns ? 'sticky left-0 z-10' : ''} border-r border-slate-200/60 ${rowBgClass}`}>{meta.music_id}</td>
                                            <td className={`px-3 py-3 ${enableStickyColumns ? 'sticky left-[45px] sm:left-[60px] z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]' : ''} border-r border-slate-200/60 ${rowBgClass}`}><DifficultyBadge musicId={meta.music_id} difficulty={meta.difficulty} /></td>
                                            <td className={`px-3 py-3 ${enableStickyColumns ? 'sticky left-[140px] sm:left-[200px] z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]' : ''} border-r border-slate-200/60 ${rowBgClass}`}>
                                                <Link href={`/music/${meta.music_id}`} className="text-slate-700 group-hover:text-miku font-medium transition-colors line-clamp-1" title={music?.title}>
                                                    {music?.title || `Music ${meta.music_id}`}
                                                </Link>
                                            </td>
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{meta.music_time.toFixed(1)}</td>
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{meta.event_rate}%</td>
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta.base_score * 100).toFixed(2)}%</td>
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta.fever_score * 100).toFixed(2)}%</td>
                                            {modeFields.cycles && <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta[modeFields.cycles] as number).toFixed(1)}</td>}
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta[modeFields.score] as number).toFixed(1)}</td>
                                            <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta[modeFields.pt] as number).toFixed(1)}</td>
                                            {modeFields.hourly && <td className={`px-3 py-3 text-slate-600 font-mono text-center ${rowBgClass}`}>{(meta[modeFields.hourly] as number).toFixed(1)}</td>}
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

export default function MusicMetaPage() {
    return (
        <MainLayout activeNav="歌曲Meta">
            <Suspense
                fallback={
                    <div className="flex h-[50vh] w-full items-center justify-center text-slate-500">
                        正在加载歌曲Meta...
                    </div>
                }
            >
                <MusicMetaContent />
            </Suspense>
        </MainLayout>
    );
}
