"use client";

import React from "react";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { MEMBER_LINKS } from "@/lib/team-links";

/**
 * Tech-stack chips. Previously each entry carried its own pastel background
 * (bg-blue-100, bg-sky-100, …), which made the block read as a row of stickers
 * rather than as system UI. They are all the same kind of object, so they now
 * share one neutral chip; the version digits get tabular figures.
 */
const TECH_STACK = [
    "Golang",
    "Next.js 16",
    "React 19",
    "TypeScript",
    "Tailwind CSS",
    "Cloudflare",
];

/** A content card on this page. Flat tile, no hover lift. */
const CARD_CLASS = "hh-tile p-6 flex flex-col";

/** Card heading. */
const CARD_TITLE_CLASS = "hh-title text-base font-bold text-[var(--hh-text-primary)]";

/** Body copy inside a card. */
const CARD_BODY_CLASS = "hh-body text-sm text-[var(--hh-text-secondary)]";

/**
 * Policy / repository button. Padding is intentionally NOT baked in: the
 * repository link needs a tighter box than the two policy links, and two
 * arbitrary padding utilities of equal specificity would resolve by Tailwind's
 * output order rather than by the order they are written at the call site.
 */
const POLICY_BUTTON_CLASS =
    "hh-press hh-focusable inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] " +
    "bg-[var(--hh-surface-2)] border border-[var(--hh-border)] font-bold " +
    "text-[var(--hh-text-primary)] hover:border-[var(--hh-accent)] hover:text-[var(--hh-accent-deep)]";

/** Credit link inside the data-source / license lists. */
const CREDIT_LINK_CLASS =
    "font-bold text-[var(--hh-text-primary)] hover:text-[var(--hh-accent-deep)] transition-colors underline decoration-dotted";

function renderMemberText(text: string) {
    const tokens = text.split(/(@[^\s@]+)/g);
    return tokens.map((token, index) => {
        const link = MEMBER_LINKS[token];
        if (link) {
            return (
                <ExternalLink
                    key={index}
                    href={link}
                    target="_blank"
                    className="text-[var(--hh-accent-deep)] hover:underline font-medium transition-colors"
                >
                    {token}
                </ExternalLink>
            );
        }
        return token;
    });
}

