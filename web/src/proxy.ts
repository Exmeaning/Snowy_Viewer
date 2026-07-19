import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
    DEFAULT_ROUTE_LOCALE,
    isRouteLocale,
    uiLocaleToRouteLocale,
} from "@/lib/locale-routing";
import { resolveAcceptLanguageUiLocale, resolveUiLocale, UI_LOCALE_STORAGE_KEY } from "@/lib/i18n/locales";
import { getPublicPageCachePolicy } from "@/lib/page-cache-policy";

export const ROUTE_LOCALE_HEADER = "x-moesekai-route-locale";
export const PUBLIC_PATH_HEADER = "x-moesekai-public-path";
const QUERY_PAGE_ROBOTS_POLICY = "noindex, follow";
const QUERY_PAGE_CACHE_POLICY = "private, no-store";

const BYPASS_PATHS = ["/_next", "/api", "/data", "/robots.txt", "/sitemap.xml", "/sitemap-main.xml", "/sitemap-details.xml"];
const FILE_PATH_PATTERN = /\.[a-z0-9]+$/i;

function shouldBypass(pathname: string): boolean {
    return BYPASS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
        || FILE_PATH_PATTERN.test(pathname);
}

function preferredRouteLocale(request: NextRequest) {
    const cookieLocale = resolveUiLocale(request.cookies.get(UI_LOCALE_STORAGE_KEY)?.value);
    if (cookieLocale) return uiLocaleToRouteLocale(cookieLocale);

    const acceptedLocale = resolveAcceptLanguageUiLocale(request.headers.get("accept-language"));
    return acceptedLocale ? uiLocaleToRouteLocale(acceptedLocale) : DEFAULT_ROUTE_LOCALE;
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (shouldBypass(pathname)) return NextResponse.next();

    const segments = pathname.split("/").filter(Boolean);
    const candidate = segments[0]?.toLowerCase();

    if (candidate && isRouteLocale(candidate)) {
        const routeLocale = candidate;
        const internalPath = `/${segments.slice(1).join("/")}${pathname.endsWith("/") && segments.length > 1 ? "/" : ""}`;
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = internalPath === "//" ? "/" : internalPath;

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(ROUTE_LOCALE_HEADER, routeLocale);
        requestHeaders.set(PUBLIC_PATH_HEADER, pathname);

        const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
        const isDocumentRequest = request.method === "GET" || request.method === "HEAD";
        const hasQuery = Boolean(request.nextUrl.search);

        if (isDocumentRequest && hasQuery) {
            // Filter, sort, search, pagination and share-state URLs can create an
            // unbounded number of equivalent crawl targets. Keep them usable and
            // crawlable, but consolidate indexing on the clean canonical URL that
            // page metadata already emits.
            response.headers.set("X-Robots-Tag", QUERY_PAGE_ROBOTS_POLICY);
            response.headers.set("Cache-Control", QUERY_PAGE_CACHE_POLICY);
        } else if (isDocumentRequest) {
            const cachePolicy = getPublicPageCachePolicy(internalPath);
            if (cachePolicy) response.headers.set("Cache-Control", cachePolicy.cacheControl);
        }
        return response;
    }

    if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

    const locale = preferredRouteLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname === "/" ? `/${locale}/` : `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
    const response = NextResponse.redirect(redirectUrl, 307);
    response.headers.append("Vary", "Cookie, Accept-Language");
    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
