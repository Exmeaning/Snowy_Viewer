"use client";
import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import Modal from "@/components/common/Modal";
import CharacterFilter from "@/components/common/CharacterFilter";
import BaseFilters, { FilterSection, getFilterChipStateClasses, getFilterIconStateClasses } from "@/components/common/BaseFilters";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { ICardInfo, CardRarityType, CardAttribute, isTrainableCard, getRarityNumber, IGachaDetail, ISkillInfo } from "@/types/types";
import { useCardSupplyTypeMapping, ICardSupply } from "@/hooks/useCardSupplyType";
import { useSkillMapping } from "@/hooks/useSkillMapping";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslatedText } from "@/components/common/TranslatedText";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName } from "@/lib/i18n";
import { fetchMasterData } from "@/lib/fetch";
import { getCardSkillTypes, CardSkillType } from "@/lib/skill";

const ATTRIBUTES: CardAttribute[] = ["cool", "cute", "happy", "mysterious", "pure"];
const ATTR_ICONS: Record<CardAttribute, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

const RARITIES: { type: CardRarityType; num: number }[] = [
    { type: "rarity_4", num: 4 },
    { type: "rarity_birthday", num: 5 },
    { type: "rarity_3", num: 3 },
    { type: "rarity_2", num: 2 },
    { type: "rarity_1", num: 1 },
];

export interface CardSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    cards: ICardInfo[];
    gachaDetails?: IGachaDetail[];
    pickupCardIds?: number[];
    selectedCardIds?: number[];
    maxSelectCount?: number;
    onToggleCardSelect?: (card: ICardInfo) => void;
    onSelectCard?: (card: ICardInfo) => void;
}

