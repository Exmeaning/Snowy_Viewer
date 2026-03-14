export interface SearchableNavItem {
    name: string;
    href: string;
    group: string;
    keywords: string[];
}

export const searchableNavItems: SearchableNavItem[] = [
    // 首页
    { name: "首页", href: "/", group: "导航", keywords: ["home", "index"] },

    // 数据库
    { name: "卡牌", href: "/cards", group: "数据库", keywords: ["cards", "card"] },
    { name: "音乐列表", href: "/music", group: "数据库", keywords: ["music", "song", "songs"] },
    { name: "歌曲Meta", href: "/music/meta", group: "数据库", keywords: ["music meta", "song meta", "difficulty"] },
    { name: "角色", href: "/character", group: "数据库", keywords: ["character", "characters"] },
    { name: "服装", href: "/costumes", group: "数据库", keywords: ["costumes", "costume", "outfit"] },
    { name: "称号", href: "/honors", group: "数据库", keywords: ["honors", "honor", "title"] },
    { name: "贴纸", href: "/sticker", group: "数据库", keywords: ["sticker", "stickers", "stamp"] },
    { name: "漫画", href: "/comic", group: "数据库", keywords: ["comic", "comics", "manga"] },
    { name: "家具", href: "/mysekai", group: "数据库", keywords: ["furniture", "mysekai", "home"] },

    // 活动
    { name: "活动列表", href: "/events", group: "活动", keywords: ["events", "event"] },
    { name: "扭蛋", href: "/gacha", group: "活动", keywords: ["gacha", "banner", "pull"] },
    { name: "演唱会", href: "/live", group: "活动", keywords: ["live", "concert", "virtual live"] },
    { name: "活动剧情", href: "/eventstory", group: "活动", keywords: ["event story", "story", "scenario"] },
    { name: "活动预测", href: "/prediction", group: "活动", keywords: ["prediction", "ranking", "forecast"] },

    // 工具
    { name: "组卡推荐", href: "/deck-recommend", group: "工具", keywords: ["deck recommend", "deck", "team"] },
    { name: "组卡比较", href: "/deck-comparator", group: "工具", keywords: ["deck compare", "comparator"] },
    { name: "控分计算", href: "/score-control", group: "工具", keywords: ["score control", "score", "calculator"] },
    { name: "谱面预览器", href: "/chart-preview", group: "工具", keywords: ["chart preview", "chart", "mmw", "谱面", "preview", "sus"] },
    { name: "表情包制作", href: "/sticker-maker", group: "工具", keywords: ["sticker maker", "meme"] },
    { name: "谷子盲抽", href: "/goods-gacha", group: "工具", keywords: ["goods gacha", "goods", "blind box"] },
    { name: "猜角色", href: "/guess-who", group: "工具", keywords: ["guess who", "quiz", "game"] },
    { name: "猜曲绘", href: "/guess-jacket", group: "工具", keywords: ["guess jacket", "guess music", "music quiz"] },

    // 个人
    { name: "个人主页", href: "/profile", group: "个人", keywords: ["profile", "user", "account"] },
    { name: "卡牌进度", href: "/my-cards", group: "个人", keywords: ["my cards", "card progress"] },
    { name: "歌曲进度", href: "/my-musics", group: "个人", keywords: ["my musics", "music progress", "song progress"] },
    { name: "关于", href: "/about", group: "个人", keywords: ["about", "info"] },
];

// Search index group labels (for CommandPalette dynamic search results)
// Order matters: determines display priority
export const SEARCH_GROUP_LABELS: Record<string, string> = {
    events: "活动",
    music: "歌曲",
    cards: "卡牌",
    gacha: "扭蛋",
    mysekai: "家具",
    costumes: "服装",
    live: "演唱会",
};

// Search index group route prefixes
export const SEARCH_GROUP_ROUTES: Record<string, string> = {
    events: "/events",
    music: "/music",
    cards: "/cards",
    gacha: "/gacha",
    mysekai: "/mysekai",
    costumes: "/costumes",
    live: "/live",
};
