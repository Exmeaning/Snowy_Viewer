"use client";
import React, { useState } from "react";
import Link from "next/link";
import SettingsPanel from "./SettingsPanel";

// Navigation item types
interface MenuItem {
    name: string;
    href: string;
}

interface DropdownItem {
    name: string;
    children: MenuItem[];
}

type NavItem = MenuItem | DropdownItem;

// Check if item is a dropdown
const isDropdown = (item: NavItem): item is DropdownItem => {
    return 'children' in item;
};

// Updated Navigation config for V3 with merged menus
const menuItems: NavItem[] = [
    { name: "首页", href: "/" },
    { name: "卡牌", href: "/cards" },
    {
        name: "音乐",
        children: [
            { name: "音乐图鉴", href: "/music" },
            { name: "歌曲Meta", href: "/music/meta" },
        ]
    },
    {
        name: "活动",
        children: [
            { name: "活动", href: "/events" },
            { name: "扭蛋", href: "/gacha" },
            { name: "演唱会", href: "/live" },
        ]
    },
    {
        name: "资源",
        children: [
            { name: "角色", href: "/character" },
            { name: "贴纸", href: "/sticker" },
            { name: "漫画", href: "/comic" },
            { name: "家具", href: "/mysekai" },
        ]
    },
    { name: "关于", href: "/about" },
];

interface MainNavbarProps {
    activeItem?: string;
}

export default function MainNavbar({ activeItem = "首页" }: MainNavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);

    // Check if dropdown has active child
    const hasActiveChild = (item: DropdownItem): boolean => {
        return item.children.some(child => child.name === activeItem);
    };

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-lg border-b border-white/20 h-[4.5rem]">
            <div className="container mx-auto px-6 h-full flex items-center justify-between">

                {/* Logo Section */}
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div
                        className="h-10 w-[6.1rem] bg-miku transition-colors"
                        style={{
                            maskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                            maskSize: "contain",
                            maskPosition: "center",
                            maskRepeat: "no-repeat",
                            WebkitMaskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                            WebkitMaskSize: "contain",
                            WebkitMaskPosition: "center",
                            WebkitMaskRepeat: "no-repeat",
                        }}
                    />
                    <div className="flex items-center gap-1.5 h-full">
                        <span className="text-[10px] text-miku font-bold tracking-widest uppercase leading-none mt-1">Sekai Viewer</span>
                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-400 text-white font-bold rounded-full leading-none">BETA1.65</span>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6 h-full">
                    {menuItems.map((item) => {
                        if (isDropdown(item)) {
                            const isActiveDropdown = hasActiveChild(item);
                            return (
                                <div key={item.name} className="h-full flex items-center relative group">
                                    <button
                                        className={`font-bold text-sm px-1 transition-colors flex items-center gap-1 ${isActiveDropdown ? "text-miku" : "text-slate-500 hover:text-primary-text"
                                            }`}
                                    >
                                        {item.name}
                                        <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isActiveDropdown && (
                                        <span className="absolute bottom-0 left-0 w-full h-[3px] bg-miku rounded-t-full shadow-[0_-2px_10px_rgba(51,204,187,0.5)]" />
                                    )}
                                    {/* Dropdown Menu */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                        <div className="bg-white rounded-lg shadow-lg border border-slate-100 py-2 min-w-[120px]">
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.name}
                                                    href={child.href}
                                                    className={`block px-4 py-2 text-sm font-medium transition-colors ${child.name === activeItem
                                                        ? "text-miku bg-miku/5"
                                                        : "text-slate-600 hover:text-miku hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {child.name}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        } else {
                            const isActive = item.name === activeItem;
                            return (
                                <div key={item.name} className="h-full flex items-center relative">
                                    <Link
                                        href={item.href}
                                        className={`font-bold text-sm px-1 transition-colors ${isActive ? "text-miku" : "text-slate-500 hover:text-primary-text"
                                            }`}
                                    >
                                        {item.name}
                                    </Link>
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 w-full h-[3px] bg-miku rounded-t-full shadow-[0_-2px_10px_rgba(51,204,187,0.5)]" />
                                    )}
                                </div>
                            );
                        }
                    })}

                    {/* Settings Button (Desktop) */}
                    <div className="relative">
                        <button
                            id="settings-button"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="p-2 text-slate-400 hover:text-miku transition-colors rounded-lg hover:bg-slate-50"
                            title="设置"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
                    </div>
                </div>

                {/* Mobile: Settings + Menu Toggle */}
                <div className="md:hidden flex items-center gap-2">
                    {/* Settings Button (Mobile) */}
                    <div className="relative">
                        <button
                            id="settings-button-mobile"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="p-2 text-slate-400 hover:text-miku transition-colors"
                            title="设置"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="p-2 text-primary-text group"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="relative w-6 h-6 flex flex-col items-end justify-center gap-1.5 overflow-hidden">
                            <span className={`w-full h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                            <span className={`w-3/4 h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? "opacity-0" : ""}`} />
                            <span className={`w-full h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
                        </div>
                    </button>
                </div>
            </div>

            {/* Mobile Menu with Animation */}
            <div className={`md:hidden absolute top-[4.5rem] left-0 w-full bg-slate-50/95 backdrop-blur-md border-b border-white/20 shadow-lg py-4 px-6 flex flex-col gap-2 origin-top transition-all duration-300 ease-out transform ${isMenuOpen
                ? "translate-y-0 opacity-100 visible"
                : "-translate-y-4 opacity-0 invisible pointer-events-none"
                }`}>
                {menuItems.map((item, index) => {
                    if (isDropdown(item)) {
                        const isExpanded = expandedDropdown === item.name;
                        const isActiveDropdown = hasActiveChild(item);
                        return (
                            <div key={item.name} className="border-b border-slate-100 last:border-0">
                                <button
                                    onClick={() => setExpandedDropdown(isExpanded ? null : item.name)}
                                    className={`w-full text-left text-lg font-bold py-2 flex items-center justify-between ${isActiveDropdown ? "text-miku" : "text-slate-500"
                                        }`}
                                    style={{ transitionDelay: `${index * 50}ms` }}
                                >
                                    {item.name}
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {/* Expandable children */}
                                <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
                                    <div className="pl-4 pb-2 flex flex-col gap-1">
                                        {item.children.map((child) => (
                                            <Link
                                                key={child.name}
                                                href={child.href}
                                                className={`py-1.5 text-base font-medium ${child.name === activeItem ? "text-miku" : "text-slate-500"
                                                    }`}
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                {child.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`text-lg font-bold py-2 border-b border-slate-100 last:border-0 ${item.name === activeItem ? "text-miku" : "text-slate-500"
                                    }`}
                                style={{ transitionDelay: `${index * 50}ms` }}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        );
                    }
                })}
            </div>
        </nav>
    );
}

