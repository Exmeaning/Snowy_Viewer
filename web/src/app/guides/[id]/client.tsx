"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { localizePathForBrowser } from "@/lib/localized-path";
import Link from "@/components/LocalizedLink";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import ExternalLink from "@/components/ExternalLink";
import { useI18n } from "@/contexts/I18nContext";
import {
    fetchGuidesIndex,
    fetchGuideContent,
    stripFrontmatter,
    type GuideEntry,
    type GuidesIndex,
} from "@/lib/guides";

/**
 * Category badge.
 *
 * The list page assigned each category its own pastel pair; on a flat opaque
 * system that reads as five unrelated sticker styles. Category is a label, not a
 * status, so one neutral chip is used for all of them and the text carries the
 * distinction. Kept as a single constant so this cannot drift back per-category.
 */
const CATEGORY_BADGE_CLASS =
    "px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[11px] font-bold border " +
    "border-[var(--hh-border)] bg-[var(--hh-surface-1)] text-[var(--hh-text-secondary)]";

// Custom markdown component mapping for Tailwind styling
const markdownComponents = {
    h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
        <h1 className="hh-display text-2xl text-[var(--hh-text-primary)] mt-8 mb-4 first:mt-0" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
        <h2 className="hh-title text-xl font-bold text-[var(--hh-text-primary)] mt-8 mb-3 pb-2 border-b border-[var(--hh-border)]" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
        <h3 className="hh-title text-lg font-bold text-[var(--hh-text-primary)] mt-6 mb-2" {...props}>{children}</h3>
    ),
    p: ({ children, ...props }: React.ComponentProps<"p">) => (
        <p className="hh-body text-[var(--hh-text-secondary)] mb-4 last:mb-0" {...props}>{children}</p>
    ),
    a: ({ href, children, ...props }: React.ComponentProps<"a">) => (
        <ExternalLink
            href={href ?? "#"}
            className="text-[var(--hh-accent-deep)] font-medium hover:underline underline-offset-2"
            {...props}
        >
            {children}
        </ExternalLink>
    ),
    strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
        <strong className="font-bold text-[var(--hh-text-primary)]" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: React.ComponentProps<"em">) => (
        <em className="text-[var(--hh-text-secondary)]" {...props}>{children}</em>
    ),
    blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
        <blockquote className="border-l-4 border-[var(--hh-accent)] pl-4 py-1 my-4 text-[var(--hh-text-secondary)] italic bg-[var(--hh-accent-wash)] rounded-r-[var(--hh-radius-md)]" {...props}>
            {children}
        </blockquote>
    ),
    ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
        <ul className="list-disc list-inside space-y-1 mb-4 text-[var(--hh-text-secondary)]" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
        <ol className="list-decimal list-inside space-y-1 mb-4 text-[var(--hh-text-secondary)]" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: React.ComponentProps<"li">) => (
        <li className="hh-body" {...props}>{children}</li>
    ),
    table: ({ children, ...props }: React.ComponentProps<"table">) => (
        <div className="overflow-x-auto my-4 rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
            <table className="w-full text-sm" {...props}>{children}</table>
        </div>
    ),
    thead: ({ children, ...props }: React.ComponentProps<"thead">) => (
        <thead className="bg-[var(--hh-surface-1)]" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }: React.ComponentProps<"th">) => (
        <th className="px-4 py-2.5 text-left font-bold text-[var(--hh-text-primary)] border-b border-[var(--hh-border)]" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: React.ComponentProps<"td">) => (
        <td className="px-4 py-2.5 text-[var(--hh-text-secondary)] border-b border-[var(--hh-border)]" {...props}>{children}</td>
    ),
    hr: (props: React.ComponentProps<"hr">) => (
        <hr className="hh-divider my-6" {...props} />
    ),
    code: ({ children, className, ...props }: React.ComponentProps<"code">) => {
        // Inline code vs code block
        const isBlock = className?.includes("language-");
        if (isBlock) {
            /* A code block is the deepest trough on the page, so it takes
               --hh-surface-inset and inverts its text in light mode via the
               token pair rather than a hardcoded slate-800. */
            return (
                <code className={`block bg-[var(--hh-surface-inset)] text-[var(--hh-text-primary)] rounded-[var(--hh-radius-md)] p-4 overflow-x-auto text-sm my-4 ${className ?? ""}`} {...props}>
                    {children}
                </code>
            );
        }
        return (
            <code className="px-1.5 py-0.5 bg-[var(--hh-surface-sunken)] text-[var(--hh-text-primary)] rounded-[var(--hh-radius-xs)] text-sm font-mono" {...props}>
                {children}
            </code>
        );
    },
};

