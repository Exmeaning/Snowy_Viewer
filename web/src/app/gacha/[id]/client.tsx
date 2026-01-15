"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import { ICardInfo, GACHA_TYPE_LABELS, getRarityNumber, isTrainableCard } from "@/types/types";
import { getGachaLogoUrl, getGachaScreenUrl, getCardThumbnailUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

// API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://sekaiviewerapi.exmeaning.com";
const CARDS_DATA_URL = "https://sekaimaster.exmeaning.com/master/cards.json";

// Local attribute icon mapping
const LOCAL_ATTR_ICONS: Record<string, string> = {
    cool: "/data/icon/Cool.webp",
    cute: "/data/icon/cute.webp",
    happy: "/data/icon/Happy.webp",
    mysterious: "/data/icon/Mysterious.webp",
    pure: "/data/icon/Pure.webp",
};

// API Response type
interface GachaDetailResponse {
    id: number;
    gachaType: string;
    name: string;
    assetbundleName: string;
    startAt: number;
    endAt: number;
    gachaCardRarityRates: {
        id: number;
        gachaId: number;
        cardRarityType: string;
        rate: number;
    }[];
    pickupCardIds: number[];
}

interface GachaDetailClientProps {
    gachaId: string;
}

export default function GachaDetailClient({ gachaId }: GachaDetailClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isScreenshotMode = searchParams.get('mode') === 'screenshot';
    const [gacha, setGacha] = useState<GachaDetailResponse | null>(null);
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState<"logo" | "bg">("logo");
    const { isShowSpoiler, useTrainedThumbnail, assetSource } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);

                // Fetch gacha detail from our API and cards from master data
                const [gachaRes, cardsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/gachas/${gachaId}`),
                    fetch(CARDS_DATA_URL)
                ]);

                if (!gachaRes.ok) {
                    if (gachaRes.status === 404) {
                        throw new Error("Gacha not found");
                    }
                    throw new Error("Failed to fetch gacha data");
                }
                if (!cardsRes.ok) throw new Error("Failed to fetch cards data");

                const gachaData: GachaDetailResponse = await gachaRes.json();
                const cardsData: ICardInfo[] = await cardsRes.json();

                setGacha(gachaData);
                setCards(cardsData);
                document.title = `${gachaData.name} - Snowy SekaiViewer`;
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

    // Get pickup cards from the pickupCardIds
    const pickupCards = useMemo(() => {
        if (!gacha) return [];
        return gacha.pickupCardIds
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

    if (isLoading) {
        return (
            <MainLayout activeNav="扭蛋">
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
            <MainLayout activeNav="扭蛋">
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">扭蛋未找到</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
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

    return (
        <MainLayout activeNav="扭蛋">
            <div className="container mx-auto px-4 sm:px-6 py-8">
                {/* Breadcrumb */}
                <nav className="mb-6">
                    <ol className="flex items-center gap-2 text-sm">
                        <li>
                            <Link href="/gacha" className="text-slate-500 hover:text-miku transition-colors">
                                扭蛋
                            </Link>
                        </li>
                        <li className="text-slate-300">/</li>
                        <li className="text-slate-800 font-medium truncate max-w-[200px]">
                            {gacha.name}
                        </li>
                    </ol>
                </nav>

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
                        {gacha.name}
                    </h1>
                </div>

                {/* Main Content Grid - Images LEFT, Info RIGHT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-50 to-slate-100">
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
                                <InfoRow label="名称" value={gacha.name} />
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
                                            const rarityNum = getRarityNumber(card.cardRarityType);
                                            const attrIcon = LOCAL_ATTR_ICONS[card.attr] || LOCAL_ATTR_ICONS.cool;
                                            // Cards that only have trained images
                                            const TRAINED_ONLY_CARDS = [1167];
                                            const isTrainedOnlyCard = TRAINED_ONLY_CARDS.includes(card.id);
                                            const showTrained = isTrainedOnlyCard || (useTrainedThumbnail && isTrainableCard(card) && card.cardRarityType !== "rarity_birthday");

                                            return (
                                                <Link
                                                    key={card.id}
                                                    href={`/cards/${card.id}`}
                                                    className="group block"
                                                >
                                                    <div className="relative rounded-lg overflow-hidden bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all">
                                                        {/* Card Image */}
                                                        <div className="aspect-square w-full bg-slate-50 p-1 relative">
                                                            <div className="w-full h-full relative rounded overflow-hidden">
                                                                <Image
                                                                    src={getCardThumbnailUrl(card.characterId, card.assetbundleName, showTrained, assetSource)}
                                                                    alt={card.prefix}
                                                                    fill
                                                                    className="object-cover group-hover:scale-105 transition-transform"
                                                                    unoptimized
                                                                />
                                                            </div>

                                                            {/* Attribute Badge - Top Left */}
                                                            <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 drop-shadow-md z-10">
                                                                <Image
                                                                    src={attrIcon}
                                                                    alt={card.attr}
                                                                    fill
                                                                    className="object-contain"
                                                                    unoptimized
                                                                />
                                                            </div>

                                                            {/* Rarity Badge - Top Right */}
                                                            <div className="absolute top-0.5 right-0.5 z-10">
                                                                <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[12px]">
                                                                    {card.cardRarityType === "rarity_birthday" ? (
                                                                        <div className="w-2.5 h-2.5 relative">
                                                                            <Image
                                                                                src="/data/icon/birthday.webp"
                                                                                alt="Birthday"
                                                                                fill
                                                                                className="object-contain"
                                                                                unoptimized
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-white text-[7px] font-bold leading-none">{rarityNum}</span>
                                                                            <div className="w-2 h-2 relative">
                                                                                <Image
                                                                                    src="/data/icon/star.webp"
                                                                                    alt="Star"
                                                                                    fill
                                                                                    className="object-contain"
                                                                                    unoptimized
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
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
        </MainLayout>
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
