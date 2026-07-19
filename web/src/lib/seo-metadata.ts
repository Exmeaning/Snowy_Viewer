import type { Metadata } from "next";
import { createElement, Fragment, type ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import {
    DEFAULT_UI_LOCALE,
    UI_LOCALE_STORAGE_KEY,
    resolveAcceptLanguageUiLocale,
    resolveUiLocale,
    type UiLocale,
} from "@/lib/i18n/locales";
import {
    getLocaleRouteConfig,
    isRouteLocale,
    SUPPORTED_ROUTE_LOCALES,
    uiLocaleToRouteLocale,
    type LocaleAssetSource,
    type ContentRegion,
    type RouteLocale,
} from "@/lib/locale-routing";
import { assertNoIndexSeoRoute, findSeoRouteByPageKey, findSeoRouteByPath, isIndexableSeoPath, normalizeSeoPath } from "@/lib/seo-routes";
import { generateCollectionItemListJsonLd, generateDetailBreadcrumbJsonLd, generatePageBreadcrumbJsonLd } from "@/lib/structured-data";
import {
    formatDetailSeoDescription,
    formatDynamicSeoDescription,
    formatDynamicSeoTitle,
    getDetailFallbackDescription,
    getDetailFallbackTitle,
    getDynamicFallbackDescription,
    getDynamicFallbackTitle,
    getPageSeo,
    getRootSeo,
    getSeoLocaleConfig,
    type DetailFallbackKind,
    type DetailSeoKind,
    type DynamicSeoKind,
    type SeoPageKey,
} from "@/lib/seo-keywords";

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_DOMAIN || "https://pjsk.moe";
const DETAIL_BREADCRUMB_SCRIPT_PREFIX = "detail-breadcrumb";
const PAGE_BREADCRUMB_SCRIPT_PREFIX = "page-breadcrumb";
const DEFAULT_ICON_URL = "/data/icon/icon.jpg";
export const SEO_ROUTE_LOCALE_HEADER = "x-moesekai-route-locale";

export function getSiteBaseUrl(): string {
    return SITE_BASE_URL;
}

export async function getRequestSeoLocale(): Promise<UiLocale> {
    try {
        const requestHeaders = await headers();
        const routeLocale = requestHeaders.get(SEO_ROUTE_LOCALE_HEADER);
        if (isRouteLocale(routeLocale)) return getLocaleRouteConfig(routeLocale).uiLocale;

        const cookieStore = await cookies();
        const cookieLocale = resolveUiLocale(cookieStore.get(UI_LOCALE_STORAGE_KEY)?.value);
        if (cookieLocale) return cookieLocale;

        return resolveAcceptLanguageUiLocale(requestHeaders.get("accept-language"), DEFAULT_UI_LOCALE);
    } catch {
        return DEFAULT_UI_LOCALE;
    }
}

export function getSeoRouteLocale(locale: UiLocale): RouteLocale {
    return uiLocaleToRouteLocale(locale);
}

export function getSeoAssetSource(locale: UiLocale): LocaleAssetSource {
    return getLocaleRouteConfig(getSeoRouteLocale(locale)).defaultAssetSource;
}

export function localizeSeoPath(path: string, routeLocale: RouteLocale): string {
    const normalized = normalizeSeoPath(path);
    return normalizeSeoPath(`/${routeLocale}${normalized === "/" ? "" : normalized}`);
}

function absolutePath(path: string): string {
    return new URL(normalizeSeoPath(path), SITE_BASE_URL).toString();
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
    alternateRouteLocales?: readonly RouteLocale[];
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
    alternateRouteLocales,
}: BuildMetadataOptions): Metadata {
    const localeConfig = getSeoLocaleConfig(locale);
    const titleText = typeof title === "string"
        ? title
        : title && typeof title === "object" && "default" in title && typeof title.default === "string"
            ? title.default
            : undefined;
    const routeLocale = getSeoRouteLocale(locale);
    const localizedPath = localizeSeoPath(path, routeLocale);
    const canonical = absolutePath(localizedPath);
    const languages = Object.fromEntries([
        ...(alternateRouteLocales ?? SUPPORTED_ROUTE_LOCALES).map((alternateLocale) => {
            const config = getLocaleRouteConfig(alternateLocale);
            return [config.uiLocale, absolutePath(localizeSeoPath(path, alternateLocale))] as const;
        }),
        ["x-default", absolutePath("/")],
    ]);

    const metadata: Metadata = {
        metadataBase: metadataBase(),
        title,
        alternates: {
            canonical,
            languages,
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

function missingDetailRobots(): Metadata["robots"] {
    return {
        index: false,
        follow: true,
        googleBot: {
            index: false,
            follow: true,
        },
    };
}

function getAvailableRouteLocales<T>(getData: (region: ContentRegion) => T | null): RouteLocale[] {
    return SUPPORTED_ROUTE_LOCALES.filter((routeLocale) => {
        const region = getLocaleRouteConfig(routeLocale).defaultServer;
        return getData(region) !== null;
    });
}

export async function createPageMetadata(pageKey: SeoPageKey): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const page = getPageSeo(pageKey, locale);
    const route = findSeoRouteByPageKey(pageKey);
    const path = route?.path ?? page.path;

    return buildLocalizedMetadata({
        locale,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        path,
        robots: route?.indexable === false || !isIndexableSeoPath(path) ? noIndexRobots() : undefined,
    });
}

export function pageMetadata(pageKey: SeoPageKey) {
    return () => createPageMetadata(pageKey);
}

export function withPageBreadcrumb(pageKey: SeoPageKey, render: () => ReactNode) {
    const Page = async () => {
        const locale = await getRequestSeoLocale();
        const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(SITE_BASE_URL, pageKey, locale);

        return createElement(
            Fragment,
            null,
            createElement("script", {
                id: `${PAGE_BREADCRUMB_SCRIPT_PREFIX}-${pageKey}`,
                type: "application/ld+json",
                dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbJsonLd) },
            }),
            render(),
        );
    };

    return Object.assign(Page, {
        generateMetadata: pageMetadata(pageKey),
    });
}

