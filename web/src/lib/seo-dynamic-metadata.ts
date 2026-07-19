import { getGuideMeta } from "@/lib/metadata";
import type { ReactNode } from "react";
import { defineSeoDynamicPage } from "@/lib/seo-metadata";

function joinTags(tags: readonly string[] | undefined): string {
    return tags && tags.length > 0 ? tags.join(", ") : "PROJECT SEKAI";
}

export const defineGuideDetailPage = (render: (props: { params?: Promise<{ id: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "guide",
    routePrefix: "guides",
    getData: ({ id }: { id: string }) => getGuideMeta(id),
    fallbackTwitterCard: "summary",
    structuredData: {
        parentPageKey: "guides",
        getName: (guide) => guide?.title ?? "Guide",
        entity: {
            type: "Article",
            getDatePublished: (guide) => guide.date || undefined,
            getAuthorName: (guide) => guide.authorGroup || undefined,
        },
    },
    build: (guide) => ({
        title: guide.title,
        descriptionKind: "guide",
        descriptionValues: {
            title: guide.title,
            category: guide.category || "Guide",
            tags: joinTags(guide.tags),
        },
        twitterCard: "summary",
    }),
    render,
});
