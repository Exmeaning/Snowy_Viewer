"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavMatch, findGroupMatch, navigationGroups } from "@/lib/navigation";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";

/** 展开箭头按钮 */
function ExpandButton({ open, onClick }: { open: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="p-0.5 -mr-0.5 rounded hover:bg-miku/10 transition-colors"
            aria-label="展开导航"
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

/** 下拉面板 */
function DropdownPanel({ children }: { children: React.ReactNode }) {
    return (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 py-1 min-w-[10rem] z-[200] animate-breadcrumb-dropdown">
            {children}
        </div>
    );
}

/** 下拉选项 */
function DropdownItem({ href, isCurrent, children }: { href: string; isCurrent: boolean; children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className={`block px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
                isCurrent
                    ? "text-miku font-medium bg-miku/5"
                    : "text-slate-600 hover:bg-miku/10 hover:text-miku"
            }`}
        >
            {children}
        </Link>
    );
}

/**
 * 内联面包屑，嵌入顶栏 Logo 右侧。
 * 首页或无法匹配时返回 null。
 * 文字点击跳转，箭头点击展开下拉切换同级导航。
 */
export default function Breadcrumb() {
    const pathname = usePathname();
    const { detailName, detailNode } = useBreadcrumb();
    const [openDropdown, setOpenDropdown] = useState<"group" | "item" | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 路由变化时关闭下拉
    useEffect(() => {
        setOpenDropdown(null);
    }, [pathname]);

    // 点击外部 / Escape 关闭
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

    if (pathname === "/") return null;

    // 标准化 pathname（去尾部斜杠）用于比较
    const norm = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

    // ── 分组汇总页 ──
    const groupMatch = findGroupMatch(pathname);
    if (groupMatch) {
        return (
            <div ref={dropdownRef} className="flex items-center gap-1.5">
                <span className="text-miku/30 shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-miku font-medium shrink-0 text-sm">
                        {groupMatch.title}
                    </span>
                    <ExpandButton open={openDropdown === "group"} onClick={() => toggleDropdown("group")} />
                    {openDropdown === "group" && (
                        <DropdownPanel>
                            {navigationGroups.map((g) => (
                                <DropdownItem key={g.href} href={g.href} isCurrent={g.href === groupMatch.href}>
                                    {g.title}
                                </DropdownItem>
                            ))}
                        </DropdownPanel>
                    )}
                </div>

                {/* 二级导航快捷入口 */}
                <span className="text-miku/30 shrink-0">/</span>
                <div className="relative flex items-center gap-0.5">
                    <span className="text-miku/40 shrink-0 text-sm">...</span>
                    <ExpandButton open={openDropdown === "item"} onClick={() => toggleDropdown("item")} />
                    {openDropdown === "item" && (
                        <DropdownPanel>
                            {groupMatch.items.map((navItem) => (
                                <DropdownItem key={navItem.href} href={navItem.href} isCurrent={false}>
                                    {navItem.name}
                                </DropdownItem>
                            ))}
                        </DropdownPanel>
                    )}
                </div>
            </div>
        );
    }

    // ── 具体导航项页面 ──
    const match = findNavMatch(pathname);
    if (!match) return null;

    const { group, item } = match;
    const isDetailPage = norm !== item.href;
    const detail = detailNode || detailName;

    return (
        <div ref={dropdownRef} className="flex items-center gap-1.5">
            {/* 一级：分组名 — 文字跳转，箭头展开 */}
            <span className="text-miku/30 shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                <Link
                    href={group.href}
                    className="text-miku/60 hover:text-miku transition-colors shrink-0 text-sm"
                >
                    {group.title}
                </Link>
                <ExpandButton open={openDropdown === "group"} onClick={() => toggleDropdown("group")} />
                {openDropdown === "group" && (
                    <DropdownPanel>
                        {navigationGroups.map((g) => (
                            <DropdownItem key={g.href} href={g.href} isCurrent={g.href === group.href}>
                                {g.title}
                            </DropdownItem>
                        ))}
                    </DropdownPanel>
                )}
            </div>

            {/* 二级：导航项名 — 文字跳转，箭头展开 */}
            <span className="text-miku/30 shrink-0">/</span>
            <div className="relative flex items-center gap-0.5">
                {isDetailPage ? (
                    <Link
                        href={item.href}
                        className="text-miku/60 hover:text-miku transition-colors shrink-0 text-sm"
                    >
                        {item.name}
                    </Link>
                ) : (
                    <span className="text-miku font-medium shrink-0 text-sm">
                        {item.name}
                    </span>
                )}
                <ExpandButton open={openDropdown === "item"} onClick={() => toggleDropdown("item")} />
                {openDropdown === "item" && (
                    <DropdownPanel>
                        {group.items.map((navItem) => (
                            <DropdownItem key={navItem.href} href={navItem.href} isCurrent={navItem.href === item.href}>
                                {navItem.name}
                            </DropdownItem>
                        ))}
                    </DropdownPanel>
                )}
            </div>

            {/* 三级：详情名（不可展开） */}
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
