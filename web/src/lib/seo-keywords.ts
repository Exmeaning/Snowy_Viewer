/**
 * Localized SEO constants and helpers for Moesekai.
 *
 * Keep SEO copy in this server-safe module instead of scattering hardcoded
 * metadata across routes. Adding a future locale such as ja-JP should be a
 * data-only change here plus the shared UI locale registry/messages.
 */

import { DEFAULT_UI_LOCALE, type UiLocale } from "@/lib/i18n/locales";
import { interpolateMessage, type MessageInterpolationValues } from "@/lib/i18n/format";

// ==================== Types ====================

export type SeoPageKey = keyof typeof SEO_PAGE_METADATA;
export type DetailSeoKind = keyof typeof DETAIL_SEO_TEMPLATES;
export type DetailFallbackKind = keyof typeof DETAIL_FALLBACK_TITLES;

interface SeoLocaleConfig {
  htmlLang: string;
  hreflang: string;
  openGraphLocale: string;
  alternateOpenGraphLocales: readonly string[];
  titleTemplate: string;
  suffix: string;
  detailSuffix: string;
  root: {
    title: string;
    description: string;
    keywords: readonly string[];
    jsonLdAlternateName: readonly string[];
    jsonLdDescription: string;
  };
}

type LocalizedText = Record<UiLocale, string>;
type LocalizedKeywords = Record<UiLocale, readonly string[]>;

type SeoPageDefinition = {
  readonly path: string;
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly keywords: LocalizedKeywords;
};

// ==================== Locale Strategy ====================

/**
 * SEO locale registry. When ja-JP is added to SUPPORTED_UI_LOCALES, TypeScript
 * will require adding the Japanese SEO copy here as well.
 */
export const SEO_LOCALE_CONFIG = {
  "zh-CN": {
    htmlLang: "zh-CN",
    hreflang: "zh-CN",
    openGraphLocale: "zh_CN",
    alternateOpenGraphLocales: ["en_US"],
    titleTemplate: "%s | Moesekai",
    suffix: " — 新一代PJSK WIKI",
    detailSuffix: " | PJSK WIKI",
    root: {
      title: "Moesekai - 新一代PJSK WIKI",
      description:
        "Moesekai（原 Snowy SekaiViewer）是新一代 PJSK WIKI 与 Project SEKAI 游戏数据查看器，提供卡牌、音乐、活动、扭蛋、剧情、MySekai 与实用工具。",
      keywords: [
        "新一代PJSK WIKI",
        "PJSK WIKI",
        "PJSK图鉴",
        "世界计划WIKI",
        "初音未来缤纷舞台WIKI",
        "Project Sekai",
        "世界计划",
        "プロジェクトセカイ",
        "Moesekai",
        "Snowy SekaiViewer",
      ],
      jsonLdAlternateName: ["Snowy SekaiViewer", "PJSK WIKI", "新一代PJSK WIKI"],
      jsonLdDescription:
        "新一代 PJSK WIKI 与 Project SEKAI 游戏数据查看器，提供卡牌、音乐、活动、扭蛋、剧情、MySekai 与实用工具。",
    },
  },
  "en-US": {
    htmlLang: "en-US",
    hreflang: "en-US",
    openGraphLocale: "en_US",
    alternateOpenGraphLocales: ["zh_CN"],
    titleTemplate: "%s | Moesekai",
    suffix: " — Next-generation PJSK Wiki",
    detailSuffix: " | PJSK Wiki",
    root: {
      title: "Moesekai - Next-generation PJSK Wiki",
      description:
        "Moesekai (formerly Snowy SekaiViewer) is a next-generation PJSK wiki and Project SEKAI data viewer for cards, songs, events, gachas, stories, MySekai, and fan tools.",
      keywords: [
        "Project Sekai wiki",
        "PJSK wiki",
        "Project SEKAI database",
        "Project Sekai cards",
        "Project Sekai songs",
        "Project Sekai events",
        "Hatsune Miku Colorful Stage wiki",
        "Moesekai",
        "Snowy SekaiViewer",
        "プロジェクトセカイ",
      ],
      jsonLdAlternateName: ["Snowy SekaiViewer", "PJSK Wiki", "Project SEKAI Database"],
      jsonLdDescription:
        "A next-generation PJSK wiki and Project SEKAI data viewer for cards, songs, events, gachas, stories, MySekai, and fan tools.",
    },
  },
} as const satisfies Record<UiLocale, SeoLocaleConfig>;

export function getSeoLocaleConfig(locale: UiLocale = DEFAULT_UI_LOCALE): SeoLocaleConfig {
  return SEO_LOCALE_CONFIG[locale] ?? SEO_LOCALE_CONFIG[DEFAULT_UI_LOCALE];
}

// ==================== Page Metadata ====================

const COMMON_BRAND_KEYWORDS = {
  "zh-CN": ["Project Sekai", "PJSK", "世界计划", "Moesekai"],
  "en-US": ["Project Sekai", "PJSK", "Moesekai", "Project SEKAI database"],
} as const satisfies LocalizedKeywords;

function withBrandKeywords(keywords: LocalizedKeywords): LocalizedKeywords {
  return {
    "zh-CN": [...new Set([...keywords["zh-CN"], ...COMMON_BRAND_KEYWORDS["zh-CN"]])],
    "en-US": [...new Set([...keywords["en-US"], ...COMMON_BRAND_KEYWORDS["en-US"]])],
  };
}

function definePage(path: string, title: LocalizedText, description: LocalizedText, keywords: LocalizedKeywords): SeoPageDefinition {
  return { path, title, description, keywords: withBrandKeywords(keywords) };
}

