'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { localizePathForBrowser } from '@/lib/localized-path';
import Link from "@/components/LocalizedLink";
import { useI18n } from '@/contexts/I18nContext';
import { MOE_LOGO_URL } from '@/lib/assets';

function LeavePageContent() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const router = useRouter();
    const target = searchParams.get('target');
    const [canClose, setCanClose] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCanClose(window.history.length === 1 || !!window.opener);
    }, []);

    const handleClose = () => {
        if (canClose) {
            window.close();
        } else {
            router.push(localizePathForBrowser('/'));
        }
    };

    if (!target) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="hh-panel p-8 max-w-md w-full text-center">
                    <h1 className="hh-title text-xl text-[var(--hh-text-primary)] mb-4">
                        {t("page.leave.missingTitle")}
                    </h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mb-6">
                        {t("page.leave.missingDescription")}
                    </p>
                    <Link
                        href="/"
                        className="hh-btn hh-btn-primary hh-press hh-focusable px-6 py-2 inline-block"
                    >
                        {t("page.leave.backHome")}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="hh-ground min-h-screen flex flex-col items-center justify-center p-4">
            <div className="hh-panel p-8 md:p-10 max-w-lg w-full relative overflow-hidden">

                {/* Accent rule along the top edge. Flat fill: the old two-stop
                    gradient read as decoration, this reads as the panel's header rule. */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[var(--hh-accent)]"></div>

                <div className="flex flex-col items-center text-center">

                    {/* Logo Section */}
                    <div className="flex items-center gap-2 mb-8">
                        <div
                            className="h-8 w-[5rem] bg-miku"
                            style={{
                                maskImage: `url(${MOE_LOGO_URL})`,
                                maskSize: "contain",
                                maskPosition: "center",
                                maskRepeat: "no-repeat",
                                WebkitMaskImage: `url(${MOE_LOGO_URL})`,
                                WebkitMaskSize: "contain",
                                WebkitMaskPosition: "center",
                                WebkitMaskRepeat: "no-repeat",
                            }}
                        />
                        <div className="flex items-center gap-1.5 h-full border-l border-[var(--hh-border)] pl-2 ml-1">
                            <span className="hh-label text-sm leading-none">
                                {t("page.leave.badge")}
                            </span>
                        </div>
                    </div>

                    {/* Caution mark. Amber is the semantic signal for "leaving the
                        site", so the hue stays; only the flat 50-tint becomes a
                        theme-safe overlay. */}
                    <div className="w-20 h-20 bg-amber-500/12 rounded-full flex items-center justify-center mb-6 text-amber-500 ring-8 ring-amber-500/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h2 className="hh-display text-2xl text-[var(--hh-text-primary)] mb-3">
                        {t("page.leave.title")}
                    </h2>

                    <p className="hh-body text-[var(--hh-text-secondary)] mb-6">
                        {t("page.leave.description")}
                    </p>

                    <div className="hh-well p-4 w-full mb-6 break-all text-sm text-miku font-mono">
                        {target}
                    </div>

                    <p className="hh-well hh-body text-[var(--hh-text-secondary)] text-xs mb-8 p-3">
                        {t("page.leave.warningLine1")}
                        <br />
                        {t("page.leave.warningLine2")}
                    </p>

                    <div className="flex flex-col space-y-3 w-full">
                        <a
                            href={target}
                            rel="noopener noreferrer"
                            className="hh-btn hh-btn-primary hh-press hh-focusable w-full py-3.5 font-bold text-center"
                        >
                            {t("page.leave.continue")}
                        </a>

                        <button
                            onClick={handleClose}
                            className="hh-btn hh-press hh-focusable w-full py-3.5 font-bold"
                        >
                            {canClose ? t("page.leave.closePage") : t("page.leave.backHome")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LeavePageFallback() {
    const { t } = useI18n();

    return (
        <div className="min-h-screen flex items-center justify-center">
            {t("common.state.loading")}
        </div>
    );
}

export default function LeavePageClient() {
    return (
        <Suspense fallback={<LeavePageFallback />}>
            <LeavePageContent />
        </Suspense>
    );
}
