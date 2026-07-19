const PUBLIC_CACHE_ROOTS = new Set([
    "about",
    "cards",
    "character",
    "comic",
    "costumes",
    "events",
    "exchanges",
    "gacha",
    "guides",
    "honors",
    "information",
    "live",
    "manga",
    "materials",
    "music",
    "mysekai",
    "privacy",
    "soundtrack",
    "sticker",
    "story",
    "terms",
]);

const PUBLIC_DETAIL_CACHE_ROOTS = new Set([
    "cards",
    "character",
    "costumes",
    "events",
    "exchanges",
    "gacha",
    "guides",
    "live",
    "manga",
    "music",
    "mysekai",
    "story",
]);

const LIST_MAX_AGE_SECONDS = 300;
const LIST_SHARED_MAX_AGE_SECONDS = 3600;
const DETAIL_MAX_AGE_SECONDS = 3600;
const DETAIL_SHARED_MAX_AGE_SECONDS = 86400;
const STALE_WHILE_REVALIDATE_SECONDS = 604800;

export interface PublicPageCachePolicy {
    cacheControl: string;
    kind: "list" | "detail";
}

/**
 * Returns a shared-cache policy only for public, locale-stable HTML routes.
 * The path is the internal path after removing the explicit route locale.
 * Unknown routes deliberately remain private until they are reviewed.
 */
export function getPublicPageCachePolicy(internalPath: string): PublicPageCachePolicy | null {
    const segments = internalPath.split("/").filter(Boolean);

    if (segments.length === 0) {
        return {
            kind: "list",
            cacheControl: formatCacheControl(LIST_MAX_AGE_SECONDS, LIST_SHARED_MAX_AGE_SECONDS),
        };
    }

    const root = segments[0];
    if (!PUBLIC_CACHE_ROOTS.has(root)) return null;
    if (segments.length > 1 && !PUBLIC_DETAIL_CACHE_ROOTS.has(root)) return null;

    const kind = segments.length > 1 ? "detail" : "list";
    const maxAge = kind === "detail" ? DETAIL_MAX_AGE_SECONDS : LIST_MAX_AGE_SECONDS;
    const sharedMaxAge = kind === "detail" ? DETAIL_SHARED_MAX_AGE_SECONDS : LIST_SHARED_MAX_AGE_SECONDS;

    return {
        kind,
        cacheControl: formatCacheControl(maxAge, sharedMaxAge),
    };
}

function formatCacheControl(maxAge: number, sharedMaxAge: number): string {
    return `public, max-age=${maxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}