export const SEO_PAGE_METADATA = {
  about: definePage(
    "/about",
    { "zh-CN": "关于", "en-US": "About" },
    {
      "zh-CN": "了解 Moesekai（原 Snowy SekaiViewer）的站点定位、数据来源与致谢。",
      "en-US": "Learn about Moesekai (formerly Snowy SekaiViewer), its data sources, credits, and site mission.",
    },
    { "zh-CN": ["关于", "数据来源", "致谢"], "en-US": ["about Moesekai", "data sources", "credits"] },
  ),
  cards: definePage(
    "/cards",
    { "zh-CN": "卡牌图鉴", "en-US": "Card Encyclopedia" },
    {
      "zh-CN": "浏览 Project SEKAI 全部卡牌，按角色、稀有度、属性、技能与团体归属筛选。",
      "en-US": "Browse all Project Sekai cards with character, rarity, attribute, skill, and unit filters.",
    },
    { "zh-CN": ["卡牌", "卡牌图鉴", "卡牌数据库"], "en-US": ["cards", "card database", "card encyclopedia"] },
  ),
  music: definePage(
    "/music",
    { "zh-CN": "歌曲图鉴", "en-US": "Music Encyclopedia" },
    {
      "zh-CN": "浏览 Project SEKAI 歌曲列表，查看谱面难度、定数、作词作曲与 MV 信息。",
      "en-US": "Browse Project Sekai songs with chart difficulty, constants, lyricist, composer, and MV information.",
    },
    { "zh-CN": ["音乐", "歌曲图鉴", "谱面", "歌曲Meta"], "en-US": ["songs", "music", "chart difficulty", "song database"] },
  ),
  soundtrack: definePage(
    "/soundtrack",
    { "zh-CN": "游戏原声带", "en-US": "Soundtrack" },
    {
      "zh-CN": "收听与浏览 Project SEKAI 游戏原声带、背景音乐与相关音频资源。",
      "en-US": "Browse Project Sekai soundtrack, background music, and related in-game audio resources.",
    },
    { "zh-CN": ["游戏原声带", "背景音乐", "BGM", "OST"], "en-US": ["soundtrack", "BGM", "OST", "game audio"] },
  ),
  music_meta: definePage(
    "/music/meta",
    { "zh-CN": "歌曲 Meta", "en-US": "Music Meta" },
    {
      "zh-CN": "查看 Project SEKAI 歌曲效率、难度定数与活动周回相关 Meta 数据。",
      "en-US": "Explore Project Sekai song meta data for efficiency, chart constants, and event play planning.",
    },
    { "zh-CN": ["歌曲Meta", "效率排行", "定数", "周回"], "en-US": ["music meta", "efficiency ranking", "chart constants"] },
  ),
  events: definePage(
    "/events",
    { "zh-CN": "活动图鉴", "en-US": "Event Encyclopedia" },
    {
      "zh-CN": "浏览 Project SEKAI 活动列表，查看活动详情、加成角色、活动歌曲与排名数据。",
      "en-US": "Browse Project Sekai events with event details, bonus characters, event songs, and ranking data.",
    },
    { "zh-CN": ["活动", "活动图鉴", "活动排名"], "en-US": ["events", "event database", "event rankings"] },
  ),
  gacha: definePage(
    "/gacha",
    { "zh-CN": "扭蛋数据库", "en-US": "Gacha Database" },
    {
      "zh-CN": "浏览 Project SEKAI 扭蛋卡池，查看卡池时间、PU 卡牌与概率信息。",
      "en-US": "Browse Project Sekai gacha banners with schedules, pickup cards, and rate information.",
    },
    { "zh-CN": ["扭蛋", "卡池", "Gacha", "PU卡牌"], "en-US": ["gacha", "banners", "pickup cards", "rates"] },
  ),
  character: definePage(
    "/character",
    { "zh-CN": "角色图鉴", "en-US": "Character Encyclopedia" },
    {
      "zh-CN": "浏览 Project SEKAI 角色资料、组合信息、生日与角色详情。",
      "en-US": "Browse Project Sekai character profiles, units, birthdays, and detailed character information.",
    },
    { "zh-CN": ["角色", "角色图鉴", "组合", "生日"], "en-US": ["characters", "character profiles", "units", "birthdays"] },
  ),
  comic: definePage(
    "/comic",
    { "zh-CN": "一格漫画", "en-US": "Comic Database" },
    {
      "zh-CN": "浏览 Project SEKAI 官方一格漫画与翻译。",
      "en-US": "Browse Project Sekai official one-panel comics and translations.",
    },
    { "zh-CN": ["漫画", "一格漫画", "官方漫画"], "en-US": ["comic", "one-panel comics", "official comics"] },
  ),
  costumes: definePage(
    "/costumes",
    { "zh-CN": "服装图鉴", "en-US": "Costumes" },
    {
      "zh-CN": "浏览 Project SEKAI 服装图鉴，按角色、获取来源与服装信息筛选。",
      "en-US": "Browse Project SEKAI costumes with character, source, and costume detail filters.",
    },
    { "zh-CN": ["服装", "服装图鉴", "衣装"], "en-US": ["costumes", "outfits", "costume database"] },
  ),
  exchanges: definePage(
    "/exchanges",
    { "zh-CN": "兑换所", "en-US": "Exchange Shop" },
    {
      "zh-CN": "浏览 Project SEKAI 兑换所与兑换条目，查看奖励、消耗与开放时间。",
      "en-US": "Browse Project Sekai exchange shops and entries with rewards, costs, and availability.",
    },
    { "zh-CN": ["兑换所", "兑换奖励", "交换所"], "en-US": ["exchange shop", "exchange rewards", "shop entries"] },
  ),
  manga: definePage(
    "/manga",
    { "zh-CN": "官方四格漫画", "en-US": "Official 4-Koma" },
    {
      "zh-CN": "浏览 Project SEKAI 官方四格漫画与章节。",
      "en-US": "Browse Project Sekai official four-panel comics and episodes.",
    },
    { "zh-CN": ["四格漫画", "官方四格", "漫画"], "en-US": ["4-koma", "four-panel comics", "official manga"] },
  ),
  materials: definePage(
    "/materials",
    { "zh-CN": "素材数据库", "en-US": "Materials Database" },
    {
      "zh-CN": "浏览 Project SEKAI 素材、持有物与 MySekai 材料数据。",
      "en-US": "Browse Project Sekai materials, items, and MySekai resource data.",
    },
    { "zh-CN": ["持有物", "素材", "材料", "MySekai材料"], "en-US": ["materials", "items", "resources", "MySekai materials"] },
  ),
  honors: definePage(
    "/honors",
    { "zh-CN": "称号成就", "en-US": "Honor Achievements" },
    {
      "zh-CN": "浏览 Project SEKAI 称号、成就与羁绊称号信息。",
      "en-US": "Browse Project Sekai honors, achievements, and bonds honor information.",
    },
    { "zh-CN": ["称号", "成就", "羁绊称号"], "en-US": ["honors", "achievements", "bonds honors"] },
  ),
  live: definePage(
    "/live",
    { "zh-CN": "虚拟 Live 数据库", "en-US": "Virtual Live Database" },
    {
      "zh-CN": "浏览 Project SEKAI 虚拟 Live、演唱会时间与奖励信息。",
      "en-US": "Browse Project Sekai virtual live schedules, live details, and rewards.",
    },
    { "zh-CN": ["演唱会", "虚拟Live", "Virtual Live"], "en-US": ["virtual live", "live schedule", "concerts"] },
  ),
  sticker: definePage(
    "/sticker",
    { "zh-CN": "贴纸表情", "en-US": "Sticker Database" },
    {
      "zh-CN": "浏览 Project SEKAI 贴纸、表情与角色贴图资源。",
      "en-US": "Browse Project Sekai stickers, emotes, and character stamp assets.",
    },
    { "zh-CN": ["贴纸", "表情", "Stamp"], "en-US": ["stickers", "emotes", "stamps"] },
  ),
  mysekai: definePage(
    "/mysekai",
    { "zh-CN": "MySekai 家具数据库", "en-US": "Furniture Database" },
    {
      "zh-CN": "浏览 Project SEKAI MySekai 家具、摆件、素材与风味文本。",
      "en-US": "Browse the Project SEKAI MySEKAI furniture database with fixtures, materials, and flavor text.",
    },
    { "zh-CN": ["家具", "MySekai", "摆件", "MySekai材料"], "en-US": ["MySekai", "furniture", "fixtures", "housing"] },
  ),
  prediction: definePage(
    "/prediction",
    { "zh-CN": "活动预测", "en-US": "Event Prediction" },
    {
      "zh-CN": "查看 Project SEKAI 活动预测、排名走势与数据分析工具。",
      "en-US": "View Project Sekai event predictions, ranking trends, and data analysis tools.",
    },
    { "zh-CN": ["活动预测", "排名预测", "预测线"], "en-US": ["event prediction", "ranking prediction", "forecast"] },
  ),
  deck_recommend: definePage(
    "/deck-recommend",
    { "zh-CN": "组卡推荐", "en-US": "Deck Recommender" },
    {
      "zh-CN": "使用 Project SEKAI 组卡推荐工具自动计算活动收益、分数与最优卡组。",
      "en-US": "Use the Project Sekai deck recommender to calculate event bonus, score, and optimal decks.",
    },
    { "zh-CN": ["组卡推荐", "卡组推荐", "最优卡组"], "en-US": ["deck recommender", "deck builder", "optimal deck"] },
  ),
  deck_comparator: definePage(
    "/deck-comparator",
    { "zh-CN": "组卡比较", "en-US": "Deck Comparator" },
    {
      "zh-CN": "比较 Project SEKAI 多人 Live 的 PT、分数与不同卡组收益。",
      "en-US": "Compare Project Sekai multi-live PT, score outcomes, and deck performance.",
    },
    { "zh-CN": ["组卡比较", "卡组比较", "收益比较"], "en-US": ["deck comparator", "deck comparison", "multi-live score"] },
  ),
  chart_preview: definePage(
    "/chart-preview",
    { "zh-CN": "谱面预览", "en-US": "Chart Previewer" },
    {
      "zh-CN": "使用 MikuMikuWorld 风格 3D 谱面预览器查看歌曲谱面或自定义 SUS/BGM URL。",
      "en-US": "Preview Project Sekai charts in a MikuMikuWorld-style 3D viewer with song selection or custom SUS/BGM URLs.",
    },
    { "zh-CN": ["谱面预览", "3D谱面", "SUS", "MikuMikuWorld"], "en-US": ["chart preview", "3D chart", "SUS", "MikuMikuWorld"] },
  ),
  mysekai_preview: definePage(
    "/mysekai-preview",
    { "zh-CN": "烤森百景", "en-US": "MySekai Housing Competition" },
    {
      "zh-CN": "浏览 Project SEKAI MySekai 家具大赛作品、排行榜缩略图与 3D 预览。",
      "en-US": "Browse top Project Sekai MySekai housing competition entries, thumbnails, rankings, and 3D previews.",
    },
    { "zh-CN": ["烤森百景", "百景排行", "MySekai活动", "3D预览"], "en-US": ["MySekai", "housing competition", "top entries", "3D preview"] },
  ),
  mysekai_preview_ranking: definePage(
    "/mysekai-preview/ranking",
    { "zh-CN": "MySekai 排名作品预览", "en-US": "MySekai Housing Entry Preview" },
    {
      "zh-CN": "预览 Project SEKAI MySekai 家具大赛排名作品的 3D 房间布局。",
      "en-US": "View a 3D layout preview for a ranked Project Sekai MySekai housing competition entry.",
    },
    { "zh-CN": ["MySekai", "百景排行", "排名作品", "3D预览"], "en-US": ["MySekai", "ranked entry", "housing competition", "3D preview"] },
  ),
  mysekai_preview_scene: definePage(
    "/mysekai-preview/scene",
    { "zh-CN": "MySekai 3D 预览器", "en-US": "MySekai 3D Previewer" },
    {
      "zh-CN": "通过日服/国服 UID、本地 JSON 文件或公开 JSON URL 预览 MySekai 房间布局。",
      "en-US": "Preview MySekai room layouts by JP / CN UID, local JSON files, or public JSON URLs.",
    },
    { "zh-CN": ["MySekai", "UID", "房间布局", "JSON", "3D"], "en-US": ["MySekai", "UID", "layout JSON", "scene preview", "3D"] },
  ),
  my_cards: definePage(
    "/my-cards",
    { "zh-CN": "卡牌进度", "en-US": "Card Progress" },
    {
      "zh-CN": "追踪你的 Project SEKAI 卡牌收集进度、练度与账号卡牌数据。",
      "en-US": "Track your Project Sekai card collection progress, training status, and account card data.",
    },
    { "zh-CN": ["卡牌进度", "卡牌收集", "账号管理"], "en-US": ["card progress", "card collection", "account cards"] },
  ),
  my_musics: definePage(
    "/my-musics",
    { "zh-CN": "歌曲进度", "en-US": "Music Progress" },
    {
      "zh-CN": "追踪你的 Project SEKAI 歌曲游玩、Clear、Full Combo 与 AP 进度。",
      "en-US": "Track your Project Sekai song play progress, clears, full combos, and AP status.",
    },
    { "zh-CN": ["歌曲进度", "歌曲游玩", "FC", "AP"], "en-US": ["music progress", "song clears", "full combo", "AP"] },
  ),
  my_materials: definePage(
    "/my-materials",
    { "zh-CN": "资源库存", "en-US": "Resource Inventory" },
    {
      "zh-CN": "查询你的 Project SEKAI 资源、材料库存与账号素材数据。",
      "en-US": "Check your Project Sekai resources, material inventory, and account item data.",
    },
    { "zh-CN": ["资源查询", "材料库存", "账号资源"], "en-US": ["resource inventory", "materials", "account resources"] },
  ),
  profile: definePage(
    "/profile",
    { "zh-CN": "个人主页", "en-US": "My Profile" },
    {
      "zh-CN": "管理 Moesekai 个人主页、绑定账号、公开 API 与 OAuth2 授权数据。",
      "en-US": "Manage your Moesekai profile, connected accounts, Public API data, and OAuth2 bindings.",
    },
    { "zh-CN": ["个人主页", "账号管理", "OAuth2"], "en-US": ["profile", "account management", "OAuth2"] },
  ),
  score_control: definePage(
    "/score-control",
    { "zh-CN": "控分计算器", "en-US": "Score Control Calculator" },
    {
      "zh-CN": "使用 Project SEKAI 控分计算器规划挂机、放置与目标分数路线。",
      "en-US": "Use the Project Sekai score control calculator to plan AFK routes and target score outcomes.",
    },
    { "zh-CN": ["控分计算", "挂机", "分数路线"], "en-US": ["score control", "AFK routes", "score calculator"] },
  ),
  sticker_maker: definePage(
    "/sticker-maker",
    { "zh-CN": "表情包制作", "en-US": "Sticker Maker" },
    {
      "zh-CN": "制作 Project SEKAI 风格自定义贴纸、表情包与角色图片。",
      "en-US": "Create Project Sekai-style custom sticker images, emotes, and character stamps.",
    },
    { "zh-CN": ["表情包制作", "贴纸制作", "自定义贴纸"], "en-US": ["sticker maker", "custom stickers", "emote maker"] },
  ),
  realtime_ranking: definePage(
    "/realtime-ranking",
    { "zh-CN": "实时排行榜", "en-US": "Live Ranking" },
    {
      "zh-CN": "查看 Project SEKAI 实时排名，支持 CN / JP / TW / KR / EN 区服切换与分数变化提示。",
      "en-US": "View Project SEKAI live ranking with CN / JP / TW / KR / EN region switching and score change hints.",
    },
    { "zh-CN": ["实时排行榜", "排名查询", "分数变化"], "en-US": ["live ranking", "real-time ranking", "score changes"] },
  ),
  guess_jacket: definePage(
    "/guess-jacket",
    { "zh-CN": "猜曲绘", "en-US": "Guess Jacket" },
    {
      "zh-CN": "游玩 Project SEKAI 猜曲绘小游戏，根据歌曲封面猜出对应乐曲。",
      "en-US": "Play a Project Sekai music jacket guessing game and identify songs by their cover art.",
    },
    { "zh-CN": ["猜曲绘", "歌曲封面", "小游戏"], "en-US": ["guess jacket", "music cover", "guessing game"] },
  ),
  guess_jacket_multiplayer: definePage(
    "/guess-jacket/multiplayer",
    { "zh-CN": "猜曲绘联机", "en-US": "Guess Jacket Multiplayer" },
    {
      "zh-CN": "和朋友联机游玩 Project SEKAI 猜曲绘对战。",
      "en-US": "Play Project Sekai music jacket guessing multiplayer battles with friends.",
    },
    { "zh-CN": ["猜曲绘联机", "多人对战", "歌曲封面"], "en-US": ["guess jacket multiplayer", "multiplayer battle", "music cover"] },
  ),
  guess_who: definePage(
    "/guess-who",
    { "zh-CN": "猜角色", "en-US": "Guess Who" },
    {
      "zh-CN": "游玩 Project SEKAI 猜角色小游戏，根据线索猜出角色。",
      "en-US": "Play a Project Sekai character guessing game and identify characters from clues.",
    },
    { "zh-CN": ["猜角色", "角色竞猜", "小游戏"], "en-US": ["guess who", "character guessing", "guessing game"] },
  ),
  guess_who_multiplayer: definePage(
    "/guess-who/multiplayer",
    { "zh-CN": "猜角色联机", "en-US": "Guess Who Multiplayer" },
    {
      "zh-CN": "和朋友联机游玩 Project SEKAI 猜角色对战。",
      "en-US": "Play Project Sekai character guessing multiplayer battles with friends.",
    },
    { "zh-CN": ["猜角色联机", "多人对战", "角色竞猜"], "en-US": ["guess who multiplayer", "multiplayer battle", "character guessing"] },
  ),
  goods_gacha: definePage(
    "/goods-gacha",
    { "zh-CN": "谷子盲抽", "en-US": "Goods Gacha Simulator" },
    {
      "zh-CN": "使用 Project SEKAI 谷子盲抽模拟器规划周边抽取体验。",
      "en-US": "Use a Project Sekai goods gacha simulator for fan merchandise pull planning.",
    },
    { "zh-CN": ["谷子盲抽", "周边", "抽卡模拟"], "en-US": ["goods gacha", "merchandise", "pull simulator"] },
  ),
  story: definePage(
    "/story",
    { "zh-CN": "剧情浏览", "en-US": "Story Browser" },
    {
      "zh-CN": "浏览 Project SEKAI 主线、活动、卡牌、区域、自我介绍与特殊剧情。",
      "en-US": "Browse Project Sekai main, event, card, area, character introduction, and special stories.",
    },
    { "zh-CN": ["剧情", "故事", "剧情翻译"], "en-US": ["stories", "story reader", "translations"] },
  ),
  story_unit: definePage(
    "/story/unit",
    { "zh-CN": "主线剧情", "en-US": "Main Stories" },
    {
      "zh-CN": "浏览 Project SEKAI 主线剧情与组合剧情章节。",
      "en-US": "Browse Project Sekai main story and unit story episodes.",
    },
    { "zh-CN": ["主线剧情", "组合剧情", "Main Story"], "en-US": ["main story", "unit stories", "story episodes"] },
  ),
  story_event: definePage(
    "/story/event",
    { "zh-CN": "活动剧情", "en-US": "Event Stories" },
    {
      "zh-CN": "浏览 Project SEKAI 活动剧情、章节与剧情翻译。",
      "en-US": "Browse Project Sekai event stories, episodes, and story translations.",
    },
    { "zh-CN": ["活动剧情", "Event Story", "剧情翻译"], "en-US": ["event story", "story translations", "episodes"] },
  ),
  story_card: definePage(
    "/story/card",
    { "zh-CN": "卡牌剧情", "en-US": "Card Stories" },
    {
      "zh-CN": "浏览 Project SEKAI 卡牌剧情前篇、后篇与翻译。",
      "en-US": "Browse Project Sekai card stories, side story parts, and translations.",
    },
    { "zh-CN": ["卡牌剧情", "Card Story", "前后篇"], "en-US": ["card story", "side story", "story parts"] },
  ),
  story_area: definePage(
    "/story/area",
    { "zh-CN": "区域对话", "en-US": "Area Conversations" },
    {
      "zh-CN": "浏览 Project SEKAI 区域对话、场景对话与 Area Talk。",
      "en-US": "Browse Project Sekai area conversations, scenario talks, and Area Talk entries.",
    },
    { "zh-CN": ["区域对话", "Area Conversation", "Area Talk"], "en-US": ["area conversations", "Area Talk", "scenario talks"] },
  ),
  story_self: definePage(
    "/story/self",
    { "zh-CN": "自我介绍", "en-US": "Character Introductions" },
    {
      "zh-CN": "浏览 Project SEKAI 角色自我介绍、角色介绍与语音剧情。",
      "en-US": "Browse Project Sekai character introductions, self introductions, and voiced story entries.",
    },
    { "zh-CN": ["自我介绍", "角色介绍", "Character Introduction"], "en-US": ["character introductions", "self introductions", "voiced stories"] },
  ),
  story_special: definePage(
    "/story/special",
    { "zh-CN": "特殊剧情", "en-US": "Special Stories" },
    {
      "zh-CN": "浏览 Project SEKAI 特殊剧情、周年剧情与限定故事。",
      "en-US": "Browse Project Sekai special stories, anniversary stories, and limited story entries.",
    },
    { "zh-CN": ["特殊剧情", "Special Story", "周年剧情"], "en-US": ["special story", "anniversary story", "limited stories"] },
  ),
  guides: definePage(
    "/guides",
    { "zh-CN": "社区攻略", "en-US": "Guides" },
    {
      "zh-CN": "浏览 PROJECT SEKAI 社区攻略、教程与实用指南集合。",
      "en-US": "Browse PROJECT SEKAI community guides, tutorials, and helpful reference articles.",
    },
    { "zh-CN": ["攻略", "社区攻略", "Guide"], "en-US": ["guides", "community guides", "tutorials"] },
  ),
  patreon: definePage(
    "/patreon",
    { "zh-CN": "支持我们", "en-US": "Support Us" },
    {
      "zh-CN": "支持 Moesekai 的持续维护、数据更新与社区工具开发。",
      "en-US": "Support ongoing Moesekai maintenance, data updates, and community tool development.",
    },
    { "zh-CN": ["支持我们", "赞助", "Patreon"], "en-US": ["support Moesekai", "Patreon", "sponsor"] },
  ),
  privacy: definePage(
    "/privacy",
    { "zh-CN": "隐私政策", "en-US": "Privacy Policy" },
    {
      "zh-CN": "阅读 Moesekai 隐私政策，了解本地存储、Cookie、广告与第三方服务说明。",
      "en-US": "Read the Moesekai privacy policy covering local storage, cookies, ads, and third-party services.",
    },
    { "zh-CN": ["隐私政策", "Cookie", "广告"], "en-US": ["privacy policy", "cookies", "ads"] },
  ),
  terms: definePage(
    "/terms",
    { "zh-CN": "服务条款", "en-US": "Terms of Service" },
    {
      "zh-CN": "阅读 Moesekai 服务条款，了解站点性质、用户行为、免责声明与开源协议。",
      "en-US": "Read the Moesekai terms of service covering site scope, user behavior, disclaimers, and open-source licenses.",
    },
    { "zh-CN": ["服务条款", "免责声明", "开源协议"], "en-US": ["terms of service", "disclaimer", "open source"] },
  ),
  breadcrumb_activity: definePage(
    "/breadcrumb-activity",
    { "zh-CN": "活动", "en-US": "Activity" },
    {
      "zh-CN": "Moesekai 活动相关页面入口。",
      "en-US": "Moesekai activity-related page shortcuts.",
    },
    { "zh-CN": ["活动入口", "活动工具"], "en-US": ["activity shortcuts", "activity tools"] },
  ),
  breadcrumb_community: definePage(
    "/breadcrumb-community",
    { "zh-CN": "社区", "en-US": "Community" },
    {
      "zh-CN": "Moesekai 社区相关页面入口。",
      "en-US": "Moesekai community-related page shortcuts.",
    },
    { "zh-CN": ["社区入口", "攻略"], "en-US": ["community shortcuts", "guides"] },
  ),
  breadcrumb_database: definePage(
    "/breadcrumb-database",
    { "zh-CN": "数据库", "en-US": "Database" },
    {
      "zh-CN": "Moesekai 数据库页面入口。",
      "en-US": "Moesekai database page shortcuts.",
    },
    { "zh-CN": ["数据库入口", "图鉴"], "en-US": ["database shortcuts", "encyclopedia"] },
  ),
  breadcrumb_personal: definePage(
    "/breadcrumb-personal",
    { "zh-CN": "个人", "en-US": "Personal" },
    {
      "zh-CN": "Moesekai 个人数据与账号相关页面入口。",
      "en-US": "Moesekai personal data and account page shortcuts.",
    },
    { "zh-CN": ["个人入口", "账号"], "en-US": ["personal shortcuts", "account"] },
  ),
  breadcrumb_story: definePage(
    "/breadcrumb-story",
    { "zh-CN": "剧情", "en-US": "Story" },
    {
      "zh-CN": "Moesekai 剧情相关页面入口。",
      "en-US": "Moesekai story-related page shortcuts.",
    },
    { "zh-CN": ["剧情入口", "故事"], "en-US": ["story shortcuts", "stories"] },
  ),
  breadcrumb_tools: definePage(
    "/breadcrumb-tools",
    { "zh-CN": "工具", "en-US": "Tools" },
    {
      "zh-CN": "Moesekai 实用工具页面入口。",
      "en-US": "Moesekai utility tool page shortcuts.",
    },
    { "zh-CN": ["工具入口", "实用工具"], "en-US": ["tool shortcuts", "utilities"] },
  ),
  blank: definePage(
    "/blank",
    { "zh-CN": "空白素材页", "en-US": "Blank Asset Page" },
    {
      "zh-CN": "Moesekai 空白素材展示页。",
      "en-US": "A blank Moesekai asset display page.",
    },
    { "zh-CN": ["空白页", "素材页"], "en-US": ["blank page", "asset page"] },
  ),
  guides_detail: definePage(
    "/guides",
    { "zh-CN": "攻略详情", "en-US": "Guide Details" },
    {
      "zh-CN": "阅读 PROJECT SEKAI 社区攻略详情。",
      "en-US": "Read detailed PROJECT SEKAI community guide content.",
    },
    { "zh-CN": ["攻略详情", "社区攻略"], "en-US": ["guide details", "community guides"] },
  ),
  oauth2_connect: definePage(
    "/oauth2/connect",
    { "zh-CN": "OAuth2 绑定", "en-US": "OAuth2 Connect" },
    {
      "zh-CN": "通过 OAuth2 将 Haruki 账号与 Moesekai 绑定。",
      "en-US": "Connect a Haruki account to Moesekai through OAuth2.",
    },
    { "zh-CN": ["OAuth2绑定", "账号绑定"], "en-US": ["OAuth2 connect", "account binding"] },
  ),
  oauth2_callback: definePage(
    "/oauth2/callback/code",
    { "zh-CN": "OAuth2 回调", "en-US": "OAuth2 Callback" },
    {
      "zh-CN": "处理 Moesekai OAuth2 授权回调。",
      "en-US": "Handle the Moesekai OAuth2 authorization callback.",
    },
    { "zh-CN": ["OAuth2回调", "授权回调"], "en-US": ["OAuth2 callback", "authorization callback"] },
  ),
  story_area_category: definePage(
    "/story/area",
    { "zh-CN": "区域对话", "en-US": "Area Conversations" },
    {
      "zh-CN": "浏览指定分类下的 Project SEKAI 区域对话。",
      "en-US": "Browse Project Sekai area conversations in a selected category.",
    },
    { "zh-CN": ["区域对话", "Area Talk"], "en-US": ["area conversations", "Area Talk"] },
  ),
  story_area_reader: definePage(
    "/story/area",
    { "zh-CN": "区域对话阅读", "en-US": "Area Conversation Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 区域对话内容。",
      "en-US": "Read Project Sekai area conversation content.",
    },
    { "zh-CN": ["区域对话阅读", "Area Talk"], "en-US": ["area conversation reader", "Area Talk"] },
  ),
  story_card_reader: definePage(
    "/story/card",
    { "zh-CN": "卡牌剧情阅读", "en-US": "Card Story Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 卡牌剧情内容。",
      "en-US": "Read Project Sekai card story content.",
    },
    { "zh-CN": ["卡牌剧情阅读", "Card Story"], "en-US": ["card story reader", "Card Story"] },
  ),
  story_event_group: definePage(
    "/story/event",
    { "zh-CN": "活动剧情", "en-US": "Event Story" },
    {
      "zh-CN": "浏览指定 Project SEKAI 活动的剧情章节。",
      "en-US": "Browse story episodes for a selected Project Sekai event.",
    },
    { "zh-CN": ["活动剧情", "剧情章节"], "en-US": ["event story", "story episodes"] },
  ),
  story_event_reader: definePage(
    "/story/event",
    { "zh-CN": "活动剧情阅读", "en-US": "Event Story Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 活动剧情内容。",
      "en-US": "Read Project Sekai event story content.",
    },
    { "zh-CN": ["活动剧情阅读", "Event Story"], "en-US": ["event story reader", "Event Story"] },
  ),
  story_self_reader: definePage(
    "/story/self",
    { "zh-CN": "角色介绍阅读", "en-US": "Character Introduction Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 角色自我介绍内容。",
      "en-US": "Read Project Sekai character introduction content.",
    },
    { "zh-CN": ["角色介绍阅读", "自我介绍"], "en-US": ["character introduction reader", "self introduction"] },
  ),
  story_special_reader: definePage(
    "/story/special",
    { "zh-CN": "特殊剧情阅读", "en-US": "Special Story Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 特殊剧情内容。",
      "en-US": "Read Project Sekai special story content.",
    },
    { "zh-CN": ["特殊剧情阅读", "Special Story"], "en-US": ["special story reader", "Special Story"] },
  ),
  story_unit_group: definePage(
    "/story/unit",
    { "zh-CN": "主线剧情", "en-US": "Main Story" },
    {
      "zh-CN": "浏览指定组合的 Project SEKAI 主线剧情章节。",
      "en-US": "Browse Project Sekai main story episodes for a selected unit.",
    },
    { "zh-CN": ["主线剧情", "组合剧情"], "en-US": ["main story", "unit stories"] },
  ),
  story_unit_reader: definePage(
    "/story/unit",
    { "zh-CN": "主线剧情阅读", "en-US": "Main Story Reader" },
    {
      "zh-CN": "阅读 Project SEKAI 主线剧情内容。",
      "en-US": "Read Project Sekai main story content.",
    },
    { "zh-CN": ["主线剧情阅读", "Main Story"], "en-US": ["main story reader", "Main Story"] },
  ),
} as const;

