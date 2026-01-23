"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import BaseFilters, { FilterSection } from "@/components/common/BaseFilters";
import { useTheme } from "@/contexts/ThemeContext";
import { getMysekaiFixtureThumbnailUrl, getCharacterIconUrl } from "@/lib/assets";
import { CHARACTER_NAMES, UNIT_DATA } from "@/types/types";
import {
    IMysekaiFixtureInfo,
    IMysekaiFixtureGenre,
    IMysekaiFixtureSubGenre,
    IMysekaiFixtureTag
} from "@/types/mysekai";
import { fetchMasterData } from "@/lib/fetch";
import { TranslatedText } from "@/components/common/TranslatedText";
import { loadTranslations, TranslationData } from "@/lib/translations";

// Genre name translation map (Japanese -> Chinese)
const GENRE_NAME_MAP: Record<string, string> = {
    "すべて": "全部",
    "一般": "一般",
    "小物": "小物件",
    "壁掛け": "壁挂",
    "ディスプレイ": "展示",
    "キャンバス": "画布",
    "壁": "墙壁",
    "床": "地板",
    "ラグ": "地毯",
    "地面": "地面",
    "家": "房屋",
    "道": "道路",
    "柵": "围栏",
    "バーチャル・シンガー": "虚拟歌手",
    "Leo/need": "Leo/need",
    "MORE MORE JUMP！": "MORE MORE JUMP!",
    "Vivid BAD SQUAD": "Vivid BAD SQUAD",
    "ワンダーランズ×ショウタイム": "Wonderlands×Showtime",
    "25時、ナイトコードで。": "25时，在Night Code。",
    "キャラクター": "角色",
    "キズナ": "羁绊",
    "アチーブメント": "成就",
    "イベント": "活动",
    "オノ": "斧头",
    "ツルハシ": "镐子",
    "植物": "植物",
    "グッズ": "周边",
    "メンバー": "成员",
    "ぬいぐるみ": "玩偶",
    "その他": "其他",
    "カラータイル": "彩色瓷砖",
    "ブロック": "方块",
};

// Unit icon mapping
const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

// Helper function to get translated genre name
function getTranslatedGenreName(name: string): string {
    return GENRE_NAME_MAP[name] || name;
}

