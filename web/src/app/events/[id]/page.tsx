import { Metadata } from "next";
import { Suspense } from "react";
import { getEventBannerUrl } from "@/lib/assets";
import { getEventMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import EventDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const event = getEventMeta(Number(id));
    if (!event) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("event", locale),
            description: getDetailFallbackTitle("event", locale),
            path: `/events/${id}`,
        });
    }

    const title = event.name;
    const description = formatDetailSeoDescription("event", { name: event.name }, locale);
    const ogImage = getEventBannerUrl(event.asset, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/events/${id}`,
        images: [ogImage],
    });
}

export default function EventDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}
