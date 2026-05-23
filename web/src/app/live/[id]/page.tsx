import { Suspense } from "react";
import { getVirtualLiveBannerUrl } from "@/lib/assets";
import { getVirtualLiveMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import VirtualLiveDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "live",
    routePrefix: "live",
    getData: getVirtualLiveMeta,
    build: (live) => ({
        title: live.name,
        descriptionKind: "live",
        descriptionValues: { name: live.name },
        images: [getVirtualLiveBannerUrl(live.asset, "main-jp")],
    }),
});

export default function VirtualLiveDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}
