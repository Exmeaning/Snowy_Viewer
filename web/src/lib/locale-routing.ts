import type { UiLocale } from "./i18n/locales";

export const SUPPORTED_ROUTE_LOCALES = ["zh-cn", "zh-tw", "ja-jp", "en-us", "ko-kr"] as const;

export type RouteLocale = (typeof SUPPORTED_ROUTE_LOCALES)[number];
export type ContentRegion = "cn" | "tw" | "jp" | "en" | "kr";
export type LocaleAssetSource = `main-${ContentRegion}`;

export interface LocaleRouteConfig {
    uiLocale: UiLocale;
    defaultServer: ContentRegion;
    defaultAssetSource: LocaleAssetSource;
}

export const LOCALE_ROUTE_CONFIG: Record<RouteLocale, LocaleRouteConfig> = {
    "zh-cn": { uiLocale: "zh-CN", defaultServer: "cn", defaultAssetSource: "main-cn" },
    "zh-tw": { uiLocale: "zh-TW", defaultServer: "tw", defaultAssetSource: "main-tw" },
    "ja-jp": { uiLocale: "ja-JP", defaultServer: "jp", defaultAssetSource: "main-jp" },
    "en-us": { uiLocale: "en-US", defaultServer: "en", defaultAssetSource: "main-en" },
    "ko-kr": { uiLocale: "ko-KR", defaultServer: "kr", defaultAssetSource: "main-kr" },
};

export const DEFAULT_ROUTE_LOCALE: RouteLocale = "zh-cn";

export function isRouteLocale(value: unknown): value is RouteLocale {
    return typeof value === "string"
        && (SUPPORTED_ROUTE_LOCALES as readonly string[]).includes(value.toLowerCase());
}

export function normalizeRouteLocale(value: unknown): RouteLocale {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (isRouteLocale(normalized)) return normalized;
    }
    return DEFAULT_ROUTE_LOCALE;
}

export function getLocaleRouteConfig(locale: RouteLocale): LocaleRouteConfig {
    return LOCALE_ROUTE_CONFIG[locale];
}

export function routeLocaleToUiLocale(locale: RouteLocale): UiLocale {
    return LOCALE_ROUTE_CONFIG[locale].uiLocale;
}

export function uiLocaleToRouteLocale(locale: UiLocale): RouteLocale {
    const match = SUPPORTED_ROUTE_LOCALES.find(
        (routeLocale) => LOCALE_ROUTE_CONFIG[routeLocale].uiLocale === locale,
    );
    return match ?? DEFAULT_ROUTE_LOCALE;
}

export function defaultContentRegionForPathname(pathname: string | null | undefined): ContentRegion {
    const firstSegment = pathname?.split("/").filter(Boolean)[0]?.toLowerCase();
    return firstSegment && isRouteLocale(firstSegment)
        ? LOCALE_ROUTE_CONFIG[firstSegment].defaultServer
        : LOCALE_ROUTE_CONFIG[DEFAULT_ROUTE_LOCALE].defaultServer;
}
