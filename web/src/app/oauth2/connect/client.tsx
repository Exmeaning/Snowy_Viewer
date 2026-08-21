"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { formatOAuthErrorMessage, sanitizeOAuthReturnTo, startOAuthConnect } from "@/lib/oauth";

export default function ConnectClient() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    const returnTo = useMemo(() => {
        const value = searchParams.get("returnTo");
        return sanitizeOAuthReturnTo(value);
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
                <div className="hh-tile p-6 sm:p-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku text-xs">{t("page.oauth2.connect.badge")}</span>
                    </div>
                    <h1 className="hh-display text-2xl sm:text-3xl font-black text-primary-text mb-3">{t("page.oauth2.connect.title")}</h1>
                    <p className="text-[var(--hh-text-secondary)] text-sm">{t("page.oauth2.connect.description")}</p>
                    {errorMessage ? (
                        <div
                            className="hh-tile hh-tile-tint mt-6 p-4 text-left"
                            style={{ "--hh-tint": "var(--hh-accent-alert)" } as CSSProperties}
                        >
                            <p className="text-sm font-bold text-red-600">{t("page.oauth2.connect.errorTitle")}</p>
                            <p className="text-xs text-red-500 mt-1 break-all">{errorMessage}</p>
                        </div>
                    ) : (
                        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--hh-text-secondary)]">
                            <div className="hh-spinner w-4 h-4" />
                            {t("page.oauth2.connect.loading")}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
