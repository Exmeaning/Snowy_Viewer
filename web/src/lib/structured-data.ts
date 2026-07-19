import { DEFAULT_UI_LOCALE, type UiLocale } from "@/lib/i18n/locales";
import { INDEXABLE_SEO_ROUTES, findSeoRouteByPageKey, normalizeSeoPath } from "@/lib/seo-routes";
import { getPageSeo, getRootSeo, getSeoLocaleConfig, type SeoPageKey } from "@/lib/seo-keywords";
import { uiLocaleToRouteLocale } from "@/lib/locale-routing";

function absoluteUrl(baseUrl: string, path = "/"): string {
    return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
}

function localizedAbsoluteUrl(baseUrl: string, path: string, locale: UiLocale): string {
    return absoluteUrl(baseUrl, localizedPath(path, locale));
}

function localizedPath(path: string, locale: UiLocale): string {
    const normalized = normalizeSeoPath(path);
    return normalizeSeoPath(`/${uiLocaleToRouteLocale(locale)}${normalized === "/" ? "" : normalized}`);
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
        url: localizedAbsoluteUrl(baseUrl, "/", locale),
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
    const route = findSeoRouteByPageKey(pageKey);

    return {
        "@context": "https://schema.org" as const,
        "@type": "BreadcrumbList" as const,
        itemListElement: [
            listItem(1, root.title, localizedAbsoluteUrl(baseUrl, "/", locale)),
            listItem(2, page.title, localizedAbsoluteUrl(baseUrl, route?.path ?? page.path, locale)),
        ],
    };
}

export function generateDetailBreadcrumbJsonLd(
    baseUrl: string,
    parentPageKey: SeoPageKey,
    detail: { name: string; path: string },
    locale: UiLocale = DEFAULT_UI_LOCALE,
) {
    const root = getRootSeo(locale);
    const parent = getPageSeo(parentPageKey, locale);
    const parentRoute = findSeoRouteByPageKey(parentPageKey);

    return {
        "@context": "https://schema.org" as const,
        "@type": "BreadcrumbList" as const,
        itemListElement: [
            listItem(1, root.title, localizedAbsoluteUrl(baseUrl, "/", locale)),
            listItem(2, parent.title, localizedAbsoluteUrl(baseUrl, parentRoute?.path ?? parent.path, locale)),
            listItem(3, detail.name, localizedAbsoluteUrl(baseUrl, detail.path, locale)),
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

function collectionItemId(baseUrl: string, pageKey: SeoPageKey, id: string | number, locale: UiLocale): string {
    const route = findSeoRouteByPageKey(pageKey);
    const parentPath = normalizeSeoPath(route?.path ?? getPageSeo(pageKey, DEFAULT_UI_LOCALE).path);
    return localizedAbsoluteUrl(baseUrl, `${parentPath}${encodeURIComponent(String(id))}/`, locale);
}

export function generateCollectionItemListJsonLd(
    baseUrl: string,
    pageKey: SeoPageKey,
    entries: readonly { id: string | number; name: string }[],
    locale: UiLocale = DEFAULT_UI_LOCALE,
) {
    return generateItemListJsonLd(
        baseUrl,
        entries.map((entry) => ({
            name: entry.name,
            url: collectionItemId(baseUrl, pageKey, entry.id, locale),
        })),
    );
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
                url: localizedPath(route.path, locale),
            };
        });

    return generateItemListJsonLd(baseUrl, entries);
}

export { generateRootJsonLd as generateJsonLd };
