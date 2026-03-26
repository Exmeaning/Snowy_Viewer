/**
 * Shared sitemap utilities.
 * 
 * Reads the pre-generated sitemap-data.json and builds XML
 * with the correct base URL derived from the request Host header.
 */

import fs from 'fs';
import path from 'path';
import { headers } from 'next/headers';

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

// Process-level cache
let cached: SitemapData | null = null;

function getData(): SitemapData | null {
    if (cached) return cached;
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'sitemap-data.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        cached = JSON.parse(raw);
        return cached;
    } catch {
        return null;
    }
}

/**
 * Resolve the base URL from the request Host header.
 * Falls back to NEXT_PUBLIC_SITE_DOMAIN env or pjsk.moe.
 */
export async function getBaseUrl(): Promise<string> {
    try {
        const headersList = await headers();
        const host = headersList.get('host');
        if (host) {
            const proto = headersList.get('x-forwarded-proto') || 'https';
            return `${proto}://${host}`;
        }
    } catch {
        // headers() not available outside request context
    }
    return process.env.NEXT_PUBLIC_SITE_DOMAIN || 'https://pjsk.moe';
}

function buildUrlEntry(baseUrl: string, route: SitemapRoute): string {
    const lastmod = route.lastmod || new Date().toISOString();
    return `  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
}

function wrapUrlset(entries: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;
}

function wrapSitemapIndex(baseUrl: string, sitemapNames: string[]): string {
    const now = new Date().toISOString();
    const entries = sitemapNames.map(name => `  <sitemap>
    <loc>${baseUrl}/${name}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;
}

export function buildSitemapIndex(baseUrl: string): string {
    return wrapSitemapIndex(baseUrl, ['sitemap-main.xml', 'sitemap-details.xml']);
}

export function buildMainSitemap(baseUrl: string): string {
    const data = getData();
    if (!data) return wrapUrlset([]);
    const entries = data.mainRoutes.map(r => buildUrlEntry(baseUrl, r));
    return wrapUrlset(entries);
}

export function buildDetailsSitemap(baseUrl: string): string {
    const data = getData();
    if (!data) return wrapUrlset([]);
    const entries = data.detailRoutes.map(r => buildUrlEntry(baseUrl, r));
    return wrapUrlset(entries);
}
