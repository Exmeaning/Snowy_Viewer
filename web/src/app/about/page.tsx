import React from "react";
import Image from "next/image";
import Link from "next/link";
import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "SnowyBot Viewer - 关于",
};

export default function AboutPage() {
    // Tech Stack Data
    const techStack = [
        { name: "Golang", color: "bg-blue-100 text-blue-600" },
        { name: "Next.js 16", color: "bg-black text-white" },
        { name: "React 19", color: "bg-cyan-100 text-cyan-600" },
        { name: "TypeScript", color: "bg-blue-100 text-blue-700" },
        { name: "Tailwind CSS", color: "bg-sky-100 text-sky-600" },
        { name: "Cloudflare", color: "bg-orange-100 text-orange-600" },
    ];

    return (
        <MainLayout activeNav="关于" showLoader={true}>
            <div className="container mx-auto px-6 py-12 max-w-5xl flex-grow z-10">
                {/* Page Title */}
                <div className="mb-10 animate-fade-in-up">
                    <h1 className="text-4xl font-black text-primary-text mb-2">关于 SnowyBot Viewer</h1>
                    <p className="text-slate-500 max-w-2xl text-lg font-medium">
                        SnowyBot Viewer 是一个粉丝制作的PROJECT SEKAI 游戏数据查看器
                    </p>
                </div>

                {/* Main Content: Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Card 1: Non-Profit */}
                    <div className="md:col-span-2 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm flex flex-col hover:shadow-xl transition-shadow">
                        <div className="flex gap-4 items-center mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-miku to-miku-dark flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-miku/20">
                                ❤️
                            </div>
                            <div className="flex flex-col justify-center">
                                <p className="text-lg font-bold text-primary-text">非盈利声明 (Non-Profit)</p>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Powered by Love</p>
                            </div>
                        </div>
                        <hr className="border-slate-100 mb-4" />
                        <div className="text-slate-600 leading-relaxed space-y-4">
                            <p>
                                SnowyBot 是一个完全由个人开发者维护的非盈利项目。开发者承诺 <b>永久免费</b>，且 <b>不接受任何形式的捐赠</b>。
                            </p>
                            <p>
                                服务器成本由开发者自行承担。如果您喜欢这个项目，欢迎参与 Snowybot主站的 <Link href="/creator" className="text-miku font-bold">创作者计划</Link>，为社区贡献更多优质的 2D 角色chibi小人，这就是对开发者最大的支持。
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Developer */}
                    <div className="p-6 rounded-xl shadow-md border-none bg-primary-text text-white flex flex-col items-center justify-center text-center hover:shadow-xl transition-shadow">
                        <p className="w-full text-left text-xs font-bold opacity-80 uppercase tracking-widest mb-4">Developer</p>
                        <div className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl mb-4 overflow-hidden relative">
                            <Image
                                src="https://github.com/Exmeaning.png"
                                alt="Exmeaning"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <h3 className="text-2xl font-bold">Exmeaning (東雪)</h3>
                        <p className="text-miku text-sm font-bold mt-1">An ordinary developer</p>
                        <div className="mt-6 flex flex-col items-center gap-1 opacity-50 text-xs text-white">
                            <span>"Soul by HelloWorld"</span>
                        </div>
                    </div>

                    {/* Card 3: Tech Stack */}
                    <div className="p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow flex flex-col">
                        <div className="mb-4">
                            <p className="text-md font-bold text-primary-text">Tech Stack</p>
                        </div>
                        <div className="flex flex-wrap gap-2 content-start flex-grow">
                            {techStack.map((tech) => (
                                <span key={tech.name} className={`px-2 py-1 rounded-full text-xs font-bold ${tech.color}`}>
                                    {tech.name}
                                </span>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-xs text-slate-400 font-medium">
                                构建于现代微服务架构，以极低成本承载海量并发。
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Credits & Copyright (Updated with specific authors) */}
                    <div className="md:col-span-2 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <p className="text-md font-bold text-primary-text mb-4">Credits & Copyright</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xs font-bold text-miku mb-3 uppercase tracking-wide border-b border-miku/20 pb-1">Data & Asset Source</h4>
                                <ul className="text-sm text-slate-500 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">●</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://sekai.best" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">Sekai.best</ExternalLink> (Asset/MasterData API)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">●</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://github.com/MejiroRina" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">Haruki（希凪）</ExternalLink> (Data)
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-miku mt-1">●</span>
                                        <div className="text-slate-600 dark:text-slate-300">
                                            <ExternalLink href="https://github.com/watagashi-uni" target="_blank" className="hover:text-miku font-bold transition-colors underline decoration-dotted">Uni/Haruki</ExternalLink> (Assets Hosting)
                                        </div>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-luka mb-3 uppercase tracking-wide border-b border-luka/20 pb-1">License & Open Source</h4>
                                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                                    本站所有游戏素材（图片、音频、文本）版权均归 <b>SEGA</b> 及 <b>Colorful Palette</b> 所有。
                                </p>
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-2">
                                        本项目已在 GitHub 开源并遵循 <b>AGPL-3.0</b> 协议。
                                    </p>
                                    <ExternalLink
                                        href="https://github.com/Exmeaning/Snowy_Viewer"
                                        target="_blank"
                                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-miku transition-colors bg-white px-3 py-2 rounded-md border border-slate-200 shadow-sm hover:shadow"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                        Exmeaning/Snowy_Viewer
                                    </ExternalLink>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Card 5: Special Thanks */}
                    <div className="md:col-span-3 p-6 rounded-xl shadow-md border border-slate-100 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                        <div className="flex items-center gap-2 mb-4">
                            <p className="text-md font-bold text-primary-text">感谢支持snowy的名单（不分先后）</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-7 text-justify">
                            深海 Luna茶 Kazuhira 灵潜 咖啡不甜 郁郁葱葱 TONY_ALL# M氏 大梦 Hakuchumu 葡萄柚 Amia 不解 旭光 阳子 弥佑瑶 サクラかぜ luoxia 陈睿ガチ恋势 猫尾草 笨牛奶 霞綾 世说心羽 木口 沧溟 Aya Belos 兔兔 明日天気に シラ
                            偶像大师希罗酱 性价比……（以上为部分名单 感谢所有默默支持snowybot的人）
                        </p>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
