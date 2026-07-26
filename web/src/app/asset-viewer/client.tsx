"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";

import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection, FilterButton } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import Modal from "@/components/common/Modal";
import ExternalLink from "@/components/ExternalLink";
import AssetTosModal from "@/components/common/AssetTosModal";
import LocalizedLink from "@/components/LocalizedLink";

// Type definitions for Bundle & Asset Browser APIs
export interface BundleBrowseItem {
    type: "directory" | "bundle";
    name: string;
    path: string;
    fingerprint?: string;
    fileCount?: number;
    totalSize?: number;
    source?: string;
    filesUrl?: string;
}

export interface BundleBrowseResponse {
    server: string;
    prefix: string;
    limit: number;
    nextCursor?: string;
    snapshotRevision: number;
    items: BundleBrowseItem[];
}

export interface AssetBrowserItem {
    type: "file" | "asset";
    name: string;
    path: string;
    url?: string;
    source?: string;
    size?: number;
    fingerprint?: string;
    sha256?: string;
    version?: string;
}

export interface BundleMetaInfo {
    path: string;
    fingerprint?: string;
    fileCount: number;
    totalSize: number;
    source: string;
}

export interface BundleFilesResponse {
    server: string;
    bundle: BundleMetaInfo;
    limit: number;
    nextCursor?: string;
    snapshotRevision: number;
    items: AssetBrowserItem[];
}

// Merged file format structure (e.g. png + webp combined)
export interface AssetFormatInfo {
    ext: string;
    name: string;
    url: string;
    size?: number;
    fingerprint?: string;
    sha256?: string;
}

export interface MergedAssetItem {
    id: string;
    baseName: string;
    name: string;
    primaryUrl: string;
    primaryExt: string;
    isImage: boolean;
    isAudio: boolean;
    isText: boolean;
    formats: AssetFormatInfo[];
    totalSize: number;
    source?: string;
    version?: string;
}

function formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function groupBundleFiles(files: AssetBrowserItem[]): MergedAssetItem[] {
    const map = new Map<string, MergedAssetItem>();

    for (const file of files) {
        const extMatch = file.name.match(/\.([^.]+)$/);
        const ext = extMatch ? extMatch[1].toLowerCase() : "";

        let key = file.path;
        let baseName = file.name;
        if (ext === "png" || ext === "webp") {
            key = file.path.replace(/\.(png|webp)$/i, "");
            baseName = file.name.replace(/\.(png|webp)$/i, "");
        }

        const formatEntry: AssetFormatInfo = {
            ext,
            name: file.name,
            url: file.url || "",
            size: file.size,
            fingerprint: file.fingerprint,
            sha256: file.sha256,
        };

        if (map.has(key)) {
            const existing = map.get(key)!;
            if (!existing.formats.some(f => f.ext === ext)) {
                existing.formats.push(formatEntry);
            }
            existing.totalSize += file.size || 0;
            if (ext === "webp" && file.url) {
                existing.primaryUrl = file.url;
                existing.primaryExt = "webp";
            }
        } else {
            const isImg = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
            const isAud = ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);
            const isTxt = ["json", "txt", "csv", "xml", "yaml", "yml"].includes(ext);

            map.set(key, {
                id: key,
                baseName,
                name: (ext === "png" || ext === "webp") ? baseName : file.name,
                primaryUrl: file.url || "",
                primaryExt: ext,
                isImage: isImg,
                isAudio: isAud,
                isText: isTxt,
                formats: [formatEntry],
                totalSize: file.size || 0,
                source: file.source,
                version: file.version,
            });
        }
    }

    for (const item of map.values()) {
        item.formats.sort((a, b) => {
            if (a.ext === "webp") return -1;
            if (b.ext === "webp") return 1;
            return a.ext.localeCompare(b.ext);
        });
        if (item.formats.length > 1) {
            item.name = item.baseName;
        } else {
            item.name = item.formats[0].name;
        }
    }

    return Array.from(map.values());
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

function ArchiveBundleIcon() {
    return (
        <svg className="w-8 h-8 text-indigo-400 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
    );
}