export function getRootKeywords(locale: UiLocale = DEFAULT_UI_LOCALE): string[] {
  return [...SEO_LOCALE_CONFIG[locale].root.keywords];
}

export function getPageKeywords(pageName: string, locale: UiLocale = DEFAULT_UI_LOCALE): string[] {
  const page = SEO_PAGE_METADATA[pageName as SeoPageKey];
  if (!page) return getRootKeywords(locale).slice(0, 10);
  return [...page.keywords[locale]];
}

export function getPageSeo(pageKey: SeoPageKey, locale: UiLocale = DEFAULT_UI_LOCALE) {
  const page = SEO_PAGE_METADATA[pageKey];
  return {
    path: page.path,
    title: page.title[locale],
    description: `${page.description[locale]}${getSeoLocaleConfig(locale).suffix}`,
    keywords: getPageKeywords(pageKey, locale),
  };
}

export function getRootSeo(locale: UiLocale = DEFAULT_UI_LOCALE) {
  const config = getSeoLocaleConfig(locale);
  return {
    title: config.root.title,
    description: config.root.description,
    keywords: getRootKeywords(locale),
  };
}

// Compatibility exports for older route metadata. Prefer localized helpers above.
export const SEO_SUFFIX = SEO_LOCALE_CONFIG[DEFAULT_UI_LOCALE].suffix;
export const DETAIL_SEO_SUFFIX = SEO_LOCALE_CONFIG[DEFAULT_UI_LOCALE].detailSuffix;

