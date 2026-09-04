"use client";

import DetailSemanticSeoShell, { type DetailSemanticSeoShellProps } from "./DetailSemanticSeoShell";

export type DetailSeoSummaryProps = DetailSemanticSeoShellProps;

/**
 * Server-rendered semantic SEO shell for CSR detail pages.
 * Rendered with sr-only so it takes 0px visual footprint for humans,
 * while giving search engines and screen readers 100% factual semantic content.
 */
export default function DetailSeoSummary(props: DetailSeoSummaryProps) {
    return <DetailSemanticSeoShell {...props} />;
}

