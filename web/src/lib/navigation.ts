// Breadcrumb navigation data

export interface NavItemData {
    href: string;
}

export interface NavGroupData {
    href: string;
    items: NavItemData[];
}

export const navigationGroups: NavGroupData[] = [
    {
        href: "/breadcrumb-database",
        items: [
            { href: "/cards" },
            { href: "/music" },
            { href: "/music/meta" },
            { href: "/soundtrack" },
            { href: "/character" },
            { href: "/costumes" },
            { href: "/honors" },
            { href: "/sticker" },
            { href: "/comic" },
            { href: "/manga" },
            { href: "/mysekai" },
            { href: "/materials" },
            { href: "/exchanges" },
        ],
    },
    {
        href: "/breadcrumb-activity",
        items: [
            { href: "/events" },
            { href: "/information" },
            { href: "/gacha" },
            { href: "/live" },
            { href: "/prediction" },
            { href: "/realtime-ranking" },
            { href: "/mysekai-preview" },
        ],
    },
    {
        href: "/breadcrumb-story",
        items: [
            { href: "/story/unit" },
            { href: "/story/event" },
            { href: "/story/card" },
            { href: "/story/area" },
            { href: "/story/self" },
            { href: "/story/special" },
        ],
    },
    {
        href: "/breadcrumb-community",
        items: [
            { href: "/guides" },
        ],
    },
    {
        href: "/breadcrumb-tools",
        items: [
            { href: "/deck-recommend" },
            { href: "/deck-comparator" },
            { href: "/score-control" },
            { href: "/sticker-maker" },
            { href: "/goods-gacha" },
            { href: "/guess-who" },
            { href: "/guess-jacket" },
            { href: "/chart-preview" },
            { href: "/mysekai-preview/scene" },
        ],
    },
    {
        href: "/breadcrumb-personal",
        items: [
            { href: "/profile" },
            { href: "/my-cards" },
            { href: "/my-musics" },
            { href: "/my-materials" },
            { href: "/patreon" },
            { href: "/about" },
        ],
    },
];

/**
 * Finds the best matching navigation item and its group for a pathname.
 */
export function findNavMatch(pathname: string): { group: NavGroupData; item: NavItemData } | null {
    let bestMatch: { group: NavGroupData; item: NavItemData } | null = null;
    for (const group of navigationGroups) {
        for (const item of group.items) {
            // Keep the longest prefix match so nested routes choose the most specific item.
            if (pathname === item.href || pathname.startsWith(item.href + "/")) {
                // Prevent /music/meta from matching /music first.
                if (item.href === "/music" && pathname.startsWith("/music/meta")) {
                    continue;
                }
                if (!bestMatch || item.href.length > bestMatch.item.href.length) {
                    bestMatch = { group, item };
                }
            }
        }
    }
    return bestMatch;
}

/**
 * Finds a matching summary group page for a pathname.
 */
