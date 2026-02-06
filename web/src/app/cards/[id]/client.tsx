"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import {
    ICardInfo,
    CHARACTER_NAMES,
    ATTR_COLORS,
    ATTR_NAMES,
    UNIT_DATA,
    isTrainableCard,
    getRarityNumber,
    CardAttribute,
    SUPPORT_UNIT_NAMES,
} from "@/types/types";
import { getCardFullUrl, getCardThumbnailUrl, getEventBannerUrl, getGachaBannerUrl, getGachaLogoUrl, getCardGachaVoiceUrl, getCostumeThumbnailUrl } from "@/lib/assets";
import { useRef } from "react";
import { formatSkillDescription } from "@/lib/skill";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData, fetchWithCompression } from "@/lib/fetch";
import { TranslatedText, useTranslatedText } from "@/components/common/TranslatedText";

// Max levels by rarity
const MAX_LEVELS: Record<string, { normal: number; trained?: number }> = {
    rarity_1: { normal: 20 },
    rarity_2: { normal: 30 },
    rarity_3: { normal: 50, trained: 60 },
    rarity_4: { normal: 50, trained: 60 },
    rarity_birthday: { normal: 50, trained: 60 },
};

const SUPPLY_TYPE_NAMES: Record<string, string> = {
    "normal": "常驻",
    "birthday": "生日",
    "term_limited": "期间限定",
    "colorful_festival_limited": "CFES限定",
    "bloom_festival_limited": "BFES限定",
    "unit_event_limited": "WorldLink限定",
    "collaboration_limited": "联动限定",
};

interface Costume3d {
    id: number;
    costume3dGroupId: number;
    name: string;
    assetbundleName: string;
    costume3dRarity: string;
    costume3dType: string;
    partType: string; // "head", "body", "hair"
    characterId: number;
    colorId: number;
    colorName: string; // e.g. "Original", "Another 1"
}

