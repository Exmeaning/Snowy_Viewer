import { getGuideMeta } from "@/lib/metadata";
import { dynamicPageMetadata } from "@/lib/seo-metadata";

function joinTags(tags: readonly string[] | undefined): string {
    return tags && tags.length > 0 ? tags.join(", ") : "PROJECT SEKAI";
}

export const guideDetailMetadata = dynamicPageMetadata({
    kind: "guide",
    routePrefix: "guides",
    getData: ({ id }: { id: string }) => getGuideMeta(id),
    fallbackTwitterCard: "summary",
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
});
