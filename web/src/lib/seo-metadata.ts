import type { Metadata } from "next";
import { createElement, Fragment, type ReactNode } from "react";
import { cookies, headers } from "next/headers";

import {
    DEFAULT_UI_LOCALE,
    UI_LOCALE_STORAGE_KEY,
    resolveAcceptLanguageUiLocale,
    resolveUiLocale,
    type UiLocale,
} from "@/lib/i18n/locales";
import { assertNoIndexSeoRoute, findSeoRouteByPageKey, findSeoRouteByPath, isIndexableSeoPath, normalizeSeoPath } from "@/lib/seo-routes";
import { generateDetailBreadcrumbJsonLd, generatePageBreadcrumbJsonLd } from "@/lib/structured-data";
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
    getData: (params: TParams) => TData | null;
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
    const path = buildDynamicMetadataPath(routePrefix, resolvedParams, buildPath);
    const data = getData(resolvedParams);

    if (!data) {
        return buildDetailMetadata({
            locale,
            title: getDynamicFallbackTitle(kind, locale),
            description: getDynamicFallbackDescription(kind, locale),
            path,
            twitterCard: fallbackTwitterCard,
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
        if (!structuredData) return render({ params });

        const resolvedParams = params ? await params : ({} as TParams);
        const locale = await getRequestSeoLocale();
        const path = buildDynamicMetadataPath(metadataOptions.routePrefix, resolvedParams, metadataOptions.buildPath);
        const data = metadataOptions.getData(resolvedParams);
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
}

export interface DetailMetadataResultOptions {
    title: string;
    descriptionKind: DetailSeoKind;
    descriptionValues: Parameters<typeof formatDetailSeoDescription>[1];
    images?: string[];
    twitterCard?: "summary" | "summary_large_image";
    robots?: Metadata["robots"];
}

export interface DetailStructuredDataOptions {
    parentPageKey: SeoPageKey;
}

export interface CreateDynamicDetailMetadataOptions<T> {
    params: Promise<{ id: string }>;
    kind: DetailFallbackKind;
    routePrefix: string;
    getData: (id: number) => T | null;
    build: (data: T, context: { id: string; numericId: number; locale: UiLocale; path: string }) => DetailMetadataResultOptions;
    fallbackTwitterCard?: "summary" | "summary_large_image";
    structuredData?: DetailStructuredDataOptions;
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
    const numericId = Number(id);
    const path = normalizeSeoPath(`/${routePrefix.replace(/^\/+|\/+$/g, "")}/${id}`);
    const data = Number.isFinite(numericId) ? getData(numericId) : null;

    if (!data) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle(kind, locale),
            description: kind === "exchange"
                ? formatDetailSeoDescription("exchangeFallback", {}, locale)
                : getDetailFallbackDescription(kind, locale),
            path,
            twitterCard: fallbackTwitterCard,
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
        if (!structuredData) return render({ params });

        const { id = "" } = params ? await params : {};
        const locale = await getRequestSeoLocale();
        const numericId = Number(id);
        const routePrefix = metadataOptions.routePrefix.replace(/^\/+|\/+$/g, "");
        const path = id ? normalizeSeoPath(`/${routePrefix}/${id}`) : normalizeSeoPath(`/${routePrefix}/`);
        const data = Number.isFinite(numericId) ? metadataOptions.getData(numericId) : null;
        const detailName = data
            ? metadataOptions.build(data, { id, numericId, locale, path }).title
            : getDetailFallbackTitle(metadataOptions.kind, locale);
        const breadcrumbJsonLd = generateDetailBreadcrumbJsonLd(
            SITE_BASE_URL,
            structuredData.parentPageKey,
            { name: detailName, path },
            locale,
        );

        return createElement(
            Fragment,
            null,
            createElement("script", {
                id: id ? `${DETAIL_BREADCRUMB_SCRIPT_PREFIX}-${routePrefix}-${id}` : `${DETAIL_BREADCRUMB_SCRIPT_PREFIX}-${routePrefix}`,
                type: "application/ld+json",
                dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbJsonLd) },
            }),
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