// ==================== Detail Metadata Templates ====================

export const DETAIL_FALLBACK_TITLES = {
  card: { "zh-CN": "卡牌详情", "en-US": "Card Details" },
  character: { "zh-CN": "角色详情", "en-US": "Character Details" },
  costume: { "zh-CN": "服装详情", "en-US": "Costume Details" },
  event: { "zh-CN": "活动详情", "en-US": "Event Details" },
  exchange: { "zh-CN": "兑换条目详情", "en-US": "Exchange Entry Details" },
  gacha: { "zh-CN": "扭蛋详情", "en-US": "Gacha Details" },
  live: { "zh-CN": "虚拟 Live 详情", "en-US": "Virtual Live Details" },
  manga: { "zh-CN": "漫画详情", "en-US": "Comic Details" },
  music: { "zh-CN": "歌曲详情", "en-US": "Music Details" },
  mysekai: { "zh-CN": "家具详情", "en-US": "Furniture Details" },
} as const satisfies Record<string, LocalizedText>;

export const DETAIL_SEO_TEMPLATES = {
  card: {
    "zh-CN": "Project SEKAI 卡牌「{prefix}」— {character}",
    "en-US": "Project Sekai card \"{prefix}\" — {character}",
  },
  character: {
    "zh-CN": "Project SEKAI 角色「{name}」的详细资料、组合与相关信息",
    "en-US": "Detailed information for Project Sekai character \"{name}\"",
  },
  costume: {
    "zh-CN": "Project SEKAI 服装「{name}」详情",
    "en-US": "Project SEKAI costume \"{name}\"",
  },
  event: {
    "zh-CN": "Project SEKAI 活动「{name}」详情",
    "en-US": "Project Sekai event \"{name}\"",
  },
  exchange: {
    "zh-CN": "Project SEKAI 兑换条目：{name}{shopSuffix}",
    "en-US": "Project Sekai exchange entry: {name}{shopSuffix}",
  },
  exchangeFallback: {
    "zh-CN": "Project SEKAI 兑换条目详情",
    "en-US": "Project Sekai exchange entry details",
  },
  gacha: {
    "zh-CN": "Project SEKAI 扭蛋「{name}」详情",
    "en-US": "Project SEKAI gacha: {name}",
  },
  live: {
    "zh-CN": "Project SEKAI 虚拟 Live「{name}」详情",
    "en-US": "Project Sekai virtual live \"{name}\"",
  },
  manga: {
    "zh-CN": "Project SEKAI 官方四格漫画：{title}",
    "en-US": "Project Sekai official four-panel comic — {title}",
  },
  music: {
    "zh-CN": "Project SEKAI 歌曲「{title}」— 作词：{lyricist} / 作曲：{composer}",
    "en-US": "Project Sekai song \"{title}\" — Lyricist: {lyricist} / Composer: {composer}",
  },
  mysekai: {
    "zh-CN": "Project SEKAI MySekai 家具「{name}」{flavorSuffix}",
    "en-US": "Project SEKAI furniture \"{name}\"{flavorSuffix}",
  },
} as const satisfies Record<string, LocalizedText>;

