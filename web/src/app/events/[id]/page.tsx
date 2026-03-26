import { Metadata } from "next";
import { Suspense } from "react";
import { getEventMeta } from "@/lib/metadata";
import EventDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const event = getEventMeta(Number(id));
    if (!event) return { title: "活动详情" };

    const title = event.name;
    const description = `Project Sekai 活动「${event.name}」`;
    const ogImage = `${OG_ASSET}/ondemand/event/${event.asset}/screen/bg.png`;

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