export async function createNoIndexPageMetadata(pageKey: SeoPageKey): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const page = getPageSeo(pageKey, locale);
    const route = findSeoRouteByPageKey(pageKey);
    const noIndexRoute = assertNoIndexSeoRoute(route?.path ?? page.path);

    return buildLocalizedMetadata({
        locale,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        path: noIndexRoute.path,
        robots: noIndexRobots(),
    });
}

export function noIndexPageMetadata(pageKey: SeoPageKey) {
    return () => createNoIndexPageMetadata(pageKey);
}

export async function createNoIndexRouteMetadata(path: string, title: string): Promise<Metadata> {
    const locale = await getRequestSeoLocale();
    const route = assertNoIndexSeoRoute(findSeoRouteByPath(path)?.path ?? path);

    return buildLocalizedMetadata({
        locale,
        title,
        path: route.path,
        robots: noIndexRobots(),
    });
}

export function noIndexRouteMetadata(path: string, title: string) {
    return () => createNoIndexRouteMetadata(path, title);
}

export interface DynamicMetadataResultOptions {
    title?: string;
    descriptionKind: DynamicSeoKind;
    descriptionValues: Parameters<typeof formatDynamicSeoDescription>[1];
    images?: string[];
    twitterCard?: "summary" | "summary_large_image";
    robots?: Metadata["robots"];
}

export interface CreateDynamicPageMetadataOptions<TData, TParams extends Record<string, string>> {
    params: Promise<TParams>;
    kind: DynamicSeoKind;
    routePrefix: string;
    getData: (params: TParams, region?: ContentRegion) => TData | null;
    build: (data: TData, context: { params: TParams; locale: UiLocale; path: string }) => DynamicMetadataResultOptions;
    buildPath?: (params: TParams) => string;
    fallbackTwitterCard?: "summary" | "summary_large_image";
}

function buildDynamicMetadataPath<TParams extends Record<string, string>>(
    routePrefix: string,
    params: TParams,
    buildPath?: (params: TParams) => string,
): string {
    if (buildPath) return normalizeSeoPath(buildPath(params));

    const suffix = Object.values(params).map((part) => encodeURIComponent(part)).join("/");
    return normalizeSeoPath(`/${routePrefix.replace(/^\/+|\/+$/g, "")}${suffix ? `/${suffix}` : ""}`);
}

