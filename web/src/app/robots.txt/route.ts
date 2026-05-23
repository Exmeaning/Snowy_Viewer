import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/sitemap';
import { NON_INDEXABLE_SEO_ROUTES } from '@/lib/seo-routes';

export async function GET() {
    const baseUrl = await getBaseUrl();

    const disallowLines = [
        '/api/',
        ...NON_INDEXABLE_SEO_ROUTES.map((route) => route.path),
    ].map((path) => `Disallow: ${path}`);

    const body = `User-agent: *
Allow: /
${disallowLines.join('\n')}

Sitemap: ${baseUrl}/sitemap.xml
`;

    return new NextResponse(body, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
