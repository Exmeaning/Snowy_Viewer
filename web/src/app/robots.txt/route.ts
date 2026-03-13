import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/sitemap';

export async function GET() {
    const baseUrl = await getBaseUrl();

    const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /blank/
Disallow: /design-system/
Disallow: /leave/

Sitemap: ${baseUrl}/sitemap.xml
`;

    return new NextResponse(body, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
