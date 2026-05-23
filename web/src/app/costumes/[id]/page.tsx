import { Suspense } from "react";
import { getCostumeMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import CostumeDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "costume",
    routePrefix: "costumes",
    getData: getCostumeMeta,
    fallbackTwitterCard: "summary",
    build: (costume) => ({
        title: costume.name,
        descriptionKind: "costume",
        descriptionValues: { name: costume.name },
        twitterCard: "summary",
    }),
});

export default function CostumeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}
