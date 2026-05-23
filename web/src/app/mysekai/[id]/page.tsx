import { Suspense } from "react";
import { getMysekaiFixtureThumbnailUrl } from "@/lib/assets";
import { getFixtureMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import { formatMysekaiFlavorSuffix } from "@/lib/seo-keywords";
import MysekaiFixtureDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "mysekai",
    routePrefix: "mysekai",
    getData: getFixtureMeta,
    build: (fixture, { locale }) => ({
        title: fixture.name,
        descriptionKind: "mysekai",
        descriptionValues: {
            name: fixture.name,
            flavorSuffix: formatMysekaiFlavorSuffix(fixture.flavor, locale),
        },
        images: [getMysekaiFixtureThumbnailUrl(fixture.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export default function MysekaiFixtureDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}