export default function CardDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const cardId = Number(params.id);
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';
    const { assetSource } = useTheme();

    const [card, setCard] = useState<ICardInfo | null>(null);
    const [skillDescription, setSkillDescription] = useState<string | null>(null);
    const [supplyName, setSupplyName] = useState<string>(""); // Added state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // View states
    const [showTrained, setShowTrained] = useState(false);
    const [cardLevel, setCardLevel] = useState(1);
    const [skillLevel, setSkillLevel] = useState(1);
    const [skillData, setSkillData] = useState<any>(null);
    const [trainedSkillData, setTrainedSkillData] = useState<any>(null);
    const [trainedSkillDescription, setTrainedSkillDescription] = useState<string | null>(null);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [relatedEvent, setRelatedEvent] = useState<{ id: number; name: string; assetbundleName: string } | null>(null);
    const [relatedGachas, setRelatedGachas] = useState<{ id: number; name: string; assetbundleName: string }[]>([]);
    const [relatedCostumes, setRelatedCostumes] = useState<Costume3d[]>([]);


    // Set mounted state
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch card data
    useEffect(() => {
        async function fetchCard() {
            try {
                setIsLoading(true);
                const [cardsData, skillsData, suppliesData] = await Promise.all([
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    fetchMasterData<any[]>("skills.json"),
                    fetchMasterData<any[]>("cardSupplies.json").catch(() => [])
                ]);

                const foundCard = cardsData.find(c => c.id === cardId);

                if (!foundCard) {
                    throw new Error(`Card ${cardId} not found`);
                }

                // Handle Supply Type
                const supply = suppliesData.find((s: any) => s.id === foundCard.cardSupplyId);
                if (supply && supply.cardSupplyType) {
                    setSupplyName(SUPPLY_TYPE_NAMES[supply.cardSupplyType] || supply.cardSupplyType);
                } else {
                    setSupplyName("常驻"); // Default
                }

                // ... (rest of logic)
                // Normal skill
                const skill = skillsData.find((s: any) => s.id === foundCard.skillId);
                if (skill) {
                    setSkillData(skill);
                    // Default to max level available in skill effects details
                    const maxLvl = skill.skillEffects[0]?.skillEffectDetails.length || 1;
                    setSkillLevel(maxLvl);
                }
                // Trained skill (after blooming)
                if (foundCard.specialTrainingSkillId) {
                    const trainedSkill = skillsData.find((s: any) => s.id === foundCard.specialTrainingSkillId);
                    if (trainedSkill) {
                        setTrainedSkillData(trainedSkill);
                    }
                }


                // The API returns an array of objects but the UI expects an object of arrays
                if (Array.isArray(foundCard.cardParameters)) {
                    const rawParams = foundCard.cardParameters as any[];
                    // Group by type and sort by ID (assuming ID order corresponds to level)
                    const transformParams = (type: string) => {
                        return rawParams
                            .filter(p => p.cardParameterType === type)
                            .sort((a, b) => a.id - b.id)
                            .map(p => p.power);
                    };

                    (foundCard as any).cardParameters = {
                        param1: transformParams("param1"),
                        param2: transformParams("param2"),
                        param3: transformParams("param3"),
                    };
                }
                setCard(foundCard);
                document.title = `Snowy SekaiViewer - ${foundCard.prefix}`;

                // Set initial level to max
                const maxLevelInfo = MAX_LEVELS[foundCard.cardRarityType];
                const initialLevel = maxLevelInfo.trained || maxLevelInfo.normal;
                setCardLevel(initialLevel);
                setError(null);
            } catch (err) {
                console.error("Error fetching card:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        if (cardId) {
            fetchCard();
        }
    }, [cardId]);

    // Computed values
    const trainable = card ? isTrainableCard(card) : false;
    const isBirthday = card?.cardRarityType === "rarity_birthday";
    const rarityNum = card ? getRarityNumber(card.cardRarityType) : 1;
    const characterName = card ? CHARACTER_NAMES[card.characterId] || `Character ${card.characterId}` : "";

    // Cards that only have trained images (no normal version)
    const TRAINED_ONLY_CARDS = [1167];
    const isTrainedOnlyCard = card ? TRAINED_ONLY_CARDS.includes(card.id) : false;

    // Find unit for character
    const characterUnit = useMemo(() => {
        if (!card) return null;
        return UNIT_DATA.find(u => u.charIds.includes(card.characterId));
    }, [card]);

    // Current main image URL - always use trained for trained-only cards
    const effectiveShowTrained = isTrainedOnlyCard || (showTrained && trainable && !isBirthday);
    const mainImageUrl = card ? getCardFullUrl(card.characterId, card.assetbundleName, effectiveShowTrained, assetSource) : "";

    // Get max level info
    const maxLevelInfo = card ? MAX_LEVELS[card.cardRarityType] : { normal: 50 };
    const maxLevel = maxLevelInfo.trained || maxLevelInfo.normal;
    const normalMaxLevel = maxLevelInfo.normal;

    // Calculate stats at current level
    const stats = useMemo(() => {
        if (!card) return { param1: 0, param2: 0, param3: 0, total: 0 };

        const levelIndex = cardLevel - 1;
        const isTrained = cardLevel > normalMaxLevel;

        // Get base stats
        let param1 = card.cardParameters.param1[levelIndex] || 0;
        let param2 = card.cardParameters.param2[levelIndex] || 0;
        let param3 = card.cardParameters.param3[levelIndex] || 0;

        // Add training bonus if trained
        if (isTrained) {
            param1 += card.specialTrainingPower1BonusFixed;
            param2 += card.specialTrainingPower2BonusFixed;
            param3 += card.specialTrainingPower3BonusFixed;
        }

        return {
            param1,
            param2,
            param3,
            total: param1 + param2 + param3,
        };
    }, [card, cardLevel, normalMaxLevel]);

    // Attribute icon mapping
    const getAttrIcon = (attr: CardAttribute) => {
        const iconMap: Record<CardAttribute, string> = {
            cool: "Cool.webp",
            cute: "cute.webp",
            happy: "Happy.webp",
            mysterious: "Mysterious.webp",
            pure: "Pure.webp",
        };
        return `/data/icon/${iconMap[attr]}`;
    };

    // Dynamic skill description (normal skill)
    useEffect(() => {
        if (skillData && card) {
            setSkillDescription(formatSkillDescription(skillData, skillLevel, card));
        }
    }, [skillData, skillLevel, card]);

    // Dynamic skill description (trained skill after blooming)
    useEffect(() => {
        if (trainedSkillData && card) {
            setTrainedSkillDescription(formatSkillDescription(trainedSkillData, skillLevel, card));
        }
    }, [trainedSkillData, skillLevel, card]);

    // Fetch related event and gachas
    useEffect(() => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://sekaiviewerapi.exmeaning.com";

        async function fetchEventMap() {
            try {
                const res = await fetch(`${API_BASE}/api/card-event-map`);
                if (!res.ok) return;
                const map = await res.json();
                if (map[cardId]) {
                    setRelatedEvent(map[cardId]);
                }
            } catch (e) {
                console.log("Could not fetch event map");
            }
        }

        async function fetchGachaMap() {
            try {
                const res = await fetch(`${API_BASE}/api/card-gacha-map`);
                if (!res.ok) return;
                const map = await res.json();
                if (map[cardId] && Array.isArray(map[cardId])) {
                    const gachas = map[cardId];
                    if (gachas.length > 0) {
                        // Find the one with smallest ID
                        const smallest = gachas.reduce((prev: any, curr: any) => prev.id < curr.id ? prev : curr);
                        setRelatedGachas([smallest]);
                    }
                }
            } catch (e) {
                console.log("Could not fetch gacha map");
            }
        }

        async function fetchCostumes() {
            try {
                const res = await fetch(`${API_BASE}/api/cards/${cardId}/costumes`);
                if (!res.ok) return;
                const data = await res.json();
                setRelatedCostumes(data);
            } catch (e) {
                console.log("Could not fetch costumes");
            }
        }

        if (cardId) {
            fetchEventMap();
            fetchGachaMap();
            fetchCostumes();
        }
    }, [cardId]);

    if (isLoading) {

        return (
            <MainLayout activeNav="卡牌">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !card) {
        return (
            <MainLayout activeNav="卡牌">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">卡牌 {cardId} 正在由SnowyViewer抓紧构建</h2>
                        <p className="text-slate-500 mb-6">少安毋躁~预计12H内更新</p>
                        <Link
                            href="/cards"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回卡牌列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout activeNav="卡牌">
            {/* Full Image Viewer Modal */}
            {imageViewerOpen && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setImageViewerOpen(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                        onClick={() => setImageViewerOpen(false)}
                    >
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={getCardFullUrl(card.characterId, card.assetbundleName, effectiveShowTrained, assetSource)}
                        alt={card.prefix}
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/cards" className="text-slate-500 hover:text-miku transition-colors">
                                卡牌
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            <TranslatedText
                                original={card.prefix}
                                category="cards"
                                field="prefix"
                                originalClassName="truncate block"
                                translationClassName="text-xs text-slate-400 truncate block font-normal"
                            />
                        </li>
                    </ol>
                </nav>

                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {card.id}
                        </span>
                        <div className="flex items-center gap-2">
                            {/* Attribute Badge */}
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: ATTR_COLORS[card.attr] + "20" }}
                            >
                                <Image
                                    src={getAttrIcon(card.attr)}
                                    alt={card.attr}
                                    width={18}
                                    height={18}
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                            {/* Rarity Stars */}
                            <div className="flex items-center gap-0.5">
                                {isBirthday ? (
                                    <Image
                                        src="/data/icon/birthday.webp"
                                        alt="Birthday"
                                        width={20}
                                        height={20}
                                        unoptimized
                                    />
                                ) : (
                                    Array.from({ length: rarityNum }).map((_, i) => (
                                        <Image
                                            key={i}
                                            src={showTrained && cardLevel > normalMaxLevel ? "/data/icon/star_trained.webp" : "/data/icon/star.webp"}
                                            alt="Star"
                                            width={18}
                                            height={18}
                                            unoptimized
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">
                        <TranslatedText
                            original={card.prefix}
                            category="cards"
                            field="prefix"
                            originalClassName=""
                            translationClassName="block text-base font-medium text-slate-400 mt-1"
                        />
                    </h1>
                    <div className="flex items-center gap-3">
                        <span className="text-lg text-slate-600">{characterName}</span>
                        {characterUnit && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: characterUnit.color }}
                            >
                                {characterUnit.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Card Image */}
                    <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto custom-scrollbar">
                        {isScreenshotMode ? (
                            /* Screenshot Mode: Show all images in flat layout */
                            <div className="space-y-4">
                                {/* Normal Image */}
                                {!isTrainedOnlyCard && (
                                    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                            <span className="text-sm font-bold text-slate-600">通常</span>
                                        </div>
                                        <div className="relative aspect-[2/1] bg-gradient-to-br from-slate-50 to-slate-100">
                                            <Image
                                                src={getCardFullUrl(card.characterId, card.assetbundleName, false, assetSource)}
                                                alt={`${card.prefix} - 通常`}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                                priority
                                            />
                                        </div>
                                    </div>
                                )}
                                {/* Trained Image */}
                                {(trainable && !isBirthday) && (
                                    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                            <span className="text-sm font-bold text-slate-600">特训后</span>
                                        </div>
                                        <div className="relative aspect-[2/1] bg-gradient-to-br from-slate-50 to-slate-100">
                                            <Image
                                                src={getCardFullUrl(card.characterId, card.assetbundleName, true, assetSource)}
                                                alt={`${card.prefix} - 特训后`}
                                                fill
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Normal Mode: Tabs and switchable view */
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                {/* Image Toggle (only for trainable non-birthday cards that have both images) */}
                                {trainable && !isBirthday && !isTrainedOnlyCard && (
                                    <div className="flex border-b border-slate-100">
                                        <button
                                            className={`flex-1 py-3 text-sm font-bold transition-colors ${!showTrained
                                                ? "text-miku bg-miku/5 border-b-2 border-miku"
                                                : "text-slate-400 hover:text-slate-600"
                                                }`}
                                            onClick={() => setShowTrained(false)}
                                        >
                                            通常
                                        </button>
                                        <button
                                            className={`flex-1 py-3 text-sm font-bold transition-colors ${showTrained
                                                ? "text-miku bg-miku/5 border-b-2 border-miku"
                                                : "text-slate-400 hover:text-slate-600"
                                                }`}
                                            onClick={() => setShowTrained(true)}
                                        >
                                            特训后
                                        </button>
                                    </div>
                                )}

                                {/* Main Image */}
                                <div
                                    className="relative aspect-[2/1] bg-gradient-to-br from-slate-50 to-slate-100 cursor-zoom-in group"
                                    onClick={() => setImageViewerOpen(true)}
                                >
                                    {/* Loading Spinner (behind image) */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="loading-spinner loading-spinner-sm"></div>
                                    </div>

                                    <Image
                                        key={mainImageUrl} // Force remount on URL change for immediate switch
                                        src={mainImageUrl}
                                        alt={card.prefix}
                                        fill
                                        className="object-contain relative z-10"
                                        unoptimized
                                        priority
                                    />
                                    <div className="absolute bottom-3 right-3 z-20 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        点击放大
                                    </div>
                                </div>

                                {/* Thumbnails */}
                                <div className="p-4 flex gap-3 justify-center bg-slate-50/50">
                                    {/* Only show normal thumbnail if card has both images */}
                                    {!isTrainedOnlyCard && (
                                        <div
                                            className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${!effectiveShowTrained ? "ring-miku" : "ring-transparent hover:ring-slate-300"
                                                }`}
                                            onClick={() => setShowTrained(false)}
                                        >
                                            <Image
                                                src={getCardThumbnailUrl(card.characterId, card.assetbundleName, false, assetSource)}
                                                alt="Normal"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                    {/* Show trained thumbnail for trainable cards */}
                                    {(trainable && !isBirthday) && (
                                        <div
                                            className={`relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${effectiveShowTrained ? "ring-miku" : "ring-transparent hover:ring-slate-300"
                                                }`}
                                            onClick={() => !isTrainedOnlyCard && setShowTrained(true)}
                                        >
                                            <Image
                                                src={getCardThumbnailUrl(card.characterId, card.assetbundleName, true, assetSource)}
                                                alt="Trained"
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Card Info */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    基本资料
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="卡牌ID" value={`#${card.id}`} />
                                <InfoRow
                                    label="称号"
                                    value={
                                        <TranslatedText
                                            original={card.prefix}
                                            category="cards"
                                            field="prefix"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-slate-400 mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow label="角色" value={characterName} />
                                <InfoRow label="卡牌类型" value={
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${supplyName === "常驻" ? "bg-slate-100 text-slate-500" :
                                        supplyName === "生日" ? "bg-pink-100 text-pink-500" :
                                            "bg-amber-100 text-amber-600"
                                        }`}>
                                        {supplyName}
                                    </span>
                                } />
                                <InfoRow
                                    label="属性"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <Image
                                                src={getAttrIcon(card.attr)}
                                                alt={card.attr}
                                                width={20}
                                                height={20}
                                                unoptimized
                                            />
                                            <span style={{ color: ATTR_COLORS[card.attr] }}>
                                                {ATTR_NAMES[card.attr]}
                                            </span>
                                        </div>
                                    }
                                />
                                <InfoRow
                                    label="稀有度"
                                    value={
                                        <div className="flex items-center gap-1">
                                            {isBirthday ? (
                                                <>
                                                    <Image
                                                        src="/data/icon/birthday.webp"
                                                        alt="Birthday"
                                                        width={20}
                                                        height={20}
                                                        unoptimized
                                                    />
                                                    <span className="text-pink-500 font-bold">Birthday</span>
                                                </>
                                            ) : (
                                                <>
                                                    {Array.from({ length: rarityNum }).map((_, i) => (
                                                        <Image
                                                            key={i}
                                                            src="/data/icon/star.webp"
                                                            alt="Star"
                                                            width={18}
                                                            height={18}
                                                            unoptimized
                                                        />
                                                    ))}
                                                    <span className="ml-1 text-amber-500 font-bold">{rarityNum}★</span>
                                                </>
                                            )}
                                        </div>
                                    }
                                />
                                <InfoRow
                                    label="发布时间"
                                    value={mounted && card.releaseAt
                                        ? new Date(card.releaseAt).toLocaleDateString("zh-CN", {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        })
                                        : card.releaseAt ? "..." : "未知"}
                                />
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{card.assetbundleName}</span>}
                                />
                                {/* Support Unit - Only for Virtual Singers (characterId >= 21) */}
                                {card.characterId >= 21 && (
                                    <InfoRow
                                        label="团体归属"
                                        value={
                                            <div className="flex items-center gap-2">
                                                {card.supportUnit !== "none" && (
                                                    <div className="w-5 h-5 relative">
                                                        <Image
                                                            src={`/data/icon/${{
                                                                "light_sound": "ln.webp",
                                                                "idol": "mmj.webp",
                                                                "school_refusal": "n25.webp",
                                                                "theme_park": "wxs.webp",
                                                                "street": "vbs.webp",
                                                            }[card.supportUnit]}`}
                                                            alt={SUPPORT_UNIT_NAMES[card.supportUnit]}
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                )}
                                                <span className={card.supportUnit === "none" ? "text-slate-400" : ""}>
                                                    {SUPPORT_UNIT_NAMES[card.supportUnit]}
                                                </span>
                                            </div>
                                        }
                                    />
                                )}
                                {card.gachaPhrase && card.gachaPhrase !== "-" && (
                                    <GachaPhraseRow
                                        phrase={card.gachaPhrase}
                                        assetbundleName={card.assetbundleName}
                                    />
                                )}
                            </div>

                        </div>

                        {/* Stats Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    数值
                                </h2>
                            </div>

                            {/* Level Slider - Compact */}
                            <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-500 whitespace-nowrap w-12 text-right">
                                    Lv.{cardLevel}
                                </span>
                                <input
                                    type="range"
                                    min={1}
                                    max={maxLevel}
                                    value={cardLevel}
                                    onChange={(e) => setCardLevel(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-miku"
                                />
                                <span className="text-xs text-slate-400 w-8">
                                    /{maxLevel}
                                </span>
                            </div>

                            {/* Stats Display - Simplified (No Bars) */}
                            <div className="px-5 py-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700">综合力</span>
                                    <span className="text-2xl font-black text-miku">{stats.total.toLocaleString()}</span>
                                </div>
                            </div>

                        </div>

                        {/* Skill Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    技能
                                </h2>
                            </div>
                            <div className="p-5">
                                {/* Skill Level Slider */}
                                {skillData && (
                                    <div className="mb-4 flex items-center gap-3 pb-3 border-b border-slate-200/60">
                                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                            技能 Lv.{skillLevel}
                                        </span>
                                        <input
                                            type="range"
                                            min={1}
                                            max={skillData.skillEffects[0]?.skillEffectDetails.length || 4}
                                            value={skillLevel}
                                            onChange={(e) => setSkillLevel(Number(e.target.value))}
                                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-miku"
                                        />
                                        <span className="text-xs text-slate-400">
                                            /{skillData.skillEffects[0]?.skillEffectDetails.length || 4}
                                        </span>
                                    </div>
                                )}

                                {/* Normal Skill (Before Blooming) */}
                                <div className={`mb-4 ${trainedSkillData ? 'pb-4 border-b border-slate-200/60' : ''}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-slate-400 uppercase tracking-wider">技能名称</span>
                                        {trainedSkillData && (
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                                开花前
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-lg font-bold text-slate-800 mb-2">
                                        <TranslatedText
                                            original={card.cardSkillName}
                                            category="cards"
                                            field="skillName"
                                            originalClassName=""
                                            translationClassName="block text-sm font-medium text-slate-400 mt-0.5"
                                        />
                                    </p>
                                    <div className="p-4 bg-slate-50 rounded-xl">
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                            {skillDescription || "加载技能详情中..."}
                                        </p>
                                    </div>
                                </div>


                                {/* Trained Skill (After Blooming) */}
                                {trainedSkillData && card.specialTrainingSkillName && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs text-slate-400 uppercase tracking-wider">技能名称</span>
                                            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">
                                                开花后
                                            </span>
                                        </div>
                                        <p className="text-lg font-bold text-slate-800 mb-2">
                                            <TranslatedText
                                                original={card.specialTrainingSkillName}
                                                category="cards"
                                                field="skillName"
                                                originalClassName=""
                                                translationClassName="block text-sm font-medium text-slate-400 mt-0.5"
                                            />
                                        </p>
                                        <div className="p-4 bg-gradient-to-br from-amber-50 to-slate-50 rounded-xl ring-1 ring-amber-200/50">
                                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                                {trainedSkillDescription || "加载技能详情中..."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Costumes Card */}
                        {relatedCostumes.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        卡片服装
                                    </h2>
                                </div>
                                <div className="p-5">
                                    <CostumeGrid costumes={relatedCostumes} assetSource={assetSource} />
                                </div>
                            </div>
                        )}

                        {/* Related Event Card */}
                        {relatedEvent && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        相关活动
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <Link href={`/events/${relatedEvent.id}`} className="block group">
                                        <div className="relative aspect-[2/1] w-full">
                                            <Image
                                                src={getEventBannerUrl(relatedEvent.assetbundleName, assetSource)}
                                                alt={relatedEvent.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                unoptimized
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                        Event #{relatedEvent.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                    <TranslatedText
                                                        original={relatedEvent.name}
                                                        category="events"
                                                        field="name"
                                                        originalClassName="truncate block"
                                                        translationClassName="text-sm font-medium text-white/90 truncate block mt-0.5"
                                                    />
                                                </h3>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Related Gacha Card */}
                        {relatedGachas.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-500/10 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        关联卡池
                                    </h2>
                                </div>
                                <div className="p-4 grid grid-cols-1 gap-3">
                                    {relatedGachas.map((gacha) => (
                                        <Link key={gacha.id} href={`/gacha/${gacha.id}`} className="block group relative h-32 bg-white rounded-xl overflow-hidden ring-1 ring-slate-200 shadow-sm transition-all hover:shadow-md hover:scale-[1.02]">
                                            {/* Logo Container with Padding */}
                                            <div className="absolute inset-3 z-0 flex items-center justify-center">
                                                <Image
                                                    src={getGachaLogoUrl(gacha.assetbundleName, assetSource)}
                                                    alt={gacha.name}
                                                    fill
                                                    className="object-contain transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                                                    unoptimized
                                                />
                                            </div>

                                            {/* Gradient Overlay for Text Readability - Lighter for light mode, or white fade */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent z-10" />

                                            {/* Text Content */}
                                            <div className="absolute bottom-0 left-0 w-full p-3 z-20">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200 shadow-sm">
                                                        #{gacha.id}
                                                    </span>
                                                </div>
                                                <h3 className="text-slate-800 font-bold text-sm leading-snug w-full line-clamp-2 text-shadow-sm">
                                                    <TranslatedText
                                                        original={gacha.name}
                                                        category="gacha"
                                                        field="name"
                                                        originalClassName="truncate block"
                                                        translationClassName="text-xs font-medium text-slate-500 truncate block mt-0.5"
                                                    />
                                                </h3>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        返回卡牌列表
                    </button>
                </div>
            </div >
        </MainLayout >
    );
}

// Info Row Component
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-medium text-slate-800">{value}</span>
        </div>
    );
}

// Stat Row Component
function StatRow({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-bold" style={{ color }}>{value.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}

// Gacha Phrase Row Component
function GachaPhraseRow({ phrase, assetbundleName }: { phrase: string; assetbundleName: string }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
            setIsPlaying(true);
        }
    };

    return (
        <div className="px-5 py-3 flex flex-col gap-2">
            <span className="text-sm text-slate-500">抽卡台词</span>
            <div className="flex items-start gap-3">
                <button
                    onClick={togglePlay}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlaying
                        ? "bg-miku text-white shadow-md scale-110"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                >
                    {isPlaying ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    )}
                </button>
                <p className="text-sm font-medium text-slate-800 leading-relaxed pt-1">
                    <TranslatedText
                        original={phrase}
                        category="cards"
                        field="gachaPhrase"
                        originalClassName=""
                        translationClassName="block text-xs font-normal text-slate-500 mt-1"
                    />
                </p>
                <audio
                    ref={audioRef}
                    src={getCardGachaVoiceUrl(assetbundleName)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                />
            </div>
        </div>
    );
}

// Costume Grid Component
// Costume Grid Component
function CostumeGrid({ costumes, assetSource }: { costumes: Costume3d[], assetSource: any }) {

    // Group variants
    const groups = useMemo(() => {
        const map = new Map<string, Costume3d[]>();
        costumes.forEach(c => {
            // Group by GroupID (and PartType just to be safe, though GroupID should be unique enough)
            const key = `${c.costume3dGroupId}-${c.partType}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(c);
        });

        const result: { key: string, partType: string, variants: Costume3d[] }[] = [];
        map.forEach((variants, key) => {
            variants.sort((a, b) => a.colorId - b.colorId);
            result.push({ key, partType: variants[0].partType, variants });
        });

        // Sort groups: Body -> Hair -> Head
        // For multiple heads, they just appear after Hair.
        result.sort((a, b) => {
            const order = { "body": 1, "hair": 2, "head": 3 };
            const scoreA = order[a.partType as keyof typeof order] || 99;
            const scoreB = order[b.partType as keyof typeof order] || 99;

            if (scoreA !== scoreB) return scoreA - scoreB;
            // Secondary sort by GroupID for stability
            return a.variants[0].costume3dGroupId - b.variants[0].costume3dGroupId;
        });

        return result;
    }, [costumes]);

    // Determine available colors (union of all colorIds)
    const availableColors = useMemo(() => {
        const colors = new Set<number>();
        costumes.forEach(c => colors.add(c.colorId));
        return Array.from(colors).sort((a, b) => a - b);
    }, [costumes]);

    const [activeColorId, setActiveColorId] = useState(1);

    // Initial effect: If ID 1 doesn't exist (unlikely), pick first available
    useEffect(() => {
        if (availableColors.length > 0 && !availableColors.includes(1)) {
            setActiveColorId(availableColors[0]);
        }
    }, [availableColors]);

    return (
        <div className="flex flex-col gap-4">
            {/* Unified Color Switcher */}
            {availableColors.length > 1 && (
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500">颜色切换</span>
                    <div className="flex flex-wrap gap-2">
                        {availableColors.map(colorId => (
                            <button
                                key={colorId}
                                onClick={() => setActiveColorId(colorId)}
                                className={`px-3 py-1 rounded-full text-xs font-mono transition-all border
                                    ${activeColorId === colorId
                                        ? "bg-miku text-white border-miku shadow-sm"
                                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                    }
                                `}
                            >
                                Color {colorId}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {groups.map(group => (
                    <CostumeGroupItem
                        key={group.key}
                        variants={group.variants}
                        targetColorId={activeColorId}
                        assetSource={assetSource}
                    />
                ))}
            </div>
        </div>
    );
}

function CostumeGroupItem({ variants, targetColorId, assetSource }: { variants: Costume3d[], targetColorId: number, assetSource: any }) {
    // Find exact color match, or fallback to first (usually color 1)
    const displayVariant = variants.find(v => v.colorId === targetColorId) || variants[0];

    const partTypeName = {
        "head": "发饰",
        "hair": "发型",
        "body": "服装"
    }[displayVariant.partType] || displayVariant.partType;

    return (
        <div className="flex flex-col items-center bg-slate-50 rounded-xl p-2 border border-slate-100 transition-all duration-300">
            <div className="group relative w-full aspect-square mb-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
                <Image
                    key={displayVariant.assetbundleName}
                    src={getCostumeThumbnailUrl(displayVariant.assetbundleName, assetSource)}
                    alt={displayVariant.name}
                    fill
                    className="object-cover transition-opacity duration-300"
                    unoptimized
                />
                {/* Tooltip */}
                <div className="absolute bottom-0 left-0 w-full bg-black/60 backdrop-blur-[1px] p-1 translate-y-full group-hover:translate-y-0 transition-transform z-10">
                    <p className="text-[10px] text-white text-center truncate">{displayVariant.name}</p>
                </div>
            </div>

            <div className="flex items-center justify-between w-full px-0.5">
                <span className="text-xs font-bold text-slate-600">{partTypeName}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                    {displayVariant.colorId === targetColorId ? `Color ${displayVariant.colorId}` : `(Color ${displayVariant.colorId})`}
                </span>
            </div>
        </div>
    );
}
