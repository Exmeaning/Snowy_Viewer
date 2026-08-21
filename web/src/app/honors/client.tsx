"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { replaceCurrentUrlSearchParams } from "@/lib/localized-path";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import HonorFilters from "@/components/honor/HonorFilters";
import HonorDetailDialog from "@/components/honor/HonorDetailDialog";
import BondsHonorDetailDialog from "@/components/honor/BondsHonorDetailDialog";
import DegreeImage from "@/components/honor/DegreeImage";
import BondsDegreeImage from "@/components/honor/BondsDegreeImage";
import BaseFilters, { FilterSection, FilterToggle } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { fetchMasterData } from "@/lib/fetch";
import {
    IHonorInfo, IHonorGroup, IBondsHonor, IBondsHonorWord, IBond, IGameCharaUnit,
} from "@/types/honor";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";

type HonorTab = "normal" | "bonds";
type TranslationFn = ReturnType<typeof useI18n>["t"];

function formatFallbackLabel(value: string): string {
    return value.replace(/_/g, " ");
}

function getHonorTypeLabel(type: string, t: TranslationFn): string {
    const key = `common.honor.types.${type}`;
    const label = t(key);
    return label === key ? formatFallbackLabel(type) : label;
}

function getHonorRarityLabel(rarity: string, t: TranslationFn): string {
    const key = `common.honor.rarities.${rarity}`;
    const label = t(key);
    return label === key ? formatFallbackLabel(rarity) : label;
}

