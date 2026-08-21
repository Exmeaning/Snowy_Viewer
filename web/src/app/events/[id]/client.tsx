"use client";
import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import { useI18n } from "@/contexts/I18nContext";
import {
    IEventInfo,
    IEventDeckBonus,
    EVENT_TYPE_COLORS,
    getEventStatus,
    EVENT_STATUS_DISPLAY,
    EventType
} from "@/types/events";
import { IActionSet, IEventStory, buildEventRawUnitMap, rawUnitToFilterId, getEventUnitFilterId, buildEventBannerCharMap } from "@/lib/eventUnit";
import { type EventUnitFilterId } from "@/components/events/EventFilters";
import { getEventLogoUrl, getCharacterIconUrl, getEventBannerUrl, getEventCharacterUrl, getEventStoryBannerUrl, getMusicJacketUrl, getVirtualLiveBannerUrl, getEventBgmUrl } from "@/lib/assets";
import { UNIT_FIELD_LABEL_KEYS } from "@/types/types";
import type { ICardInfo, ICharaUnitInfo, IGameChara } from "@/types/types";
import { useTheme, type AssetSourceType } from "@/contexts/ThemeContext";
import { getCharacterName } from "@/lib/i18n";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";

// Asset URL helpers - Now imported from @/lib/assets

// Local attribute icon mapping
const LOCAL_ATTR_ICONS: Record<string, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

// Attribute display names
const ATTR_NAMES: Record<string, string> = {
    cool: "Cool",
    cute: "Cute",
    happy: "Happy",
    mysterious: "Mysterious",
    pure: "Pure",
};

interface IEventCard {
    id: number;
    cardId: number;
    eventId: number;
    bonusRate: number;
}

interface IEventMusic {
    eventId: number;
    musicId: number;
    seq: number;
}

interface ICard {
    id: number;
    assetbundleName: string;
    prefix: string;
    characterId: number;
    cardRarityType: string;
    attr: string;
}

interface IMusic {
    id: number;
    title: string;
    assetbundleName: string;
}

interface IVirtualLiveInfo {
    id: number;
    name: string;
    assetbundleName: string;
}

// API URL for event-virtual live mapping
const EVENT_VIRTUAL_LIVE_MAP_URL = (process.env.NEXT_PUBLIC_API_URL || "") + "/api/event-virtuallive-map";



