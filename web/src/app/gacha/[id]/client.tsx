"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { ICardInfo, IGachaInfo, IGachaDetail, GACHA_TYPE_LABELS, getRarityNumber, isTrainableCard, CardRarityType, IGachaBehavior, IGachaCardRarityRate } from "@/types/types";
import { getGachaLogoUrl, getGachaScreenUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";

// Gacha Simulator Types
interface GachaStatistic {
    counts: number[];
    spinCount: number;
    pickupCount: number;
}

interface HistoryItem extends IGachaDetail {
    pullIndex: number;
}

// Card rarity type to number mapping
const cardRarityTypeToRarity: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 4,
};

// ... (LOCAL_ATTR_ICONS definition remains here, if it was in the range. If not, I should be careful not to overwrite it if I didn't include it in Context. 
// Wait, I am replacing from line 17. The previous content shows LOCAL_ATTR_ICONS starts at line 35 (in original file, but line numbers shifted).
// Let's check the context from previous view_file output in Step 27/29.
// Step 27 added definitions.
// Step 29/31 showed state definitions.
// To be safe, I will target the GachaStatistic interface definition and the state definitions separately or verify lines.)

// Let me use `view_file` first to be absolutely sure of line numbers before I replace logic.


// Local attribute icon mapping
const LOCAL_ATTR_ICONS: Record<string, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

