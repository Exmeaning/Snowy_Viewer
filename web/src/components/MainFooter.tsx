"use client";
import React from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function MainFooter() {
    const { t } = useI18n();
    return (
        <footer className="w-full mt-auto px-3 sm:px-4 pb-3 sm:pb-4 relative z-[5]">
            <div className="island-panel rounded-[24px] py-6 px-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                    <div className="space-y-1">
                        <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
                            {t("layout.footer.nonProfit")}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            © {new Date().getFullYear()} Moesekai. {t("layout.footer.generatedBy")} <span className="font-bold text-slate-600 dark:text-slate-300">Moesekai Dev Team</span>.
                        </p>
                        <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-slate-400 pt-1">
                            <Link href="/privacy" className="hover:text-miku transition-colors">
                                {t("layout.footer.privacyPolicy")}
                            </Link>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <Link href="/terms" className="hover:text-miku transition-colors">
                                {t("layout.footer.termsOfService")}
                            </Link>
                        </div>
                    </div>

                    <div className="text-xs text-slate-400 max-w-md leading-relaxed">
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
