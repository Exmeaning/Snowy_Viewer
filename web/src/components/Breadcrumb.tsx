"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "@/components/LocalizedLink";
import { usePathname } from "next/navigation";
import { findNavMatch, findGroupMatch, navigationGroups, NAV_GROUP_LABEL_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { stripRouteLocale } from "@/lib/localized-path";

// Expand arrow button.
function ExpandButton({ open, onClick, ariaLabel }: { open: boolean; onClick: () => void; ariaLabel: string }) {
    return (
        <button
            onClick={onClick}
            className="hh-press p-0.5 -mr-0.5 rounded-[var(--hh-radius-xs)] hover:bg-[var(--hh-surface-sunken)]"
            aria-label={ariaLabel}
            aria-expanded={open}
        >
            <svg
                className={`w-3 h-3 transition-transform duration-[var(--hh-dur-fast)] ease-[var(--hh-ease-out)] ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    );
}

// Dropdown panel. A floating layer on the top bar, so it takes .hh-float's
// opaque surface and 16px corner rather than the old 24px glass sheet.
function DropdownPanel({ children }: { children: React.ReactNode }) {
    return (
        <div className="absolute top-full left-0 mt-1.5 hh-float py-1.5 min-w-[10rem] z-[200] animate-breadcrumb-dropdown">
            {children}
        </div>
    );
}

// Dropdown item. 8px — the interactive rung, one below the panel's own radius.
function DropdownItem({ href, isCurrent, children }: { href: string; isCurrent: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`hh-press block px-3 py-1.5 mx-1 text-sm font-medium whitespace-nowrap rounded-[var(--hh-radius-md)] ${
                isCurrent
                    ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] font-semibold"
                    : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
            }`}
        >
            {children}
        </Link>
    );
}

/**
 * Inline breadcrumb shown next to the top-bar logo.
 * Returns null on home or unmatched routes.
 * Text navigates directly; arrows open sibling navigation dropdowns.
 */
export default function Breadcrumb() {
    const pathname = usePathname();
    const { detailName, detailNode } = useBreadcrumb();
    const { t } = useI18n();
    const [openDropdown, setOpenDropdown] = useState<"group" | "item" | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns after route changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenDropdown(null);
    }, [pathname]);

    // Close on outside click or Escape.
    useEffect(() => {
        if (!openDropdown) return;

        const handleMouseDown = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenDropdown(null);
        };

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [openDropdown]);

    const toggleDropdown = useCallback((type: "group" | "item") => {
        setOpenDropdown((prev) => (prev === type ? null : type));
    }, []);

    const getGroupLabel = useCallback((href: string) => {
        return t(NAV_GROUP_LABEL_KEYS[href] ?? href);
    }, [t]);

    const getItemLabel = useCallback((href: string) => {
        return t(NAV_ITEM_LABEL_KEYS[href] ?? href);
    }, [t]);

    const routePathname = stripRouteLocale(pathname);
    if (routePathname === "/") return null;

    // Normalize pathname for comparisons.
    const norm = routePathname.endsWith("/") && routePathname !== "/"
        ? routePathname.slice(0, -1)
        : routePathname;

    // Summary group page.
    const groupMatch = findGroupMatch(pathname);
    if (groupMatch) {
        return (
            <div ref={dropdownRef} className="flex items-center gap-1.5 min-w-0">
                <span className="text-[var(--hh-text-tertiary)] shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-[var(--hh-accent)] font-semibold shrink-0 text-sm">
                        {getGroupLabel(groupMatch.href)}
                    </span>
                    <ExpandButton
                        open={openDropdown === "group"}
                        onClick={() => toggleDropdown("group")}
                        ariaLabel={t("layout.breadcrumb.expandGroup")}
                    />
                    {openDropdown === "group" && (
                        <DropdownPanel>
                            {navigationGroups.map((g) => (
                                <DropdownItem key={g.href} href={g.href} isCurrent={g.href === groupMatch.href}>
                                    {getGroupLabel(g.href)}
                                </DropdownItem>
                            ))}
                        </DropdownPanel>
                    )}
                </div>

                {/* Secondary navigation shortcut */}
                <span className="text-[var(--hh-text-tertiary)] shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-[var(--hh-text-tertiary)] shrink-0 text-sm">...</span>
                    <ExpandButton
                        open={openDropdown === "item"}
                        onClick={() => toggleDropdown("item")}
                        ariaLabel={t("layout.breadcrumb.expandItems")}
                    />
                    {openDropdown === "item" && (
                        <DropdownPanel>
                            {groupMatch.items.map((navItem) => (
                                <DropdownItem key={navItem.href} href={navItem.href} isCurrent={false}>
                                    {getItemLabel(navItem.href)}
                                </DropdownItem>
                            ))}
                        </DropdownPanel>
                    )}
                </div>
            </div>
        );
    }

    // Concrete navigation item page.
    const match = findNavMatch(pathname);
    if (!match) return null;

    const { group, item } = match;
    const isDetailPage = norm !== item.href;
    const detail = detailNode || detailName;

    // Only the segment the user is actually on carries the accent; ancestors and
    // separators are neutral text. An all-accent trail reads as decoration,
    // whereas one highlighted rung reads as "you are here".
    return (
        <div ref={dropdownRef} className="flex items-center gap-1.5 min-w-0">
            {/* First level: group label with dropdown. */}
            <span className="text-[var(--hh-text-tertiary)] shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                    <Link
                        href={group.href}
                        className="text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent)] transition-colors shrink-0 text-sm"
                    >
                        {getGroupLabel(group.href)}
                    </Link>
                    <ExpandButton
                        open={openDropdown === "group"}
                        onClick={() => toggleDropdown("group")}
                        ariaLabel={t("layout.breadcrumb.expandGroup")}
                    />

                {openDropdown === "group" && (
                    <DropdownPanel>
                            {navigationGroups.map((g) => (
                            <DropdownItem key={g.href} href={g.href} isCurrent={g.href === group.href}>
                                {getGroupLabel(g.href)}
                            </DropdownItem>
                        ))}

                    </DropdownPanel>
                )}
            </div>

            {/* Second level: item label with dropdown. */}
            <span className="text-[var(--hh-text-tertiary)] shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                {isDetailPage ? (
                    <Link
                        href={item.href}
                        className="text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent)] transition-colors shrink-0 text-sm"
                    >
                        {getItemLabel(item.href)}
                    </Link>
                ) : (
                    <span className="text-[var(--hh-accent)] font-semibold shrink-0 text-sm">
                        {getItemLabel(item.href)}
                    </span>
                )}
                <ExpandButton
                    open={openDropdown === "item"}
                    onClick={() => toggleDropdown("item")}
                    ariaLabel={t("layout.breadcrumb.expandItems")}
                />
                {openDropdown === "item" && (
                    <DropdownPanel>
                        {group.items.map((navItem) => (
                            <DropdownItem key={navItem.href} href={navItem.href} isCurrent={navItem.href === item.href}>
                                {getItemLabel(navItem.href)}
                            </DropdownItem>
                        ))}
                    </DropdownPanel>
                )}
            </div>

            {/* Third level: detail label without dropdown. */}
            {isDetailPage && detail && (
                <>
                    <span className="text-[var(--hh-text-tertiary)] shrink-0">/</span>
                    <span className="inline-block text-[var(--hh-accent)] font-semibold text-sm truncate max-w-[120px] sm:max-w-[200px] align-middle">
                        {detail}
                    </span>
                </>
            )}
        </div>
    );
}