export default function CardSelectorModal({
    isOpen,
    onClose,
    title,
    cards,
    gachaDetails = [],
    pickupCardIds = [],
    selectedCardIds,
    maxSelectCount,
    onToggleCardSelect,
    onSelectCard,
}: CardSelectorModalProps) {
    const { t } = useI18n();
    const { useTrainedThumbnail } = useTheme();

    const supplyTypes = useCardSupplyTypeMapping();
    const skillTypes = useSkillMapping();

    // Filters state
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [selectedAttrs, setSelectedAttrs] = useState<CardAttribute[]>([]);
    const [selectedRarities, setSelectedRarities] = useState<CardRarityType[]>([]);
    const [selectedSupplyTypes, setSelectedSupplyTypes] = useState<string[]>([]);
    const [selectedSkillTypes, setSelectedSkillTypes] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    const [skillsMap, setSkillsMap] = useState<Map<number, ISkillInfo>>(new Map());
    const [suppliesMap, setSuppliesMap] = useState<Map<number, string>>(new Map());

    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        async function loadMasterData() {
            try {
                const [skillsData, suppliesData] = await Promise.all([
                    fetchMasterData<ISkillInfo[]>("skills.json").catch(() => []),
                    fetchMasterData<ICardSupply[]>("cardSupplies.json").catch(() => []),
                ]);
                if (isMounted) {
                    if (skillsData.length > 0) {
                        setSkillsMap(new Map(skillsData.map(s => [s.id, s])));
                    }
                    if (suppliesData.length > 0) {
                        setSuppliesMap(new Map(suppliesData.map(s => [s.id, s.cardSupplyType])));
                    }
                }
            } catch {
                // ignore fallback
            }
        }
        loadMasterData();
        return () => { isMounted = false; };
    }, [isOpen]);

    const pickupSet = useMemo(() => new Set(pickupCardIds), [pickupCardIds]);

    // Weight and rate calculations per rarity
    const { weightByRarity, detailByCardId } = useMemo(() => {
        const weightByRarity: Record<string, number> = {};
        const detailByCardId = new Map<number, IGachaDetail>();

        gachaDetails.forEach(detail => {
            if (!detailByCardId.has(detail.cardId)) {
                detailByCardId.set(detail.cardId, detail);
            }
        });

        gachaDetails.forEach(detail => {
            const card = cards.find(c => c.id === detail.cardId);
            if (!card) return;
            const rarity = card.cardRarityType;
            weightByRarity[rarity] = (weightByRarity[rarity] || 0) + (detail.weight || 1);
        });

        return { weightByRarity, detailByCardId };
    }, [gachaDetails, cards]);

    // Processed pool with actual overall draw rate (rarity overall rate * weight share)
    const processedPool = useMemo(() => {
        const rarityBaseRate: Record<string, number> = {
            rarity_4: 3.0,
            rarity_birthday: 3.0,
            rarity_3: 8.5,
            rarity_2: 88.5,
            rarity_1: 0.0,
        };

        return cards.map(card => {
            const detail = detailByCardId.get(card.id);
            const rarity = card.cardRarityType;
            const totalWeight = weightByRarity[rarity] || (detail?.weight || 1);
            const weight = detail?.weight || 1;
            const rarityRate = rarityBaseRate[rarity] ?? 3.0;
            // Actual overall draw rate = Rarity rate * (card weight / total rarity weight)
            const actualRate = totalWeight > 0 ? (rarityRate * weight) / totalWeight : 0;
            const isPickup = pickupSet.has(card.id);

            return {
                card,
                detail,
                rarity,
                isPickup,
                actualRate,
            };
        });
    }, [cards, detailByCardId, weightByRarity, pickupSet]);

    // Filtered pool
    const filteredPool = useMemo(() => {
        return processedPool.filter(item => {
            const { card } = item;

            // Character filter
            if (selectedCharacters.length > 0 && !selectedCharacters.includes(card.characterId)) {
                return false;
            }

            // Attribute filter
            if (selectedAttrs.length > 0 && !selectedAttrs.includes(card.attr)) {
                return false;
            }

            // Rarity filter
            if (selectedRarities.length > 0 && !selectedRarities.includes(card.cardRarityType)) {
                return false;
            }

            // Supply type filter
            if (selectedSupplyTypes.length > 0) {
                const supplyType = card.cardSupplyType || suppliesMap.get(card.cardSupplyId) || (card.cardRarityType === "rarity_birthday" ? "birthday" : "normal");
                if (!selectedSupplyTypes.includes(supplyType)) {
                    return false;
                }
            }

            // Skill type filter
            if (selectedSkillTypes.length > 0) {
                const skill = skillsMap.get(card.skillId);
                const cardSkillTypes = getCardSkillTypes(skill);
                const hasMatch = selectedSkillTypes.some(st => cardSkillTypes.includes(st as CardSkillType));
                if (!hasMatch) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchId = card.id.toString().includes(q);
                const matchPrefix = card.prefix?.toLowerCase().includes(q);
                const matchPhrase = card.gachaPhrase?.toLowerCase().includes(q);
                if (!matchId && !matchPrefix && !matchPhrase) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            const isSelA = selectedCardIds ? selectedCardIds.includes(a.card.id) : false;
            const isSelB = selectedCardIds ? selectedCardIds.includes(b.card.id) : false;
            if (isSelA !== isSelB) return isSelA ? -1 : 1;

            const numA = getRarityNumber(a.card.cardRarityType);
            const numB = getRarityNumber(b.card.cardRarityType);
            if (numA !== numB) return numB - numA;
            if (a.isPickup !== b.isPickup) return a.isPickup ? -1 : 1;
            return b.card.id - a.card.id;
        });
    }, [processedPool, selectedCharacters, selectedAttrs, selectedRarities, selectedSupplyTypes, selectedSkillTypes, searchQuery, skillsMap, suppliesMap, selectedCardIds]);

    const toggleAttr = (attr: CardAttribute) => {
        setSelectedAttrs(prev =>
            prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
        );
    };

    const toggleRarity = (rarity: CardRarityType) => {
        setSelectedRarities(prev =>
            prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]
        );
    };

    const toggleSupplyType = (type: string) => {
        setSelectedSupplyTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleSkillType = (type: string) => {
        setSelectedSkillTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleReset = () => {
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
        setSelectedAttrs([]);
        setSelectedRarities([]);
        setSelectedSupplyTypes([]);
        setSelectedSkillTypes([]);
        setSearchQuery("");
    };

    const modalTitle = title || `${t("page.gacha.cardPoolTitle", { count: cards.length })}`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="xl">
            <div className="space-y-4">
                {/* Filters */}
                <BaseFilters
                    filteredCount={filteredPool.length}
                    totalCount={cards.length}
                    countUnit={t("page.cards.countUnit")}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder={t("page.cards.searchPlaceholder")}
                    onReset={handleReset}
                    hasActiveFilters={
                        selectedCharacters.length > 0 ||
                        selectedUnitIds.length > 0 ||
                        selectedAttrs.length > 0 ||
                        selectedRarities.length > 0 ||
                        selectedSupplyTypes.length > 0 ||
                        selectedSkillTypes.length > 0 ||
                        !!searchQuery
                    }
                >
                    {/* Character & Unit Filter */}
                    <CharacterFilter
                        selectedCharacters={selectedCharacters}
                        onCharacterChange={setSelectedCharacters}
                        selectedUnitIds={selectedUnitIds}
                        onUnitIdsChange={setSelectedUnitIds}
                    />

                    {/* Attribute & Rarity Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Attribute Filter */}
                        <FilterSection label={t("common.filter.attribute")}>
                            <div className="flex flex-wrap gap-2">
                                {ATTRIBUTES.map(attr => {
                                    const isSelected = selectedAttrs.includes(attr);
                                    return (
                                        <button
                                            key={attr}
                                            type="button"
                                            onClick={() => toggleAttr(attr)}
                                            aria-pressed={isSelected}
                                            // The local overrides here duplicated what
                                            // getFilterIconStateClasses already returns, and did so in
                                            // the pre-Handheld vocabulary. Falling through to the
                                            // shared default keeps every icon chip in the app on one
                                            // treatment.
                                            className={`hh-press hh-focusable h-9 w-9 rounded-[var(--hh-radius-md)] flex items-center justify-center cursor-pointer ${getFilterIconStateClasses(isSelected)}`}
                                        >
                                            <div className="w-5 h-5 relative">
                                                <Image
                                                    src={ATTR_ICONS[attr]}
                                                    alt={attr}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </FilterSection>

                        {/* Rarity Filter with Star Icons */}
                        <FilterSection label={t("common.filter.rarity")}>
                            <div className="flex flex-wrap gap-2">
                                {RARITIES.map(({ type, num }) => {
                                    const isSelected = selectedRarities.includes(type);
                                    return (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => toggleRarity(type)}
                                            aria-pressed={isSelected}
                                            className={`hh-press hh-focusable h-9 px-2.5 rounded-[var(--hh-radius-md)] flex items-center justify-center gap-0.5 cursor-pointer ${getFilterIconStateClasses(isSelected)}`}
                                            title={type}
                                        >
                                            {type === "rarity_birthday" ? (
                                                <div className="w-4 h-4 relative">
                                                    <Image
                                                        src="/data/icon/birthday.webp"
                                                        alt="Birthday"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            ) : (
                                                Array.from({ length: num }).map((_, i) => (
                                                    <div key={i} className="w-3 h-3 relative">
                                                        <Image
                                                            src="/data/icon/star.webp"
                                                            alt="Star"
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                ))
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </FilterSection>
                    </div>

                    {/* Supply Type Filter */}
                    <FilterSection label={t("common.filter.cardType")}>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {supplyTypes.map((st) => {
                                const isSelected = selectedSupplyTypes.includes(st.type);
                                return (
                                    <button
                                        key={st.type}
                                        type="button"
                                        onClick={() => toggleSupplyType(st.type)}
                                        aria-pressed={isSelected}
                                        className={`hh-press hh-focusable px-3 py-1.5 cursor-pointer ${getFilterChipStateClasses(isSelected)}`}
                                    >
                                        {t(`common.cardSupplyTypes.${st.type}`)}
                                    </button>
                                );
                            })}
                        </div>
                    </FilterSection>

                    {/* Skill Type Filter */}
                    <FilterSection label={t("common.filter.skillType")}>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {skillTypes.map((sk) => {
                                const isSelected = selectedSkillTypes.includes(sk.descriptionSpriteName);
                                return (
                                    <button
                                        key={sk.descriptionSpriteName}
                                        type="button"
                                        onClick={() => toggleSkillType(sk.descriptionSpriteName)}
                                        aria-pressed={isSelected}
                                        className={`hh-press hh-focusable px-3 py-1.5 cursor-pointer ${getFilterChipStateClasses(isSelected)}`}
                                    >
                                        {t(`common.skillTypes.${sk.descriptionSpriteName}`)}
                                    </button>
                                );
                            })}
                        </div>
                    </FilterSection>
                </BaseFilters>

                {/* Selection Status & Clear Bar */}
                {selectedCardIds && onToggleCardSelect && (
                    <div className="hh-well flex items-center justify-between rounded-[var(--hh-radius-md)] px-3.5 py-2 text-xs">
                        <span className="font-bold text-[var(--hh-text-primary)]">
                            {t("page.gacha.wishSelectTitle")}: <span className="hh-numeric text-miku font-bold">{selectedCardIds.length}</span> <span className="hh-numeric">/ {maxSelectCount || '∞'}</span>
                        </span>
                        {selectedCardIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    const selectedCards = cards.filter(c => selectedCardIds.includes(c.id));
                                    selectedCards.forEach(c => onToggleCardSelect(c));
                                }}
                                className="hh-press hh-focusable text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-0.5 rounded-[var(--hh-radius-xs)] bg-red-500/12 hover:bg-red-500/20"
                            >
                                {t("page.gacha.wishSelectClear", { count: selectedCardIds.length })}
                            </button>
                        )}
                    </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredPool.map(item => {
                        const TRAINED_ONLY_CARDS = [1167];
                        const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(item.card.id);
                        const showTrained =
                            isTrainedOnlyCard ||
                            (useTrainedThumbnail &&
                                isTrainableCard(item.card) &&
                                item.card.cardRarityType !== "rarity_birthday");
                        const characterName = getCharacterName(t, item.card.characterId);
                        const isSelected = selectedCardIds ? selectedCardIds.includes(item.card.id) : false;
                        const canSelectMore = maxSelectCount && selectedCardIds ? selectedCardIds.length < maxSelectCount : true;
                        const isDisabled = !!onToggleCardSelect && !isSelected && !canSelectMore;

                        return (
                            <SelectorCardItem
                                key={item.card.id}
                                item={item}
                                showTrained={showTrained}
                                characterName={characterName}
                                isSelected={isSelected}
                                isDisabled={isDisabled}
                                onToggleCardSelect={onToggleCardSelect}
                                onSelectCard={onSelectCard}
                                onClose={onClose}
                            />
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
}

interface SelectorCardItemProps {
    item: {
        card: ICardInfo;
        detail?: IGachaDetail;
        rarity: string;
        isPickup: boolean;
        actualRate: number;
    };
    showTrained: boolean;
    characterName: string;
    isSelected: boolean;
    isDisabled: boolean;
    onToggleCardSelect?: (card: ICardInfo) => void;
    onSelectCard?: (card: ICardInfo) => void;
    onClose: () => void;
}

function SelectorCardItem({
    item,
    showTrained,
    characterName,
    isSelected,
    isDisabled,
    onToggleCardSelect,
    onSelectCard,
    onClose,
}: SelectorCardItemProps) {
    const { t } = useI18n();
    const translatedPrefix = useTranslatedText(item.card.prefix, "cards", "prefix");

    const innerContent = (
        <>
            {/* Card Image Container */}
            <div className="w-full relative shrink-0">
                <SekaiCardThumbnail card={item.card} trained={showTrained} className="w-full" />
                {isSelected ? (
                    <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none px-1.5 py-0.5 bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] text-[8px] font-bold rounded-[var(--hh-radius-xs)] shadow-sm">
                        ✓ {t("page.gacha.selected")}
                    </div>
                ) : item.isPickup ? (
                    <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none px-1.5 py-0.5 bg-pink-500 text-white text-[8px] font-bold rounded-[var(--hh-radius-xs)] shadow-sm">
                        {t("page.gacha.upLabel")}
                    </div>
                ) : null}
            </div>

            {/* Card Info - Persistent Footer matching /cards */}
            <div className="hh-card-footer px-2 py-1.5 flex flex-col justify-between flex-1 min-h-[50px]">
                <div className="h-[27px] flex flex-col justify-start mb-0.5 overflow-hidden">
                    <span className="hh-card-title text-[var(--hh-text-primary)] text-[10px] font-bold truncate leading-tight block">
                        {item.card.prefix}
                    </span>
                    {translatedPrefix ? (
                        <span className="hh-body text-[var(--hh-text-tertiary)] text-[9px] truncate leading-tight block">
                            {translatedPrefix}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 mt-auto">
                    <p className="hh-body text-[var(--hh-text-secondary)] text-[9px] truncate leading-tight flex-1">
                        {characterName}
                    </p>
                    {item.actualRate > 0 && (
                        <span className="hh-numeric shrink-0 text-[8px] font-bold text-[var(--hh-text-secondary)] bg-[var(--hh-surface-sunken)] px-1 py-0.5 rounded-[var(--hh-radius-xs)] leading-none">
                            {item.actualRate >= 0.1 ? `${item.actualRate.toFixed(1)}%` : `${item.actualRate.toFixed(2)}%`}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const baseClassName = `hh-card-item block w-full h-full flex flex-col text-left select-none cursor-pointer overflow-hidden group ${
        isSelected
            ? "border-[var(--hh-accent)] ring-1 ring-[var(--hh-accent)]"
            : item.isPickup
            ? "border-pink-400"
            : ""
    } ${isDisabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`;

    if (onToggleCardSelect) {
        return (
            <button
                type="button"
                disabled={isDisabled}
                aria-pressed={isSelected}
                onClick={() => {
                    if (isDisabled) return;
                    onToggleCardSelect(item.card);
                }}
                className={baseClassName}
            >
                {innerContent}
            </button>
        );
    }

    if (onSelectCard) {
        return (
            <button
                type="button"
                onClick={() => {
                    onSelectCard(item.card);
                    onClose();
                }}
                className={baseClassName}
            >
                {innerContent}
            </button>
        );
    }

    return (
        <Link href={`/cards/${item.card.id}`} className={baseClassName}>
            {innerContent}
        </Link>
    );
}
