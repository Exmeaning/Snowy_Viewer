"use client";
import React from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useEffect } from "react";
import type { NavGroupData } from "@/lib/navigation";
import { NAV_GROUP_LABEL_KEYS, NAV_ITEM_DESCRIPTION_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";

interface BreadcrumbGroupPageProps {
    group: NavGroupData;
}

export default function BreadcrumbGroupPage({ group }: BreadcrumbGroupPageProps) {
    const { setDetailName } = useBreadcrumb();
    const { t } = useI18n();

    const groupLabel = t(NAV_GROUP_LABEL_KEYS[group.href] ?? group.title);
    const getItemLabel = (href: string, fallback: string) => t(NAV_ITEM_LABEL_KEYS[href] ?? fallback);
    const getItemDescription = (href: string) => t(NAV_ITEM_DESCRIPTION_KEYS[href] ?? "");

    useEffect(() => {
        setDetailName(null);
    }, [setDetailName]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Title */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-8 w-1.5 rounded-full bg-miku" />
                    <h1 className="text-2xl font-bold text-primary-text">{groupLabel}</h1>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((item) => (
                        <Link key={item.href} href={item.href} className="group">
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-miku/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                                <h3 className="text-base font-bold text-slate-800 group-hover:text-miku transition-colors">
                                    {getItemLabel(item.href, item.name)}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
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
