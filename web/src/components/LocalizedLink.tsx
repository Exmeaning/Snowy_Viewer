"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

import { useI18n } from "@/contexts/I18nContext";
import { localizePath } from "@/lib/localized-path";
import { playHandheldSound } from "@/lib/handheld-sound";

type LocalizedLinkProps = LinkProps
    & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>
    & { children?: React.ReactNode };

export default function LocalizedLink({ href, onClick, ...props }: LocalizedLinkProps) {
    const { routeLocale } = useI18n();
    const localizedHref = typeof href === "string"
        ? localizePath(href, routeLocale)
        : { ...href, pathname: href.pathname ? localizePath(String(href.pathname), routeLocale) : href.pathname };

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        playHandheldSound("confirm");
        onClick?.(e);
    };

    return <Link href={localizedHref} onClick={handleClick} {...props} />;
}
