"use client";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { STORY_TYPES } from "@/lib/storyTypes";

export default function StoryIndexClient() {
    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                        <span className="text-miku text-xs font-bold tracking-widest uppercase">剧情阅读</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                        剧情 <span className="text-miku">浏览器</span>
                    </h1>
                    <p className="text-slate-500 mt-2">选择剧情类型开始阅读</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
                    {STORY_TYPES.map((t) => (
                        <Link
                            key={t.href}
                            href={t.href}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${t.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                            <div className="p-6 flex items-start gap-4">
                                <div className={`shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white shadow-md`}>
                                    {t.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-miku transition-colors">
                                        {t.name}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                        {t.desc}
                                    </p>
                                </div>
                                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
