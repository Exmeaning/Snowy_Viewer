import { Metadata } from "next";
import { Suspense } from "react";
import { getMysekaiFixtureThumbnailUrl } from "@/lib/assets";
import { getFixtureMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import {
    formatDetailSeoDescription,
    formatMysekaiFlavorSuffix,
    getDetailFallbackTitle,
} from "@/lib/seo-keywords";
import MysekaiFixtureDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const fixture = getFixtureMeta(Number(id));
    if (!fixture) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("mysekai", locale),
            description: getDetailFallbackTitle("mysekai", locale),
            path: `/mysekai/${id}`,
        });
    }

    const title = fixture.name;
    const description = formatDetailSeoDescription(
        "mysekai",
        {
            name: fixture.name,
            flavorSuffix: formatMysekaiFlavorSuffix(fixture.flavor, locale),
        },
        locale,
    );
    const ogImage = getMysekaiFixtureThumbnailUrl(fixture.asset, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/mysekai/${id}`,
        images: [ogImage],
        twitterCard: "summary",
    });
}

export default function MysekaiFixtureDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}
