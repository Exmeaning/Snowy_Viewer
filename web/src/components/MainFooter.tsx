"use client";
import React from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import ExternalLink from "@/components/ExternalLink";
import { NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";
import { MOE_LOGO_URL } from "@/lib/assets";

const EXPLORE_LINKS = [
    "/",
    "/cards",
    "/music",
    "/character",
    "/events",
];

export default function MainFooter() {
    const { t } = useI18n();
    return (
        <footer className="w-full mt-auto px-3 sm:px-4 pb-4 sm:pb-6 relative z-[5]">
            <div className="island-panel rounded-[28px] py-10 px-6 sm:px-8 border border-slate-200/50 dark:border-slate-800/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Column 1: Brand & Description */}
                    <div className="lg:col-span-4 space-y-3">
                        <Link href="/" className="inline-block hover:opacity-85 transition-opacity duration-300 group" title="MoeSekai">
                            <div
                                className="h-9 w-[6.2rem] sm:h-10 sm:w-[7.2rem] bg-gradient-to-r from-miku to-luka transition-all duration-300 group-hover:scale-105"
                                style={{
                                    maskImage: `url(${MOE_LOGO_URL})`,
                                    maskSize: "contain",
                                    maskPosition: "left center",
                                    maskRepeat: "no-repeat",
                                    WebkitMaskImage: `url(${MOE_LOGO_URL})`,
                                    WebkitMaskSize: "contain",
                                    WebkitMaskPosition: "left center",
                                    WebkitMaskRepeat: "no-repeat",
                                }}
                            />
                        </Link>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase">
                            PROJECT SEKAI VIEWER
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                            {t("layout.footer.brandDescription")}
                        </p>
                    </div>

                    {/* Column 2: Explore */}
                    <div className="lg:col-span-2 space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.explore")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            {EXPLORE_LINKS.map(href => (
                                <li key={href}>
                                    <Link href={href} className="text-slate-500 dark:text-slate-400 hover:text-miku transition-colors flex items-center gap-1 group">
                                        <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-3 transition-all duration-200 text-miku">→</span>
                                        {t(NAV_ITEM_LABEL_KEYS[href])}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Sister Sites */}
                    <div className="lg:col-span-3 space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.sisterSites")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <ExternalLink href="https://bdon.moe" className="text-slate-500 dark:text-slate-400 hover:text-miku transition-colors flex items-center gap-1 group">
                                    <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-3 transition-all duration-200 text-miku">→</span>
                                    bdon.moe <span className="text-xs text-slate-400 font-normal ml-0.5">(Moenotes)</span>
                                </ExternalLink>
                            </li>
                        </ul>
                    </div>

                    {/* Column 4: Contact & Legal */}
                    <div className="lg:col-span-3 space-y-3">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.contact")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <ExternalLink href="https://github.com/moe-sekai/Moesekai/issues/new?template=feature_request.md" className="text-slate-500 dark:text-slate-400 hover:text-miku transition-colors flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t("layout.footer.feedback")}
                                </ExternalLink>
                            </li>
                            <li>
                                <ExternalLink href="https://github.com/moe-sekai/Moesekai/issues/new?template=bug_report.md" className="text-slate-500 dark:text-slate-400 hover:text-miku transition-colors flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    {t("layout.footer.bugReport")}
                                </ExternalLink>
                            </li>
                            <li>
                                <ExternalLink href="mailto:mail@exmeaning.com" className="text-slate-500 dark:text-slate-400 hover:text-miku transition-colors flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    mail@exmeaning.com
                                </ExternalLink>
                            </li>
                            <li className="pt-2 flex items-center gap-3 text-xs text-slate-400">
                                <Link href="/privacy" className="hover:text-miku transition-colors">
                                    {t("layout.footer.privacyPolicy")}
                                </Link>
                                <span className="text-slate-300 dark:text-slate-700">·</span>
                                <Link href="/terms" className="hover:text-miku transition-colors">
                                    {t("layout.footer.termsOfService")}
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] w-full bg-slate-200/50 dark:bg-slate-800/30 my-8"></div>

                {/* Bottom Section: Copyright & Disclaimer */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                    <div className="space-y-1">
                        <p>
                            © {new Date().getFullYear()} MoeSekai. {t("layout.footer.generatedBy")} <span className="font-bold text-slate-500 dark:text-slate-400">Moesekai Dev Team</span>.
                        </p>
                        <p className="text-[10px] text-slate-400/80 font-bold uppercase tracking-wider">
                            {t("layout.footer.nonProfit")}
                        </p>
                    </div>
                    <div className="max-w-md leading-relaxed text-left md:text-right">
                        <p>
                            {t("layout.footer.copyrightNotice")}
                        </p>
                        <p>
                            {t("layout.footer.fanNotice")}
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
