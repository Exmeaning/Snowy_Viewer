"use client";
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
    IMusicInfo,
    IMusicCategoryInfo,
    MusicTagType,
    MusicCategoryType,
    IMusicTagInfo,
    IMusicMeta,
    normalizeMusicsData,
} from "@/types/music";
import { fetchMasterData, fetchMusicMetas } from "@/lib/fetch";
import { getMusicJacketUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { loadTranslations, TranslationData } from "@/lib/translations";
import SelectorModal from "./SelectorModal";
import MusicFilters from "@/components/music/MusicFilters";

/** Sort options for MusicSelector (no level/constant since there's no difficulty context) */
const SELECTOR_SORT_OPTION_IDS = ["publishedAt", "id"] as const;

interface MusicSelectorProps {
    selectedMusicId: string;
    onSelect: (musicId: string) => void;
    /** Show recommended picks section (default: true) */
    showRecommendations?: boolean;
    recommendMode?: "event" | "challenge";
    liveType?: string;
}

interface RecommendationItem {
    music: IMusicInfo;
    meta: IMusicMeta;
    value: number;
    rank: number;
    isPinned?: boolean;
}

interface RecommendationCategory {
    key: "efficiency" | "pt" | "score";
    titleKey: string;
    descKey: string;
    unit: string;
    accentColor: string;
    items: RecommendationItem[];
}

export default function MusicSelector({
    selectedMusicId,
    onSelect,
    showRecommendations = true,
    recommendMode: _recommendMode = "event",
    liveType = "multi",
}: MusicSelectorProps) {
    const { assetSource, isShowSpoiler } = useTheme();
    const { t } = useI18n();
    const [now] = useState(() => Date.now());
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [musicMetas, setMusicMetas] = useState<IMusicMeta[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    // View mode: "recommend" (vertical 3 categories) vs "all" (detailed search & filter)
    const [userViewMode, setUserViewMode] = useState<"recommend" | "all">("recommend");
    const viewMode = !showRecommendations ? "all" : userViewMode;
    const setViewMode = (mode: "recommend" | "all") => setUserViewMode(mode);

    const [displayCount, setDisplayCount] = useState(30);

    // Filters state
    const [selectedTag, setSelectedTag] = useState<MusicTagType>("all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>([]);
    const [hasEventOnly, setHasEventOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "publishedAt">("publishedAt");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const selectorSortOptions = useMemo(() => {
        return SELECTOR_SORT_OPTION_IDS.map((id) => ({
            id,
            label: t(id === "publishedAt" ? "page.deckRecommend.selector.sortByPublishedAt" : "page.deckRecommend.selector.sortById"),
        }));
    }, [t]);

    // Normalize liveType for meta lookup
    const metaMode = useMemo(() => {
        if (liveType === "multi" || liveType === "cheerful") return "multi";
        if (liveType === "auto") return "auto";
        if (liveType === "solo") return "solo";
        return "multi";
    }, [liveType]);

    // Load musics, tags, and music metas on mount
    useEffect(() => {
        const fetches: Promise<unknown>[] = [
            fetchMasterData<IMusicInfo[]>("musics.json"),
            fetchMasterData<IMusicCategoryInfo[]>("musicCategories.json").catch(() => [] as IMusicCategoryInfo[]),
            fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
            loadTranslations(),
        ];
        if (showRecommendations) {
            fetches.push(
                fetchMusicMetas().catch((err) => {
                    console.error("Failed to fetch music meta", err);
                    return [];
                })
            );
        }
        Promise.all(fetches)
            .then(([musicsData, categoriesData, tagsData, translationsData, metasData]) => {
                const rawMusics = musicsData as IMusicInfo[];
                const rawCats = categoriesData as IMusicCategoryInfo[];
                const normalizedMusics = normalizeMusicsData(rawMusics, rawCats);
                setMusics(normalizedMusics);
                setMusicTags(tagsData as IMusicTagInfo[]);
                setTranslations(translationsData as TranslationData);
                if (metasData) setMusicMetas(metasData as IMusicMeta[]);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load musics", err);
                setLoading(false);
            });
    }, [showRecommendations]);

    // Vertically arranged recommended categories: Efficiency, PT, Score
    const recommendationCategories = useMemo<RecommendationCategory[]>(() => {
        if (!showRecommendations || !musics.length || !musicMetas.length) return [];

        const buildCategory = (
            key: "efficiency" | "pt" | "score",
            titleKey: string,
            descKey: string,
            unit: string,
            accentColor: string,
            sortField: keyof IMusicMeta,
            pinnedIds: number[] = [],
            maxItems: number = 3
        ): RecommendationCategory => {
            const sortedMetas = [...musicMetas].sort(
                (a, b) => ((b[sortField] as number) || 0) - ((a[sortField] as number) || 0)
            );

            const rankMap = new Map<number, number>();
            let currentRank = 1;
            const seenRank = new Set<number>();
            for (const meta of sortedMetas) {
                if (!seenRank.has(meta.music_id)) {
                    seenRank.add(meta.music_id);
                    rankMap.set(meta.music_id, currentRank++);
                }
            }

            const seen = new Set<number>();
            const items: RecommendationItem[] = [];

            const addItem = (id: number, isPinned: boolean = false) => {
                if (seen.has(id)) return;
                const meta = sortedMetas.find((m) => m.music_id === id) || musicMetas.find((m) => m.music_id === id);
                if (meta) {
                    const music = musics.find((m) => m.id === id);
                    if (music) {
                        seen.add(id);
                        items.push({
                            music,
                            meta,
                            value: (meta[sortField] as number) || 0,
                            rank: rankMap.get(id) || 999,
                            isPinned,
                        });
                    }
                }
            };

            for (const pid of pinnedIds) {
                addItem(pid, true);
            }

            for (const meta of sortedMetas) {
                if (items.length >= maxItems) break;
                addItem(meta.music_id);
            }

            return { key, titleKey, descKey, unit, accentColor, items };
        };

        const categories: RecommendationCategory[] = [];

        // 1. Efficiency (hidden in solo mode)
        if (metaMode !== "solo") {
            const effField: keyof IMusicMeta =
                metaMode === "auto" ? "pspi_pt_per_hour_auto" : "pspi_pt_per_hour_multi";
            categories.push(
                buildCategory(
                    "efficiency",
                    "page.deckRecommend.selector.recommendationEfficiency",
                    "page.deckRecommend.selector.recommendationEfficiencyDesc",
                    "PSPI/h",
                    "bg-cyan-500",
                    effField,
                    [],
                    3
                )
            );
        }

        // 2. PT
        const ptField: keyof IMusicMeta =
            metaMode === "solo"
                ? "pspi_solo_pt_max"
                : metaMode === "auto"
                ? "pspi_auto_pt_max"
                : "pspi_multi_pt_max";
        const pinnedPt = metaMode === "multi" ? [226, 448] : [];
        categories.push(
            buildCategory(
                "pt",
                "page.deckRecommend.selector.recommendationPt",
                "page.deckRecommend.selector.recommendationPtDesc",
                "PSPI",
                "bg-emerald-500",
                ptField,
                pinnedPt,
                3
            )
        );

        // 3. Score
        const scoreField: keyof IMusicMeta =
            metaMode === "solo"
                ? "pspi_solo_score"
                : metaMode === "auto"
                ? "pspi_auto_score"
                : "pspi_multi_score";
        categories.push(
            buildCategory(
                "score",
                "page.deckRecommend.selector.recommendationScore",
                "page.deckRecommend.selector.recommendationScoreDesc",
                "PSPI",
                "bg-amber-500",
                scoreField,
                [],
                3
            )
        );

        return categories;
    }, [showRecommendations, musics, musicMetas, metaMode]);

    // Filter musics
    const filteredMusics = useMemo(() => {
        let result = [...musics];

        // Tag filter
        if (selectedTag !== "all") {
            const validIds = new Set(
                musicTags
                    .filter((t) => t.musicTag === selectedTag)
                    .map((t) => t.musicId)
            );
            result = result.filter((m) => validIds.has(m.id));
        }

        // Category filter
        if (selectedCategories.length > 0) {
            result = result.filter((m) =>
                (m.categories ?? []).some((cat) => selectedCategories.includes(cat))
            );
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((m) => {
                if (m.id.toString().includes(q)) return true;
                if (m.title.toLowerCase().includes(q)) return true;
                const chineseTitle = translations?.music?.title?.[m.title];
                if (chineseTitle && chineseTitle.toLowerCase().includes(q)) return true;
                if (m.lyricist.toLowerCase().includes(q)) return true;
                if (m.composer.toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            result = result.filter((m) => m.publishedAt <= now);
        }

        // Sort
        result.sort((a, b) => {
            const valA = a[sortBy];
            const valB = b[sortBy];
            return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });

        return result;
    }, [musics, musicTags, selectedTag, selectedCategories, searchQuery, sortBy, sortOrder, translations, isShowSpoiler, now]);

    // Get currently selected music object
    const selectedMusic = useMemo(() => {
        if (!selectedMusicId) return null;
        return musics.find((m) => m.id.toString() === selectedMusicId) || null;
    }, [musics, selectedMusicId]);

    const handleSelect = (music: IMusicInfo) => {
        onSelect(music.id.toString());
        setModalOpen(false);
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("page.deckRecommend.selector.music")} <span className="text-red-400">*</span>
            </label>

            <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-miku/50 transition-all text-left shadow-sm group"
            >
                {selectedMusic ? (
                    <>
                        <div className="relative w-16 aspect-square bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                            <Image
                                src={getMusicJacketUrl(selectedMusic.assetbundleName, assetSource)}
                                alt={selectedMusic.title}
                                fill
                                className="object-cover"
                                unoptimized
                                loading="lazy"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 rounded-md">
                                    #{selectedMusic.id}
                                </span>
                            </div>
                            <div className="text-sm font-bold text-slate-700 truncate group-hover:text-miku transition-colors">
                                {selectedMusic.title}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                                {selectedMusic.lyricist} / {selectedMusic.composer}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <span className="text-slate-400 text-sm">{t("page.deckRecommend.selector.selectMusicPlaceholder")}</span>
                    </>
                )}
                <div className="text-slate-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </div>
            </button>

            <SelectorModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={t("page.deckRecommend.selector.selectMusicTitle")}
            >
                <div className="space-y-4">
                    {/* Header Switcher */}
                    {showRecommendations && (
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="text-xs text-slate-500 font-medium">
                                {viewMode === "recommend"
                                    ? t("page.deckRecommend.selector.basedOnMode", {
                                          mode:
                                              liveType === "cheerful"
                                                  ? "Multi"
                                                  : liveType.charAt(0).toUpperCase() + liveType.slice(1),
                                      })
                                    : t("page.deckRecommend.selector.music")}
                            </div>
                            {viewMode === "recommend" ? (
                                <button
                                    type="button"
                                    onClick={() => setViewMode("all")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-miku bg-miku/10 hover:bg-miku/20 rounded-lg transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {t("page.deckRecommend.selector.switchToAll", { count: musics.length })}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setViewMode("recommend")}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    {t("page.deckRecommend.selector.switchToRecommend")}
                                </button>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 text-center text-slate-400">{t("common.state.loading")}</div>
                    ) : viewMode === "recommend" && showRecommendations ? (
                        /* Recommendations View: Vertical layout with Efficiency, PT, and Score */
                        <div className="space-y-5">
                            {recommendationCategories.map((category) => (
                                <div
                                    key={category.key}
                                    className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-4 transition-all"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-4 ${category.accentColor} rounded-full`} />
                                            <h3 className="text-sm font-bold text-slate-800">
                                                {t(category.titleKey)}
                                            </h3>
                                        </div>
                                        <span className="text-xs text-slate-400 sm:text-right">
                                            {t(category.descKey)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {category.items.map((item) => (
                                            <div
                                                key={`${category.key}-${item.music.id}`}
                                                onClick={() => handleSelect(item.music)}
                                                className="cursor-pointer bg-white rounded-xl border border-slate-200 hover:border-miku/60 hover:shadow-md transition-all active:scale-[0.99] flex items-center gap-3 p-2.5 group"
                                            >
                                                {/* Rank Badge */}
                                                <div
                                                    className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-lg border ${
                                                        item.rank === 1
                                                            ? "border-amber-300 bg-amber-50 text-amber-700 font-black"
                                                            : item.rank === 2
                                                            ? "border-slate-300 bg-slate-100 text-slate-700 font-bold"
                                                            : item.rank === 3
                                                            ? "border-amber-700/30 bg-amber-100/60 text-amber-800 font-bold"
                                                            : "border-slate-200 bg-slate-50 text-slate-500"
                                                    }`}
                                                >
                                                    #{item.rank}
                                                </div>

                                                {/* Jacket */}
                                                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                                                    <Image
                                                        src={getMusicJacketUrl(item.music.assetbundleName, assetSource)}
                                                        alt={item.music.title}
                                                        fill
                                                        className="object-cover"
                                                        unoptimized
                                                        loading="lazy"
                                                    />
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                                            #{item.music.id}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-800 truncate group-hover:text-miku transition-colors">
                                                        {item.music.title}
                                                    </div>
                                                    {translations?.music?.title?.[item.music.title] && (
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {translations.music.title[item.music.title]}
                                                        </div>
                                                    )}
                                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                                        {item.music.composer}
                                                    </div>
                                                </div>

                                                {/* Value */}
                                                <div className="text-right flex-shrink-0 pl-1">
                                                    <div className="text-sm font-black text-miku font-mono">
                                                        {item.value.toFixed(0)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        {category.unit}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Switch to detailed view button banner */}
                            <div className="pt-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("all")}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-miku bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all shadow-sm group"
                                >
                                    <span>{t("page.deckRecommend.selector.viewAllNotice")}</span>
                                    <svg
                                        className="w-4 h-4 text-slate-400 group-hover:text-miku transition-colors"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Detailed View: Filter + Search + Paginated All Songs */
                        <div className="space-y-6">
                            <MusicFilters
                                selectedTag={selectedTag}
                                onTagChange={(tag) => {
                                    setSelectedTag(tag);
                                    setDisplayCount(30);
                                }}
                                selectedCategories={selectedCategories}
                                onCategoryChange={(cats) => {
                                    setSelectedCategories(cats);
                                    setDisplayCount(30);
                                }}
                                hasEventOnly={hasEventOnly}
                                onHasEventOnlyChange={(val) => {
                                    setHasEventOnly(val);
                                    setDisplayCount(30);
                                }}
                                searchQuery={searchQuery}
                                onSearchChange={(q) => {
                                    setSearchQuery(q);
                                    setDisplayCount(30);
                                }}
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                onSortChange={(nextSortBy, nextSortOrder) => {
                                    if (nextSortBy === "level" || nextSortBy === "constant" || nextSortBy === "bpm") return;
                                    setSortBy(nextSortBy as "id" | "publishedAt");
                                    setSortOrder(nextSortOrder);
                                    setDisplayCount(30);
                                }}
                                customSortOptions={selectorSortOptions}
                                onReset={() => {
                                    setSelectedTag("all");
                                    setSelectedCategories([]);
                                    setHasEventOnly(false);
                                    setSearchQuery("");
                                    setSortBy("publishedAt");
                                    setSortOrder("desc");
                                    setDisplayCount(30);
                                }}
                                totalMusics={musics.length}
                                filteredMusics={filteredMusics.length}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filteredMusics.slice(0, displayCount).map((music) => (
                                    <div
                                        key={music.id}
                                        onClick={() => handleSelect(music)}
                                        className="cursor-pointer"
                                    >
                                        <MusicSelectionItem music={music} translations={translations} />
                                    </div>
                                ))}

                                {filteredMusics.length > displayCount && (
                                    <div className="col-span-full py-4 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setDisplayCount((prev) => prev + 30)}
                                            className="px-6 py-2.5 text-xs font-semibold text-miku bg-miku/10 hover:bg-miku/20 rounded-xl transition-colors"
                                        >
                                            {t("page.deckRecommend.selector.loadMore", {
                                                loaded: Math.min(displayCount, filteredMusics.length),
                                                total: filteredMusics.length,
                                            })}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </SelectorModal>
        </div>
    );
}

// Simplified MusicItem for selection
function MusicSelectionItem({ music, translations }: { music: IMusicInfo; translations: TranslationData | null }) {
    const { assetSource } = useTheme();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);

    return (
        <div className="group bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden transition-all hover:shadow-md hover:ring-miku/50 active:scale-[0.98] flex items-center gap-3 p-2">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                <Image
                    src={jacketUrl}
                    alt={music.title}
                    fill
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <div className="text-xs font-mono text-slate-400 bg-slate-50 px-1 rounded">
                        #{music.id}
                    </div>
                    {/* Categories Badges */}
                    <div className="flex gap-1">
                        {(music.categories ?? []).includes("mv") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="3D MV" />
                        )}
                        {(music.categories ?? []).includes("mv_2d") && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="2D MV" />
                        )}
                    </div>
                </div>

                <h3 className="font-bold text-slate-700 text-sm line-clamp-1 group-hover:text-miku transition-colors custom-font-jp">
                    {music.title}
                </h3>
                {translations?.music?.title?.[music.title] && (
                    <div className="text-xs text-slate-500 line-clamp-1 mb-0.5">
                        {translations.music.title[music.title]}
                    </div>
                )}

                <div className="text-xs text-slate-400 line-clamp-1">
                    {music.composer}
                </div>
            </div>
        </div>
    );
}
