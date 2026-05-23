import { Suspense } from "react";
import { getMangaMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import MangaDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "manga",
    routePrefix: "manga",
    getData: getMangaMeta,
    build: (manga, { id }) => ({
        title: manga.title,
        descriptionKind: "manga",
        descriptionValues: { title: manga.title },
        images: [`https://moe.exmeaning.com/mangas/${id}.png`],
    }),
});

export default function MangaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MangaDetailClient />
        </Suspense>
    );
}
