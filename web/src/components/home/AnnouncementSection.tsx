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

function getMessageFallback(t: (key: string) => string, key: string, fallback: string) {
    const value = t(key);
    return value === key ? fallback : value;
}

function BannerPlaceholder({ tagLabel }: { tagLabel: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(var(--color-miku-rgb),0.28),transparent_34%),linear-gradient(135deg,rgba(var(--color-miku-rgb),0.15),rgba(var(--color-comp-rgb),0.18))] text-miku">
            <div className="flex flex-col items-center gap-2 opacity-80">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8.5h8M8 12h8M8 15.5h5" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tagLabel}</span>
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
                <div className="relative h-[72vh] min-h-[28rem] overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-inner shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-950">
                    {!isFrameLoaded && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 text-sm font-bold text-slate-500 backdrop-blur-sm dark:bg-slate-950/80 dark:text-slate-400">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-miku/20 border-t-miku" />
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
                <div className="rounded-2xl border border-dashed border-slate-300/70 bg-slate-50/80 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900/45 dark:text-slate-400">
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
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
                {SERVERS.map((server) => (
                    <button
                        key={server.id}
                        onClick={() => setActiveServer(server.id)}
                        className={`
                            px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer select-none border
                            ${activeServer === server.id
                                ? "bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20 border-miku"
                                : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50"
                            }
                        `}
                    >
                        {t(server.labelKey)}
                    </button>
                ))}
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="ios-glass-card overflow-hidden rounded-2xl border-none">
                            <div className="aspect-[16/7] animate-pulse bg-slate-200/30 dark:bg-slate-800/50" />
                            <div className="space-y-3 p-4">
                                <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200/40 dark:bg-slate-800/70" />
                                <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200/40 dark:bg-slate-800/70" />
                                <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200/40 dark:bg-slate-800/70" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="p-8 text-center bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 backdrop-blur-xl">
                    <p className="font-bold mb-2">{t("page.home.announcements.loadFailedTitle")}</p>
                    <p className="text-sm opacity-80">{error}</p>
                    <button
                        onClick={() => setActiveServer(activeServer)}
                        className="mt-4 px-4 py-2 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        {t("common.action.retry")}
                    </button>
                </div>
            ) : announcements.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50/40 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/50 backdrop-blur-xl">
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
                                className="group block h-full w-full cursor-pointer rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-miku/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 transition-transform duration-300 hover:-translate-y-1"
                            >
                                <article className="ios-glass-card ios-glass-card-interactive flex h-full flex-col overflow-hidden rounded-2xl border-none">
                                    <div className="relative aspect-[16/7] overflow-hidden bg-slate-100 dark:bg-slate-900/70">
                                        {hasBanner ? (
                                            <img
                                                src={bannerUrl}
                                                alt={item.title}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : (
                                            <BannerPlaceholder tagLabel={tagLabel} />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 opacity-80" />
                                        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black shadow-lg ${getInformationTagTone(item.informationTag)}`}>
                                                {tagLabel}
                                            </span>
                                            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur-md">
                                                {platformLabel}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                                            <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-mono font-black text-white backdrop-blur-md">
                                                #{item.id}
                                            </span>
                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 backdrop-blur-md ${getInformationStatusTone(status)}`}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-1 flex-col p-4">
                                        <h3 className="min-h-[2.75rem] text-sm font-black leading-snug text-primary-text transition group-hover:text-miku sm:text-base">
                                            <TranslatedText
                                                original={item.title}
                                                category="information"
                                                field="title"
                                                originalClassName="line-clamp-2"
                                                translationClassName="line-clamp-1 text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5"
                                            />
                                        </h3>

                                        <div className="mt-3 space-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <svg className="h-3.5 w-3.5 shrink-0 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                                <span className="truncate">{formatInfoDate(item.startAt)}</span>
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