export function findGroupMatch(pathname: string): NavGroupData | null {
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

export type SearchableNavGroup = "navigation" | "database" | "activity" | "tools" | "personal";

export interface SearchableNavItem {
    href: string;
    group: SearchableNavGroup;
    keywords: string[];
}

export const searchableNavItems: SearchableNavItem[] = [
    { href: "/", group: "navigation", keywords: ["home", "index"] },

    { href: "/cards", group: "database", keywords: ["cards", "card"] },
    { href: "/music", group: "database", keywords: ["music", "song", "songs"] },
    { href: "/music/meta", group: "database", keywords: ["music meta", "song meta", "difficulty"] },
    { href: "/soundtrack", group: "database", keywords: ["soundtrack", "ost", "bgm", "music"] },
    { href: "/character", group: "database", keywords: ["character", "characters"] },
    { href: "/costumes", group: "database", keywords: ["costumes", "costume", "outfit"] },
    { href: "/honors", group: "database", keywords: ["honors", "honor", "title"] },
    { href: "/sticker", group: "database", keywords: ["sticker", "stickers", "stamp"] },
    { href: "/comic", group: "database", keywords: ["comic", "comics", "manga"] },
    { href: "/manga", group: "database", keywords: ["four koma", "4koma", "official manga"] },
    { href: "/mysekai", group: "database", keywords: ["furniture", "mysekai", "home"] },
    { href: "/materials", group: "database", keywords: ["materials", "items", "holding", "holdings", "material"] },
    { href: "/exchanges", group: "database", keywords: ["exchange", "exchanges", "material exchange", "shop"] },

    { href: "/events", group: "activity", keywords: ["events", "event"] },
    { href: "/information", group: "activity", keywords: ["information", "announcement", "announcements", "news", "notice"] },
    { href: "/gacha", group: "activity", keywords: ["gacha", "banner", "pull"] },
    { href: "/live", group: "activity", keywords: ["live", "concert", "virtual live"] },
    { href: "/story/event", group: "activity", keywords: ["event story", "story", "scenario"] },
    { href: "/prediction", group: "activity", keywords: ["prediction", "ranking", "forecast"] },
    { href: "/realtime-ranking", group: "activity", keywords: ["realtime ranking", "live ranking", "rank", "ranking"] },
    { href: "/mysekai-preview", group: "activity", keywords: ["baijing", "housing competition", "mysekai", "top"] },

    { href: "/deck-recommend", group: "tools", keywords: ["deck recommend", "deck", "team"] },
    { href: "/deck-comparator", group: "tools", keywords: ["deck compare", "comparator"] },
    { href: "/score-control", group: "tools", keywords: ["score control", "score", "calculator"] },
    { href: "/chart-preview", group: "tools", keywords: ["chart preview", "chart", "mmw", "preview", "sus"] },
    { href: "/mysekai-preview/scene", group: "tools", keywords: ["mysekai preview", "scene preview", "mysekai", "3d", "obj", "scene"] },
    { href: "/sticker-maker", group: "tools", keywords: ["sticker maker", "meme"] },
    { href: "/goods-gacha", group: "tools", keywords: ["goods gacha", "goods", "blind box"] },
    { href: "/guess-who", group: "tools", keywords: ["guess who", "quiz", "game"] },
    { href: "/guess-jacket", group: "tools", keywords: ["guess jacket", "guess music", "music quiz"] },

    { href: "/profile", group: "personal", keywords: ["profile", "user", "account"] },
    { href: "/my-cards", group: "personal", keywords: ["my cards", "card progress"] },
    { href: "/my-musics", group: "personal", keywords: ["my musics", "music progress", "song progress"] },
    { href: "/my-materials", group: "personal", keywords: ["my materials", "materials", "resources", "mysekai materials"] },
    { href: "/about", group: "personal", keywords: ["about", "info"] },
];

export const SEARCH_GROUP_ROUTES: Record<string, string> = {
    events: "/events",
    music: "/music",
    cards: "/cards",
    gacha: "/gacha",
    mysekai: "/mysekai",
    costumes: "/costumes",
    live: "/live",
};

export const SEARCH_GROUP_LABEL_KEYS: Record<string, string> = {
    events: "search.commandPalette.dynamicGroups.events",
    music: "search.commandPalette.dynamicGroups.music",
    cards: "search.commandPalette.dynamicGroups.cards",
    gacha: "search.commandPalette.dynamicGroups.gacha",
    mysekai: "search.commandPalette.dynamicGroups.mysekai",
    costumes: "search.commandPalette.dynamicGroups.costumes",
    live: "search.commandPalette.dynamicGroups.live",
};

export const SEARCH_STATIC_GROUP_LABEL_KEYS: Record<SearchableNavGroup, string> = {
    navigation: "layout.nav.groups.navigation",
    database: "layout.nav.groups.database",
    activity: "layout.nav.groups.activity",
    tools: "layout.nav.groups.tools",
    personal: "layout.nav.groups.personal",
};

export const NAV_GROUP_LABEL_KEYS: Record<string, string> = {
    "/breadcrumb-database": "layout.nav.groups.database",
    "/breadcrumb-activity": "layout.nav.groups.activity",
    "/breadcrumb-story": "layout.nav.groups.story",
    "/breadcrumb-community": "layout.nav.groups.community",
    "/breadcrumb-tools": "layout.nav.groups.tools",
    "/breadcrumb-personal": "layout.nav.groups.personal",
};

export const NAV_ITEM_LABEL_KEYS: Record<string, string> = {
    "/": "layout.nav.home",
    "/cards": "layout.nav.items.cards",
    "/music": "layout.nav.items.musicList",
    "/music/meta": "layout.nav.items.musicMeta",
    "/soundtrack": "layout.nav.items.soundtrack",
    "/character": "layout.nav.items.character",
    "/costumes": "layout.nav.items.costumes",
    "/honors": "layout.nav.items.honors",
    "/sticker": "layout.nav.items.sticker",
    "/comic": "layout.nav.items.comic",
    "/manga": "layout.nav.items.manga",
    "/mysekai": "layout.nav.items.mysekai",
    "/materials": "layout.nav.items.materials",
    "/exchanges": "layout.nav.items.exchanges",
    "/events": "layout.nav.items.events",
    "/information": "layout.nav.items.information",
    "/gacha": "layout.nav.items.gacha",
    "/live": "layout.nav.items.live",
    "/prediction": "layout.nav.items.prediction",
    "/realtime-ranking": "layout.nav.items.realtimeRanking",
    "/mysekai-preview": "layout.nav.items.mysekaiPreview",
    "/story/unit": "layout.nav.items.mainStory",
    "/story/event": "layout.nav.items.eventStory",
    "/story/card": "layout.nav.items.cardStory",
    "/story/area": "layout.nav.items.areaTalk",
    "/story/self": "layout.nav.items.selfIntro",
    "/story/special": "layout.nav.items.specialStory",
    "/guides": "layout.nav.items.guides",
    "/deck-recommend": "layout.nav.items.deckRecommend",
    "/deck-comparator": "layout.nav.items.deckComparator",
    "/score-control": "layout.nav.items.scoreControl",
    "/sticker-maker": "layout.nav.items.stickerMaker",
    "/goods-gacha": "layout.nav.items.goodsGacha",
    "/guess-who": "layout.nav.items.guessWho",
    "/guess-jacket": "layout.nav.items.guessJacket",
    "/chart-preview": "layout.nav.items.chartPreview",
    "/mysekai-preview/scene": "layout.nav.items.mysekaiPreviewScene",
    "/profile": "layout.nav.items.profile",
    "/my-cards": "layout.nav.items.myCards",
    "/my-musics": "layout.nav.items.myMusics",
    "/my-materials": "layout.nav.items.myMaterials",
    "/patreon": "layout.nav.items.support",
    "/about": "layout.nav.items.about",
};

export const NAV_ITEM_DESCRIPTION_KEYS: Record<string, string> = {
    "/cards": "layout.groupPages.cards",
    "/music": "layout.groupPages.music",
    "/music/meta": "layout.groupPages.musicMeta",
    "/soundtrack": "layout.groupPages.soundtrack",
    "/character": "layout.groupPages.character",
    "/costumes": "layout.groupPages.costumes",
    "/honors": "layout.groupPages.honors",
    "/sticker": "layout.groupPages.sticker",
    "/comic": "layout.groupPages.comic",
    "/manga": "layout.groupPages.manga",
    "/mysekai": "layout.groupPages.mysekai",
    "/materials": "layout.groupPages.materials",
    "/exchanges": "layout.groupPages.exchanges",
    "/events": "layout.groupPages.events",
    "/information": "layout.groupPages.information",
    "/gacha": "layout.groupPages.gacha",
    "/live": "layout.groupPages.live",
    "/story/event": "layout.groupPages.storyEvent",
    "/story/unit": "layout.groupPages.storyUnit",
    "/story/card": "layout.groupPages.storyCard",
    "/story/area": "layout.groupPages.storyArea",
    "/story/self": "layout.groupPages.storySelf",
    "/story/special": "layout.groupPages.storySpecial",
    "/prediction": "layout.groupPages.prediction",
    "/guides": "layout.groupPages.guides",
    "/deck-recommend": "layout.groupPages.deckRecommend",
    "/deck-comparator": "layout.groupPages.deckComparator",
    "/score-control": "layout.groupPages.scoreControl",
    "/sticker-maker": "layout.groupPages.stickerMaker",
    "/goods-gacha": "layout.groupPages.goodsGacha",
    "/guess-who": "layout.groupPages.guessWho",
    "/guess-jacket": "layout.groupPages.guessJacket",
    "/chart-preview": "layout.groupPages.chartPreview",
    "/mysekai-preview": "layout.groupPages.mysekaiPreview",
    "/mysekai-preview/scene": "layout.groupPages.mysekaiPreviewScene",
    "/profile": "layout.groupPages.profile",
    "/my-cards": "layout.groupPages.myCards",
    "/my-musics": "layout.groupPages.myMusics",
    "/my-materials": "layout.groupPages.myMaterials",
    "/patreon": "layout.groupPages.patreon",
    "/about": "layout.groupPages.about",
};
