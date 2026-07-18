"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";
import { getStampUrl, getCharacterIconUrl } from "@/lib/assets";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

interface IStampInfo {
    id: number;
    stampType: string;
    seq: number;
    name: string;
    assetbundleName: string;
    characterId1: number;
    characterId2?: number | null;
    archivePublishedAt?: number;
    description?: string;
}

function StickerContent() {
    const { isShowSpoiler, assetSource } = useTheme();
    const { t } = useI18n();

    const [stamps, setStamps] = useState<IStampInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [selectedChar1, setSelectedChar1] = useState<number | null>(null);
    const [selectedChar2, setSelectedChar2] = useState<number | null>(null);
    const [stampType, setStampType] = useState<string>("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [selectedStamp, setSelectedStamp] = useState<IStampInfo | null>(null);

    // Pagination with scroll restore
    const { displayCount, loadMore } = useScrollRestore({
        storageKey: "sticker",
        defaultDisplayCount: 48,
        increment: 48,
        isReady: !isLoading,
    });

    // Fetch stamps data
    useEffect(() => {
        async function fetchStamps() {
            try {
                setIsLoading(true);
                const data = await fetchMasterData<IStampInfo[]>("stamps.json");
                setStamps(data);
                setError(null);
            } catch (err) {
                console.error("Error fetching stamps:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchStamps();
    }, []);

    // Filter and sort stamps
    const filteredStamps = useMemo(() => {
        let result = [...stamps];

        // Character filter
        if (selectedChar1 !== null || selectedChar2 !== null) {
            result = result.filter(s => {
                // If both selected, must match both (in either order for stamps with 2 chars)
                if (selectedChar1 !== null && selectedChar2 !== null) {
                    const has1 = s.characterId1 === selectedChar1 || s.characterId2 === selectedChar1;
                    const has2 = s.characterId1 === selectedChar2 || s.characterId2 === selectedChar2;
                    return has1 && has2;
                }

                // If only char1 selected
                if (selectedChar1 !== null) {
                    return s.characterId1 === selectedChar1 || s.characterId2 === selectedChar1;
                }

                // If only char2 selected
                if (selectedChar2 !== null) {
                    return s.characterId1 === selectedChar2 || s.characterId2 === selectedChar2;
                }

                return true;
            });
        }

        // Stamp type filter
        if (stampType) {
            if (stampType === "text") {
                result = result.filter(s => s.stampType === "text" || s.stampType === "cheerful_carnival_message");
            } else {
                result = result.filter(s => s.stampType === stampType);
            }
        }

        // Spoiler filter
        if (!isShowSpoiler) {
            const now = Date.now();
            result = result.filter(s => !s.archivePublishedAt || s.archivePublishedAt <= now);
        }

        // Sort
        result.sort((a, b) => sortOrder === "asc" ? a.id - b.id : b.id - a.id);

        return result;
    }, [stamps, selectedChar1, selectedChar2, stampType, sortOrder, isShowSpoiler]);

    // Displayed stamps
    const displayedStamps = useMemo(() => {
        return filteredStamps.slice(0, displayCount);
    }, [filteredStamps, displayCount]);



    // Unique characters from stamps
    const characters = useMemo(() => {
        const charIds = new Set<number>();
        stamps.forEach(s => {
            charIds.add(s.characterId1);
            if (s.characterId2) charIds.add(s.characterId2);
        });
        return Array.from(charIds).sort((a, b) => a - b);
    }, [stamps]);

    // Stamp types
    const stampTypes = useMemo(() => {
        const types = new Set<string>();
        stamps.forEach(s => types.add(s.stampType));
        return Array.from(types);
    }, [stamps]);

    const quickFilterContent = (
        <BaseFilters
            filteredCount={filteredStamps.length}
            totalCount={stamps.length}
            countUnit={t("page.sticker.countUnit")}
            showSearch={false}
            sortOptions={[{ id: "id", label: "ID" }]}
            sortBy="id"
            sortOrder={sortOrder}
            onSortChange={(_: string, order: "asc" | "desc") => setSortOrder(order)}
        >
            <FilterSection label={t("page.sticker.sectionLabel.character1")}>
                <div className="grid grid-cols-5 gap-2">
                    <button
                        key="all1"
                        onClick={() => setSelectedChar1(null)}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${selectedChar1 === null
                            ? "bg-miku text-white shadow-lg ring-2 ring-miku"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                        title={t("page.sticker.anyCharacter")}
                    >
                        ALL
                    </button>
                    {characters.map(id => {
                        const characterName = getCharacterName(t, id);
                        return (
                            <button
                                key={`char1-${id}`}
                                onClick={() => setSelectedChar1(selectedChar1 === id ? null : id)}
                                className={`relative aspect-square rounded-full overflow-hidden transition-all flex items-center justify-center ${selectedChar1 === id
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

            <FilterSection label={t("page.sticker.sectionLabel.character2")}>
                <div className="grid grid-cols-5 gap-2">
                    <button
                        key="all2"
                        onClick={() => setSelectedChar2(null)}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${selectedChar2 === null
                            ? "bg-miku text-white shadow-lg ring-2 ring-miku"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                        title={t("page.sticker.anyCharacter")}
                    >
                        ALL
                    </button>
                    {characters.map(id => {
                        const characterName = getCharacterName(t, id);
                        return (
                            <button
                                key={`char2-${id}`}
                                onClick={() => setSelectedChar2(selectedChar2 === id ? null : id)}
                                className={`relative aspect-square rounded-full overflow-hidden transition-all flex items-center justify-center ${selectedChar2 === id
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

            <FilterSection label={t("page.sticker.sectionLabel.stampType")}>
                <div className="flex flex-wrap gap-2">
                    <button
                        key="type-all"
                        onClick={() => setStampType("")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${stampType === ""
                            ? "bg-miku text-white shadow-md"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                            }`}
                    >
                        {t("page.sticker.allTypes")}
                    </button>
                    {stampTypes.map(type => (
                        <button
                            key={`type-${type}`}
                            onClick={() => setStampType(stampType === type ? "" : type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${stampType === type
                                ? "bg-miku text-white shadow-md"
                                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                        >
                            {type === "text" ? t("page.sticker.stampTypes.text") : type === "illustration" ? t("page.sticker.stampTypes.illustration") : type}
                        </button>
                    ))}
                </div>
            </FilterSection>
        </BaseFilters>
    );

    useQuickFilter(t("page.sticker.filterTitle"), quickFilterContent, [
        selectedChar1,
        selectedChar2,
        stampType,
        sortOrder,
        filteredStamps.length,
        stamps.length,
        characters,
        stampTypes,
        t,
    ]);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <ImagePreviewModal
                isOpen={!!selectedStamp}
                onClose={() => setSelectedStamp(null)}
                title={selectedStamp ? t("page.sticker.previewTitle", { name: selectedStamp.name }) : t("page.sticker.previewTitleFallback")}
                imageUrl={selectedStamp ? getStampUrl(selectedStamp.assetbundleName, assetSource) : ""}
                alt={selectedStamp?.name || t("page.sticker.previewAltFallback")}
                fileName={selectedStamp ? `sticker_${selectedStamp.id}.png` : "sticker.png"}
            />

            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.sticker.badge")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    {t("page.sticker.title")} <span className="text-miku">{t("page.sticker.titleHighlight")}</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    {t("page.sticker.description")}
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">{t("page.sticker.loadFailed")}</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Two Column Layout - Same as Gacha Page */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel on Large Screens */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {quickFilterContent}
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 min-w-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[40vh]">
                            <div className="loading-spinner loading-spinner-sm" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3">
                                {displayedStamps.map(stamp => (
                                    <button
                                        type="button"
                                        key={stamp.id}
                                        onClick={() => setSelectedStamp(stamp)}
                                        data-shortcut-item="true"
                                        className="group block w-full text-left"
                                    >
                                        <div className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-2">
                                            <div className="relative aspect-square">
                                                <Image
                                                    src={getStampUrl(stamp.assetbundleName, assetSource)}
                                                    alt={stamp.name}
                                                    fill
                                                    className="object-contain group-hover:scale-105 transition-transform"
                                                    unoptimized
                                                />
                                            </div>
                                            <div className="mt-1 text-[10px] text-slate-500 text-center">
                                                <TranslatedText
                                                    original={stamp.name}
                                                    category="sticker"
                                                    field="name"
                                                    originalClassName="truncate block"
                                                    translationClassName="text-[9px] text-slate-400 truncate block"
                                                />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Load More */}
                            {displayedStamps.length < filteredStamps.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        data-shortcut-load-more="true"
                                        className="pressable px-8 py-3 ios-glass-btn ios-glass-btn-primary rounded-full font-bold"
                                    >
                                        {t("page.sticker.loadMore")}
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedStamps.length} / {filteredStamps.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* All loaded */}
                            {displayedStamps.length > 0 && displayedStamps.length >= filteredStamps.length && (
                                <div className="mt-8 text-center text-slate-400 text-sm">
                                    {t("page.sticker.allLoaded", { count: filteredStamps.length })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StickerClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">{t("page.sticker.loadingFallback")}</div>}>
                <StickerContent />
            </Suspense>
        </MainLayout>
    );
}
