"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";

import MainLayout from "@/components/MainLayout";
import PageHeader from "@/components/common/PageHeader";
import BaseFilters, { FilterSection, FilterButton } from "@/components/common/BaseFilters";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import Modal from "@/components/common/Modal";
import ExternalLink from "@/components/ExternalLink";
import AssetTosModal from "@/components/common/AssetTosModal";
import LocalizedLink from "@/components/LocalizedLink";
import { HandheldEmptyState } from "@/components/handheld";

// ==================== Types (matching the assets gateway responses) ====================

export interface AssetVersionItem {
    assetVersion: string;
    appVersion: string;
    assetHash?: string;
    bundleCount: number;
    committedAt: number; // unix seconds
    changedAssets: number;
    /** Client COMMIT stats passthrough — keys are not guaranteed to be stable */
    stats?: Record<string, number>;
    diffUrl?: string;
}

export interface AssetVersionsResponse {
    server: string;
    limit: number;
    nextCursor?: string;
    items: AssetVersionItem[];
}

export interface AssetDiffItem {
    changeType: "added" | "updated";
    path: string;
    url: string;
    source?: string;
    size?: number;
    fingerprint?: string;
    sha256?: string;
    bundlePath?: string;
}

export interface AssetDiffResponse {
    server: string;
    assetVersion: string;
    appVersion: string;
    assetHash?: string;
    committedAt: number;
    types?: string[];
    totalChanged: number;
    limit: number;
    nextCursor?: string;
    items: AssetDiffItem[];
}

type AssetDiffMeta = Omit<AssetDiffResponse, "items" | "nextCursor" | "limit">;

const SERVERS = ["jp", "en", "tw", "kr", "cn"] as const;
const VERSIONS_PAGE_LIMIT = 20;
const DIFF_PAGE_LIMIT = 200;

// Known COMMIT stat keys → i18n labels; unknown keys fall back to the raw name
const STAT_LABEL_KEYS: Record<string, string> = {
    SkippedByLayer1: "page.assetVersions.stats.skippedByLayer1",
    SkippedByCheck: "page.assetVersions.stats.skippedByCheck",
    UploadedShared: "page.assetVersions.stats.uploadedShared",
    UploadedOverride: "page.assetVersions.stats.uploadedOverride",
};

// Upload-kind chips keep their semantic hues; the neutral fallback moves onto
// system surfaces so it stops competing with them.
const STAT_CHIP_CLASSES: Record<string, string> = {
    UploadedOverride: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    UploadedShared: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};
const STAT_CHIP_DEFAULT = "bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border-[var(--hh-border)]";

function formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileExtension(path: string): string {
    const name = path.split("/").pop() || "";
    const dot = name.lastIndexOf(".");
    return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isImagePath(path: string): boolean {
    return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(getFileExtension(path));
}

function isAudioPath(path: string): boolean {
    return ["mp3", "wav", "ogg", "m4a", "flac"].includes(getFileExtension(path));
}

function isTextPath(path: string): boolean {
    return ["json", "txt", "csv", "xml", "yaml", "yml"].includes(getFileExtension(path));
}

function AssetVersionsContent() {
    const { assetSource } = useTheme();
    const { t, formatNumber, formatDate } = useI18n();

    // ==================== Query states (synced to URL) ====================

    const [server, setServer] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const queryServer = params.get("server");
            if (queryServer) return queryServer;

            const savedServer = localStorage.getItem("server-source");
            if (savedServer === "en" || savedServer === "jp" || savedServer === "cn" || savedServer === "tw" || savedServer === "kr") {
                return savedServer;
            }
            return "jp";
        }
        return "jp";
    });
    // Selected version — empty string means the version timeline view
    const [version, setVersion] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("version") || "";
        }
        return "";
    });

    const [typeFilter, setTypeFilter] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const types = params.get("types");
            if (types) return types;
        }
        return "default";
    });

    const [showTos, setShowTos] = useState(false);

    // Sync state to URL query parameters (write-only)
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("server", server);
        if (version) {
            url.searchParams.set("version", version);
            if (typeFilter !== "default") {
                url.searchParams.set("types", typeFilter);
            } else {
                url.searchParams.delete("types");
            }
        } else {
            url.searchParams.delete("version");
            url.searchParams.delete("action");
            url.searchParams.delete("types");
        }
        window.history.replaceState({}, "", url.toString());
    }, [server, version, typeFilter]);

    // Handle back/forward navigation
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const serverParam = params.get("server");
            if (serverParam) {
                setServer(serverParam);
            }
            setVersion(params.get("version") || "");
            setTypeFilter(params.get("types") || "default");
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Versions are server-specific, so switching servers exits the diff view
    const handleServerChange = useCallback((srv: string) => {
        setServer(srv);
        setVersion("");
    }, []);

    const gatewayDomain = useMemo(() => {
        return assetSource === "overseas" ? "https://storage.pjsk.moe" : "https://storage.exmeaning.com";
    }, [assetSource]);

    // ==================== Version timeline states ====================

    const [versions, setVersions] = useState<AssetVersionItem[]>([]);
    const [versionsCursor, setVersionsCursor] = useState<string>("");
    const [isVersionsLoading, setIsVersionsLoading] = useState(true);
    const [isVersionsLoadingMore, setIsVersionsLoadingMore] = useState(false);
    const [versionsError, setVersionsError] = useState<string | null>(null);

    const fetchVersions = useCallback(async () => {
        try {
            setIsVersionsLoading(true);
            setVersionsError(null);
            const url = `${gatewayDomain}/api/assets/versions?server=${server}&limit=${VERSIONS_PAGE_LIMIT}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetVersionsResponse = await res.json();
            setVersions(data.items || []);
            setVersionsCursor(data.nextCursor || "");
        } catch (err) {
            console.error("Failed to load asset versions:", err);
            setVersionsError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsVersionsLoading(false);
        }
    }, [server, gatewayDomain]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const fetchMoreVersions = useCallback(async () => {
        if (!versionsCursor || isVersionsLoadingMore) return;
        try {
            setIsVersionsLoadingMore(true);
            const url = `${gatewayDomain}/api/assets/versions?server=${server}&limit=${VERSIONS_PAGE_LIMIT}&cursor=${encodeURIComponent(versionsCursor)}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetVersionsResponse = await res.json();
            setVersions(prev => [...prev, ...(data.items || [])]);
            setVersionsCursor(data.nextCursor || "");
        } catch (err) {
            console.error("Failed to load more asset versions:", err);
        } finally {
            setIsVersionsLoadingMore(false);
        }
    }, [server, gatewayDomain, versionsCursor, isVersionsLoadingMore]);

    // ==================== Diff states ====================

    const [diffMeta, setDiffMeta] = useState<AssetDiffMeta | null>(null);
    const [diffItems, setDiffItems] = useState<AssetDiffItem[]>([]);
    const [diffCursor, setDiffCursor] = useState<string>("");
    const [isDiffLoading, setIsDiffLoading] = useState(false);
    const [isDiffLoadingMore, setIsDiffLoadingMore] = useState(false);
    const [diffError, setDiffError] = useState<string | null>(null);

    // Diff filters
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"size" | "path">("size");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Selected file detail modal
    const [selectedFile, setSelectedFile] = useState<AssetDiffItem | null>(null);
    const [previewText, setPreviewText] = useState<string | null>(null);
    const [isPreviewTextLoading, setIsPreviewTextLoading] = useState(false);
    const [previewTextError, setPreviewTextError] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);

    const fetchDiff = useCallback(async () => {
        if (!version) return;
        try {
            setIsDiffLoading(true);
            setDiffError(null);
            setDiffItems([]);
            setDiffMeta(null);

            let url = `${gatewayDomain}/api/assets/diff?server=${server}&version=${encodeURIComponent(version)}&limit=${DIFF_PAGE_LIMIT}`;
            if (typeFilter && typeFilter !== "default") {
                url += `&types=${encodeURIComponent(typeFilter)}`;
            }

            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetDiffResponse = await res.json();
            setDiffMeta({
                server: data.server,
                assetVersion: data.assetVersion,
                appVersion: data.appVersion,
                assetHash: data.assetHash,
                committedAt: data.committedAt,
                types: data.types,
                totalChanged: data.totalChanged,
            });
            setDiffItems(data.items || []);
            setDiffCursor(data.nextCursor || "");
        } catch (err) {
            console.error("Failed to load asset diff:", err);
            setDiffError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsDiffLoading(false);
        }
    }, [server, version, typeFilter, gatewayDomain]);

    useEffect(() => {
        fetchDiff();
    }, [fetchDiff]);

    const fetchMoreDiff = useCallback(async () => {
        if (!version || !diffCursor || isDiffLoadingMore) return;
        try {
            setIsDiffLoadingMore(true);

            let url = `${gatewayDomain}/api/assets/diff?server=${server}&version=${encodeURIComponent(version)}&limit=${DIFF_PAGE_LIMIT}&cursor=${encodeURIComponent(diffCursor)}`;
            if (typeFilter && typeFilter !== "default") {
                url += `&types=${encodeURIComponent(typeFilter)}`;
            }

            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetDiffResponse = await res.json();
            setDiffItems(prev => [...prev, ...(data.items || [])]);
            setDiffCursor(data.nextCursor || "");
        } catch (err) {
            console.error("Failed to load more asset diff entries:", err);
        } finally {
            setIsDiffLoadingMore(false);
        }
    }, [server, version, typeFilter, gatewayDomain, diffCursor, isDiffLoadingMore]);

    // ==================== Diff filtering & pagination ====================

    const processedDiffItems = useMemo(() => {
        let list = [...diffItems];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item => item.path.toLowerCase().includes(query));
        }

        const isAsc = sortOrder === "asc";
        if (sortBy === "path") {
            list.sort((a, b) => isAsc ? a.path.localeCompare(b.path) : b.path.localeCompare(a.path));
        } else {
            list.sort((a, b) => {
                const sizeA = a.size || 0;
                const sizeB = b.size || 0;
                return isAsc ? sizeA - sizeB : sizeB - sizeA;
            });
        }

        return list;
    }, [diffItems, searchQuery, sortBy, sortOrder]);

    const isDiffView = version !== "";
    const hasActiveDiffFilters = searchQuery !== "" || typeFilter !== "default" || sortBy !== "size" || sortOrder !== "desc";

    const resetFilters = useCallback(() => {
        setSearchQuery("");
        setTypeFilter("default");
        setSortBy("size");
        setSortOrder("desc");
    }, []);

    // Reset diff filters when leaving / switching versions
    useEffect(() => {
        resetFilters();
    }, [version, resetFilters]);

    // ==================== File preview helpers ====================

    const handleFetchPreviewText = async (file: AssetDiffItem) => {
        if (!file.url) return;
        try {
            setIsPreviewTextLoading(true);
            setPreviewTextError(null);
            setPreviewText(null);

            const res = await fetch(`${gatewayDomain}${file.url}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const content = await res.text();

            try {
                const parsed = JSON.parse(content);
                setPreviewText(JSON.stringify(parsed, null, 2));
            } catch {
                setPreviewText(content);
            }
        } catch (err) {
            console.error("Error loading text preview:", err);
            setPreviewTextError(err instanceof Error ? err.message : "Failed to load text preview");
        } finally {
            setIsPreviewTextLoading(false);
        }
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
        });
    };

    // ==================== Sidebar filters ====================

    const quickFilterContent = (
        <BaseFilters
            filteredCount={isDiffView ? processedDiffItems.length : versions.length}
            totalCount={isDiffView ? diffItems.length : versions.length}
            countUnit={isDiffView ? t("page.assetVersions.fileUnit") : t("page.assetVersions.versionUnit")}
            searchQuery={searchQuery}
            onSearchChange={isDiffView ? setSearchQuery : undefined}
            searchPlaceholder={t("page.assetVersions.searchPlaceholder")}
            showSearch={isDiffView}
            sortOptions={isDiffView ? [
                { id: "size", label: t("page.assetVersions.size") },
                { id: "path", label: t("page.assetVersions.path") },
            ] : undefined}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={isDiffView ? (field, order) => {
                setSortBy(field as "size" | "path");
                setSortOrder(order);
            } : undefined}
            hasActiveFilters={isDiffView && hasActiveDiffFilters}
            onReset={resetFilters}
        >
            <FilterSection label={t("page.assetVersions.serverSelect")}>
                <div className="grid grid-cols-3 gap-2">
                    {SERVERS.map(srv => (
                        <FilterButton
                            key={srv}
                            selected={server === srv}
                            onClick={() => handleServerChange(srv)}
                        >
                            {t(`settings.serverSource.${srv}`) || srv.toUpperCase()}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            {isDiffView && (
                <FilterSection label={t("page.assetVersions.fileTypeLabel")}>
                    <div className="grid grid-cols-3 gap-2">
                        <FilterButton
                            selected={typeFilter === "all" || typeFilter === "default"}
                            onClick={() => setTypeFilter("all")}
                        >
                            {t("page.assetVersions.filterAll")}
                        </FilterButton>
                        <FilterButton
                            selected={typeFilter === "webp"}
                            onClick={() => setTypeFilter("webp")}
                        >
                            webp
                        </FilterButton>
                        <FilterButton
                            selected={typeFilter === "mp3"}
                            onClick={() => setTypeFilter("mp3")}
                        >
                            mp3
                        </FilterButton>
                    </div>
                </FilterSection>
            )}


        </BaseFilters>
    );

    useQuickFilter(t("page.assetVersions.title"), quickFilterContent, [
        server,
        version,
        searchQuery,
        typeFilter,
        sortBy,
        sortOrder,
        processedDiffItems.length,
        diffItems.length,
        versions.length,
        diffMeta,
        diffCursor,
        t,
    ]);

    // ==================== Modal header actions ====================

    const modalHeaderActions = useMemo(() => {
        if (!selectedFile?.url) return null;
        return (
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => handleCopyToClipboard(`${gatewayDomain}${selectedFile.url}`)}
                    className="hh-press hh-focusable p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] transition-colors flex items-center justify-center animate-in fade-in duration-200"
                    title={copyFeedback ? t("page.assetVersions.copied") : t("page.assetVersions.copyLink")}
                >
                    <span className="relative block w-4 h-4">
                        <svg
                            className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${copyFeedback ? "opacity-0 scale-75" : "opacity-100 scale-100"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <svg
                            className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${copyFeedback ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </span>
                </button>
                <ExternalLink
                    href={`${gatewayDomain}${selectedFile.url}`}
                    className="hh-press hh-focusable p-1.5 text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-deep)] hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] transition-colors flex items-center justify-center"
                    title={t("page.assetVersions.download")}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </ExternalLink>
            </div>
        );
    }, [selectedFile, gatewayDomain, copyFeedback, t]);

    // ==================== Shared render helpers ====================

    const renderStatChips = (stats: Record<string, number> | undefined, wrapperClassName: string) => {
        const entries = Object.entries(stats || {}).filter(([key, value]) => value > 0 && key !== "SkippedByCheck");
        if (entries.length === 0) return null;
        return (
            <div className={`flex flex-wrap items-center gap-1.5 ${wrapperClassName}`}>
                {entries.map(([key, value]) => {
                    const labelKey = STAT_LABEL_KEYS[key];
                    return (
                        <span
                            key={key}
                            className={`hh-numeric px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] border ${STAT_CHIP_CLASSES[key] || STAT_CHIP_DEFAULT}`}
                        >
                            {labelKey ? t(labelKey) : key} {formatNumber(value)}
                        </span>
                    );
                })}
            </div>
        );
    };

    const renderChangeTypeBadge = (changeType: AssetDiffItem["changeType"]) => (
        <span
            className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] border uppercase tracking-wide ${
                changeType === "added"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            }`}
        >
            {changeType === "added" ? t("page.assetVersions.changeAdded") : t("page.assetVersions.changeUpdated")}
        </span>
    );

    const formatCommittedAt = (committedAt: number) =>
        formatDate(new Date(committedAt * 1000), {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });

    const selectedVersionMeta = useMemo(() => {
        if (!isDiffView) return null;
        return versions.find(v => v.assetVersion === version) || null;
    }, [isDiffView, versions, version]);

    // ==================== Render ====================

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* The ToS trigger is embedded mid-sentence in the description, which
                is why `description` takes a ReactNode instead of a string. */}
            <PageHeader
                badge={t("page.assetVersions.badge")}
                title={t("page.assetVersions.title")}
                titleHighlight={t("page.assetVersions.titleHighlight")}
                description={
                    <>
                        {t("page.assetVersions.descriptionPrefix")}
                        <button
                            onClick={() => setShowTos(true)}
                            className="hh-focusable text-[var(--hh-accent-deep)] hover:underline font-medium mx-1"
                        >
                            {t("page.assetVersions.descriptionLink")}
                        </button>
                        {t("page.assetVersions.descriptionSuffix")}
                    </>
                }
            />

            <div className="w-full min-w-0">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 hh-tile rounded-[var(--hh-radius-lg)]">
                    <div className="flex items-center gap-2 min-w-0">
                        {isDiffView && (
                            <button
                                onClick={() => setVersion("")}
                                className="hh-press hh-focusable p-1.5 hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] transition-colors"
                                title={t("page.assetVersions.backToList")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[var(--hh-text-secondary)] min-w-0">
                            <button
                                onClick={() => setVersion("")}
                                className={`hh-focusable transition-colors hover:text-[var(--hh-accent-deep)] ${!isDiffView ? "text-[var(--hh-text-primary)] font-bold" : ""}`}
                            >
                                {t("page.assetVersions.timeline")}
                            </button>
                            {isDiffView && (
                                <>
                                    <span className="text-[var(--hh-text-tertiary)]">/</span>
                                    {/* Asset versions are compared digit by digit, so the breadcrumb
                                        copy of the version stays tabular too. */}
                                    <span className="hh-numeric text-[var(--hh-text-primary)] font-bold truncate">{version}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <LocalizedLink
                            href={`/asset-viewer?server=${server}`}
                            className="hh-press hh-focusable p-1.5 hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] transition-colors"
                            title={t("layout.nav.items.assetViewer")}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </LocalizedLink>

                        <button
                            onClick={isDiffView ? fetchDiff : fetchVersions}
                            className="hh-press hh-focusable p-1.5 hover:bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-md)] text-[var(--hh-text-tertiary)] hover:text-[var(--hh-text-primary)] transition-colors"
                            title={t("common.action.refresh")}
                        >
                            <svg className={`w-4 h-4 ${(isDiffView ? isDiffLoading : isVersionsLoading) ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                    </div>
                </div>

                {!isDiffView ? (
                    /* ==================== Version Timeline View ==================== */
                    isVersionsLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : versionsError ? (
                        <div className="p-6 text-center hh-tile border-red-500/30 bg-red-500/5 rounded-[var(--hh-radius-lg)]">
                            <p className="text-red-500 font-bold mb-3">{t("page.assetVersions.loadFailed")}</p>
                            <p className="text-[var(--hh-text-secondary)] text-xs mb-4">{versionsError}</p>
                            <button
                                onClick={fetchVersions}
                                className="hh-btn hh-btn-primary hh-press hh-focusable px-4 py-2 text-xs"
                            >
                                {t("common.action.retry")}
                            </button>
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="p-12 text-center hh-well rounded-[var(--hh-radius-lg)] text-[var(--hh-text-tertiary)]">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>{t("page.assetVersions.emptyVersions")}</p>
                        </div>
                    ) : (
                        <>
                            <div className="relative flex flex-col gap-3">
                                {/* Timeline rail — a flat hairline; the previous fade-out gradient was
                                    decorative and read as a glass highlight. */}
                                <div className="absolute left-[13px] top-4 bottom-4 w-px bg-[var(--hh-border)] hidden sm:block" aria-hidden />
                                {versions.map((v, index) => (
                                    <div key={`${v.assetVersion}-${index}`} className="relative sm:pl-9">
                                        {/* Timeline dot */}
                                        <span
                                            className={`absolute left-[9px] top-6 w-[9px] h-[9px] rounded-[var(--hh-radius-full)] hidden sm:block ${index === 0 ? "bg-[var(--hh-accent)] ring-4 ring-[var(--hh-accent-wash)]" : "bg-[var(--hh-border-strong)]"}`}
                                            aria-hidden
                                        />
                                        <div
                                            onClick={() => setVersion(v.assetVersion)}
                                            className="hh-press group hh-tile p-4 sm:p-5 rounded-[var(--hh-radius-lg)] cursor-pointer select-none transition-colors hover:border-[var(--hh-accent)]"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {/* Version strings are the primary comparison target on this
                                                            screen — tabular digits keep them aligned down the timeline. */}
                                                        <span className="hh-display hh-numeric text-lg sm:text-xl text-[var(--hh-text-primary)] transition-colors group-hover:text-[var(--hh-accent-deep)]">
                                                            {v.assetVersion}
                                                        </span>
                                                        <span className="hh-numeric px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] border bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border-[var(--hh-border)]">
                                                            App {v.appVersion}
                                                        </span>
                                                        {index === 0 && (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent-wash-strong)] text-[var(--hh-accent-deep)] border border-[var(--hh-accent-line)]">
                                                                {t("page.assetVersions.latestBadge")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="hh-numeric mt-1 text-xs text-[var(--hh-text-tertiary)] font-medium">
                                                        {formatCommittedAt(v.committedAt)}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-[var(--hh-text-tertiary)] transition-colors group-hover:text-[var(--hh-accent-deep)]">
                                                    <span className="hidden sm:inline">{t("page.assetVersions.viewDiff")}</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--hh-text-secondary)] font-medium">
                                                <span>
                                                    {t("page.assetVersions.changedAssetsLabel")}
                                                    <span className="hh-numeric ml-1.5 font-bold text-[var(--hh-text-primary)]">{formatNumber(v.changedAssets)}</span>
                                                </span>
                                            </div>

                                            {renderStatChips(v.stats, "mt-2.5")}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {versionsCursor && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={fetchMoreVersions}
                                        disabled={isVersionsLoadingMore}
                                        className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3"
                                    >
                                        {isVersionsLoadingMore ? (
                                            <div className="hh-spinner hh-spinner-on-accent w-4 h-4" />
                                        ) : (
                                            t("page.assetVersions.loadMore")
                                        )}
                                    </button>
                                </div>
                            )}

                            {!versionsCursor && versions.length > 0 && (
                                <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm font-medium">
                                    {t("page.assetVersions.allVersionsLoaded", { count: versions.length })}
                                </div>
                            )}
                        </>
                    )
                ) : (
                    /* ==================== Single Version Diff View ==================== */
                    <>
                        {/* Version summary card */}
                        <div className="mb-4 p-4 sm:p-5 hh-tile rounded-[var(--hh-radius-lg)]">
                            {isDiffLoading && !diffMeta ? (
                                <div className="flex items-center gap-3 text-sm text-[var(--hh-text-tertiary)]">
                                    <div className="loading-spinner loading-spinner-sm" />
                                    <span>{t("page.assetVersions.loadingDiff")}</span>
                                </div>
                            ) : diffMeta ? (
                                <>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="hh-display hh-numeric text-xl text-[var(--hh-text-primary)]">{diffMeta.assetVersion}</span>
                                        <span className="hh-numeric px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] border bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border-[var(--hh-border)]">
                                            App {diffMeta.appVersion}
                                        </span>
                                        {(diffMeta.types || []).map(type => (
                                            <span key={type} className="px-2 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-sm)] border bg-sky-500/10 text-sky-600 border-sky-500/20">
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[var(--hh-text-secondary)] font-medium">
                                        <span className="hh-numeric">{formatCommittedAt(diffMeta.committedAt)}</span>
                                        <span>
                                            {t("page.assetVersions.totalChangedLabel")}
                                            <span className="hh-numeric ml-1.5 font-bold text-[var(--hh-text-primary)]">{formatNumber(diffMeta.totalChanged)}</span>
                                        </span>
                                        <span>
                                            {t("page.assetVersions.loadedLabel")}
                                            <span className="hh-numeric ml-1.5 font-bold text-[var(--hh-text-primary)]">{formatNumber(diffItems.length)}</span>
                                        </span>
                                    </div>
                                    {selectedVersionMeta && renderStatChips(selectedVersionMeta.stats, "mt-2.5")}
                                    {diffMeta.assetHash && (
                                        // A hash is only useful if it can be compared character by
                                        // character, which needs fixed-width digits.
                                        <p className="hh-numeric mt-2 text-[10px] font-mono text-[var(--hh-text-tertiary)] break-all">
                                            {diffMeta.assetHash}
                                        </p>
                                    )}
                                </>
                            ) : null}
                        </div>

                        {/* Diff list */}
                        {isDiffLoading ? (
                            <div className="flex items-center justify-center min-h-[40vh]">
                                <div className="loading-spinner loading-spinner-sm" />
                            </div>
                        ) : diffError ? (
                            <div className="p-6 text-center hh-tile border-red-500/30 bg-red-500/5 rounded-[var(--hh-radius-lg)]">
                                <p className="text-red-500 font-bold mb-3">{t("page.assetVersions.loadFailed")}</p>
                                <p className="text-[var(--hh-text-secondary)] text-xs mb-4">{diffError}</p>
                                <button
                                    onClick={fetchDiff}
                                    className="hh-btn hh-btn-primary hh-press hh-focusable px-4 py-2 text-xs"
                                >
                                    {t("common.action.retry")}
                                </button>
                            </div>
                        ) : processedDiffItems.length === 0 ? (
                            <HandheldEmptyState
                                title={t("page.assetVersions.emptyDiff")}
                            />
                        ) : (
                            <>
                                {/* One table, not a stack of cards: a diff can run to hundreds of
                                    rows, so rows are hairline-separated and only tint on hover. */}
                                <div className="flex flex-col hh-tile rounded-[var(--hh-radius-lg)] overflow-hidden">
                                    {/* Table header */}
                                    <div className="flex items-center px-4 py-2.5 hh-label bg-[var(--hh-surface-1)] border-b border-[var(--hh-border)] select-none">
                                        <div className="w-16">{t("page.assetVersions.changeTypeLabel")}</div>
                                        <div className="flex-1 min-w-0 pl-3">{t("page.assetVersions.path")}</div>
                                        <div className="w-24 text-right">{t("page.assetVersions.size")}</div>
                                    </div>
                                    {/* Rows */}
                                    {processedDiffItems.map((item, index) => (
                                        <div
                                            key={`${item.path}-${index}`}
                                            onClick={() => setSelectedFile(item)}
                                            // Opens the file detail dialog. `data-hh-click` (rather
                                            // than `hh-press`) is the escape hatch used here on
                                            // purpose: a table row must not scale on press, which
                                            // would shift every neighbouring row in a long diff.
                                            data-hh-click
                                            data-hh-sound="confirm"
                                            className="group px-4 py-3 flex items-center gap-3 cursor-pointer select-none border-b border-[var(--hh-border-hairline)] last:border-b-0 transition-colors hover:bg-[var(--hh-surface-sunken)]"
                                        >
                                            {renderChangeTypeBadge(item.changeType)}
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <p
                                                    className="text-xs sm:text-sm font-mono font-medium text-[var(--hh-text-primary)] truncate transition-colors group-hover:text-[var(--hh-accent-deep)]"
                                                    title={item.path}
                                                >
                                                    {item.path}
                                                </p>
                                                {item.source === "override" && (
                                                    <span className="shrink-0 px-1.5 py-0.2 text-[9px] bg-purple-500/10 text-purple-600 rounded-[var(--hh-radius-sm)] border border-purple-500/20">override</span>
                                                )}
                                            </div>
                                            <div className="hh-numeric w-24 shrink-0 text-right text-xs text-[var(--hh-text-secondary)] font-medium">
                                                {formatBytes(item.size)}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Fetch next server page */}
                                {diffCursor && (
                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={fetchMoreDiff}
                                            disabled={isDiffLoadingMore}
                                            className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3"
                                        >
                                            {isDiffLoadingMore ? (
                                                <div className="hh-spinner hh-spinner-on-accent w-4 h-4" />
                                            ) : (
                                                <>
                                                    {t("page.assetVersions.loadMore")}
                                                    <span className="hh-numeric text-xs font-semibold opacity-75 bg-black/15 px-2 py-0.5 rounded-[var(--hh-radius-sm)]">
                                                        {formatNumber(diffItems.length)} / {formatNumber(diffMeta?.totalChanged || 0)}
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* All loaded message */}
                                {!diffCursor && processedDiffItems.length > 0 && (
                                    <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm font-medium">
                                        {t("page.assetVersions.allDiffLoaded", { count: processedDiffItems.length })}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* File Detail Modal */}
            <Modal
                isOpen={!!selectedFile}
                onClose={() => {
                    setSelectedFile(null);
                    setPreviewText(null);
                    setPreviewTextError(null);
                }}
                title={selectedFile ? (selectedFile.path.split("/").pop() || selectedFile.path) : ""}
                size="md"
                headerActions={modalHeaderActions}
            >
                {selectedFile && (
                    <div className="space-y-6">
                        {/* File Details Grid */}
                        <div className="p-4 hh-well text-xs sm:text-sm space-y-2.5">
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--hh-text-secondary)] font-medium shrink-0">{t("page.assetVersions.changeTypeLabel")}</span>
                                {renderChangeTypeBadge(selectedFile.changeType)}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[var(--hh-text-secondary)] font-medium">{t("page.assetVersions.path")}</span>
                                <span className="text-[var(--hh-text-primary)] font-mono text-[10px] sm:text-xs select-all break-all">{selectedFile.path}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-[var(--hh-text-secondary)] font-medium shrink-0">{t("page.assetVersions.size")}</span>
                                <span className="hh-numeric text-[var(--hh-text-primary)] font-bold text-right">{formatBytes(selectedFile.size)}</span>
                            </div>
                            {selectedFile.source && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--hh-text-secondary)] font-medium shrink-0">{t("page.assetVersions.source")}</span>
                                    <span className="text-[var(--hh-text-primary)] capitalize text-right">{selectedFile.source}</span>
                                </div>
                            )}
                            {selectedFile.bundlePath && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--hh-text-secondary)] font-medium shrink-0">{t("page.assetVersions.bundlePath")}</span>
                                    <span className="text-[var(--hh-text-primary)] font-mono text-right truncate max-w-[200px]" title={selectedFile.bundlePath}>{selectedFile.bundlePath}</span>
                                </div>
                            )}
                            {selectedFile.fingerprint && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-[var(--hh-text-secondary)] font-medium shrink-0">{t("page.assetVersions.fingerprint")}</span>
                                    {/* Fingerprints and hashes are read character by character. */}
                                    <span className="hh-numeric text-[var(--hh-text-primary)] font-mono text-right truncate max-w-[200px]" title={selectedFile.fingerprint}>{selectedFile.fingerprint}</span>
                                </div>
                            )}
                            {selectedFile.sha256 && (
                                <div className="flex flex-col gap-1 pt-1.5 border-t border-[var(--hh-border)]">
                                    <span className="text-[var(--hh-text-secondary)] font-medium">{t("page.assetVersions.sha256")}</span>
                                    <span className="hh-numeric text-[var(--hh-text-primary)] font-mono text-[10px] sm:text-xs select-all break-all">{selectedFile.sha256}</span>
                                </div>
                            )}
                        </div>

                        {/* Inline Previews */}
                        <div className="flex flex-col items-center justify-center">
                            {isImagePath(selectedFile.path) && selectedFile.url && (
                                <div className="relative w-full max-h-64 flex justify-center bg-[var(--hh-surface-sunken)] p-4 rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                                    <img
                                        src={`${gatewayDomain}${selectedFile.url}`}
                                        alt={selectedFile.path}
                                        className="max-h-56 object-contain rounded-[var(--hh-radius-md)]"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                </div>
                            )}

                            {isAudioPath(selectedFile.path) && selectedFile.url && (
                                <div className="w-full p-4 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                                    <p className="hh-label mb-2 flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                        </svg>
                                        {t("page.assetVersions.playAudio")}
                                    </p>
                                    <audio
                                        src={`${gatewayDomain}${selectedFile.url}`}
                                        controls
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {isTextPath(selectedFile.path) && selectedFile.url && (
                                <div className="w-full">
                                    {previewText === null && !isPreviewTextLoading && !previewTextError && (
                                        <button
                                            onClick={() => handleFetchPreviewText(selectedFile)}
                                            className="hh-btn hh-btn-primary hh-press hh-focusable w-full py-3 text-sm"
                                        >
                                            {t("page.assetVersions.previewText")}
                                        </button>
                                    )}

                                    {isPreviewTextLoading && (
                                        <div className="flex justify-center p-6">
                                            <div className="loading-spinner loading-spinner-sm" />
                                        </div>
                                    )}

                                    {previewTextError && (
                                        <p className="text-xs text-red-500 text-center font-medium bg-red-500/5 p-3 rounded-[var(--hh-radius-md)] border border-red-500/20">
                                            {previewTextError}
                                        </p>
                                    )}

                                    {previewText !== null && (
                                        <div className="relative w-full">
                                            {/* The readout is a fixed dark terminal surface in both themes —
                                                that is what marks it as raw machine output rather than UI —
                                                so its two colors are literals, not theme tokens. White text
                                                on it is correct. */}
                                            <button
                                                onClick={() => handleCopyToClipboard(previewText)}
                                                className="hh-press hh-focusable absolute right-3 top-3 px-2.5 py-1 text-[10px] font-bold bg-white/15 hover:bg-white/25 text-white rounded-[var(--hh-radius-sm)] transition-colors border border-white/20"
                                            >
                                                {copyFeedback ? t("page.assetVersions.copied") : t("common.action.copy")}
                                            </button>
                                            <pre className="w-full overflow-auto bg-[#15171b] p-4 rounded-[var(--hh-radius-lg)] text-[10px] sm:text-xs font-mono text-emerald-400 max-h-[35vh] border border-[#2c2f35] whitespace-pre select-all custom-scrollbar">
                                                <code>{previewText}</code>
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Terms of Service Overlay Modal */}
            <AssetTosModal open={showTos} onOpenChange={setShowTos} />
        </div>
    );
}

export default function AssetVersionsClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.assetVersions.loadingFallback")}</div>}>
                <AssetVersionsContent />
            </Suspense>
        </MainLayout>
    );
}
