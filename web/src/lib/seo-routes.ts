import type { SeoPageKey } from "@/lib/seo-keywords";
import SEO_ROUTE_DATA from "./seo-routes-data.json";

export type SeoSitemapGroup = "main";
export type SeoChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SeoRouteDefinition {
    path: string;
    pageKey?: SeoPageKey;
    priority: number;
    changefreq: SeoChangeFrequency;
    indexable: boolean;
    sitemapGroup: SeoSitemapGroup;
    excludeReason?: string;
}

type RawSeoRouteDefinition = Omit<SeoRouteDefinition, "pageKey" | "sitemapGroup"> & {
    pageKey?: SeoPageKey;
};

export const SEO_ROUTES = (SEO_ROUTE_DATA as readonly RawSeoRouteDefinition[]).map((route) => ({
    ...route,
    sitemapGroup: "main" as const,
})) satisfies SeoRouteDefinition[];

export const INDEXABLE_SEO_ROUTES = SEO_ROUTES.filter((route) => route.indexable);
export const NON_INDEXABLE_SEO_ROUTES = SEO_ROUTES.filter((route) => !route.indexable);

export function normalizeSeoPath(path: string): string {
    if (!path || path === "/") return "/";
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function findSeoRouteByPath(path: string): SeoRouteDefinition | undefined {
    const normalized = normalizeSeoPath(path);
    return SEO_ROUTES.find((route) => normalizeSeoPath(route.path) === normalized);
}

export function isIndexableSeoPath(path: string): boolean {
    return findSeoRouteByPath(path)?.indexable ?? true;
}
