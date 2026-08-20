"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import {
    IlimitedTimeMusicsInfo,
    IMusicInfo,
    IMusicTagInfo,
    IMusicDifficultyInfo,
    IMusicVocalInfo,
    IOutsideCharacter,
    MusicDifficultyType,
    getMusicJacketUrl,
    getMusicVocalAudioUrl,
    MUSIC_CATEGORY_COLORS,
    DIFFICULTY_NAMES,
    DIFFICULTY_COLORS,
    MusicCategoryType,
} from "@/types/music";
import { getCharacterName } from "@/lib/i18n";
import { useTheme, AssetSourceType } from "@/contexts/ThemeContext";
import { getCharacterIconUrl, getEventBannerUrl, MOE_MUSIC_META_URL, MOE_RANKINGS_URL } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { fetchSongConstants, buildSongConstantsMap } from "@/lib/songConstants";
import { getPublishedLyricsIndexEntry, hasLyricsDetail } from "@/lib/lyrics";
import { LYRICS_ENTRY_VISIBLE } from "@/lib/lyrics-visibility";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import { useI18n } from "@/contexts/I18nContext";

// Difficulty order for tabs
const DIFFICULTY_ORDER: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];

// External data URLs
const MUSIC_META_API = MOE_MUSIC_META_URL;
const RANKINGS_API = MOE_RANKINGS_URL;

type RawMusicCategory = MusicCategoryType | { musicCategoryName: MusicCategoryType };

// Music meta data structure
interface MusicMetaData {
    music_id: number;
    difficulty: string;
    music_time: number;
}

// Rankings raw data structure  
interface RankingItem {
    rank: number;
    music_id: number;
    difficulty: string;
    value: number;
    pspi?: number;
}

interface RankingsRawData {
    total_songs: number;
    rankings: {
        [key: string]: RankingItem[];
    };
}

interface EventLite {
    id: number;
    name: string;
    assetbundleName: string;
}

interface EventMusicLink {
    eventId: number;
    musicId: number;
}

// Ranking category definitions
type RankingCategoryKey =
    | "pt_per_hour_multi" | "pt_per_hour_auto"
    | "multi_pt_max" | "solo_pt_max" | "auto_pt_max"
    | "multi_score" | "solo_score" | "auto_score";

const RANKING_CATEGORIES: { key: RankingCategoryKey; label: string; shortLabel: string; group: string }[] = [
    { key: "pt_per_hour_multi", label: "rankingCategories.ptPerHourMulti.label", shortLabel: "rankingCategories.ptPerHourMulti.shortLabel", group: "rankingCategories.groups.ptPerHour" },
    { key: "pt_per_hour_auto", label: "rankingCategories.ptPerHourAuto.label", shortLabel: "rankingCategories.ptPerHourAuto.shortLabel", group: "rankingCategories.groups.ptPerHour" },
    { key: "multi_pt_max", label: "rankingCategories.multiPtMax.label", shortLabel: "rankingCategories.multiPtMax.shortLabel", group: "rankingCategories.groups.ptMax" },
    { key: "solo_pt_max", label: "rankingCategories.soloPtMax.label", shortLabel: "rankingCategories.soloPtMax.shortLabel", group: "rankingCategories.groups.ptMax" },
    { key: "auto_pt_max", label: "rankingCategories.autoPtMax.label", shortLabel: "rankingCategories.autoPtMax.shortLabel", group: "rankingCategories.groups.ptMax" },
    { key: "multi_score", label: "rankingCategories.multiScore.label", shortLabel: "rankingCategories.multiScore.shortLabel", group: "rankingCategories.groups.score" },
    { key: "solo_score", label: "rankingCategories.soloScore.label", shortLabel: "rankingCategories.soloScore.shortLabel", group: "rankingCategories.groups.score" },
    { key: "auto_score", label: "rankingCategories.autoScore.label", shortLabel: "rankingCategories.autoScore.shortLabel", group: "rankingCategories.groups.score" },
];

// Ranking info per category
interface MusicRankings {
    total: number;
    categories: Record<string, { rank: number; difficulty: string; value: number; pspi?: number } | null>;
    bestCategory: RankingCategoryKey | null;
}



