"use client";
import React from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function MainFooter() {
    const { t } = useI18n();
    return (
        <footer className="w-full py-8 mt-auto bg-white border-t border-slate-100 relative z-[5]">
            <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">
                        {t("layout.footer.nonProfit")}
                    </p>
                    <p className="text-sm text-slate-500">
                        © {new Date().getFullYear()} Moesekai. {t("layout.footer.generatedBy")} <span className="font-bold">Moesekai Dev Team</span>.
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-slate-400 pt-1">
                        <Link href="/privacy" className="hover:text-miku transition-colors">
                            {t("layout.footer.privacyPolicy")}
                        </Link>
                        <span className="text-slate-200">·</span>
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
        </footer>
    );
}
