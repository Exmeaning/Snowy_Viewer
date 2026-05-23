import { Suspense } from "react";
import { getEventBannerUrl } from "@/lib/assets";
import { getEventMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import EventDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "event",
    routePrefix: "events",
    getData: getEventMeta,
    build: (event) => ({
        title: event.name,
        descriptionKind: "event",
        descriptionValues: { name: event.name },
        images: [getEventBannerUrl(event.asset, "main-jp")],
    }),
});

export default function EventDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}
