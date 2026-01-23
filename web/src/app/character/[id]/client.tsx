"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    IGameChara,
    ICharaProfile,
    IUnitProfile,
    ICharaUnitInfo,
    ICardInfo,
    CHARACTER_NAMES,
    UNIT_DATA
} from "@/types/types";
import {
    getCharacterTrimUrl,
    getCharacterLabelHUrl,
    getCharacterLabelVUrl,
    getCardThumbnailUrl
} from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import ColorPreview from "@/components/helpers/ColorPreview";

// Map unit names from master data to our internal IDs for icons
const UNIT_ICONS: Record<string, string> = {
    "light_sound": "ln.webp",
    "idol": "mmj.webp",
    "street": "vbs.webp",
    "theme_park": "wxs.webp",
    "school_refusal": "n25.webp",
    "piapro": "vs.webp",
};

interface CharacterDetailClientProps {
    characterId: string;
}

export default function CharacterDetailClient({ characterId }: CharacterDetailClientProps) {
    const router = useRouter();
    const { assetSource } = useTheme();
    const id = parseInt(characterId, 10);

    // State
    const [character, setCharacter] = useState<IGameChara | null>(null);
    const [profile, setProfile] = useState<ICharaProfile | null>(null);
    const [unitInfo, setUnitInfo] = useState<ICharaUnitInfo | null>(null);
    const [unitProfile, setUnitProfile] = useState<IUnitProfile | null>(null);
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"trim" | "label_h" | "label_v">("trim");
    const [activeImageIdx, setActiveImageIdx] = useState(0);
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
                document.title = `Snowy SekaiViewer - ${CHARACTER_NAMES[id] || "角色详情"}`;

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

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-miku border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-500">正在加载角色信息...</span>
                </div>
            </div>
        );
    }

    if (!character) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold text-slate-800">未找到角色</h1>
                <Link href="/character" className="text-miku hover:underline mt-4 inline-block">
                    返回角色列表
                </Link>
            </div>
        );
    }

    // Determine unit icon
    const unitIconName = UNIT_ICONS[character.unit] || "vs.webp";

    // Prepare images for display/viewer
    const charaTrimImg = getCharacterTrimUrl(id, assetSource);
    const charaLabelHImg = getCharacterLabelHUrl(id, assetSource);
    const charaLabelVImg = getCharacterLabelVUrl(id, assetSource);

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                <Link href="/character" className="hover:text-miku transition-colors">角色图鉴</Link>
                <span>/</span>
                <span className="text-slate-800 font-bold">{CHARACTER_NAMES[id] || `${character.firstName} ${character.givenName}`}</span>
            </div>

            {/* Full Image Viewer Modal */}
            {imageViewerOpen && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
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
                        src={
                            activeTab === "trim" ? charaTrimImg :
                                activeTab === "label_h" ? charaLabelHImg : charaLabelVImg
                        }
                        alt="Character Full Image"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Character Image */}
                <div className="lg:col-span-5 xl:col-span-4">
                    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden sticky top-24">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => setActiveTab("trim")}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === "trim" ? "text-miku border-b-2 border-miku bg-miku/5" : "text-slate-500 hover:bg-slate-50"}`}
                            >
                                立绘
                            </button>
                            <button
                                onClick={() => setActiveTab("label_h")}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === "label_h" ? "text-miku border-b-2 border-miku bg-miku/5" : "text-slate-500 hover:bg-slate-50"}`}
                            >
                                横向名牌
                            </button>
                            <button
                                onClick={() => setActiveTab("label_v")}
                                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === "label_v" ? "text-miku border-b-2 border-miku bg-miku/5" : "text-slate-500 hover:bg-slate-50"}`}
                            >
                                竖向名牌
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
                            点击图片查看大图
                        </div>
                    </div>
                </div>

                {/* Right Column: Info & Profile */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-8">
                    {/* Basic Info */}
                    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="w-1 h-6 bg-miku rounded-full"></span>
                                基本信息
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                <InfoRow label="ID" value={character.id} />
                                <InfoRow
                                    label="姓名"
                                    value={
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-bold">{CHARACTER_NAMES[id] || `${character.firstName} ${character.givenName}`}</span>
                                            <span className="text-xs text-slate-500">{character.firstNameRuby} {character.givenNameRuby}</span>
                                        </div>
                                    }
                                />
                                <InfoRow label="性别" value={character.gender === "female" ? "女性" : character.gender === "male" ? "男性" : character.gender} />
                                <InfoRow
                                    label="所属团体"
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
                                            <span>{unitProfile?.unitName || character.unit}</span>
                                        </div>
                                    }
                                />
                                {unitInfo && (
                                    <>
                                        <InfoRow
                                            label="应援色"
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
                        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <span className="w-1 h-6 bg-miku rounded-full"></span>
                                    个人档案
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                    <InfoRow label="身高" value={profile.height} />
                                    <InfoRow label="生日" value={profile.birthday} />
                                    <InfoRow label="学校" value={profile.school} />
                                    <InfoRow label="年级" value={profile.schoolYear} />
                                    <InfoRow
                                        label="兴趣"
                                        value={
                                            <TranslatedText
                                                original={profile.hobby || "-"}
                                                category="characters"
                                                field="hobby"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label="特技"
                                        value={
                                            <TranslatedText
                                                original={profile.specialSkill || "-"}
                                                category="characters"
                                                field="specialSkill"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label="喜欢的食物"
                                        value={
                                            <TranslatedText
                                                original={profile.favoriteFood || "-"}
                                                category="characters"
                                                field="favoriteFood"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label="讨厌的食物"
                                        value={
                                            <TranslatedText
                                                original={profile.hatedFood || "-"}
                                                category="characters"
                                                field="hatedFood"
                                            />
                                        }
                                    />
                                    <InfoRow
                                        label="不擅长"
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
                                    <p className="text-sm font-bold text-slate-500 mb-2">自我介绍</p>
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
                    <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <span className="w-1 h-6 bg-miku rounded-full"></span>
                                相关卡牌
                            </h2>
                            <span className="text-sm text-slate-500 text-sm bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                共 {cards.length} 张
                            </span>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {cards.map((card) => (
                                    <Link
                                        key={card.id}
                                        href={`/cards/${card.id}`}
                                        className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200 hover:ring-2 hover:ring-miku transition-all hover:scale-105"
                                        title={card.prefix}
                                    >
                                        <Image
                                            src={getCardThumbnailUrl(card.characterId, card.assetbundleName, false, assetSource)}
                                            alt={card.prefix}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
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
