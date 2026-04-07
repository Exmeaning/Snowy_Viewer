import React from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "隐私政策",
    description: "Moesekai 隐私政策",
};

export default function PrivacyPolicyPage() {
    return (
        <MainLayout>
            <div className="container mx-auto px-6 py-12 max-w-4xl flex-grow z-10">
                <div className="mb-10">
                    <h1 className="text-3xl font-black text-primary-text mb-2">隐私政策</h1>
                    <p className="text-sm text-slate-400">最后更新日期：2025 年 7 月</p>
                </div>

                <div className="space-y-6">
                    <Section title="1. 概述">
                        <p>
                            Moesekai（以下简称 &quot;本站&quot;，网址 pjsk.moe）是一个非盈利的粉丝向 Project Sekai 游戏数据查看器。
                            我们重视您的隐私，本政策说明了我们如何收集、使用和保护您在使用本站时的信息。
                        </p>
                    </Section>

                    <Section title="2. 我们收集的信息">
                        <p>本站不要求用户注册账号。我们收集的信息非常有限，主要包括：</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-slate-600">
                            <li>浏览器本地存储（localStorage）中的用户偏好设置，如主题颜色、侧边栏状态等</li>
                            <li>通过第三方服务自动收集的匿名技术信息（如 IP 地址、浏览器类型、访问页面、访问时间）</li>
                        </ul>
                    </Section>

                    <Section title="3. Cookie 与广告技术">
                        <p>
                            本站使用 Google AdSense 展示广告。Google 及其广告合作伙伴可能会使用 Cookie
                            来根据用户访问本站或其他网站的记录投放广告。
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-slate-600">
                            <li>Google 使用 Cookie（如 DART Cookie）根据您对本站及其他网站的访问记录向您展示相关广告</li>
                            <li>
                                您可以访问{" "}
                                <a
                                    href="https://www.google.com/settings/ads"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-miku hover:underline font-medium"
                                >
                                    Google 广告设置
                                </a>{" "}
                                来停用个性化广告
                            </li>
                            <li>
                                您也可以访问{" "}
                                <a
                                    href="https://www.aboutads.info/choices/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-miku hover:underline font-medium"
                                >
                                    aboutads.info
                                </a>{" "}
                                来停用第三方广告商的 Cookie
                            </li>
                        </ul>
                    </Section>

                    <Section title="4. 信息的使用">
                        <p>我们收集的有限信息仅用于以下目的：</p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-slate-600">
                            <li>维持和改善网站功能与用户体验</li>
                            <li>通过广告收入维持网站运营成本</li>
                            <li>分析网站流量以优化内容</li>
                        </ul>
                    </Section>

                    <Section title="5. 信息共享">
                        <p>
                            我们不会主动出售、交易或以其他方式向外部方转让您的个人信息。
                            上述规定不包括协助我们运营网站的可信第三方（如 Google AdSense），
                            前提是这些方同意对这些信息保密。
                        </p>
                    </Section>

                    <Section title="6. 第三方链接">
                        <p>
                            本站可能包含指向第三方网站的链接。这些第三方网站有各自独立的隐私政策，
                            我们对其内容和行为不承担任何责任。
                        </p>
                    </Section>

                    <Section title="7. 儿童隐私">
                        <p>
                            本站不面向 13 岁以下的儿童，我们不会有意收集 13 岁以下儿童的个人信息。
                        </p>
                    </Section>

                    <Section title="8. 政策变更">
                        <p>
                            我们可能会不定期更新本隐私政策。任何变更将在本页面发布，
                            建议您定期查看本页面以了解最新信息。
                        </p>
                    </Section>

                    <Section title="9. 联系我们">
                        <p>
                            如果您对本隐私政策有任何疑问，可以通过以下方式联系我们：
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2 text-slate-600">
                            <li>
                                GitHub：{" "}
                                <a
                                    href="https://github.com/moe-sekai/Moesekai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-miku hover:underline font-medium"
                                >
                                    moe-sekai/Moesekai
                                </a>
                            </li>
                            <li>QQ 群：1075068454</li>
                        </ul>
                    </Section>
                </div>

                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        返回首页
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl shadow-md border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-primary-text mb-3">{title}</h2>
            <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
        </div>
    );
}
