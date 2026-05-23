import { Metadata } from "next";
import { Suspense } from "react";
import { getVirtualLiveBannerUrl } from "@/lib/assets";
import { getVirtualLiveMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import VirtualLiveDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const live = getVirtualLiveMeta(Number(id));
    if (!live) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("live", locale),
            description: getDetailFallbackDescription("live", locale),
            path: `/live/${id}`,
        });
    }

    const title = live.name;
    const description = formatDetailSeoDescription("live", { name: live.name }, locale);
    const ogImage = getVirtualLiveBannerUrl(live.asset, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/live/${id}`,
        images: [ogImage],
    });
}

export default function VirtualLiveDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}
