interface DetailSeoSummaryProps {
    title: string;
    description: string;
}

/**
 * Accessible server-rendered summary for search engines and assistive technology.
 * Kept visually hidden (sr-only) so it does not interfere with the rich visual UI
 * while remaining fully indexable in the initial HTML DOM.
 */
export default function DetailSeoSummary({ title, description }: DetailSeoSummaryProps) {
    return (
        <aside
            aria-label={title}
            className="sr-only"
        >
            <p>{description}</p>
        </aside>
    );
}
