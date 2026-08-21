"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import PageHeader from "@/components/common/PageHeader";
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
                        className={`hh-press hh-focusable aspect-square rounded-full flex items-center justify-center text-xs font-bold ${selectedChar1 === null
                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] ring-2 ring-[var(--hh-accent)]"
                            : "bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] text-[var(--hh-text-secondary)] border border-[var(--hh-border)]"
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
                                className={`hh-press hh-focusable relative aspect-square rounded-full overflow-hidden flex items-center justify-center ${selectedChar1 === id
                                    ? "ring-2 ring-[var(--hh-accent)]"
                                    : "ring-1 ring-[var(--hh-border)] hover:ring-[var(--hh-accent-line)]"
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
                        className={`hh-press hh-focusable aspect-square rounded-full flex items-center justify-center text-xs font-bold ${selectedChar2 === null
                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] ring-2 ring-[var(--hh-accent)]"
                            : "bg-[var(--hh-surface-2)] hover:bg-[var(--hh-surface-3)] text-[var(--hh-text-secondary)] border border-[var(--hh-border)]"
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
                                className={`hh-press hh-focusable relative aspect-square rounded-full overflow-hidden flex items-center justify-center ${selectedChar2 === id
                                    ? "ring-2 ring-[var(--hh-accent)]"
                                    : "ring-1 ring-[var(--hh-border)] hover:ring-[var(--hh-accent-line)]"
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
                        className={`hh-chip hh-press hh-focusable px-3 py-1.5 font-bold ${stampType === "" ? "hh-chip-active" : ""}`}
                    >
                        {t("page.sticker.allTypes")}
                    </button>
                    {stampTypes.map(type => (
                        <button
                            key={`type-${type}`}
                            onClick={() => setStampType(stampType === type ? "" : type)}
                            className={`hh-chip hh-press hh-focusable px-3 py-1.5 font-bold ${stampType === type ? "hh-chip-active" : ""}`}
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

            <PageHeader
                badge={t("page.sticker.badge")}
                title={t("page.sticker.title")}
                titleHighlight={t("page.sticker.titleHighlight")}
                description={t("page.sticker.description")}
            />

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/12 border border-red-500/30 rounded-[var(--hh-radius-lg)] text-red-600 text-sm">
                    <p className="font-bold">{t("page.sticker.loadFailed")}</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Grid */}
            <div className="w-full min-w-0">
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
                                    className="hh-card-item relative cursor-pointer overflow-hidden flex flex-col group select-none w-full text-left"
                                >
                                    <div className="relative aspect-square bg-[var(--hh-surface-sunken)] overflow-hidden shrink-0">
                                        <Image
                                            src={getStampUrl(stamp.assetbundleName, assetSource)}
                                            alt={stamp.name}
                                            fill
                                            className="object-contain p-1"
                                            unoptimized
                                        />
                                    </div>
                                    <div className="hh-card-footer px-1.5 py-1.5 min-h-[2rem] flex flex-col justify-center text-center">
                                        <h3 className="hh-title text-[10px] font-bold text-[var(--hh-text-primary)] leading-tight line-clamp-2" title={stamp.name}>
                                            <TranslatedText
                                                original={stamp.name}
                                                category="sticker"
                                                field="name"
                                                originalClassName="truncate block"
                                                translationClassName="hh-body text-[9px] text-[var(--hh-text-tertiary)] truncate block"
                                            />
                                        </h3>
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
                                    className="hh-btn hh-btn-primary hh-press hh-focusable px-8 py-3 font-bold"
                                >
                                    {t("page.sticker.loadMore")}
                                    <span className="hh-numeric ml-2 text-sm opacity-80">
                                        ({displayedStamps.length} / {filteredStamps.length})
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* All loaded */}
                        {displayedStamps.length > 0 && displayedStamps.length >= filteredStamps.length && (
                            <div className="mt-8 text-center text-[var(--hh-text-tertiary)] text-sm">
                                {t("page.sticker.allLoaded", { count: filteredStamps.length })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function StickerClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.sticker.loadingFallback")}</div>}>
                <StickerContent />
            </Suspense>
        </MainLayout>
    );
}