export async function createDynamicPageMetadata<TData, TParams extends Record<string, string>>({
    params,
    kind,
    routePrefix,
    getData,
    build,
    buildPath,
    fallbackTwitterCard,
}: CreateDynamicPageMetadataOptions<TData, TParams>): Promise<Metadata> {
    const resolvedParams = await params;
    const locale = await getRequestSeoLocale();
    const region = getLocaleRouteConfig(getSeoRouteLocale(locale)).defaultServer;
    const path = buildDynamicMetadataPath(routePrefix, resolvedParams, buildPath);
    const data = getData(resolvedParams, region);

    if (!data) {
        return buildDetailMetadata({
            locale,
            title: getDynamicFallbackTitle(kind, locale),
            description: getDynamicFallbackDescription(kind, locale),
            path,
            twitterCard: fallbackTwitterCard,
            robots: missingDetailRobots(),
            alternateRouteLocales: [getSeoRouteLocale(locale)],
        });
    }

    const result = build(data, { params: resolvedParams, locale, path });

    return buildDetailMetadata({
        locale,
        title: result.title || formatDynamicSeoTitle(kind, result.descriptionValues, locale),
        description: formatDynamicSeoDescription(result.descriptionKind, result.descriptionValues, locale),
        path,
        images: result.images,
        twitterCard: result.twitterCard,
        robots: result.robots,
        alternateRouteLocales: getAvailableRouteLocales((alternateRegion) => getData(resolvedParams, alternateRegion)),
    });
}

export function dynamicPageMetadata<TData, TParams extends Record<string, string>>(options: Omit<CreateDynamicPageMetadataOptions<TData, TParams>, "params">) {
    return ({ params }: { params: Promise<TParams> }) => createDynamicPageMetadata({ ...options, params });
}

export interface DynamicPageStructuredDataOptions<TData, TParams extends Record<string, string>> {
    parentPageKey: SeoPageKey;
    getName: (data: TData | null, context: { params: TParams; locale: UiLocale; path: string }) => string;
}

export interface SeoDynamicPageOptions<TData, TParams extends Record<string, string>> extends Omit<CreateDynamicPageMetadataOptions<TData, TParams>, "params"> {
    render: (props: { params?: Promise<TParams> }) => ReactNode;
    structuredData?: DynamicPageStructuredDataOptions<TData, TParams>;
}

export function defineSeoDynamicPage<TData, TParams extends Record<string, string>>({
    render,
    structuredData,
    ...metadataOptions
}: SeoDynamicPageOptions<TData, TParams>) {
    const Page = async ({ params }: { params?: Promise<TParams> }) => {
        const resolvedParams = params ? await params : ({} as TParams);
        const locale = await getRequestSeoLocale();
        const region = getLocaleRouteConfig(getSeoRouteLocale(locale)).defaultServer;
        const path = buildDynamicMetadataPath(metadataOptions.routePrefix, resolvedParams, metadataOptions.buildPath);
        const data = metadataOptions.getData(resolvedParams, region);
        if (!data) notFound();
        if (!structuredData) return render({ params });
        const detailName = structuredData.getName(data, { params: resolvedParams, locale, path });
        const breadcrumbJsonLd = generateDetailBreadcrumbJsonLd(
            SITE_BASE_URL,
            structuredData.parentPageKey,
            { name: detailName, path },
            locale,
        );
        const scriptId = `${DETAIL_BREADCRUMB_SCRIPT_PREFIX}-${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "dynamic"}`;

        return createElement(
            Fragment,
            null,
            createElement("script", {
                id: scriptId,
                type: "application/ld+json",
                dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbJsonLd) },
            }),
            render({ params }),
        );
    };

    return Object.assign(Page, {
        generateMetadata: dynamicPageMetadata(metadataOptions),
    });
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
    alternateRouteLocales?: readonly RouteLocale[];
}

export interface DetailMetadataResultOptions {
    title: string;
    descriptionKind: DetailSeoKind;
    descriptionValues: Parameters<typeof formatDetailSeoDescription>[1];
    images?: string[];
    twitterCard?: "summary" | "summary_large_image";
    robots?: Metadata["robots"];
}

export interface DetailStructuredDataOptions<T = unknown> {
    parentPageKey: SeoPageKey;
    itemList?: {
        getName: (data: T, context: { id: string; numericId: number; locale: UiLocale; path: string }) => string;
    };
}

export interface CreateDynamicDetailMetadataOptions<T> {
    params: Promise<{ id: string }>;
    kind: DetailFallbackKind;
    routePrefix: string;
    getData: (id: number, region?: ContentRegion) => T | null;
    build: (data: T, context: { id: string; numericId: number; locale: UiLocale; path: string }) => DetailMetadataResultOptions;
    fallbackTwitterCard?: "summary" | "summary_large_image";
    structuredData?: DetailStructuredDataOptions<T>;
}

export function buildDetailMetadata({
    locale,
    title,
    description,
    path,
    images,
    twitterCard,
    robots,
    alternateRouteLocales,
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
        alternateRouteLocales,
    });
}

