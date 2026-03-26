"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import BaseFilters, { FilterSection, FilterToggle } from "@/components/common/BaseFilters";
import {
    getAccounts,
    getActiveAccount,
    setActiveAccount,
    createAccount,
    getTopCharacterId,
    fetchAccountGameData,
    normalizeAccountDataError,
    SERVER_OPTIONS,
    type AccountDataErrorCode,
    type MoesekaiAccount,
    type ServerType,
} from "@/lib/account";

import { fetchMasterDataForServer } from "@/lib/fetch";
import { getMaterialThumbnailUrl, getMysekaiMaterialThumbnailUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import type { AssetSourceType } from "@/contexts/ThemeContext";
import type { IMysekaiMaterial } from "@/types/mysekai";
import AccountSelectorBar from "@/components/AccountSelectorBar";
import QuickBindForm from "@/components/QuickBindForm";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

// ==================== Types ====================

interface MaterialMaster {
    id: number;
    seq: number;
    name: string;
    materialType: string;
}

interface UserMaterialRaw {
    materialId: number;
    quantity: number;
}

interface UserMysekaiMaterialRaw {
    mysekaiMaterialId: number;
    quantity: number;
}

interface DisplayMaterial {
    id: number;
    name: string;
    quantity: number;
    seq: number;
    thumbnailUrl: string;
}

type TabType = "materials" | "mysekaiMaterials";

// ==================== Helpers ====================

function parseUploadTimeToDate(uploadTime: string | number): Date | null {
    if (typeof uploadTime === "number") {
        if (!Number.isFinite(uploadTime)) return null;
        const normalized = uploadTime < 1_000_000_000_000 ? uploadTime * 1000 : uploadTime;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const text = String(uploadTime).trim();
    if (!text) return null;
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
        const normalized = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatUploadTime(uploadTime: string | number): string {
    const date = parseUploadTimeToDate(uploadTime);
    if (!date) return String(uploadTime);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
}

function getAssetSourceForServer(server: ServerType, assetSource: AssetSourceType): AssetSourceType {
    if (server === "cn" || server === "tw") {
        const cnSourceMap: Record<string, AssetSourceType> = {
            uni: "snowyassets_cn",
            haruki: "haruki_cn",
            snowyassets: "snowyassets_cn",
            snowyassets_cn: "snowyassets_cn",
            haruki_cn: "haruki_cn",
        };
        return cnSourceMap[assetSource] || "snowyassets_cn";
    }
    return assetSource;
}

function getUserErrorMessage(code: AccountDataErrorCode): string {
    switch (code) {
        case "API_NOT_PUBLIC":
            return "当前账号的公开 API 未开启，且 OAuth2 数据读取也不可用。请前往 Haruki 开启公开 API，或重新进行 OAuth2 授权。";
        case "NOT_FOUND":
            return "用户数据未找到，请确认 UID、服务器是否正确，并已在 Haruki 上传数据。";
        case "OAUTH_REAUTH_REQUIRED":
            return "当前 OAuth2 授权已过期，请重新授权；如果该账号已开启公开 API，可刷新页面后重试。";
        case "OAUTH_ACCESS_FAILED":
            return "OAuth2 数据读取失败，且无法回退到公开 API。请重新授权或稍后再试。";
        case "NETWORK_ERROR":
        default:
            return "网络异常，请稍后重试。";
    }
}

// ==================== Main Component ====================

function MyMaterialsContent() {
    const { assetSource } = useTheme();

    // Account state
    const [accounts, setAccountsList] = useState<MoesekaiAccount[]>([]);
    const [activeAccount, setActiveAcc] = useState<MoesekaiAccount | null>(null);

    // Data state
    const [materialsMaster, setMaterialsMaster] = useState<Map<number, MaterialMaster>>(new Map());
    const [mysekaiMaterialsMaster, setMysekaiMaterialsMaster] = useState<Map<number, IMysekaiMaterial>>(new Map());
    const [userMaterials, setUserMaterials] = useState<UserMaterialRaw[]>([]);
    const [userMysekaiMaterials, setUserMysekaiMaterials] = useState<UserMysekaiMaterialRaw[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingUser, setIsFetchingUser] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userError, setUserError] = useState<AccountDataErrorCode | null>(null);
    const [uploadTime, setUploadTime] = useState<string | number | null>(null);

    // UI state
    const [activeTab, setActiveTab] = useState<TabType>("materials");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<string>("seq");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [hideZero, setHideZero] = useState(true);

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "my-materials",
        defaultDisplayCount: 60,
        increment: 60,
        isReady: !isLoading && !isFetchingUser,
    });

    // Load accounts
    useEffect(() => {
        const accs = getAccounts();
        setAccountsList(accs);
        const active = getActiveAccount();
        setActiveAcc(active);
    }, []);

    // Fetch masterdata when account changes
    useEffect(() => {
        if (!activeAccount) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        async function loadMasterData() {
            setIsLoading(true);
            setError(null);

            try {
                const server = activeAccount!.server;
                const effectiveServer = server === "tw" ? "cn" : server;

                const [materialsData, mysekaiMaterialsData] = await Promise.all([
                    fetchMasterDataForServer<MaterialMaster[]>(effectiveServer, "materials.json").catch(() => []),
                    fetchMasterDataForServer<IMysekaiMaterial[]>(effectiveServer, "mysekaiMaterials.json").catch(() => []),
                ]);

                if (cancelled) return;

                const matMap = new Map<number, MaterialMaster>();
                materialsData.forEach((m) => matMap.set(m.id, m));
                setMaterialsMaster(matMap);

                const msMatMap = new Map<number, IMysekaiMaterial>();
                mysekaiMaterialsData.forEach((m) => msMatMap.set(m.id, m));
                setMysekaiMaterialsMaster(msMatMap);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "加载材料数据失败");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        loadMasterData();
        return () => { cancelled = true; };
    }, [activeAccount]);

    // Fetch user materials from suite API
    useEffect(() => {
        if (!activeAccount) {
            setUserMaterials([]);
            setUserMysekaiMaterials([]);
            return;
        }

        let cancelled = false;

        async function fetchUserMaterials() {
            setIsFetchingUser(true);
            setUserError(null);

            try {
                const data = await fetchAccountGameData(activeAccount!, ["userMaterials", "userMysekaiMaterials", "upload_time"]);

                if (!cancelled) {
                    setUserMaterials(Array.isArray(data.userMaterials) ? data.userMaterials as UserMaterialRaw[] : []);
                    setUserMysekaiMaterials(Array.isArray(data.userMysekaiMaterials) ? data.userMysekaiMaterials as UserMysekaiMaterialRaw[] : []);
                    setUploadTime(typeof data.upload_time === "number" || typeof data.upload_time === "string" ? data.upload_time : null);
                }
            } catch (error) {
                if (!cancelled) setUserError(normalizeAccountDataError(error));
            } finally {
                if (!cancelled) setIsFetchingUser(false);
            }
        }

        fetchUserMaterials();
        return () => { cancelled = true; };
    }, [activeAccount]);

    // Total items (before filter) for current tab
    const allItemsForTab = useMemo(() => {
        return activeTab === "materials" ? userMaterials.length : userMysekaiMaterials.length;
    }, [activeTab, userMaterials, userMysekaiMaterials]);

    // Build display items for regular materials
    const displayMaterials = useMemo((): DisplayMaterial[] => {
        const finalSource = activeAccount
            ? getAssetSourceForServer(activeAccount.server, assetSource)
            : assetSource;

        const items: DisplayMaterial[] = userMaterials.map((um) => {
            const master = materialsMaster.get(um.materialId);
            return {
                id: um.materialId,
                name: master?.name || `材料 ${um.materialId}`,
                quantity: um.quantity,
                seq: master?.seq ?? 999999,
                thumbnailUrl: getMaterialThumbnailUrl(um.materialId, finalSource),
            };
        });

        return filterAndSort(items);
    }, [userMaterials, materialsMaster, searchQuery, sortBy, sortOrder, hideZero, assetSource, activeAccount]);

    // Build display items for mysekai materials
    const displayMysekaiMaterials = useMemo((): DisplayMaterial[] => {
        const finalSource = activeAccount
            ? getAssetSourceForServer(activeAccount.server, assetSource)
            : assetSource;

        const items: DisplayMaterial[] = userMysekaiMaterials.map((um) => {
            const master = mysekaiMaterialsMaster.get(um.mysekaiMaterialId);
            return {
                id: um.mysekaiMaterialId,
                name: master?.name || `MySekai材料 ${um.mysekaiMaterialId}`,
                quantity: um.quantity,
                seq: master?.seq ?? 999999,
                thumbnailUrl: master
                    ? getMysekaiMaterialThumbnailUrl(master.iconAssetbundleName, finalSource)
                    : "",
            };
        });

        return filterAndSort(items);
    }, [userMysekaiMaterials, mysekaiMaterialsMaster, searchQuery, sortBy, sortOrder, hideZero, assetSource, activeAccount]);

    // Shared filter/sort logic
    function filterAndSort(items: DisplayMaterial[]): DisplayMaterial[] {
        let result = [...items];

        if (hideZero) {
            result = result.filter((m) => m.quantity > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((m) => m.name.toLowerCase().includes(q) || String(m.id).includes(q));
        }

        result.sort((a, b) => {
            let cmp = 0;
            if (sortBy === "quantity") {
                cmp = a.quantity - b.quantity;
            } else {
                cmp = a.seq - b.seq;
            }
            if (cmp !== 0) return sortOrder === "asc" ? cmp : -cmp;
            return a.id - b.id;
        });

        return result;
    }

    const currentItems = activeTab === "materials" ? displayMaterials : displayMysekaiMaterials;
    const displayedItems = useMemo(() => currentItems.slice(0, displayCount), [currentItems, displayCount]);

    const handleAccountSelect = useCallback((acc: MoesekaiAccount) => {
        setActiveAccount(acc.id);
        setActiveAcc(acc);
    }, []);

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const handleSortChange = useCallback((newSortBy: string, newSortOrder: "asc" | "desc") => {
        setSortBy(newSortBy);
        setSortOrder(newSortOrder);
        resetDisplayCount();
    }, [resetDisplayCount]);

    const hasActiveFilters = searchQuery !== "" || sortBy !== "seq" || !hideZero;

    const resetFilters = useCallback(() => {
        setSearchQuery("");
        setSortBy("seq");
        setSortOrder("desc");
        setHideZero(true);
        resetDisplayCount();
    }, [resetDisplayCount]);

    // Stats
    const totalQuantity = currentItems.reduce((sum, m) => sum + m.quantity, 0);

    const sortOptions = useMemo(() => [
        { id: "seq", label: "默认" },
        { id: "quantity", label: "数量" },
    ], []);

    // Quick filter content (BaseFilters panel)
    const quickFilterContent = (
        <BaseFilters
            title="筛选"
            filteredCount={currentItems.length}
            totalCount={allItemsForTab}
            countUnit="种"
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); resetDisplayCount(); }}
            searchPlaceholder="搜索材料名称或ID..."
            sortOptions={sortOptions}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
        >
            <FilterSection label="显示">
                <FilterToggle
                    selected={hideZero}
                    onClick={() => { setHideZero(!hideZero); resetDisplayCount(); }}
                    label="隐藏数量为0的材料"
                />
            </FilterSection>
        </BaseFilters>
    );

    useQuickFilter("资源筛选", quickFilterContent, [
        searchQuery,
        sortBy,
        sortOrder,
        hideZero,
        currentItems.length,
        allItemsForTab,
    ]);

    // No account state
    if (accounts.length === 0) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-3xl">
                <PageHeader />
                <QuickBindForm
                    onAccountAdded={() => {
                        setAccountsList(getAccounts());
                        const active = getActiveAccount();
                        setActiveAcc(active);
                    }}
                    description="绑定账号后即可查看你的材料库存"
                    returnTo="/my-materials"
                />

            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <PageHeader />

            <AccountSelectorBar
                accounts={accounts}
                activeAccount={activeAccount}
                onSelect={handleAccountSelect}
                onAccountAdded={() => {
                    setAccountsList(getAccounts());
                    const active = getActiveAccount();
                    setActiveAcc(active);
                }}
                returnTo="/my-materials"
            />


            {/* TW Warning */}
            {activeAccount?.server === "tw" && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200/50 text-xs text-amber-700 flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>繁中服使用国服 masterdata，数据可能不准确</span>
                </div>
            )}

            {/* User Error */}
            {userError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/50">
                    <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-xs font-medium text-red-700">
                                {getUserErrorMessage(userError)}
                            </p>
                            <ExternalLink
                                href="https://haruki.seiunx.com"
                                className="text-xs text-miku hover:underline mt-1 inline-block"
                            >
                                前往 Haruki 工具箱 →
                            </ExternalLink>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className="mb-4 flex items-center gap-2">
                {([
                    { key: "materials" as TabType, label: "普通材料" },
                    { key: "mysekaiMaterials" as TabType, label: "MySekai 材料" },
                ]).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === tab.key
                            ? "bg-miku/10 text-miku ring-1 ring-miku/30"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
                {/* Upload time badge */}
                {uploadTime && !isLoading && !isFetchingUser && (
                    <span className="ml-auto text-[11px] text-slate-400" title="数据上传时间">
                        数据时间: {formatUploadTime(uploadTime)}
                    </span>
                )}
            </div>

            {/* Stats summary */}
            {!isLoading && !isFetchingUser && currentItems.length > 0 && (
                <div className="mb-4 text-xs text-slate-500">
                    共 <span className="font-bold text-miku">{currentItems.length}</span> 种材料，
                    合计 <span className="font-bold text-miku">{totalQuantity.toLocaleString()}</span> 个
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout: Filters + Grid */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters (left sidebar) */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                {/* Grid (right content) */}
                <div className="flex-1 min-w-0">
                    {isLoading || isFetchingUser ? (
                        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm animate-pulse">
                                    <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200" />
                                    <div className="p-2 space-y-1.5">
                                        <div className="h-3 bg-slate-200 rounded w-3/4" />
                                        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : currentItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-slate-400 font-medium">
                                {searchQuery ? "没有找到符合条件的材料" : "暂无材料数据"}
                            </p>
                            {!searchQuery && (
                                <p className="text-slate-400 text-xs mt-1">
                                    请确认已在 Haruki 上传 Suite 数据
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {displayedItems.map((item) => (
                                <MaterialCard key={item.id} item={item} />
                            ))}
                        </div>
                    )}

                    {/* Load More */}
                    {!isLoading && !isFetchingUser && displayedItems.length < currentItems.length && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                data-shortcut-load-more="true"
                                className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                加载更多
                                <span className="ml-2 text-sm opacity-80">
                                    ({displayedItems.length} / {currentItems.length})
                                </span>
                            </button>
                        </div>
                    )}

                    {/* All loaded */}
                    {!isLoading && !isFetchingUser && displayedItems.length > 0 && displayedItems.length >= currentItems.length && (
                        <div className="mt-8 text-center text-slate-400 text-sm">
                            已显示全部 {currentItems.length} 种材料
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== Sub Components ====================

function PageHeader() {
    return (
        <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                <span className="text-miku text-xs font-bold tracking-widest uppercase">Materials</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                资源<span className="text-miku">查询</span>
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
                查看你拥有的材料与资源
            </p>
        </div>
    );
}

function MaterialCard({ item }: { item: DisplayMaterial }) {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="relative rounded-xl overflow-hidden bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-3">
                {item.thumbnailUrl && !imgError ? (
                    <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                )}
            </div>
            <div className="px-2 py-1.5 bg-white border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-800 leading-tight" title={item.name}>
                    {item.name}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-slate-400">#{item.id}</span>
                    <span className="text-[10px] font-mono font-bold text-miku bg-miku/10 px-1.5 py-0.5 rounded leading-none">
                        ×{item.quantity.toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ==================== Export ====================

export default function MyMaterialsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载...</div>}>
                <MyMaterialsContent />
            </Suspense>
        </MainLayout>
    );
}
