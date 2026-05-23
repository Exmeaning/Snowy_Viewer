"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavMatch, findGroupMatch, navigationGroups, NAV_GROUP_LABEL_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";

// Expand arrow button.
function ExpandButton({ open, onClick, ariaLabel }: { open: boolean; onClick: () => void; ariaLabel: string }) {
    return (
        <button
            onClick={onClick}
            className="p-0.5 -mr-0.5 rounded hover:bg-miku/10 transition-colors"
            aria-label={ariaLabel}
        >
            <svg
                className={`w-3 h-3 transition-transform duration-100 ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    );
}

// Dropdown panel.
function DropdownPanel({ children }: { children: React.ReactNode }) {
    return (
        <div className="absolute top-full left-0 mt-1 ios-glass-dropdown rounded-xl py-1 min-w-[10rem] z-[200] animate-breadcrumb-dropdown">
            {children}
        </div>
    );
}

// Dropdown item.
function DropdownItem({ href, isCurrent, children }: { href: string; isCurrent: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`block px-3 py-1.5 text-sm transition-all duration-200 whitespace-nowrap ${
                isCurrent
                    ? "text-miku font-semibold bg-miku/10 dark:bg-miku/15"
                    : "text-slate-600 dark:text-slate-300 hover:bg-miku/10 dark:hover:bg-miku/15 hover:text-miku dark:hover:text-miku"
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

    if (pathname === "/") return null;

    // Normalize pathname for comparisons.
    const norm = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

    // Summary group page.
    const groupMatch = findGroupMatch(pathname);
    if (groupMatch) {
        return (
            <div ref={dropdownRef} className="flex items-center gap-1.5">
                <span className="text-miku/30 shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-miku font-medium shrink-0 text-sm">
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
                <span className="text-miku/30 shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-miku/40 shrink-0 text-sm">...</span>
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

    return (
        <div ref={dropdownRef} className="flex items-center gap-1.5">
            {/* First level: group label with dropdown. */}
            <span className="text-miku/30 shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                    <Link
                        href={group.href}
                        className="text-miku/60 hover:text-miku transition-colors shrink-0 text-sm"
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
            <span className="text-miku/30 shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                {isDetailPage ? (
                    <Link
                        href={item.href}
                        className="text-miku/60 hover:text-miku transition-colors shrink-0 text-sm"
                    >
                        {getItemLabel(item.href)}
                    </Link>
                ) : (
                    <span className="text-miku font-medium shrink-0 text-sm">
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
                    <span className="text-miku/30 shrink-0">/</span>
                    <span className="text-miku font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">
                        {detail}
                    </span>
                </>
            )}
        </div>
    );
}
