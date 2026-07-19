"use client";
import React, { useState, useEffect } from "react";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
    IGameChara,
    ICharaProfile,
    IUnitProfile,
    ICharaUnitInfo,
    ICardInfo,
    UNIT_FIELD_TO_ID,
    UNIT_ICON_FILES,
    isTrainableCard
} from "@/types/types";
import {
    getCharacterTrimUrl,
    getCharacterLabelHUrl,
    getCharacterLabelVUrl,
} from "@/lib/assets";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import ColorPreview from "@/components/helpers/ColorPreview";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import { formatCharacterDisplayName } from "@/lib/character-name";

// Derive unit field → icon filename from centralized maps
const UNIT_FIELD_ICONS: Record<string, string> = Object.fromEntries(
    Object.entries(UNIT_FIELD_TO_ID).map(([field, id]) => [field, UNIT_ICON_FILES[id]])
);

export default function CharacterDetailClient() {
    const params = useParams();
    const { assetSource, useTrainedThumbnail } = useTheme();
    const { t } = useI18n();
    const { setDetailName } = useBreadcrumb();
    const id = parseInt(params.id as string, 10);

    // State
    const [character, setCharacter] = useState<IGameChara | null>(null);
    const [profile, setProfile] = useState<ICharaProfile | null>(null);
    const [unitInfo, setUnitInfo] = useState<ICharaUnitInfo | null>(null);
    const [unitProfile, setUnitProfile] = useState<IUnitProfile | null>(null);
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"trim" | "label_h" | "label_v">("trim");
    const [imageViewerOpen, setImageViewerOpen] = useState(false);

    // Fetch data
    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);

                // Fetch all required data in parallel
                const [
                    charaData,
                    profileData,
                    unitInfoData,
                    unitProfileData,
                    cardsData
                ] = await Promise.all([
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                    fetchMasterData<ICharaProfile[]>("characterProfiles.json"),
                    fetchMasterData<ICharaUnitInfo[]>("gameCharacterUnits.json"),
                    fetchMasterData<IUnitProfile[]>("unitProfiles.json"),
                    fetchMasterData<ICardInfo[]>("cards.json")
                ]);

                // Find character data
                const chara = charaData.find(c => c.id === id);
                if (!chara) throw new Error("Character not found");
                setCharacter(chara);

                // Set page title
                document.title = `Moesekai - ${formatCharacterDisplayName(chara)}`;

                // Find related data
                setProfile(profileData.find(p => p.characterId === id) || null);

                const uInfo = unitInfoData.find(u => u.gameCharacterId === id && u.unit === chara.unit);
                setUnitInfo(uInfo || null);

                setUnitProfile(unitProfileData.find(u => u.unit === chara.unit) || null);

                // Filter cards for this character
                setCards(cardsData.filter(c => c.characterId === id).sort((a, b) => b.releaseAt - a.releaseAt));

            } catch (err) {
                console.error("Error fetching character details:", err);
            } finally {
                setIsLoading(false);
            }
        }

        if (!isNaN(id)) {
            fetchData();
        }
    }, [id]);

    // Compute display name before any conditional returns (React hooks rule)
    const characterDisplayName = character
        ? formatCharacterDisplayName(character)
        : null;

    // Set breadcrumb detail name — must be called before conditional returns
    useEffect(() => {
        if (characterDisplayName) setDetailName(characterDisplayName);
    }, [characterDisplayName, setDetailName]);

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-miku border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-500">{t("page.character.loadingInfo")}</span>
                </div>
            </div>
        );
    }

    if (!character) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold text-slate-800">{t("page.character.notFoundTitle")}</h1>
                <Link href="/character" className="text-miku hover:underline mt-4 inline-block">
                    {t("page.character.backToList")}
                </Link>
            </div>
        );
    }

    // Determine unit icon
    const unitIconName = UNIT_FIELD_ICONS[character.unit] || "vs.webp";

    // Prepare images for display/viewer
    const charaTrimImg = getCharacterTrimUrl(id, assetSource);
    const charaLabelHImg = getCharacterLabelHUrl(id, assetSource);
    const charaLabelVImg = getCharacterLabelVUrl(id, assetSource);
    const activeImageUrl = activeTab === "trim" ? charaTrimImg : activeTab === "label_h" ? charaLabelHImg : charaLabelVImg;
    const activeImageLabel = t(`page.character.imageTabs.${activeTab}`);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            <ImagePreviewModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                title={t("page.character.imageDetailTitle", { name: characterDisplayName ?? "", tab: activeImageLabel })}
                imageUrl={activeImageUrl}
                alt={t("page.character.imageDetailAlt", { name: characterDisplayName ?? "", tab: activeImageLabel })}
                fileName={`character_${id}_${activeTab}.png`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Character Image */}
                <div className="lg:col-span-5 xl:col-span-4">
                    <div className="ios-glass-card rounded-2xl overflow-hidden sticky top-24">
                        <div className="flex p-1 bg-slate-100/30 dark:bg-slate-900/30 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/80 gap-1">
                            <button
                                onClick={() => setActiveTab("trim")}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === "trim" ? "ios-glass-tab-active bg-miku text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-slate-800/40"}`}
                            >
                                {t("page.character.imageTabs.trim")}
                            </button>
                            <button
                                onClick={() => setActiveTab("label_h")}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === "label_h" ? "ios-glass-tab-active bg-miku text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-slate-800/40"}`}
                            >
                                {t("page.character.imageTabs.label_h")}
                            </button>
                            <button
                                onClick={() => setActiveTab("label_v")}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === "label_v" ? "ios-glass-tab-active bg-miku text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-slate-800/40"}`}
                            >
                                {t("page.character.imageTabs.label_v")}
                            </button>
                        </div>

                        {/* Image Display */}
                        <div className="p-4 bg-slate-50 min-h-[400px] flex items-center justify-center relative cursor-zoom-in"
                            onClick={() => setImageViewerOpen(true)}>
                            {activeTab === "trim" && (
                                <div className="w-full h-auto relative aspect-[3/4]">
                                    <Image
                                        src={charaTrimImg}
                                        alt="Character Trim"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}
                            {activeTab === "label_h" && (
                                <div className="w-full h-auto relative aspect-[2/1]">
                                    <Image
                                        src={charaLabelHImg}
                                        alt="Character Label Horizontal"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}
                            {activeTab === "label_v" && (
                                <div className="w-full h-auto relative aspect-[1/3]">
                                    <Image
                                        src={charaLabelVImg}
                                        alt="Character Label Vertical"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-white text-center text-xs text-slate-400 border-t border-slate-100">
                            {t("page.character.clickExpand")}
                        </div>
                    </div>
                </div>

                {/* Right Column: Info & Profile */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                    {/* Basic Info */}
                    <div className="ios-glass-card rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="w-1 h-6 bg-miku rounded-full"></span>
                                {t("page.character.basicInfo")}
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                <InfoRow label="ID" value={character.id} />
                                <InfoRow
                                    label={t("page.character.nameLabel")}
                                    value={
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-bold">{characterDisplayName}</span>
                                            <span className="text-xs text-slate-500">{character.firstNameRuby} {character.givenNameRuby}</span>
                                        </div>
                                    }
                                />
                                <InfoRow
                                    label={t("page.character.genderLabel")}
                                    value={character.gender === "female" ? t("page.character.genders.female") : character.gender === "male" ? t("page.character.genders.male") : character.gender}
                                />
                                <InfoRow
                                    label={t("page.character.unitLabel")}
                                    value={
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 relative">
                                                <Image
                                                    src={`/data/icon/${unitIconName}`}
                                                    alt={unitProfile?.unitName || character.unit}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                            <TranslatedText
                                                original={unitProfile?.unitName || character.unit}
                                                category="units"
                                                field="unitName"
                                            />
                                        </div>
                                    }
                                />
                                {unitInfo && (
                                    <>
                                        <InfoRow
                                            label={t("page.character.colorLabel")}
                                            value={
                                                <div className="flex items-center gap-2">
                                                    <span className="uppercase font-mono text-sm">{unitInfo.colorCode}</span>
                                                    <ColorPreview colorCode={unitInfo.colorCode} size={20} />
                                                </div>
                                            }
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Profile */}
                    {profile && (
                        <div className="ios-glass-card rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-6 bg-miku rounded-full"></span>
                                    {t("page.character.profileTitle")}
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                    <InfoRow label={t("page.character.heightLabel")} value={profile.height} />
                                    <InfoRow label={t("page.character.birthdayLabel")} value={profile.birthday} />
                                    <InfoRow label={t("page.character.schoolLabel")} value={profile.school} />
                                    <InfoRow label={t("page.character.schoolYearLabel")} value={profile.schoolYear} />
                                    <InfoRow
                                        label={t("page.character.hobbyLabel")}
                                        value={
                                            <TranslatedText
                                                original={profile.hobby || "-"}
                                                category="characters"
                                                field="hobby"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label={t("page.character.specialSkillLabel")}
                                        value={
                                            <TranslatedText
                                                original={profile.specialSkill || "-"}
                                                category="characters"
                                                field="specialSkill"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label={t("page.character.favoriteFoodLabel")}
                                        value={
                                            <TranslatedText
                                                original={profile.favoriteFood || "-"}
                                                category="characters"
                                                field="favoriteFood"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label={t("page.character.hatedFoodLabel")}
                                        value={
                                            <TranslatedText
                                                original={profile.hatedFood || "-"}
                                                category="characters"
                                                field="hatedFood"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label={t("page.character.weakLabel")}
                                        value={
                                            <TranslatedText
                                                original={profile.weak || "-"}
                                                category="characters"
                                                field="weak"
                                            />
                                        }
                                    />
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-sm font-bold text-slate-500 mb-2">{t("page.character.introductionTitle")}</p>
                                    <div className="whitespace-pre-line text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl">
                                        <TranslatedText
                                            original={profile.introduction}
                                            category="characters"
                                            field="introduction"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards */}
                    <div className="ios-glass-card rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="w-1 h-6 bg-miku rounded-full"></span>
                                {t("page.character.relatedCardsTitle")}
                            </h2>
                            <span className="text-sm text-slate-500 text-sm bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                {t("page.character.relatedCardsCount", { count: cards.length })}
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {cards.map((card) => {
                                    const TRAINED_ONLY_CARDS = [1167];
                                    const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);
                                    const showTrained = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");
                                    return (
                                        <Link
                                            key={card.id}
                                            href={`/cards/${card.id}`}
                                            className="block"
                                            title={card.prefix}
                                        >
                                            <SekaiCardThumbnail card={card} trained={showTrained} className="w-full" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DetailPageAdCard />
                </div>
            </div>
        </div>
    );
}

// Helper component for info rows
function InfoRow({ label, value }: { label: string, value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-center justify-between text-sm py-1">
            <span className="font-bold text-slate-500">{label}</span>
            <span className="text-slate-800 text-right">{value}</span>
        </div>
    );
}
