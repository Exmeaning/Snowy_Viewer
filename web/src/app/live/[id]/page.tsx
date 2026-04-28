import { Metadata } from "next";
import { Suspense } from "react";
import { getVirtualLiveBannerUrl } from "@/lib/assets";
import { getVirtualLiveMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import VirtualLiveDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const live = getVirtualLiveMeta(Number(id));
    if (!live) return { title: "虚拟Live详情" };

    const title = live.name;
    const description = `Project Sekai 虚拟Live「${live.name}」` + DETAIL_SEO_SUFFIX;
    const ogImage = getVirtualLiveBannerUrl(live.asset, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
}

export default function VirtualLiveDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}
