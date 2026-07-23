/**
 * Shared sitemap utilities.
 * 
 * Reads the pre-generated sitemap-data.json and builds XML
 * against the configured canonical origin.
 */

import fs from 'fs';
import path from 'path';
import { INDEXABLE_SEO_ROUTES } from '@/lib/seo-routes';
import { DEFAULT_ROUTE_LOCALE, getLocaleRouteConfig, SUPPORTED_ROUTE_LOCALES, type RouteLocale } from '@/lib/locale-routing';
import { getCanonicalOrigin } from '@/lib/site-origin';

interface SitemapRoute {
    path: string;
    lastmod?: string;
    priority: number;
    changefreq: string;
}

interface SitemapData {
    generatedAt: string;
    mainRoutes: SitemapRoute[];
    detailRoutes: SitemapRoute[];
}

// Process-level cache, isolated per content region.
const cached = new Map<string, SitemapData | null>();

function getData(region: string): SitemapData | null {
    if (cached.has(region)) return cached.get(region) ?? null;
    try {
        const dataDir = path.join(process.cwd(), 'public', 'data');
        const regionalPath = path.join(dataDir, `sitemap-data.${region}.json`);
        const jpPath = path.join(dataDir, 'sitemap-data.jp.json');
        const legacyPath = path.join(dataDir, 'sitemap-data.json');

        const filePath = fs.existsSync(regionalPath)
            ? regionalPath
            : fs.existsSync(jpPath)
                ? jpPath
                : legacyPath;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as SitemapData;
        cached.set(region, data);
        return data;
    } catch {
        cached.set(region, null);
        return null;
    }
}

/**
 * Resolve the configured canonical origin without reflecting request headers.
 */
export async function getBaseUrl(): Promise<string> {
    return getCanonicalOrigin();
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function joinUrl(baseUrl: string, routePath: string): string {
    return `${baseUrl.replace(/\/$/, '')}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function localizedRoutePath(routePath: string, locale: RouteLocale): string {
    const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `/${locale}${normalized === '/' ? '/' : normalized}`;
}

function buildUrlEntry(
    baseUrl: string,
    route: SitemapRoute,
    fallbackLastmod: string,
    locale: RouteLocale,
    hasAlternate: (locale: RouteLocale, path: string) => boolean = () => true,
): string {
    const lastmod = route.lastmod || fallbackLastmod;
    const alternates = SUPPORTED_ROUTE_LOCALES.filter((alternateLocale) => hasAlternate(alternateLocale, route.path)).map((alternateLocale) => {
        const hreflang = getLocaleRouteConfig(alternateLocale).uiLocale;
        return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(joinUrl(baseUrl, localizedRoutePath(route.path, alternateLocale)))}" />`;
    });
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(joinUrl(baseUrl, localizedRoutePath(route.path, DEFAULT_ROUTE_LOCALE)))}" />`);
    return `  <url>
    <loc>${escapeXml(joinUrl(baseUrl, localizedRoutePath(route.path, locale)))}</loc>
${alternates.join('\n')}
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(route.changefreq)}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
}

function wrapUrlset(entries: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;
}

function validGeneratedAt(data: SitemapData | null): string | null {
    if (!data?.generatedAt || Number.isNaN(Date.parse(data.generatedAt))) return null;
    return data.generatedAt;
}

function detailSitemapLastmod(locale: RouteLocale): string {
    const region = getLocaleRouteConfig(locale).defaultServer;
    return validGeneratedAt(getData(region)) ?? '1970-01-01T00:00:00.000Z';
}

function mainSitemapLastmod(): string {
    return SUPPORTED_ROUTE_LOCALES
        .map(detailSitemapLastmod)
        .sort()
        .at(-1) ?? '1970-01-01T00:00:00.000Z';
}

function wrapSitemapIndex(baseUrl: string, sitemaps: { name: string; lastmod: string }[]): string {
    const entries = sitemaps.map(({ name, lastmod }) => `  <sitemap>
    <loc>${escapeXml(joinUrl(baseUrl, `/${name}`))}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </sitemap>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;
}

export function buildSitemapIndex(baseUrl: string): string {
    return wrapSitemapIndex(baseUrl, [
        { name: 'sitemap-main.xml', lastmod: mainSitemapLastmod() },
        ...SUPPORTED_ROUTE_LOCALES.map(locale => ({
            name: `sitemap-details/${locale}.xml`,
            lastmod: detailSitemapLastmod(locale),
        })),
    ]);
}

export function buildDetailsSitemapIndex(baseUrl: string): string {
    return wrapSitemapIndex(
        baseUrl,
        SUPPORTED_ROUTE_LOCALES.map(locale => ({
            name: `sitemap-details/${locale}.xml`,
            lastmod: detailSitemapLastmod(locale),
        })),
    );
}

export function buildMainSitemap(baseUrl: string): string {
    const currentIndexablePaths = new Set(INDEXABLE_SEO_ROUTES.map(route => route.path));
    const entries = SUPPORTED_ROUTE_LOCALES.flatMap((locale) => {
        const region = getLocaleRouteConfig(locale).defaultServer;
        const data = getData(region);
        const fallbackLastmod = data?.generatedAt || '1970-01-01T00:00:00.000Z';
        const mainRoutes = data?.mainRoutes?.length
            ? data.mainRoutes.filter(route => currentIndexablePaths.has(route.path))
            : INDEXABLE_SEO_ROUTES.map((route) => ({
                path: route.path,
                priority: route.priority,
                changefreq: route.changefreq,
            }));
        return mainRoutes.map((route) => buildUrlEntry(baseUrl, route, fallbackLastmod, locale));
    });
    return wrapUrlset(entries);
}

export function buildDetailsSitemap(baseUrl: string, locale: RouteLocale): string {
    const routeSets = new Map<RouteLocale, Set<string>>(
        SUPPORTED_ROUTE_LOCALES.map((locale) => {
            const region = getLocaleRouteConfig(locale).defaultServer;
            return [locale, new Set((getData(region)?.detailRoutes ?? []).map((route) => route.path))];
        }),
    );
    const region = getLocaleRouteConfig(locale).defaultServer;
    const data = getData(region);
    if (!data) return wrapUrlset([]);
    const fallbackLastmod = data.generatedAt || '1970-01-01T00:00:00.000Z';
    const entries = data.detailRoutes.map((route) => buildUrlEntry(
        baseUrl,
        route,
        fallbackLastmod,
        locale,
        (alternateLocale, routePath) => routeSets.get(alternateLocale)?.has(routePath) ?? false,
    ));
    return wrapUrlset(entries);
}
