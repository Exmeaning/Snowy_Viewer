// ── Breadcrumb navigation data ──

export interface NavItemData {
    name: string;
    href: string;
}

export interface NavGroupData {
    title: string;
    href: string;
    items: NavItemData[];
}

export const navigationGroups: NavGroupData[] = [
    {
        title: "数据库",
        href: "/breadcrumb-database",
        items: [
            { name: "卡牌", href: "/cards" },
            { name: "音乐列表", href: "/music" },
            { name: "歌曲Meta", href: "/music/meta" },
            { name: "角色", href: "/character" },
            { name: "服装", href: "/costumes" },
            { name: "称号", href: "/honors" },
            { name: "贴纸", href: "/sticker" },
            { name: "漫画", href: "/comic" },
            { name: "官方四格", href: "/manga" },
            { name: "家具", href: "/mysekai" },
            { name: "持有物", href: "/materials" },
            { name: "兑换所", href: "/exchanges" },
        ],
    },
    {
        title: "活动",
        href: "/breadcrumb-activity",
        items: [
            { name: "活动列表", href: "/events" },
            { name: "扭蛋", href: "/gacha" },
            { name: "演唱会", href: "/live" },
            { name: "活动预测", href: "/prediction" },
            { name: "实时排行榜", href: "/realtime-ranking" },
        ],
    },
    {
        title: "剧情",
        href: "/breadcrumb-story",
        items: [
            { name: "主线剧情", href: "/story/unit" },
            { name: "活动剧情", href: "/story/event" },
            { name: "卡牌剧情", href: "/story/card" },
            { name: "区域对话", href: "/story/area" },
            { name: "自我介绍", href: "/story/self" },
            { name: "特殊剧情", href: "/story/special" },
        ],
    },
    {
        title: "社区",
        href: "/breadcrumb-community",
        items: [
            { name: "攻略", href: "/guides" },
        ],
    },
    {
        title: "工具",
        href: "/breadcrumb-tools",
        items: [
            { name: "组卡推荐", href: "/deck-recommend" },
            { name: "组卡比较", href: "/deck-comparator" },
            { name: "控分计算", href: "/score-control" },
            { name: "表情包制作", href: "/sticker-maker" },
            { name: "谷子盲抽", href: "/goods-gacha" },
            { name: "猜角色", href: "/guess-who" },
            { name: "猜曲绘", href: "/guess-jacket" },
            { name: "谱面预览器", href: "/chart-preview" },
        ],
    },
    {
        title: "个人",
        href: "/breadcrumb-personal",
        items: [
            { name: "个人主页", href: "/profile" },
            { name: "卡牌进度", href: "/my-cards" },
            { name: "歌曲进度", href: "/my-musics" },
            { name: "资源查询", href: "/my-materials" },
            { name: "支持", href: "/patreon" },
            { name: "关于", href: "/about" },
        ],
    },
];

/**
 * 根据 pathname 查找匹配的导航项和所属分组。
 * 返回 { group, item } 或 null。
 */
export function findNavMatch(pathname: string): { group: NavGroupData; item: NavItemData } | null {
    for (const group of navigationGroups) {
        for (const item of group.items) {
            // 精确匹配或子路径匹配
            if (pathname === item.href || pathname.startsWith(item.href + "/")) {
                // 特殊处理：防止 /music/meta 误匹配 /music
                if (item.href === "/music" && pathname.startsWith("/music/meta")) {
                    continue;
                }
                return { group, item };
            }
        }
    }
    return null;
}

/**
 * 根据 pathname 查找匹配的分组（用于分组汇总页）。
 */
export function findGroupMatch(pathname: string): NavGroupData | null {
    // 去掉尾部斜杠以兼容 trailingSlash: true 配置
    const normalized = pathname.endsWith("/") && pathname !== "/"
        ? pathname.slice(0, -1)
        : pathname;
    for (const group of navigationGroups) {
        if (normalized === group.href) {
            return group;
        }
    }
    return null;
}

// ── Command palette search data (original content) ──

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
    { name: "持有物", href: "/materials", group: "数据库", keywords: ["materials", "items", "holding", "holdings", "material", "持有物", "材料", "道具"] },
    { name: "兑换所", href: "/exchanges", group: "数据库", keywords: ["exchange", "exchanges", "material exchange", "shop", "兑换", "兑换所", "交换所"] },

    // 活动
    { name: "活动列表", href: "/events", group: "活动", keywords: ["events", "event"] },
    { name: "扭蛋", href: "/gacha", group: "活动", keywords: ["gacha", "banner", "pull"] },
    { name: "演唱会", href: "/live", group: "活动", keywords: ["live", "concert", "virtual live"] },
    { name: "活动剧情", href: "/story/event", group: "活动", keywords: ["event story", "story", "scenario"] },
    { name: "活动预测", href: "/prediction", group: "活动", keywords: ["prediction", "ranking", "forecast"] },
    { name: "实时排行榜", href: "/realtime-ranking", group: "活动", keywords: ["realtime ranking", "live ranking", "排行", "排行榜", "实时榜单"] },

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
    { name: "资源查询", href: "/my-materials", group: "个人", keywords: ["my materials", "materials", "resources", "mysekai materials", "资源", "材料"] },
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
