"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes } from "react";

import { getRouteLocaleFromPathname, localizePath } from "@/lib/localized-path";
import { DEFAULT_ROUTE_LOCALE } from "@/lib/locale-routing";

type LocalizedLinkProps = LinkProps
    & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>
    & { children?: React.ReactNode };

export default function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
    const pathname = usePathname();
    const locale = getRouteLocaleFromPathname(pathname) ?? DEFAULT_ROUTE_LOCALE;
    const localizedHref = typeof href === "string"
        ? localizePath(href, locale)
        : { ...href, pathname: href.pathname ? localizePath(String(href.pathname), locale) : href.pathname };

    return <Link href={localizedHref} {...props} />;
}
