import { Suspense } from "react";
import { getGachaLogoUrl } from "@/lib/assets";
import { getGachaMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import GachaDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "gacha",
    routePrefix: "gacha",
    getData: getGachaMeta,
    build: (gacha) => ({
        title: gacha.name,
        descriptionKind: "gacha",
        descriptionValues: { name: gacha.name },
        images: [getGachaLogoUrl(gacha.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export default function GachaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}