function HonorsContent() {
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();
    const { t } = useI18n();

    // Tab state
    const [activeTab, setActiveTab] = useState<HonorTab>("normal");

    // ==================== Normal Honor State ====================
    const [honors, setHonors] = useState<IHonorInfo[]>([]);
    const [honorGroups, setHonorGroups] = useState<IHonorGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);

    const [selectedHonor, setSelectedHonor] = useState<IHonorInfo | undefined>();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
    const [groupOnce, setGroupOnce] = useState(false);
    const [sortBy, setSortBy] = useState<string>("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const { displayCount, loadMore, resetDisplayCount } = useScrollRestore({
        storageKey: "honors",
        defaultDisplayCount: 48,
        increment: 48,
        isReady: !isLoading,
    });

    // ==================== Bonds Honor State ====================
    const [bondsHonors, setBondsHonors] = useState<IBondsHonor[]>([]);
    const [bondsHonorWords, setBondsHonorWords] = useState<IBondsHonorWord[]>([]);
    const [bonds, setBonds] = useState<IBond[]>([]);
    const [gameCharaUnits, setGameCharaUnits] = useState<IGameCharaUnit[]>([]);
    const [isBondsLoading, setIsBondsLoading] = useState(false);
    const [bondsError, setBondsError] = useState<string | null>(null);
    const [bondsDataLoaded, setBondsDataLoaded] = useState(false);

    const [selectedBondsHonor, setSelectedBondsHonor] = useState<IBondsHonor | undefined>();
    const [isBondsDialogOpen, setIsBondsDialogOpen] = useState(false);

    const [bondsSearchQuery, setBondsSearchQuery] = useState("");
    const [bondsChar1, setBondsChar1] = useState<number | null>(null);
    const [bondsChar2, setBondsChar2] = useState<number | null>(null);
    const [bondsGroupOnce, setBondsGroupOnce] = useState(false);
    const [bondsSortOrder, setBondsSortOrder] = useState<"asc" | "desc">("desc");

    const { displayCount: bondsDisplayCount, loadMore: bondsLoadMore, resetDisplayCount: bondsResetDisplayCount } = useScrollRestore({
        storageKey: "honors_bonds",
        defaultDisplayCount: 48,
        increment: 48,
        isReady: !isBondsLoading && bondsDataLoaded,
    });

    const STORAGE_KEY = "honors_filters";

    // ==================== Normal: Init filters from URL/session ====================
    useEffect(() => {
        const types = searchParams.get("types");
        const rarities = searchParams.get("rarities");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");
        const group = searchParams.get("groupOnce");
        const tab = searchParams.get("tab");

        if (tab === "bonds") setActiveTab("bonds");

        const hasUrlParams = types || rarities || search || sort || order || group;

        if (hasUrlParams) {
            if (types) setSelectedTypes(types.split(","));
            if (rarities) setSelectedRarities(rarities.split(","));
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort);
            if (order) setSortOrder(order as "asc" | "desc");
            if (group) setGroupOnce(group === "true");
        } else {
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.types?.length) setSelectedTypes(filters.types);
                    if (filters.rarities?.length) setSelectedRarities(filters.rarities);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                    if (filters.groupOnce) setGroupOnce(filters.groupOnce);
                    if (filters.tab) setActiveTab(filters.tab);
                }
            } catch {
                // ignore
            }
        }
        setFiltersInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save filters
    useEffect(() => {
        if (!filtersInitialized) return;

        const filters = {
            types: selectedTypes,
            rarities: selectedRarities,
            search: searchQuery,
            sortBy,
            sortOrder,
            groupOnce,
            tab: activeTab,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch { /* ignore */ }

        const params = new URLSearchParams();
        if (activeTab === "bonds") params.set("tab", "bonds");
        if (selectedTypes.length > 0) params.set("types", selectedTypes.join(","));
        if (selectedRarities.length > 0) params.set("rarities", selectedRarities.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
        if (groupOnce) params.set("groupOnce", "true");
        replaceCurrentUrlSearchParams(params);
    }, [selectedTypes, selectedRarities, searchQuery, sortBy, sortOrder, groupOnce, activeTab, filtersInitialized]);

    // ==================== Normal: Fetch data ====================
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [honorsData, groupsData] = await Promise.all([
                    fetchMasterData<IHonorInfo[]>("honors.json"),
                    fetchMasterData<IHonorGroup[]>("honorGroups.json"),
                ]);
                setHonors(honorsData || []);
                setHonorGroups(groupsData || []);
                setError(null);
            } catch (err) {
                console.error("Error fetching honor data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // ==================== Bonds: Fetch data (lazy, on tab switch) ====================
    useEffect(() => {
        if (activeTab !== "bonds" || bondsDataLoaded) return;

        async function fetchBondsData() {
            try {
                setIsBondsLoading(true);
                const [bh, bhw, b, gcu] = await Promise.all([
                    fetchMasterData<IBondsHonor[]>("bondsHonors.json"),
                    fetchMasterData<IBondsHonorWord[]>("bondsHonorWords.json"),
                    fetchMasterData<IBond[]>("bonds.json"),
                    fetchMasterData<IGameCharaUnit[]>("gameCharacterUnits.json"),
                ]);
                setBondsHonors(bh || []);
                setBondsHonorWords(bhw || []);
                setBonds(b || []);
                setGameCharaUnits(gcu || []);
                setBondsError(null);
                setBondsDataLoaded(true);
            } catch (err) {
                console.error("Error fetching bonds honor data:", err);
                setBondsError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsBondsLoading(false);
            }
        }
        fetchBondsData();
    }, [activeTab, bondsDataLoaded]);

    // ==================== Normal: Derived data ====================
    const honorGroupMap = useMemo(() => {
        const map = new Map<number, IHonorGroup>();
        honorGroups.forEach(g => map.set(g.id, g));
        return map;
    }, [honorGroups]);

    const availableTypes = useMemo(() => {
        return Array.from(new Set(honorGroups.map(g => g.honorType)));
    }, [honorGroups]);

    const filteredHonors = useMemo(() => {
        let result = [...honors];

        if (selectedTypes.length > 0) {
            const validGroupIds = new Set(
                honorGroups
                    .filter(g => selectedTypes.includes(g.honorType))
                    .map(g => g.id)
            );
            result = result.filter(h => validGroupIds.has(h.groupId));
        }

        if (selectedRarities.length > 0) {
            result = result.filter(h => {
                if (h.honorRarity && selectedRarities.includes(h.honorRarity)) return true;
                return h.levels.some(l => l.honorRarity && selectedRarities.includes(l.honorRarity));
            });
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(h => h.name.toLowerCase().includes(query));
        }

        if (groupOnce) {
            const seenGroups = new Set<number>();
            result = result.filter(h => {
                if (seenGroups.has(h.groupId)) return false;
                seenGroups.add(h.groupId);
                return true;
            });
        }

        result.sort((a, b) => {
            const key = sortBy as "id" | "seq";
            if (key === "id" || key === "seq") {
                return sortOrder === "asc" ? a[key] - b[key] : b[key] - a[key];
            }
            return 0;
        });

        return result;
    }, [honors, honorGroups, selectedTypes, selectedRarities, searchQuery, groupOnce, sortBy, sortOrder]);

    const displayedHonors = useMemo(() => {
        return filteredHonors.slice(0, displayCount);
    }, [filteredHonors, displayCount]);

    // ==================== Bonds: Derived data ====================
    const bondsWordMap = useMemo(() => {
        const map = new Map<number, IBondsHonorWord>();
        bondsHonorWords.forEach(w => {
            if (!map.has(w.bondsGroupId)) map.set(w.bondsGroupId, w);
        });
        return map;
    }, [bondsHonorWords]);

    const bondsCharacters = useMemo(() => {
        const charIds = new Set<number>();
        bonds.forEach(b => {
            if (b.characterId1 < 27) charIds.add(b.characterId1);
            if (b.characterId2 < 27) charIds.add(b.characterId2);
        });
        return Array.from(charIds).sort((a, b) => a - b);
    }, [bonds]);

    const filteredBondsHonors = useMemo(() => {
        let result = [...bondsHonors];

        // Character filter via bonds table
        if (bondsChar1 !== null || bondsChar2 !== null) {
            let filteredBonds = [...bonds];
            if (bondsChar1 !== null) {
                filteredBonds = filteredBonds.filter(b =>
                    b.characterId1 === bondsChar1 || b.characterId2 === bondsChar1
                );
            }
            if (bondsChar2 !== null) {
                filteredBonds = filteredBonds.filter(b =>
                    b.characterId1 === bondsChar2 || b.characterId2 === bondsChar2
                );
            }
            const validGroupIds = new Set(filteredBonds.map(b => b.groupId));
            result = result.filter(h => validGroupIds.has(h.bondsGroupId));
        }

        // Search
        if (bondsSearchQuery) {
            const query = bondsSearchQuery.toLowerCase();
            result = result.filter(h => h.name.toLowerCase().includes(query));
        }

        // Group once
        if (bondsGroupOnce) {
            const seenGroups = new Set<number>();
            result = result.filter(h => {
                if (seenGroups.has(h.bondsGroupId)) return false;
                seenGroups.add(h.bondsGroupId);
                return true;
            });
        }

        // Sort
        result.sort((a, b) => bondsSortOrder === "asc" ? a.id - b.id : b.id - a.id);

        return result;
    }, [bondsHonors, bonds, bondsChar1, bondsChar2, bondsSearchQuery, bondsGroupOnce, bondsSortOrder]);

    const displayedBondsHonors = useMemo(() => {
        return filteredBondsHonors.slice(0, bondsDisplayCount);
    }, [filteredBondsHonors, bondsDisplayCount]);

    // ==================== Handlers ====================
    const handleReset = () => {
        setSearchQuery("");
        setSelectedTypes([]);
        setSelectedRarities([]);
        setGroupOnce(false);
        setSortBy("id");
        setSortOrder("desc");
        resetDisplayCount();
    };

    const handleHonorClick = (honor: IHonorInfo) => {
        setSelectedHonor(honor);
        setIsDialogOpen(true);
    };

    const handleBondsHonorClick = (honor: IBondsHonor) => {
        setSelectedBondsHonor(honor);
        setIsBondsDialogOpen(true);
    };

    const handleBondsReset = () => {
        setBondsSearchQuery("");
        setBondsChar1(null);
        setBondsChar2(null);
        setBondsGroupOnce(false);
        setBondsSortOrder("desc");
        bondsResetDisplayCount();
    };

    const bondsHasActiveFilters = bondsChar1 !== null || bondsChar2 !== null || bondsGroupOnce || bondsSearchQuery.length > 0;

    const normalQuickFilterContent = (
        <HonorFilters
            selectedTypes={selectedTypes}
            onTypeChange={setSelectedTypes}
            availableTypes={availableTypes}
            selectedRarities={selectedRarities}
            onRarityChange={setSelectedRarities}
            groupOnce={groupOnce}
            onGroupOnceChange={setGroupOnce}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
                setSortBy(field);
                setSortOrder(order);
            }}
            onReset={handleReset}
            totalCount={honors.length}
            filteredCount={filteredHonors.length}
        />
    );

    const bondsQuickFilterContent = (
        <BaseFilters
            filteredCount={filteredBondsHonors.length}
            totalCount={bondsHonors.length}
            countUnit={t("page.honors.countUnit")}
            searchQuery={bondsSearchQuery}
            onSearchChange={setBondsSearchQuery}
            searchPlaceholder={t("page.honors.searchPlaceholder.bonds")}
            sortOptions={[{ id: "id", label: "ID" }]}
            sortBy="id"
            sortOrder={bondsSortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setBondsSortOrder(order)}
            hasActiveFilters={bondsHasActiveFilters}
            onReset={handleBondsReset}
        >
            <FilterSection label={t("common.filter.character1")}>
                <div className="grid grid-cols-5 gap-2">
                    <button
                        onClick={() => setBondsChar1(null)}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${bondsChar1 === null
                            ? "bg-miku text-white shadow-lg ring-2 ring-miku"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                        title={t("common.filter.unlimited")}
                    >
                        ALL
                    </button>
                    {bondsCharacters.map(id => {
                        const characterName = getCharacterName(t, id);
                        return (
                            <button
                                key={`bc1-${id}`}
                                onClick={() => setBondsChar1(bondsChar1 === id ? null : id)}
                                className={`relative aspect-square rounded-full overflow-hidden transition-all flex items-center justify-center ${bondsChar1 === id
                                    ? "ring-2 ring-miku shadow-lg"
                                    : "ring-1 ring-slate-200 hover:ring-miku/50"
                                    }`}
                                title={characterName}
                            >
                                <Image
                                    src={getCharacterIconUrl(id)}
                                    alt={characterName}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            <FilterSection label={t("common.filter.character2")}>
                <div className="grid grid-cols-5 gap-2">
                    <button
                        onClick={() => setBondsChar2(null)}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${bondsChar2 === null
                            ? "bg-miku text-white shadow-lg ring-2 ring-miku"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                        title={t("common.filter.unlimited")}
                    >
                        ALL
                    </button>
                    {bondsCharacters.map(id => {
                        const characterName = getCharacterName(t, id);
                        return (
                            <button
                                key={`bc2-${id}`}
                                onClick={() => setBondsChar2(bondsChar2 === id ? null : id)}
                                className={`relative aspect-square rounded-full overflow-hidden transition-all flex items-center justify-center ${bondsChar2 === id
                                    ? "ring-2 ring-miku shadow-lg"
                                    : "ring-1 ring-slate-200 hover:ring-miku/50"
                                    }`}
                                title={characterName}
                            >
                                <Image
                                    src={getCharacterIconUrl(id)}
                                    alt={characterName}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </button>
                        );
                    })}
                </div>
            </FilterSection>

            <FilterToggle
                selected={bondsGroupOnce}
                onClick={() => setBondsGroupOnce(!bondsGroupOnce)}
                label={t("common.filter.groupOnce")}
            />
        </BaseFilters>
    );

    const quickFilterTitle = t(`page.honors.filterTitle.${activeTab}`);
    const quickFilterContent = activeTab === "bonds" ? bondsQuickFilterContent : normalQuickFilterContent;

    useQuickFilter(quickFilterTitle, quickFilterContent, [
        activeTab,
        selectedTypes,
        selectedRarities,
        groupOnce,
        searchQuery,
        sortBy,
        sortOrder,
        bondsSearchQuery,
        bondsChar1,
        bondsChar2,
        bondsGroupOnce,
        bondsSortOrder,
        honors.length,
        filteredHonors.length,
        bondsHonors.length,
        filteredBondsHonors.length,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.honors.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.honors.title")} <span className="text-miku">{t("page.honors.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.honors.description")}
                </p>
            </div>

            {/* Tab Switcher */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
                    <button
                        onClick={() => setActiveTab("normal")}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "normal"
                                ? "bg-white text-miku shadow-md"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {t("page.honors.tabs.normal")}
                    </button>
                    <button
                        onClick={() => setActiveTab("bonds")}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "bonds"
                                ? "bg-white text-miku shadow-md"
                                : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        {t("page.honors.tabs.bonds")}
                    </button>
                </div>
            </div>

            {/* Error */}
            {(activeTab === "normal" ? error : bondsError) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("page.honors.loadFailed")}</p>
                    <p>{activeTab === "normal" ? error : bondsError}</p>
                </div>
            )}

            {/* ==================== Normal Tab ==================== */}
            {activeTab === "normal" && (
                /* Normal Grid. Filters live in the global FilterDrawer (registered
                   above via useQuickFilter), so the page body is a single column. */
                <div className="min-w-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                {displayedHonors.map(honor => {
                                    const group = honorGroupMap.get(honor.groupId);
                                    return (
                                        <div
                                            key={honor.id}
                                            onClick={() => handleHonorClick(honor)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    handleHonorClick(honor);
                                                }
                                            }}
                                            data-shortcut-item="true"
                                            tabIndex={0}
                                            role="button"
                                            className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-4 cursor-pointer group"
                                        >
                                            <div className="mb-3">
                                                <DegreeImage
                                                    honor={honor}
                                                    honorGroup={group}
                                                    honorLevel={honor.levels.length > 0 ? honor.levels[0].level : undefined}
                                                    source={assetSource}
                                                />
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-800 group-hover:text-miku transition-colors mb-1">
                                                {honor.name}
                                            </h3>
                                            <div className="flex flex-wrap gap-1">
                                                {group && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-miku/10 text-miku rounded font-medium">
                                                        {getHonorTypeLabel(group.honorType, t)}
                                                    </span>
                                                )}
                                                {honor.honorRarity && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                                        {getHonorRarityLabel(honor.honorRarity, t)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {displayedHonors.length < filteredHonors.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                                    >
                                        {t("page.honors.loadMore")}
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedHonors.length} / {filteredHonors.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {!isLoading && filteredHonors.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>{t("page.honors.noResult.normal")}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ==================== Bonds Tab ==================== */}
            {activeTab === "bonds" && (
                /* Bonds Grid. Filters live in the global FilterDrawer (registered
                   above via useQuickFilter), so the page body is a single column. */
                <div className="min-w-0">
                    {isBondsLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                {displayedBondsHonors.map(bh => {
                                    const word = bondsWordMap.get(bh.bondsGroupId);
                                    return (
                                        <div
                                            key={bh.id}
                                            onClick={() => handleBondsHonorClick(bh)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    handleBondsHonorClick(bh);
                                                }
                                            }}
                                            data-shortcut-item="true"
                                            tabIndex={0}
                                            role="button"
                                            className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-4 cursor-pointer group"
                                        >
                                            <div className="mb-3">
                                                <BondsDegreeImage
                                                    bondsHonor={bh}
                                                    gameCharaUnits={gameCharaUnits}
                                                    bondsHonorWordAssetbundleName={word?.assetbundleName}
                                                    viewType="normal"
                                                    honorLevel={bh.levels.length > 0 ? bh.levels[0].level : undefined}
                                                    source={assetSource}
                                                />
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-800 group-hover:text-miku transition-colors mb-1">
                                                {bh.name}
                                            </h3>
                                            <div className="flex flex-wrap gap-1">
                                                <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-500 rounded font-medium">
                                                    {t("page.honors.bondsBadge")}
                                                </span>
                                                {bh.honorRarity && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                                        {getHonorRarityLabel(bh.honorRarity, t)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {displayedBondsHonors.length < filteredBondsHonors.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={bondsLoadMore}
                                        data-shortcut-load-more="true"
                                        className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                                    >
                                        {t("page.honors.loadMore")}
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedBondsHonors.length} / {filteredBondsHonors.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {!isBondsLoading && filteredBondsHonors.length === 0 && bondsDataLoaded && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>{t("page.honors.noResult.bonds")}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Normal Honor Detail Dialog */}
            <HonorDetailDialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                honor={selectedHonor}
                honorGroup={selectedHonor ? honorGroupMap.get(selectedHonor.groupId) : undefined}
                source={assetSource}
            />

            {/* Bonds Honor Detail Dialog */}
            <BondsHonorDetailDialog
                open={isBondsDialogOpen}
                onClose={() => setIsBondsDialogOpen(false)}
                bondsHonor={selectedBondsHonor}
                bondsHonorWords={bondsHonorWords}
                gameCharaUnits={gameCharaUnits}
                source={assetSource}
            />
        </div>
    );
}

function HonorsLoadingFallback() {
    const { t } = useI18n();

    return (
        <div className="flex h-[50vh] w-full items-center justify-center text-slate-500">
            {t("page.honors.loadingFallback")}
        </div>
    );
}

export default function HonorsClient() {
    return (
        <MainLayout>
            <Suspense fallback={<HonorsLoadingFallback />}>
                <HonorsContent />
            </Suspense>
        </MainLayout>
    );
}