export default function MusicDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();
    const { t, formatDate, formatNumber } = useI18n();
    const musicId = Number(params.id);
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';

    const [music, setMusic] = useState<IMusicInfo | null>(null);
    const [musicTags, setMusicTags] = useState<IMusicTagInfo[]>([]);
    const [difficulties, setDifficulties] = useState<IMusicDifficultyInfo[]>([]);
    const [vocals, setVocals] = useState<IMusicVocalInfo[]>([]);
    const [relatedEvents, setRelatedEvents] = useState<EventLite[]>([]);
    const [limitedTimeMusics, setLimitedTimeMusics] = useState<IlimitedTimeMusicsInfo[]>([]);
    const [outsideCharacters, setOutsideCharacters] = useState<Record<number, string>>({});
    const [hasPublishedLyrics, setHasPublishedLyrics] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Duration and ranking states
    const [musicDuration, setMusicDuration] = useState<number | null>(null);
    const [rankings, setRankings] = useState<MusicRankings | null>(null);
    const [selectedRankingCategory, setSelectedRankingCategory] = useState<RankingCategoryKey>("pt_per_hour_multi");

    // View states
    const [selectedDifficulty, setSelectedDifficulty] = useState<MusicDifficultyType>("master");
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [songConstantsMap, setSongConstantsMap] = useState<Record<number, Record<string, number>>>({});

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Set breadcrumb detail name
    useEffect(() => {
        if (music) setDetailName(music.title);
    }, [music, setDetailName]);

    // Lyrics availability is optional and must never block the music detail page.
    useEffect(() => {
        setHasPublishedLyrics(false);
        if (!LYRICS_ENTRY_VISIBLE) return;

        const controller = new AbortController();
        let active = true;

        getPublishedLyricsIndexEntry(musicId, controller.signal)
            .then((entry) => {
                if (active) setHasPublishedLyrics(entry !== null && hasLyricsDetail(entry));
            })
            .catch(() => {
                if (active) setHasPublishedLyrics(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, [musicId]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [musicsData, tagsData, diffisData, vocalsData, eventsData, eventMusicsData, limitedTimeMusicsData, outsideCharsData] = await Promise.all([
                    fetchMasterData<IMusicInfo[]>("musics.json"),
                    fetchMasterData<IMusicTagInfo[]>("musicTags.json"),
                    fetchMasterData<IMusicDifficultyInfo[]>("musicDifficulties.json"),
                    fetchMasterData<IMusicVocalInfo[]>("musicVocals.json"),
                    fetchMasterData<EventLite[]>("events.json"),
                    fetchMasterData<EventMusicLink[]>("eventMusics.json"),
                    fetchMasterData<IlimitedTimeMusicsInfo[]>("limitedTimeMusics.json"),
                    fetchMasterData<IOutsideCharacter[]>("outsideCharacters.json").catch(() => [] as IOutsideCharacter[]),
                ]);

                const foundMusic = musicsData.find(m => m.id === musicId);
                if (!foundMusic) {
                    throw new Error(`Music ${musicId} not found`);
                }

                // Normalize categories (CN server returns categories as objects)
                const normalizedMusic = {
                    ...foundMusic,
                    categories: (foundMusic.categories as unknown as RawMusicCategory[]).map((cat) =>
                        typeof cat === "object" && cat !== null && "musicCategoryName" in cat
                            ? cat.musicCategoryName
                            : cat
                    ),
                };

                setMusic(normalizedMusic);
                document.title = `Moesekai - ${normalizedMusic.title}`;
                setMusicTags(tagsData.filter(t => t.musicId === musicId));
                setDifficulties(diffisData.filter(d => d.musicId === musicId).sort((a, b) => {
                    return DIFFICULTY_ORDER.indexOf(a.musicDifficulty) - DIFFICULTY_ORDER.indexOf(b.musicDifficulty);
                }));
                setVocals(vocalsData.filter(v => v.musicId === musicId));
                setLimitedTimeMusics(limitedTimeMusicsData);

                // Build outside character name map
                const outsideCharMap: Record<number, string> = {};
                for (const oc of outsideCharsData) {
                    outsideCharMap[oc.id] = oc.name;
                }
                setOutsideCharacters(outsideCharMap);

                // Process related events using client-side data
                const musicEvents = eventMusicsData.filter(em => em.musicId === musicId);
                const relatedEventIds = new Set(musicEvents.map(em => em.eventId));
                const related = eventsData.filter(e => relatedEventIds.has(e.id));
                // Sort by event id (newest first usually, or old to new)
                related.sort((a, b) => b.id - a.id);
                setRelatedEvents(related);

                setError(null);

                // Set default difficulty to master if available
                const availableDiffs = diffisData.filter(d => d.musicId === musicId);
                if (availableDiffs.length > 0) {
                    const masterDiff = availableDiffs.find(d => d.musicDifficulty === "master");
                    setSelectedDifficulty(masterDiff?.musicDifficulty || "expert");
                }
            } catch (err) {
                console.error("Error fetching music:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (musicId) {
            fetchData();

            // Fetch optional meta and rankings data (don't block main content)
            async function fetchMetaData() {
                try {
                    const metaRes = await fetch(MUSIC_META_API);
                    if (metaRes.ok) {
                        const metaData: MusicMetaData[] = await metaRes.json();
                        const thisMusicMeta = metaData.find(m => m.music_id === musicId);
                        if (thisMusicMeta) {
                            setMusicDuration(thisMusicMeta.music_time);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to fetch music duration:", err);
                }

                try {
                    const rankingsRes = await fetch(RANKINGS_API);
                    if (rankingsRes.ok) {
                        const rankingsData: RankingsRawData = await rankingsRes.json();

                        // Collect rankings for all categories
                        const categories: Record<string, { rank: number; difficulty: string; value: number; pspi: number } | null> = {};
                        let bestRank = Infinity;
                        let bestCategory: RankingCategoryKey | null = null;

                        for (const cat of RANKING_CATEGORIES) {
                            const categoryRankings = rankingsData.rankings[cat.key];
                            if (categoryRankings) {
                                const thisRanking = categoryRankings.find(item => item.music_id === musicId);
                                if (thisRanking) {
                                    categories[cat.key] = {
                                        rank: thisRanking.rank,
                                        difficulty: thisRanking.difficulty,
                                        value: thisRanking.value,
                                        pspi: thisRanking.pspi ?? 0,
                                    };
                                    // Track best (lowest) rank
                                    if (thisRanking.rank < bestRank) {
                                        bestRank = thisRanking.rank;
                                        bestCategory = cat.key;
                                    }
                                } else {
                                    categories[cat.key] = null;
                                }
                            }
                        }

                        setRankings({
                            total: rankingsData.total_songs,
                            categories,
                            bestCategory,
                        });

                        // Default to best category if available
                        if (bestCategory) {
                            setSelectedRankingCategory(bestCategory);
                        }
                    }
                } catch (err) {
                    console.warn("Failed to fetch ranking:", err);
                }
            }

            fetchMetaData();

            // Fetch song constants (non-blocking)
            fetchSongConstants().then(entries => {
                setSongConstantsMap(buildSongConstantsMap(entries));
            }).catch(err => {
                console.warn("Failed to load song constants:", err);
            });
        }
    }, [musicId]);

    // Selected difficulty info
    const selectedDifficultyInfo = useMemo(() => {
        return difficulties.find(d => d.musicDifficulty === selectedDifficulty);
    }, [difficulties, selectedDifficulty]);

    // Get tag names for this music
    const tagNames = useMemo(() => {
        return musicTags.map((tagInfo) => {
            const key = `common.musicTags.${tagInfo.musicTag}`;
            const label = t(key);
            return label === key ? tagInfo.musicTag : label;
        });
    }, [musicTags, t]);

    // Create set of limited time music IDs
    const limitedMusicIds = useMemo(() => {
        return new Set(limitedTimeMusics.map(item => item.musicId));
    }, [limitedTimeMusics]);

    // Check if current music is limited time
    const isLimitedMusic = useMemo(() => {
        return music ? limitedMusicIds.has(music.id) : false;
    }, [music, limitedMusicIds]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-[var(--hh-text-secondary)]">{t("common.state.loading")}</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !music) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="hh-title text-2xl text-[var(--hh-text-primary)] mb-2">{t("page.music.notFoundTitle", { id: musicId })}</h2>
                        <p className="text-[var(--hh-text-secondary)] mb-6">{t("page.music.notFoundDesc")}</p>
                        <Link
                            href="/music"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t("page.music.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);
    const releaseConditionMap: Record<number, string> = {
        1: t("page.music.releaseConditions.initial"),
        5: t("page.music.releaseConditions.musicShop"),
        6: t("page.music.releaseConditions.none"),
        10: t("page.music.releaseConditions.gift"),
    };
    const releaseCondition = releaseConditionMap[music.releaseConditionId] ?? String(music.releaseConditionId);
    const releaseConditionText = isLimitedMusic
        ? t("page.music.releaseConditionLimited", { condition: releaseCondition })
        : releaseCondition;

    return (
        <MainLayout>
            <ImagePreviewModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                title={t("page.music.jacketPreviewTitle", { title: music.title })}
                imageUrl={jacketUrl}
                alt={music.title}
                fileName={`music_${music.id}_jacket.png`}
            />

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="hh-numeric inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-sm)] text-xs font-mono text-[var(--hh-text-secondary)] w-fit">
                            ID: {music.id}
                        </span>
                        {/* Category Tags */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {Array.from(new Set(music.categories)).map((cat) => {
                                const categoryKey = `common.musicCategories.${cat}`;
                                const categoryLabel = t(categoryKey);

                                return (
                                    <span
                                        key={cat}
                                        className="px-2 py-0.5 text-xs font-bold rounded text-white"
                                        style={{ backgroundColor: MUSIC_CATEGORY_COLORS[cat as MusicCategoryType] }}
                                    >
                                        {categoryLabel === categoryKey ? cat : categoryLabel}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mb-2">
                        <div className="inline-flex max-w-full items-start gap-2">
                            <h1 className="hh-display min-w-0 text-2xl text-[var(--hh-text-primary)] sm:text-3xl">
                                <TranslatedText
                                    original={music.title}
                                    category="music"
                                    field="title"
                                    originalClassName=""
                                    translationClassName="block text-lg font-medium text-[var(--hh-text-tertiary)] mt-1"
                                />
                            </h1>
                            {LYRICS_ENTRY_VISIBLE && hasPublishedLyrics && (
                                <Link
                                    href={`/lyrics/${music.id}`}
                                    className="hh-press -translate-y-1 whitespace-nowrap rounded-[var(--hh-radius-sm)] border border-sky-400/35 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-500 hover:border-sky-400/60 hover:bg-sky-500/15 sm:text-xs"
                                >
                                    {t("page.music.goToLyrics")}
                                    <span className="ms-0.5" aria-hidden="true">↗</span>
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[var(--hh-text-secondary)]">{music.composer}</span>
                        {tagNames.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {tagNames.map((tag, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 bg-miku/10 text-miku rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Grid - 2 Column Layout like Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Jacket Image */}
                    <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            {/* Jacket Image */}
                            <div
                                className="relative aspect-square bg-[var(--hh-surface-sunken)] cursor-zoom-in"
                                onClick={() => setImageViewerOpen(true)}
                            >
                                <Image
                                    src={jacketUrl}
                                    alt={music.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    priority
                                />
                                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-[var(--hh-radius-md)] flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                    {t("page.music.clickExpand")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t("page.music.basicInfo")}
                                </h2>
                            </div>
                            <div className="divide-y divide-[var(--hh-border)]">
                                <InfoRow label="ID" value={`#${music.id}`} />
                                <InfoRow
                                    label={t("page.music.fields.title")}
                                    value={
                                        <TranslatedText
                                            original={music.title}
                                            category="music"
                                            field="title"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-[var(--hh-text-tertiary)] mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow label={t("page.music.fields.composer")} value={music.composer} />
                                <InfoRow label={t("page.music.fields.arranger")} value={music.arranger} />
                                <InfoRow label={t("page.music.fields.lyricist")} value={music.lyricist} />
                                {/* Duration */}
                                {musicDuration != null && (
                                    <InfoRow
                                        label={t("page.music.fields.duration")}
                                        value={`${Math.floor(musicDuration / 60)}:${Math.floor(musicDuration % 60).toString().padStart(2, "0")}`}
                                    />
                                )}
                                <InfoRow
                                    label={t("page.music.fields.publishedAt")}
                                    value={mounted && music.publishedAt
                                        ? formatDate(music.publishedAt, {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })
                                        : "..."}
                                />
                                <InfoRow
                                    label={t("page.music.fields.releaseCondition")}
                                    value={releaseConditionText}
                                />
                                <InfoRow
                                    label={t("page.music.fields.assetName")}
                                    value={<span className="font-mono text-xs bg-[var(--hh-surface-sunken)] px-2 py-0.5 rounded-[var(--hh-radius-sm)]">{music.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Ranking Card */}
                        {rankings && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        {t("page.music.metaRanking")}
                                    </h2>
                                </div>

                                {/* Category Tabs */}
                                <div className="px-3 py-2 border-b border-[var(--hh-border)] flex flex-wrap gap-1">
                                    {RANKING_CATEGORIES.map((cat) => {
                                        const catRanking = rankings.categories[cat.key];
                                        const isSelected = selectedRankingCategory === cat.key;
                                        return (
                                            <button
                                                key={cat.key}
                                                onClick={() => setSelectedRankingCategory(cat.key)}
                                                className={`hh-chip hh-press px-3 py-1.5 text-xs ${isSelected
                                                    ? "hh-chip-active"
                                                    : catRanking
                                                        ? "cursor-pointer"
                                                        : "opacity-45 cursor-not-allowed"
                                                    }`}
                                                disabled={!catRanking}
                                            >
                                                {t(`page.music.${cat.shortLabel}`)}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Compact Horizontal Rank Display */}
                                {rankings.categories[selectedRankingCategory] && (
                                    <div className="p-4 flex items-center justify-between">
                                        {/* Left: PSPI */}
                                        <div className="flex items-center gap-3">
                                            <div>
                                                <div className="hh-label mb-0.5">PSPI</div>
                                                <div className="hh-display hh-numeric text-2xl text-[var(--hh-accent-deep)]">
                                                    {(rankings.categories[selectedRankingCategory]!.pspi ?? 0).toFixed(1)}
                                                </div>
                                            </div>
                                            <span className="px-2 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] text-xs rounded-[var(--hh-radius-sm)] uppercase font-mono">
                                                {rankings.categories[selectedRankingCategory]!.difficulty}
                                            </span>
                                        </div>

                                        {/* Right: Rank */}
                                        <div className="text-right">
                                            <span className="hh-display hh-numeric text-4xl sm:text-5xl text-[var(--hh-accent-deep)]">
                                                #{rankings.categories[selectedRankingCategory]!.rank}
                                            </span>
                                            <span className="hh-numeric text-[var(--hh-text-tertiary)] text-sm ml-1">/{rankings.total}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Difficulty Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    {t("page.music.difficultyInfo")}
                                </h2>
                            </div>

                            {/* Difficulty Grid */}
                            <div className="p-4 grid grid-cols-5 gap-2">
                                {difficulties.map((diff) => (
                                    <button
                                        key={diff.musicDifficulty}
                                        className={`hh-press flex flex-col items-center p-2 rounded-[var(--hh-radius-md)] cursor-pointer ${selectedDifficulty === diff.musicDifficulty
                                            ? "ring-2 bg-[var(--hh-surface-2)]"
                                            : "border border-transparent hover:bg-[var(--hh-surface-1)]"
                                            }`}
                                        style={
                                            selectedDifficulty === diff.musicDifficulty
                                                ? {
                                                    borderColor: DIFFICULTY_COLORS[diff.musicDifficulty],
                                                    boxShadow: `0 0 0 2px ${DIFFICULTY_COLORS[diff.musicDifficulty]}`
                                                }
                                                : {}
                                        }
                                        onClick={() => setSelectedDifficulty(diff.musicDifficulty)}
                                    >
                                        <span
                                            className="text-[10px] font-bold uppercase"
                                            style={{ color: DIFFICULTY_COLORS[diff.musicDifficulty] }}
                                        >
                                            {DIFFICULTY_NAMES[diff.musicDifficulty].slice(0, 3)}
                                        </span>
                                        <span
                                            className="hh-display hh-numeric text-lg"
                                            style={{ color: DIFFICULTY_COLORS[diff.musicDifficulty] }}
                                        >
                                            {diff.playLevel}
                                        </span>
                                        {songConstantsMap[musicId]?.[diff.musicDifficulty] !== undefined && (
                                            <span className="hh-numeric text-[9px] font-bold text-[var(--hh-text-tertiary)] -mt-0.5">
                                                {songConstantsMap[musicId][diff.musicDifficulty].toFixed(1)}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Selected Difficulty Details */}
                            {selectedDifficultyInfo && (
                                <div className="px-5 pb-4">
                                    <div className="flex items-center justify-between py-2 border-t border-[var(--hh-border)]">
                                        <span className="text-sm text-[var(--hh-text-secondary)]">{t("page.music.fields.noteCount")}</span>
                                        <span className="hh-numeric text-sm font-bold text-[var(--hh-text-primary)]">
                                            {formatNumber(selectedDifficultyInfo.totalNoteCount)}
                                        </span>
                                    </div>
                                    {songConstantsMap[musicId]?.[selectedDifficulty] !== undefined && (
                                        <div className="flex items-center justify-between py-2 border-t border-[var(--hh-border)]">
                                            <span className="text-sm text-[var(--hh-text-secondary)]">{t("page.music.fields.constant")}</span>
                                            <span className="hh-display hh-numeric text-sm text-[var(--hh-accent-deep)]">
                                                {songConstantsMap[musicId][selectedDifficulty].toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                    {songConstantsMap[musicId] && Object.keys(songConstantsMap[musicId]).length > 0 && (
                                        <div className="pt-1 pb-0.5 text-[10px] text-[var(--hh-text-tertiary)] text-center">
                                            {t("page.music.communityConstantNote")}
                                        </div>
                                    )}

                                    <Link
                                        href={`/chart-image?musicId=${musicId}&difficulty=${selectedDifficulty}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hh-press flex items-center justify-center gap-2 w-full py-3 rounded-[var(--hh-radius-md)] text-white text-sm font-bold"
                                        style={{ backgroundColor: DIFFICULTY_COLORS[selectedDifficulty] }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        {t("page.music.openChartImagePreview", { difficulty: DIFFICULTY_NAMES[selectedDifficulty] })}
                                    </Link>
                                    <Link
                                        href={`/chart-preview?musicId=${musicId}&difficulty=${selectedDifficulty}&preview=true&from=/music/${musicId}`}
                                        className="hh-press flex items-center justify-center gap-2 w-full py-3 rounded-[var(--hh-radius-md)] text-sm font-bold border-2 mt-2"
                                        style={{ borderColor: DIFFICULTY_COLORS[selectedDifficulty], color: DIFFICULTY_COLORS[selectedDifficulty] }}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t("page.music.open3dChartPreview")}
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Vocals Card */}
                        {vocals.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        {t("page.music.vocalVersions", { seconds: Math.round((music.fillerSec || 0) * 10) / 10 })}
                                    </h2>
                                </div>
                                <div className="divide-y divide-[var(--hh-border)] max-h-96 overflow-y-auto">
                                    {vocals.map((vocal) => (
                                        <VocalPlayer
                                            key={vocal.id}
                                            vocal={vocal}
                                            fillerSec={music.fillerSec}
                                            assetSource={assetSource}
                                            outsideCharacters={outsideCharacters}
                                            downloadLabel={t("page.music.downloadAudio")}
                                            getCharacterLabel={(characterId) => getCharacterName(t, characterId)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Related Events Card */}
                        {relatedEvents.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {t("page.music.relatedEvents")}
                                    </h2>
                                </div>
                                <div className="p-0">
                                    {relatedEvents.map((event) => (
                                        <Link key={event.id} href={`/events/${event.id}`} className="block group border-b border-[var(--hh-border)] last:border-0 relative">
                                            <div className="relative aspect-[2/1] w-full">
                                                <Image
                                                    src={getEventBannerUrl(event.assetbundleName, assetSource)}
                                                    alt={event.name}
                                                    fill
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                    unoptimized
                                                />
                                                {/* Functional scrim, not decoration: the white title below sits on an
                                                    arbitrary event banner and needs this fade to stay legible. */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                <div className="absolute bottom-0 left-0 w-full p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="hh-numeric text-[10px] font-mono bg-black/50 text-white px-2 py-0.5 rounded-[var(--hh-radius-sm)]">
                                                            Event #{event.id}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                        <TranslatedText
                                                            original={event.name}
                                                            category="events"
                                                            field="name"
                                                            originalClassName="truncate block"
                                                            translationClassName="text-sm font-medium text-white/90 truncate block mt-0.5"
                                                        />
                                                    </h3>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        <DetailPageAdCard hidden={isScreenshotMode} />
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <Link
                        href="/music"
                        className="hh-btn hh-press px-6 py-3 rounded-[var(--hh-radius-md)]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t("page.music.backToList")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

// Vocal Player Component
function VocalPlayer({
    vocal,
    fillerSec,
    assetSource,
    outsideCharacters,
    downloadLabel,
    getCharacterLabel,
}: {
    vocal: IMusicVocalInfo;
    fillerSec: number;
    assetSource: AssetSourceType;
    outsideCharacters: Record<number, string>;
    downloadLabel: string;
    getCharacterLabel: (characterId: number) => string;
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrl = getMusicVocalAudioUrl(vocal.assetbundleName, assetSource);

    const togglePlay = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onended = () => setIsPlaying(false);
            audioRef.current.onplay = () => setIsPlaying(true);
            audioRef.current.onpause = () => setIsPlaying(false);
            audioRef.current.onloadedmetadata = () => {
                if (audioRef.current) setDuration(audioRef.current.duration);
            };
            audioRef.current.ontimeupdate = () => {
                if (audioRef.current) {
                    setProgress(audioRef.current.currentTime);
                }
            };

            // Initial offset skip
            if (fillerSec > 0) {
                audioRef.current.currentTime = fillerSec;
            }
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setProgress(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    // Format time (mm:ss)
    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    return (
        <div className="px-5 py-4 group">
            <div className="flex items-center gap-4">
                {/* Play Button */}
                <button
                    onClick={togglePlay}
                    className={`hh-press hh-focusable shrink-0 w-10 h-10 rounded-[var(--hh-radius-full)] flex items-center justify-center cursor-pointer ${isPlaying
                        ? "bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)]"
                        : "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                        }`}
                >
                    {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="hh-title text-sm text-[var(--hh-text-primary)] truncate">
                            <TranslatedText
                                original={vocal.caption}
                                category="music"
                                field="vocalCaption"
                                originalClassName="truncate block"
                                translationClassName="text-xs text-[var(--hh-text-tertiary)] truncate block font-normal"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Download Button */}
                            <a
                                href={audioUrl}
                                download={`${vocal.caption}.mp3`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hh-press p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-deep)] hover:bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)]"
                                title={downloadLabel}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                        {vocal.characters?.map((chara) => {
                            const isGameChar = chara.characterType === "game_character";
                            const charName = isGameChar
                                ? getCharacterLabel(chara.characterId)
                                : outsideCharacters[chara.characterId] || `Guest ${chara.characterId}`;
                            const hasIcon = isGameChar && chara.characterId <= 26;

                            return hasIcon ? (
                                <div
                                    key={chara.id}
                                    className="w-6 h-6 rounded-[var(--hh-radius-full)] overflow-hidden bg-[var(--hh-surface-sunken)] ring-1 ring-[var(--hh-surface-2)]"
                                    title={charName}
                                >
                                    <Image
                                        src={getCharacterIconUrl(chara.characterId)}
                                        alt=""
                                        width={24}
                                        height={24}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div
                                    key={chara.id}
                                    className="h-6 px-2 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)] ring-1 ring-[var(--hh-surface-2)] flex items-center"
                                    title={charName}
                                >
                                    <span className="text-[10px] text-[var(--hh-text-secondary)] font-medium leading-none whitespace-nowrap">
                                        {charName}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress Bar & Time */}
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={progress}
                            onChange={handleSeek}
                            className="flex-1 h-1.5 bg-[var(--hh-surface-inset)] rounded-[var(--hh-radius-full)] appearance-none cursor-pointer accent-miku"
                        />
                        <span className="hh-numeric text-[10px] font-mono text-[var(--hh-text-tertiary)] shrink-0 min-w-[60px] text-right">
                            {formatTime(progress)} / {formatTime(duration)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-[var(--hh-text-secondary)] font-medium">{label}</span>
            <span className="font-semibold text-[var(--hh-text-primary)]">{value}</span>
        </div>
    );
}