export default function EventDetailPage() {
    const { t, formatDate: formatLocaleDate } = useI18n();
    const params = useParams();
    const _router = useRouter();
    const searchParams = useSearchParams();
    const eventId = Number(params.id);
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';

    const [event, setEvent] = useState<IEventInfo | null>(null);
    const [deckBonuses, setDeckBonuses] = useState<IEventDeckBonus[]>([]);
    const [eventCards, setEventCards] = useState<IEventCard[]>([]);
    const [eventMusics, setEventMusics] = useState<IEventMusic[]>([]);
    const [allCards, setAllCards] = useState<ICard[]>([]);
    const [allMusics, setAllMusics] = useState<IMusic[]>([]);
    const [gameCharacterUnits, setGameCharacterUnits] = useState<ICharaUnitInfo[]>([]);
    const [gameCharacters, setGameCharacters] = useState<IGameChara[]>([]);
    const [eventUnitMap, setEventUnitMap] = useState<Map<number, EventUnitFilterId>>(new Map());
    const [bannerCharId, setBannerCharId] = useState<number | null>(null);
    const [hasEventStory, setHasEventStory] = useState(true);
    const [virtualLive, setVirtualLive] = useState<IVirtualLiveInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState<"event_story_banner" | "logo" | "banner" | "character">("event_story_banner");
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const { useTrainedThumbnail, assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();

    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Set breadcrumb detail name
    useEffect(() => {
        if (event) setDetailName(event.name);
    }, [event, setDetailName]);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [eventsData, bonusesData, eventCardsData, eventMusicsData, cardsData, musicsData, charUnitsData, gameCharsData, actionSetsForUnitMapData, eventStoriesData] = await Promise.all([
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IEventDeckBonus[]>("eventDeckBonuses.json"),
                    fetchMasterData<IEventCard[]>("eventCards.json"),
                    fetchMasterData<IEventMusic[]>("eventMusics.json"),
                    fetchMasterData<ICard[]>("cards.json"),
                    fetchMasterData<IMusic[]>("musics.json"),
                    fetchMasterData<ICharaUnitInfo[]>("gameCharacterUnits.json"),
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterDataForServer<IActionSet[]>("jp", "actionSets.json"),
                    fetchMasterData<IEventStory[]>("eventStories.json"),
                ]);

                const foundEvent = eventsData.find(e => e.id === eventId);
                if (!foundEvent) {
                    throw new Error(`Event ${eventId} not found`);
                }

                setEvent(foundEvent);
                document.title = `Moesekai - ${foundEvent.name}`;
                setDeckBonuses(bonusesData.filter(b => b.eventId === eventId));
                setEventCards(eventCardsData.filter(c => c.eventId === eventId));
                setEventMusics(eventMusicsData.filter(m => m.eventId === eventId));
                setAllCards(cardsData);
                setAllMusics(musicsData);
                setGameCharacterUnits(charUnitsData);
                setGameCharacters(gameCharsData);
                // Build event unit map from actionSets (always fetched from JP server)
                const rawMap = buildEventRawUnitMap(actionSetsForUnitMapData);
                const unitMap = new Map<number, EventUnitFilterId>();
                for (const [eid, rawType] of rawMap) {
                    unitMap.set(eid, rawUnitToFilterId(rawType));
                }
                setEventUnitMap(unitMap);
                // Build banner character
                const bannerMap = buildEventBannerCharMap(eventStoriesData, charUnitsData);
                setBannerCharId(bannerMap.get(eventId) ?? null);
                // Check if this event has event stories
                setHasEventStory(eventStoriesData.some(s => s.eventId === eventId));
                setError(null);
            } catch (err) {
                console.error("Error fetching event:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (eventId) {
            fetchData();
        }
    }, [eventId]);

    // Fetch virtual live data
    useEffect(() => {
        async function fetchVirtualLive() {
            try {
                const res = await fetch(EVENT_VIRTUAL_LIVE_MAP_URL);
                if (res.ok) {
                    const data: Record<string, IVirtualLiveInfo> = await res.json();
                    const vlInfo = data[eventId.toString()];
                    setVirtualLive(vlInfo || null);
                }
            } catch (err) {
                console.error("Error fetching virtual live:", err);
            }
        }
        if (eventId) {
            fetchVirtualLive();
        }
    }, [eventId]);

    // Get bonus attribute
    const bonusAttr = useMemo(() => {
        const attrBonus = deckBonuses.find(b => b.cardAttr && !b.gameCharacterUnitId);
        return attrBonus?.cardAttr;
    }, [deckBonuses]);

    // Get bonus characters with unit info for piapro characters
    const bonusCharacters = useMemo(() => {
        const seen = new Set<number>();
        return deckBonuses
            .filter(b => b.gameCharacterUnitId)
            .map(b => {
                const unitId = b.gameCharacterUnitId!;
                if (seen.has(unitId)) return null;
                seen.add(unitId);

                const charUnit = gameCharacterUnits.find(u => u.id === unitId);
                if (!charUnit) return null;

                const charId = charUnit.gameCharacterId;
                const gameChar = gameCharacters.find(c => c.id === charId);
                const baseName = getCharacterName(t, charId);

                // If piapro character and belongs to a specific group (not piapro itself)
                let displayName = baseName;
                if (gameChar?.unit === "piapro" && charUnit.unit !== "piapro") {
                    const groupNameKey = UNIT_FIELD_LABEL_KEYS[charUnit.unit];
                    if (groupNameKey) {
                        displayName = `${baseName} (${t(groupNameKey)})`;
                    }
                }

                return { charId, unitId, displayName };
            })
            .filter((item): item is { charId: number; unitId: number; displayName: string } => item !== null)
            .sort((a, b) => a.charId - b.charId);
    }, [deckBonuses, gameCharacterUnits, gameCharacters, t]);

    // Get event cards with full card info
    const eventCardsWithInfo = useMemo(() => {
        return eventCards
            .map(ec => {
                const card = allCards.find(c => c.id === ec.cardId);
                return card ? { ...ec, card } : null;
            })
            .filter((c): c is (IEventCard & { card: ICard }) => c !== null);
    }, [eventCards, allCards]);

    // Get theme songs
    const themeSongs = useMemo(() => {
        return eventMusics.map(em => {
            return allMusics.find(m => m.id === em.musicId);
        }).filter((m): m is IMusic => !!m);
    }, [eventMusics, allMusics]);

    // Format date helper
    const formatDate = (timestamp: number) => {
        if (!mounted) return "...";
        return formatLocaleDate(timestamp, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

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

    if (error || !event) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="hh-title text-2xl text-[var(--hh-text-primary)] mb-2">
                            {t("page.events.notFoundTitle", { id: eventId })}
                        </h2>
                        <p className="text-[var(--hh-text-secondary)] mb-6">
                            {t("page.events.notFoundDesc")}
                        </p>
                        <Link
                            href="/events"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t("page.events.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const logoUrl = getEventLogoUrl(event.assetbundleName, assetSource);
    const eventStoryBannerUrl = getEventStoryBannerUrl(event.assetbundleName, assetSource);
    const bannerUrl = getEventBannerUrl(event.assetbundleName, assetSource);
    const characterUrl = getEventCharacterUrl(event.assetbundleName, assetSource);
    const status = getEventStatus(event);
    const statusDisplay = EVENT_STATUS_DISPLAY[status];

    // Events with no banner character hide the character tab, except for whitelisted IDs
    const CHARACTER_TAB_WHITELIST = [180];
    const hasBannerChar = event.eventType !== "world_bloom" && bannerCharId !== null;
    const showCharacterTab = hasBannerChar || CHARACTER_TAB_WHITELIST.includes(event.id);

    // Events not in eventStories.json have no event story banner
    const showEventStoryBannerTab = hasEventStory;

    // Resolve effective tab (fallback to "logo" if event_story_banner tab is hidden)
    const effectiveTab = (activeImageTab === "event_story_banner" && !showEventStoryBannerTab) ? "logo" : activeImageTab;

    const activeImageUrl = effectiveTab === "event_story_banner" ? eventStoryBannerUrl : effectiveTab === "logo" ? logoUrl : effectiveTab === "banner" ? bannerUrl : characterUrl;
    const activeImageLabelKey = effectiveTab === "event_story_banner" ? "event_story_banner" : effectiveTab === "logo" ? "logo" : effectiveTab === "banner" ? "banner" : "character";
    const activeImageLabel = t(`page.events.imageTabs.${activeImageLabelKey}`);

    return (
        <MainLayout>
            <ImagePreviewModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                title={t("page.events.imageDetailTitle", { name: event.name, tab: activeImageLabel })}
                imageUrl={activeImageUrl}
                alt={t("page.events.imageDetailAlt", { name: event.name, tab: activeImageLabel })}
                fileName={`event_${event.id}_${activeImageTab}.png`}
            />

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="hh-numeric inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-sm)] text-xs font-mono text-[var(--hh-text-secondary)] w-fit">
                            ID: {event.id}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-[var(--hh-radius-sm)] text-white w-fit"
                            style={{ backgroundColor: EVENT_TYPE_COLORS[event.eventType as EventType] }}
                        >
                            {t("common.eventTypes." + event.eventType)}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-[var(--hh-radius-sm)] text-white w-fit"
                            style={{ backgroundColor: statusDisplay.color }}
                        >
                            {t("common.status." + status)}
                        </span>
                    </div>
                    <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)]">
                        <TranslatedText
                            original={event.name}
                            category="events"
                            field="name"
                            originalClassName=""
                            translationClassName="block text-lg font-medium text-[var(--hh-text-tertiary)] mt-1"
                        />
                    </h1>
                </div>

                {/* Main Content Grid - Images LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT Column: Image Gallery */}
                    <div>
                        {isScreenshotMode ? (
                            /* Screenshot Mode: Show all images in flat layout */
                            <div className="space-y-4">
                                {/* Event Story Banner (Logo) — only for events with story */}
                                {showEventStoryBannerTab && (
                                <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                    <div className="px-4 py-2 bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)]">
                                        <span className="hh-title text-sm text-[var(--hh-text-secondary)]">
                                            {t("page.events.imageTabs.event_story_banner")}
                                        </span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)]">
                                        <Image
                                            src={eventStoryBannerUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.event_story_banner") })}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                            priority
                                        />
                                    </div>
                                </div>
                                )}
                                {/* Title Logo */}
                                <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                    <div className="px-4 py-2 bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)]">
                                        <span className="hh-title text-sm text-[var(--hh-text-secondary)]">
                                            {t("page.events.imageTabs.logo")}
                                        </span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)]">
                                        <Image
                                            src={logoUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.logo") })}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                {/* Banner */}
                                <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                    <div className="px-4 py-2 bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)]">
                                        <span className="hh-title text-sm text-[var(--hh-text-secondary)]">
                                            {t("page.events.imageTabs.banner")}
                                        </span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)]">
                                        <Image
                                            src={bannerUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.banner") })}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                {/* Character */}
                                {showCharacterTab && (
                                <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                    <div className="px-4 py-2 bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)]">
                                        <span className="hh-title text-sm text-[var(--hh-text-secondary)]">
                                            {t("page.events.imageTabs.character")}
                                        </span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-[var(--hh-surface-sunken)]">
                                        <Image
                                            src={characterUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.character") })}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                )}
                            </div>
                        ) : (
                            /* Normal Mode: Tabs */
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                                {/* Tabs */}
                                <div className="flex border-b border-[var(--hh-border)]">
                                    {[
                                        ...(showEventStoryBannerTab ? [{ key: "event_story_banner", label: t("page.events.imageTabs.event_story_banner") }] : []),
                                        { key: "logo", label: t("page.events.imageTabs.logo") },
                                        { key: "banner", label: t("page.events.imageTabs.banner") },
                                        ...(showCharacterTab ? [{ key: "character", label: t("page.events.imageTabs.character") }] : []),
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveImageTab(tab.key as "event_story_banner" | "logo" | "banner" | "character")}
                                            className={`hh-press flex-1 py-3 px-4 text-sm font-semibold cursor-pointer ${effectiveTab === tab.key
                                                ? "text-[var(--hh-accent-deep)] border-b-2 border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]"
                                                : "text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-1)]"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Image Content */}
                                {/* See cards/[id]: `hh-press` is what puts this non-button div in
                                    reach of the global click delegation, and `confirm` marks
                                    opening the viewer as an "enter" gesture. */}
                                <div
                                    className="hh-press relative aspect-[16/9] bg-[var(--hh-surface-sunken)] cursor-zoom-in group"
                                    style={{ "--hh-press-scale": "0.99" } as CSSProperties}
                                    data-hh-sound="confirm"
                                    onClick={() => setImageViewerOpen(true)}
                                >
                                    {effectiveTab === "event_story_banner" && (
                                        <Image
                                            src={eventStoryBannerUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.event_story_banner") })}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                            priority
                                        />
                                    )}
                                    {effectiveTab === "logo" && (
                                        <Image
                                            src={logoUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.logo") })}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                            priority
                                        />
                                    )}
                                    {effectiveTab === "banner" && (
                                        <Image
                                            src={bannerUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.banner") })}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    )}
                                    {effectiveTab === "character" && showCharacterTab && (
                                        <Image
                                            src={characterUrl}
                                            alt={t("page.events.imageDetailAlt", { name: event.name, tab: t("page.events.imageTabs.character") })}
                                            fill
                                            className="object-contain"
                                            unoptimized
                                        />
                                    )}
                                    <div className="absolute bottom-3 right-3 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded-[var(--hh-radius-md)] flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        {t("page.events.clickExpand")}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {t("page.events.basicInfo")}
                                </h2>
                            </div>
                            <div className="divide-y divide-[var(--hh-border)]">
                                <InfoRow label="ID" value={<span className="hh-numeric">{`#${event.id}`}</span>} />
                                <InfoRow
                                    label={t("page.events.nameLabel")}
                                    value={
                                        <TranslatedText
                                            original={event.name}
                                            category="events"
                                            field="name"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-[var(--hh-text-tertiary)] mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow
                                    label={t("page.events.unitLabel")}
                                    value={(() => {
                                        const filterId = getEventUnitFilterId(event.id, eventUnitMap);
                                        return filterId ? t(`common.units.${filterId}`) : t("page.events.none");
                                    })()}
                                />
                                <InfoRow
                                    label={t("page.events.bannerCharLabel")}
                                    value={
                                        event.eventType === "world_bloom"
                                            ? t("page.events.none")
                                            : bannerCharId
                                            ? getCharacterName(t, bannerCharId)
                                            : t("page.events.none")
                                    }
                                />
                                <InfoRow
                                    label={t("page.events.eventTypeLabel")}
                                    value={t(`common.eventTypes.${event.eventType}`)}
                                />
                                <InfoRow label={t("page.events.startTimeLabel")} value={<span className="hh-numeric">{formatDate(event.startAt)}</span>} />
                                <InfoRow label={t("page.events.endTimeLabel")} value={<span className="hh-numeric">{formatDate(event.aggregateAt)}</span>} />
                                <InfoRow
                                    label={t("page.events.assetNameLabel")}
                                    value={<span className="font-mono text-xs bg-[var(--hh-surface-sunken)] px-2 py-0.5 rounded-[var(--hh-radius-sm)]">{event.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Event Theme Song Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    {t("page.events.bgmTitle")}
                                </h2>
                            </div>
                            <EventBgmPlayer event={event} assetSource={assetSource} />
                        </div>

                        {/* Bonus Info Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    {t("page.events.bonusTitle")}
                                </h2>
                            </div>
                            <div className="p-5 space-y-4">
                                {bonusAttr && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--hh-text-secondary)] font-medium">{t("page.events.bonusAttrLabel")}</span>
                                        <div className="flex items-center gap-2">
                                            <Image
                                                src={LOCAL_ATTR_ICONS[bonusAttr] || LOCAL_ATTR_ICONS.cool}
                                                alt={bonusAttr}
                                                width={28}
                                                height={28}
                                                unoptimized
                                            />
                                            <span className="hh-title text-sm text-[var(--hh-text-primary)]">
                                                {ATTR_NAMES[bonusAttr] || bonusAttr}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {bonusCharacters.length > 0 && (
                                    <div>
                                        <span className="text-sm text-[var(--hh-text-secondary)] font-medium block mb-2">{t("page.events.bonusCharLabel")}</span>
                                        <div className="flex flex-wrap gap-2">
                                            {bonusCharacters.map(({ charId, unitId, displayName }) => (
                                                <div
                                                    key={unitId}
                                                    className="flex items-center gap-1.5 px-2 py-1 bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] rounded-[var(--hh-radius-md)]"
                                                    title={displayName}
                                                >
                                                    <div className="w-6 h-6 rounded-[var(--hh-radius-full)] overflow-hidden bg-[var(--hh-surface-2)] ring-1 ring-[var(--hh-border)]">
                                                        <Image
                                                            src={getCharacterIconUrl(charId)}
                                                            alt={displayName}
                                                            width={24}
                                                            height={24}
                                                            className="w-full h-full object-cover"
                                                            unoptimized
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-[var(--hh-text-secondary)]">
                                                        {displayName}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Theme Songs Card */}
                        {themeSongs.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        {t("page.events.relatedSongsTitle", { count: themeSongs.length })}
                                    </h2>
                                </div>
                                <div className="p-0">
                                    {themeSongs.map((music) => (
                                        <div key={music.id} className="p-5 border-b border-[var(--hh-border)] last:border-0">
                                            <Link
                                                href={`/music/${music.id}`}
                                                className="hh-press flex items-center gap-3 p-3 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] hover:bg-[var(--hh-accent-wash)] transition-colors group"
                                            >
                                                <div className="w-12 h-12 rounded-[var(--hh-radius-md)] overflow-hidden bg-[var(--hh-surface-inset)] shrink-0">
                                                    <Image
                                                        src={getMusicJacketUrl(music.assetbundleName, assetSource)}
                                                        alt={music.title}
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="hh-title text-[var(--hh-text-primary)] truncate group-hover:text-[var(--hh-accent-deep)] transition-colors">
                                                        <TranslatedText
                                                            original={music.title}
                                                            category="music"
                                                            field="title"
                                                            originalClassName="truncate block"
                                                            translationClassName="text-xs text-[var(--hh-text-secondary)] truncate block font-normal"
                                                        />
                                                    </p>
                                                    <p className="hh-numeric text-xs text-[var(--hh-text-secondary)] font-mono">ID: {music.id}</p>
                                                </div>
                                                <svg className="w-5 h-5 text-[var(--hh-text-tertiary)] group-hover:text-[var(--hh-accent-deep)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Event Story Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden group">
                            <Link href={`/story/event/${event.id}`} className="block">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] group-hover:bg-[var(--hh-surface-sunken)] transition-colors">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        {t("page.events.storyTitle")}
                                    </h2>
                                </div>
                                <div className="p-5 flex items-center justify-between group-hover:bg-[var(--hh-surface-1)] transition-colors">
                                    <div>
                                        <p className="hh-title text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent-deep)] transition-colors">
                                            {t("page.events.storyReadBtn")}
                                        </p>
                                        <p className="text-xs text-[var(--hh-text-secondary)] mt-1">
                                            {t("page.events.storyReadDesc")}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] flex items-center justify-center group-hover:bg-[var(--hh-accent)] transition-colors">
                                        <svg className="w-4 h-4 text-[var(--hh-text-secondary)] group-hover:text-[var(--hh-text-on-accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        </div>

                        {/* Event Area Conversations Card */}
                        <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden group">
                            <Link href={`/story/area/event_${event.id}`} className="block">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] group-hover:bg-[var(--hh-surface-sunken)] transition-colors">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        {t("page.events.areaTalkTitle")}
                                    </h2>
                                </div>
                                <div className="p-5 flex items-center justify-between group-hover:bg-[var(--hh-surface-1)] transition-colors">
                                    <div>
                                        <p className="hh-title text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent-deep)] transition-colors">
                                            {t("page.events.areaTalkReadBtn")}
                                        </p>
                                        <p className="text-xs text-[var(--hh-text-secondary)] mt-1">
                                            {t("page.events.areaTalkReadDesc")}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] flex items-center justify-center group-hover:bg-[var(--hh-accent)] transition-colors">
                                        <svg className="w-4 h-4 text-[var(--hh-text-secondary)] group-hover:text-[var(--hh-text-on-accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        </div>

                        {/* Virtual Live Card */}
                        {virtualLive && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        {t("page.events.virtualLiveTitle")}
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <Link href={`/live/${virtualLive.id}`} className="block group">
                                        <div className="relative aspect-[16/5] w-full">
                                            <Image
                                                src={getVirtualLiveBannerUrl(virtualLive.assetbundleName, assetSource)}
                                                alt={virtualLive.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                unoptimized
                                            />
                                            {/* Functional scrim, not decoration: the white title below sits on
                                                an arbitrary live banner and needs this fade to stay legible. */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="hh-numeric text-[10px] font-mono bg-black/50 text-white px-2 py-0.5 rounded-[var(--hh-radius-sm)]">
                                                        Live #{virtualLive.id}
                                                    </span>
                                                </div>
                                                <h3 className="hh-title text-white text-lg truncate">
                                                    <TranslatedText
                                                        original={virtualLive.name}
                                                        category="virtualLive"
                                                        field="name"
                                                        originalClassName="truncate block"
                                                        translationClassName="text-sm font-medium text-white/90 truncate block mt-0.5"
                                                    />
                                                </h3>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Event Cards - Now in Right Column */}
                        {eventCardsWithInfo.length > 0 && (
                            <div className="hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)]">
                                    <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        {t("page.events.cardsTitle", { count: eventCardsWithInfo.length })}
                                    </h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
                                        {eventCardsWithInfo.map(({ cardId, card }) => {
                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(cardId);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail &&
                                                (card.cardRarityType === "rarity_3" || card.cardRarityType === "rarity_4"));

                                            return (
                                                <Link
                                                    key={cardId}
                                                    href={`/cards/${cardId}`}
                                                    className="group block"
                                                >
                                                    <div className="relative rounded-[var(--hh-radius-md)] overflow-hidden bg-[var(--hh-surface-2)] ring-1 ring-[var(--hh-border)] hover:ring-[var(--hh-accent)] transition-colors">
                                                        <SekaiCardThumbnail card={card as unknown as ICardInfo} trained={showTrained} className="w-full" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        <DetailPageAdCard hidden={isScreenshotMode} />
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <Link
                        href="/events"
                        className="hh-btn hh-press px-6 py-3 rounded-[var(--hh-radius-md)]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t("page.events.backToList")}
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}


function EventBgmPlayer({ event, assetSource }: { event: IEventInfo; assetSource: AssetSourceType }) {
    const { t } = useI18n();
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // Use useRef to keep track of the current audio URL to handle changes if needed, 
    // though usually event ID doesn't change without remount.
    // We get the URL directly in the render to ensure reactivity to assetSource changes
    const audioUrl = getEventBgmUrl(event.assetbundleName, assetSource);

    const togglePlay = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            audioRef.current.volume = 0.5; // Default volume
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

    // Also restart/reset if audioUrl changes (e.g. source change)
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            requestAnimationFrame(() => {
                setIsPlaying(false);
                setProgress(0);
                setDuration(0);
            });
        }
    }, [audioUrl]);

    return (
        <div className="px-5 py-4 group">
            <div className="flex items-center gap-4">
                {/* Play Button */}
                <button
                    onClick={togglePlay}
                    className={`hh-press hh-focusable shrink-0 w-12 h-12 rounded-[var(--hh-radius-full)] flex items-center justify-center cursor-pointer ${isPlaying
                        ? "bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)]"
                        : "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)]"
                        }`}
                >
                    {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="hh-title text-sm text-[var(--hh-text-primary)] truncate">
                            <span className="mr-2">{t("page.events.themeSongLabel")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Download Button */}
                            <a
                                href={audioUrl}
                                download={`${event.assetbundleName}_top.mp3`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hh-press p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-deep)] hover:bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)]"
                                title={t("page.events.downloadAudio")}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </a>
                        </div>
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
            <span className="font-semibold text-[var(--hh-text-primary)] text-right max-w-[60%]">{value}</span>
        </div>
    );
}
