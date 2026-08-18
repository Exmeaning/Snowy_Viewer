"use client";
import React from "react";
import Link from "@/components/LocalizedLink";
import { useI18n } from "@/contexts/I18nContext";
import ExternalLink from "@/components/ExternalLink";
import { NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";
import { MOE_LOGO_URL } from "@/lib/assets";
import { MOESEKAI_BILIBILI_SPACE_URL } from "@/lib/team-links";

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
            <div className="island-panel material-chrome rounded-[28px] py-10 px-6 sm:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Column 1: Brand & Description */}
                    <div className="lg:col-span-4 space-y-3">
                        <Link href="/" className="pressable inline-block hover:opacity-85 group" title="MoeSekai">
                            <div
                                className="h-9 w-[6.2rem] sm:h-10 sm:w-[7.2rem] bg-gradient-to-r from-miku to-luka transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] group-hover:scale-105"
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
                        <p className="text-[10px] type-caption text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase">
                            PROJECT SEKAI VIEWER
                        </p>
                        <p className="text-sm type-body text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                            {t("layout.footer.brandDescription")}
                        </p>

                        {/* Social & Community Badges */}
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                            <ExternalLink
                                href={MOESEKAI_BILIBILI_SPACE_URL}
                                className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#fb7299]/10 hover:bg-[#fb7299] text-[#fb7299] hover:text-white transition-all text-xs font-bold border border-[#fb7299]/20 shadow-sm"
                            >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z"
                                    />
                                </svg>
                                <span>{t("layout.footer.bilibiliAccount")}</span>
                            </ExternalLink>
                            <ExternalLink
                                href="https://github.com/StarMoe-org/Moesekai"
                                className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-miku transition-all text-xs font-bold border border-slate-200/80 dark:border-slate-700/80"
                            >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                <span>GitHub</span>
                            </ExternalLink>
                        </div>
                    </div>

                    {/* Column 2: Explore */}
                    <div className="lg:col-span-2 space-y-3">
                        <h3 className="text-xs type-caption font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.explore")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            {EXPLORE_LINKS.map(href => (
                                <li key={href}>
                                    <Link href={href} className="pressable text-slate-500 dark:text-slate-400 hover:text-miku flex items-center gap-1 group">
                                        <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-3 transition-all duration-[var(--duration-fast)] text-miku">→</span>
                                        {t(NAV_ITEM_LABEL_KEYS[href])}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Sister Sites & Community */}
                    <div className="lg:col-span-3 space-y-3">
                        <h3 className="text-xs type-caption font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.sisterSites")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <ExternalLink href="https://bdon.moe" className="pressable text-slate-500 dark:text-slate-400 hover:text-miku flex items-center gap-1 group">
                                    <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-3 transition-all duration-[var(--duration-fast)] text-miku">→</span>
                                    bdon.moe <span className="text-xs text-slate-400 font-normal ml-0.5">(Moenotes)</span>
                                </ExternalLink>
                            </li>
                            <li>
                                <ExternalLink href={MOESEKAI_BILIBILI_SPACE_URL} className="pressable text-[#fb7299] hover:text-[#e0567e] flex items-center gap-1 group font-medium">
                                    <span className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-3 transition-all duration-[var(--duration-fast)] text-[#fb7299]">→</span>
                                    {t("page.home.friends.bilibiliTitle")}
                                    <span className="text-[10px] bg-[#fb7299]/15 text-[#fb7299] font-black px-1.5 py-0.2 rounded ml-1">BILIBILI</span>
                                </ExternalLink>
                            </li>
                        </ul>
                    </div>

                    {/* Column 4: Contact & Legal */}
                    <div className="lg:col-span-3 space-y-3">
                        <h3 className="text-xs type-caption font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1 h-3 bg-miku rounded-full"></span>
                            {t("layout.footer.contact")}
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <ExternalLink href="https://github.com/moe-sekai/Moesekai/issues/new?template=feature_request.md" className="pressable text-slate-500 dark:text-slate-400 hover:text-miku flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t("layout.footer.feedback")}
                                </ExternalLink>
                            </li>
                            <li>
                                <ExternalLink href="https://github.com/moe-sekai/Moesekai/issues/new?template=bug_report.md" className="pressable text-slate-500 dark:text-slate-400 hover:text-miku flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    {t("layout.footer.bugReport")}
                                </ExternalLink>
                            </li>
                            <li>
                                <ExternalLink href="mailto:mail@exmeaning.com" className="pressable text-slate-500 dark:text-slate-400 hover:text-miku flex items-center gap-2 group">
                                    <svg className="w-4 h-4 text-slate-400 group-hover:text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    mail@exmeaning.com
                                </ExternalLink>
                            </li>
                            <li className="pt-2 flex items-center gap-3 text-xs text-slate-400">
                                <Link href="/privacy" className="pressable hover:text-miku">
                                    {t("layout.footer.privacyPolicy")}
                                </Link>
                                <span className="text-slate-300 dark:text-slate-700">·</span>
                                <Link href="/terms" className="pressable hover:text-miku">
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
                            © {new Date().getFullYear()} MoeSekai. {t("layout.footer.generatedBy")}{" "}
                            <ExternalLink href="https://star.moe" className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 hover:text-[var(--theme-color,#39C5BB)] transition-colors duration-300">
                                <span
                                    className="h-3.5 w-12 bg-current transition-colors duration-300"
                                    style={{
                                        maskImage: "url(/starmoe.svg)",
                                        maskSize: "contain",
                                        maskPosition: "center",
                                        maskRepeat: "no-repeat",
                                        WebkitMaskImage: "url(/starmoe.svg)",
                                        WebkitMaskSize: "contain",
                                        WebkitMaskPosition: "center",
                                        WebkitMaskRepeat: "no-repeat",
                                    }}
                                />
                                StarMoe
                            </ExternalLink>.
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
