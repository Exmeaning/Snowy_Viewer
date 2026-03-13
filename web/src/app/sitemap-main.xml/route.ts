import { NextResponse } from 'next/server';
import { getBaseUrl, buildMainSitemap } from '@/lib/sitemap';

export async function GET() {
    const baseUrl = await getBaseUrl();
    const xml = buildMainSitemap(baseUrl);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
