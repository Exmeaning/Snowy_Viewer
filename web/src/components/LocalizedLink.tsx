"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";

import { useI18n } from "@/contexts/I18nContext";
import { localizePath } from "@/lib/localized-path";
import { uiLocaleToRouteLocale } from "@/lib/locale-routing";

type LocalizedLinkProps = LinkProps
    & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>
    & { children?: React.ReactNode };

export default function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
    const { locale } = useI18n();
    const routeLocale = uiLocaleToRouteLocale(locale);
    const localizedHref = typeof href === "string"
        ? localizePath(href, routeLocale)
        : { ...href, pathname: href.pathname ? localizePath(String(href.pathname), routeLocale) : href.pathname };

    return <Link href={localizedHref} {...props} />;
}
