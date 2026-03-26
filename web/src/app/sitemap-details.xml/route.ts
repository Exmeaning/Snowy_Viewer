import { NextResponse } from 'next/server';
import { getBaseUrl, buildDetailsSitemap } from '@/lib/sitemap';

export async function GET() {
    const baseUrl = await getBaseUrl();
    const xml = buildDetailsSitemap(baseUrl);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
