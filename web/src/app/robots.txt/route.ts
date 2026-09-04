import { NextResponse } from 'next/server';
import { assertSeoRouteRegistryAligned, getRobotsDisallowPaths } from '@/lib/seo-routes';
import { getBaseUrl } from '@/lib/sitemap';
import { SUPPORTED_ROUTE_LOCALES } from '@/lib/locale-routing';

export async function GET() {
    const baseUrl = await getBaseUrl();
    assertSeoRouteRegistryAligned();
    const disallowPaths = getRobotsDisallowPaths();
    const disallowLines = SUPPORTED_ROUTE_LOCALES.flatMap((locale) =>
        disallowPaths.map((path) => `Disallow: /${locale}${path === '/' ? '/' : path}`),
    );

    const body = `User-agent: *
Allow: /
${disallowLines.join('\n')}

Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${baseUrl}/sitemap.xml
`;

    return new NextResponse(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            'Content-Signal': 'ai-train=no, search=yes, ai-input=yes',
        },
    });
}
