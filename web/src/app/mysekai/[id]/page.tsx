import { Metadata } from "next";
import { Suspense } from "react";
import { getMysekaiFixtureThumbnailUrl } from "@/lib/assets";
import { getFixtureMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import MysekaiFixtureDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const fixture = getFixtureMeta(Number(id));
    if (!fixture) return { title: "Furniture Details" };

    const title = fixture.name;
    const description = fixture.flavor
        ? `Project SEKAI furniture "${fixture.name}" - ${fixture.flavor.slice(0, 100)}` + DETAIL_SEO_SUFFIX
        : `Project SEKAI furniture "${fixture.name}"` + DETAIL_SEO_SUFFIX;
    const ogImage = getMysekaiFixtureThumbnailUrl(fixture.asset, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
}

export default function MysekaiFixtureDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}