export default function GachaDetailClient() {
    const router = useRouter();
    const params = useParams();
    const gachaId = params.id as string;
    const searchParams = useSearchParams();
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';
    const [gacha, setGacha] = useState<IGachaInfo | null>(null);
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState<"logo" | "bg">("logo");
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [customSpinCount, setCustomSpinCount] = useState<string>("");
    const { isShowSpoiler, useTrainedThumbnail, assetSource } = useTheme();
    const { setDetailName } = useBreadcrumb();

    // Gacha Simulator states
    const [statistic, setStatistic] = useState<GachaStatistic>({
        counts: [],
        spinCount: 0,
        pickupCount: 0,
    });
    const [currentGachaResult, setCurrentGachaResult] = useState<IGachaDetail[]>([]);
    const [history4Stars, setHistory4Stars] = useState<HistoryItem[]>([]);
    const [gachaRarityRates, setGachaRarityRates] = useState<IGachaCardRarityRate[]>([]);
    const [weights, setWeights] = useState<number[]>([]);
    const [normalRates, setNormalRates] = useState<number[]>([]);
    const [guaranteedRates, setGuaranteedRates] = useState<number[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Set breadcrumb detail name
    useEffect(() => {
        if (gacha) setDetailName(gacha.name);
    }, [gacha, setDetailName]);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);

                // Fetch gacha and cards from master data
                const [gachasData, cardsData] = await Promise.all([
                    fetchMasterData<IGachaInfo[]>("gachas.json"),
                    fetchMasterData<ICardInfo[]>("cards.json")
                ]);

                // Find the specific gacha
                const gachaIdNum = parseInt(gachaId, 10);
                const foundGacha = gachasData.find(g => g.id === gachaIdNum);

                if (!foundGacha) {
                    throw new Error("Gacha not found");
                }

                setGacha(foundGacha);
                setCards(cardsData);
                document.title = `${foundGacha.name} - Moesekai`;
            } catch (err) {
                console.error("Error:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [gachaId]);

    const formatDate = (timestamp: number) => {
        if (!mounted) return "...";
        return new Date(timestamp).toLocaleString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Get pickup cards from the gachaPickups
    const pickupCards = useMemo(() => {
        if (!gacha) return [];
        const pickupCardIds = gacha.gachaPickups?.map(p => p.cardId) || [];
        return pickupCardIds
            .map(cardId => cards.find(c => c.id === cardId))
            .filter((c): c is ICardInfo => c !== undefined);
    }, [gacha, cards]);

    // Get gacha status
    const getGachaStatus = () => {
        if (!gacha) return { label: "Unknown", color: "#888" };
        const now = Date.now();
        if (gacha.startAt > now) return { label: "未开始", color: "#f59e0b" };
        if (gacha.endAt >= now) return { label: "进行中", color: "#22c55e" };
        return { label: "已结束", color: "#94a3b8" };
    };

    // Initialize gacha rates when gacha data is loaded
    useEffect(() => {
        if (gacha && gacha.gachaCardRarityRates) {
            const rates = [...gacha.gachaCardRarityRates]
                .sort((a, b) => b.rate - a.rate)
                .filter(rate => !!rate.rate);

            setGachaRarityRates(rates);
            setNormalRates(rates.map(rate => rate.rate));

            // Calculate guaranteed rates for 10-pull guarantee
            const sumRates = rates.reduce(
                (sum, curr) => [...sum, curr.rate + (sum.slice(-1)[0] || 0)],
                [] as number[]
            );

            if (gacha.gachaBehaviors.some(gb => gb.gachaBehaviorType === "over_rarity_3_once")) {
                const grs = rates.map(rate => rate.rate);
                const rarity3Idx = rates.findIndex(rate => rate.cardRarityType === "rarity_3");
                if (rarity3Idx !== -1) {
                    grs[rarity3Idx] = sumRates[rarity3Idx];
                    rates.forEach((rate, idx) => {
                        if (rate.cardRarityType !== "rarity_birthday" && cardRarityTypeToRarity[rate.cardRarityType] < 3) {
                            grs[idx] = 0;
                        }
                    });
                }
                setGuaranteedRates(grs);
            } else if (gacha.gachaBehaviors.some(gb => gb.gachaBehaviorType === "over_rarity_4_once")) {
                const grs = [...sumRates];
                const rarity4Idx = rates.findIndex(rate => rate.cardRarityType === "rarity_4");
                if (rarity4Idx !== -1) {
                    grs[rarity4Idx] = sumRates[rarity4Idx];
                    rates.forEach((rate, idx) => {
                        if (rate.cardRarityType !== "rarity_birthday" && cardRarityTypeToRarity[rate.cardRarityType] < 4) {
                            grs[idx] = 0;
                        }
                    });
                }
                setGuaranteedRates(grs);
            }

            // Initialize statistic counts
            setStatistic(stats => ({
                ...stats,
                counts: rates.map(() => 0),
            }));
        }
    }, [gacha]);

    // Calculate weights for each rarity
    useEffect(() => {
        if (cards.length > 0 && gacha && gachaRarityRates.length > 0) {
            const weightArr = gachaRarityRates.map(() => 0);
            gacha.gachaDetails.forEach(detail => {
                const card = cards.find(c => c.id === detail.cardId);
                if (card) {
                    const idx = gachaRarityRates.findIndex(
                        rate => rate.cardRarityType === card.cardRarityType
                    );
                    if (idx !== -1) {
                        weightArr[idx] += detail.weight;
                    }
                }
            });
            setWeights(weightArr);
        }
    }, [cards, gacha, gachaRarityRates]);

    // Gacha simulation function
    const doGacha = useCallback((behavior: IGachaBehavior) => {
        if (!gacha || gachaRarityRates.length === 0 || cards.length === 0) return;

        const rollTimes = behavior.spinCount;
        const rollResult = gachaRarityRates.map(() => 0);

        const normalSum = normalRates.reduce(
            (sum, curr) => [...sum, curr + (sum.slice(-1)[0] || 0)],
            [] as number[]
        );
        const guaranteeSum = guaranteedRates.reduce(
            (sum, curr) => [...sum, curr + (sum.slice(-1)[0] || 0)],
            [] as number[]
        );

        const rollableCards = gachaRarityRates.map(rate =>
            gacha.gachaDetails
                .filter(gd => {
                    const card = cards.find(c => c.id === gd.cardId);
                    return card?.cardRarityType === rate.cardRarityType;
                })
                .sort((a, b) => a.weight - b.weight)
        );

        const rollWeights = rollableCards.map(elem =>
            elem?.map(e => e.weight)
        );

        const tmpGachaResult: IGachaDetail[] = [];
        const isOverRarity = behavior.gachaBehaviorType.startsWith("over_rarity");
        let overRarityLevel = 0;
        if (isOverRarity) {
            if (behavior.gachaBehaviorType === "over_rarity_3_once") {
                overRarityLevel = 3;
            } else if (behavior.gachaBehaviorType === "over_rarity_4_once") {
                overRarityLevel = 4;
            }
        }

        let noOverRarityCount = 0;
        let batchPickupCount = 0;

        for (let i = 0; i < rollTimes; i++) {
            let pulledCardDetail: IGachaDetail | null = null;
            if (i % 10 === 9 && isOverRarity && noOverRarityCount === 9 && guaranteeSum.length > 0) {
                // Guaranteed roll for 10th pull
                const roll = Math.random() * 100;
                const idx = guaranteeSum.findIndex(rate => roll < rate);
                if (idx !== -1) {
                    rollResult[idx] += 1;
                    const weightArr = rollWeights[idx].reduce(
                        (sum, curr) => [...sum, curr + (sum.slice(-1)[0] || 0)],
                        [] as number[]
                    );
                    const weightSum = weights[idx];
                    const rand = Math.floor(Math.random() * weightSum);
                    const pulled = rollableCards[idx][weightArr.filter(w => w <= rand).length];
                    tmpGachaResult.push(pulled);
                    pulledCardDetail = pulled;
                }
                noOverRarityCount = 0;
                continue;
            } else if (i % 10 === 0) {
                noOverRarityCount = 0;
            }

            const roll = Math.random() * 100;
            const idx = normalSum.findIndex(rate => roll < rate);
            if (idx !== -1 && rollableCards[idx].length > 0) {
                rollResult[idx] += 1;
                const weightArr = rollWeights[idx].reduce(
                    (sum, curr) => [...sum, curr + (sum.slice(-1)[0] || 0)],
                    [] as number[]
                );
                const weightSum = weights[idx];
                const rand = Math.floor(Math.random() * weightSum);
                const pulled = rollableCards[idx][weightArr.filter(w => w <= rand).length];
                tmpGachaResult.push(pulled);
                pulledCardDetail = pulled;

                if (isOverRarity && cardRarityTypeToRarity[gachaRarityRates[idx].cardRarityType] < overRarityLevel) {
                    noOverRarityCount += 1;
                }
            }

            // Check if pulled card is pickup
            if (pulledCardDetail) {
                const card = cards.find(c => c.id === pulledCardDetail!.cardId);
                if (card && pickupCards.some(p => p.id === card.id)) {
                    batchPickupCount++;
                }
            }
        }

        // Capture startSpinCount synchronously before any state updates
        // Use functional update to get accurate current spinCount
        let actualStartSpinCount = 0;
        setStatistic(stats => {
            actualStartSpinCount = stats.spinCount;
            return {
                counts: stats.counts.map((count, idx) => rollResult[idx] + count),
                spinCount: stats.spinCount + behavior.spinCount,
                pickupCount: (stats.pickupCount || 0) + batchPickupCount,
            };
        });

        setCurrentGachaResult(tmpGachaResult.slice(-10));

        // Update history 4 stars - use functional form to get accurate previous history
        // We need to calculate pullIndex based on the captured startSpinCount
        setHistory4Stars(prev => {
            // Build the list of new 4-star details with proper pullIndex
            const new4StarDetails: HistoryItem[] = [];

            tmpGachaResult.forEach((detail, idx) => {
                const card = cards.find(c => c.id === detail.cardId);
                if (card && (card.cardRarityType === "rarity_4" || card.cardRarityType === "rarity_birthday")) {
                    new4StarDetails.push({
                        ...detail,
                        pullIndex: actualStartSpinCount + idx + 1
                    });
                }
            });

            if (new4StarDetails.length === 0) {
                return prev;
            }

            // Reverse so newest is first, then prepend to existing history
            return [...new4StarDetails.reverse(), ...prev];
        });
    }, [cards, gacha, gachaRarityRates, guaranteedRates, normalRates, weights, pickupCards]);

    // Reset gacha statistics
    const resetGacha = useCallback(() => {
        setStatistic(stats => ({
            counts: stats.counts.map(() => 0),
            spinCount: 0,
            pickupCount: 0,
        }));
        setCurrentGachaResult([]);
        setHistory4Stars([]);
    }, []);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !gacha) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">扭蛋 {gachaId} 正在由SnowyViewer抓紧构建</h2>
                        <p className="text-slate-500 mb-6">少安毋躁~预计12H内更新</p>
                        <Link
                            href="/gacha"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回扭蛋列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const logoUrl = getGachaLogoUrl(gacha.assetbundleName, assetSource);
    const bgUrl = getGachaScreenUrl(gacha.assetbundleName, gacha.id, assetSource);
    const status = getGachaStatus();
    const activeImageUrl = activeImageTab === "logo" ? logoUrl : bgUrl;
    const activeImageLabel = activeImageTab === "logo" ? "Logo" : "背景";

    return (
        <MainLayout>
            <ImagePreviewModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                title={`${gacha.name} ${activeImageLabel} 大图`}
                imageUrl={activeImageUrl}
                alt={`${gacha.name} ${activeImageLabel}`}
                fileName={`gacha_${gacha.id}_${activeImageTab}.png`}
            />

            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-mono text-slate-500 w-fit">
                            ID: {gacha.id}
                        </span>
                        <span className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit bg-purple-500">
                            {GACHA_TYPE_LABELS[gacha.gachaType] || gacha.gachaType}
                        </span>
                        <span
                            className="px-3 py-1 text-xs font-bold rounded-full text-white w-fit"
                            style={{ backgroundColor: status.color }}
                        >
                            {status.label}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        <TranslatedText
                            original={gacha.name}
                            category="gacha"
                            field="name"
                            originalClassName=""
                            translationClassName="block text-lg font-medium text-slate-400 mt-1"
                        />
                    </h1>
                </div>

                {/* Main Content Grid - Images LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    {/* LEFT Column: Image Gallery */}
                    <div>
                        {isScreenshotMode ? (
                            /* Screenshot Mode: Show all images in flat layout */
                            <div className="space-y-4">
                                {/* Logo */}
                                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-600">Logo</span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                        <Image
                                            src={logoUrl}
                                            alt={`${gacha.name} Logo`}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                            priority
                                        />
                                    </div>
                                </div>
                                {/* Background */}
                                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <span className="text-sm font-bold text-slate-600">背景</span>
                                    </div>
                                    <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
                                        <Image
                                            src={bgUrl}
                                            alt={`${gacha.name} Background`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Normal Mode: Tabs */
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden lg:sticky lg:top-24">
                                {/* Tabs */}
                                <div className="flex border-b border-slate-200">
                                    {[
                                        { key: "logo", label: "Logo" },
                                        { key: "bg", label: "背景" },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveImageTab(tab.key as "logo" | "bg")}
                                            className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${activeImageTab === tab.key
                                                ? "text-miku border-b-2 border-miku bg-miku/5"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Image Content */}
                                <div
                                    className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100 cursor-zoom-in group"
                                    onClick={() => setImageViewerOpen(true)}
                                >
                                    {activeImageTab === "logo" && (
                                        <Image
                                            src={logoUrl}
                                            alt={`${gacha.name} Logo`}
                                            fill
                                            className="object-contain p-6"
                                            unoptimized
                                            priority
                                        />
                                    )}
                                    {activeImageTab === "bg" && (
                                        <Image
                                            src={bgUrl}
                                            alt={`${gacha.name} Background`}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    )}
                                    <div className="absolute bottom-3 right-3 z-10 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        点击放大
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT Column: Info Cards */}
                    <div className="space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    扭蛋信息
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <InfoRow label="ID" value={`#${gacha.id}`} />
                                <InfoRow
                                    label="名称"
                                    value={
                                        <TranslatedText
                                            original={gacha.name}
                                            category="gacha"
                                            field="name"
                                            originalClassName=""
                                            translationClassName="block text-xs font-normal text-slate-400 mt-0.5"
                                        />
                                    }
                                />
                                <InfoRow label="类型" value={GACHA_TYPE_LABELS[gacha.gachaType] || gacha.gachaType} />
                                <InfoRow label="开始时间" value={formatDate(gacha.startAt)} />
                                <InfoRow label="结束时间" value={formatDate(gacha.endAt)} />
                                <InfoRow
                                    label="内部资源名称"
                                    value={<span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{gacha.assetbundleName}</span>}
                                />
                            </div>
                        </div>

                        {/* Gacha Rates Card */}
                        {gacha.gachaCardRarityRates && gacha.gachaCardRarityRates.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        抽卡概率
                                    </h2>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {gacha.gachaCardRarityRates.map(rate => {
                                        const rarityLabel = rate.cardRarityType === "rarity_birthday"
                                            ? "🎂 生日"
                                            : `${rate.cardRarityType.replace("rarity_", "")}★`;
                                        return (
                                            <div key={rate.id} className="px-5 py-3 flex items-center justify-between text-sm">
                                                <span className="text-slate-500 font-medium">{rarityLabel}</span>
                                                <span className="text-miku font-bold">{rate.rate}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pickup Cards */}
                        {pickupCards.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                        PICKUP 卡牌 ({pickupCards.length})
                                    </h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
                                        {pickupCards.map(card => {
                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");
                                            const pullCount = history4Stars.filter(h => h.cardId === card.id).length;
                                            const isPulled = pullCount > 0;

                                            return (
                                                <Link
                                                    key={card.id}
                                                    href={`/cards/${card.id}`}
                                                    className="group block"
                                                >
                                                    <div className={`rounded-lg overflow-hidden bg-white hover:shadow-lg transition-all ${isPulled ? 'ring-2 ring-green-400' : 'ring-1 ring-slate-200 hover:ring-miku'}`}>
                                                        <SekaiCardThumbnail card={card} trained={showTrained} className="w-full" />
                                                        {isPulled && (
                                                            <div className="flex items-center justify-center gap-0.5 bg-gradient-to-r from-green-500 to-green-400 text-white text-[8px] font-black py-0.5 leading-none">
                                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                {pullCount > 1 && <span>×{pullCount}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* No pickup cards message */}
                        {pickupCards.length === 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden p-6 text-center text-slate-400">
                                <p>该扭蛋没有 PICKUP 卡牌</p>
                            </div>
                        )}

                        {/* Consolidated Simulator & Statistics (Sidebar Mode) */}
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    模拟抽卡
                                </h2>
                            </div>
                            <div className="p-5 flex flex-col gap-6">
                                {/* Controls */}
                                <div className="flex flex-col gap-4 items-center">
                                    <div className="flex flex-wrap gap-3 justify-center w-full">
                                        {(() => {
                                            const uniqueBehaviors = gacha.gachaBehaviors.reduce((acc, curr) => {
                                                if (!acc.some(b => b.spinCount === curr.spinCount)) {
                                                    acc.push(curr);
                                                }
                                                return acc;
                                            }, [] as IGachaBehavior[]).sort((a, b) => a.spinCount - b.spinCount);

                                            return uniqueBehaviors.map((behavior, idx) => {
                                                const label = behavior.spinCount === 1 ? "单抽" : `${behavior.spinCount}连`;
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => doGacha(behavior)}
                                                        className="flex-1 py-3 bg-miku hover:bg-miku-dark text-white font-bold rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            });
                                        })()}

                                        {/* Custom Spin Count Input */}
                                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 pl-3 w-full sm:w-auto mt-2 sm:mt-0">
                                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">指定抽数:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="1000"
                                                value={customSpinCount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 1000)) {
                                                        setCustomSpinCount(val);
                                                    }
                                                }}
                                                className="w-16 bg-transparent text-sm font-bold text-slate-800 focus:outline-none text-center"
                                                placeholder="MAX"
                                            />
                                            <button
                                                onClick={() => {
                                                    const count = parseInt(customSpinCount);
                                                    if (count && count > 0 && count <= 1000) {
                                                        // Find a reference behavior (prefer strict 10-pull for guarantee type, else generic)
                                                        const refBehavior = gacha.gachaBehaviors.find(b => b.spinCount === 10) || gacha.gachaBehaviors[0];
                                                        if (refBehavior) {
                                                            doGacha({
                                                                ...refBehavior,
                                                                spinCount: count
                                                            });
                                                        }
                                                    }
                                                }}
                                                disabled={!customSpinCount}
                                                className="p-2 bg-slate-200 hover:bg-miku hover:text-white text-slate-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between w-full px-1">
                                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">总抽数: <span className="text-lg text-slate-800 ml-1">{statistic.spinCount}</span></div>
                                        <button
                                            onClick={resetGacha}
                                            className="text-slate-400 hover:text-slate-600 text-sm hover:underline transition-colors"
                                        >
                                            重置数据
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-100 w-full"></div>

                                {/* Statistics Table */}
                                <div className="overflow-hidden rounded-xl border border-slate-100">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="text-left py-2 px-3 font-bold text-slate-600">稀有度</th>
                                                <th className="text-center py-2 px-3 font-bold text-slate-600">次数</th>
                                                <th className="text-center py-2 px-3 font-bold text-slate-600">概率</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* UP Rate Row */}
                                            <tr className="border-b border-slate-100 last:border-0 hover:bg-pink-50/50 transition-colors bg-pink-50/30">
                                                <td className="py-2 px-3 font-bold text-pink-500 flex items-center gap-1">
                                                    <span className="bg-pink-500 text-white text-[10px] px-1 rounded">UP</span>
                                                    角色
                                                </td>
                                                <td className="text-center py-2 px-3 text-slate-600">{statistic.pickupCount || 0}</td>
                                                <td className="text-center py-2 px-3 text-pink-500 font-bold">
                                                    {statistic.spinCount > 0 ? (((statistic.pickupCount || 0) / statistic.spinCount) * 100).toFixed(2) : "0.00"}%
                                                </td>
                                            </tr>
                                            {gachaRarityRates.map((rate, idx) => {
                                                const rarityLabel = rate.cardRarityType === "rarity_birthday"
                                                    ? "🎂 生日"
                                                    : `${cardRarityTypeToRarity[rate.cardRarityType]}★`;
                                                const count = statistic.counts[idx] || 0;
                                                const percentage = statistic.spinCount > 0
                                                    ? ((count / statistic.spinCount) * 100).toFixed(2)
                                                    : "0.00";
                                                return (
                                                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-2 px-3 font-bold text-slate-700">{rarityLabel}</td>
                                                        <td className="text-center py-2 px-3 text-slate-600">{count}</td>
                                                        <td className="text-center py-2 px-3 text-miku font-bold">{percentage}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Current Gacha Result */}
                        {currentGachaResult.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                        最近 10 抽结果
                                    </h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-5 gap-2">
                                        {currentGachaResult.map((detail, idx) => {
                                            const card = cards.find(c => c.id === detail.cardId);
                                            if (!card) return null;

                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");
                                            const isPickup = pickupCards.some(p => p.id === card.id);
                                            const is4Star = card.cardRarityType === "rarity_4" || card.cardRarityType === "rarity_birthday";

                                            return (
                                                <Link
                                                    key={idx}
                                                    href={`/cards/${card.id}`}
                                                    className="group block"
                                                >
                                                    <div className={`rounded-lg overflow-hidden bg-white hover:shadow-lg transition-all ${isPickup
                                                        ? 'ring-2 ring-pink-400'
                                                        : is4Star
                                                            ? 'ring-2 ring-yellow-400'
                                                            : 'ring-1 ring-slate-200 hover:ring-miku'
                                                        }`}>
                                                        <SekaiCardThumbnail card={card} trained={showTrained} className="w-full" />
                                                        {(isPickup || is4Star) && (
                                                            <div className={`text-center text-white text-[8px] sm:text-[9px] font-black py-0.5 leading-none ${isPickup ? 'bg-gradient-to-r from-pink-500 to-pink-400' : 'bg-gradient-to-r from-yellow-400 to-yellow-300'}`}>
                                                                {isPickup ? 'UP' : '4星'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* History 4-Star Results */}
                        {history4Stars.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                        历史 4★ / 生日 结果
                                    </h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-5 gap-2">
                                        {history4Stars.map((detail, idx) => {
                                            const card = cards.find(c => c.id === detail.cardId);
                                            if (!card) return null;

                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");
                                            const isPickup = pickupCards.some(p => p.id === card.id);
                                            const is4Star = card.cardRarityType === "rarity_4" || card.cardRarityType === "rarity_birthday";

                                            const currentPullIndex = detail.pullIndex || 0;
                                            const olderDetail = history4Stars[idx + 1];
                                            const prevPullIndex = olderDetail ? (olderDetail.pullIndex || 0) : 0;
                                            const pityCount = currentPullIndex - prevPullIndex;
                                            const pityColorClass = pityCount <= 50 ? "bg-green-500" : pityCount >= 100 ? "bg-orange-500" : "bg-miku";

                                            return (
                                                <Link
                                                    key={idx}
                                                    href={`/cards/${card.id}`}
                                                    className="group block"
                                                >
                                                    <div className={`rounded-lg overflow-hidden bg-white hover:shadow-lg transition-all ${isPickup
                                                        ? 'ring-2 ring-pink-400'
                                                        : is4Star
                                                            ? 'ring-2 ring-yellow-400'
                                                            : 'ring-1 ring-slate-200 hover:ring-miku'
                                                        }`}>
                                                        <SekaiCardThumbnail card={card} trained={showTrained} className="w-full" />
                                                        <div className={`flex items-center justify-between text-white text-[8px] sm:text-[9px] font-black py-0.5 px-1 leading-none ${isPickup ? 'bg-gradient-to-r from-pink-500 to-pink-400' : 'bg-gradient-to-r from-yellow-400 to-yellow-300'}`}>
                                                            <span>{isPickup ? 'UP' : '4★'}</span>
                                                            {pityCount > 0 && (
                                                                <span className={`px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold ${pityColorClass} text-white`}>
                                                                    {pityCount}抽
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
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
                        返回扭蛋列表
                    </button>
                </div>
            </div>
        </MainLayout >
    );
}

// Info Row Component (same as events page)
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className="text-slate-800 font-bold text-right max-w-[60%]">{value}</span>
        </div>
    );
}
