"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getCardThumbnailUrl, getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import { ICardInfo, IGameChara, UNIT_NAME_MAP } from "@/types/types";

interface ICardEpisode {
    id: number;
    cardId: number;
    cardEpisodePartType: string; // "episode_1" | "episode_2"
    title: string;
    scenarioId: string;
    releaseConditionId: number;
}

const RARITY_LABEL: Record<string, string> = {
    rarity_1: "R1", rarity_2: "R2", rarity_3: "R3", rarity_4: "R4", rarity_birthday: "生日",
};
const RARITY_COLOR: Record<string, string> = {
    rarity_1: "bg-slate-200 text-slate-600",
    rarity_2: "bg-blue-100 text-blue-600",
    rarity_3: "bg-purple-100 text-purple-600",
    rarity_4: "bg-amber-100 text-amber-600",
    rarity_birthday: "bg-pink-100 text-pink-600",
};

export default function StoryCardListClient() {
    const { assetSource, serverSource } = useTheme();
    const [cards, setCards] = useState<ICardInfo[]>([]);
    const [cardEpisodes, setCardEpisodes] = useState<ICardEpisode[]>([]);
    const [charas, setCharas] = useState<IGameChara[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCharaId, setSelectedCharaId] = useState<number | null>(null);
    const [displayCount, setDisplayCount] = useState(30);

    useEffect(() => {
        async function load() {
            try {
                const [cardsData, episodesData, charasData] = await Promise.all([
                    fetchMasterData<ICardInfo[]>("cards.json"),
                    fetchMasterData<ICardEpisode[]>("cardEpisodes.json"),
                    fetchMasterData<IGameChara[]>("gameCharacters.json"),
                ]);
                // Only cards that have episodes
                const episodeCardIds = new Set(episodesData.map(e => e.cardId));
                setCards(cardsData.filter(c => episodeCardIds.has(c.id)).reverse());
                setCardEpisodes(episodesData);
                setCharas(charasData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource]);

    const charaMap = useMemo(() => new Map(charas.map(c => [c.id, c])), [charas]);

    const filteredCards = useMemo(() => {
        let result = cards;
        if (selectedCharaId !== null) {
            result = result.filter(c => c.characterId === selectedCharaId);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => {
                const chara = charaMap.get(c.characterId);
                const name = chara ? `${chara.firstName ?? ""}${chara.givenName}` : "";
                return c.prefix.toLowerCase().includes(q) || name.toLowerCase().includes(q) || String(c.id).includes(q);
            });
        }
        return result;
    }, [cards, selectedCharaId, searchQuery, charaMap]);

    const displayedCards = filteredCards.slice(0, displayCount);

    // Group charas by unit for filter
    const unitCharas = useMemo(() => {
        const map = new Map<string, IGameChara[]>();
        for (const c of charas) {
            if (!map.has(c.unit)) map.set(c.unit, []);
            map.get(c.unit)!.push(c);
        }
        return map;
    }, [charas]);

    const unitOrder = ["light_sound", "idol", "street", "theme_park", "school_refusal", "piapro"];

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/story" className="text-slate-400 hover:text-miku transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-2xl font-black text-primary-text">卡牌剧情</h1>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 space-y-3">
                    <input
                        type="text"
                        placeholder="搜索卡名、角色名..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setDisplayCount(30); }}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-miku/30"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => { setSelectedCharaId(null); setDisplayCount(30); }}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedCharaId === null ? "bg-miku text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-miku/10"}`}
                        >
                            全部
                        </button>
                        {unitOrder.map(unit => {
                            const unitCharaList = unitCharas.get(unit) ?? [];
                            return unitCharaList.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setSelectedCharaId(c.id === selectedCharaId ? null : c.id); setDisplayCount(30); }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedCharaId === c.id ? "bg-miku text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-miku/10"}`}
                                >
                                    <img src={getCharacterIconUrl(c.id)} alt="" className="w-4 h-4 rounded-full" />
                                    {c.firstName ?? ""}{c.givenName}
                                </button>
                            ));
                        })}
                    </div>
                </div>

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <>
                        <p className="text-sm text-slate-500 mb-4">共 {filteredCards.length} 张卡牌</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {displayedCards.map(card => {
                                const chara = charaMap.get(card.characterId);
                                const charaName = chara ? `${chara.firstName ?? ""}${chara.givenName}` : `角色${card.characterId}`;
                                return (
                                    <Link
                                        key={card.id}
                                        href={`/story/card/${card.id}`}
                                        className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-md transition-all overflow-hidden"
                                    >
                                        <div className="relative aspect-[2/1] bg-slate-100 dark:bg-slate-700">
                                            <img
                                                src={getCardThumbnailUrl(card.characterId, card.assetbundleName, false, assetSource)}
                                                alt={card.prefix}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            <span className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${RARITY_COLOR[card.cardRarityType] ?? "bg-slate-200 text-slate-600"}`}>
                                                {RARITY_LABEL[card.cardRarityType] ?? card.cardRarityType}
                                            </span>
                                        </div>
                                        <div className="p-2">
                                            <p className="text-[11px] text-slate-400">{charaName}</p>
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-miku transition-colors line-clamp-2 leading-tight mt-0.5">
                                                {card.prefix}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                        {displayedCards.length < filteredCards.length && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={() => setDisplayCount(c => c + 30)}
                                    className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                >
                                    加载更多 ({displayedCards.length} / {filteredCards.length})
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
