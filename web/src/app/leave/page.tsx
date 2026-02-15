'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function LeavePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const target = searchParams.get('target');
    const [canClose, setCanClose] = useState(false);

    useEffect(() => {
        // Check if we can close the window (e.g. opened via _blank)
        if (window.history.length === 1 || window.opener) {
            setCanClose(true);
        }
    }, []);

    const handleClose = () => {
        if (canClose) {
            window.close();
        } else {
            router.push('/');
        }
    };

    if (!target) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
                    <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        参数错误
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        未指定目标 URL。
                    </p>
                    <Link
                        href="/"
                        className="px-6 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-opacity inline-block"
                    >
                        返回首页
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900/50">
            <div className="bg-white dark:bg-gray-800 p-8 md:p-10 rounded-3xl shadow-xl max-w-lg w-full border border-slate-100 dark:border-slate-700 relative overflow-hidden">

                {/* Decorative background element */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-miku to-teal-200"></div>

                <div className="flex flex-col items-center text-center">

                    {/* Logo Section */}
                    <div className="flex items-center gap-2 mb-8 scale-110">
                        <div
                            className="h-8 w-[5rem] bg-miku"
                            style={{
                                maskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                                maskSize: "contain",
                                maskPosition: "center",
                                maskRepeat: "no-repeat",
                                WebkitMaskImage: "url(https://assets.exmeaning.com/SnowyBot/logo.svg)",
                                WebkitMaskSize: "contain",
                                WebkitMaskPosition: "center",
                                WebkitMaskRepeat: "no-repeat",
                            }}
                        />
                        <div className="flex items-center gap-1.5 h-full border-l border-slate-300 pl-2 ml-1">
                            <span className="text-sm text-slate-500 font-bold tracking-widest uppercase leading-none">
                                跳转提示
                            </span>
                        </div>
                    </div>

                    <div className="w-20 h-20 bg-yellow-50 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-6 text-yellow-500 ring-8 ring-yellow-50/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-100 mb-3">
                        即将离开 SnowyViewer
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                        你正在尝试访问以下外部链接：
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl w-full mb-6 break-all text-sm text-miku font-mono border border-slate-200 dark:border-slate-700 bg-opacity-50">
                        {target}
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 text-xs mb-8 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                        该页面与 SnowyViewer 无关，请谨慎辨别。
                        <br />
                        请注意保护个人信息安全。
                    </p>

                    <div className="flex flex-col space-y-3 w-full">
                        <a
                            href={target}
                            rel="noopener noreferrer"
                            className="w-full py-3.5 bg-miku hover:bg-miku-dark text-white rounded-xl shadow-lg shadow-miku/20 hover:shadow-xl hover:shadow-miku/30 transition-all font-bold text-center active:scale-[0.98]"
                        >
                            继续前往
                        </a>

                        <button
                            onClick={handleClose}
                            className="w-full py-3.5 bg-white border-2 border-slate-100 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all font-bold active:scale-[0.98]"
                        >
                            {canClose ? "关闭页面" : "返回首页"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeavePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <LeavePageContent />
        </Suspense>
    )
}
