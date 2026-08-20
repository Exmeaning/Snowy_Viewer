import React from "react";
import Link from "@/components/LocalizedLink";

export interface PageHeaderProps {
    /** Optional pill badge text displayed above the main title. */
    badge?: string;
    /** Primary page title. */
    title: string;
    /** Optional highlighted word or phrase appended to the title (accent colored). */
    titleHighlight?: string;
    /** Page description. ReactNode is supported for embedded links, buttons, or terms modals. */
    description?: React.ReactNode;
    /** Optional return / back link displayed above or alongside the header. */
    backLink?: {
        href: string;
        label: string;
    };
    /** Extra custom node rendered below the header (e.g. disclaimer links, tab switcher, etc.). */
    extra?: React.ReactNode;
    /** Optional additional wrapper CSS classes. */
    className?: string;
}

/**
 * PageHeader — Unified page title & description banner for Handheld OS.
 *
 * Design System Rules:
 * - Built on top of Handheld OS CSS tokens (`--hh-text-*`, `--hh-surface-*`, `--hh-border`, `--hh-radius-*`).
 * - Strictly avoids old glassmorphic blur and hardcoded slate-* utility classes.
 * - Standard presentation: centered alignment, uppercase pill badge with subtle accent wash,
 *   bold title with tracking-display tight letterspacing, balanced secondary text for description.
 */
export default function PageHeader({
    badge,
    title,
    titleHighlight,
    description,
    backLink,
    extra,
    className = "",
}: PageHeaderProps) {
    return (
        <header className={`text-center mb-8 relative ${className}`}>
            {/* Optional back link navigation */}
            {backLink && (
                <div className="flex items-center mb-4">
                    <Link
                        href={backLink.href}
                        className="hh-press inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--hh-text-secondary)] hover:text-[var(--hh-text-primary)] transition-colors px-2 py-1 rounded-[var(--hh-radius-sm)]"
                    >
                        <svg
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        <span>{backLink.label}</span>
                    </Link>
                </div>
            )}

            {/* Pill Badge */}
            {badge && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[var(--hh-accent-wash)] border border-[var(--hh-border-strong)] rounded-[var(--hh-radius-full)] mb-3 shadow-[var(--hh-shadow-tile)]">
                    <span className="text-[var(--hh-accent-deep)] dark:text-[var(--hh-accent)] text-xs font-bold tracking-widest uppercase">
                        {badge}
                    </span>
                </div>
            )}

            {/* Main Title */}
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--hh-text-primary)] tracking-[var(--hh-tracking-display)]">
                {title}
                {titleHighlight ? (
                    <>
                        {" "}
                        <span className="text-[var(--hh-accent-deep)] dark:text-[var(--hh-accent)]">
                            {titleHighlight}
                        </span>
                    </>
                ) : null}
            </h1>

            {/* Description */}
            {description && (
                <div className="text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto text-sm sm:text-base font-normal leading-[var(--hh-leading-body)]">
                    {description}
                </div>
            )}

            {/* Extra content */}
            {extra && (
                <div className="mt-4 flex flex-col items-center justify-center">
                    {extra}
                </div>
            )}
        </header>
    );
}
