import { Metadata } from "next";
import { Suspense } from "react";
import { getEventBannerUrl } from "@/lib/assets";
import { getEventMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import EventDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const event = getEventMeta(Number(id));
    if (!event) return { title: "Event Detail" };

    const title = event.name;
    const description = `Project Sekai Event "${event.name}"` + DETAIL_SEO_SUFFIX;
    const ogImage = getEventBannerUrl(event.asset, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
}

export default function EventDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}
