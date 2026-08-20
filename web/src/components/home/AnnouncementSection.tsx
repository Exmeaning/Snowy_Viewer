"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";
import {
    type InformationItem,
    type InformationServer,
    fetchInformationList,
    getInformationBannerUrl,
    getInformationStatus,
    getInformationStatusTone,
    getInformationTagTone,
    resolveInformationPath,
    normalizeInformationServer,
} from "@/lib/information";
import { TranslatedText } from "@/components/common/TranslatedText";
import Modal from "@/components/common/Modal";

const SERVERS: { id: InformationServer; labelKey: string }[] = [
    { id: "jp", labelKey: "page.information.servers.jp" },
    { id: "cn", labelKey: "page.information.servers.cn" },
];

const cache: Record<InformationServer, { items: InformationItem[]; timestamp: number }> = {
    jp: { items: [], timestamp: 0 },
    cn: { items: [], timestamp: 0 },
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

/**
 * Badge sitting on top of a banner image.
 *
 * bg-black/70 replaces /45 + backdrop-blur-md: the blur was what separated the
 * white text from the artwork, so flattening it required raising the plate's own
 * opacity instead. Hardcoded black is correct here — it is a plate over a photo,
 * not a themed surface.
 */
const BANNER_BADGE_CLASS =
    "rounded-[var(--hh-radius-xs)] bg-black/70 px-2.5 py-1 text-[10px] font-black text-white";

/**
 * The .hh-tile recipe spelled out, for tiles whose edge changes on hover.
 *
 * handheld-os.css is unlayered and Tailwind's utilities live in `@layer
 * utilities`, so `.hh-tile`'s `border` shorthand outranks a
 * `group-hover:border-*` written next to it and the hover edge would never
 * appear. Writing the surface by hand keeps border-color in the layered cascade
 * where the hover variant can actually win.
 */
const CARD_SURFACE_CLASS =
    "bg-[var(--hh-surface-2)] border border-[var(--hh-border)] rounded-[var(--hh-radius-lg)] " +
    "shadow-[var(--hh-shadow-tile)] text-[var(--hh-text-primary)]";

function getMessageFallback(t: (key: string) => string, key: string, fallback: string) {
    const value = t(key);
    return value === key ? fallback : value;
}

function BannerPlaceholder({ tagLabel }: { tagLabel: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-[var(--hh-accent-wash)] text-[var(--hh-accent-deep)]">
            <div className="flex flex-col items-center gap-2">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8.5h8M8 12h8M8 15.5h5" />
                </svg>
                <span className="hh-label text-[10px]">{tagLabel}</span>
            </div>
        </div>
    );
}

function AnnouncementModal({
    item,
    server,
    onClose,
}: {
    item: InformationItem | null;
    server: InformationServer;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const { t: translateGameData } = useTranslation();
    const [loadedFrameUrl, setLoadedFrameUrl] = useState<string | null>(null);
    const frameUrl = item ? resolveInformationPath(server, item) : "";
    const isFrameLoaded = frameUrl !== "" && loadedFrameUrl === frameUrl;
    const translatedTitle = item ? translateGameData("information", "title", item.title) : null;
    const modalTitle = item
        ? translatedTitle ? `${item.title} / ${translatedTitle}` : item.title
        : t("page.information.latestAnnouncements");

    return (
        <Modal
            isOpen={!!item}
            onClose={onClose}
            title={modalTitle}
            size="xl"
        >
            {frameUrl ? (
                <div className="relative h-[72vh] min-h-[28rem] overflow-hidden rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)]">
                    {!isFrameLoaded && (
                        /* Fully opaque, not a translucent veil: the iframe paints its
                           own white page underneath, and a semi-transparent cover
                           would let a half-rendered announcement bleed through. */
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--hh-surface-1)] text-sm font-bold text-[var(--hh-text-secondary)]">
                            <div className="h-8 w-8 animate-spin rounded-[var(--hh-radius-full)] border-4 border-[var(--hh-border)] border-t-[var(--hh-accent)]" />
                            <span>{t("page.information.loadingAnnouncement")}</span>
                        </div>
                    )}
                    <iframe
                        key={frameUrl}
                        src={frameUrl}
                        title={modalTitle}
                        className="h-full w-full bg-white"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onLoad={() => setLoadedFrameUrl(frameUrl)}
                    />
                </div>
            ) : (
                /* Written out rather than `.hh-well border-dashed`: .hh-well's
                   `border` shorthand is unlayered and would reset the style back
                   to solid, so the dashed edge has to be authored here. */
                <div className="rounded-[var(--hh-radius-lg)] border border-dashed border-[var(--hh-border-strong)] bg-[var(--hh-surface-sunken)] p-8 text-center text-sm font-bold text-[var(--hh-text-secondary)]">
                    {t("page.information.emptyAnnouncementUrl")}
                </div>
            )}
        </Modal>
    );
}