export default function AboutClient() {
    const { t } = useI18n();

    return (
        <MainLayout showLoader={true}>
            <div className="container mx-auto px-6 py-12 max-w-5xl flex-grow z-10">
                <div className="mb-10 animate-fade-in-up">
                    <h1 className="hh-display text-4xl text-[var(--hh-text-primary)] mb-2">{t("page.about.title")}</h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] max-w-2xl text-lg">
                        {t("page.about.description")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className={`md:col-span-2 ${CARD_CLASS}`}>
                        <div className="flex gap-4 items-center mb-4">
                            <div className="w-12 h-12 rounded-[var(--hh-radius-md)] bg-[var(--hh-accent)] flex items-center justify-center text-[var(--hh-text-on-accent)] text-2xl font-bold">
                                <span aria-hidden="true">&#10084;&#65039;</span>
                            </div>
                            <div className="flex flex-col justify-center">
                                <p className={`text-lg ${CARD_TITLE_CLASS}`}>{t("page.about.nonProfit.title")}</p>
                                <p className="hh-label text-xs">{t("page.about.nonProfit.badge")}</p>
                            </div>
                        </div>
                        <hr className="hh-divider mb-4" />
                        <div className={`${CARD_BODY_CLASS} space-y-4`}>
                            <p>{t("page.about.nonProfit.description")}</p>
                            <p>
                                {t("page.about.nonProfit.supportPrefix")}{" "}
                                <Link href="/patreon" className="text-[var(--hh-accent-deep)] font-bold hover:underline">
                                    {t("page.about.nonProfit.supportLink")}
                                </Link>
                                {t("page.about.nonProfit.supportSuffix")}
                            </p>
                        </div>
                    </div>

                    {/* Organization card — the one deliberately inverted surface on the
                        page. It is a link to an external identity, so it reads as a
                        badge rather than as another content tile. */}
                    <ExternalLink
                        href="https://github.com/StarMoe-org"
                        target="_blank"
                        className="hh-press hh-focusable p-6 rounded-[var(--hh-radius-lg)] border border-[var(--hh-border-strong)] bg-[var(--hh-text-primary)] text-[var(--hh-surface-2)] flex flex-col items-center justify-center text-center group/org cursor-pointer"
                    >
                        <p className="w-full text-left hh-label text-xs mb-4">{t("page.about.organization.label")}</p>
                        <div className="w-24 h-24 rounded-[var(--hh-radius-full)] border-2 border-[var(--hh-border-strong)] mb-4 overflow-hidden relative">
                            <Image
                                src="https://github.com/StarMoe-org.png"
                                alt={t("page.about.organization.avatarAlt")}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="w-36 h-10 relative flex items-center justify-center mb-1 select-none">
                            <div
                                className="h-8 w-full bg-[var(--hh-accent)]"
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
                        <h3 className="hh-title text-2xl font-bold">StarMoe</h3>
                        <p className="text-[var(--hh-accent)] text-sm font-bold mt-1">{t("page.about.organization.description")}</p>
                        <div className="mt-6 flex flex-col items-center gap-1 text-xs text-[var(--hh-text-tertiary)]">
                            <span>&quot;Soul by HelloWorld&quot;</span>
                        </div>
                    </ExternalLink>

                    <div className={CARD_CLASS}>
                        <div className="mb-4">
                            <p className={CARD_TITLE_CLASS}>{t("page.about.techStack.title")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 content-start flex-grow">
                            {TECH_STACK.map((tech) => (
                                <span key={tech} className="hh-chip hh-numeric">
                                    {tech}
                                </span>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-[var(--hh-border)]">
                            <p className="text-xs text-[var(--hh-text-tertiary)] font-medium">
                                {t("page.about.techStack.description")}
                            </p>
                        </div>
                    </div>

                    <div className={`md:col-span-2 ${CARD_CLASS}`}>
                        <p className={`${CARD_TITLE_CLASS} mb-4`}>{t("page.about.credits.title")}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="hh-label text-xs mb-3 border-b border-[var(--hh-border)] pb-1">{t("page.about.credits.dataSourceTitle")}</h4>
                                <ul className={`${CARD_BODY_CLASS} space-y-2`}>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[var(--hh-accent)] mt-1">&#9679;</span>
                                        <div>
                                            <ExternalLink href="https://sekai.best" target="_blank" className={CREDIT_LINK_CLASS}>Sekai.best</ExternalLink> (Asset/MasterData API)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[var(--hh-accent)] mt-1">&#9679;</span>
                                        <div>
                                            <ExternalLink href="https://github.com/MejiroRina" target="_blank" className={CREDIT_LINK_CLASS}>{t("page.about.credits.harukiLabel")}</ExternalLink> (Data)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-[var(--hh-accent)] mt-1">&#9679;</span>
                                        <div>
                                            <ExternalLink href="https://github.com/watagashi-uni" target="_blank" className={CREDIT_LINK_CLASS}>Uni/Haruki</ExternalLink> (Assets Hosting)
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="hh-label text-xs mb-3 border-b border-[var(--hh-border)] pb-1">{t("page.about.credits.licenseTitle")}</h4>
                                <p className={`${CARD_BODY_CLASS} mb-4`}>
                                    {t("page.about.credits.copyrightPrefix")} <b>SEGA</b> {t("page.about.credits.copyrightMiddle")} <b>Colorful Palette</b> {t("page.about.credits.copyrightSuffix")}
                                </p>
                                <div className="hh-well p-3">
                                    <p className="text-xs text-[var(--hh-text-secondary)] mb-2">
                                        {t("page.about.credits.openSourcePrefix")} <b>AGPL-3.0</b> {t("page.about.credits.openSourceSuffix")}
                                    </p>
                                    <ExternalLink
                                        href="https://github.com/StarMoe-org/Moesekai"
                                        target="_blank"
                                        className={`${POLICY_BUTTON_CLASS} text-xs px-3 py-2`}
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                        StarMoe-org/Moesekai
                                    </ExternalLink>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`md:col-span-3 ${CARD_CLASS}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <p className={CARD_TITLE_CLASS}>{t("page.about.policies.title")}</p>
                        </div>
                        <p className={`${CARD_BODY_CLASS} mb-4`}>
                            {t("page.about.policies.description")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Link href="/privacy" className={`${POLICY_BUTTON_CLASS} px-4 py-2.5 text-sm`}>
                                <span>{t("page.about.policies.privacy")}</span>
                            </Link>
                            <Link href="/terms" className={`${POLICY_BUTTON_CLASS} px-4 py-2.5 text-sm`}>
                                <span>{t("page.about.policies.terms")}</span>
                            </Link>
                        </div>
                    </div>

                    <div className={`md:col-span-3 ${CARD_CLASS}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <p className={CARD_TITLE_CLASS}>{t("page.about.sponsors.title")}</p>
                        </div>
                        <p className={`${CARD_BODY_CLASS} text-justify`}>
                            {t("page.about.sponsors.list")}
                        </p>
                    </div>

                    <div className={`md:col-span-3 ${CARD_CLASS}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <p className={CARD_TITLE_CLASS}>{t("page.about.specialThanks.title")}</p>
                        </div>
                        <p className={`${CARD_BODY_CLASS} text-justify`}>
                            {t("page.about.specialThanks.list")}
                        </p>
                    </div>

                    <div className={`md:col-span-3 ${CARD_CLASS}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <p className={CARD_TITLE_CLASS}>{t("page.about.teams.title")}</p>
                        </div>
                        <div className={`${CARD_BODY_CLASS} space-y-4`}>
                            <div>
                                <span className="font-bold text-[var(--hh-text-primary)]">{t("page.about.teams.literatureLabel")}</span>
                                {renderMemberText(t("page.about.teams.literatureMembers"))}
                            </div>
                            <div>
                                <span className="font-bold text-[var(--hh-text-primary)]">{t("page.about.teams.translationLabel")}</span>
                                {renderMemberText(t("page.about.teams.translationMembers"))}
                            </div>
                            <div>
                                <span className="font-bold text-[var(--hh-text-primary)]">{t("page.about.teams.guideLabel")}</span>
                                {renderMemberText(t("page.about.teams.guideMembers"))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-[var(--hh-border)]">
                                <p className="font-medium text-[var(--hh-accent-deep)]">
                                    {t("page.about.teams.joinPrefix")} <span className="font-bold text-[var(--hh-text-primary)] hh-numeric">1075068454</span> {t("page.about.teams.joinMiddle")}<span className="font-bold text-[var(--hh-text-primary)]">{t("page.about.teams.joinGroup")}</span>{t("page.about.teams.joinSuffix")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