// Tag name translation map (Japanese -> Chinese)
const TAG_NAME_MAP: Record<string, string> = {
    // Basic
    "公園": "公园",
    "ガ一デン": "花园",
    "ナチュラル": "自然",
    "シンプルポップキッチン": "简约波普厨房",
    "クリーンパウダールーム": "整洁化妆室",
    "素朴な和室": "朴素和室",
    "キッズルーム": "儿童房",
    "カジュアル": "休闲",
    "キュート": "可爱",
    "フレンチスタイル": "法式风格",
    "トレーニングルーム": "训练室",
    "音楽スタジオ": "音乐工作室",
    "イベント会場": "活动会场",
    "ゲームセンター": "游戏中心",
    "ぽかぽかなピクニック": "暖洋洋的野餐",
    "天文学者の研究室": "天文学者的研究室",
    "作業テーブル": "工作桌",
    "チェスト": "柜子",
    "ひみつのおみせ": "秘密小店",
    "ヘンカンマシン": "转换机",
    "マイセカイ情報": "MySekai信息",
    "ミュージックプレイヤー": "音乐播放器",
    "アバタ一チェンジ": "虚拟形象更换",
    "グッズ": "周边",
    "きらめく流星ル一ム": "闪耀流星房间 (Ln)",
    "かがやくクローバールーム": "光辉四叶草房间 (MMJ)",
    "鮮やかなユニゾンルーム": "鲜艳齐奏房间 (VBS)",
    "はじけるクラウンルーム": "跃动小丑房间 (WxS)",
    "ひび割れたハートルーム": "破碎之心房间 (25ji)",
    "はじまりのメロディルーム": "起始旋律房间 (VS)",
    "旅人のキャンプ": "旅人的露营地",
    "照明": "照明",
    "グリーン": "绿植",
    "楽器": "乐器",
    "コラボ": "联动",
    "あんさんぶるスターズ！！コラボ": "偶像梦幻祭!!联动",
    "雷神祭": "雷神祭",
    "虹色アトリエルーム": "虹色画室",
    "リゾト": "度假村",
    "リゾート": "度假村",
    "ガレージ": "车库",
    "ドリーミィベビールーム": "梦幻婴儿房",
    "サイバーシティ": "赛博城市",
    "水色くじら": "水色鲸鱼",
    "ペルソナ５ ザ・ロイヤルタイアップ": "女神异闻录5 皇家版联动",
    "にっこりたい焼き屋さん": "微笑鲷鱼烧店",
    "もこもこおさんぽ": "毛茸茸散步",
    "たまごっちコラボ": "拓麻歌子联动",
    "セカイステ一ジ": "世界舞台",
    "ハロウィン": "万圣节",
    "ロマンティックガーデン": "浪漫花园",
    "ヴィンテージスタイル": "复古风格",
    "ほっこり温泉": "暖心温泉",
    "クリスマス": "圣诞节",
    "正月": "正月",
    "カラータイル": "彩色瓷砖",
    "スポーツ": "运动",

    // Legacy mapping just in case
    "机": "桌子",
    "椅子": "椅子",
    "ベッド": "床",
    "収納": "收纳",
    "装飾": "装饰",
    "壁": "墙壁",
    "床": "地板",
    "窓": "窗户",
    "ドア": "门",
    "家電": "家电",
    "植物": "植物",
    "雑貨": "杂货",
    "ぬいぐるみ": "玩偶",
    "その他": "其他",
    "ラグ": "地毯",
    "パーテーション": "隔断",
    "ソファ": "沙发",
    "テーブル": "桌子",
    "ポスター": "海报",
    "カーテン": "窗帘",
    "小物": "小物件",
    "壁紙": "壁纸",
    "ライト": "灯",
    "チェア": "椅子",
    "デスク": "书桌",
    "シェルフ": "架子",
    "キャビネット": "柜子",
    "ベンチ": "长椅",
    "フェンス": "围栏",
    "フラワー": "花",
    "プランター": "花盆",
    "スタンド": "支架/立牌",
    "ボックス": "盒子",
    "マット": "垫子",
    "キッチン": "厨房",
    "バス": "浴室",
    "トイレ": "厕所",
    "花壇": "花坛",
    "街灯": "路灯",
    "看板": "看板",
    "ポスト": "邮筒",
    "柵": "围栏",
    "道": "道路",
    "地面": "地面",
    "屋根": "屋顶",
    "外壁": "外墙",
};

function getTranslatedTagName(name: string): string {
    // Try exact match
    if (TAG_NAME_MAP[name]) return TAG_NAME_MAP[name];

    // Try to handle some common OCR errors or variations in the user provided list
    const cleanName = name.replace(/ー/g, '一').replace(/ベ/g, 'べ').replace(/ビ/g, 'び');
    if (TAG_NAME_MAP[cleanName]) return TAG_NAME_MAP[cleanName];

    // Try simple partial matches
    if (name.includes("テーブル") || name.includes("テ一ブル")) return name.replace(/テ[^ブル]*ブル/, "桌子");
    if (name.includes("チェア")) return name.replace("チェア", "椅子");
    if (name.includes("ソファ")) return name.replace("ソファ", "沙发");
    if (name.includes("ベッド")) return name.replace("ベッド", "床");
    if (name.includes("ライト")) return name.replace("ライト", "灯");
    if (name.includes("キッチン")) return name.replace("キッチン", "厨房");
    if (name.includes("ル—ム") || name.includes("ル一ム") || name.includes("ルーム")) {
        return name.replace(/ル[^ム]*ム/, "房间");
    }

    return name;
}

function MysekaiContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { assetSource } = useTheme();

    const [fixtures, setFixtures] = useState<IMysekaiFixtureInfo[]>([]);
    const [genres, setGenres] = useState<IMysekaiFixtureGenre[]>([]);
    const [subGenres, setSubGenres] = useState<IMysekaiFixtureSubGenre[]>([]);
    const [tags, setTags] = useState<IMysekaiFixtureTag[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [translations, setTranslations] = useState<TranslationData | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
    const [selectedSubGenre, setSelectedSubGenre] = useState<number | null>(null);
    const [selectedTag, setSelectedTag] = useState<number | null>(null);
    const [selectedCharacters, setSelectedCharacters] = useState<number[]>([]);
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

    // Sort states
    const [sortBy, setSortBy] = useState<string>("id");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Pagination
    const [displayCount, setDisplayCount] = useState(48);

    // Storage key
    const STORAGE_KEY = "mysekai_filters";

    // Initialize from URL params first, then fallback to sessionStorage
    useEffect(() => {
        const genre = searchParams.get("genre");
        const subGenre = searchParams.get("subGenre");
        const tag = searchParams.get("tag");
        const chars = searchParams.get("characters");
        const search = searchParams.get("search");
        const sort = searchParams.get("sortBy");
        const order = searchParams.get("sortOrder");

        // If URL has params, use them
        const hasUrlParams = genre || subGenre || tag || chars || search || sort || order;

        if (hasUrlParams) {
            if (genre) setSelectedGenre(Number(genre));
            if (subGenre) setSelectedSubGenre(Number(subGenre));
            if (tag) setSelectedTag(Number(tag));
            if (chars) setSelectedCharacters(chars.split(",").map(Number));
            if (search) setSearchQuery(search);
            if (sort) setSortBy(sort);
            if (order) setSortOrder(order as "asc" | "desc");
        } else {
            // Fallback to sessionStorage
            try {
                const saved = sessionStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const filters = JSON.parse(saved);
                    if (filters.genre !== undefined && filters.genre !== null) setSelectedGenre(filters.genre);
                    if (filters.subGenre !== undefined && filters.subGenre !== null) setSelectedSubGenre(filters.subGenre);
                    if (filters.tag !== undefined && filters.tag !== null) setSelectedTag(filters.tag);
                    if (filters.characters?.length) setSelectedCharacters(filters.characters);
                    if (filters.search) setSearchQuery(filters.search);
                    if (filters.sortBy) setSortBy(filters.sortBy);
                    if (filters.sortOrder) setSortOrder(filters.sortOrder);
                }
            } catch (e) {
                console.log("Could not restore filters from sessionStorage");
            }
        }
        setFiltersInitialized(true);
    }, []); // Only run once on mount

    // Save to sessionStorage and update URL when filters change
    useEffect(() => {
        if (!filtersInitialized) return;

        // Save to sessionStorage
        const filters = {
            genre: selectedGenre,
            subGenre: selectedSubGenre,
            tag: selectedTag,
            characters: selectedCharacters,
            search: searchQuery,
            sortBy,
            sortOrder,
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.log("Could not save filters to sessionStorage");
        }

        // Update URL
        const params = new URLSearchParams();
        if (selectedGenre !== null) params.set("genre", String(selectedGenre));
        if (selectedSubGenre !== null) params.set("subGenre", String(selectedSubGenre));
        if (selectedTag !== null) params.set("tag", String(selectedTag));
        if (selectedCharacters.length > 0) params.set("characters", selectedCharacters.join(","));
        if (searchQuery) params.set("search", searchQuery);
        if (sortBy !== "id") params.set("sortBy", sortBy);
        if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

        const queryString = params.toString();
        const newUrl = queryString ? `/mysekai?${queryString}` : "/mysekai";
        router.replace(newUrl, { scroll: false });
    }, [selectedGenre, selectedSubGenre, selectedTag, selectedCharacters, searchQuery, sortBy, sortOrder, router, filtersInitialized]);

    useEffect(() => {
        document.title = "Snowy SekaiViewer 家具图鉴";
        async function fetchData() {
            try {
                setIsLoading(true);

                const [fixturesData, genresData, subGenresData, tagsData, translationsData] = await Promise.all([
                    fetchMasterData<IMysekaiFixtureInfo[]>("mysekaiFixtures.json"),
                    fetchMasterData<IMysekaiFixtureGenre[]>("mysekaiFixtureMainGenres.json"),
                    fetchMasterData<IMysekaiFixtureSubGenre[]>("mysekaiFixtureSubGenres.json"),
                    fetchMasterData<IMysekaiFixtureTag[]>("mysekaiFixtureTags.json"),
                    loadTranslations(),
                ]);

                setFixtures(fixturesData);
                setGenres(genresData);
                setSubGenres(subGenresData);
                setTags(tagsData);
                setTranslations(translationsData);
                setError(null);
            } catch (err) {
                console.error("Error fetching mysekai data:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Separate tags by type and exclude tags matching fixture names
    const { characterTags, unitTags, generalTags } = useMemo(() => {
        const characterTags = tags.filter(t => t.mysekaiFixtureTagType === 'game_character');
        const unitTags = tags.filter(t => t.mysekaiFixtureTagType === 'unit');

        // Normalize string for comparison (remove all spaces)
        const normalize = (s: string) => s.replace(/\s+/g, '');

        // Get all fixture names for exclusion (normalized)
        const fixtureNamesNormalized = new Set(fixtures.map(f => normalize(f.name)));

        const generalTags = tags.filter(t =>
            t.mysekaiFixtureTagType !== 'game_character' &&
            t.mysekaiFixtureTagType !== 'unit' &&
            !fixtureNamesNormalized.has(normalize(t.name)) // Exclude tags matching fixture names (ignoring spaces)
        );
        return { characterTags, unitTags, generalTags };
    }, [tags, fixtures]);

    // Filter genres to only show those with fixtures
    const availableGenres = useMemo(() => {
        const genreIdsWithFixtures = new Set(fixtures.map(f => f.mysekaiFixtureMainGenreId));
        return genres.filter(g => genreIdsWithFixtures.has(g.id));
    }, [genres, fixtures]);

    // Filter and sort fixtures
    const filteredFixtures = useMemo(() => {
        let result = [...fixtures];

        // Search query (supports Japanese and Chinese names)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(f => {
                // Match by Japanese name
                if (f.name.toLowerCase().includes(query)) return true;
                // Match by Chinese name translation
                const chineseName = translations?.mysekai?.fixtureName?.[f.name];
                if (chineseName && chineseName.toLowerCase().includes(query)) return true;
                return false;
            });
        }

        // Genre filter
        if (selectedGenre !== null) {
            result = result.filter(f => f.mysekaiFixtureMainGenreId === selectedGenre);
        }

        // SubGenre filter
        if (selectedSubGenre !== null) {
            result = result.filter(f => f.mysekaiFixtureSubGenreId === selectedSubGenre);
        }

        // Tag filter (general tags only)
        if (selectedTag !== null) {
            result = result.filter(f => {
                return Object.entries(f.mysekaiFixtureTagGroup).some(([key, val]) =>
                    key !== 'id' && val === selectedTag
                );
            });
        }

        // Character filter - filter fixtures that have any of the selected character tags
        if (selectedCharacters.length > 0) {
            // Find tag IDs for selected characters
            const selectedCharacterTagIds = characterTags
                .filter(t => selectedCharacters.includes(t.externalId || 0))
                .map(t => t.id);

            result = result.filter(f => {
                return Object.entries(f.mysekaiFixtureTagGroup).some(([key, val]) =>
                    key !== 'id' && selectedCharacterTagIds.includes(val as number)
                );
            });
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === "id") {
                return sortOrder === "asc" ? a.id - b.id : b.id - a.id;
            }
            return 0;
        });

        return result;
    }, [fixtures, searchQuery, selectedGenre, selectedSubGenre, selectedTag, selectedCharacters, characterTags, sortBy, sortOrder, translations]);

    // Displayed fixtures
    const displayedFixtures = useMemo(() => {
        return filteredFixtures.slice(0, displayCount);
    }, [filteredFixtures, displayCount]);

    // Load more
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 48);
    }, []);

    // Helper to get genre name (translated)
    const getGenreName = (id: number) => {
        const genre = genres.find(g => g.id === id);
        return genre ? getTranslatedGenreName(genre.name) : "";
    };

    // Toggle character selection
    const toggleCharacter = (charId: number) => {
        if (selectedCharacters.includes(charId)) {
            setSelectedCharacters(selectedCharacters.filter(c => c !== charId));
        } else {
            setSelectedCharacters([...selectedCharacters, charId]);
        }
    };

    // Handle unit click - select/deselect all characters in the unit
    const handleUnitClick = (unitId: string) => {
        const unit = UNIT_DATA.find(u => u.id === unitId);
        if (!unit) return;

        if (selectedUnitIds.includes(unitId)) {
            setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
            const newChars = selectedCharacters.filter(c => !unit.charIds.includes(c));
            setSelectedCharacters(newChars);
        } else {
            setSelectedUnitIds([...selectedUnitIds, unitId]);
            const newChars = [...new Set([...selectedCharacters, ...unit.charIds])];
            setSelectedCharacters(newChars);
        }
    };

    // Reset all filters
    const handleReset = () => {
        setSearchQuery("");
        setSelectedGenre(null);
        setSelectedSubGenre(null);
        setSelectedTag(null);
        setSelectedCharacters([]);
        setSelectedUnitIds([]);
    };

    const hasActiveFilters = !!(searchQuery || selectedGenre || selectedSubGenre || selectedTag || selectedCharacters.length > 0);

    // Get current units for displaying characters
    const currentUnits = selectedUnitIds.length > 0
        ? UNIT_DATA.filter(u => selectedUnitIds.includes(u.id))
        : [];

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8">
            {/* Page Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                    <span className="text-miku text-xs font-bold tracking-widest uppercase">MySEKAI 图鉴</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                    家具 <span className="text-miku">列表</span>
                </h1>
                <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                    浏览 MySEKAI 中的所有家具
                </p>
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    <p className="font-bold">加载失败</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Filters - Side Panel */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="lg:sticky lg:top-24">
                        <BaseFilters
                            title="筛选家具"
                            filteredCount={filteredFixtures.length}
                            totalCount={fixtures.length}
                            countUnit="个"
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            sortOptions={[{ id: "id", label: "ID" }]}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSortChange={(field, order) => {
                                setSortBy(field);
                                setSortOrder(order);
                            }}
                            hasActiveFilters={hasActiveFilters}
                            onReset={handleReset}
                        >
                            {/* Unit Selection */}
                            <FilterSection label="团体">
                                <div className="flex flex-wrap gap-2">
                                    {UNIT_DATA.map(unit => {
                                        const iconName = UNIT_ICONS[unit.id] || "";
                                        return (
                                            <button
                                                key={unit.id}
                                                onClick={() => handleUnitClick(unit.id)}
                                                className={`p-1.5 rounded-xl transition-all ${selectedUnitIds.includes(unit.id)
                                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                                    : "hover:bg-slate-100 border border-transparent bg-slate-50"
                                                    }`}
                                                title={unit.name}
                                            >
                                                <div className="w-8 h-8 relative">
                                                    <Image
                                                        src={`/data/icon/${iconName}`}
                                                        alt={unit.name}
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

                            {/* Character Selection - Show when units are selected or characters are selected */}
                            {(currentUnits.length > 0 || selectedCharacters.length > 0) && (
                                <FilterSection label="角色">
                                    <div className="flex flex-wrap gap-2">
                                        {(currentUnits.length > 0
                                            ? currentUnits.flatMap(u => u.charIds)
                                            : [...new Set(selectedCharacters)]
                                        ).map(charId => (
                                            <button
                                                key={charId}
                                                onClick={() => toggleCharacter(charId)}
                                                className={`relative transition-all ${selectedCharacters.includes(charId)
                                                    ? "ring-2 ring-miku scale-110 z-10 rounded-full"
                                                    : "ring-2 ring-transparent hover:ring-slate-200 rounded-full opacity-80 hover:opacity-100"
                                                    }`}
                                                title={CHARACTER_NAMES[charId]}
                                            >
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                                                    <Image
                                                        src={getCharacterIconUrl(charId)}
                                                        alt={CHARACTER_NAMES[charId]}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </FilterSection>
                            )}

                            {/* Genre Filter */}
                            <FilterSection label="主类别">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedGenre || ""}
                                    onChange={(e) => {
                                        const val = e.target.value ? Number(e.target.value) : null;
                                        setSelectedGenre(val);
                                        // Reset subgenre if main genre changes
                                        if (val !== selectedSubGenre) setSelectedSubGenre(null);
                                    }}
                                >
                                    <option value="">全部</option>
                                    {availableGenres.map(g => (
                                        <option key={g.id} value={g.id}>{getTranslatedGenreName(g.name)}</option>
                                    ))}
                                </select>
                            </FilterSection>

                            {/* SubGenre Filter */}
                            {selectedGenre && (
                                <FilterSection label="子类别">
                                    <select
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                        value={selectedSubGenre || ""}
                                        onChange={(e) => setSelectedSubGenre(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">全部</option>
                                        {subGenres
                                            .filter(sg => sg.mysekaiFixtureMainGenreId === selectedGenre)
                                            .map(sg => (
                                                <option key={sg.id} value={sg.id}>{sg.name}</option>
                                            ))
                                        }
                                    </select>
                                </FilterSection>
                            )}

                            {/* General Tag Filter (excluding character and unit tags) */}
                            <FilterSection label="标签">
                                <select
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-miku/50"
                                    value={selectedTag || ""}
                                    onChange={(e) => setSelectedTag(e.target.value ? Number(e.target.value) : null)}
                                >
                                    <option value="">全部</option>
                                    {generalTags.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {getTranslatedTagName(t.name)} {getTranslatedTagName(t.name) !== t.name ? `(${t.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </FilterSection>

                            {/* Disclaimer */}
                            <div className="mt-4 text-[10px] text-slate-400 text-center px-2">
                                * 类别和标签使用LLM进行翻译 可能存在不准确现象
                            </div>

                        </BaseFilters>
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {displayedFixtures.map(fixture => (
                                    <Link
                                        href={`/mysekai/${fixture.id}`}
                                        key={fixture.id}
                                        className="bg-white rounded-xl shadow ring-1 ring-slate-200 overflow-hidden hover:ring-miku hover:shadow-lg transition-all p-3 flex flex-col h-full group"
                                    >
                                        <div className="relative aspect-square mb-2 bg-slate-50 rounded-lg overflow-hidden group-hover:bg-slate-100 transition-colors">
                                            <Image
                                                src={getMysekaiFixtureThumbnailUrl(fixture.assetbundleName, assetSource, fixture.mysekaiFixtureMainGenreId)}
                                                alt={fixture.name}
                                                fill
                                                className="object-contain p-2"
                                                unoptimized
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <h3 className="font-bold text-sm text-slate-800 mb-1 group-hover:text-miku transition-colors" title={fixture.name}>
                                                <TranslatedText
                                                    original={fixture.name}
                                                    category="mysekai"
                                                    field="fixtureName"
                                                    originalClassName="line-clamp-2 block"
                                                    translationClassName="text-xs font-medium text-slate-400 line-clamp-1 block"
                                                />
                                            </h3>
                                            <div className="mt-auto flex flex-wrap gap-1">
                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                                                    ID: {fixture.id}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 bg-miku/10 text-miku rounded font-medium">
                                                    {getGenreName(fixture.mysekaiFixtureMainGenreId)}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Load More */}
                            {displayedFixtures.length < filteredFixtures.length && (
                                <div className="mt-8 flex justify-center">
                                    <button
                                        onClick={loadMore}
                                        className="px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                    >
                                        加载更多
                                        <span className="ml-2 text-sm opacity-80">
                                            ({displayedFixtures.length} / {filteredFixtures.length})
                                        </span>
                                    </button>
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && filteredFixtures.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>没有找到匹配的家具</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MysekaiPage() {
    return (
        <MainLayout activeNav="家具">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载家具数据...</div>}>
                <MysekaiContent />
            </Suspense>
        </MainLayout>
    );
}
