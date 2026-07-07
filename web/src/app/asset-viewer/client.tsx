"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";

import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection, FilterButton } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import Modal from "@/components/common/Modal";
import ExternalLink from "@/components/ExternalLink";

// Type definitions matching the server response
export interface AssetBrowserItem {
    type: "directory" | "asset";
    name: string;
    path: string;
    url?: string;
    source?: string;
    size?: number;
    fingerprint?: string;
    sha256?: string;
    version?: string;
}

export interface AssetBrowserResponse {
    server: string;
    prefix: string;
    limit: number;
    nextCursor?: string;
    snapshotRevision: number;
    items: AssetBrowserItem[];
}

function formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(name: string) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"].includes(ext || "")) {
        return (
            <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
        );
    }
    if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext || "")) {
        return (
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
        );
    }
    if (["json", "txt", "csv", "xml", "yaml", "yml"].includes(ext || "")) {
        return (
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        );
    }
    return (
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    );
}

function AssetViewerContent() {
    const { assetSource } = useTheme();
    const { t } = useI18n();


    // Query states
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
    const [prefix, setPrefix] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("prefix") || "";
        }
        return "";
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "directories" | "assets">("all");
    const [sortBy, setSortBy] = useState<"name" | "size" | "version">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");

    // Load view mode preference from localStorage on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("asset-viewer-mode");
            if (saved === "grid" || saved === "list") {
                setViewMode(saved);
            }
        }
    }, []);

    const handleViewModeChange = (mode: "grid" | "list") => {
        setViewMode(mode);
        if (typeof window !== "undefined") {
            localStorage.setItem("asset-viewer-mode", mode);
        }
    };

    // TOS States
    const [showTos, setShowTos] = useState(false);
    const [tosCountdown, setTosCountdown] = useState(10);
    const [hasAgreed, setHasAgreed] = useState(false);

    // Load TOS agreement status from localStorage on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const agreed = localStorage.getItem("asset-viewer-tos-agreed");
            if (agreed === "true") {
                setHasAgreed(true);
            } else {
                setShowTos(true);
            }
        }
    }, []);

    // Countdown timer for TOS modal
    useEffect(() => {
        if (!showTos) return;
        if (hasAgreed) {
            setTosCountdown(0);
            return;
        }
        setTosCountdown(10);
        const timer = setInterval(() => {
            setTosCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [showTos, hasAgreed]);

    const handleAgreeTos = useCallback(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("asset-viewer-tos-agreed", "true");
            setHasAgreed(true);
        }
        setShowTos(false);
    }, []);

    // API response states
    const [items, setItems] = useState<AssetBrowserItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string>("");
    const [, setSnapshotRevision] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected file details & text preview states
    const [selectedFile, setSelectedFile] = useState<AssetBrowserItem | null>(null);
    const [previewText, setPreviewText] = useState<string | null>(null);
    const [isPreviewTextLoading, setIsPreviewTextLoading] = useState(false);
    const [previewTextError, setPreviewTextError] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);

    // Sync state to URL query parameters (write-only)
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("server", server);
        if (prefix) {
            url.searchParams.set("prefix", prefix);
        } else {
            url.searchParams.delete("prefix");
        }
        window.history.replaceState({}, "", url.toString());
    }, [server, prefix]);

    // Detect URL changes from back/forward navigation via PopState (avoiding Next.js query param lag)
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const serverParam = params.get("server");
            const prefixParam = params.get("prefix") || "";
            if (serverParam) {
                setServer(serverParam);
            }
            setPrefix(prefixParam);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Active domain base URL
    const gatewayDomain = useMemo(() => {
        return assetSource === "overseas" ? "https://storage.pjsk.moe" : "https://storage.exmeaning.com";
    }, [assetSource]);

    // Local scroll restore hook
    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "asset-browser",
        defaultDisplayCount: 60,
        increment: 60,
        isReady: !isLoading,
    });

    // Reset pagination display when navigating folders or changing filters
    useEffect(() => {
        resetDisplayCount();
    }, [prefix, server, filterType, sortBy, sortOrder, searchQuery, resetDisplayCount]);

    // Fetch initial directory structure
    const fetchDirectory = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const url = `${gatewayDomain}/api/assets/browse?server=${server}&prefix=${prefix}&limit=200`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetBrowserResponse = await res.json();
            setItems(data.items || []);
            setNextCursor(data.nextCursor || "");
            setSnapshotRevision(data.snapshotRevision || 0);
        } catch (err) {
            console.error("Failed to load assets:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [server, prefix, gatewayDomain]);

    useEffect(() => {
        fetchDirectory();
    }, [fetchDirectory]);

    // Fetch next page of assets
    const fetchMore = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return;
        try {
            setIsLoadingMore(true);
            const url = `${gatewayDomain}/api/assets/browse?server=${server}&prefix=${prefix}&limit=200&cursor=${encodeURIComponent(nextCursor)}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data: AssetBrowserResponse = await res.json();
            setItems(prev => [...prev, ...(data.items || [])]);
            setNextCursor(data.nextCursor || "");
            setSnapshotRevision(data.snapshotRevision || 0);
        } catch (err) {
            console.error("Failed to load more assets:", err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [server, prefix, gatewayDomain, nextCursor, isLoadingMore]);

    // Breadcrumbs list
    const breadcrumbs = useMemo(() => {
        const parts = prefix.split("/").filter(Boolean);
        const list = [{ name: t("page.assetViewer.root"), path: "" }];
        let currentPath = "";
        for (const part of parts) {
            currentPath += part + "/";
            list.push({ name: part, path: currentPath });
        }
        return list;
    }, [prefix, t]);

    // Navigate to a parent folder path
    const handleBreadcrumbClick = (path: string) => {
        setPrefix(path);
    };

    // Navigate up one directory level
    const handleGoBack = useCallback(() => {
        if (!prefix) return;
        const parts = prefix.split("/").filter(Boolean);
        parts.pop();
        const parentPath = parts.length > 0 ? parts.join("/") + "/" : "";
        setPrefix(parentPath);
    }, [prefix]);

    // Filtered & Sorted items
    const processedItems = useMemo(() => {
        let list = [...items];

        // Search query filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item => item.name.toLowerCase().includes(query));
        }

        // Type filter
        if (filterType === "directories") {
            list = list.filter(item => item.type === "directory");
        } else if (filterType === "assets") {
            list = list.filter(item => item.type === "asset");
        }

        // Sorting: Folders always stay on top
        list.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
            }

            const isAsc = sortOrder === "asc";

            if (a.type === "directory") {
                // Directories always sort alphabetically by name
                return a.name.localeCompare(b.name);
            }

            // Assets sorting
            if (sortBy === "size") {
                const sizeA = a.size || 0;
                const sizeB = b.size || 0;
                return isAsc ? sizeA - sizeB : sizeB - sizeA;
            }

            if (sortBy === "version") {
                const versionA = a.version || "";
                const versionB = b.version || "";
                return isAsc ? versionA.localeCompare(versionB) : versionB.localeCompare(versionA);
            }

            // Default sorting by Name
            return isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        });

        return list;
    }, [items, searchQuery, filterType, sortBy, sortOrder]);

    const displayedItems = useMemo(() => {
        return processedItems.slice(0, displayCount);
    }, [processedItems, displayCount]);

    // Fetch text preview file content
    const handleFetchPreviewText = async (file: AssetBrowserItem) => {
        if (!file.url) return;
        try {
            setIsPreviewTextLoading(true);
            setPreviewTextError(null);
            setPreviewText(null);

            const fileUrl = `${gatewayDomain}${file.url}`;
            const res = await fetch(fileUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const content = await res.text();
            
            // Auto-format JSON content if applicable
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

    // Copy to clipboard helper
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
        });
    };

    // Sidebar Filters configuration
    const activeFiltersCount = (server !== "jp" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (sortBy !== "name" ? 1 : 0) + (sortOrder !== "asc" ? 1 : 0);
    
    const resetFilters = () => {
        setServer("jp");
        setFilterType("all");
        setSortBy("name");
        setSortOrder("asc");
        setSearchQuery("");
    };

    const quickFilterContent = (
        <BaseFilters
            filteredCount={processedItems.length}
            totalCount={items.length}
            countUnit={t("page.assetViewer.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("page.assetViewer.searchPlaceholder")}
            sortOptions={[
                { id: "name", label: t("common.form.uid") /* using name indirectly */ },
                { id: "size", label: t("page.assetViewer.size") },
                { id: "version", label: t("page.assetViewer.version") },
            ]}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
                setSortBy(field as "name" | "size" | "version");
                setSortOrder(order);
            }}
            hasActiveFilters={activeFiltersCount > 0 || searchQuery !== ""}
            onReset={resetFilters}
        >
            <FilterSection label={t("page.assetViewer.serverSelect")}>
                <div className="grid grid-cols-3 gap-2">
                    {(["jp", "en", "tw", "kr", "cn"] as const).map(srv => (
                        <FilterButton
                            key={srv}
                            selected={server === srv}
                            onClick={() => setServer(srv)}
                        >
                            {t(`settings.serverSource.${srv}`) || srv.toUpperCase()}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>

            <FilterSection label={t("page.assetViewer.source")}>
                <div className="grid grid-cols-3 gap-2">
                    {(["all", "directories", "assets"] as const).map(type => (
                        <FilterButton
                            key={type}
                            selected={filterType === type}
                            onClick={() => setFilterType(type)}
                        >
                            {type === "all" ? t("page.assetViewer.allTypes") :
                             type === "directories" ? t("page.assetViewer.typeDirectory") :
                             t("page.assetViewer.typeAsset")}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>
        </BaseFilters>
    );

    useQuickFilter(t("page.assetViewer.title"), quickFilterContent, [
        searchQuery,
        server,
        filterType,
        sortBy,
        sortOrder,
        processedItems.length,
        items.length,
        t,
    ]);

    // Check file category for previewing
    const isImageFile = (name: string) => {
        const ext = name.split(".").pop()?.toLowerCase();
        return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || "");
    };

    const isAudioFile = (name: string) => {
        const ext = name.split(".").pop()?.toLowerCase();
        return ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext || "");
    };

    const isTextFile = (name: string) => {
        const ext = name.split(".").pop()?.toLowerCase();
        return ["json", "txt", "csv", "xml", "yaml", "yml"].includes(ext || "");
    };

    const modalHeaderActions = useMemo(() => {
        if (!selectedFile?.url) return null;
        return (
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => handleCopyToClipboard(`${gatewayDomain}${selectedFile.url}`)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full transition-colors flex items-center justify-center animate-in fade-in duration-200"
                    title={copyFeedback ? t("page.assetViewer.copied") : t("page.assetViewer.copyLink")}
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
                    className="p-1.5 text-slate-400 hover:text-miku island-pill-hover rounded-full transition-colors flex items-center justify-center"
                    title={t("page.assetViewer.download")}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </ExternalLink>
            </div>
        );
    }, [selectedFile, gatewayDomain, copyFeedback, t]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 ios-glass-card border-miku/30 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.assetViewer.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.assetViewer.title")} <span className="text-miku">{t("page.assetViewer.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto font-light text-sm sm:text-base">
                    {t("page.assetViewer.descriptionPrefix")}
                    <button
                        onClick={() => setShowTos(true)}
                        className="text-miku hover:underline font-medium mx-1 focus:outline-none"
                    >
                        {t("page.assetViewer.descriptionLink")}
                    </button>
                    {t("page.assetViewer.descriptionSuffix")}
                </p>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters Side Panel */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                {/* File Explorer Panel */}
                <div className="flex-1 min-w-0">
                    {/* Breadcrumbs Navigation & Sync Info */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 ios-glass-card rounded-2xl">
                        <div className="flex items-center gap-2">
                            {prefix && (
                                <button
                                    onClick={handleGoBack}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary-text transition-all duration-200"
                                    title={t("page.assetViewer.parentDir")}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                                {breadcrumbs.map((bc, index) => (
                                    <div key={bc.path} className="flex items-center gap-1.5">
                                        {index > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
                                        <button
                                            onClick={() => handleBreadcrumbClick(bc.path)}
                                            className={`hover:text-miku transition-colors ${
                                                index === breadcrumbs.length - 1
                                                    ? "text-primary-text font-bold"
                                                    : ""
                                            }`}
                                        >
                                            {bc.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-900/30 p-1 rounded-xl border border-slate-200/30 dark:border-slate-800/30">
                                <button
                                    onClick={() => handleViewModeChange("grid")}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        viewMode === "grid"
                                            ? "bg-white dark:bg-slate-800 text-miku shadow-sm"
                                            : "text-slate-400 hover:text-primary-text"
                                    }`}
                                    title={t("page.assetViewer.viewGrid")}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25A2.25 2.25 0 0113.5 8V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleViewModeChange("list")}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        viewMode === "list"
                                            ? "bg-white dark:bg-slate-800 text-miku shadow-sm"
                                            : "text-slate-400 hover:text-primary-text"
                                    }`}
                                    title={t("page.assetViewer.viewList")}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                                    </svg>
                                </button>
                            </div>

                            <button
                                onClick={fetchDirectory}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary-text transition-all duration-200"
                                title={t("common.action.refresh")}
                            >
                                <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Loader */}
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center ios-glass-card border-red-500/20 bg-red-500/5 rounded-2xl">
                            <p className="text-red-500 font-bold mb-3">{t("page.assetViewer.loadFailed")}</p>
                            <p className="text-slate-500 text-xs mb-4">{error}</p>
                            <button
                                onClick={fetchDirectory}
                                className="ios-glass-btn ios-glass-btn-primary px-4 py-2 text-xs rounded-xl"
                            >
                                {t("common.action.retry")}
                            </button>
                        </div>
                    ) : displayedItems.length === 0 ? (
                        <div className="p-12 text-center ios-glass-card rounded-2xl text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                            <p>{t("page.assetViewer.emptyFolder")}</p>
                        </div>
                    ) : (
                        <>
                            {/* Folder & Files Display */}
                            {viewMode === "grid" ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {displayedItems.map((item, index) => {
                                        const isDir = item.type === "directory";
                                        return (
                                            <div
                                                key={`${item.path}-${index}`}
                                                onClick={() => {
                                                    if (isDir) {
                                                        setPrefix(item.path);
                                                    } else {
                                                        setSelectedFile(item);
                                                    }
                                                }}
                                                className="group ios-glass-card ios-glass-card-interactive p-4 rounded-2xl flex items-center gap-3 cursor-pointer select-none"
                                            >
                                                <div className="shrink-0 p-2 rounded-xl bg-slate-100/50 dark:bg-slate-900/30 group-hover:scale-105 transition-transform duration-200">
                                                    {isDir ? (
                                                        <svg className="w-8 h-8 text-amber-400 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15a2.25 2.25 0 012.25 2.25v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                                        </svg>
                                                    ) : (
                                                        getFileIcon(item.name)
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                        {item.name}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-medium">
                                                        {isDir ? (
                                                            <span>{t("page.assetViewer.typeDirectory")}</span>
                                                        ) : (
                                                            <>
                                                                <span>{formatBytes(item.size)}</span>
                                                                {item.source === "override" && (
                                                                    <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/10">override</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {/* Table header */}
                                    <div className="flex items-center px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200/10 mb-1 select-none">
                                        <div className="w-10"></div>
                                        <div className="flex-1 min-w-0">{t("common.form.uid") /* Name */}</div>
                                        <div className="w-24 text-right">{t("page.assetViewer.size")}</div>
                                        <div className="w-28 text-right hidden sm:block">{t("page.assetViewer.version")}</div>
                                    </div>
                                    {/* Rows */}
                                    {displayedItems.map((item, index) => {
                                        const isDir = item.type === "directory";
                                        return (
                                            <div
                                                key={`${item.path}-${index}`}
                                                onClick={() => {
                                                    if (isDir) {
                                                        setPrefix(item.path);
                                                    } else {
                                                        setSelectedFile(item);
                                                    }
                                                }}
                                                className="group ios-glass-card ios-glass-card-interactive p-3 rounded-2xl flex items-center gap-3 cursor-pointer select-none"
                                            >
                                                <div className="shrink-0 p-1.5 rounded-lg bg-slate-100/50 dark:bg-slate-900/30 group-hover:scale-105 transition-transform duration-200">
                                                    {isDir ? (
                                                        <svg className="w-6 h-6 text-amber-400 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15a2.25 2.25 0 012.25 2.25v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                                        </svg>
                                                    ) : (
                                                        getFileIcon(item.name)
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <p className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                        {item.name}
                                                    </p>
                                                    {item.source === "override" && (
                                                        <span className="px-1.5 py-0.2 text-[9px] bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/10">override</span>
                                                    )}
                                                </div>
                                                <div className="w-24 shrink-0 text-right text-xs text-slate-400 font-medium">
                                                    {isDir ? t("page.assetViewer.typeDirectory") : formatBytes(item.size)}
                                                </div>
                                                <div className="w-28 shrink-0 text-right text-xs font-mono text-slate-400 truncate hidden sm:block">
                                                    {isDir ? "-" : (item.version || "-")}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Load More list items locally */}
                            {displayedItems.length < processedItems.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        className="ios-glass-btn ios-glass-btn-primary px-8 py-3 font-bold rounded-2xl flex items-center gap-2"
                                    >
                                        {t("page.assetViewer.loadMore")}
                                        <span className="text-xs font-semibold opacity-75 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                            {displayedItems.length} / {processedItems.length}
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Load next cursor from server if locally all shown but nextCursor exists */}
                            {displayedItems.length >= processedItems.length && nextCursor && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={fetchMore}
                                        disabled={isLoadingMore}
                                        className="ios-glass-btn ios-glass-btn-primary px-8 py-3 font-bold rounded-2xl flex items-center gap-2"
                                    >
                                        {isLoadingMore ? (
                                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            t("page.assetViewer.loadMore")
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* All loaded message */}
                            {displayedItems.length > 0 && displayedItems.length >= processedItems.length && !nextCursor && (
                                <div className="mt-8 text-center text-slate-400 text-sm font-medium">
                                    {t("page.assetViewer.allLoaded", { count: processedItems.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* File Detail Modal */}
            <Modal
                isOpen={!!selectedFile}
                onClose={() => {
                    setSelectedFile(null);
                    setPreviewText(null);
                    setPreviewTextError(null);
                }}
                title={selectedFile?.name || ""}
                size="md"
                headerActions={modalHeaderActions}
            >
                {selectedFile && (
                    <div className="space-y-6">
                        {/* File Details Grid */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-xs sm:text-sm space-y-2.5">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.size")}</span>
                                <span className="text-primary-text font-bold text-right">{formatBytes(selectedFile.size)}</span>
                            </div>
                            {selectedFile.version && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.version")}</span>
                                    <span className="text-primary-text font-mono text-right">{selectedFile.version}</span>
                                </div>
                            )}
                            {selectedFile.source && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.source")}</span>
                                    <span className="text-primary-text capitalize text-right">{selectedFile.source}</span>
                                </div>
                            )}
                            {selectedFile.fingerprint && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.fingerprint")}</span>
                                    <span className="text-primary-text font-mono text-right truncate max-w-[200px]" title={selectedFile.fingerprint}>{selectedFile.fingerprint}</span>
                                </div>
                            )}
                            {selectedFile.sha256 && (
                                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40">
                                    <span className="text-slate-400 font-medium">{t("page.assetViewer.sha256")}</span>
                                    <span className="text-primary-text font-mono text-[10px] sm:text-xs select-all break-all">{selectedFile.sha256}</span>
                                </div>
                            )}
                        </div>

                        {/* Inline Previews */}
                        <div className="flex flex-col items-center justify-center">
                            {isImageFile(selectedFile.name) && selectedFile.url && (
                                <div className="relative w-full max-h-64 flex justify-center bg-slate-100/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                                    <img
                                        src={`${gatewayDomain}${selectedFile.url}`}
                                        alt={selectedFile.name}
                                        className="max-h-56 object-contain rounded-lg"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                </div>
                            )}

                            {isAudioFile(selectedFile.name) && selectedFile.url && (
                                <div className="w-full p-4 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                                    <p className="text-xs text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                        </svg>
                                        {t("page.assetViewer.playAudio")}
                                    </p>
                                    <audio
                                        src={`${gatewayDomain}${selectedFile.url}`}
                                        controls
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {isTextFile(selectedFile.name) && selectedFile.url && (
                                <div className="w-full">
                                    {previewText === null && !isPreviewTextLoading && !previewTextError && (
                                        <button
                                            onClick={() => handleFetchPreviewText(selectedFile)}
                                            className="w-full py-3 ios-glass-btn ios-glass-btn-primary font-bold rounded-2xl text-sm"
                                        >
                                            {t("page.assetViewer.previewText")}
                                        </button>
                                    )}

                                    {isPreviewTextLoading && (
                                        <div className="flex justify-center p-6">
                                            <div className="loading-spinner loading-spinner-sm" />
                                        </div>
                                    )}

                                    {previewTextError && (
                                        <p className="text-xs text-red-500 text-center font-medium bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                                            {previewTextError}
                                        </p>
                                    )}

                                    {previewText !== null && (
                                        <div className="relative w-full">
                                            <button
                                                onClick={() => handleCopyToClipboard(previewText)}
                                                className="absolute right-3 top-3 px-2.5 py-1 text-[10px] font-bold bg-slate-800/80 hover:bg-slate-800 text-white rounded-lg transition-colors border border-slate-700"
                                            >
                                                {copyFeedback ? t("page.assetViewer.copied") : t("common.action.copy")}
                                            </button>
                                            <pre className="w-full overflow-auto bg-slate-950 p-4 rounded-2xl text-[10px] sm:text-xs font-mono text-emerald-400 max-h-[35vh] border border-slate-800 whitespace-pre select-all custom-scrollbar">
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
            {showTos && createPortal(
                <div className="fixed inset-0 z-[300] isolate flex items-center justify-center p-4 sm:p-6 select-none">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 transform-gpu bg-black/35 backdrop-blur-[8px]"
                        onClick={() => {
                            if (hasAgreed) setShowTos(false);
                        }}
                    />

                    {/* Dialog Container */}
                    <div className="relative w-full max-w-lg transform-gpu will-change-transform liquid-glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-dashed border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-r from-miku/5 to-transparent flex-shrink-0">
                            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-miku rounded-full" />
                                {t("page.assetViewer.tos.title")}
                            </h2>
                            {hasAgreed && (
                                <button
                                    onClick={() => setShowTos(false)}
                                    className="p-1.5 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 island-pill-hover rounded-full transition-colors"
                                    aria-label={t("common.action.close")}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed custom-scrollbar">
                            <p className="font-bold text-slate-700 dark:text-slate-200">
                                {t("page.assetViewer.tos.welcome")}
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span className="text-miku">1.</span> {t("page.assetViewer.tos.sec1Title")}
                                    </h3>
                                    <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                        {t("page.assetViewer.tos.sec1Content")}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span className="text-miku">2.</span> {t("page.assetViewer.tos.sec2Title")}
                                    </h3>
                                    <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                        {t("page.assetViewer.tos.sec2Content")}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span className="text-miku">3.</span> {t("page.assetViewer.tos.sec3Title")}
                                    </h3>
                                    <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                        {t("page.assetViewer.tos.sec3Content")}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span className="text-miku">4.</span> {t("page.assetViewer.tos.sec4Title")}
                                    </h3>
                                    <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                        {t("page.assetViewer.tos.sec4Content")}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span className="text-miku">5.</span> {t("page.assetViewer.tos.sec5Title")}
                                    </h3>
                                    <p className="pl-4 mt-0.5 text-slate-500 dark:text-slate-400">
                                        {t("page.assetViewer.tos.sec5Content")}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="p-4 border-t border-dashed border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end flex-shrink-0">
                            {hasAgreed ? (
                                <button
                                    onClick={() => setShowTos(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ios-glass-btn"
                                >
                                    {t("common.action.close")}
                                </button>
                            ) : (
                                <button
                                    disabled={tosCountdown > 0}
                                    onClick={handleAgreeTos}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                                        tosCountdown > 0
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                            : "ios-glass-btn ios-glass-btn-primary"
                                    }`}
                                >
                                    {tosCountdown > 0
                                        ? `${t("page.assetViewer.tos.agree")} (${tosCountdown}s)`
                                        : t("page.assetViewer.tos.agree")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default function AssetViewerClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.assetViewer.loadingFallback")}</div>}>
                <AssetViewerContent />
            </Suspense>
        </MainLayout>
    );
}
