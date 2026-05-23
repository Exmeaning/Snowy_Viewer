import { DEFAULT_UI_LOCALE, type UiLocale } from "@/lib/i18n/locales";
import { INDEXABLE_SEO_ROUTES } from "@/lib/seo-routes";
import { getPageSeo, getRootSeo, getSeoLocaleConfig, type SeoPageKey } from "@/lib/seo-keywords";

function absoluteUrl(baseUrl: string, path = "/"): string {
    return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
}

function listItem(position: number, name: string, item: string) {
    return {
        "@type": "ListItem" as const,
        position,
        name,
        item,
    };
}

/** Generate JSON-LD structured data for the root page. */
export function generateRootJsonLd(baseUrl: string, locale: UiLocale = DEFAULT_UI_LOCALE) {
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

export function generatePageBreadcrumbJsonLd(
    baseUrl: string,
    pageKey: SeoPageKey,
    locale: UiLocale = DEFAULT_UI_LOCALE,
) {
    const root = getRootSeo(locale);
    const page = getPageSeo(pageKey, locale);

    return {
        "@context": "https://schema.org" as const,
        "@type": "BreadcrumbList" as const,
        itemListElement: [
            listItem(1, root.title, absoluteUrl(baseUrl, "/")),
            listItem(2, page.title, absoluteUrl(baseUrl, page.path)),
        ],
    };
}

export interface ItemListEntry {
    name: string;
    url: string;
}

export function generateItemListJsonLd(baseUrl: string, entries: readonly ItemListEntry[]) {
    return {
        "@context": "https://schema.org" as const,
        "@type": "ItemList" as const,
        itemListElement: entries.map((entry, index) => listItem(index + 1, entry.name, absoluteUrl(baseUrl, entry.url))),
    };
}

export function generateSiteNavigationItemListJsonLd(
    baseUrl: string,
    locale: UiLocale = DEFAULT_UI_LOCALE,
    maxItems = 12,
) {
    const entries = INDEXABLE_SEO_ROUTES
        .filter((route) => route.pageKey && route.priority >= 0.7)
        .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path))
        .slice(0, maxItems)
        .map((route) => {
            const page = getPageSeo(route.pageKey as SeoPageKey, locale);
            return {
                name: page.title,
                url: route.path,
            };
        });

    return generateItemListJsonLd(baseUrl, entries);
}

export { generateRootJsonLd as generateJsonLd };
