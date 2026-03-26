import { Metadata } from "next";
import { Suspense } from "react";
import { getVirtualLiveMeta } from "@/lib/metadata";
import VirtualLiveDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const live = getVirtualLiveMeta(Number(id));
    if (!live) return { title: "虚拟Live详情" };

    const title = live.name;
    const description = `Project Sekai 虚拟Live「${live.name}」`;
    const ogImage = `${OG_ASSET}/ondemand/virtual_live/select/banner/${live.asset}/${live.asset}.png`;

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
