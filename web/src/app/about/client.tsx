"use client";

import React from "react";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";

const techStack = [
    { name: "Golang", color: "bg-blue-100 text-blue-600" },
    { name: "Next.js 16", color: "bg-black text-white" },
    { name: "React 19", color: "bg-cyan-100 text-cyan-600" },
    { name: "TypeScript", color: "bg-blue-100 text-blue-700" },
    { name: "Tailwind CSS", color: "bg-sky-100 text-sky-600" },
    { name: "Cloudflare", color: "bg-orange-100 text-orange-600" },
];

export default function AboutClient() {
    const { t } = useI18n();

    return (
        <MainLayout showLoader={true}>
            <div className="container mx-auto px-6 py-12 max-w-5xl flex-grow z-10">
                <div className="mb-10 animate-fade-in-up">
                    <h1 className="text-4xl font-black text-primary-text mb-2">{t("page.about.title")}</h1>
                    <p className="text-slate-500 max-w-2xl text-lg font-medium">
                        {t("page.about.description")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm flex flex-col hover:shadow-xl transition-shadow">
                        <div className="flex gap-4 items-center mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-miku to-miku-dark flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-miku/20">
                                <span aria-hidden="true">&#10084;&#65039;</span>
                            </div>
                            <div className="flex flex-col justify-center">
                                <p className="text-lg font-bold text-primary-text">{t("page.about.nonProfit.title")}</p>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t("page.about.nonProfit.badge")}</p>
                            </div>
                        </div>
                        <hr className="border-slate-100 mb-4" />
                        <div className="text-slate-600 leading-relaxed space-y-4">
                            <p>{t("page.about.nonProfit.description")}</p>
                            <p>
                                {t("page.about.nonProfit.supportPrefix")}{" "}
                                <Link href="/patreon" className="text-miku font-bold">
                                    {t("page.about.nonProfit.supportLink")}
                                </Link>
                                {t("page.about.nonProfit.supportSuffix")}
                            </p>
                        </div>
                    </div>

                    <div className="p-6 rounded-xl shadow-md border-none bg-primary-text text-white flex flex-col items-center justify-center text-center hover:shadow-xl transition-shadow">
                        <p className="w-full text-left text-xs font-bold opacity-80 uppercase tracking-widest mb-4">{t("page.about.organization.label")}</p>
                        <div className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl mb-4 overflow-hidden relative">
                            <Image
                                src="https://github.com/moe-sekai.png"
                                alt={t("page.about.organization.avatarAlt")}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="w-36 h-10 relative flex items-center justify-center mb-1 group/logo select-none">
                            <div
                                className="h-8 w-full bg-gradient-to-r from-miku to-luka transition-all duration-300 group-hover/logo:scale-105"
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
                        </div>
                        <h3 className="text-2xl font-bold">StarMoe</h3>
                        <p className="text-miku text-sm font-bold mt-1">{t("page.about.organization.description")}</p>
                        <div className="mt-6 flex flex-col items-center gap-1 opacity-50 text-xs text-white">
                            <span>&quot;Soul by HelloWorld&quot;</span>
                        </div>
                    </div>

                    <div className="p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow flex flex-col">
                        <div className="mb-4">
                            <p className="text-md font-bold text-primary-text">{t("page.about.techStack.title")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 content-start flex-grow">
                            {techStack.map((tech) => (
                                <span key={tech.name} className={`px-2 py-1 rounded-full text-xs font-bold ${tech.color}`}>
                                    {tech.name}
                                </span>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-xs text-slate-400 font-medium">
                                {t("page.about.techStack.description")}
                            </p>
                        </div>
                    </div>

                    <div className="md:col-span-2 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <p className="text-md font-bold text-primary-text mb-4">{t("page.about.credits.title")}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xs font-bold text-miku mb-3 uppercase tracking-wide border-b border-miku/20 pb-1">{t("page.about.credits.dataSourceTitle")}</h4>
                                <ul className="text-sm text-slate-500 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">&#9679;</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://sekai.best" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">Sekai.best</ExternalLink> (Asset/MasterData API)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">&#9679;</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://github.com/MejiroRina" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">{t("page.about.credits.harukiLabel")}</ExternalLink> (Data)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">&#9679;</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://github.com/watagashi-uni" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">Uni/Haruki</ExternalLink> (Assets Hosting)
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-luka mb-3 uppercase tracking-wide border-b border-luka/20 pb-1">{t("page.about.credits.licenseTitle")}</h4>
                                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                                    {t("page.about.credits.copyrightPrefix")} <b>SEGA</b> {t("page.about.credits.copyrightMiddle")} <b>Colorful Palette</b> {t("page.about.credits.copyrightSuffix")}
                                </p>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-2">
                                        {t("page.about.credits.openSourcePrefix")} <b>AGPL-3.0</b> {t("page.about.credits.openSourceSuffix")}
                                    </p>
                                    <ExternalLink
                                        href="https://github.com/moe-sekai/Moesekai"
                                        target="_blank"
                                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-miku transition-colors bg-white px-3 py-2 rounded-md border border-slate-200 shadow-sm hover:shadow"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                        moe-sekai/Moesekai
                                    </ExternalLink>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <p className="text-md font-bold text-primary-text">{t("page.about.policies.title")}</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            {t("page.about.policies.description")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/privacy"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:text-miku hover:border-miku/30 hover:shadow-sm transition-all"
                            >
                                <span>{t("page.about.policies.privacy")}</span>
                            </Link>
                            <Link
                                href="/terms"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:text-miku hover:border-miku/30 hover:shadow-sm transition-all"
                            >
                                <span>{t("page.about.policies.terms")}</span>
                            </Link>
                        </div>
                    </div>

                    <div className="md:col-span-3 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <p className="text-md font-bold text-primary-text">{t("page.about.sponsors.title")}</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-7 text-justify">
                            {t("page.about.sponsors.list")}
                        </p>
                    </div>

                    <div className="md:col-span-3 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <p className="text-md font-bold text-primary-text">{t("page.about.specialThanks.title")}</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-7 text-justify">
                            {t("page.about.specialThanks.list")}
                        </p>
                    </div>

                    <div className="md:col-span-3 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <p className="text-md font-bold text-primary-text">{t("page.about.teams.title")}</p>
                        </div>
                        <div className="text-sm text-slate-600 leading-7 space-y-4">
                            <div>
                                <span className="font-bold text-primary-text">{t("page.about.teams.literatureLabel")}</span>
                                {t("page.about.teams.literatureMembers")}
                            </div>
                            <div>
                                <span className="font-bold text-primary-text">{t("page.about.teams.translationLabel")}</span>
                                {t("page.about.teams.translationMembers")}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="font-medium text-miku">
                                    {t("page.about.teams.joinPrefix")} <span className="font-bold text-primary-text">1075068454</span> {t("page.about.teams.joinMiddle")}<span className="font-bold text-primary-text">{t("page.about.teams.joinGroup")}</span>{t("page.about.teams.joinSuffix")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
