import { NextResponse } from 'next/server';
import { getBaseUrl, buildDetailsSitemapIndex } from '@/lib/sitemap';

export async function GET() {
    const baseUrl = await getBaseUrl();
    const xml = buildDetailsSitemapIndex(baseUrl);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