export default function AnnouncementSection() {
    const { t, formatDate } = useI18n();
    const { serverSource } = useTheme();
    const [activeServer, setActiveServer] = useState<InformationServer>(normalizeInformationServer(serverSource));
    const [announcements, setAnnouncements] = useState<InformationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<InformationItem | null>(null);
    const [imageFailures, setImageFailures] = useState<Record<number, boolean>>({});

    // Sync activeServer with serverSource on mount or when serverSource changes
    useEffect(() => {
        setActiveServer(normalizeInformationServer(serverSource));
    }, [serverSource]);

    useEffect(() => {
        let isMounted = true;
        async function fetchAnnouncements() {
            try {
                // Check Cache
                if (cache[activeServer] && Date.now() - cache[activeServer].timestamp < CACHE_DURATION) {
                    if (isMounted) {
                        setAnnouncements(cache[activeServer].items);
                        setIsLoading(false);
                    }
                    return;
                }

                if (isMounted) {
                    setIsLoading(true);
                    setError(null);
                }

                const list = await fetchInformationList(activeServer);
                // Sort by displayOrder desc, startAt desc
                const sortedList = [...list].sort((a, b) => {
                    if (b.displayOrder !== a.displayOrder) {
                        return b.displayOrder - a.displayOrder;
                    }
                    return b.startAt - a.startAt;
                });

                // Take top 3
                const top3 = sortedList.slice(0, 3);

                cache[activeServer] = {
                    items: top3,
                    timestamp: Date.now()
                };

                if (isMounted) {
                    setAnnouncements(top3);
                }
            } catch (err) {
                console.error("Failed to fetch announcements:", err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : t("page.home.announcements.loadFailedTitle"));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchAnnouncements();
        return () => {
            isMounted = false;
        };
    }, [activeServer, t]);

    const formatInfoDate = (timestamp?: number | null) => {
        if (!timestamp) return t("page.information.noEndAt");
        return formatDate(timestamp, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleImageError = (id: number) => {
        setImageFailures((prev) => ({ ...prev, [id]: true }));
    };

    const now = Date.now();

    return (
        <div>
            {/* Server Switcher */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {SERVERS.map((server) => (
                    <button
                        key={server.id}
                        onClick={() => setActiveServer(server.id)}
                        className={`hh-press hh-focusable px-5 py-2 rounded-[var(--hh-radius-md)] text-sm font-semibold cursor-pointer select-none border ${activeServer === server.id
                            ? "bg-[var(--hh-accent)] border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                            : "bg-[var(--hh-surface-2)] border-[var(--hh-border)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                            }`}
                    >
                        {t(server.labelKey)}
                    </button>
                ))}
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`${CARD_SURFACE_CLASS} overflow-hidden`}>
                            <div className="aspect-[16/7] animate-pulse bg-[var(--hh-surface-sunken)]" />
                            <div className="space-y-3 p-4">
                                <div className="h-4 w-20 animate-pulse rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)]" />
                                <div className="h-4 w-5/6 animate-pulse rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)]" />
                                <div className="h-3 w-2/3 animate-pulse rounded-[var(--hh-radius-xs)] bg-[var(--hh-surface-sunken)]" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="p-8 text-center rounded-[var(--hh-radius-lg)] bg-[var(--hh-surface-2)] border border-[var(--hh-accent-alert)] text-[var(--hh-text-primary)]">
                    <p className="font-bold mb-2 text-[var(--hh-accent-alert)]">{t("page.home.announcements.loadFailedTitle")}</p>
                    <p className="text-sm text-[var(--hh-text-secondary)]">{error}</p>
                    <button
                        onClick={() => setActiveServer(activeServer)}
                        className="hh-btn hh-press hh-focusable mt-4 cursor-pointer text-sm"
                    >
                        {t("common.action.retry")}
                    </button>
                </div>
            ) : announcements.length === 0 ? (
                <div className="hh-well p-12 text-center text-[var(--hh-text-tertiary)]">
                    {t("page.home.announcements.noData")}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {announcements.map((item) => {
                        const status = getInformationStatus(item, now);
                        const bannerUrl = getInformationBannerUrl(activeServer, item.bannerAssetbundleName);
                        const tagLabel = getMessageFallback(t, `page.information.tags.${item.informationTag}`, item.informationTag);
                        const statusLabel = t(`page.information.status.${status}`);
                        const platformLabel = item.platform === "all" ? t("page.information.platformAll") : item.platform;
                        const hasBanner = bannerUrl && !imageFailures[item.id];

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelectedItem(item)}
                                className="hh-press hh-focusable group block h-full w-full cursor-pointer rounded-[var(--hh-radius-lg)] text-left"
                            >
                                <article className={`${CARD_SURFACE_CLASS} flex h-full flex-col overflow-hidden transition-colors duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] group-hover:border-[var(--hh-accent)]`}>
                                    <div className="relative aspect-[16/7] overflow-hidden bg-[var(--hh-surface-sunken)]">
                                        {hasBanner ? (
                                            <img
                                                src={bannerUrl}
                                                alt={item.title}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : (
                                            <BannerPlaceholder tagLabel={tagLabel} />
                                        )}
                                        {/* Functional scrim: the four badges below are white
                                            text laid directly over an arbitrary banner image,
                                            so the corners need darkening to stay readable. */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />
                                        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                                            <span className={`rounded-[var(--hh-radius-xs)] px-2.5 py-1 text-[10px] font-black ${getInformationTagTone(item.informationTag)}`}>
                                                {tagLabel}
                                            </span>
                                            <span className={BANNER_BADGE_CLASS}>
                                                {platformLabel}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                                            <span className={`${BANNER_BADGE_CLASS} hh-numeric`}>
                                                #{item.id}
                                            </span>
                                            <span className={`rounded-[var(--hh-radius-xs)] px-2.5 py-1 text-[10px] font-black ring-1 ${getInformationStatusTone(status)}`}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-1 flex-col p-4">
                                        <h3 className="min-h-[2.75rem] text-sm font-bold leading-snug text-[var(--hh-text-primary)] sm:text-base">
                                            <TranslatedText
                                                original={item.title}
                                                category="information"
                                                field="title"
                                                originalClassName="line-clamp-2"
                                                translationClassName="line-clamp-1 text-xs font-bold text-[var(--hh-text-tertiary)] mt-0.5"
                                            />
                                        </h3>

                                        <div className="mt-3 space-y-1.5 text-[11px] font-medium text-[var(--hh-text-secondary)]">
                                            <div className="flex items-center gap-2">
                                                <svg className="h-3.5 w-3.5 shrink-0 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                                <span className="truncate hh-numeric">{formatInfoDate(item.startAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Details Modal */}
            <AnnouncementModal
                item={selectedItem}
                server={activeServer}
                onClose={() => setSelectedItem(null)}
            />
        </div>
    );
}
