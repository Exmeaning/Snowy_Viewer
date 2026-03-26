"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainLayout from "@/components/MainLayout";
import { startOAuthConnect } from "@/lib/oauth";

export default function ConnectClient() {
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
                    setError(err instanceof Error ? err.message : "OAuth2 授权初始化失败");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [returnTo]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-10 max-w-3xl">
                <div className="glass-card p-6 sm:p-8 rounded-2xl text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">OAuth2 Connect</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary-text mb-3">正在跳转到授权页面</h1>
                    <p className="text-slate-500 text-sm">请稍候，Moesekai 正在将你跳转到 Haruki 授权页。</p>
                    {error ? (
                        <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-left">
                            <p className="text-sm font-bold text-red-600">授权初始化失败</p>
                            <p className="text-xs text-red-500 mt-1 break-all">{error}</p>
                        </div>
                    ) : (
                        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                            <div className="w-4 h-4 border-2 border-miku/20 border-t-miku rounded-full animate-spin" />
                            正在跳转…
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
