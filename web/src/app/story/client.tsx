"use client";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";

const STORY_TYPES = [
    {
        href: "/story/unit",
        name: "主线剧情",
        desc: "各组合的主线故事，按章节阅读",
        color: "from-violet-500 to-purple-600",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
    },
    {
        href: "/story/event",
        name: "活动剧情",
        desc: "每期活动的专属剧情故事",
        color: "from-miku to-cyan-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        href: "/story/card",
        name: "卡牌剧情",
        desc: "每张卡牌附带的前后篇故事",
        color: "from-pink-500 to-rose-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
        ),
    },
    {
        href: "/story/area",
        name: "区域对话",
        desc: "各区域场景中的角色日常对话",
        color: "from-emerald-500 to-teal-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
        ),
    },
    {
        href: "/story/self",
        name: "自我介绍",
        desc: "26 位角色的自我介绍（一年级/二年级）",
        color: "from-amber-500 to-orange-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        href: "/story/special",
        name: "特殊剧情",
        desc: "周年纪念等特殊场合的剧情",
        color: "from-indigo-500 to-blue-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
        ),
    },
];

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
