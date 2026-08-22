"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import MainLayout from "@/components/MainLayout";
import MusicFilters from "@/components/music/MusicFilters";
import MusicItem from "@/components/music/MusicItem";
import { MUSIC_GRID_CLASS } from "@/components/music/music-layout";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { fetchMasterData } from "@/lib/fetch";
import {
    fetchLyricsIndex,
    getLyricsAvailableVersions,
    hasLyricsDetail,
    type ILyricsIndexEntry,
} from "@/lib/lyrics";
import { buildMusicAliasesById, LYRICS_ALIAS_INDEX_URL } from "@/lib/lyrics-aliases.mjs";
import { fetchLyricsMusicCatalog } from "@/lib/lyrics-music-source";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import type { IMusicInfo, IMusicTagInfo, MusicCategoryType, MusicTagType } from "@/types/music";

function LyricsContent() {
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();
    const { t } = useI18n();
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [eventMusicIds, setEventMusicIds] = useState<Set<number>>(new Set());
    const [lyricsByMusicId, setLyricsByMusicId] = useState<Map<number, ILyricsIndexEntry>>(new Map());
    const [musicAliasesById, setMusicAliasesById] = useState<Map<number, string[]>>(new Map());
    const [aliasIndexSettled, setAliasIndexSettled] = useState(false);
    const [selectedTag, setSelectedTag] = useState<MusicTagType>((searchParams.get("tag") as MusicTagType) || "all");
    const [selectedCategories, setSelectedCategories] = useState<MusicCategoryType[]>(
        () => (searchParams.get("categories")?.split(",") as MusicCategoryType[] | undefined) ?? [],
    );
    const [hasEventOnly, setHasEventOnly] = useState(searchParams.get("eventOnly") === "true");
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [now] = useState(() => Date.now());
    const [sortBy, setSortBy] = useState<"publishedAt" | "id">(
        searchParams.get("sortBy") === "id" ? "id" : "publishedAt",
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
        searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
    );
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const indexRequest = fetchLyricsIndex();
        Promise.all([
            indexRequest,
            fetchLyricsMusicCatalog(new Set()),
            fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
            fetchMasterData<{ musicId: number }[]>("eventMusics.json"),
        ])
            .then(([index, musicData, tags, eventMusics]) => {
                if (cancelled) return;
                setLyricsByMusicId(new Map(index.songs.map((item) => [item.musicId, item])));
                setMusics(musicData);
                setMusicTags(tags);
                setEventMusicIds(new Set(eventMusics.map((item) => item.musicId)));
                setError(null);
            })
            .catch(() => {
                if (!cancelled) setError(t("page.lyrics.error"));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, [t]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);

        // Aliases are optional and must not delay the primary lyrics catalog.
        void fetch(LYRICS_ALIAS_INDEX_URL, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
                return response.json() as Promise<unknown>;
            })
            .then((items) => {
                if (!cancelled) setMusicAliasesById(buildMusicAliasesById(items));
            })
            .catch(() => {
                // Keep title, creator, translation, and ID search available when
                // the optional shared index is temporarily unavailable.
            })
            .finally(() => {
                window.clearTimeout(timeout);
                if (!cancelled) setAliasIndexSettled(true);
            });

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedTag !== "all") params.set("tag", selectedTag);
        if (selectedCategories.length) params.set("categories", selectedCategories.join(","));
        if (hasEventOnly) params.set("eventOnly", "true");
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "publishedAt") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        replaceCurrentUrlSearchParams(params);
    }, [hasEventOnly, searchQuery, selectedCategories, selectedTag, sortBy, sortOrder]);

    const nonInstrumentalMusics = useMemo(
        () => musics.filter((music) => {
            const lyrics = lyricsByMusicId.get(music.id);
            return lyrics?.state !== "satisfied_no_lyrics";
        }),
        [lyricsByMusicId, musics],
    );

    const totalMusics = nonInstrumentalMusics.length;

    const filteredMusics = useMemo(() => {
        let result = nonInstrumentalMusics;
        if (selectedTag !== "all") {
            let matchingIds: Set<number>;
            if (selectedTag === "vocaloid") {
                const unitTags = new Set<MusicTagType>(["light_music_club", "idol", "street", "theme_park", "school_refusal"]);
                const unitMusicIds = new Set(musicTags.filter((tag) => unitTags.has(tag.musicTag)).map((tag) => tag.musicId));
                matchingIds = new Set(
                    musicTags
                        .filter((tag) => tag.musicTag === "vocaloid")
                        .map((tag) => tag.musicId)
                        .filter((musicId) => !unitMusicIds.has(musicId)),
                );
            } else {
                matchingIds = new Set(musicTags.filter((tag) => tag.musicTag === selectedTag).map((tag) => tag.musicId));
            }
            result = result.filter((music) => matchingIds.has(music.id));
        }
        if (selectedCategories.length) {
            result = result.filter((music) => selectedCategories.every((category) => music.categories.includes(category)));
        }
        if (hasEventOnly) result = result.filter((music) => eventMusicIds.has(music.id));
        if (deferredSearchQuery.trim()) {
            const query = deferredSearchQuery.trim().toLowerCase();
            const numericQuery = Number.parseInt(query, 10);
            result = result.filter((music) => {
                const indexEntry = lyricsByMusicId.get(music.id);
                const aliases = musicAliasesById.get(music.id);
                return music.id === numericQuery
                    || music.title.toLowerCase().includes(query)
                    || music.pronunciation.toLowerCase().includes(query)
                    || music.composer.toLowerCase().includes(query)
                    || music.lyricist.toLowerCase().includes(query)
                    || Boolean(indexEntry?.title["zh-CN"]?.toLowerCase().includes(query))
                    || Boolean(indexEntry?.title["en-US"]?.toLowerCase().includes(query))
                    || Boolean(aliases?.some((alias) => alias.toLowerCase().includes(query)));
            });
        }
        if (!isShowSpoiler) result = result.filter((music) => music.publishedAt <= now);
        return result.sort((left, right) => {
            const difference = sortBy === "id" ? left.id - right.id : left.publishedAt - right.publishedAt;
            return sortOrder === "asc" ? difference : -difference;
        });
    }, [deferredSearchQuery, eventMusicIds, hasEventOnly, isShowSpoiler, lyricsByMusicId, musicAliasesById, musicTags, nonInstrumentalMusics, now, selectedCategories, selectedTag, sortBy, sortOrder]);

    const waitingForAliasMatch = !isLoading
        && !aliasIndexSettled
        && deferredSearchQuery.trim() !== ""
        && filteredMusics.length === 0;
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "lyrics",
        defaultDisplayCount: 30,
        increment: 30,
        maxRestoredDisplayCount: 90,
        isReady: !isLoading && (deferredSearchQuery.trim() === "" || aliasIndexSettled),
    });

    const resetFilters = () => {
        setSelectedTag("all");
        setSelectedCategories([]);
        setHasEventOnly(false);
        setSearchQuery("");
        setSortBy("publishedAt");
        setSortOrder("desc");
        resetDisplayCount();
    };

    const quickFilterContent = (
        <MusicFilters
            title={t("page.lyrics.filterTitle")}
            countUnit={t("page.lyrics.countUnit")}
            searchPlaceholder={t("page.lyrics.searchPlaceholder")}
            selectedTag={selectedTag}
            onTagChange={(tag) => {
                setSelectedTag(tag);
                resetDisplayCount();
            }}
            selectedCategories={selectedCategories}
            onCategoryChange={(categories) => {
                setSelectedCategories(categories);
                resetDisplayCount();
            }}
            hasEventOnly={hasEventOnly}
            onHasEventOnlyChange={(eventOnly) => {
                setHasEventOnly(eventOnly);
                resetDisplayCount();
            }}
            searchQuery={searchQuery}
            onSearchChange={(query) => {
                setSearchQuery(query);
                resetDisplayCount();
            }}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(nextSort, nextOrder) => {
                setSortBy(nextSort === "id" ? "id" : "publishedAt");
                setSortOrder(nextOrder);
                resetDisplayCount();
            }}
            customSortOptions={[
                { id: "publishedAt", label: t("common.filter.sortByPublishedAt") },
                { id: "id", label: t("common.filter.sortById") },
            ]}
            onReset={resetFilters}
            totalMusics={totalMusics}
            filteredMusics={filteredMusics.length}
        />
    );

    useQuickFilter(t("page.lyrics.filterTitle"), quickFilterContent, [
        selectedTag,
        selectedCategories,
        hasEventOnly,
        searchQuery,
        sortBy,
        sortOrder,
        totalMusics,
        filteredMusics.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.lyrics.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.lyrics.title")} <span className="text-miku">{t("page.lyrics.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto">{t("page.lyrics.description")}</p>
            </div>

            {error && (
                <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-300">
                    <p className="font-bold">{t("common.state.loadingFailed")}</p>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-2 text-red-500 underline hover:no-underline dark:text-red-300">
                        {t("common.action.retry")}
                    </button>
                </div>
            )}

            {/* Filters live in the global FilterDrawer (registered above via
                useQuickFilter), so the page body is a single column. */}
            <section className="min-w-0" aria-label={t("page.lyrics.title")}>
                {isLoading || waitingForAliasMatch ? (
                    <div className={MUSIC_GRID_CLASS} aria-label={t("page.lyrics.loading")}>
                        {Array.from({ length: 15 }).map((_, index) => (
                            <div key={index} className="animate-pulse">
                                <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/60 dark:border-slate-700/60 dark:bg-slate-800/60">
                                    <div className="aspect-square bg-slate-200 dark:bg-slate-700" />
                                    <div className="space-y-2 p-3">
                                        <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                                        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredMusics.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="mb-4 text-6xl" aria-hidden="true">🎼</div>
                        <h3 className="mb-2 text-xl font-bold text-slate-600 dark:text-slate-300">{t("page.lyrics.empty")}</h3>
                        <p className="text-slate-500 dark:text-slate-400">{t("page.lyrics.emptyHint")}</p>
                    </div>
                ) : (
                    <>
                        <div className={MUSIC_GRID_CLASS}>
                            {filteredMusics.slice(0, displayCount).map((music) => {
                                const lyrics = lyricsByMusicId.get(music.id);
                                const hasDetail = lyrics ? hasLyricsDetail(lyrics) : false;
                                const versions = lyrics ? getLyricsAvailableVersions(lyrics) : [];
                                const versionLabel = !hasDetail
                                    ? "page.lyrics.inProgressBadge"
                                    : versions.length === 1 && versions[0] === "game"
                                        ? "page.lyrics.versionGame"
                                        : versions.length === 2 ? "page.lyrics.versionFullAndGame" : "page.lyrics.versionFull";
                                return (
                                    <div key={music.id} className="min-w-0">
                                        <MusicItem
                                            music={music}
                                            isSpoiler={music.publishedAt > now}
                                            cnTitle={lyrics?.title["zh-CN"]}
                                            enTitle={lyrics?.title["en-US"]}
                                            hrefBase="/lyrics"
                                            jacketTopLeftLabel={t(versionLabel)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {displayCount < filteredMusics.length ? (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={loadMore}
                                    data-shortcut-load-more="true"
                                    className="pressable ios-glass-btn ios-glass-btn-primary rounded-full px-8 py-3 font-bold"
                                >
                                    {t("page.lyrics.loadMore")}
                                    <span className="ml-2 text-sm opacity-80 type-caption">
                                        ({Math.min(displayCount, filteredMusics.length)} / {filteredMusics.length})
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-8 text-center text-sm text-slate-400">
                                {t("page.lyrics.allLoaded", { count: String(filteredMusics.length) })}
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}

export default function LyricsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><div className="loading-spinner" /></div>}>
                <LyricsContent />
            </Suspense>
        </MainLayout>
    );
}
