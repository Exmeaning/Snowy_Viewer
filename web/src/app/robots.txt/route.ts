import { NextResponse } from 'next/server';
import { assertRobotsDisallowPathsAligned, getRobotsDisallowPaths } from '@/lib/seo-routes';
import { getBaseUrl } from '@/lib/sitemap';

export async function GET() {
    const baseUrl = await getBaseUrl();
    const disallowPaths = getRobotsDisallowPaths();
    assertRobotsDisallowPathsAligned(disallowPaths);
    const disallowLines = disallowPaths.map((path) => `Disallow: ${path}`);

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
