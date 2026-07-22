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
import { fetchMasterData } from "@/lib/fetch";
import { fetchLyricsIndex, type ILyricsIndexEntry } from "@/lib/lyrics";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import type { IMusicInfo, IMusicTagInfo, MusicCategoryType, MusicTagType } from "@/types/music";

type RawMusicCategory = MusicCategoryType | { musicCategoryName: MusicCategoryType };

function LyricsContent() {
    const searchParams = useSearchParams();
    const { isShowSpoiler } = useTheme();
    const { t } = useI18n();
    const [musics, setMusics] = useState<IMusicInfo[]>([]);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [eventMusicIds, setEventMusicIds] = useState<Set<number>>(new Set());
    const [lyricsByMusicId, setLyricsByMusicId] = useState<Map<number, ILyricsIndexEntry>>(new Map());
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

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "lyrics",
        defaultDisplayCount: 30,
        increment: 30,
        isReady: !isLoading,
    });

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetchLyricsIndex(),
            fetchMasterData<IMusicInfo[]>("musics.json"),
            fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
            fetchMasterData<{ musicId: number }[]>("eventMusics.json"),
        ])
            .then(([index, musicData, tags, eventMusics]) => {
                if (cancelled) return;
                setLyricsByMusicId(new Map(index.songs.map((item) => [item.musicId, item])));
                setMusics(musicData.map((music) => ({
                    ...music,
                    categories: (music.categories as unknown as RawMusicCategory[]).map((category) =>
                        typeof category === "object" && category !== null && "musicCategoryName" in category
                            ? category.musicCategoryName
                            : category
                    ),
                })));
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
        const params = new URLSearchParams();
        if (selectedTag !== "all") params.set("tag", selectedTag);
        if (selectedCategories.length) params.set("categories", selectedCategories.join(","));
        if (hasEventOnly) params.set("eventOnly", "true");
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "publishedAt") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        replaceCurrentUrlSearchParams(params);
    }, [hasEventOnly, searchQuery, selectedCategories, selectedTag, sortBy, sortOrder]);

    const filteredMusics = useMemo(() => {
        let result = musics.filter((music) => lyricsByMusicId.has(music.id));
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
                return music.id === numericQuery
                    || music.title.toLowerCase().includes(query)
                    || music.pronunciation.toLowerCase().includes(query)
                    || music.composer.toLowerCase().includes(query)
                    || music.lyricist.toLowerCase().includes(query)
                    || Boolean(indexEntry?.title["zh-CN"]?.toLowerCase().includes(query))
                    || Boolean(indexEntry?.title["en-US"]?.toLowerCase().includes(query));
            });
        }
        if (!isShowSpoiler) result = result.filter((music) => music.publishedAt <= now);
        return result.sort((left, right) => {
            const difference = sortBy === "id" ? left.id - right.id : left.publishedAt - right.publishedAt;
            return sortOrder === "asc" ? difference : -difference;
        });
    }, [deferredSearchQuery, eventMusicIds, hasEventOnly, isShowSpoiler, lyricsByMusicId, musicTags, musics, now, selectedCategories, selectedTag, sortBy, sortOrder]);

    const resetFilters = () => {
        setSelectedTag("all");
        setSelectedCategories([]);
        setHasEventOnly(false);
        setSearchQuery("");
        setSortBy("publishedAt");
        setSortOrder("desc");
        resetDisplayCount();
    };

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
                <span className="inline-flex rounded-full bg-miku/10 px-3 py-1 text-xs font-bold text-miku">{t("page.lyrics.badge")}</span>
                <h1 className="mt-3 text-3xl sm:text-4xl font-black text-primary-text">{t("page.lyrics.title")}</h1>
                <p className="mt-2 max-w-2xl text-slate-500 dark:text-slate-400">{t("page.lyrics.description")}</p>
            </div>

            {error ? (
                <div role="alert" className="ios-glass-card rounded-2xl p-8 text-center text-red-600 dark:text-red-300">
                    <p className="font-bold">{error}</p>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                    <aside className="w-full lg:w-80 lg:shrink-0">
                        <div className="lg:sticky lg:top-24">
                            <MusicFilters
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
                                totalMusics={lyricsByMusicId.size}
                                filteredMusics={filteredMusics.length}
                            />
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1">
                        {isLoading ? (
                            <div className={MUSIC_GRID_CLASS} aria-label={t("page.lyrics.loading")}>
                                {Array.from({ length: 10 }).map((_, index) => (
                                    <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/70" />
                                ))}
                            </div>
                        ) : filteredMusics.length === 0 ? (
                            <div className="ios-glass-card rounded-2xl p-12 text-center">
                                <p className="text-lg font-bold text-primary-text">{t("page.lyrics.empty")}</p>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("page.lyrics.emptyHint")}</p>
                            </div>
                        ) : (
                            <>
                                <div className={MUSIC_GRID_CLASS}>
                                    {filteredMusics.slice(0, displayCount).map((music) => {
                                        const lyrics = lyricsByMusicId.get(music.id);
                                        return (
                                            <MusicItem
                                                key={music.id}
                                                music={music}
                                                isSpoiler={music.publishedAt > now}
                                                cnTitle={lyrics?.title["zh-CN"]}
                                                enTitle={lyrics?.title["en-US"]}
                                                hrefBase="/lyrics"
                                            />
                                        );
                                    })}
                                </div>
                                {displayCount < filteredMusics.length && (
                                    <div className="mt-8 text-center">
                                        <button onClick={loadMore} className="pressable ios-glass-btn ios-glass-btn-primary rounded-full px-8 py-3 font-bold">
                                            {t("page.lyrics.loadMore")}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            )}
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
