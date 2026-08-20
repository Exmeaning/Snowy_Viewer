"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Modal from "@/components/common/Modal";

import BaseFilters, { FilterButton, FilterSection } from "@/components/common/BaseFilters";
import { TranslatedText } from "@/components/common/TranslatedText";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/TranslationContext";
import {
    type InformationItem,
    type InformationServer,
    type InformationStatus,
    fetchInformationList,
    getInformationBannerUrl,
    getInformationStatus,
    getInformationStatusTone,
    getInformationTagTone,
    resolveInformationPath,
    normalizeInformationServer,
} from "@/lib/information";

const ALL_FILTER = "all";
type SortKey = "displayOrder" | "startAt" | "endAt" | "id";

type SortOrder = "asc" | "desc";

const TAG_ORDER = ["information", "event", "gacha", "music", "campaign", "bug", "update"];
const TYPE_ORDER = ["normal", "content", "bug"];
const STATUS_ORDER: InformationStatus[] = ["ongoing", "permanent", "upcoming", "ended"];

function getMessageFallback(t: (key: string) => string, key: string, fallback: string) {
    const value = t(key);
    return value === key ? fallback : value;
}

function EmptyState() {
    const { t } = useI18n();

    return (
        <div className="hh-well border-dashed p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--hh-radius-lg)] bg-[var(--hh-accent-wash)] text-miku">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
            </div>
            <h3 className="hh-title mt-4 text-lg text-[var(--hh-text-primary)]">{t("page.information.emptyTitle")}</h3>
            <p className="hh-body mx-auto mt-2 max-w-md text-sm text-[var(--hh-text-secondary)]">
                {t("page.information.emptyDescription")}
            </p>
        </div>
    );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    const { t } = useI18n();

    return (
        <div className="rounded-[var(--hh-radius-lg)] border border-red-500/30 bg-red-500/12 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="hh-title text-lg text-red-600">{t("page.information.loadFailedTitle")}</h3>
                    <p className="mt-1 text-sm text-red-600/80">{message}</p>
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="hh-press hh-focusable rounded-[var(--hh-radius-md)] bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600"
                >
                    {t("common.action.retry")}
                </button>
            </div>
        </div>
    );
}

function InformationSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="hh-tile overflow-hidden rounded-[var(--hh-radius-lg)]">
                    <div className="aspect-[16/7] animate-pulse bg-[var(--hh-surface-sunken)]" />
                    <div className="space-y-3 p-4">
                        <div className="h-4 w-20 animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-4 w-5/6 animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                        <div className="h-3 w-2/3 animate-pulse rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-sunken)]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function BannerPlaceholder({ tagLabel }: { tagLabel: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(var(--color-miku-rgb),0.28),transparent_34%),linear-gradient(135deg,rgba(var(--color-miku-rgb),0.15),rgba(var(--color-comp-rgb),0.18))] text-miku">
            <div className="flex flex-col items-center gap-2 opacity-80">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 8.5h8M8 12h8M8 15.5h5" />
                </svg>
                <span className="hh-label">{tagLabel}</span>
            </div>
        </div>
    );
}