export function getDetailFallbackTitle(kind: DetailFallbackKind, locale: UiLocale = DEFAULT_UI_LOCALE): string {
  return DETAIL_FALLBACK_TITLES[kind][locale];
}

export function formatDetailSeoDescription(
  kind: DetailSeoKind,
  values: MessageInterpolationValues,
  locale: UiLocale = DEFAULT_UI_LOCALE,
): string {
  const template = DETAIL_SEO_TEMPLATES[kind][locale];
  return `${interpolateMessage(template, values)}${getSeoLocaleConfig(locale).detailSuffix}`;
}

export function formatExchangeShopSuffix(summaryName: string | undefined, locale: UiLocale = DEFAULT_UI_LOCALE): string {
  if (!summaryName) return "";
  return locale === "zh-CN" ? `，兑换所：${summaryName}` : `, exchange shop: ${summaryName}`;
}

export function formatMysekaiFlavorSuffix(flavor: string | undefined, locale: UiLocale = DEFAULT_UI_LOCALE): string {
  if (!flavor) return "";
  const clipped = flavor.slice(0, 100);
  return locale === "zh-CN" ? ` — ${clipped}` : ` - ${clipped}`;
}

// ==================== JSON-LD Structured Data ====================

/** Generate JSON-LD structured data for the root page. */
export function generateJsonLd(baseUrl: string, locale: UiLocale = DEFAULT_UI_LOCALE) {
  const config = getSeoLocaleConfig(locale);

  const website = {
    "@context": "https://schema.org" as const,
    "@type": "WebSite" as const,
    name: "Moesekai",
    alternateName: config.root.jsonLdAlternateName,
    url: baseUrl,
    inLanguage: config.htmlLang,
    description: config.root.jsonLdDescription,
  };

  const videoGame = {
    "@context": "https://schema.org" as const,
    "@type": "VideoGame" as const,
    name: "Project Sekai",
    alternateName: [
      "世界计划 彩色舞台 feat. 初音未来",
      "Hatsune Miku: Colorful Stage!",
      "プロジェクトセカイ",
      "PJSK",
    ],
    gamePlatform: ["iOS", "Android"],
    applicationCategory: "GameApplication",
    genre: "Rhythm Game",
  };

  return { website, videoGame };
}