function FolderIcon() {
    return (
        <svg className="w-8 h-8 text-amber-400 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15a2.25 2.25 0 012.25 2.25v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
    );
}

function AssetViewerContent() {
    const { assetSource } = useTheme();
    const { t, formatNumber } = useI18n();

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

    const [bundlePath, setBundlePath] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("bundle") || "";
        }
        return "";
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "directories" | "bundles">("all");
    const [sortBy, setSortBy] = useState<"name" | "size" | "fileCount">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

    // TOS modal visibility
    const [showTos, setShowTos] = useState(false);

    // API response states
    const [bundleItems, setBundleItems] = useState<BundleBrowseItem[]>([]);
    const [rawAssetFiles, setRawAssetFiles] = useState<AssetBrowserItem[]>([]);
    const [activeBundleMeta, setActiveBundleMeta] = useState<BundleMetaInfo | null>(null);

    const [nextCursor, setNextCursor] = useState<string>("");
    const [, setSnapshotRevision] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Selected file details & modal state
    const [selectedFile, setSelectedFile] = useState<MergedAssetItem | null>(null);
    const [activeFormatIndex, setActiveFormatIndex] = useState<number>(0);

    const [previewText, setPreviewText] = useState<string | null>(null);
    const [isPreviewTextLoading, setIsPreviewTextLoading] = useState(false);
    const [previewTextError, setPreviewTextError] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);

    // Sync state to URL query parameters
    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("server", server);
        if (prefix) {
            url.searchParams.set("prefix", prefix);
        } else {
            url.searchParams.delete("prefix");
        }
        if (bundlePath) {
            url.searchParams.set("bundle", bundlePath);
        } else {
            url.searchParams.delete("bundle");
        }
        window.history.replaceState({}, "", url.toString());
    }, [server, prefix, bundlePath]);

    // Handle browser popstate navigation
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const serverParam = params.get("server");
            const prefixParam = params.get("prefix") || "";
            const bundleParam = params.get("bundle") || "";
            if (serverParam) {
                setServer(serverParam);
            }
            setPrefix(prefixParam);
            setBundlePath(bundleParam);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Active domain base URL
    const gatewayDomain = useMemo(() => {
        return assetSource === "overseas" ? "https://storage.pjsk.moe" : "https://storage.exmeaning.com";
    }, [assetSource]);

    // Fetch view data
    const fetchCurrentView = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (bundlePath) {
                const url = `${gatewayDomain}/api/assets/bundle-files?server=${server}&path=${encodeURIComponent(bundlePath)}&limit=200`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data: BundleFilesResponse = await res.json();
                setRawAssetFiles(data.items || []);
                setActiveBundleMeta(data.bundle || null);
                setBundleItems([]);
                setNextCursor(data.nextCursor || "");
                setSnapshotRevision(data.snapshotRevision || 0);
            } else {
                const url = `${gatewayDomain}/api/assets/bundles?server=${server}&prefix=${encodeURIComponent(prefix)}&limit=200`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data: BundleBrowseResponse = await res.json();
                setBundleItems(data.items || []);
                setRawAssetFiles([]);
                setActiveBundleMeta(null);
                setNextCursor(data.nextCursor || "");
                setSnapshotRevision(data.snapshotRevision || 0);
            }
        } catch (err) {
            console.error("Failed to load assets view:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, [server, prefix, bundlePath, gatewayDomain]);

    useEffect(() => {
        fetchCurrentView();
    }, [fetchCurrentView]);

    // Fetch next page
    const fetchMore = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return;
        try {
            setIsLoadingMore(true);

            if (bundlePath) {
                const url = `${gatewayDomain}/api/assets/bundle-files?server=${server}&path=${encodeURIComponent(bundlePath)}&limit=200&cursor=${encodeURIComponent(nextCursor)}`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data: BundleFilesResponse = await res.json();
                setRawAssetFiles(prev => [...prev, ...(data.items || [])]);
                setNextCursor(data.nextCursor || "");
                setSnapshotRevision(data.snapshotRevision || 0);
            } else {
                const url = `${gatewayDomain}/api/assets/bundles?server=${server}&prefix=${encodeURIComponent(prefix)}&limit=200&cursor=${encodeURIComponent(nextCursor)}`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data: BundleBrowseResponse = await res.json();
                setBundleItems(prev => [...prev, ...(data.items || [])]);
                setNextCursor(data.nextCursor || "");
                setSnapshotRevision(data.snapshotRevision || 0);
            }
        } catch (err) {
            console.error("Failed to load more items:", err);
        } finally {
            setIsLoadingMore(false);
        }
    }, [server, prefix, bundlePath, gatewayDomain, nextCursor, isLoadingMore]);

    // Group raw files into merged asset items (merging png + webp)
    const mergedAssetFiles = useMemo(() => {
        return groupBundleFiles(rawAssetFiles);
    }, [rawAssetFiles]);

    // Breadcrumbs list
    const breadcrumbs = useMemo(() => {
        const parts = prefix.split("/").filter(Boolean);
        const list = [{ name: t("page.assetViewer.root"), path: "", isBundle: false }];
        let currentPath = "";
        for (const part of parts) {
            currentPath += part + "/";
            list.push({ name: part, path: currentPath, isBundle: false });
        }
        if (bundlePath) {
            const bundleName = bundlePath.split("/").pop() || bundlePath;
            list.push({ name: bundleName, path: bundlePath, isBundle: true });
        }
        return list;
    }, [prefix, bundlePath, t]);

    // Breadcrumb click handler
    const handleBreadcrumbClick = (bc: { name: string; path: string; isBundle: boolean }) => {
        if (bc.isBundle) return;
        setBundlePath("");
        setPrefix(bc.path);
    };

    // Go back up one level
    const handleGoBack = useCallback(() => {
        if (bundlePath) {
            setBundlePath("");
            return;
        }
        if (!prefix) return;
        const parts = prefix.split("/").filter(Boolean);
        parts.pop();
        const parentPath = parts.length > 0 ? parts.join("/") + "/" : "";
        setPrefix(parentPath);
    }, [prefix, bundlePath]);

    // Processed directory & bundle items
    const processedBundleItems = useMemo(() => {
        let list = [...bundleItems];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item => item.name.toLowerCase().includes(query));
        }

        if (filterType === "directories") {
            list = list.filter(item => item.type === "directory");
        } else if (filterType === "bundles") {
            list = list.filter(item => item.type === "bundle");
        }

        list.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "directory" ? -1 : 1;
            }

            const isAsc = sortOrder === "asc";

            if (a.type === "directory") {
                return isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }

            if (sortBy === "size") {
                const sizeA = a.totalSize || 0;
                const sizeB = b.totalSize || 0;
                return isAsc ? sizeA - sizeB : sizeB - sizeA;
            }

            if (sortBy === "fileCount") {
                const countA = a.fileCount || 0;
                const countB = b.fileCount || 0;
                return isAsc ? countA - countB : countB - countA;
            }

            return isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        });

        return list;
    }, [bundleItems, searchQuery, filterType, sortBy, sortOrder]);

    // Processed asset files inside bundle
    const processedAssetFiles = useMemo(() => {
        let list = [...mergedAssetFiles];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.formats.some(f => f.name.toLowerCase().includes(query))
            );
        }

        list.sort((a, b) => {
            const isAsc = sortOrder === "asc";
            if (sortBy === "size") {
                const sizeA = a.totalSize || 0;
                const sizeB = b.totalSize || 0;
                return isAsc ? sizeA - sizeB : sizeB - sizeA;
            }
            return isAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        });

        return list;
    }, [mergedAssetFiles, searchQuery, sortBy, sortOrder]);

    // Active format in modal
    const activeFormat = useMemo(() => {
        if (!selectedFile || selectedFile.formats.length === 0) return null;
        return selectedFile.formats[activeFormatIndex] || selectedFile.formats[0];
    }, [selectedFile, activeFormatIndex]);

    // Fetch text preview
    const handleFetchPreviewText = async (format: AssetFormatInfo) => {
        if (!format.url) return;
        try {
            setIsPreviewTextLoading(true);
            setPreviewTextError(null);
            setPreviewText(null);

            const fileUrl = `${gatewayDomain}${format.url}`;
            const res = await fetch(fileUrl);
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

    // Clipboard copy
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
        });
    };

    // Sidebar Filters configuration
    const totalItemCount = bundlePath ? mergedAssetFiles.length : bundleItems.length;
    const currentItemCount = bundlePath ? processedAssetFiles.length : processedBundleItems.length;
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
            filteredCount={currentItemCount}
            totalCount={totalItemCount}
            countUnit={t("page.assetViewer.countUnit")}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={t("page.assetViewer.searchPlaceholder")}
            sortOptions={
                bundlePath
                    ? [
                          { id: "name", label: t("common.form.uid") },
                          { id: "size", label: t("page.assetViewer.size") },
                      ]
                    : [
                          { id: "name", label: t("common.form.uid") },
                          { id: "size", label: t("page.assetViewer.totalSize") },
                          { id: "fileCount", label: t("page.assetViewer.fileCount") },
                      ]
            }
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
                setSortBy(field as "name" | "size" | "fileCount");
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

            {!bundlePath && (
                <FilterSection label={t("page.assetViewer.source")}>
                    <div className="grid grid-cols-3 gap-2">
                        {(["all", "directories", "bundles"] as const).map(type => (
                            <FilterButton
                                key={type}
                                selected={filterType === type}
                                onClick={() => setFilterType(type)}
                            >
                                {type === "all" ? t("page.assetViewer.allTypes") :
                                 type === "directories" ? t("page.assetViewer.typeDirectory") :
                                 t("page.assetViewer.typeBundle")}
                            </FilterButton>
                        ))}
                    </div>
                </FilterSection>
            )}
        </BaseFilters>
    );

    useQuickFilter(t("page.assetViewer.title"), quickFilterContent, [
        searchQuery,
        server,
        filterType,
        sortBy,
        sortOrder,
        bundlePath,
        currentItemCount,
        totalItemCount,
        t,
    ]);

    const modalHeaderActions = useMemo(() => {
        if (!activeFormat?.url) return null;
        return (
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => handleCopyToClipboard(`${gatewayDomain}${activeFormat.url}`)}
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
                    href={`${gatewayDomain}${activeFormat.url}`}
                    className="p-1.5 text-slate-400 hover:text-miku island-pill-hover rounded-full transition-colors flex items-center justify-center"
                    title={t("page.assetViewer.download")}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </ExternalLink>
            </div>
        );
    }, [activeFormat, gatewayDomain, copyFeedback, t]);

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

                {/* File & Bundle Explorer Panel */}
                <div className="flex-1 min-w-0">
                    {/* Breadcrumbs Navigation & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 ios-glass-card rounded-2xl">
                        <div className="flex items-center gap-2">
                            {(prefix || bundlePath) && (
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
                                    <div key={`${bc.path}-${index}`} className="flex items-center gap-1.5">
                                        {index > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
                                        {bc.isBundle ? (
                                            <span className="text-miku font-bold flex items-center gap-1 bg-miku/10 px-2 py-0.5 rounded-lg border border-miku/20">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                                </svg>
                                                {bc.name}
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleBreadcrumbClick(bc)}
                                                className={`hover:text-miku transition-colors ${
                                                    index === breadcrumbs.length - 1 && !bundlePath
                                                        ? "text-primary-text font-bold"
                                                        : ""
                                                }`}
                                            >
                                                {bc.name}
                                            </button>
                                        )}
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

                            <LocalizedLink
                                href={`/asset-versions?server=${server}`}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary-text transition-all duration-200"
                                title={t("layout.nav.items.assetVersions")}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </LocalizedLink>

                            <button
                                onClick={fetchCurrentView}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary-text transition-all duration-200"
                                title={t("common.action.refresh")}
                            >
                                <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Active Bundle Details Banner */}
                    {bundlePath && activeBundleMeta && (
                        <div className="mb-4 p-5 ios-glass-card border-miku/30 bg-gradient-to-r from-miku/5 via-transparent to-purple-500/5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 rounded-2xl bg-miku/10 text-miku border border-miku/20 shrink-0">
                                    <ArchiveBundleIcon />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-primary-text truncate max-w-xs sm:max-w-md" title={activeBundleMeta.path}>
                                        {activeBundleMeta.path.split("/").pop()}
                                    </h2>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-sm" title={activeBundleMeta.fingerprint || ""}>
                                        {activeBundleMeta.fingerprint ? `FP: ${activeBundleMeta.fingerprint}` : activeBundleMeta.path}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <div className="text-right">
                                    <span className="block text-slate-400">{t("page.assetViewer.fileCount")}</span>
                                    <span className="font-bold text-primary-text">{formatNumber(activeBundleMeta.fileCount)}</span>
                                </div>
                                <div className="w-px h-7 bg-slate-200 dark:bg-slate-800" />
                                <div className="text-right">
                                    <span className="block text-slate-400">{t("page.assetViewer.totalSize")}</span>
                                    <span className="font-bold text-primary-text">{formatBytes(activeBundleMeta.totalSize)}</span>
                                </div>
                                {activeBundleMeta.source && (
                                    <>
                                        <div className="w-px h-7 bg-slate-200 dark:bg-slate-800" />
                                        <div className="text-right">
                                            <span className="block text-slate-400">{t("page.assetViewer.source")}</span>
                                            <span className="font-bold text-purple-400 uppercase text-[10px] px-1.5 py-0.5 bg-purple-500/10 rounded-md border border-purple-500/20">
                                                {activeBundleMeta.source}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

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
                                onClick={fetchCurrentView}
                                className="ios-glass-btn ios-glass-btn-primary px-4 py-2 text-xs rounded-xl"
                            >
                                {t("common.action.retry")}
                            </button>
                        </div>
                    ) : (bundlePath ? processedAssetFiles.length === 0 : processedBundleItems.length === 0) ? (
                        <div className="p-12 text-center ios-glass-card rounded-2xl text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                            <p>{t("page.assetViewer.emptyFolder")}</p>
                        </div>
                    ) : (
                        <>
                            {/* Directory & Bundles Tree View (Without redundant text badges) */}
                            {!bundlePath ? (
                                viewMode === "grid" ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {processedBundleItems.map((item, index) => {
                                            const isDir = item.type === "directory";
                                            return (
                                                <div
                                                    key={`${item.path}-${index}`}
                                                    onClick={() => {
                                                        if (isDir) {
                                                            setPrefix(item.path.endsWith("/") ? item.path : item.path + "/");
                                                        } else {
                                                            setBundlePath(item.path);
                                                        }
                                                    }}
                                                    className="group ios-glass-card ios-glass-card-interactive p-4 rounded-2xl flex items-center gap-3 cursor-pointer select-none"
                                                >
                                                    <div className="shrink-0 p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/30 group-hover:scale-105 transition-transform duration-200">
                                                        {isDir ? <FolderIcon /> : <ArchiveBundleIcon />}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                            {item.name}
                                                        </p>
                                                        <div className="mt-0.5 text-[11px] text-slate-400 font-medium truncate">
                                                            {!isDir && (
                                                                <span>
                                                                    {formatBytes(item.totalSize)}
                                                                    {item.fileCount !== undefined && ` • ${item.fileCount} files`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200/10 mb-1 select-none">
                                            <div className="w-10"></div>
                                            <div className="flex-1 min-w-0">{t("common.form.uid")}</div>
                                            <div className="w-24 text-right">{t("page.assetViewer.fileCount")}</div>
                                            <div className="w-28 text-right hidden sm:block">{t("page.assetViewer.totalSize")}</div>
                                        </div>
                                        {processedBundleItems.map((item, index) => {
                                            const isDir = item.type === "directory";
                                            return (
                                                <div
                                                    key={`${item.path}-${index}`}
                                                    onClick={() => {
                                                        if (isDir) {
                                                            setPrefix(item.path.endsWith("/") ? item.path : item.path + "/");
                                                        } else {
                                                            setBundlePath(item.path);
                                                        }
                                                    }}
                                                    className="group ios-glass-card ios-glass-card-interactive p-3 rounded-2xl flex items-center gap-3 cursor-pointer select-none"
                                                >
                                                    <div className="shrink-0 p-1.5 rounded-lg bg-slate-100/50 dark:bg-slate-900/30 group-hover:scale-105 transition-transform duration-200">
                                                        {isDir ? <FolderIcon /> : <ArchiveBundleIcon />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                            {item.name}
                                                        </p>
                                                    </div>
                                                    <div className="w-24 shrink-0 text-right text-xs text-slate-400 font-medium">
                                                        {isDir ? "-" : (item.fileCount !== undefined ? `${item.fileCount} files` : "-")}
                                                    </div>
                                                    <div className="w-28 shrink-0 text-right text-xs font-mono text-slate-400 truncate hidden sm:block">
                                                        {isDir ? "-" : formatBytes(item.totalSize)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                                /* Files inside Bundle (with direct Image Previews & Merged PNG+WEBP formats) */
                                viewMode === "grid" ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {processedAssetFiles.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedFile(item);
                                                    setActiveFormatIndex(0);
                                                }}
                                                className="group ios-glass-card ios-glass-card-interactive p-3 rounded-2xl flex flex-col cursor-pointer select-none overflow-hidden"
                                            >
                                                {/* Direct Thumbnail Preview for Images */}
                                                {item.isImage && item.primaryUrl ? (
                                                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 flex items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:8px_8px] bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
                                                        <img
                                                            src={`${gatewayDomain}${item.primaryUrl}`}
                                                            alt={item.name}
                                                            loading="lazy"
                                                            className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-200"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = "none";
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative w-full aspect-square rounded-xl mb-2.5 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30">
                                                        {getFileIcon(item.name)}
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1 flex flex-col justify-between">
                                                    <p className="text-xs font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                        {item.name}
                                                    </p>

                                                    <div className="flex items-center justify-between gap-1 mt-1.5">
                                                        {/* Formats Pills */}
                                                        <div className="flex items-center gap-1">
                                                            {item.formats.map((f) => (
                                                                <span
                                                                    key={f.ext}
                                                                    className="px-1.5 py-0.2 text-[9px] font-bold rounded-md uppercase bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/40"
                                                                >
                                                                    {f.ext}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {formatBytes(item.totalSize)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200/10 mb-1 select-none">
                                            <div className="w-12"></div>
                                            <div className="flex-1 min-w-0">{t("common.form.uid")}</div>
                                            <div className="w-32 text-center font-normal">Formats</div>
                                            <div className="w-24 text-right">{t("page.assetViewer.size")}</div>
                                        </div>
                                        {processedAssetFiles.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedFile(item);
                                                    setActiveFormatIndex(0);
                                                }}
                                                className="group ios-glass-card ios-glass-card-interactive p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer select-none"
                                            >
                                                {/* Thumbnail preview in list mode */}
                                                <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:6px_6px] bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50">
                                                    {item.isImage && item.primaryUrl ? (
                                                        <img
                                                            src={`${gatewayDomain}${item.primaryUrl}`}
                                                            alt={item.name}
                                                            loading="lazy"
                                                            className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform duration-200"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = "none";
                                                            }}
                                                        />
                                                    ) : (
                                                        getFileIcon(item.name)
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors duration-200" title={item.name}>
                                                        {item.name}
                                                    </p>
                                                </div>

                                                <div className="w-32 shrink-0 flex items-center justify-center gap-1">
                                                    {item.formats.map((f) => (
                                                        <span
                                                            key={f.ext}
                                                            className="px-1.5 py-0.2 text-[9px] font-bold rounded-md uppercase bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/40"
                                                        >
                                                            {f.ext}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="w-24 shrink-0 text-right text-xs text-slate-400 font-medium">
                                                    {formatBytes(item.totalSize)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* Load Next Page Cursor */}
                            {nextCursor && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={fetchMore}
                                        disabled={isLoadingMore}
                                        className="ios-glass-btn ios-glass-btn-primary px-8 py-3 font-bold rounded-2xl flex items-center gap-2"
                                    >
                                        {isLoadingMore ? (
                                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {t("page.assetViewer.loadMore")}
                                                <span className="text-xs font-semibold opacity-75 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                                                    {formatNumber(bundlePath ? mergedAssetFiles.length : bundleItems.length)}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* All Loaded Message */}
                            {!nextCursor && (bundlePath ? processedAssetFiles.length > 0 : processedBundleItems.length > 0) && (
                                <div className="mt-8 text-center text-slate-400 text-sm font-medium">
                                    {t("page.assetViewer.allLoaded", { count: bundlePath ? processedAssetFiles.length : processedBundleItems.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* File Detail & Preview Modal */}
            <Modal
                isOpen={!!selectedFile}
                onClose={() => {
                    setSelectedFile(null);
                    setActiveFormatIndex(0);
                    setPreviewText(null);
                    setPreviewTextError(null);
                }}
                title={selectedFile?.name || ""}
                size="md"
                headerActions={modalHeaderActions}
            >
                {selectedFile && activeFormat && (
                    <div className="space-y-6">
                        {/* Format Switcher Tabs (if multiple formats exist, e.g. WEBP + PNG) */}
                        {selectedFile.formats.length > 1 && (
                            <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                                {selectedFile.formats.map((f, idx) => (
                                    <button
                                        key={f.ext}
                                        onClick={() => {
                                            setActiveFormatIndex(idx);
                                            setPreviewText(null);
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                            activeFormatIndex === idx
                                                ? "bg-white dark:bg-slate-800 text-miku shadow-sm border border-slate-200/60 dark:border-slate-700/60"
                                                : "text-slate-400 hover:text-primary-text"
                                        }`}
                                    >
                                        <span className="uppercase">{f.ext}</span>
                                        <span className="text-[10px] font-mono opacity-75">{formatBytes(f.size)}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* File Details Grid */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-xs sm:text-sm space-y-2.5">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.size")}</span>
                                <span className="text-primary-text font-bold text-right">{formatBytes(activeFormat.size)}</span>
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
                            {activeFormat.fingerprint && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400 font-medium shrink-0">{t("page.assetViewer.fingerprint")}</span>
                                    <span className="text-primary-text font-mono text-right truncate max-w-[200px]" title={activeFormat.fingerprint}>{activeFormat.fingerprint}</span>
                                </div>
                            )}
                            {activeFormat.sha256 && (
                                <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-200/40 dark:border-slate-800/40">
                                    <span className="text-slate-400 font-medium">{t("page.assetViewer.sha256")}</span>
                                    <span className="text-primary-text font-mono text-[10px] sm:text-xs select-all break-all">{activeFormat.sha256}</span>
                                </div>
                            )}
                        </div>

                        {/* Inline Previews */}
                        <div className="flex flex-col items-center justify-center">
                            {selectedFile.isImage && activeFormat.url && (
                                <div className="relative w-full max-h-72 flex justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:10px_10px] bg-slate-100/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                                    <img
                                        src={`${gatewayDomain}${activeFormat.url}`}
                                        alt={activeFormat.name}
                                        className="max-h-64 object-contain rounded-lg"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                </div>
                            )}

                            {selectedFile.isAudio && activeFormat.url && (
                                <div className="w-full p-4 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                                    <p className="text-xs text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                        </svg>
                                        {t("page.assetViewer.playAudio")}
                                    </p>
                                    <audio
                                        src={`${gatewayDomain}${activeFormat.url}`}
                                        controls
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {selectedFile.isText && activeFormat.url && (
                                <div className="w-full">
                                    {previewText === null && !isPreviewTextLoading && !previewTextError && (
                                        <button
                                            onClick={() => handleFetchPreviewText(activeFormat)}
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
            <AssetTosModal open={showTos} onOpenChange={setShowTos} />
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