function InformationCard({
    item,
    server,
    now,
    onOpen,
}: {
    item: InformationItem;
    server: InformationServer;
    now: number;
    onOpen: (item: InformationItem) => void;
}) {
    const { t, formatDate } = useI18n();
    const [imageFailed, setImageFailed] = useState(false);
    const status = getInformationStatus(item, now);
    const bannerUrl = getInformationBannerUrl(server, item.bannerAssetbundleName);
    const tagLabel = getMessageFallback(t, `page.information.tags.${item.informationTag}`, item.informationTag);
    const typeLabel = getMessageFallback(t, `page.information.types.${item.informationType}`, item.informationType);
    const browseLabel = getMessageFallback(t, `page.information.browseTypes.${item.browseType}`, item.browseType);
    const statusLabel = t(`page.information.status.${status}`);
    const platformLabel = item.platform === "all" ? t("page.information.platformAll") : item.platform;

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

    return (
        <button
            type="button"
            onClick={() => onOpen(item)}
            data-shortcut-item="true"
            className="hh-focusable group block h-full w-full cursor-pointer rounded-[var(--hh-radius-lg)] text-left"
        >
            <article className="hh-tile hh-press flex h-full flex-col overflow-hidden rounded-[var(--hh-radius-lg)]">
                <div className="relative aspect-[16/7] overflow-hidden bg-[var(--hh-surface-sunken)]">
                    {bannerUrl && !imageFailed ? (
                        <img
                            src={bannerUrl}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={() => setImageFailed(true)}
                        />
                    ) : (
                        <BannerPlaceholder tagLabel={tagLabel} />
                    )}
                    {/* Functional scrim: the badges below are white-on-image and the
                        banner artwork is arbitrary, so the darkening has to stay. */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 opacity-80" />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                        <span className={`rounded-[var(--hh-radius-sm)] px-2.5 py-1 text-[10px] font-bold ${getInformationTagTone(item.informationTag)}`}>
                            {tagLabel}
                        </span>
                        <span className="rounded-[var(--hh-radius-sm)] bg-[rgba(16,17,20,0.72)] px-2.5 py-1 text-[10px] font-bold text-white">
                            {platformLabel}
                        </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                        <span className="hh-numeric rounded-[var(--hh-radius-sm)] bg-[rgba(16,17,20,0.72)] px-2.5 py-1 text-[10px] font-bold text-white">
                            #{item.id}
                        </span>
                        <span className={`rounded-[var(--hh-radius-sm)] px-2.5 py-1 text-[10px] font-bold ring-1 ${getInformationStatusTone(status)}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[var(--hh-text-tertiary)]">
                        <span className="rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-2 py-0.5">{typeLabel}</span>
                        <span className="rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-sunken)] px-2 py-0.5">{browseLabel}</span>
                        {item.channels && (
                            <span className="line-clamp-1 rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent-wash)] px-2 py-0.5 text-miku">{item.channels}</span>
                        )}
                    </div>

                    <h3 className="hh-title min-h-[3.5rem] text-sm text-primary-text transition group-hover:text-miku sm:text-base">
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
                            <svg className="h-3.5 w-3.5 shrink-0 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            <span className="hh-numeric truncate">{formatInfoDate(item.startAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--hh-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.75 3v2.25M17.25 3v2.25M3.75 18.75V7.5A2.25 2.25 0 0 1 6 5.25h12a2.25 2.25 0 0 1 2.25 2.25v11.25m-16.5 0A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25m-16.5 0h16.5" />
                            </svg>
                            <span className="hh-numeric truncate">{formatInfoDate(item.endAt)}</span>
                        </div>
                    </div>
                </div>
            </article>
        </button>
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
                <div className="relative h-[72vh] min-h-[28rem] overflow-hidden rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-white">
                    {!isFrameLoaded && (
                        /* Opaque: the iframe renders untinted third-party HTML, so a
                           translucent veil would show a half-painted announcement. */
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--hh-surface-1)] text-sm font-bold text-[var(--hh-text-secondary)]">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--hh-border)] border-t-[var(--hh-accent)]" />
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
                <div className="hh-well border-dashed p-8 text-center text-sm font-bold text-[var(--hh-text-secondary)]">
                    {t("page.information.emptyAnnouncementUrl")}
                </div>
            )}
        </Modal>
    );
}

export default function InformationClient() {
    const { t } = useI18n();
    const { serverSource } = useTheme();
    const { translations } = useTranslation();
    const server: InformationServer = normalizeInformationServer(serverSource);
    const [items, setItems] = useState<InformationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [tagFilter, setTagFilter] = useState(ALL_FILTER);
    const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
    const [statusFilter, setStatusFilter] = useState<typeof ALL_FILTER | InformationStatus>(ALL_FILTER);
    const [sortBy, setSortBy] = useState<SortKey>("displayOrder");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [now, setNow] = useState(() => Date.now());
    const [selectedItem, setSelectedItem] = useState<InformationItem | null>(null);

    const loadInformation = useCallback(async (targetServer: InformationServer) => {
        setLoading(true);
        setError(null);
        try {
            const list = await fetchInformationList(targetServer);
            setItems(list);
        } catch (loadError) {
            setItems([]);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setTagFilter(ALL_FILTER);
        setTypeFilter(ALL_FILTER);
        setStatusFilter(ALL_FILTER);
        void loadInformation(server);
    }, [loadInformation, server]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const tagOptions = useMemo(() => {
        const tags = [...new Set(items.map((item) => item.informationTag).filter(Boolean))];
        return tags.sort((a, b) => {
            const aIndex = TAG_ORDER.indexOf(a);
            const bIndex = TAG_ORDER.indexOf(b);
            if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            return a.localeCompare(b);
        });
    }, [items]);

    const typeOptions = useMemo(() => {
        const types = [...new Set(items.map((item) => item.informationType).filter(Boolean))];
        return types.sort((a, b) => {
            const aIndex = TYPE_ORDER.indexOf(a);
            const bIndex = TYPE_ORDER.indexOf(b);
            if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            return a.localeCompare(b);
        });
    }, [items]);

    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const normalizedSortOrder = sortOrder === "asc" ? 1 : -1;
        const titleTranslations = translations?.information?.title;

        return items
            .filter((item) => {
                const status = getInformationStatus(item, now);
                if (tagFilter !== ALL_FILTER && item.informationTag !== tagFilter) return false;
                if (typeFilter !== ALL_FILTER && item.informationType !== typeFilter) return false;
                if (statusFilter !== ALL_FILTER && status !== statusFilter) return false;
                if (!query) return true;

                const haystack = [
                    item.id,
                    item.title,
                    titleTranslations?.[item.title],
                    item.informationTag,
                    item.informationType,
                    item.platform,
                    item.channels,
                ].filter(Boolean).join(" ").toLowerCase();
                return haystack.includes(query);
            })
            .sort((a, b) => {
                const valueOf = (item: InformationItem) => {
                    if (sortBy === "endAt") return item.endAt || Number.MAX_SAFE_INTEGER;
                    return Number(item[sortBy] || 0);
                };
                const primary = (valueOf(a) - valueOf(b)) * normalizedSortOrder;
                if (primary !== 0) return primary;
                return (Number(a.startAt || 0) - Number(b.startAt || 0)) * -1;
            });
    }, [items, now, searchQuery, sortBy, sortOrder, statusFilter, tagFilter, translations, typeFilter]);

    const hasActiveFilters = searchQuery.trim() !== "" || tagFilter !== ALL_FILTER || typeFilter !== ALL_FILTER || statusFilter !== ALL_FILTER || sortBy !== "displayOrder" || sortOrder !== "desc";

    const resetFilters = () => {
        setSearchQuery("");
        setTagFilter(ALL_FILTER);
        setTypeFilter(ALL_FILTER);
        setStatusFilter(ALL_FILTER);
        setSortBy("displayOrder");
        setSortOrder("desc");
    };

    const sortOptions = [
        { id: "displayOrder", label: t("page.information.sort.displayOrder") },
        { id: "startAt", label: t("common.filter.sortByStartAt") },
        { id: "endAt", label: t("common.filter.sortByEndAt") },
        { id: "id", label: t("common.filter.sortById") },
    ];

    const quickFilterContent = (
        <BaseFilters
            title={t("page.information.filterTitle")}
            filteredCount={filteredItems.length}
            totalCount={items.length}
            countUnit={t("page.information.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("page.information.searchPlaceholder")}
            sortOptions={sortOptions}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(nextSortBy, nextSortOrder) => {
                setSortBy(nextSortBy as SortKey);
                setSortOrder(nextSortOrder);
            }}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
        >
            <FilterSection label={t("page.information.statusFilter")}>
                <div className="flex flex-wrap gap-2">
                    <FilterButton selected={statusFilter === ALL_FILTER} onClick={() => setStatusFilter(ALL_FILTER)}>
                        {t("common.filter.all")}
                    </FilterButton>
                    {STATUS_ORDER.map((status) => (
                        <FilterButton key={status} selected={statusFilter === status} onClick={() => setStatusFilter(status)}>
                            {t(`page.information.status.${status}`)}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            <FilterSection label={t("page.information.tagFilter")}>
                <div className="flex flex-wrap gap-2">
                    <FilterButton selected={tagFilter === ALL_FILTER} onClick={() => setTagFilter(ALL_FILTER)}>
                        {t("common.filter.all")}
                    </FilterButton>
                    {tagOptions.map((tag) => (
                        <FilterButton key={tag} selected={tagFilter === tag} onClick={() => setTagFilter(tag)}>
                            {getMessageFallback(t, `page.information.tags.${tag}`, tag)}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            <FilterSection label={t("page.information.typeFilter")}>
                <div className="flex flex-wrap gap-2">
                    <FilterButton selected={typeFilter === ALL_FILTER} onClick={() => setTypeFilter(ALL_FILTER)}>
                        {t("common.filter.all")}
                    </FilterButton>
                    {typeOptions.map((type) => (
                        <FilterButton key={type} selected={typeFilter === type} onClick={() => setTypeFilter(type)}>
                            {getMessageFallback(t, `page.information.types.${type}`, type)}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>
        </BaseFilters>
    );

    useQuickFilter(t("page.information.filterTitle"), quickFilterContent, [
        searchQuery,
        tagFilter,
        typeFilter,
        statusFilter,
        sortBy,
        sortOrder,
        hasActiveFilters,
        tagOptions,
        typeOptions,
        items.length,
        filteredItems.length,
        t,
    ]);

    return (
        <MainLayout>
            <div className="container mx-auto max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-4 py-2">
                        <span className="hh-label text-miku">{t("page.information.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl text-primary-text sm:text-4xl">
                        {t("page.information.title")} <span className="text-miku">{t("page.information.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body mx-auto mt-2 max-w-2xl text-sm text-[var(--hh-text-secondary)] sm:text-base">
                        {t("page.information.description")}
                    </p>
                </div>

                <section className="w-full min-w-0">
                    {loading ? (
                        <InformationSkeleton />
                    ) : error ? (
                        <ErrorState message={error} onRetry={() => void loadInformation(server)} />
                    ) : filteredItems.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredItems.map((item) => (
                                <InformationCard
                                    key={`${server}-${item.id}`}
                                    item={item}
                                    server={server}
                                    now={now}
                                    onOpen={setSelectedItem}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
            <AnnouncementModal
                item={selectedItem}
                server={server}
                onClose={() => setSelectedItem(null)}
            />
        </MainLayout>
    );
}
