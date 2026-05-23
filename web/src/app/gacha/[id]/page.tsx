import { Metadata } from "next";
import { Suspense } from "react";
import { getGachaLogoUrl } from "@/lib/assets";
import { getGachaMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import GachaDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const gacha = getGachaMeta(Number(id));
    if (!gacha) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("gacha", locale),
            description: getDetailFallbackDescription("gacha", locale),
            path: `/gacha/${id}`,
        });
    }

    const title = gacha.name;
    const description = formatDetailSeoDescription("gacha", { name: gacha.name }, locale);
    const ogImage = getGachaLogoUrl(gacha.asset, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/gacha/${id}`,
        images: [ogImage],
        twitterCard: "summary",
    });
}

export default function GachaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}
