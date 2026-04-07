"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import ExternalLink from "@/components/ExternalLink";
import {
    fetchGuidesIndex,
    fetchGuideContent,
    stripFrontmatter,
    type GuideEntry,
    type GuidesIndex,
} from "@/lib/guides";

// Category badge colors (same as list page)
const categoryColors: Record<string, string> = {
    gacha: "bg-amber-100 text-amber-700 border-amber-200",
    event: "bg-blue-100 text-blue-700 border-blue-200",
    team: "bg-emerald-100 text-emerald-700 border-emerald-200",
    beginner: "bg-purple-100 text-purple-700 border-purple-200",
    system: "bg-slate-100 text-slate-600 border-slate-200",
};

// Custom markdown component mapping for Tailwind styling
const markdownComponents = {
    h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
        <h1 className="text-2xl font-black text-primary-text mt-8 mb-4 first:mt-0" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
        <h2 className="text-xl font-bold text-primary-text mt-8 mb-3 pb-2 border-b border-slate-100" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
        <h3 className="text-lg font-bold text-primary-text mt-6 mb-2" {...props}>{children}</h3>
    ),
    p: ({ children, ...props }: React.ComponentProps<"p">) => (
        <p className="text-slate-600 leading-relaxed mb-4 last:mb-0" {...props}>{children}</p>
    ),
    a: ({ href, children, ...props }: React.ComponentProps<"a">) => (
        <ExternalLink
            href={href ?? "#"}
            className="text-miku font-medium hover:underline decoration-miku/30 underline-offset-2"
            {...props}
        >
            {children}
        </ExternalLink>
    ),
    strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
        <strong className="font-bold text-primary-text" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: React.ComponentProps<"em">) => (
        <em className="text-slate-500" {...props}>{children}</em>
    ),
    blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
        <blockquote className="border-l-4 border-miku/30 pl-4 py-1 my-4 text-slate-500 italic bg-miku/5 rounded-r-lg" {...props}>
            {children}
        </blockquote>
    ),
    ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
        <ul className="list-disc list-inside space-y-1 mb-4 text-slate-600" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
        <ol className="list-decimal list-inside space-y-1 mb-4 text-slate-600" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: React.ComponentProps<"li">) => (
        <li className="leading-relaxed" {...props}>{children}</li>
    ),
    table: ({ children, ...props }: React.ComponentProps<"table">) => (
        <div className="overflow-x-auto my-4 rounded-xl border border-slate-200">
            <table className="w-full text-sm" {...props}>{children}</table>
        </div>
    ),
    thead: ({ children, ...props }: React.ComponentProps<"thead">) => (
        <thead className="bg-slate-50" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }: React.ComponentProps<"th">) => (
        <th className="px-4 py-2.5 text-left font-bold text-slate-700 border-b border-slate-200" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: React.ComponentProps<"td">) => (
        <td className="px-4 py-2.5 text-slate-600 border-b border-slate-100" {...props}>{children}</td>
    ),
    hr: (props: React.ComponentProps<"hr">) => (
        <hr className="my-6 border-slate-200" {...props} />
    ),
    code: ({ children, className, ...props }: React.ComponentProps<"code">) => {
        // Inline code vs code block
        const isBlock = className?.includes("language-");
        if (isBlock) {
            return (
                <code className={`block bg-slate-800 text-slate-100 rounded-xl p-4 overflow-x-auto text-sm my-4 ${className ?? ""}`} {...props}>
                    {children}
                </code>
            );
        }
        return (
            <code className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-sm font-mono" {...props}>
                {children}
            </code>
        );
    },
};

function GuideDetailContent() {
    const params = useParams();
    const router = useRouter();
    const guideId = params.id as string;

    const [guide, setGuide] = useState<GuideEntry | null>(null);
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setIsLoading(true);

                // Fetch index to find the guide
                const indexData: GuidesIndex = await fetchGuidesIndex();
                const found = indexData.guides.find((g) => g.id === guideId);
                if (!found) {
                    setError("未找到该攻略");
                    return;
                }

                setGuide(found);
                setCategories(indexData.categories);

                // Fetch markdown content
                const raw = await fetchGuideContent(found.path);
                const body = stripFrontmatter(raw);
                setContent(body);
                setError(null);
            } catch (err) {
                console.error("Error loading guide:", err);
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [guideId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="loading-spinner loading-spinner-sm" />
            </div>
        );
    }

    if (error || !guide) {
        return (
            <div className="container mx-auto px-4 sm:px-6 py-12 text-center">
                <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl text-red-600 inline-block">
                    <p className="font-bold text-lg mb-1">加载失败</p>
                    <p className="text-sm">{error ?? "未知错误"}</p>
                </div>
                <div>
                    <button
                        onClick={() => router.push("/guides/")}
                        className="px-6 py-2 bg-miku text-white rounded-lg font-bold hover:opacity-90 transition-all"
                    >
                        返回攻略列表
                    </button>
                </div>
            </div>
        );
    }

    const categoryLabel = categories[guide.category] ?? guide.category;
    const colorClass = categoryColors[guide.category] ?? "bg-slate-100 text-slate-600 border-slate-200";

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
            {/* Back Button */}
            <Link
                href="/guides/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-miku transition-colors mb-6"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回攻略列表
            </Link>

            {/* Article Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}>
                        {categoryLabel}
                    </span>
                    <span className="text-xs text-slate-400">{guide.date}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-primary-text mb-4">
                    {guide.title}
                </h1>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {guide.author.group}
                        {guide.author.supervisor && ` · 监修 ${guide.author.supervisor}`}
                    </span>

                    {guide.source && (
                        <ExternalLink
                            href={guide.source}
                            className="flex items-center gap-1 text-miku hover:underline"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            查看原文
                        </ExternalLink>
                    )}
                </div>

                {/* Tags */}
                {guide.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {guide.tags.map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-400 border border-slate-100"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Markdown Content */}
            <div className="bg-white rounded-2xl shadow ring-1 ring-slate-200 p-6 sm:p-8">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {content}
                </ReactMarkdown>
            </div>

            <div className="mt-8 max-w-xl mx-auto">
                <DetailPageAdCard />
            </div>

            {/* Bottom Back Button */}
            <div className="mt-8 text-center">
                <Link
                    href="/guides/"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回攻略列表
                </Link>
            </div>
        </div>
    );
}

export default function GuideDetailClient() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载攻略...</div>}>
                <GuideDetailContent />
            </Suspense>
        </MainLayout>
    );
}
