interface DetailSeoSummaryProps {
    title: string;
    description: string;
}

/**
 * A short, genuinely visible server-rendered introduction for CSR detail pages.
 * It lives after the interactive page so it does not compete with the richer
 * client UI, while still giving users and crawlers useful initial HTML.
 */
export default function DetailSeoSummary({ title, description }: DetailSeoSummaryProps) {
    return (
        <aside
            aria-label={title}
            className="mx-auto my-6 max-w-5xl px-4 text-sm leading-7 text-[var(--hh-text-secondary)]"
        >
            <p className="hh-tile px-5 py-4">
                {description}
            </p>
        </aside>
    );
}
