import { Metadata } from "next";
import { Suspense } from "react";
import { getGachaLogoUrl } from "@/lib/assets";
import { getGachaMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import GachaDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const gacha = getGachaMeta(Number(id));
    if (!gacha) return { title: "Gacha Detail" };

    const title = gacha.name;
    const description = `Project SEKAI Gacha: ${gacha.name}` + DETAIL_SEO_SUFFIX;
    const ogImage = getGachaLogoUrl(gacha.asset, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
}

export default function GachaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}
