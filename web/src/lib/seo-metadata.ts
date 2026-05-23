import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import {
    DEFAULT_UI_LOCALE,
    UI_LOCALE_STORAGE_KEY,
    resolveAcceptLanguageUiLocale,
    resolveUiLocale,
    type UiLocale,
} from "@/lib/i18n/locales";
import {
    formatDetailSeoDescription,
    getDetailFallbackDescription,
    getDetailFallbackTitle,
    getPageSeo,
    getRootSeo,
    getSeoLocaleConfig,
    type DetailFallbackKind,
    type DetailSeoKind,
    type SeoPageKey,
} from "@/lib/seo-keywords";

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_DOMAIN || "https://pjsk.moe";
const DEFAULT_ICON_URL = "/data/icon/icon.jpg";

export function getSiteBaseUrl(): string {
    return SITE_BASE_URL;
}

export async function getRequestSeoLocale(): Promise<UiLocale> {
    try {
        const cookieStore = await cookies();
        const cookieLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_STORAGE_KEY)?.value);
        if (cookieLocale) return cookieLocale;

        const requestHeaders = await headers();
        return resolveAcceptLanguageUiLocale(requestHeaders.get("accept-language"), DEFAULT_UI_LOCALE);
    } catch {
        return DEFAULT_UI_LOCALE;
    }
}

function normalizePath(path: string): string {
    if (!path || path === "/") return "/";
    return path.startsWith("/") ? path : `/${path}`;
}

function absolutePath(path: string): string {
    return new URL(normalizePath(path), SITE_BASE_URL).toString();
}

function metadataBase() {
    return new URL(SITE_BASE_URL);
}

interface BuildMetadataOptions {
    locale: UiLocale;
    title: string | Metadata["title"];
    description?: string;
    keywords?: readonly string[];
    path?: string;
    images?: Metadata["openGraph"] extends { images?: infer Images } ? Images : string[];
    twitterCard?: "summary" | "summary_large_image";
    type?: "website" | "article";
    robots?: Metadata["robots"];
}

export function buildLocalizedMetadata({
    locale,
    title,
    description,
    keywords,
    path = "/",
    images = [DEFAULT_ICON_URL],
    twitterCard = "summary",
    type = "website",
    robots,
}: BuildMetadataOptions): Metadata {
    const localeConfig = getSeoLocaleConfig(locale);
    const titleText = typeof title === "string"
        ? title
        : title && typeof title === "object" && "default" in title && typeof title.default === "string"
            ? title.default
            : undefined;
    const canonical = absolutePath(path);

    const metadata: Metadata = {
        metadataBase: metadataBase(),
        title,
        alternates: {
            canonical,
        },
        icons: { icon: DEFAULT_ICON_URL },
        openGraph: {
            title: titleText,
            description,
            url: canonical,
            type,
            siteName: "Moesekai",
            locale: localeConfig.openGraphLocale,
            alternateLocale: [...localeConfig.alternateOpenGraphLocales],
            images,
        },
        twitter: {
            card: twitterCard,
            title: titleText,
            description,
            images,
        },
    };

    if (description) metadata.description = description;
    if (keywords?.length) metadata.keywords = [...keywords];
    if (robots) metadata.robots = robots;

    return metadata;
}

export async function generateRootMetadata(): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const root = getRootSeo(locale);
    const localeConfig = getSeoLocaleConfig(locale);

    return buildLocalizedMetadata({
        locale,
        title: {
            default: root.title,
            template: localeConfig.titleTemplate,
        },
        description: root.description,
        keywords: root.keywords,
        path: "/",
    });
}

export function noIndexRobots(): Metadata["robots"] {
    return {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    };
}

export async function createPageMetadata(pageKey: SeoPageKey): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const page = getPageSeo(pageKey, locale);

    return buildLocalizedMetadata({
        locale,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        path: page.path,
    });
}

export function pageMetadata(pageKey: SeoPageKey) {
    return () => createPageMetadata(pageKey);
}

export async function createNoIndexPageMetadata(pageKey: SeoPageKey): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const page = getPageSeo(pageKey, locale);

    return buildLocalizedMetadata({
        locale,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        path: page.path,
        robots: noIndexRobots(),
    });
}

export function noIndexPageMetadata(pageKey: SeoPageKey) {
    return () => createNoIndexPageMetadata(pageKey);
}

export async function createSimpleMetadata(pageKey: SeoPageKey): Promise<Metadata> {
    return createPageMetadata(pageKey);
}

interface DetailMetadataOptions {
    locale: UiLocale;
    title: string;
    description: string;
    path: string;
    images?: string[];
    twitterCard?: "summary" | "summary_large_image";
    robots?: Metadata["robots"];
}

export function buildDetailMetadata({
    locale,
    title,
    description,
    path,
    images,
    twitterCard,
    robots,
}: DetailMetadataOptions): Metadata {
    return buildLocalizedMetadata({
        locale,
        title,
        description,
        path,
        images,
        twitterCard: twitterCard ?? (images?.length ? "summary_large_image" : "summary"),
        type: "article",
        robots,
    });
}

export async function createDetailFallbackMetadata(kind: DetailFallbackKind, path: string): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const title = getDetailFallbackTitle(kind, locale);

    const description = kind === "exchange"
        ? formatDetailSeoDescription("exchangeFallback", {}, locale)
        : getDetailFallbackDescription(kind, locale);

    return buildDetailMetadata({
        locale,
        title,
        description,
        path,
    });
}

export async function getDetailSeoContext() {
    const locale = await getRequestSeoLocale();
    return {
        locale,
        formatDetailDescription: (kind: DetailSeoKind, values: Parameters<typeof formatDetailSeoDescription>[1]) =>
            formatDetailSeoDescription(kind, values, locale),
    };
}
