"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "@/components/LocalizedLink";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { IGameChara, IUnitProfile, UNIT_FIELD_TO_ID, UNIT_ICON_FILES } from "@/types/types";
import { getCharacterSelectUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { useI18n } from "@/contexts/I18nContext";
import { formatCharacterDisplayName } from "@/lib/character-name";

// Derive unit field → icon filename from centralized maps
const UNIT_FIELD_ICONS: Record<string, string> = Object.fromEntries(
    Object.entries(UNIT_FIELD_TO_ID).map(([field, id]) => [field, UNIT_ICON_FILES[id]])
);

function CharacterListContent() {
    const { assetSource } = useTheme();
    const { t } = useI18n();
    const [characters, setCharacters] = useState<IGameChara[]>([]);
    const [unitProfiles, setUnitProfiles] = useState<IUnitProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch data
    useEffect(() => {
        // document.title is handled by metadata.
        async function fetchData() {
            try {
                setIsLoading(true);
                const [charaData, unitData] = await Promise.all([
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                ]);
                setCharacters(charaData);
                setUnitProfiles(unitData);
                setError(null);
            } catch (err) {
                console.error("Error fetching character data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Group characters by unit
    const charactersByUnit = useMemo(() => {
        if (!characters.length || !unitProfiles.length) return {};

        // Sort units by seq
        const sortedUnits = unitProfiles.sort((a, b) => a.seq - b.seq);

        const grouped: Record<string, { unit: IUnitProfile; characters: IGameChara[] }> = {};

        sortedUnits.forEach(unit => {
            const unitCharas = characters.filter(c => c.unit === unit.unit);
            if (unitCharas.length > 0) {
                grouped[unit.unit] = {
                    unit,
                    characters: unitCharas,
                };
            }
        });

        return grouped;
    }, [characters, unitProfiles]);

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="hh-spinner w-12 h-12" />
                    <span className="text-[var(--hh-text-secondary)]">{t("page.character.loadingData")}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="p-4 bg-[var(--hh-surface-2)] border border-[var(--hh-accent-alert)] rounded-[var(--hh-radius-lg)] text-sm text-[var(--hh-text-primary)]">
                    <p className="font-bold text-[var(--hh-accent-alert)]">{t("page.character.loadFailed")}</p>
                    <p className="text-[var(--hh-text-secondary)]">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="hh-press hh-focusable mt-2 rounded-[var(--hh-radius-sm)] text-[var(--hh-accent-deep)] underline hover:no-underline"
                    >
                        {t("common.action.retry")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                    <span className="hh-label text-[var(--hh-accent-deep)] text-xs">{t("page.character.badge")}</span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                    {t("page.character.title")} <span className="text-[var(--hh-accent-deep)]">{t("page.character.titleHighlight")}</span>
                </h1>
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                    {t("page.character.description")}
                </p>
            </div>

            {/* Characters grouped by unit */}
            <div className="space-y-10">
                {Object.entries(charactersByUnit).map(([unitId, { unit, characters: unitCharacters }]) => {
                    const iconName = UNIT_FIELD_ICONS[unitId] || "vs.webp";

                    return (
                        <div key={unitId} className="hh-tile overflow-hidden">
                            {/* Unit Header */}
                            <div className="px-6 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] flex items-center gap-4">
                                <div className="w-12 h-12 relative shrink-0">
                                    <Image
                                        src={`/data/icon/${iconName}`}
                                        alt={unit.unitName}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                                <div>
                                    <h2 className="hh-title font-bold text-lg text-[var(--hh-text-primary)]">
                                        <TranslatedText
                                            original={unit.unitName}
                                            category="units"
                                            field="unitName"
                                            inline
                                            translationClassName="text-sm text-[var(--hh-text-secondary)] font-normal ml-2"
                                        />
                                    </h2>
                                    <div className="text-xs text-[var(--hh-text-secondary)] line-clamp-1">
                                        <TranslatedText
                                            original={unit.profileSentence}
                                            category="units"
                                            field="profileSentence"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Characters Grid */}
                            <div className="p-4 sm:p-6">
                                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                                    {unitCharacters.map((chara) => {
                                        const characterName = formatCharacterDisplayName(chara);

                                        return (
                                            <div
                                                key={chara.id}
                                                className={`${unitId === "piapro"
                                                    ? "w-[calc(16.666%-10px)] sm:w-[calc(16.666%-14px)]"
                                                    : "w-[calc(25%-9px)] sm:w-[calc(25%-12px)]"
                                                    }`}
                                            >
                                                <Link
                                                    key={chara.id}
                                                    href={`/character/${chara.id}`}
                                                    data-shortcut-item="true"
                                                    className="hh-card-item hh-press hh-focusable group relative h-[160px] sm:h-[220px] md:h-[280px] lg:h-[320px] rounded-[var(--hh-radius-md)] overflow-hidden bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)] flex items-center justify-center p-1 sm:p-2 select-none cursor-pointer"
                                                >
                                                    <div className="relative w-full h-full">
                                                        <Image
                                                            src={getCharacterSelectUrl(chara.id, assetSource)}
                                                            alt={characterName}
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                    {/* Name overlay */}
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                                                        <p className="text-white text-xs font-bold text-center truncate">
                                                            {characterName}
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function CharacterClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">{t("page.character.loadingFallback")}</div>}>
                <CharacterListContent />
            </Suspense>
        </MainLayout>
    );
}