export async function createDetailFallbackMetadata(
    kind: DetailFallbackKind,
    path: string,
    twitterCard?: "summary" | "summary_large_image",
): Promise<Metadata> {
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
        twitterCard,
        robots: missingDetailRobots(),
        alternateRouteLocales: [getSeoRouteLocale(locale)],
    });
}

export async function createDynamicDetailMetadata<T>({
    params,
    kind,
    routePrefix,
    getData,
    build,
    fallbackTwitterCard,
}: CreateDynamicDetailMetadataOptions<T>): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const region = getLocaleRouteConfig(getSeoRouteLocale(locale)).defaultServer;
    const numericId = Number(id);
    const path = normalizeSeoPath(`/${routePrefix.replace(/^\/+|\/+$/g, "")}/${id}`);
    const data = Number.isFinite(numericId) ? getData(numericId, region) : null;

    if (!data) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle(kind, locale),
            description: kind === "exchange"
                ? formatDetailSeoDescription("exchangeFallback", {}, locale)
                : getDetailFallbackDescription(kind, locale),
            path,
            twitterCard: fallbackTwitterCard,
            robots: missingDetailRobots(),
            alternateRouteLocales: [getSeoRouteLocale(locale)],
        });
    }

    const result = build(data, { id, numericId, locale, path });

    return buildDetailMetadata({
        locale,
        title: result.title,
        description: formatDetailSeoDescription(result.descriptionKind, result.descriptionValues, locale),
        path,
        images: result.images,
        twitterCard: result.twitterCard,
        robots: result.robots,
        alternateRouteLocales: getAvailableRouteLocales((alternateRegion) => getData(numericId, alternateRegion)),
    });
}

export function dynamicDetailMetadata<T>(options: Omit<CreateDynamicDetailMetadataOptions<T>, "params">) {
    return ({ params }: { params: Promise<{ id: string }> }) => createDynamicDetailMetadata({ ...options, params });
}

export interface SeoDetailPageProps {
    params: Promise<{ id: string }>;
}

export interface SeoDetailPageOptions<T> extends Omit<CreateDynamicDetailMetadataOptions<T>, "params"> {
    render: (props: { params?: Promise<{ id: string }> }) => ReactNode;
}

export function defineSeoDetailPage<T>({ render, structuredData, ...metadataOptions }: SeoDetailPageOptions<T>) {
    const Page = async ({ params }: { params?: Promise<{ id: string }> }) => {
        const { id = "" } = params ? await params : {};
        const locale = await getRequestSeoLocale();
        const region = getLocaleRouteConfig(getSeoRouteLocale(locale)).defaultServer;
        const numericId = Number(id);
        const routePrefix = metadataOptions.routePrefix.replace(/^\/+|\/+$/g, "");
        const path = id ? normalizeSeoPath(`/${routePrefix}/${id}`) : normalizeSeoPath(`/${routePrefix}/`);
        const data = Number.isFinite(numericId) ? metadataOptions.getData(numericId, region) : null;
        if (!data) notFound();
        if (!structuredData) return render({ params });
        const context = { id, numericId, locale, path };
        const detailName = data
            ? metadataOptions.build(data, context).title
            : getDetailFallbackTitle(metadataOptions.kind, locale);
        const breadcrumbJsonLd = generateDetailBreadcrumbJsonLd(
            SITE_BASE_URL,
            structuredData.parentPageKey,
            { name: detailName, path },
            locale,
        );
        const itemListJsonLd = data && structuredData.itemList
            ? generateCollectionItemListJsonLd(
                SITE_BASE_URL,
                structuredData.parentPageKey,
                [{ id, name: structuredData.itemList.getName(data, context) }],
                locale,
            )
            : null;
        const scriptId = id ? `${DETAIL_BREADCRUMB_SCRIPT_PREFIX}-${routePrefix}-${id}` : `${DETAIL_BREADCRUMB_SCRIPT_PREFIX}-${routePrefix}`;

        return createElement(
            Fragment,
            null,
            createElement("script", {
                id: scriptId,
                type: "application/ld+json",
                dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbJsonLd) },
            }),
            itemListJsonLd
                ? createElement("script", {
                    id: `${scriptId}-itemlist`,
                    type: "application/ld+json",
                    dangerouslySetInnerHTML: { __html: JSON.stringify(itemListJsonLd) },
                })
                : null,
            render({ params }),
        );
    };

    return Object.assign(Page, {
        generateMetadata: dynamicDetailMetadata(metadataOptions),
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
