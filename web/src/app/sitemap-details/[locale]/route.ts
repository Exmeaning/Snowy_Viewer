import { NextResponse } from 'next/server';

import { isRouteLocale } from '@/lib/locale-routing';
import { buildDetailsSitemap, getBaseUrl } from '@/lib/sitemap';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ locale: string }> },
) {
    const { locale: localeFile } = await params;
    const locale = localeFile.replace(/\.xml$/i, '').toLowerCase();

    if (!isRouteLocale(locale) || localeFile.toLowerCase() !== `${locale}.xml`) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const baseUrl = await getBaseUrl();
    const xml = buildDetailsSitemap(baseUrl, locale);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
    });
}
