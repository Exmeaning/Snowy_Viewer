"use client";
import React from "react";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useEffect } from "react";
import type { NavGroupData } from "@/lib/navigation";
import { NAV_GROUP_LABEL_KEYS, NAV_ITEM_DESCRIPTION_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";

interface BreadcrumbGroupPageProps {
    group: NavGroupData;
}

/**
 * Nav-group tile.
 *
 * The .hh-tile recipe is written out instead of using the class: handheld-os.css
 * is unlayered while Tailwind utilities sit in `@layer utilities`, so .hh-tile's
 * `border` and `background` shorthands outrank the group-hover:* variants beside
 * them and the hover state would compile but never apply.
 */
const GROUP_TILE_CLASS =
    "bg-[var(--hh-surface-2)] border border-[var(--hh-border)] rounded-[var(--hh-radius-lg)] " +
    "shadow-[var(--hh-shadow-tile)] p-5 h-full " +
    "transition-colors duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] " +
    "group-hover:border-[var(--hh-accent)] group-hover:bg-[var(--hh-surface-3)]";

export default function BreadcrumbGroupPage({ group }: BreadcrumbGroupPageProps) {
    const { setDetailName } = useBreadcrumb();
    const { t } = useI18n();

    const groupLabel = t(NAV_GROUP_LABEL_KEYS[group.href] ?? group.href);
    const getItemLabel = (href: string) => t(NAV_ITEM_LABEL_KEYS[href] ?? href);
    const getItemDescription = (href: string) => t(NAV_ITEM_DESCRIPTION_KEYS[href] ?? "");

    useEffect(() => {
        setDetailName(null);
    }, [setDetailName]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Title */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-7 w-1.5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)]" />
                    <h1 className="hh-title text-2xl text-[var(--hh-text-primary)]">{groupLabel}</h1>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((item) => (
                        <Link key={item.href} href={item.href} className="hh-press hh-focusable group rounded-[var(--hh-radius-lg)]">
                            <div className={GROUP_TILE_CLASS}>
                                <h3 className="hh-title text-base font-bold text-[var(--hh-text-primary)]">
                                    {getItemLabel(item.href)}
                                </h3>
                                <p className="text-sm text-[var(--hh-text-secondary)] mt-1">
                                    {getItemDescription(item.href)}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
