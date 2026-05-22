/**
 * Centralized SEO keywords constants for Moesekai.
 *
 * All page metadata should reference these constants instead of hardcoding keywords.
 * This makes keyword strategy easy to adjust and maintain.
 */

// ==================== Brand Keywords ====================

/** Core brand keywords for the site */
export const SITE_BRAND = [
  "Project Sekai",
  "PJSK",
  "世界计划",
  "プロジェクトセカイ",
  "Moesekai",
] as const;

/** Site positioning keywords — how we want to be found */
export const SITE_POSITIONING = [
  "新一代PJSK WIKI",
  "PJSK WIKI",
  "PJSK图鉴",
  "世界计划WIKI",
  "初音未来缤纷舞台WIKI",
] as const;

// ==================== Page-Specific Keywords ====================

/** Per-page topic keywords, keyed by page route name */
export const PAGE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  cards: ["卡牌", "卡牌图鉴", "Card"],
  music: ["音乐", "歌曲图鉴", "Music"],
  soundtrack: ["游戏原声带", "背景音乐", "BGM", "Soundtrack", "OST"],
  events: ["活动", "活动图鉴", "Event"],
  gacha: ["扭蛋", "卡池", "Gacha"],
  character: ["角色", "角色图鉴"],
  comic: ["漫画", "一格漫画"],
  costumes: ["服装", "服装图鉴"],
  exchanges: ["兑换所"],
  manga: ["四格漫画"],
  materials: ["持有物", "素材"],
  honors: ["称号", "成就"],
  live: ["演唱会", "虚拟Live"],
  sticker: ["贴纸", "表情"],
  mysekai: ["家具", "MySekai"],
  prediction: ["活动预测", "排名预测"],
  deck_recommend: ["组卡推荐", "卡组推荐"],
  deck_comparator: ["组卡比较", "卡组比较"],
  chart_preview: ["谱面预览"],
  mysekai_preview: ["烤森百景", "百景排行", "MySekai活动"],
  my_cards: ["卡牌进度", "卡牌收集"],
  my_musics: ["歌曲进度", "歌曲游玩"],
  my_materials: ["资源查询", "材料库存"],
  profile: ["个人主页", "账号管理"],
  score_control: ["控分计算"],
  sticker_maker: ["表情包制作"],
  realtime_ranking: ["实时排行榜"],
  guess_jacket: ["猜曲绘"],
  guess_who: ["猜角色"],
  music_meta: ["歌曲Meta", "效率排行"],
  goods_gacha: ["谷子盲抽"],
  story: ["剧情", "故事"],
  story_unit: ["主线剧情", "组合剧情", "Main Story"],
  story_event: ["活动剧情", "Event Story", "剧情翻译"],
  story_card: ["卡牌剧情", "Card Story", "前后篇"],
  story_area: ["区域对话", "Area Conversation", "Area Talk"],
  story_self: ["自我介绍", "角色介绍", "Character Introduction"],
  story_special: ["特殊剧情", "Special Story", "周年剧情"],
  guides: ["攻略", "社区攻略", "Guide"],
  about: ["关于"],
  patreon: ["支持我们"],
} as const;

// ==================== SEO Suffixes ====================

/** Suffix appended to list page descriptions */
export const SEO_SUFFIX = " — 新一代PJSK WIKI";

/** Suffix appended to detail page descriptions (shorter to avoid exceeding 160 chars) */
export const DETAIL_SEO_SUFFIX = " | PJSK WIKI";

// ==================== Keyword Helpers ====================

/** Get the full keyword set for the root/home page */
export function getRootKeywords(): string[] {
  return [...new Set([...SITE_POSITIONING, ...SITE_BRAND])];
}

/** Get the full keyword set for a specific page (page topic + core brand) */
export function getPageKeywords(pageName: string): string[] {
  const pageKw = PAGE_KEYWORDS[pageName] ?? [];
  // Include first 3 brand keywords to stay within the 15-keyword limit
  return [...new Set([...pageKw, ...SITE_BRAND.slice(0, 3), ...SITE_POSITIONING.slice(0, 2)])];
}

// ==================== JSON-LD Structured Data ====================

/** Generate JSON-LD structured data for the root page */
export function generateJsonLd(baseUrl: string) {
  const website = {
    "@context": "https://schema.org" as const,
    "@type": "WebSite" as const,
    name: "Moesekai",
    alternateName: ["Snowy SekaiViewer", "PJSK WIKI", "新一代PJSK WIKI"],
    url: baseUrl,
    description:
      "新一代PJSK WIKI，世界计划彩色舞台feat.初音未来游戏数据查看器，提供卡牌、音乐、活动、扭蛋等全面图鉴与工具",
  };

  const videoGame = {
    "@context": "https://schema.org" as const,
    "@type": "VideoGame" as const,
    name: "Project Sekai",
    alternateName: [
      "世界计划 彩色舞台 feat. 初音未来",
      "プロジェクトセカイ",
      "PJSK",
    ],
    gamePlatform: ["iOS", "Android"],
    applicationCategory: "GameApplication",
    genre: "Rhythm Game",
  };

  return { website, videoGame };
}
