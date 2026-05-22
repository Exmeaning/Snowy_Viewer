"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { formatOAuthErrorMessage, startOAuthConnect } from "@/lib/oauth";

export default function ConnectClient() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    const returnTo = useMemo(() => {
        const value = searchParams.get("returnTo");
        return value && value.startsWith("/") ? value : "/profile";
    }, [searchParams]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                await startOAuthConnect(returnTo);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "OAUTH_INIT_FAILED");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [returnTo]);

    const errorMessage = error ? formatOAuthErrorMessage(error, t) : null;

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
                <div className="glass-card p-6 sm:p-8 rounded-2xl text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">{t("page.oauth2.connect.badge")}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary-text mb-3">{t("page.oauth2.connect.title")}</h1>
                    <p className="text-slate-500 text-sm">{t("page.oauth2.connect.description")}</p>
                    {errorMessage ? (
                        <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-left">
                            <p className="text-sm font-bold text-red-600">{t("page.oauth2.connect.errorTitle")}</p>
                            <p className="text-xs text-red-500 mt-1 break-all">{errorMessage}</p>
                        </div>
                    ) : (
                        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                            <div className="w-4 h-4 border-2 border-miku/20 border-t-miku rounded-full animate-spin" />
                            {t("page.oauth2.connect.loading")}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