function GuideDetailContent() {
    const params = useParams();
    const router = useRouter();
    const { t } = useI18n();
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
                    setError(t("page.guides.detailNotFound"));
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
                setError(err instanceof Error ? err.message : t("page.guides.loadFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [guideId, t]);

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
                <div className="mb-6 p-6 bg-[var(--hh-surface-2)] border border-[var(--hh-accent-alert)] rounded-[var(--hh-radius-lg)] inline-block">
                    <p className="hh-title font-bold text-lg mb-1 text-[var(--hh-accent-alert)]">{t("page.guides.loadFailed")}</p>
                    <p className="text-sm text-[var(--hh-text-secondary)]">{error ?? t("page.guides.unknownError")}</p>
                </div>
                <div>
                    <button
                        onClick={() => router.push(localizePathForBrowser("/guides/"))}
                        className="hh-btn hh-btn-primary hh-press hh-focusable cursor-pointer"
                    >
                        {t("page.guides.backToList")}
                    </button>
                </div>
            </div>
        );
    }

    const categoryLabel = categories[guide.category] ?? guide.category;

    return (
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
            {/* Back Button */}
            <Link
                href="/guides/"
                className="hh-press hh-focusable rounded-[var(--hh-radius-sm)] inline-flex items-center gap-1.5 text-sm font-medium text-[var(--hh-text-tertiary)] hover:text-[var(--hh-accent-deep)] transition-colors mb-6"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("page.guides.backToList")}
            </Link>

            {/* Article Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                    <span className={CATEGORY_BADGE_CLASS}>
                        {categoryLabel}
                    </span>
                    <span className="text-xs text-[var(--hh-text-tertiary)] hh-numeric">{guide.date}</span>
                </div>

                <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)] mb-4">
                    {guide.title}
                </h1>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--hh-text-secondary)]">
                    <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {guide.author.group}
                        {guide.author.supervisor && t("page.guides.supervisor", { name: guide.author.supervisor })}
                    </span>

                    {guide.source && (
                        <ExternalLink
                            href={guide.source}
                            className="flex items-center gap-1 text-[var(--hh-accent-deep)] hover:underline"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {t("page.guides.viewOriginal")}
                        </ExternalLink>
                    )}
                </div>

                {/* Tags */}
                {guide.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {guide.tags.map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 rounded-[var(--hh-radius-xs)] text-[11px] font-medium bg-[var(--hh-surface-sunken)] text-[var(--hh-text-secondary)] border border-[var(--hh-border-hairline)]"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Markdown Content */}
            <div className="hh-tile p-6 sm:p-8">
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
                    className="hh-btn hh-press hh-focusable inline-flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.guides.backToList")}
                </Link>
            </div>
        </div>
    );
}

function GuideDetailLoadingFallback() {
    const { t } = useI18n();

    return (
        <div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">
            {t("page.guides.loadingFallback")}
        </div>
    );
}

export default function GuideDetailClient() {
    return (
        <MainLayout>
            <Suspense fallback={<GuideDetailLoadingFallback />}>
                <GuideDetailContent />
            </Suspense>
        </MainLayout>
    );
}
